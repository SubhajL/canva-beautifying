import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/auth/middleware'
import { withRateLimit } from '@/lib/api/middleware/rate-limit'
import { withValidation } from '@/lib/api/middleware/validation'
import { createAPIResponse, apiErrors } from '@/lib/api/response'
import { webhookManager } from '@/lib/api/webhooks/manager'
import { z } from 'zod'
import { WebhookEventType } from '@/lib/api/types'
import { 
  documentRoute, 
  requestBody,
  response, 
  responses 
} from '@/lib/api/openapi/decorators'

// Validation schemas
const updateWebhookSchema = z.object({
  url: z.string().url().refine(url => {
    const parsed = new URL(url)
    return process.env.NODE_ENV === 'development' || parsed.protocol === 'https:'
  }, 'Webhook URLs must use HTTPS in production').optional(),
  events: z.array(z.enum([
    'enhancement.started',
    'enhancement.progress',
    'enhancement.completed',
    'enhancement.failed',
    'document.uploaded',
    'document.analyzed',
    'export.completed'
  ] as const)).min(1).optional(),
  is_active: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
  retryPolicy: z.object({
    max_attempts: z.number().int().min(1).max(10).optional(),
    initial_delay_ms: z.number().int().min(100).max(60000).optional(),
    backoff_multiplier: z.number().min(1).max(5).optional(),
    max_delay_ms: z.number().int().min(1000).max(300000).optional()
  }).optional()
})

interface RouteParams {
  params: { id: string }
}

// GET handler implementation
const getHandler = withAuth(
  withRateLimit({ maxRequests: 100 })(
    async (request: NextRequest, context, { params }: RouteParams) => {
      try {
        const webhook = await webhookManager.getWebhook(
          context.user!.id,
          params.id
        )
        
        return createAPIResponse({
          data: webhook
        })
      } catch (error) {
        if (error === apiErrors.NOT_FOUND) {
          throw error
        }
        console.error('Failed to get webhook:', error)
        throw apiErrors.INTERNAL_ERROR
      }
    }
  )
)

// GET /api/v1/webhooks/[id] - Get specific webhook
export const GET = documentRoute(
  getHandler,
  {
    method: 'GET',
    path: '/api/v1/webhooks/{id}',
    summary: 'Get webhook details',
    description: 'Retrieve details of a specific webhook by ID.',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Webhook ID',
        schema: { type: 'string' }
      }
    ]
  },
  undefined,
  responses(
    response(200, 'Webhook details retrieved successfully', {
      schema: z.object({
        success: z.boolean(),
        data: z.object({
          id: z.string().describe('Webhook ID'),
          url: z.string().url().describe('Webhook endpoint URL'),
          events: z.array(z.string()).describe('Events this webhook is subscribed to'),
          headers: z.record(z.string()).optional().describe('Custom headers'),
          is_active: z.boolean().describe('Whether the webhook is active'),
          created_at: z.string().datetime().describe('Creation timestamp'),
          updated_at: z.string().datetime().describe('Last update timestamp'),
          last_triggered_at: z.string().datetime().nullable().describe('Last trigger timestamp'),
          retry_policy: z.object({
            max_attempts: z.number().optional(),
            initial_delay_ms: z.number().optional(),
            backoff_multiplier: z.number().optional(),
            max_delay_ms: z.number().optional()
          }).optional().describe('Retry configuration')
        })
      })
    }),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(404, 'Webhook not found'),
    response(500, 'Internal server error')
  )
)

// PUT handler implementation
const putHandler = withAuth(
  withRateLimit({ maxRequests: 50 })(
    withValidation({
      schema: updateWebhookSchema,
      source: 'body'
    })(async (request: NextRequest, context, { params }: RouteParams) => {
      try {
        const body = await request.json()
        const validated = updateWebhookSchema.parse(body)
        
        const webhook = await webhookManager.updateWebhook(
          context.user!.id,
          params.id,
          {
            url: validated.url,
            events: validated.events as WebhookEventType[],
            is_active: validated.is_active,
            headers: validated.headers,
            retry_policy: validated.retryPolicy
          }
        )
        
        return createAPIResponse({
          data: webhook
        })
      } catch (error) {
        if (error === apiErrors.NOT_FOUND) {
          throw error
        }
        if (error instanceof Error && error.message.includes('Invalid webhook URL')) {
          throw apiErrors.VALIDATION_ERROR(error.message)
        }
        console.error('Failed to update webhook:', error)
        throw apiErrors.INTERNAL_ERROR
      }
    })
  )
)

// PUT /api/v1/webhooks/[id] - Update webhook
export const PUT = documentRoute(
  putHandler,
  {
    method: 'PUT',
    path: '/api/v1/webhooks/{id}',
    summary: 'Update webhook',
    description: 'Update an existing webhook configuration. Any fields not provided will remain unchanged.',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Webhook ID',
        schema: { type: 'string' }
      }
    ]
  },
  requestBody(
    updateWebhookSchema,
    {
      description: 'Updated webhook configuration',
      contentType: 'application/json'
    }
  ),
  responses(
    response(200, 'Webhook updated successfully', {
      schema: z.object({
        success: z.boolean(),
        data: z.object({
          id: z.string().describe('Webhook ID'),
          url: z.string().url().describe('Webhook endpoint URL'),
          events: z.array(z.string()).describe('Events this webhook is subscribed to'),
          headers: z.record(z.string()).optional().describe('Custom headers'),
          is_active: z.boolean().describe('Whether the webhook is active'),
          created_at: z.string().datetime().describe('Creation timestamp'),
          updated_at: z.string().datetime().describe('Last update timestamp'),
          last_triggered_at: z.string().datetime().nullable().describe('Last trigger timestamp'),
          retry_policy: z.object({
            max_attempts: z.number().optional(),
            initial_delay_ms: z.number().optional(),
            backoff_multiplier: z.number().optional(),
            max_delay_ms: z.number().optional()
          }).optional().describe('Retry configuration')
        })
      })
    }),
    response(400, 'Bad request - Invalid webhook configuration'),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(404, 'Webhook not found'),
    response(500, 'Internal server error')
  )
)

// DELETE handler implementation
const deleteHandler = withAuth(
  withRateLimit({ maxRequests: 50 })(
    async (request: NextRequest, context, { params }: RouteParams) => {
      try {
        await webhookManager.deleteWebhook(
          context.user!.id,
          params.id
        )
        
        return createAPIResponse({
          data: { message: 'Webhook deleted successfully' },
          statusCode: 200
        })
      } catch (error) {
        if (error === apiErrors.NOT_FOUND) {
          throw error
        }
        console.error('Failed to delete webhook:', error)
        throw apiErrors.INTERNAL_ERROR
      }
    }
  )
)

// DELETE /api/v1/webhooks/[id] - Delete webhook
export const DELETE = documentRoute(
  deleteHandler,
  {
    method: 'DELETE',
    path: '/api/v1/webhooks/{id}',
    summary: 'Delete webhook',
    description: 'Delete an existing webhook. This action cannot be undone.',
    tags: ['webhooks'],
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Webhook ID',
        schema: { type: 'string' }
      }
    ]
  },
  undefined,
  responses(
    response(200, 'Webhook deleted successfully', {
      schema: z.object({
        success: z.boolean(),
        data: z.object({
          message: z.string().describe('Confirmation message')
        })
      })
    }),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(404, 'Webhook not found'),
    response(500, 'Internal server error')
  )
)