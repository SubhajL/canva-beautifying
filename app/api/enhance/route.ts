import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EnhancementService } from '@/lib/enhancement'
import { checkUsageLimit, trackUsageAfterSuccess } from '@/lib/usage/middleware'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for enhancement processing

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check usage limits
    const limitCheck = await checkUsageLimit(request, 1)
    if (limitCheck && !limitCheck.success) {
      return NextResponse.json(limitCheck, { status: 402 })
    }

    const body = await request.json()
    const { documentId, preferences } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
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
    console.error('Enhancement API error:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Enhancement failed',
        success: false
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
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
    console.error('Enhancement status API error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    )
  }
}