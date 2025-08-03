import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ReportService } from '@/lib/reports/report-service'

const reportService = new ReportService()

// Create shareable link
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
    const { reportId, expiresInDays = 7, password } = body

    if (!reportId) {
      return NextResponse.json(
        { error: 'Missing reportId' },
        { status: 400 }
      )
    }

    // Create shareable link
    const shareableLink = await reportService.createShareableLink(
      reportId,
      user.id,
      expiresInDays,
      password
    )

    return NextResponse.json({
      success: true,
      shareableLink
    })
  } catch (error) {
    console.error('Create shareable link error:', error)
    return NextResponse.json(
      { error: 'Failed to create shareable link' },
      { status: 500 }
    )
  }
}

// Get shared report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shortCode = searchParams.get('code')
    const password = searchParams.get('password')

    if (!shortCode) {
      return NextResponse.json(
        { error: 'Missing share code' },
        { status: 400 }
      )
    }

    // Get report by share code
    const report = await reportService.getReportByShareCode(
      shortCode,
      password || undefined
    )

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found or expired' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      report
    })
  } catch (error: any) {
    console.error('Get shared report error:', error)
    
    if (error.message === 'Password required') {
      return NextResponse.json(
        { error: 'Password required', requiresPassword: true },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch shared report' },
      { status: 500 }
    )
  }
}