'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useReports } from '@/hooks/use-reports'
import { ReportViewer } from '@/components/reports/report-viewer'
import { ShareReportDialog } from '@/components/reports/share-report-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { EnhancementReport } from '@/lib/reports/types'

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string
  const { getReport, exportReportAsPDF, loading, error } = useReports()
  const [report, setReport] = useState<EnhancementReport | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  useEffect(() => {
    loadReport()
  }, [reportId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReport = async () => {
    const fetchedReport = await getReport(reportId)
    if (fetchedReport) {
      setReport(fetchedReport)
    }
  }

  const handleExport = async () => {
    const pdfUrl = await exportReportAsPDF(reportId)
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-6 w-48 mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">Report not found</h2>
          <p className="text-gray-500 mb-4">{error || 'The requested report could not be loaded.'}</p>
          <Button onClick={() => router.push('/app/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/app/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <ReportViewer 
        report={report} 
        onExport={handleExport}
        onShare={() => setShareDialogOpen(true)}
      />

      <ShareReportDialog
        reportId={reportId}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </div>
  )
}