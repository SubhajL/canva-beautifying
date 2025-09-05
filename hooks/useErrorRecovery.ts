'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { logger, createTelemetryEvent } from '@/lib/observability/client'

interface RecoveryOptions {
  maxAttempts?: number
  backoffMultiplier?: number
  initialDelay?: number
  maxDelay?: number
  onRecoveryStart?: () => void
  onRecoverySuccess?: () => void
  onRecoveryFailed?: (error: Error) => void
}

interface RecoveryState {
  isRecovering: boolean
  attempts: number
  lastError: Error | null
  canRetry: boolean
}

interface UseErrorRecoveryResult {
  state: RecoveryState
  startRecovery: (recoverFn: () => Promise<void>, error?: Error) => Promise<boolean>
  resetRecovery: () => void
  getNextDelay: () => number
}

export function useErrorRecovery(options: RecoveryOptions = {}): UseErrorRecoveryResult {
  const {
    maxAttempts = 3,
    backoffMultiplier = 2,
    initialDelay = 1000,
    maxDelay = 30000,
    onRecoveryStart,
    onRecoverySuccess,
    onRecoveryFailed,
  } = options

  const [state, setState] = useState<RecoveryState>({
    isRecovering: false,
    attempts: 0,
    lastError: null,
    canRetry: true,
  })

  const recoveryIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      // Clean up on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const getNextDelay = useCallback((): number => {
    const delay = Math.min(
      initialDelay * Math.pow(backoffMultiplier, state.attempts),
      maxDelay
    )
    return delay
  }, [initialDelay, backoffMultiplier, state.attempts, maxDelay])

  const startRecovery = useCallback(async (
    recoverFn: () => Promise<void>,
    error?: Error
  ): Promise<boolean> => {
    if (state.isRecovering) {
      logger.warn('Recovery already in progress')
      return false
    }

    if (state.attempts >= maxAttempts) {
      logger.warn('Max recovery attempts reached', {
        attempts: state.attempts,
        maxAttempts,
      })
      setState((prev) => ({ ...prev, canRetry: false }))
      return false
    }

    recoveryIdRef.current = `recovery_${Date.now()}`
    abortControllerRef.current = new AbortController()
    
    setState((prev) => ({
      ...prev,
      isRecovering: true,
      lastError: error || prev.lastError,
    }))

    onRecoveryStart?.()

    logger.info('Starting recovery attempt', {
      recoveryId: recoveryIdRef.current,
      attempt: state.attempts + 1,
      maxAttempts,
    })

    createTelemetryEvent('error_recovery_started', {
      recoveryId: recoveryIdRef.current,
      attempt: state.attempts + 1,
      errorMessage: error?.message || state.lastError?.message,
    })

    const delay = getNextDelay()
    
    try {
      // Wait with exponential backoff
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, delay)
        
        abortControllerRef.current?.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
          reject(new Error('Recovery aborted'))
        })
      })

      // Check if recovery was aborted
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Recovery aborted')
      }

      // Execute recovery function
      await recoverFn()

      logger.info('Recovery successful', {
        recoveryId: recoveryIdRef.current,
        attempt: state.attempts + 1,
      })

      createTelemetryEvent('error_recovery_success', {
        recoveryId: recoveryIdRef.current,
        attempt: state.attempts + 1,
      })

      setState({
        isRecovering: false,
        attempts: 0,
        lastError: null,
        canRetry: true,
      })

      onRecoverySuccess?.()
      return true
      
    } catch (recoveryError) {
      const error = recoveryError as Error
      
      logger.error('Recovery attempt failed', {
        recoveryId: recoveryIdRef.current,
        attempt: state.attempts + 1,
        error: error.message,
      })

      createTelemetryEvent('error_recovery_failed', {
        recoveryId: recoveryIdRef.current,
        attempt: state.attempts + 1,
        errorMessage: error.message,
      })

      setState((prev) => ({
        isRecovering: false,
        attempts: prev.attempts + 1,
        lastError: error,
        canRetry: prev.attempts + 1 < maxAttempts,
      }))

      if (state.attempts + 1 >= maxAttempts) {
        onRecoveryFailed?.(error)
      }

      return false
    }
  }, [
    state,
    maxAttempts,
    onRecoveryStart,
    onRecoverySuccess,
    onRecoveryFailed,
    getNextDelay,
  ])

  const resetRecovery = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setState({
      isRecovering: false,
      attempts: 0,
      lastError: null,
      canRetry: true,
    })

    logger.info('Recovery state reset')
    
    createTelemetryEvent('error_recovery_reset', {
      previousAttempts: state.attempts,
    })
  }, [state.attempts])

  return {
    state,
    startRecovery,
    resetRecovery,
    getNextDelay,
  }
}