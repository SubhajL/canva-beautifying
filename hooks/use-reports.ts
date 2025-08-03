import { useState, useCallback } from 'react'
import { EnhancementReport, ReportCustomization, ShareableReportLink } from '@/lib/reports/types'

export function useReports() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate a new report
  const generateReport = useCallback(async (
    documentId: string,
    customization?: ReportCustomization
  ): Promise<EnhancementReport | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, customization })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate report')
      }

      const { report } = await response.json()
      return report
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Get user's reports
  const getUserReports = useCallback(async (limit?: number): Promise<EnhancementReport[]> => {
    setLoading(true)
    setError(null)

    try {
      const url = limit ? `/api/reports?limit=${limit}` : '/api/reports'
      const response = await fetch(url)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch reports')
      }

      const { reports } = await response.json()
      return reports
    } catch (err: any) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Get specific report
  const getReport = useCallback(async (reportId: string): Promise<EnhancementReport | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/reports?reportId=${reportId}`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch report')
      }

      const { report } = await response.json()
      return report
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Export report as PDF
  const exportReportAsPDF = useCallback(async (reportId: string): Promise<string | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to export report')
      }

      const { pdfUrl } = await response.json()
      return pdfUrl
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Create shareable link
  const createShareableLink = useCallback(async (
    reportId: string,
    expiresInDays?: number,
    password?: string
  ): Promise<ShareableReportLink | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, expiresInDays, password })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create shareable link')
      }

      const { shareableLink } = await response.json()
      return shareableLink
    } catch (err: any) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    generateReport,
    getUserReports,
    getReport,
    exportReportAsPDF,
    createShareableLink
  }
}

// Hook for viewing shared reports
export function useSharedReport(shortCode: string) {
  const [report, setReport] = useState<EnhancementReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPassword, setRequiresPassword] = useState(false)

  const loadReport = useCallback(async (password?: string) => {
    setLoading(true)
    setError(null)

    try {
      const url = password 
        ? `/api/reports/share?code=${shortCode}&password=${encodeURIComponent(password)}`
        : `/api/reports/share?code=${shortCode}`
      
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        if (data.requiresPassword) {
          setRequiresPassword(true)
          throw new Error('Password required')
        }
        throw new Error(data.error || 'Failed to load report')
      }

      setReport(data.report)
      setRequiresPassword(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [shortCode])

  return {
    report,
    loading,
    error,
    requiresPassword,
    loadReport
  }
}