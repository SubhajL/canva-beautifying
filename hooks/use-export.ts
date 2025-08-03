'use client'

import { useState, useCallback } from 'react'
import { ExportFormat, ExportOptions, ExportProgress } from '@/lib/export/types'

interface UseExportOptions {
  onProgress?: (progress: ExportProgress) => void
  onComplete?: (exportUrl: string) => void
  onError?: (error: string) => void
}

export function useExport(options: UseExportOptions = {}) {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const exportDocument = useCallback(async (
    documentId: string,
    format: ExportFormat,
    exportOptions: Partial<ExportOptions> = {}
  ) => {
    setIsExporting(true)
    setError(null)
    setProgress({
      documentId,
      status: 'pending',
      progress: 0,
      format,
      startedAt: new Date()
    })

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          format,
          options: exportOptions
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Export failed')
      }

      // Update progress to completed
      const completedProgress: ExportProgress = {
        documentId,
        status: 'completed',
        progress: 100,
        format,
        startedAt: progress?.startedAt || new Date(),
        completedAt: new Date(),
        exportUrl: data.exportUrl
      }
      
      setProgress(completedProgress)
      options.onProgress?.(completedProgress)
      options.onComplete?.(data.exportUrl)

      return data.exportUrl
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed'
      setError(errorMessage)
      
      const failedProgress: ExportProgress = {
        documentId,
        status: 'failed',
        progress: 0,
        format,
        startedAt: progress?.startedAt || new Date(),
        error: errorMessage
      }
      
      setProgress(failedProgress)
      options.onProgress?.(failedProgress)
      options.onError?.(errorMessage)
      
      throw err
    } finally {
      setIsExporting(false)
    }
  }, [options])

  const exportBatch = useCallback(async (
    documentIds: string[],
    format: ExportFormat,
    exportOptions: Partial<ExportOptions> = {}
  ) => {
    setIsExporting(true)
    setError(null)

    try {
      const response = await fetch('/api/export/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentIds,
          format,
          options: exportOptions
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Batch export failed')
      }

      return data.batchId
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Batch export failed'
      setError(errorMessage)
      options.onError?.(errorMessage)
      throw err
    } finally {
      setIsExporting(false)
    }
  }, [options])

  const checkProgress = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/export?documentId=${documentId}`)
      const data = await response.json()

      if (response.ok && data) {
        setProgress(data)
        options.onProgress?.(data)
        return data
      }
    } catch (err) {
      console.error('Failed to check export progress:', err)
    }
    return null
  }, [options])

  const getExportHistory = useCallback(async (limit = 50) => {
    try {
      const response = await fetch(`/api/export/history?limit=${limit}`)
      const data = await response.json()

      if (response.ok) {
        return data.exports
      }
    } catch (err) {
      console.error('Failed to get export history:', err)
    }
    return []
  }, [])

  const trackDownload = useCallback(async (exportId: string) => {
    try {
      await fetch('/api/export/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ exportId })
      })
    } catch (err) {
      console.error('Failed to track download:', err)
    }
  }, [])

  return {
    exportDocument,
    exportBatch,
    checkProgress,
    getExportHistory,
    trackDownload,
    isExporting,
    progress,
    error
  }
}