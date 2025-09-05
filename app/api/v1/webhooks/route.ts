import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/middleware/auth'
import { withRateLimit } from '@/lib/api/middleware/rate-limit'
import { withValidation } from '@/lib/api/middleware/validation'
import { createAPIResponse, apiErrors } from '@/lib/api/response'
import { webhookManager } from '@/lib/api/webhooks/manager'
import { z } from 'zod'
import { WebhookEventType } from '@/lib/api/types'
import { 
  documentRoute, 
  queryParams, 
  requestBody, 
  response, 
  responses 
} from '@/lib/api/openapi/decorators'

// Validation schemas
const createWebhookSchema = z.object({
  url: z.string().url().refine(url => {
    const parsed = new URL(url)
    return process.env.NODE_ENV === 'development' || parsed.protocol === 'https:'
  }, 'Webhook URLs must use HTTPS in production'),
  events: z.array(z.enum([
    'enhancement.started',
    'enhancement.progress',
    'enhancement.completed',
    'enhancement.failed',
    'document.uploaded',
    'document.analyzed',
    'export.completed'
  ] as const)).min(1),
  headers: z.record(z.string()).optional(),
  retryPolicy: z.object({
    max_attempts: z.number().int().min(1).max(10).optional(),
    initial_delay_ms: z.number().int().min(100).max(60000).optional(),
    backoff_multiplier: z.number().min(1).max(5).optional(),
    max_delay_ms: z.number().int().min(1000).max(300000).optional()
  }).optional()
})

const webhookQuerySchema = z.object({
  is_active: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  events: z.string().transform(val => val.split(',') as WebhookEventType[]).optional()
})

// GET handler implementation
const getHandler = withAuth(
  withRateLimit({ maxRequests: 100 })(
    withValidation({
      schema: webhookQuerySchema,
      source: 'query'
    })(async (request: NextRequest, context) => {
      try {
        const { searchParams } = new URL(request.url)
        const query = Object.fromEntries(searchParams.entries())
        const validated = webhookQuerySchema.parse(query)
        
        const webhooks = await webhookManager.listWebhooks(
          context.user!.id,
          {
            isActive: validated.is_active,
            events: validated.events
          }
        )
        
        return createAPIResponse({
          data: {
            webhooks,
            total: webhooks.length
          }
        })
      } catch (error) {
        console.error('Failed to list webhooks:', error)
        throw apiErrors.INTERNAL_ERROR
      }
    })
  )
)

// GET /api/v1/webhooks - List user webhooks
export const GET = documentRoute(
  getHandler,
  {
    method: 'GET',
    path: '/api/v1/webhooks',
    summary: 'List user webhooks',
    description: 'Retrieve all webhooks configured for the authenticated user. Supports filtering by active status and event types.',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }]
  },
  queryParams(
    webhookQuerySchema,
    'Query parameters for filtering webhooks'
  ),
  responses(
    response(200, 'Successfully retrieved webhooks', {
      schema: z.object({
        success: z.boolean(),
        data: z.object({
          webhooks: z.array(z.object({
            id: z.string().describe('Unique webhook ID'),
            url: z.string().url().describe('Webhook endpoint URL'),
            events: z.array(z.string()).describe('Events this webhook is subscribed to'),
            headers: z.record(z.string()).optional().describe('Custom headers to send with webhook'),
            is_active: z.boolean().describe('Whether the webhook is currently active'),
            created_at: z.string().datetime().describe('Creation timestamp'),
            updated_at: z.string().datetime().describe('Last update timestamp'),
            last_triggered_at: z.string().datetime().nullable().describe('Last successful trigger timestamp'),
            retry_policy: z.object({
              max_attempts: z.number().optional(),
              initial_delay_ms: z.number().optional(),
              backoff_multiplier: z.number().optional(),
              max_delay_ms: z.number().optional()
            }).optional().describe('Retry configuration')
          })),
          total: z.number().describe('Total number of webhooks')
        })
      })
    }),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(429, 'Too many requests - Rate limit exceeded'),
    response(500, 'Internal server error')
  )
)

// POST handler implementation
const postHandler = withAuth(
  withRateLimit({ maxRequests: 10 })(
    withValidation({
      schema: createWebhookSchema,
      source: 'body'
    })(async (request: NextRequest, context) => {
      try {
        const body = await request.json()
        const validated = createWebhookSchema.parse(body)
        
        const webhook = await webhookManager.createWebhook(
          context.user!.id,
          {
            url: validated.url,
            events: validated.events as WebhookEventType[],
            headers: validated.headers,
            retryPolicy: validated.retryPolicy
          }
        )
        
        return createAPIResponse({
          data: webhook,
          statusCode: 201
        })
      } catch (error) {
        if (error instanceof Error && error.message.includes('Invalid webhook URL')) {
          throw apiErrors.VALIDATION_ERROR(error.message)
        }
        console.error('Failed to create webhook:', error)
        throw apiErrors.INTERNAL_ERROR
      }
    })
  )
)

// POST /api/v1/webhooks - Create webhook
export const POST = documentRoute(
  postHandler,
  {
    method: 'POST',
    path: '/api/v1/webhooks',
    summary: 'Create a webhook',
    description: 'Create a new webhook to receive notifications for specified events. Webhook URLs must use HTTPS in production.',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }]
  },
  requestBody(
    createWebhookSchema,
    {
      description: 'Webhook configuration',
      contentType: 'application/json'
    }
  ),
  responses(
    response(201, 'Webhook created successfully', {
      schema: z.object({
        success: z.boolean(),
        data: z.object({
          id: z.string().describe('Unique webhook ID'),
          url: z.string().url().describe('Webhook endpoint URL'),
          events: z.array(z.string()).describe('Events this webhook is subscribed to'),
          headers: z.record(z.string()).optional().describe('Custom headers to send with webhook'),
          is_active: z.boolean().describe('Whether the webhook is active'),
          created_at: z.string().datetime().describe('Creation timestamp'),
          updated_at: z.string().datetime().describe('Last update timestamp'),
          retry_policy: z.object({
            max_attempts: z.number().optional(),
            initial_delay_ms: z.number().optional(),
            backoff_multiplier: z.number().optional(),
            max_delay_ms: z.number().optional()
          }).optional().describe('Retry configuration')
        })
      })
    }),
    response(400, 'Bad request - Invalid webhook URL or configuration'),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(429, 'Too many requests - Rate limit exceeded'),
    response(500, 'Internal server error')
  )
)