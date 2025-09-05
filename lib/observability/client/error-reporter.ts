/**
 * Client-safe error reporting for browser and Edge Runtime environments
 */

import { ErrorInfo } from 'react'
import { captureException, withScope } from '@sentry/nextjs'
import { logger } from './logger'
import { createTelemetrySpan } from './tracing'
import { createTelemetryEvent } from './events'

export interface ErrorContext {
  boundary: string
  errorId: string
  retryCount: number
  userId?: string
  pathname?: string
  userAgent?: string
  [key: string]: any
}

export function captureErrorBoundaryException(
  error: Error,
  errorInfo: ErrorInfo,
  context: ErrorContext
) {
  const span = createTelemetrySpan('error_boundary_report', {
    attributes: {
      'error.boundary': context.boundary,
      'error.id': context.errorId,
      'error.message': error.message,
      'error.retry_count': context.retryCount,
    },
  })

  try {
    // Capture with Sentry
    withScope((scope) => {
      scope.setContext('error_boundary', {
        boundary: context.boundary,
        errorId: context.errorId,
        retryCount: context.retryCount,
        componentStack: errorInfo.componentStack,
      })

      scope.setTag('error.boundary', context.boundary)
      scope.setTag('error.id', context.errorId)
      scope.setLevel('error')

      if (context.userId) {
        scope.setUser({ id: context.userId })
      }

      if (context.pathname) {
        scope.setContext('navigation', { pathname: context.pathname })
      }

      Object.entries(context).forEach(([key, value]) => {
        if (!['boundary', 'errorId', 'retryCount', 'userId', 'pathname'].includes(key)) {
          scope.setExtra(key, value)
        }
      })

      captureException(error)
    })

    // Log the error
    logger.error('Error boundary exception captured', error, {
      errorId: context.errorId,
      boundary: context.boundary,
      componentStack: errorInfo.componentStack,
      retryCount: context.retryCount,
      ...context,
    })

    // Track telemetry event
    createTelemetryEvent('error_boundary_exception', {
      errorId: context.errorId,
      boundary: context.boundary,
      errorName: error.name,
      errorMessage: error.message,
      retryCount: context.retryCount,
      hasComponentStack: !!errorInfo.componentStack,
      ...context,
    })
  } finally {
    span?.end()
  }
}

export function getUserErrorMessage(error: Error): string {
  const errorMessages: Record<string, string> = {
    ChunkLoadError: 'The application needs to be refreshed. Please reload the page.',
    NetworkError: 'Unable to connect. Please check your internet connection.',
    'Failed to fetch dynamically imported module': 'The application needs to be updated. Please refresh the page.',
    QUOTA_EXCEEDED_ERR: 'Your browser storage is full. Please clear some space and try again.',
    SecurityError: 'A security error occurred. Please refresh the page.',
    TimeoutError: 'The operation took too long. Please try again.',
    AbortError: 'The operation was cancelled. Please try again.',
  }

  for (const [key, message] of Object.entries(errorMessages)) {
    if (error.name === key || error.message.includes(key)) {
      return message
    }
  }

  if (error.message.toLowerCase().includes('network')) {
    return errorMessages.NetworkError
  }

  if (error.message.toLowerCase().includes('timeout')) {
    return errorMessages.TimeoutError
  }

  return 'An unexpected error occurred. Please try again or contact support if the problem persists.'
}

export function shouldIgnoreError(error: Error): boolean {
  const ignoredErrors = [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    'Network request failed',
    'Load failed',
    'cancelled',
  ]

  return ignoredErrors.some((ignored) =>
    error.message.toLowerCase().includes(ignored.toLowerCase())
  )
}

export function sanitizeErrorForLogging(error: Error): Record<string, any> {
  const sanitized: Record<string, any> = {
    name: error.name,
    message: error.message,
    timestamp: new Date().toISOString(),
  }

  if (error.stack) {
    sanitized.stack = error.stack
      .split('\n')
      .map((line) => line.replace(/https?:\/\/[^\s]+/g, '[URL]'))
      .join('\n')
  }

  const errorWithDetails = error as any
  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential', 'auth']
  
  Object.keys(errorWithDetails).forEach((key) => {
    if (!sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = errorWithDetails[key]
    }
  })

  return sanitized
}

export function createErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(7)}`
}

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (shouldIgnoreError(event.error)) {
      return
    }

    const errorId = createErrorId()
    
    logger.error('Unhandled error', event.error, {
      errorId,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })

    createTelemetryEvent('unhandled_error', {
      errorId,
      errorName: event.error?.name,
      errorMessage: event.error?.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    
    if (shouldIgnoreError(error)) {
      return
    }

    const errorId = createErrorId()
    
    logger.error('Unhandled promise rejection', error, {
      errorId,
      reason: event.reason,
    })

    createTelemetryEvent('unhandled_rejection', {
      errorId,
      errorName: error.name,
      errorMessage: error.message,
      reason: String(event.reason),
    })
  })
}