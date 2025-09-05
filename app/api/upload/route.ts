import { NextRequest, NextResponse } from "next/server"
import { uploadFile } from "@/lib/r2"
import { createClient } from "@/lib/supabase/server"
import { createErrorResponse, ErrorFactory, createFileError } from "@/lib/utils/create-safe-error"
import { createPipelineStageSpan, recordPipelineEvent } from "@/lib/observability/tracing"
import { SpanStatusCode } from "@opentelemetry/api"
import { pdfAnalyzer } from "@/lib/utils/pdf-analyzer"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"]

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || undefined
  
  // Create upload span
  const span = createPipelineStageSpan('upload', {
    'http.request_id': requestId,
    'http.method': 'POST',
    'http.target': '/api/upload'
  })

  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      const error = ErrorFactory.authRequired()
      const { status, body } = createErrorResponse(error, requestId)
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Authentication required' })
      span.end()
      return NextResponse.json(body, { status })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const userId = user.id
    
    // Set span attributes
    span.setAttributes({
      'user.id': userId,
      'file.name': file?.name || 'unknown',
      'file.size': file?.size || 0,
      'file.type': file?.type || 'unknown'
    })

    if (!file) {
      const error = createFileError('upload', 'No file provided')
      const { status, body } = createErrorResponse(error, requestId)
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'No file provided' })
      span.end()
      return NextResponse.json(body, { status })
    }

    if (file.size > MAX_FILE_SIZE) {
      const error = ErrorFactory.fileTooLarge(MAX_FILE_SIZE)
      const { status, body } = createErrorResponse(error, requestId)
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'File too large' })
      span.end()
      return NextResponse.json(body, { status })
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      const error = ErrorFactory.invalidFileType(ALLOWED_FILE_TYPES)
      const { status, body } = createErrorResponse(error, requestId)
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid file type' })
      span.end()
      return NextResponse.json(body, { status })
    }

    // Deep PDF validation
    if (file.type === 'application/pdf') {
      const validation = await pdfAnalyzer.performDeepValidation(file)
      
      if (!validation.valid) {
        // Provide detailed error message
        const errorMessage = validation.errors.length > 0 
          ? validation.errors.join('; ') 
          : 'PDF validation failed'
        
        const error = createFileError('validation', `Invalid PDF: ${errorMessage}`)
        const { status, body } = createErrorResponse(error, requestId)
        
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid PDF file' })
        span.setAttributes({
          'pdf.validation.errors': validation.errors.join(', '),
          'pdf.validation.warnings': validation.warnings.join(', '),
          'pdf.validation.canProcess': validation.canProcess
        })
        span.end()
        
        return NextResponse.json(body, { status })
      }
      
      // Log warnings if any (but still allow upload)
      if (validation.warnings.length > 0) {
        console.warn('PDF validation warnings:', validation.warnings)
        span.setAttributes({
          'pdf.validation.warnings': validation.warnings.join(', ')
        })
      }
    }

    // Record upload start event
    recordPipelineEvent('upload.started', {
      'file.name': file.name,
      'file.size': file.size,
      'file.type': file.type
    })

    const result = await uploadFile({
      file,
      userId,
      filename: file.name,
      folder: "ORIGINAL",
      contentType: file.type,
    })

    // Record successful upload
    recordPipelineEvent('upload.completed', {
      'upload.key': result.key,
      'upload.url': result.url
    })

    // Store upload information in database
    const { data: enhancement, error: dbError } = await supabase
      .from('enhancements')
      .insert({
        user_id: userId,
        original_url: result.url,
        status: 'uploaded',
        analysis_data: {
          filename: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      // Don't fail the upload, just log the error
    }

    // Store trace information for future linking
    const spanContext = span.spanContext()
    
    span.setStatus({ code: SpanStatusCode.OK })
    span.setAttributes({
      'upload.enhancement_id': enhancement?.id || '',
      'upload.duration_ms': Date.now() - (span as any).startTime || 0
    })
    span.end()

    return NextResponse.json({
      success: true,
      key: result.key,
      url: result.url,
      filename: file.name,
      size: file.size,
      type: file.type,
      enhancementId: enhancement?.id,
      traceId: spanContext.traceId,
      spanId: spanContext.spanId
    })
  } catch (error) {
    span.recordException(error as Error)
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: error instanceof Error ? error.message : 'Upload failed' 
    })
    span.end()
    
    const { status, body, headers } = createErrorResponse(error, requestId)
    
    return NextResponse.json(body, { 
      status,
      headers: headers ? new Headers(headers) : undefined
    })
  }
}