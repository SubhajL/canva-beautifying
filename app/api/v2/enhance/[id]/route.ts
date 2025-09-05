import { NextRequest } from 'next/server'
import { authorize } from '@/lib/api/auth'
import { withRedisRateLimit } from '@/lib/api/middleware/rate-limit'
import { successResponse, apiErrors } from '@/lib/api/response'
import { generateRequestId } from '@/lib/api/middleware'
import { createClient } from '@/lib/supabase/server'
import { getQueue, QUEUE_NAMES } from '@/lib/queue/client'
import { APIVersionManager } from '@/lib/api/versioning'
import { logger } from '@/lib/observability'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/v2/enhance/[id] - Get enhancement status
export const GET = withRedisRateLimit(
  async (request: NextRequest, { params }: RouteParams) => {
    const requestId = generateRequestId()
    const versionManager = APIVersionManager.getInstance()
    const version = versionManager.extractVersion(request)
    const { id: enhancementId } = params
    
    try {
      // Authenticate request
      const auth = await authorize(request, ['enhance:read'])
      const userId = auth.userId
      
      const supabase = await createClient()
      
      // Get enhancement with document details
      const { data: enhancement, error } = await supabase
        .from('enhancements')
        .select(`
          *,
          documents!inner(
            id,
            name,
            type,
            size,
            original_url,
            status
          )
        `)
        .eq('id', enhancementId)
        .eq('user_id', userId)
        .single()
      
      if (error || !enhancement) {
        throw apiErrors.NOT_FOUND
      }
      
      // Get real-time progress from queue if processing
      let queueProgress = enhancement.progress || 0
      let queuePosition = null
      
      if (enhancement.status === 'processing' || enhancement.status === 'pending') {
        const enhancementQueue = getQueue(QUEUE_NAMES.ENHANCEMENT)
        
        try {
          const job = await enhancementQueue.getJob(enhancement.job_id)
          if (job) {
            queueProgress = job.progress as number || 0
            if (enhancement.status === 'pending') {
              queuePosition = await job.getPosition()
            }
          }
        } catch (error) {
          logger.warn({ err: error, enhancementId }, 'Failed to get queue status')
        }
      }
      
      // Format response
      const response = {
        id: enhancement.id,
        documentId: enhancement.document_id,
        document: {
          name: enhancement.documents.name,
          type: enhancement.documents.type,
          size: enhancement.documents.size,
          originalUrl: enhancement.documents.original_url
        },
        status: enhancement.status,
        progress: Math.max(enhancement.progress || 0, queueProgress),
        queuePosition,
        settings: enhancement.settings,
        createdAt: enhancement.created_at,
        updatedAt: enhancement.updated_at,
        completedAt: enhancement.completed_at,
        enhancedUrl: enhancement.enhanced_url,
        thumbnailUrl: enhancement.thumbnail_url,
        improvements: enhancement.improvements,
        error: enhancement.error,
        processingTime: enhancement.completed_at 
          ? new Date(enhancement.completed_at).getTime() - new Date(enhancement.created_at).getTime()
          : null,
        links: {
          self: `/api/v2/enhance/${enhancement.id}`,
          document: `/api/v2/documents/${enhancement.document_id}`,
          cancel: enhancement.status === 'pending' || enhancement.status === 'processing'
            ? `/api/v2/enhance/${enhancement.id}`
            : undefined,
          download: enhancement.enhanced_url
            ? `/api/v2/export?enhancementId=${enhancement.id}`
            : undefined
        }
      }
      
      return successResponse(response, {
        requestId,
        version
      })
    } catch (error) {
      logger.error({ err: error, requestId, enhancementId }, 'Failed to get enhancement')
      
      if (error === apiErrors.NOT_FOUND) {
        throw error
      }
      
      throw apiErrors.INTERNAL_ERROR
    }
  },
  {
    windowMs: 60 * 1000,
    maxRequests: 200
  }
)

// DELETE /api/v2/enhance/[id] - Cancel enhancement
export const DELETE = withRedisRateLimit(
  async (request: NextRequest, { params }: RouteParams) => {
    const requestId = generateRequestId()
    const versionManager = APIVersionManager.getInstance()
    const version = versionManager.extractVersion(request)
    const { id: enhancementId } = params
    
    try {
      // Authenticate request
      const auth = await authorize(request, ['enhance:delete'])
      const userId = auth.userId
      
      const supabase = await createClient()
      
      // Get enhancement
      const { data: enhancement, error: fetchError } = await supabase
        .from('enhancements')
        .select('*')
        .eq('id', enhancementId)
        .eq('user_id', userId)
        .single()
      
      if (fetchError || !enhancement) {
        throw apiErrors.NOT_FOUND
      }
      
      // Check if enhancement can be cancelled
      if (enhancement.status !== 'pending' && enhancement.status !== 'processing') {
        throw apiErrors.VALIDATION_ERROR(
          'Enhancement cannot be cancelled',
          { status: enhancement.status }
        )
      }
      
      // Cancel job in queue
      if (enhancement.job_id) {
        const enhancementQueue = getQueue(QUEUE_NAMES.ENHANCEMENT)
        
        try {
          const job = await enhancementQueue.getJob(enhancement.job_id)
          if (job) {
            await job.remove()
          }
        } catch (error) {
          logger.warn({ err: error, jobId: enhancement.job_id }, 'Failed to remove job from queue')
        }
      }
      
      // Update enhancement status
      const { error: updateError } = await supabase
        .from('enhancements')
        .update({
          status: 'cancelled',
          error: {
            code: 'CANCELLED_BY_USER',
            message: 'Enhancement was cancelled by user',
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', enhancementId)
      
      if (updateError) {
        throw apiErrors.INTERNAL_ERROR
      }
      
      logger.info({ enhancementId, userId }, 'Enhancement cancelled')
      
      return successResponse({
        id: enhancementId,
        status: 'cancelled',
        message: 'Enhancement has been cancelled successfully'
      }, {
        requestId,
        version
      })
    } catch (error) {
      logger.error({ err: error, requestId, enhancementId }, 'Failed to cancel enhancement')
      
      if (error === apiErrors.NOT_FOUND || error === apiErrors.VALIDATION_ERROR) {
        throw error
      }
      
      throw apiErrors.INTERNAL_ERROR
    }
  },
  {
    windowMs: 60 * 1000,
    maxRequests: 50
  }
)

// Handle CORS preflight
export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-API-Version',
      'Access-Control-Max-Age': '86400',
    },
  })
}