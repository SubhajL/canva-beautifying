import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExportService } from '@/lib/export/export-service'
import { ExportOptions } from '@/lib/export/types'

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
    const { documentId, format, options = {} } = body

    if (!documentId || !format) {
      return NextResponse.json(
        { error: 'Missing required fields: documentId and format' },
        { status: 400 }
      )
    }

    // Get document details
    const { data: enhancement, error: docError } = await supabase
      .from('enhancements')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (docError || !enhancement) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (enhancement.status !== 'completed' || !enhancement.enhanced_url) {
      return NextResponse.json(
        { error: 'Document enhancement not completed' },
        { status: 400 }
      )
    }

    // Prepare export options
    const exportOptions: ExportOptions = {
      format,
      quality: options.quality,
      scale: options.scale,
      preserveVectors: options.preserveVectors,
      includeMetadata: options.includeMetadata,
      backgroundColor: options.backgroundColor
    }

    // Start export
    const result = await exportService.exportDocument({
      documentId,
      userId: user.id,
      options: exportOptions,
      enhancedUrl: enhancement.enhanced_url,
      originalUrl: enhancement.original_url,
      metadata: enhancement.enhancement_data
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        exportUrl: result.exportUrl,
        fileSize: result.fileSize,
        dimensions: result.dimensions,
        processingTime: result.processingTime
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'Export failed' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get export progress
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (documentId) {
      // Get progress for specific document
      const progress = exportService.getProgress(documentId)
      
      if (!progress) {
        return NextResponse.json(
          { error: 'No export in progress for this document' },
          { status: 404 }
        )
      }

      return NextResponse.json(progress)
    } else {
      // Get all export progress for user
      const allProgress = exportService.getAllProgress()
      
      // Filter by user (would need to store userId in progress)
      // For now, return all
      return NextResponse.json({
        exports: allProgress
      })
    }
  } catch (error) {
    console.error('Export progress error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}