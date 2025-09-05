'use client'

import React, { Component, ErrorInfo, ReactNode, Suspense } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { 
  logger, 
  captureErrorBoundaryException, 
  createErrorId, 
  createTelemetryEvent 
} from '@/lib/observability/client'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  retryDelay?: number
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  isRetrying: boolean
}

export class AsyncErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null
  private static currentErrorId: string | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isRetrying: false,
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = createErrorId()
    // Store error ID statically so componentDidCatch can access it
    AsyncErrorBoundary.currentErrorId = errorId
    
    // Check if it's an async error
    const isAsyncError = 
      error.message.includes('ChunkLoadError') ||
      error.message.includes('dynamically imported module') ||
      error.message.includes('Failed to fetch') ||
      error.name === 'SuspenseError'

    logger.error('AsyncErrorBoundary caught error', {
      error: error.message,
      isAsyncError,
      errorId,
    })

    return {
      hasError: true,
      error,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    // Use the error ID from getDerivedStateFromError
    const errorId = AsyncErrorBoundary.currentErrorId || createErrorId()
    AsyncErrorBoundary.currentErrorId = null // Clear it after use

    captureErrorBoundaryException(error, errorInfo, {
      boundary: 'async',
      errorId,
      retryCount: 0,
    })

    createTelemetryEvent('async_error_boundary_triggered', {
      errorId,
      errorMessage: error.message,
      errorType: error.name,
    })

    onError?.(error, errorInfo)
    this.setState({ errorInfo })
  }

  handleRetry = async () => {
    const { retryDelay = 1000 } = this.props
    const { errorId } = this.state

    logger.info('Retrying after async error', {
      errorId,
      retryDelay,
    })

    this.setState({ isRetrying: true })

    createTelemetryEvent('async_error_boundary_retry', {
      errorId,
    })

    // Add a small delay before retry
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRetrying: false,
      })
    }, retryDelay)
  }

  render() {
    const { hasError, error, isRetrying } = this.state
    const { children, fallback, loadingFallback } = this.props

    if (hasError && error) {
      if (fallback) {
        return <>{fallback}</>
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="flex items-center space-x-2 text-amber-600">
            <AlertCircle className="h-6 w-6" />
            <h3 className="text-lg font-semibold">Loading Error</h3>
          </div>
          
          <p className="text-sm text-gray-600 text-center max-w-md">
            {error.message.includes('ChunkLoadError') || error.message.includes('dynamically imported module')
              ? 'Failed to load application resources. This might be due to a network issue or an outdated version.'
              : 'An error occurred while loading this content.'}
          </p>

          <Button
            onClick={this.handleRetry}
            disabled={isRetrying}
            variant="default"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      )
    }

    // Wrap children in Suspense to catch async errors
    return (
      <Suspense
        fallback={
          loadingFallback || (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-600">Loading...</span>
              </div>
            </div>
          )
        }
      >
        {children}
      </Suspense>
    )
  }
}