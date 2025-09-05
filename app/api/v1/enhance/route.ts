import { NextRequest } from 'next/server'
import { 
  authenticateRequest, 
  generateRequestId,
  validateFileUpload 
} from '@/lib/api/middleware'
import { withDualRateLimit } from '@/lib/api/middleware/dual-rate-limit'
import { withUsageLimit } from '@/lib/usage/middleware'
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
import { z } from 'zod'
import { 
  documentRoute, 
  requestBody, 
  response, 
  responses, 
  queryParams
} from '@/lib/api/openapi/decorators'
import { pipelineTracer } from '@/lib/observability/enhancement-pipeline'
import { createJobTraceContext } from '@/lib/observability/enhancement-pipeline'
import { linkSpans } from '@/lib/observability/tracing'

const enhanceHandler = asyncHandler(async (request: NextRequest, context?: APIRequestContext) => {
  const requestId = context?.requestId || generateRequestId()
    // Authenticate request
    const { userId } = await authenticateRequest(request)
    
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    // Validate file
    await validateFileUpload(file!)
    
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
    
    const validation = validateRequest(enhanceRequestSchema, settings)
    if (!validation.success) {
      throw ValidationError.create(
        'Invalid request data',
        formatValidationErrors(validation.error)
      )
    }
    
    const enhanceRequest = validation.data
    
    // Extract upload trace information if provided
    const uploadTraceId = formData.get('uploadTraceId') as string | null
    const uploadSpanId = formData.get('uploadSpanId') as string | null
    
    // Generate unique IDs
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const enhancementId = `enh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Start pipeline tracing
    const traceId = pipelineTracer.startPipeline(
      enhancementId,
      userId,
      file!.type,
      {
        documentId,
        fileName: file!.name,
        fileSize: file!.size,
        settings: enhanceRequest.enhancementSettings,
        requestId,
      }
    )
    
    // Link to upload trace if available
    if (uploadTraceId && uploadSpanId) {
      const pipelineSpan = (pipelineTracer as any).pipelineSpans.get(enhancementId)?.span
      if (pipelineSpan) {
        linkSpans(pipelineSpan, uploadTraceId, uploadSpanId, {
          link_type: 'upload_to_enhancement',
          file_name: file!.name
        })
      }
    }
    
    // Upload file to R2 with tracing
    const fileUrl = await pipelineTracer.trackStage(
      enhancementId,
      'upload' as any,
      async () => {
        const fileBuffer = Buffer.from(await file!.arrayBuffer())
        const fileExtension = file!.name.split('.').pop() || 'pdf'
        const fileName = `${documentId}.${fileExtension}`
        
        return await uploadFile({
          file: fileBuffer,
          userId,
          filename: fileName,
          folder: 'ORIGINAL',
          contentType: file!.type
        })
      },
      {
        fileSize: file!.size,
        fileType: file!.type,
      }
    )
    
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
      throw DatabaseError.create('create document', docError)
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
        metadata: enhanceRequest.metadata,
      })
      .select()
      .single()
    
    if (enhError) {
      throw DatabaseError.create('create enhancement', enhError)
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
    
    // Include trace context in job data
    const jobData = {
      documentId,
      enhancementId,
      userId,
      analysisResults: {
        colors: {},
        typography: {},
        layout: {},
        content: {},
        quality: {}
      },
      enhancementSettings: enhanceRequest.enhancementSettings || {},
      subscriptionTier: tier,
      // Add trace context for propagation
      ...createJobTraceContext(),
      traceId,
    }
    
    await enhancementQueue.add(
      'process-enhancement',
      jobData,
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
    
    // Add pipeline event for queue entry
    pipelineTracer.addPipelineEvent(
      enhancementId,
      'enhancement.queued',
      {
        queueName: QUEUE_NAMES.ENHANCEMENT,
        priority: enhanceRequest.priority || 'normal',
        queuePosition: await enhancementQueue.getWaitingCount(),
      }
    )
    
    // Return response
    return successResponse({
      id: enhancementId,
      documentId,
      status: 'pending',
      progress: 0,
      queuePosition: await enhancementQueue.getWaitingCount(),
      estimatedWaitTime: tier === 'free' ? 300 : tier === 'basic' ? 120 : 60, // seconds
      createdAt: new Date().toISOString(),
      traceId, // Include trace ID for monitoring
      links: {
        status: `/api/v1/enhance/${enhancementId}`,
        cancel: `/api/v1/enhance/${enhancementId}`,
      },
    }, { requestId })
})

// Document the POST endpoint
const postHandler = documentRoute(
  enhanceHandler,
  {
    method: 'POST',
    path: '/api/v1/enhance',
    summary: 'Create document enhancement',
    description: 'Upload a document for AI-powered enhancement. The document will be queued for processing and you can check the status using the returned enhancement ID.',
    tags: ['enhance'],
    security: [{ bearerAuth: [] }]
  },
  requestBody(
    z.object({
      file: z.instanceof(File).describe('Document file to enhance (PDF, PNG, JPG, WEBP, PPT, PPTX)'),
      settings: z.string().describe('JSON string containing enhancement settings')
    }),
    {
      description: 'Form data containing the file and enhancement settings',
      contentType: 'multipart/form-data'
    }
  ),
  responses(
    response(201, 'Enhancement request created successfully', {
      schema: z.object({
        id: z.string().describe('Unique enhancement ID'),
        documentId: z.string().describe('Document ID'),
        status: z.literal('pending').describe('Current status'),
        progress: z.number().describe('Progress percentage (0-100)'),
        queuePosition: z.number().describe('Position in processing queue'),
        estimatedWaitTime: z.number().describe('Estimated wait time in seconds'),
        createdAt: z.string().datetime().describe('Creation timestamp'),
        traceId: z.string().describe('Trace ID for distributed tracing'),
        links: z.object({
          status: z.string().describe('URL to check enhancement status'),
          cancel: z.string().describe('URL to cancel enhancement')
        })
      })
    }),
    response(400, 'Bad request - Invalid file or settings'),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(413, 'File too large - Maximum size is 50MB'),
    response(415, 'Unsupported media type'),
    response(429, 'Too many requests - Rate limit exceeded'),
    response(500, 'Internal server error')
  )
)

// Export with usage limit and dual rate limiting middleware
export const POST = withUsageLimit(
  withDualRateLimit(postHandler, {
    endpoint: 'enhance'
  }),
  1 // 1 credit per enhancement
)

const getHandler = asyncHandler(async (request: NextRequest) => {
  const requestId = generateRequestId()
    // This endpoint handles the history listing
    const { userId } = await authenticateRequest(request)
    
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '20'), 100)
    const status = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    const supabase = await createClient()
    
    // Build query
    let query = supabase
      .from('enhancements')
      .select('*, documents!inner(*)', { count: 'exact' })
      .eq('user_id', userId)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    // Add sorting
    query = query.order(sortBy === 'createdAt' ? 'created_at' : 
                       sortBy === 'updatedAt' ? 'updated_at' : 
                       'status', { ascending: sortOrder === 'asc' })
    
    // Add pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)
    
    const { data: enhancements, error, count } = await query
    
    if (error) {
      throw DatabaseError.create('fetch enhancements', error)
    }
    
    // Format response
    const formattedEnhancements = enhancements?.map(enhancement => ({
      id: enhancement.id,
      documentId: enhancement.document_id,
      documentName: enhancement.documents.name,
      status: enhancement.status,
      progress: enhancement.progress || 0,
      createdAt: enhancement.created_at,
      updatedAt: enhancement.updated_at,
      completedAt: enhancement.completed_at,
      enhancedUrl: enhancement.enhanced_url,
      thumbnailUrl: enhancement.thumbnail_url,
      improvements: enhancement.improvements,
      error: enhancement.error,
      links: {
        status: `/api/v1/enhance/${enhancement.id}`,
        cancel: enhancement.status === 'pending' || enhancement.status === 'processing' 
          ? `/api/v1/enhance/${enhancement.id}` : undefined,
      },
    }))
    
    return successResponse({
      items: formattedEnhancements || [],
      pagination: {
        page,
        pageSize,
        totalItems: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    }, { requestId })
})

// Document the GET endpoint
export const GET = documentRoute(
  getHandler,
  {
    method: 'GET',
    path: '/api/v1/enhance',
    summary: 'List enhancement history',
    description: 'Retrieve a paginated list of document enhancements for the authenticated user',
    tags: ['enhance'],
    security: [{ bearerAuth: [] }]
  },
  queryParams(
    z.object({
      page: z.coerce.number().int().positive().default(1).describe('Page number'),
      pageSize: z.coerce.number().int().min(1).max(100).default(20).describe('Items per page'),
      status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional().describe('Filter by status'),
      sortBy: z.enum(['createdAt', 'updatedAt', 'status']).default('createdAt').describe('Sort field'),
      sortOrder: z.enum(['asc', 'desc']).default('desc').describe('Sort order')
    }),
    'Query parameters for filtering and pagination'
  ),
  responses(
    response(200, 'Enhancement history retrieved successfully', {
      schema: z.object({
        items: z.array(z.object({
          id: z.string().describe('Enhancement ID'),
          documentId: z.string().describe('Document ID'),
          documentName: z.string().describe('Document name'),
          status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).describe('Enhancement status'),
          progress: z.number().describe('Progress percentage'),
          createdAt: z.string().datetime().describe('Creation timestamp'),
          updatedAt: z.string().datetime().describe('Last update timestamp'),
          completedAt: z.string().datetime().nullable().describe('Completion timestamp'),
          enhancedUrl: z.string().url().nullable().describe('Enhanced document URL'),
          thumbnailUrl: z.string().url().nullable().describe('Thumbnail URL'),
          improvements: z.any().nullable().describe('Applied improvements'),
          error: z.any().nullable().describe('Error details if failed'),
          links: z.object({
            status: z.string().describe('URL to check status'),
            cancel: z.string().optional().describe('URL to cancel (if applicable)')
          })
        })),
        pagination: z.object({
          page: z.number().describe('Current page'),
          pageSize: z.number().describe('Items per page'),
          totalItems: z.number().describe('Total number of items'),
          totalPages: z.number().describe('Total number of pages')
        })
      })
    }),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(500, 'Internal server error')
  )
)

// Handle CORS preflight
export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}