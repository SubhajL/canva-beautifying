import { NextRequest } from 'next/server'
import { 
  authenticateRequest, 
  generateRequestId 
} from '@/lib/api/middleware'
import { 
  successResponse, 
  errorResponse, 
  apiErrors,
  ApiError 
} from '@/lib/api/response'
import { createClient } from '@/lib/supabase/server'
import { getQueue, QUEUE_NAMES } from '@/lib/queue/client'
import { 
  documentRoute, 
  response, 
  responses 
} from '@/lib/api/openapi/decorators'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET handler implementation
const getHandler = async (
  request: NextRequest,
  { params }: RouteParams
) => {
  const requestId = generateRequestId()
  
  try {
    const { id } = await params
    
    // Authenticate request
    const { userId } = await authenticateRequest(request)
    
    const supabase = await createClient()
    
    // Fetch enhancement with document details
    const { data: enhancement, error } = await supabase
      .from('enhancements')
      .select(`
        *,
        documents (
          id,
          name,
          type,
          size,
          original_url
        )
      `)
      .eq('id', id)
      .single()
    
    if (error || !enhancement) {
      throw apiErrors.NOT_FOUND
    }
    
    // Verify ownership
    if (enhancement.user_id !== userId) {
      throw apiErrors.INSUFFICIENT_PERMISSIONS
    }
    
    // Get queue position if still processing
    let queuePosition = undefined
    let estimatedWaitTime = undefined
    
    if (enhancement.status === 'pending' || enhancement.status === 'processing') {
      // Check all relevant queues
      const queues = [
        QUEUE_NAMES.ENHANCEMENT,
        QUEUE_NAMES.EXPORT,
      ]
      
      for (const queueName of queues) {
        const queue = getQueue(queueName)
        const jobs = await queue.getJobs(['waiting', 'active'])
        
        const jobIndex = jobs.findIndex(job => 
          job.data.enhancementId === id || job.data.documentId === enhancement.document_id
        )
        
        if (jobIndex !== -1) {
          queuePosition = jobIndex + 1
          // Estimate based on average processing time
          estimatedWaitTime = queuePosition * 30 // 30 seconds per job average
          break
        }
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
        originalUrl: enhancement.documents.original_url,
      },
      status: enhancement.status,
      progress: enhancement.progress || 0,
      currentStage: enhancement.current_stage,
      queuePosition,
      estimatedWaitTime,
      createdAt: enhancement.created_at,
      updatedAt: enhancement.updated_at,
      completedAt: enhancement.completed_at,
      settings: enhancement.settings,
      result: enhancement.status === 'completed' ? {
        enhancedFileUrl: enhancement.enhanced_url,
        thumbnailUrl: enhancement.thumbnail_url,
        improvements: enhancement.improvements,
        enhancementsApplied: enhancement.enhancements_applied || [],
        processingTime: enhancement.processing_time,
        reportUrl: enhancement.report_url,
      } : undefined,
      error: enhancement.error,
      metadata: enhancement.metadata,
      links: {
        cancel: enhancement.status === 'pending' || enhancement.status === 'processing' 
          ? `/api/v1/enhance/${enhancement.id}` : undefined,
        download: enhancement.enhanced_url,
        report: enhancement.report_url,
      },
    }
    
    return successResponse(response, { requestId })
    
  } catch (error) {
    return errorResponse(error as Error, requestId)
  }
}

// Document the GET endpoint
export const GET = documentRoute(
  getHandler,
  {
    method: 'GET',
    path: '/api/v1/enhance/{id}',
    summary: 'Get enhancement status',
    description: 'Retrieve the current status and details of a document enhancement job. Includes queue position and estimated wait time for pending jobs.',
    tags: ['enhance'],
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Enhancement ID',
        schema: { type: 'string' }
      }
    ]
  },
  undefined,
  responses(
    response(200, 'Enhancement details retrieved successfully', {
      schema: z.object({
        success: z.boolean(),
        data: z.object({
          id: z.string().describe('Enhancement ID'),
          documentId: z.string().describe('Associated document ID'),
          document: z.object({
            name: z.string().describe('Document filename'),
            type: z.string().describe('MIME type'),
            size: z.number().describe('File size in bytes'),
            originalUrl: z.string().url().describe('Original document URL')
          }),
          status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).describe('Current status'),
          progress: z.number().min(0).max(100).describe('Progress percentage'),
          currentStage: z.string().optional().describe('Current processing stage'),
          queuePosition: z.number().optional().describe('Position in processing queue'),
          estimatedWaitTime: z.number().optional().describe('Estimated wait time in seconds'),
          createdAt: z.string().datetime().describe('Creation timestamp'),
          updatedAt: z.string().datetime().describe('Last update timestamp'),
          completedAt: z.string().datetime().nullable().describe('Completion timestamp'),
          settings: z.any().describe('Enhancement settings used'),
          result: z.object({
            enhancedFileUrl: z.string().url().describe('Enhanced document URL'),
            thumbnailUrl: z.string().url().nullable().describe('Thumbnail URL'),
            improvements: z.any().describe('Applied improvements'),
            enhancementsApplied: z.array(z.string()).describe('List of enhancements applied'),
            processingTime: z.number().nullable().describe('Processing time in milliseconds'),
            reportUrl: z.string().url().nullable().describe('Enhancement report URL')
          }).optional().describe('Result data (only when completed)'),
          error: z.any().nullable().describe('Error details if failed'),
          metadata: z.any().nullable().describe('Additional metadata'),
          links: z.object({
            cancel: z.string().optional().describe('URL to cancel enhancement'),
            download: z.string().url().nullable().describe('Direct download URL'),
            report: z.string().url().nullable().describe('Report URL')
          })
        })
      })
    }),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(403, 'Forbidden - Enhancement belongs to another user'),
    response(404, 'Enhancement not found'),
    response(500, 'Internal server error')
  )
)

// DELETE handler implementation
const deleteHandler = async (
  request: NextRequest,
  { params }: RouteParams
) => {
  const requestId = generateRequestId()
  
  try {
    const { id } = await params
    
    // Authenticate request
    const { userId } = await authenticateRequest(request)
    
    const supabase = await createClient()
    
    // Fetch enhancement
    const { data: enhancement, error: fetchError } = await supabase
      .from('enhancements')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !enhancement) {
      throw apiErrors.NOT_FOUND
    }
    
    // Verify ownership
    if (enhancement.user_id !== userId) {
      throw apiErrors.INSUFFICIENT_PERMISSIONS
    }
    
    // Check if can be cancelled
    if (enhancement.status !== 'pending' && enhancement.status !== 'processing') {
      throw new ApiError(
        'INVALID_STATUS',
        `Cannot cancel enhancement with status: ${enhancement.status}`,
        400
      )
    }
    
    // Try to remove from queues
    const queues = [
      QUEUE_NAMES.ENHANCEMENT,
      QUEUE_NAMES.EXPORT,
    ]
    
    let jobRemoved = false
    
    for (const queueName of queues) {
      const queue = getQueue(queueName)
      const jobs = await queue.getJobs(['waiting', 'active', 'delayed'])
      
      for (const job of jobs) {
        if (job.data.enhancementId === id || job.data.documentId === enhancement.document_id) {
          try {
            await job.remove()
            jobRemoved = true
            break
          } catch (error) {
            console.error(`Failed to remove job ${job.id} from queue ${queueName}:`, error)
          }
        }
      }
      
      if (jobRemoved) break
    }
    
    // Update enhancement status
    const { error: updateError } = await supabase
      .from('enhancements')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        error: {
          code: 'USER_CANCELLED',
          message: 'Enhancement cancelled by user',
        },
      })
      .eq('id', id)
    
    if (updateError) {
      throw new ApiError('DATABASE_ERROR', 'Failed to update enhancement status', 500)
    }
    
    // Update document status if needed
    await supabase
      .from('documents')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', enhancement.document_id)
      .eq('status', 'processing')
    
    return successResponse({
      id,
      status: 'cancelled',
      message: 'Enhancement cancelled successfully',
      jobRemoved,
    }, { requestId })
    
  } catch (error) {
    return errorResponse(error as Error, requestId)
  }
}

// Document the DELETE endpoint
export const DELETE = documentRoute(
  deleteHandler,
  {
    method: 'DELETE',
    path: '/api/v1/enhance/{id}',
    summary: 'Cancel enhancement',
    description: 'Cancel a pending or processing enhancement job. Only works for jobs that have not completed yet.',
    tags: ['enhance'],
    security: [{ bearerAuth: [] }],
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Enhancement ID',
        schema: { type: 'string' }
      }
    ]
  },
  undefined,
  responses(
    response(200, 'Enhancement cancelled successfully', {
      schema: z.object({
        success: z.boolean(),
        data: z.object({
          id: z.string().describe('Enhancement ID'),
          status: z.literal('cancelled').describe('New status'),
          message: z.string().describe('Cancellation confirmation message'),
          jobRemoved: z.boolean().describe('Whether the job was removed from queue')
        })
      })
    }),
    response(400, 'Bad request - Cannot cancel enhancement with current status'),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(403, 'Forbidden - Enhancement belongs to another user'),
    response(404, 'Enhancement not found'),
    response(500, 'Internal server error')
  )
)

// Handle CORS preflight
export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}