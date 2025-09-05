import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnhancementService } from '@/lib/enhancement'
import { checkUsageLimit, trackUsageAfterSuccess } from '@/lib/usage/middleware'
import { createErrorResponse, ErrorFactory, createValidationError } from '@/lib/utils/create-safe-error'
import { withDualRateLimit } from '@/lib/api/middleware/dual-rate-limit'
import { APIRequestContext } from '@/lib/api/types'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for enhancement processing

async function enhanceHandler(request: NextRequest, context?: APIRequestContext) {
  const requestId = context?.requestId || request.headers.get('x-request-id') || undefined

  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      const error = ErrorFactory.authRequired()
      const { status, body } = createErrorResponse(error, requestId)
      return NextResponse.json(body, { status })
    }

    // Check usage limits
    const limitCheck = await checkUsageLimit(request, 1)
    if (limitCheck && !limitCheck.success) {
      return NextResponse.json(limitCheck, { status: 402 })
    }

    const body = await request.json()
    const { documentId, preferences } = body

    if (!documentId) {
      const error = createValidationError('documentId', 'Document ID is required')
      const { status, body: errorBody } = createErrorResponse(error, requestId)
      return NextResponse.json(errorBody, { status })
    }

    // Initialize enhancement service
    const enhancementService = new EnhancementService()
    
    // Start enhancement process
    const result = await enhancementService.enhanceDocument(
      documentId,
      user.id,
      preferences
    )

    // Track usage on success
    if (result.success && result.documentId) {
      await trackUsageAfterSuccess(user.id, 'enhancement', result.documentId, 1)
    }

    return NextResponse.json(result)
  } catch (error) {
    const { status, body, headers } = createErrorResponse(error, requestId)
    
    return NextResponse.json(body, { 
      status,
      headers: headers ? new Headers(headers) : undefined
    })
  }
}

// Export with dual rate limiting middleware
export const POST = withDualRateLimit(enhanceHandler, {
  endpoint: 'enhance'
})

async function getEnhancementStatusHandler(request: NextRequest, context?: APIRequestContext) {
  const requestId = context?.requestId || request.headers.get('x-request-id') || undefined

  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      const error = ErrorFactory.authRequired()
      const { status, body } = createErrorResponse(error, requestId)
      return NextResponse.json(body, { status })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      // Return list of user's enhancements
      const enhancementService = new EnhancementService()
      const enhancements = await enhancementService.listUserEnhancements(user.id)
      
      return NextResponse.json({ enhancements })
    }

    // Get specific enhancement status
    const enhancementService = new EnhancementService()
    const status = await enhancementService.getEnhancementStatus(documentId, user.id)
    
    return NextResponse.json(status)
  } catch (error) {
    const { status, body, headers } = createErrorResponse(error, requestId)
    
    return NextResponse.json(body, { 
      status,
      headers: headers ? new Headers(headers) : undefined
    })
  }
}
// Export with dual rate limiting middleware
export const GET = withDualRateLimit(getEnhancementStatusHandler, {
  endpoint: 'enhance'
})
