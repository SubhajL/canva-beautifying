"use client"

import { useState, useCallback } from 'react'
import { EnhancementResult, EnhancementPreferences } from '@/lib/enhancement/types'

interface UseEnhancementOptions {
  onSuccess?: (result: EnhancementResult) => void
  onError?: (error: Error) => void
  pollingInterval?: number
}

export function useEnhancement(options: UseEnhancementOptions = {}) {
  const { onSuccess, onError, pollingInterval = 2000 } = options
  
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<EnhancementResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const enhance = useCallback(async (
    documentId: string,
    preferences?: EnhancementPreferences
  ) => {
    setIsEnhancing(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      // Start enhancement
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, preferences })
      })

      if (!response.ok) {
        throw new Error('Enhancement failed')
      }

      const data = await response.json()
      
      if (data.success) {
        // Enhancement completed immediately
        setResult(data)
        setProgress(100)
        onSuccess?.(data)
      } else {
        // Poll for status
        await pollEnhancementStatus(documentId)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Enhancement failed')
      setError(error)
      onError?.(error)
    } finally {
      setIsEnhancing(false)
    }
  }, [onSuccess, onError, pollingInterval])

  const pollEnhancementStatus = useCallback(async (documentId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/enhance?documentId=${documentId}`)
        const data = await response.json()

        if (data.status === 'completed' && data.result) {
          setResult(data.result)
          setProgress(100)
          onSuccess?.(data.result)
          return true // Stop polling
        } else if (data.status === 'failed') {
          throw new Error('Enhancement failed')
        } else if (data.status === 'processing') {
          setProgress(data.progress || 0)
          return false // Continue polling
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Status check failed')
        setError(error)
        onError?.(error)
        return true // Stop polling on error
      }
    }

    // Initial poll
    const completed = await poll()
    if (completed) return

    // Continue polling
    const interval = setInterval(async () => {
      const completed = await poll()
      if (completed) {
        clearInterval(interval)
      }
    }, pollingInterval)
  }, [onSuccess, onError, pollingInterval])

  const reset = useCallback(() => {
    setIsEnhancing(false)
    setProgress(0)
    setResult(null)
    setError(null)
  }, [])

  return {
    enhance,
    isEnhancing,
    progress,
    result,
    error,
    reset
  }
}

export function useEnhancementList() {
  const [enhancements, setEnhancements] = useState<Array<{
    id: string
    originalUrl: string
    enhancedUrl?: string
    status: string
    createdAt: Date
    completedAt?: Date
  }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchEnhancements = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/enhance')
      if (!response.ok) {
        throw new Error('Failed to fetch enhancements')
      }

      const data = await response.json()
      setEnhancements(data.enhancements || [])
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch')
      setError(error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    enhancements,
    isLoading,
    error,
    refresh: fetchEnhancements
  }
}