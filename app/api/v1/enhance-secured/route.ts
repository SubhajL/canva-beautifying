import { NextRequest } from 'next/server'
import { 
  authenticateRequest, 
  generateRequestId,
  validateFileUpload 
} from '@/lib/api/middleware'
import { withDualRateLimit } from '@/lib/api/middleware/dual-rate-limit'
import { 
  successResponse
} from '@/lib/api/response'
import { 
  enhanceRequestSchema, 
  validateRequest,
  formatValidationErrors 
} from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { uploadFile } from '@/lib/r2'
import { getQueue, QUEUE_NAMES } from '@/lib/queue/client'
import { asyncHandler } from '@/lib/middleware/error-middleware'
import { 
  ValidationError,
  DatabaseError
} from '@/lib/utils/api-error-handler'
import { APIRequestContext } from '@/lib/api/types'
import { documentRoute } from '@/lib/api/openapi/decorators'
import { routeRegistry } from '@/lib/api/openapi/registry'
import { z } from 'zod'

// Response schema for enhancement
const enhanceResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.literal('processing'),
  estimated_time: z.number(),
  webhook_url: z.string().url().optional()
})

/**
 * Enhanced version of the enhance endpoint with dual rate limiting
 * This prevents authenticated users from bypassing rate limits
 */
const enhanceHandler = async (request: NextRequest, context?: APIRequestContext) => {
  const requestId = context?.requestId || generateRequestId()
  
  // Authenticate request - auth info is passed via context if dual rate limit middleware already authenticated
  const auth = context?.user || context?.apiKey
  const userId = auth ? (context?.user?.id || context?.apiKey?.userId) : await authenticateRequest(request).then(r => r.userId)
  
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
      throw ValidationError.create('Invalid JSON in settings field')
    }
  }
  
  // Validate enhancement request
  const validationResult = await validateRequest(enhanceRequestSchema, {
    type: formData.get('type') || 'auto',
    options: settings,
    webhook_url: formData.get('webhook_url') as string | undefined
  })
  
  if (!validationResult.success) {
    throw ValidationError.create(
      'Invalid enhancement request',
      formatValidationErrors(validationResult.error)
    )
  }
  
  const enhancementData = validationResult.data
  
  // Create database records
  const supabase = await createClient()
  
  // Create document record
  const documentId = crypto.randomUUID()
  const { error: docError } = await supabase
    .from('documents')
    .insert({
      id: documentId,
      user_id: userId,
      type: enhancementData.type,
      status: 'pending',
      original_name: file.name,
      original_size: file.size,
      mime_type: file.type,
      webhook_url: enhancementData.webhook_url
    })
  
  if (docError) {
    throw DatabaseError.fromSupabaseError(docError)
  }
  
  // Upload original file to R2
  const uploadKey = `original/${userId}/${documentId}`
  const { url: originalUrl } = await uploadFile(uploadKey, file)
  
  // Update document with storage URL
  await supabase
    .from('documents')
    .update({ original_url: originalUrl })
    .eq('id', documentId)
  
  // Queue enhancement job with priority based on user tier
  const queue = getQueue(QUEUE_NAMES.DOCUMENT_ANALYSIS)
  
  // Get user tier for job priority
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single()
  
  const priority = {
    premium: 1,
    pro: 2,
    basic: 3,
    free: 4
  }[userProfile?.subscription_tier || 'free']
  
  await queue.add(
    'analyze-document',
    {
      documentId,
      userId,
      type: enhancementData.type,
      options: enhancementData.options || {},
      webhookUrl: enhancementData.webhook_url
    },
    {
      priority,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      }
    }
  )
  
  return successResponse(
    {
      id: documentId,
      status: 'processing',
      estimated_time: 60, // seconds
      webhook_url: enhancementData.webhook_url
    },
    { 
      requestId,
      rateLimit: context?.metadata?.rateLimit 
    }
  )
}

// Export with dual rate limiting and OpenAPI documentation
export const POST = withDualRateLimit(
  asyncHandler(
    documentRoute(
      enhanceHandler,
      {
        method: 'POST',
        path: '/api/v1/enhance-secured',
        operationId: 'enhanceDocumentSecured',
        summary: 'Enhance document with dual rate limiting',
        description: 'Enhanced version of the enhance endpoint with dual rate limiting to prevent authenticated users from bypassing rate limits',
        tags: ['Enhancements'],
        security: [
          { bearer: [] },
          { apiKey: [] }
        ]
      },
      {
        body: {
          type: 'object',
          required: ['file'],
          properties: {
            file: {
              type: 'string',
              format: 'binary',
              description: 'Document file to enhance'
            },
            type: {
              type: 'string',
              enum: ['auto', 'worksheet', 'presentation', 'marketing', 'infographic'],
              default: 'auto',
              description: 'Document type for targeted enhancement'
            },
            settings: {
              type: 'string',
              description: 'JSON string containing enhancement options'
            },
            webhook_url: {
              type: 'string',
              format: 'uri',
              description: 'URL to receive webhook notifications'
            }
          }
        },
        contentType: 'multipart/form-data'
      },
      {
        200: {
          description: 'Enhancement job created successfully',
          schema: enhanceResponseSchema
        },
        400: {
          description: 'Invalid request - validation error'
        },
        401: {
          description: 'Unauthorized'
        },
        413: {
          description: 'File too large'
        },
        415: {
          description: 'Unsupported file type'
        },
        429: {
          description: 'Rate limit exceeded'
        },
        500: {
          description: 'Internal server error'
        }
      }
    )
  ),
  {
    endpoint: 'enhance'
  }
)

// Register routes
routeRegistry.registerRoute('/api/v1/enhance-secured', 'POST')