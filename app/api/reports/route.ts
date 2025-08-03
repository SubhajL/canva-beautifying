import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ReportService } from '@/lib/reports/report-service'
import { ReportGenerationOptions } from '@/lib/reports/types'

const reportService = new ReportService()

// Generate report
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
    const { documentId, customization } = body

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      )
    }

    // Get enhancement data
    const { data: enhancement, error: enhancementError } = await supabase
      .from('enhancements')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single()

    if (enhancementError || !enhancement) {
      return NextResponse.json(
        { error: 'Enhancement not found' },
        { status: 404 }
      )
    }

    if (enhancement.status !== 'completed') {
      return NextResponse.json(
        { error: 'Enhancement not completed' },
        { status: 400 }
      )
    }

    // Prepare report generation options
    const options: ReportGenerationOptions = {
      documentId,
      userId: user.id,
      analysisData: {
        before: enhancement.analysis_data,
        after: enhancement.enhanced_analysis_data || enhancement.analysis_data // Fallback if not stored
      },
      enhancementData: {
        strategies: enhancement.enhancement_data?.strategies || [],
        appliedStrategies: enhancement.enhancement_data?.appliedStrategies || []
      },
      customization
    }

    // Generate report
    const report = await reportService.generateReport(options)

    return NextResponse.json({
      success: true,
      report
    })
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

// Get user reports
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
    const reportId = searchParams.get('reportId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (reportId) {
      // Get specific report
      const { data: report } = await supabase
        .from('enhancement_reports')
        .select('*')
        .eq('id', reportId)
        .eq('user_id', user.id)
        .single()

      if (!report) {
        return NextResponse.json(
          { error: 'Report not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        report: report.report_data
      })
    } else {
      // Get all user reports
      const reports = await reportService.getUserReports(user.id, limit)

      return NextResponse.json({
        reports
      })
    }
  } catch (error) {
    console.error('Get reports error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    )
  }
}