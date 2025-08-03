'use client'

import { useEffect, useState } from 'react'
import { useReports } from '@/hooks/use-reports'
import { EnhancementReport } from '@/lib/reports/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Download, Share2, Eye, Calendar, BarChart3 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export function ReportHistory() {
  const { getUserReports, loading, error } = useReports()
  const [reports, setReports] = useState<EnhancementReport[]>([])

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    const fetchedReports = await getUserReports(20)
    setReports(fetchedReports)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-500">Error loading reports: {error}</p>
          <Button onClick={loadReports} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">No reports generated yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Reports will appear here after you enhance documents
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <Card key={report.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{report.documentInfo.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="w-3 h-3" />
                  {formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={report.engagement.predictedScore > 80 ? 'default' : 'secondary'}>
                  {report.engagement.predictedScore}% Engagement
                </Badge>
                <Badge variant="outline">
                  +{report.comparison.improvements.overallImprovement}% Improved
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                <p>{report.enhancements.totalCount} enhancements applied</p>
                <p className="mt-1">
                  Document type: {report.documentInfo.documentType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/app/reports/${report.id}`}>
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </Link>
                <ReportActions reportId={report.id} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ReportActions({ reportId }: { reportId: string }) {
  const { exportReportAsPDF, createShareableLink } = useReports()
  const [exporting, setExporting] = useState(false)
  const [sharing, setSharing] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    const pdfUrl = await exportReportAsPDF(reportId)
    if (pdfUrl) {
      window.open(pdfUrl, '_blank')
    }
    setExporting(false)
  }

  const handleShare = async () => {
    setSharing(true)
    const link = await createShareableLink(reportId)
    if (link) {
      await navigator.clipboard.writeText(link.url)
      // TODO: Show toast notification
    }
    setSharing(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleExport}
        disabled={exporting}
      >
        <Download className="w-4 h-4 mr-2" />
        Export
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        disabled={sharing}
      >
        <Share2 className="w-4 h-4 mr-2" />
        Share
      </Button>
    </>
  )
}