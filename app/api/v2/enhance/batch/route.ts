import { NextRequest } from 'next/server'
import { authorize } from '@/lib/api/auth'
import { withRedisRateLimit } from '@/lib/api/middleware/rate-limit'
import { withCircuitBreaker } from '@/lib/api/middleware/circuit-breaker'
import { successResponse, apiErrors, ApiError } from '@/lib/api/response'
import { generateRequestId, validateFileUpload } from '@/lib/api/middleware'
import { uploadFile } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'
import { getQueue, QUEUE_NAMES } from '@/lib/queue/client'
import { documentCache } from '@/lib/cache/init'
import { webhookManager } from '@/lib/api/webhooks/manager'
import { APIVersionManager } from '@/lib/api/versioning'
import { z } from 'zod'
import { logger } from '@/lib/observability'

// Batch enhancement request schema
const batchEnhanceRequestSchema = z.object({
  files: z.array(z.object({
    name: z.string(),
    settings: z.object({
      enhancementSettings: z.record(z.any()).optional(),
      metadata: z.record(z.any()).optional(),
      priority: z.enum(['high', 'normal', 'low']).optional()
    }).optional()
  })).min(1).max(10),
  globalSettings: z.object({
    enhancementSettings: z.record(z.any()).optional(),
    metadata: z.record(z.any()).optional(),
    priority: z.enum(['high', 'normal', 'low']).optional(),
    webhookUrl: z.string().url().optional(),
    webhookEvents: z.array(z.enum([
      'batch.started',
      'batch.progress',
      'batch.completed',
      'batch.failed',
      'enhancement.completed',
      'enhancement.failed'
    ])).optional(),
    stopOnError: z.boolean().optional()
  }).optional()
})

// Composed middleware chain
const batchEnhanceHandler = withCircuitBreaker(
  withRedisRateLimit(
    async (request: NextRequest) => {
      const requestId = generateRequestId()
      const versionManager = APIVersionManager.getInstance()
      const version = versionManager.extractVersion(request)
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      try {
        // Authenticate request
        const auth = await authorize(request, ['enhance:write'])
        const userId = auth.userId
        
        // Parse form data
        const formData = await request.formData()
        
        // Extract files and settings
        const files: File[] = []
        const fileSettings: Record<string, any> = {}
        let globalSettings: any = {}
        
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            files.push(value)
          } else if (key === 'settings') {
            try {
              const settings = JSON.parse(value as string)
              const validation = batchEnhanceRequestSchema.safeParse(settings)
              
              if (!validation.success) {
                throw apiErrors.VALIDATION_ERROR(
                  'Invalid batch settings',
                  validation.error.flatten()
                )
              }
              
              globalSettings = validation.data.globalSettings || {}
              validation.data.files.forEach((fileConfig, index) => {
                fileSettings[index] = fileConfig.settings
              })
            } catch (error) {
              if (error instanceof ApiError) throw error
              throw apiErrors.VALIDATION_ERROR('Invalid JSON in settings field')
            }
          }
        }
        
        // Validate files
        if (files.length === 0) {
          throw apiErrors.VALIDATION_ERROR('No files provided')
        }
        
        if (files.length > 10) {
          throw apiErrors.VALIDATION_ERROR('Maximum 10 files allowed per batch')
        }
        
        files.forEach(file => validateFileUpload(file))
        
        // Create webhook subscription for batch if provided
        let batchWebhookId: string | undefined
        if (globalSettings.webhookUrl) {
          const webhook = await webhookManager.createWebhook(userId, {
            url: globalSettings.webhookUrl,
            events: globalSettings.webhookEvents || [
              'batch.started',
              'batch.completed',
              'batch.failed'
            ],
            headers: {
              'X-Batch-ID': batchId
            }
          })
          batchWebhookId = webhook.id
          
          // Send batch.started event
          await webhookManager.queueDelivery(webhook, 'batch.started', {
            batchId,
            totalFiles: files.length,
            startedAt: new Date().toISOString()
          })
        }
        
        const supabase = await createClient()
        const enhancementQueue = getQueue(QUEUE_NAMES.ENHANCEMENT)
        
        // Process each file
        const results = await Promise.allSettled(
          files.map(async (file, index) => {
            try {
              // Check cache
              const fileBuffer = Buffer.from(await file.arrayBuffer())
              const cachedResult = await documentCache.checkSimilarDocument(
                fileBuffer,
                userId
              )
              
              if (cachedResult && cachedResult.similarity > 0.95) {
                return {
                  fileName: file.name,
                  enhancementId: cachedResult.enhancementId,
                  documentId: cachedResult.documentId,
                  status: 'completed',
                  fromCache: true,
                  enhancedUrl: cachedResult.enhancedUrl
                }
              }
              
              // Generate IDs
              const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`
              const enhancementId = `enh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`
              
              // Upload file
              const fileExtension = file.name.split('.').pop() || 'pdf'
              const fileName = `${documentId}.${fileExtension}`
              
              const fileUrl = await uploadFile({
                file: fileBuffer,
                userId,
                filename: fileName,
                folder: 'ORIGINAL',
                contentType: file.type
              })
              
              // Store in cache
              await documentCache.storeDocument({
                content: fileBuffer,
                documentId,
                enhancementId,
                userId,
                metadata: {
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  batchId
                }
              })
              
              // Create document record
              const { error: docError } = await supabase
                .from('documents')
                .insert({
                  id: documentId,
                  user_id: userId,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  original_url: fileUrl,
                  status: 'processing',
                  metadata: { batchId }
                })
                .select()
                .single()
              
              if (docError) throw docError
              
              // Merge settings
              const settings = {
                ...globalSettings.enhancementSettings,
                ...(fileSettings[index]?.enhancementSettings || {})
              }
              
              const metadata = {
                ...globalSettings.metadata,
                ...(fileSettings[index]?.metadata || {}),
                batchId,
                fileIndex: index
              }
              
              // Create enhancement record
              const { error: enhError } = await supabase
                .from('enhancements')
                .insert({
                  id: enhancementId,
                  document_id: documentId,
                  user_id: userId,
                  status: 'pending',
                  settings,
                  metadata
                })
                .select()
                .single()
              
              if (enhError) throw enhError
              
              // Queue enhancement job
              const priority = fileSettings[index]?.priority || globalSettings.priority || 'normal'
              
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
                  enhancementSettings: settings,
                  subscriptionTier: 'pro', // Batch processing requires pro tier
                  batchId,
                  batchWebhookUrl: globalSettings.webhookUrl
                },
                {
                  priority: priority === 'high' ? 1 : priority === 'low' ? 3 : 2,
                  removeOnComplete: true,
                  removeOnFail: false,
                  attempts: 3,
                  backoff: {
                    type: 'exponential',
                    delay: 2000,
                  }
                }
              )
              
              return {
                fileName: file.name,
                enhancementId,
                documentId,
                status: 'queued',
                jobId: job.id
              }
            } catch (error) {
              logger.error({ err: error, fileName: file.name, batchId }, 'Failed to process file in batch')
              
              if (globalSettings.stopOnError) {
                throw error
              }
              
              return {
                fileName: file.name,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Processing failed'
              }
            }
          })
        )
        
        // Process results
        const successfulFiles = results.filter(r => r.status === 'fulfilled').map(r => (r as any).value)
        const failedFiles = results.filter(r => r.status === 'rejected').map(r => ({
          fileName: files[results.indexOf(r)].name,
          status: 'failed',
          error: (r as any).reason?.message || 'Processing failed'
        }))
        
        const allResults = [...successfulFiles, ...failedFiles]
        
        // Update batch webhook with completion if all failed
        if (batchWebhookId && failedFiles.length === files.length) {
          const webhook = await webhookManager.getWebhook(userId, batchWebhookId)
          await webhookManager.queueDelivery(webhook, 'batch.failed', {
            batchId,
            totalFiles: files.length,
            failedFiles: failedFiles.length,
            completedAt: new Date().toISOString(),
            results: allResults
          })
        }
        
        return successResponse({
          batchId,
          totalFiles: files.length,
          queuedFiles: successfulFiles.filter(f => f.status === 'queued').length,
          cachedFiles: successfulFiles.filter(f => f.fromCache).length,
          failedFiles: failedFiles.length,
          results: allResults,
          webhookSubscribed: !!globalSettings.webhookUrl,
          links: {
            self: `/api/v2/enhance/batch/${batchId}`,
            webhooks: globalSettings.webhookUrl ? `/api/v2/webhooks` : undefined
          }
        }, {
          requestId,
          version
        })
      } catch (error) {
        logger.error({ err: error, requestId, batchId }, 'Batch enhancement failed')
        
        if (error instanceof ApiError) {
          throw error
        }
        
        throw apiErrors.INTERNAL_ERROR
      }
    },
    {
      windowMs: 60 * 1000,
      maxRequests: 10, // Lower limit for batch operations
      skipFailedRequests: true
    }
  ),
  'batch-enhance',
  {
    config: {
      failureThreshold: 3,
      resetTimeout: 120000 // 2 minutes
    }
  }
)

// Export handler
export async function POST(request: NextRequest) {
  return batchEnhanceHandler(request)
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