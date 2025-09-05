import { NextRequest } from 'next/server'
import { authorize } from '@/lib/api/auth'
import { withRedisRateLimit } from '@/lib/api/middleware/rate-limit'
import { withValidation, createValidator } from '@/lib/api/middleware/validation'
import { successResponse, apiErrors } from '@/lib/api/response'
import { generateRequestId } from '@/lib/api/middleware'
import { webhookManager } from '@/lib/api/webhooks/manager'
import { APIVersionManager } from '@/lib/api/versioning'
import { z } from 'zod'
import { logger } from '@/lib/observability'

// Webhook creation schema
const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum([
    'enhancement.started',
    'enhancement.progress',
    'enhancement.completed',
    'enhancement.failed',
    'document.uploaded',
    'document.analyzed',
    'export.completed'
  ])).min(1),
  headers: z.record(z.string()).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).max(10).optional(),
    initialDelayMs: z.number().min(100).max(10000).optional(),
    backoffMultiplier: z.number().min(1).max(5).optional(),
    maxDelayMs: z.number().min(1000).max(60000).optional()
  }).optional()
})

// Webhook update schema
const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.enum([
    'enhancement.started',
    'enhancement.progress',
    'enhancement.completed',
    'enhancement.failed',
    'document.uploaded',
    'document.analyzed',
    'export.completed'
  ])).min(1).optional(),
  isActive: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).max(10).optional(),
    initialDelayMs: z.number().min(100).max(10000).optional(),
    backoffMultiplier: z.number().min(1).max(5).optional(),
    maxDelayMs: z.number().min(1000).max(60000).optional()
  }).optional()
})

// GET /api/v2/webhooks - List webhooks
export const GET = withRedisRateLimit(
  async (request: NextRequest) => {
    const requestId = generateRequestId()
    const versionManager = APIVersionManager.getInstance()
    const version = versionManager.extractVersion(request)
    
    try {
      // Authenticate request
      const auth = await authorize(request, ['webhooks:read'])
      const userId = auth.userId
      
      // Parse query parameters
      const url = new URL(request.url)
      const isActive = url.searchParams.get('active')
      const event = url.searchParams.get('event')
      
      const options: Parameters<typeof webhookManager.listWebhooks>[1] = {}
      
      if (isActive !== null) {
        options.isActive = isActive === 'true'
      }
      
      if (event) {
        options.events = [event as any]
      }
      
      const webhooks = await webhookManager.listWebhooks(userId, options)
      
      // Format response
      const formattedWebhooks = webhooks.map(webhook => ({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.is_active,
        headers: webhook.headers,
        retryPolicy: {
          maxAttempts: webhook.retry_policy.max_attempts,
          initialDelayMs: webhook.retry_policy.initial_delay_ms,
          backoffMultiplier: webhook.retry_policy.backoff_multiplier,
          maxDelayMs: webhook.retry_policy.max_delay_ms
        },
        createdAt: webhook.created_at,
        updatedAt: webhook.updated_at,
        links: {
          self: `/api/v2/webhooks/${webhook.id}`,
          logs: `/api/v2/webhooks/${webhook.id}/logs`,
          rotateSecret: `/api/v2/webhooks/${webhook.id}/rotate-secret`
        }
      }))
      
      return successResponse({
        webhooks: formattedWebhooks,
        total: formattedWebhooks.length
      }, {
        requestId,
        version
      })
    } catch (error) {
      logger.error({ err: error, requestId }, 'Failed to list webhooks')
      throw apiErrors.INTERNAL_ERROR
    }
  },
  {
    windowMs: 60 * 1000,
    maxRequests: 200
  }
)

// POST /api/v2/webhooks - Create webhook
export const POST = withRedisRateLimit(
  withValidation(
    async (request: NextRequest, data: z.infer<typeof createWebhookSchema>) => {
      const requestId = generateRequestId()
      const versionManager = APIVersionManager.getInstance()
      const version = versionManager.extractVersion(request)
      
      try {
        // Authenticate request
        const auth = await authorize(request, ['webhooks:write'])
        const userId = auth.userId
        
        // Create webhook
        const webhook = await webhookManager.createWebhook(userId, {
          url: data.url,
          events: data.events,
          headers: data.headers,
          retryPolicy: data.retryPolicy ? {
            max_attempts: data.retryPolicy.maxAttempts,
            initial_delay_ms: data.retryPolicy.initialDelayMs,
            backoff_multiplier: data.retryPolicy.backoffMultiplier,
            max_delay_ms: data.retryPolicy.maxDelayMs
          } : undefined
        })
        
        logger.info({ webhookId: webhook.id, userId }, 'Webhook created')
        
        return successResponse({
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret, // Only shown once on creation
          isActive: webhook.is_active,
          headers: webhook.headers,
          retryPolicy: {
            maxAttempts: webhook.retry_policy.max_attempts,
            initialDelayMs: webhook.retry_policy.initial_delay_ms,
            backoffMultiplier: webhook.retry_policy.backoff_multiplier,
            maxDelayMs: webhook.retry_policy.max_delay_ms
          },
          createdAt: webhook.created_at,
          links: {
            self: `/api/v2/webhooks/${webhook.id}`,
            logs: `/api/v2/webhooks/${webhook.id}/logs`,
            test: `/api/v2/webhooks/${webhook.id}/test`
          }
        }, {
          requestId,
          version
        })
      } catch (error) {
        logger.error({ err: error, requestId }, 'Failed to create webhook')
        
        if (error === apiErrors.VALIDATION_ERROR) {
          throw error
        }
        
        throw apiErrors.INTERNAL_ERROR
      }
    },
    {
      schema: createWebhookSchema,
      source: 'body'
    }
  ),
  {
    windowMs: 60 * 1000,
    maxRequests: 20
  }
)

// PUT /api/v2/webhooks/[id] - Update webhook
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRedisRateLimit(
    withValidation(
      async (req: NextRequest, data: z.infer<typeof updateWebhookSchema>) => {
        const requestId = generateRequestId()
        const versionManager = APIVersionManager.getInstance()
        const version = versionManager.extractVersion(req)
        const webhookId = params.id
        
        try {
          // Authenticate request
          const auth = await authorize(req, ['webhooks:write'])
          const userId = auth.userId
          
          // Update webhook
          const updates: Parameters<typeof webhookManager.updateWebhook>[2] = {}
          
          if (data.url) updates.url = data.url
          if (data.events) updates.events = data.events
          if (data.isActive !== undefined) updates.is_active = data.isActive
          if (data.headers) updates.headers = data.headers
          if (data.retryPolicy) {
            updates.retry_policy = {
              max_attempts: data.retryPolicy.maxAttempts!,
              initial_delay_ms: data.retryPolicy.initialDelayMs!,
              backoff_multiplier: data.retryPolicy.backoffMultiplier!,
              max_delay_ms: data.retryPolicy.maxDelayMs!
            }
          }
          
          const webhook = await webhookManager.updateWebhook(userId, webhookId, updates)
          
          logger.info({ webhookId, userId }, 'Webhook updated')
          
          return successResponse({
            id: webhook.id,
            url: webhook.url,
            events: webhook.events,
            isActive: webhook.is_active,
            headers: webhook.headers,
            retryPolicy: {
              maxAttempts: webhook.retry_policy.max_attempts,
              initialDelayMs: webhook.retry_policy.initial_delay_ms,
              backoffMultiplier: webhook.retry_policy.backoff_multiplier,
              maxDelayMs: webhook.retry_policy.max_delay_ms
            },
            updatedAt: webhook.updated_at,
            links: {
              self: `/api/v2/webhooks/${webhook.id}`,
              logs: `/api/v2/webhooks/${webhook.id}/logs`,
              rotateSecret: `/api/v2/webhooks/${webhook.id}/rotate-secret`
            }
          }, {
            requestId,
            version
          })
        } catch (error) {
          logger.error({ err: error, requestId, webhookId }, 'Failed to update webhook')
          
          if (error === apiErrors.NOT_FOUND) {
            throw error
          }
          
          throw apiErrors.INTERNAL_ERROR
        }
      },
      {
        schema: updateWebhookSchema,
        source: 'body'
      }
    ),
    {
      windowMs: 60 * 1000,
      maxRequests: 50
    }
  )(request)
}

// DELETE /api/v2/webhooks/[id] - Delete webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRedisRateLimit(
    async (req: NextRequest) => {
      const requestId = generateRequestId()
      const versionManager = APIVersionManager.getInstance()
      const version = versionManager.extractVersion(req)
      const webhookId = params.id
      
      try {
        // Authenticate request
        const auth = await authorize(req, ['webhooks:delete'])
        const userId = auth.userId
        
        // Delete webhook
        await webhookManager.deleteWebhook(userId, webhookId)
        
        logger.info({ webhookId, userId }, 'Webhook deleted')
        
        return successResponse({
          message: 'Webhook deleted successfully'
        }, {
          requestId,
          version
        })
      } catch (error) {
        logger.error({ err: error, requestId, webhookId }, 'Failed to delete webhook')
        
        if (error === apiErrors.NOT_FOUND) {
          throw error
        }
        
        throw apiErrors.INTERNAL_ERROR
      }
    },
    {
      windowMs: 60 * 1000,
      maxRequests: 50
    }
  )(request)
}

// Handle CORS preflight
export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-API-Version',
      'Access-Control-Max-Age': '86400',
    },
  })
}