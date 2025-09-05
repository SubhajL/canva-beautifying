import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/auth/middleware'
import { withRateLimit } from '@/lib/api/middleware/rate-limit'
import { createAPIResponse, apiErrors } from '@/lib/api/response'
import { webhookManager } from '@/lib/api/webhooks/manager'

interface RouteParams {
  params: { id: string }
}

// POST /api/v1/webhooks/[id]/rotate-secret - Rotate webhook secret
export const POST = withAuth(
  withRateLimit({ maxRequests: 10 })(
    async (request: NextRequest, context, { params }: RouteParams) => {
      try {
        const result = await webhookManager.rotateWebhookSecret(
          context.user!.id,
          params.id
        )
        
        return createAPIResponse({
          data: {
            message: 'Webhook secret rotated successfully',
            secret: result.secret
          }
        })
      } catch (error) {
        if (error === apiErrors.NOT_FOUND) {
          throw error
        }
        console.error('Failed to rotate webhook secret:', error)
        throw apiErrors.INTERNAL_ERROR
      }
    }
  )
)