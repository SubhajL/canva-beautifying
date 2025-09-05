import { NextRequest } from 'next/server'
import { 
  authenticateAPIKey, 
  hasRequiredScopes,
  authorize
} from '@/lib/api/auth'
import { withDualRateLimit } from '@/lib/api/middleware/dual-rate-limit'
import { withCircuitBreaker } from '@/lib/api/middleware/circuit-breaker'
import { withValidation, createValidator } from '@/lib/api/middleware/validation'
import { 
  successResponse, 
  errorResponse, 
  apiErrors,
  ApiError 
} from '@/lib/api/response'
import { enhanceRequestSchema } from '@/lib/api/validation'
import { generateRequestId, validateFileUpload } from '@/lib/api/middleware'
import { uploadFile } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'
import { getQueue, QUEUE_NAMES } from '@/lib/queue/client'
import { documentCache } from '@/lib/cache/init'
import { webhookManager } from '@/lib/api/webhooks/manager'
import { APIVersionManager } from '@/lib/api/versioning'
import { APIRequestContext } from '@/lib/api/types'
import { z } from 'zod'
import { logger } from '@/lib/observability'

// V2 enhancement request schema
const v2EnhanceRequestSchema = enhanceRequestSchema.extend({
  webhookUrl: z.string().url().optional(),
  webhookEvents: z.array(z.enum([
    'enhancement.started',
    'enhancement.progress',
    'enhancement.completed',
    'enhancement.failed'
  ])).optional(),
  cacheKey: z.string().optional(),
  bypassCache: z.boolean().optional()
})

// Composed middleware chain
const enhanceHandler = withCircuitBreaker(
  withDualRateLimit(
    async (request: NextRequest, context?: APIRequestContext) => {
      const requestId = context?.requestId || generateRequestId()
      const versionManager = APIVersionManager.getInstance()
      const version = versionManager.extractVersion(request)
      
      try {
        // Authenticate request
        const auth = await authorize(request, ['enhance:write'])
        const userId = auth.userId
        
        // Parse form data
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        
        // Validate file
        validateFileUpload(file!)
        
        // Parse and validate enhancement settings
        const settingsRaw = formData.get('settings')
        let settings = {}
        
        if (settingsRaw) {
          try {
            settings = JSON.parse(settingsRaw as string)
          } catch {
            throw apiErrors.VALIDATION_ERROR('Invalid JSON in settings field')
          }
        }
        
        const validation = v2EnhanceRequestSchema.safeParse(settings)
        if (!validation.success) {
          throw apiErrors.VALIDATION_ERROR(
            'Invalid request data',
            validation.error.flatten()
          )
        }
        
        const enhanceRequest = validation.data
        
        // Check cache if enabled
        if (!enhanceRequest.bypassCache) {
          const fileBuffer = Buffer.from(await file!.arrayBuffer())
          const cacheKey = enhanceRequest.cacheKey || undefined
          
          const cachedResult = await documentCache.checkSimilarDocument(
            fileBuffer,
            userId,
            cacheKey
          )
          
          if (cachedResult && cachedResult.similarity > 0.95) {
            logger.info({
              requestId,
              userId,
              cacheHit: true,
              similarity: cachedResult.similarity
            }, 'Cache hit for enhancement request')
            
            return successResponse({
              id: cachedResult.enhancementId,
              documentId: cachedResult.documentId,
              status: 'completed',
              progress: 100,
              enhancedUrl: cachedResult.enhancedUrl,
              thumbnailUrl: cachedResult.thumbnailUrl,
              improvements: cachedResult.metadata?.improvements,
              fromCache: true,
              cacheKey: cachedResult.cacheKey,
              createdAt: cachedResult.created_at
            }, {
              requestId,
              version
            })
          }
        }
        
        // Generate unique IDs
        const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const enhancementId = `enh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Upload file to R2
        const fileBuffer = Buffer.from(await file!.arrayBuffer())
        const fileExtension = file!.name.split('.').pop() || 'pdf'
        const fileName = `${documentId}.${fileExtension}`
        
        const fileUrl = await uploadFile({
          file: fileBuffer,
          userId,
          filename: fileName,
          folder: 'ORIGINAL',
          contentType: file!.type
        })
        
        // Store in cache for future similarity checks
        await documentCache.storeDocument({
          content: fileBuffer,
          documentId,
          enhancementId,
          userId,
          cacheKey: enhanceRequest.cacheKey,
          metadata: {
            fileName: file!.name,
            fileType: file!.type,
            fileSize: file!.size
          }
        })
        
        // Create database records
        const supabase = await createClient()
        
        // Create document record
        const { error: docError } = await supabase
          .from('documents')
          .insert({
            id: documentId,
            user_id: userId,
            name: file!.name,
            type: file!.type,
            size: file!.size,
            original_url: fileUrl,
            status: 'processing',
          })
          .select()
          .single()
        
        if (docError) {
          throw new ApiError(
            'DATABASE_ERROR',
            'Failed to create document',
            500,
            { details: docError }
          )
        }
        
        // Create enhancement record
        const { error: enhError } = await supabase
          .from('enhancements')
          .insert({
            id: enhancementId,
            document_id: documentId,
            user_id: userId,
            status: 'pending',
            settings: enhanceRequest.enhancementSettings || {},
            metadata: {
              ...enhanceRequest.metadata,
              webhookUrl: enhanceRequest.webhookUrl,
              webhookEvents: enhanceRequest.webhookEvents,
              apiVersion: version
            },
          })
          .select()
          .single()
        
        if (enhError) {
          throw new ApiError(
            'DATABASE_ERROR',
            'Failed to create enhancement',
            500,
            { details: enhError }
          )
        }
        
        // Create webhook subscription if provided
        if (enhanceRequest.webhookUrl) {
          await webhookManager.createWebhook(userId, {
            url: enhanceRequest.webhookUrl,
            events: enhanceRequest.webhookEvents || [
              'enhancement.started',
              'enhancement.completed',
              'enhancement.failed'
            ],
            headers: {
              'X-Enhancement-ID': enhancementId,
              'X-Document-ID': documentId
            }
          })
        }
        
        // Get user's subscription tier for queue priority
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single()
        
        const tier = profile?.subscription_tier || 'free'
        
        // Queue the enhancement job
        const enhancementQueue = getQueue(QUEUE_NAMES.ENHANCEMENT)
        
        const job = await enhancementQueue.add(
          'process-enhancement',
          {
            documentId,
            userId,
            enhancementId,
            analysisResults: {
              colors: {},
              typography: {},
              layout: {},
              content: {},
              quality: {}
            },
            enhancementSettings: enhanceRequest.enhancementSettings || {},
            subscriptionTier: tier,
            webhookUrl: enhanceRequest.webhookUrl,
            webhookEvents: enhanceRequest.webhookEvents
          },
          {
            priority: enhanceRequest.priority === 'high' ? 1 : 
                     enhanceRequest.priority === 'low' ? 3 : 2,
            removeOnComplete: true,
            removeOnFail: false,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        )
        
        // Return response with v2 enhancements
        return successResponse({
          id: enhancementId,
          documentId,
          status: 'pending',
          progress: 0,
          queuePosition: await enhancementQueue.getWaitingCount(),
          estimatedWaitTime: tier === 'free' ? 300 : tier === 'basic' ? 120 : 60,
          createdAt: new Date().toISOString(),
          webhookSubscribed: !!enhanceRequest.webhookUrl,
          cacheEnabled: !enhanceRequest.bypassCache,
          links: {
            self: `/api/v2/enhance/${enhancementId}`,
            document: `/api/v2/documents/${documentId}`,
            cancel: `/api/v2/enhance/${enhancementId}`,
            webhooks: enhanceRequest.webhookUrl ? `/api/v2/webhooks` : undefined
          },
        }, {
          requestId,
          version,
          deprecation: version === 'v1' ? {
            deprecated: true,
            sunsetDate: '2025-01-01',
            alternativeVersion: 'v2',
            migrationGuide: 'https://docs.beautifyai.com/api/migration'
          } : undefined
        })
      } catch (error) {
        if (error instanceof ApiError) {
          throw error
        }
        
        logger.error({ err: error, requestId }, 'Enhancement request failed')
        throw apiErrors.INTERNAL_ERROR
      }
    },
    {
      endpoint: 'enhance'
    }
  ),
  'enhance',
  {
    fallbackResponse: async (req: NextRequest) => {
      // Try to return cached result during circuit breaker open state
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      
      if (file) {
        const fileBuffer = Buffer.from(await file.arrayBuffer())
        const auth = await authorize(req, ['enhance:read'])
        
        const cachedResult = await documentCache.checkSimilarDocument(
          fileBuffer,
          auth.userId
        )
        
        if (cachedResult && cachedResult.similarity > 0.85) {
          return successResponse({
            id: cachedResult.enhancementId,
            status: 'completed',
            fromCache: true,
            fallback: true,
            enhancedUrl: cachedResult.enhancedUrl
          })
        }
      }
      
      throw apiErrors.SERVICE_UNAVAILABLE
    }
  }
)

// Export handlers
export async function POST(request: NextRequest) {
  return enhanceHandler(request)
}

// Handle CORS preflight
export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-API-Version',
      'Access-Control-Max-Age': '86400',
    },
  })
}