'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWebSocket } from '@/lib/websocket/client'
import type {
  EnhancementProgress,
  AnalysisProgress,
  ExportProgress,
  JobCompleted,
  JobFailed,
  QueuePosition,
  Notification,
} from '@/lib/websocket/types'

export interface DocumentProgressState {
  // Connection state
  isConnected: boolean
  connectionError?: string
  
  // Queue state
  queuePosition?: number
  estimatedWaitTime?: number
  
  // Progress state
  currentStage?: 'queued' | 'analysis' | 'enhancement' | 'export' | 'completed' | 'failed'
  overallProgress: number
  stageProgress: number
  message?: string
  
  // Analysis state
  analysisFindings?: {
    colorIssues?: number
    layoutIssues?: number
    typographyIssues?: number
  }
  
  // Completion state
  isCompleted: boolean
  completedData?: {
    enhancedUrl?: string
    thumbnailUrl?: string
    improvements?: {
      before: number
      after: number
    }
    processingTime?: number
  }
  
  // Error state
  error?: {
    message: string
    code?: string
    retryable: boolean
  }
  
  // Notifications
  notifications: Notification[]
}

// Helper to create typed event handlers
function createHandler<T>(handler: (data: T) => void): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const data = args[0] as T
    handler(data)
  }
}

export function useDocumentProgress(documentId: string | null) {
  const ws = useWebSocket()
  const [state, setState] = useState<DocumentProgressState>({
    isConnected: false,
    overallProgress: 0,
    stageProgress: 0,
    isCompleted: false,
    notifications: [],
  })

  // Handle connection status
  useEffect(() => {
    const handleConnected = () => {
      setState(prev => ({ ...prev, isConnected: true, connectionError: undefined }))
    }

    const handleDisconnected = () => {
      setState(prev => ({ ...prev, isConnected: false }))
    }

    const handleConnectionError = (...args: unknown[]) => {
      const error = args[0] as string
      setState(prev => ({ ...prev, connectionError: error, isConnected: false }))
    }

    ws.on('connected', handleConnected)
    ws.on('disconnected', handleDisconnected)
    ws.on('connection_failed', handleConnectionError)

    // Connect if not already connected
    ws.connect().catch(console.error)

    return () => {
      ws.off('connected', handleConnected)
      ws.off('disconnected', handleDisconnected)
      ws.off('connection_failed', handleConnectionError)
    }
  }, [ws])

  // Subscribe to document updates
  useEffect(() => {
    if (!documentId || !state.isConnected) return

    // Subscribe to this document
    ws.subscribeToDocument(documentId)

    // Handle queue position
    const handleQueuePosition = createHandler<QueuePosition>((data) => {
      setState(prev => ({
        ...prev,
        currentStage: 'queued',
        queuePosition: data.position,
        estimatedWaitTime: data.estimatedWaitTime,
      }))
    })

    // Handle job started
    const handleJobStarted = () => {
      setState(prev => ({
        ...prev,
        currentStage: 'analysis',
        queuePosition: undefined,
        estimatedWaitTime: undefined,
      }))
    }

    // Handle analysis progress
    const handleAnalysisProgress = createHandler<AnalysisProgress>((data) => {
      setState(prev => ({
        ...prev,
        currentStage: 'analysis',
        stageProgress: data.progress,
        overallProgress: Math.round(data.progress * 0.2), // Analysis is 20% of total
        message: data.stage,
        analysisFindings: data.findings,
      }))
    })

    // Handle enhancement progress
    const handleEnhancementProgress = createHandler<EnhancementProgress>((data) => {
      const stageWeights = {
        analysis: 0.2,
        planning: 0.3,
        generation: 0.3,
        composition: 0.2,
      }
      
      const baseProgress = Object.entries(stageWeights)
        .slice(0, Object.keys(stageWeights).indexOf(data.stage))
        .reduce((sum, [, weight]) => sum + weight * 100, 0)
      
      const currentStageWeight = stageWeights[data.stage] || 0
      const overallProgress = baseProgress + (data.progress * currentStageWeight)

      setState(prev => ({
        ...prev,
        currentStage: 'enhancement',
        stageProgress: data.progress,
        overallProgress: Math.round(overallProgress),
        message: data.message,
      }))
    })

    // Handle export progress
    const handleExportProgress = createHandler<ExportProgress>((data) => {
      setState(prev => ({
        ...prev,
        currentStage: 'export',
        stageProgress: data.progress,
        overallProgress: 90 + Math.round(data.progress * 0.1), // Export is last 10%
        message: `Exporting as ${data.format.toUpperCase()}`,
      }))
    })

    // Handle job completed
    const handleJobCompleted = createHandler<JobCompleted>((data) => {
      setState(prev => ({
        ...prev,
        currentStage: 'completed',
        isCompleted: true,
        overallProgress: 100,
        stageProgress: 100,
        completedData: {
          enhancedUrl: data.result.enhancedUrl,
          thumbnailUrl: data.result.thumbnailUrl,
          improvements: data.result.improvements,
          processingTime: data.processingTime,
        },
        message: 'Enhancement completed!',
      }))
    })

    // Handle job failed
    const handleJobFailed = createHandler<JobFailed>((data) => {
      setState(prev => ({
        ...prev,
        currentStage: 'failed',
        error: data.error,
        message: data.error.message,
      }))
    })

    // Handle notifications
    const handleNotification = createHandler<Notification>((notification) => {
      setState(prev => ({
        ...prev,
        notifications: [...prev.notifications, notification],
      }))
    })

    // Subscribe to events for this document
    ws.on(`queue:position:${documentId}`, handleQueuePosition)
    ws.on(`job:started:${documentId}`, handleJobStarted)
    ws.on(`analysis:progress:${documentId}`, handleAnalysisProgress)
    ws.on(`enhancement:progress:${documentId}`, handleEnhancementProgress)
    ws.on(`export:progress:${documentId}`, handleExportProgress)
    ws.on(`job:completed:${documentId}`, handleJobCompleted)
    ws.on(`job:failed:${documentId}`, handleJobFailed)
    ws.on(`notification:${documentId}`, handleNotification)

    return () => {
      // Unsubscribe from document
      ws.unsubscribeFromDocument(documentId)
      
      // Remove event listeners
      ws.off(`queue:position:${documentId}`, handleQueuePosition)
      ws.off(`job:started:${documentId}`, handleJobStarted)
      ws.off(`analysis:progress:${documentId}`, handleAnalysisProgress)
      ws.off(`enhancement:progress:${documentId}`, handleEnhancementProgress)
      ws.off(`export:progress:${documentId}`, handleExportProgress)
      ws.off(`job:completed:${documentId}`, handleJobCompleted)
      ws.off(`job:failed:${documentId}`, handleJobFailed)
      ws.off(`notification:${documentId}`, handleNotification)
    }
  }, [documentId, state.isConnected, ws])

  // Clear notification
  const clearNotification = useCallback((notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== notificationId),
    }))
  }, [])

  // Retry failed job
  const retry = useCallback(() => {
    if (state.error?.retryable) {
      // In a real implementation, this would trigger a retry
      setState(prev => ({
        ...prev,
        error: undefined,
        currentStage: 'queued',
        overallProgress: 0,
        stageProgress: 0,
      }))
    }
  }, [state.error])

  return {
    ...state,
    clearNotification,
    retry,
  }
}