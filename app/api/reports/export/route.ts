import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ReportService } from '@/lib/reports/report-service'

const reportService = new ReportService()

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
    const { reportId } = body

    if (!reportId) {
      return NextResponse.json(
        { error: 'Missing reportId' },
        { status: 400 }
      )
    }

    // Export report as PDF
    const pdfUrl = await reportService.exportReportAsPDF(reportId, user.id)

    return NextResponse.json({
      success: true,
      pdfUrl
    })
  } catch (error) {
    console.error('Report export error:', error)
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    )
  }
}