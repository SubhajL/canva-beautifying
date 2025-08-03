import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExportService } from '@/lib/export/export-service'
import { BatchExportOptions } from '@/lib/export/types'

const exportService = new ExportService()

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { documentIds, format, options = {} } = body

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid documentIds array' },
        { status: 400 }
      )
    }

    if (!format) {
      return NextResponse.json(
        { error: 'Missing required field: format' },
        { status: 400 }
      )
    }

    // Verify user owns all documents
    const { data: enhancements, error: docError } = await supabase
      .from('enhancements')
      .select('id, enhanced_url')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .in('id', documentIds)

    if (docError || !enhancements) {
      return NextResponse.json(
        { error: 'Error fetching documents' },
        { status: 500 }
      )
    }

    if (enhancements.length !== documentIds.length) {
      return NextResponse.json(
        { error: 'Some documents not found or not owned by user' },
        { status: 403 }
      )
    }

    // Check user's export limit (based on subscription tier)
    const { data: userProfile } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single()

    const tier = userProfile?.subscription_tier || 'free'
    const exportLimits: Record<string, number> = {
      free: 5,
      basic: 20,
      pro: 50,
      premium: -1 // Unlimited
    }

    const limit = exportLimits[tier] || 5
    if (limit !== -1 && documentIds.length > limit) {
      return NextResponse.json(
        { error: `Batch export limit exceeded. Your tier allows ${limit} documents per batch.` },
        { status: 400 }
      )
    }

    // Prepare batch export options
    const batchOptions: BatchExportOptions = {
      documentIds,
      format,
      quality: options.quality,
      scale: options.scale,
      preserveVectors: options.preserveVectors,
      includeMetadata: options.includeMetadata,
      backgroundColor: options.backgroundColor,
      zipFileName: options.zipFileName
    }

    // Start batch export (async - returns immediately)
    const batchId = `batch-${Date.now()}`
    
    // Start export in background
    exportService.exportBatch(user.id, batchOptions).then(async (zipUrl) => {
      // Send notification or update status in database
      await supabase.from('export_notifications').insert({
        user_id: user.id,
        type: 'batch_completed',
        message: `Batch export completed: ${documentIds.length} documents`,
        data: { batchId, zipUrl, documentCount: documentIds.length }
      })
    }).catch(async (error) => {
      // Handle error
      await supabase.from('export_notifications').insert({
        user_id: user.id,
        type: 'batch_failed',
        message: `Batch export failed: ${error.message}`,
        data: { batchId, error: error.message }
      })
    })

    return NextResponse.json({
      success: true,
      batchId,
      message: `Batch export started for ${documentIds.length} documents`,
      estimatedTime: documentIds.length * 5000 // 5 seconds per document estimate
    })
  } catch (error) {
    console.error('Batch export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}