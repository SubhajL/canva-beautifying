import { NextRequest } from 'next/server'
import { 
  authenticateRequest, 
  checkUserRateLimit, 
  generateRequestId,
  validateFileUpload 
} from '@/lib/api/middleware'
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

export const POST = asyncHandler(async (request: NextRequest) => {
  const requestId = generateRequestId()
    // Authenticate request
    const { userId } = await authenticateRequest(request)
    
    // Check rate limits
    await checkUserRateLimit(userId, 'enhance')
    
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
    
    const validation = validateRequest(enhanceRequestSchema, settings)
    if (!validation.success) {
      throw ValidationError.create(
        'Invalid request data',
        formatValidationErrors(validation.error)
      )
    }
    
    const enhanceRequest = validation.data
    
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
    
    await enhancementQueue.add(
      'process-enhancement',
      {
        documentId,
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
    
    // Return response
    return successResponse({
      id: enhancementId,
      documentId,
      status: 'pending',
      progress: 0,
      queuePosition: await enhancementQueue.getWaitingCount(),
      estimatedWaitTime: tier === 'free' ? 300 : tier === 'basic' ? 120 : 60, // seconds
      createdAt: new Date().toISOString(),
      links: {
        status: `/api/v1/enhance/${enhancementId}`,
        cancel: `/api/v1/enhance/${enhancementId}`,
      },
    }, { requestId })
})

export const GET = asyncHandler(async (request: NextRequest) => {
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