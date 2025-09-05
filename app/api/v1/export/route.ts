import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExportService } from '@/lib/export/export-service'
import { z } from 'zod'
import { exportQueue } from '@/lib/queue/queues'
import { 
  documentRoute, 
  queryParams, 
  requestBody, 
  response, 
  responses 
} from '@/lib/api/openapi/decorators'

// Request validation schema
const exportRequestSchema = z.object({
  documentId: z.string().uuid(),
  format: z.enum(['png', 'jpg', 'pdf', 'canva']),
  options: z.object({
    quality: z.number().min(1).max(100).optional(),
    scale: z.number().min(0.1).max(4).optional(),
    preserveVectors: z.boolean().optional(),
    includeMetadata: z.boolean().optional(),
    backgroundColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional()
  }).optional(),
  async: z.boolean().optional(),
  webhookUrl: z.string().url().optional()
})

const batchExportRequestSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
  format: z.enum(['png', 'jpg', 'pdf', 'canva']),
  options: z.object({
    quality: z.number().min(1).max(100).optional(),
    scale: z.number().min(0.1).max(4).optional(),
    preserveVectors: z.boolean().optional(),
    includeMetadata: z.boolean().optional(),
    backgroundColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional()
  }).optional(),
  zipFileName: z.string().optional()
})

// Combined schema for single or batch export
const exportCombinedSchema = z.union([
  exportRequestSchema,
  batchExportRequestSchema
])

// POST handler implementation
const postHandler = async (request: NextRequest) => {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    
    // Check if it's a batch export
    if (Array.isArray(body.documentIds)) {
      return handleBatchExport(body, user.id)
    } else {
      return handleSingleExport(body, user.id)
    }
  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const POST = documentRoute(
  postHandler,
  {
    method: 'POST',
    path: '/api/v1/export',
    summary: 'Export enhanced document',
    description: 'Export an enhanced document in various formats (PNG, JPG, PDF, Canva). Supports both single document and batch exports. Exports can be processed synchronously or asynchronously.',
    tags: ['export'],
    security: [{ bearerAuth: [] }]
  },
  requestBody(
    exportCombinedSchema,
    {
      description: 'Export configuration for single document or batch export',
      contentType: 'application/json'
    }
  ),
  responses(
    response(200, 'Synchronous export completed successfully', {
      schema: z.object({
        success: z.boolean(),
        exportUrl: z.string().url().describe('Download URL for the exported file'),
        fileSize: z.number().describe('File size in bytes'),
        dimensions: z.object({
          width: z.number(),
          height: z.number()
        }).optional().describe('Dimensions for image exports'),
        processingTime: z.number().describe('Processing time in milliseconds')
      })
    }),
    response(201, 'Async export job queued successfully', {
      schema: z.union([
        z.object({
          success: z.boolean(),
          jobId: z.string().describe('Job ID for tracking export progress'),
          status: z.literal('queued'),
          message: z.string()
        }),
        z.object({
          success: z.boolean(),
          jobIds: z.array(z.string()).describe('Job IDs for batch export tracking'),
          batchSize: z.number().describe('Number of documents in batch'),
          status: z.literal('queued'),
          message: z.string()
        })
      ])
    }),
    response(400, 'Bad request - Invalid export configuration'),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(404, 'Document not found'),
    response(500, 'Internal server error')
  )
)

async function handleSingleExport(body: any, userId: string) {
  try {
    // Validate request
    const validatedData = exportRequestSchema.parse(body)
    
    // Check document ownership
    const supabase = await createClient()
    const { data: document } = await supabase
      .from('documents')
      .select('id, enhanced_url')
      .eq('id', validatedData.documentId)
      .eq('user_id', userId)
      .single()
    
    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Check if async export is requested
    if (validatedData.async) {
      // Queue the export job
      const job = await exportQueue.add('export-document', {
        documentId: validatedData.documentId,
        userId,
        enhancementId: document.id,
        exportFormat: validatedData.format as 'png' | 'pdf' | 'canva' | 'pptx',
        exportSettings: {
          quality: validatedData.options?.quality === 100 ? 'high' : validatedData.options?.quality === 50 ? 'standard' : 'standard',
          includeReport: false,
          watermark: false
        },
        subscriptionTier: 'basic',
        priority: 2
      }, {
        priority: 2,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      })

      return NextResponse.json({
        success: true,
        jobId: job.id,
        status: 'queued',
        message: 'Export job queued successfully'
      })
    }

    // Synchronous export
    const exportService = new ExportService()
    const result = await exportService.exportDocument({
      documentId: validatedData.documentId,
      userId,
      options: {
        format: validatedData.format,
        ...validatedData.options
      },
      enhancedUrl: document.enhanced_url
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      exportUrl: result.exportUrl,
      fileSize: result.fileSize,
      dimensions: result.dimensions,
      processingTime: result.processingTime
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    throw error
  }
}

async function handleBatchExport(body: any, userId: string) {
  try {
    // Validate request
    const validatedData = batchExportRequestSchema.parse(body)
    
    // Check document ownership for all documents
    const supabase = await createClient()
    const { data: documents } = await supabase
      .from('documents')
      .select('id')
      .in('id', validatedData.documentIds)
      .eq('user_id', userId)
    
    if (!documents || documents.length !== validatedData.documentIds.length) {
      return NextResponse.json(
        { error: 'One or more documents not found' },
        { status: 404 }
      )
    }

    // Queue batch export job
    // Note: Batch export would need a separate job type or use multiple export jobs
    // For now, we'll create individual export jobs for each document
    const jobs = await Promise.all(
      validatedData.documentIds.map((docId, _index) => 
        exportQueue.add(`export-${docId}`, {
          documentId: docId,
          userId,
          enhancementId: docId, // Assuming documentId is the enhancement ID
          exportFormat: validatedData.format as 'png' | 'pdf' | 'canva' | 'pptx',
          exportSettings: {
            quality: 'standard',
            includeReport: false,
            watermark: false
          },
          subscriptionTier: 'basic',
          priority: 1
        }, {
          priority: 1,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      jobIds: jobs.map(j => j.id),
      batchSize: jobs.length,
      status: 'queued',
      message: `Batch export job queued for ${validatedData.documentIds.length} documents`
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      )
    }
    throw error
  }
}

// Query schema for GET endpoint
const exportQuerySchema = z.object({
  jobId: z.string().optional().describe('Job ID to check export status'),
  documentId: z.string().uuid().optional().describe('Document ID to check export progress')
})

// GET handler implementation
const getHandler = async (request: NextRequest) => {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const documentId = searchParams.get('documentId')

    const exportService = new ExportService()

    if (jobId) {
      // Get job status from queue
      const job = await exportQueue.getJob(jobId)
      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }

      // Verify job belongs to user
      const jobData = job.data as any
      if (jobData.userId !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      return NextResponse.json({
        jobId: job.id,
        status: await job.getState(),
        progress: job.progress,
        data: job.returnvalue,
        error: job.failedReason
      })
    } else if (documentId) {
      // Get export progress for document
      const progress = exportService.getProgress(documentId)
      if (!progress) {
        return NextResponse.json(
          { error: 'No export in progress for this document' },
          { status: 404 }
        )
      }

      return NextResponse.json(progress)
    } else {
      // Get user's export history
      const history = await exportService.getUserExportHistory(user.id, 50)
      return NextResponse.json({
        exports: history,
        count: history.length
      })
    }
  } catch (error) {
    console.error('Export progress API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check export progress
export const GET = documentRoute(
  getHandler,
  {
    method: 'GET',
    path: '/api/v1/export',
    summary: 'Check export status or get history',
    description: 'Check the status of an export job, get export progress for a document, or retrieve export history for the authenticated user.',
    tags: ['export'],
    security: [{ bearerAuth: [] }]
  },
  queryParams(
    exportQuerySchema,
    'Query parameters to specify what export information to retrieve'
  ),
  responses(
    response(200, 'Successfully retrieved export information', {
      schema: z.union([
        // Job status response
        z.object({
          jobId: z.string(),
          status: z.string().describe('Job status (waiting, active, completed, failed)'),
          progress: z.number().nullable().describe('Progress percentage'),
          data: z.any().nullable().describe('Job result data if completed'),
          error: z.string().nullable().describe('Error message if failed')
        }),
        // Document progress response
        z.object({
          documentId: z.string(),
          status: z.string(),
          progress: z.number(),
          message: z.string().optional()
        }),
        // Export history response
        z.object({
          exports: z.array(z.object({
            id: z.string(),
            documentId: z.string(),
            format: z.string(),
            status: z.string(),
            createdAt: z.string().datetime(),
            completedAt: z.string().datetime().nullable(),
            exportUrl: z.string().url().nullable(),
            fileSize: z.number().nullable(),
            error: z.string().nullable()
          })),
          count: z.number()
        })
      ])
    }),
    response(401, 'Unauthorized - Invalid or missing authentication'),
    response(404, 'Job or document not found'),
    response(500, 'Internal server error')
  )
)