'use client'

import { useCallback, useRef } from 'react'
import { 
  logger, 
  createTelemetryEvent, 
  createErrorId, 
  sanitizeErrorForLogging 
} from '@/lib/observability/client'

interface ErrorHandlerOptions {
  fallbackValue?: any
  maxRetries?: number
  retryDelay?: number
  onError?: (error: Error) => void
  errorContext?: Record<string, any>
}

interface ErrorHandlerResult {
  handleError: (error: Error) => void
  handleAsyncError: <T>(promise: Promise<T>, options?: ErrorHandlerOptions) => Promise<T | undefined>
  resetError: () => void
  errorCount: number
}

export function useErrorHandler(): ErrorHandlerResult {
  const errorCountRef = useRef(0)
  const lastErrorRef = useRef<Error | null>(null)

  const handleError = useCallback((error: Error) => {
    errorCountRef.current += 1
    lastErrorRef.current = error
    
    const errorId = createErrorId()
    const sanitized = sanitizeErrorForLogging(error)

    logger.error('Error caught by useErrorHandler', {
      ...sanitized,
      errorId,
      errorCount: errorCountRef.current,
    })

    createTelemetryEvent('error_handler_triggered', {
      errorId,
      errorMessage: error.message,
      errorCount: errorCountRef.current,
    })

    // Throw to nearest error boundary
    throw error
  }, [])

  const handleAsyncError = useCallback(async <T,>(
    promise: Promise<T>,
    options: ErrorHandlerOptions = {}
  ): Promise<T | undefined> => {
    const {
      fallbackValue,
      maxRetries = 1,
      retryDelay = 1000,
      onError,
      errorContext,
    } = options

    let attempts = 0
    let lastError: Error | null = null

    while (attempts <= maxRetries) {
      try {
        return await promise
      } catch (error) {
        attempts += 1
        lastError = error as Error
        errorCountRef.current += 1
        
        const errorId = createErrorId()
        const sanitized = sanitizeErrorForLogging(lastError)

        logger.error('Async error caught by useErrorHandler', {
          ...sanitized,
          errorId,
          attempt: attempts,
          maxRetries,
          errorContext,
        })

        createTelemetryEvent('async_error_handler_triggered', {
          errorId,
          errorMessage: lastError.message,
          attempt: attempts,
          maxRetries,
        })

        onError?.(lastError)

        if (attempts <= maxRetries) {
          logger.info(`Retrying after ${retryDelay}ms (attempt ${attempts}/${maxRetries})`)
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
        }
      }
    }

    // All retries failed
    if (fallbackValue !== undefined) {
      logger.warn('Returning fallback value after all retries failed', {
        errorMessage: lastError?.message,
        fallbackValue,
      })
      return fallbackValue
    }

    // Re-throw if no fallback
    throw lastError
  }, [])

  const resetError = useCallback(() => {
    errorCountRef.current = 0
    lastErrorRef.current = null
    
    logger.info('Error handler reset')
    
    createTelemetryEvent('error_handler_reset', {
      previousErrorCount: errorCountRef.current,
    })
  }, [])

  return {
    handleError,
    handleAsyncError,
    resetError,
    errorCount: errorCountRef.current,
  }
}