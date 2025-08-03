import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExportService } from '@/lib/export/export-service'

const exportService = new ExportService()

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
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get export history
    const history = await exportService.getUserExportHistory(user.id, limit)

    return NextResponse.json({
      exports: history,
      limit,
      offset,
      total: history.length
    })
  } catch (error) {
    console.error('Export history error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Track download
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

    const body = await request.json()
    const { exportId } = body

    if (!exportId) {
      return NextResponse.json(
        { error: 'Missing exportId' },
        { status: 400 }
      )
    }

    // Verify user owns this export
    const { data: exportRecord, error: exportError } = await supabase
      .from('export_history')
      .select('user_id')
      .eq('id', exportId)
      .single()

    if (exportError || !exportRecord || exportRecord.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Export not found' },
        { status: 404 }
      )
    }

    // Increment download count
    await exportService.incrementDownloadCount(exportId)

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Download tracking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}