'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { 
  logger, 
  captureErrorBoundaryException, 
  getUserErrorMessage, 
  createTelemetryEvent 
} from '@/lib/observability/client'
import Link from 'next/link'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  retryCount: number
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = Math.random().toString(36).substring(7)
    
    logger.error('Global error boundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId,
      retryCount: this.state.retryCount,
    })

    captureErrorBoundaryException(error, errorInfo, {
      boundary: 'global',
      errorId,
      retryCount: this.state.retryCount,
    })

    createTelemetryEvent('error_boundary_triggered', {
      boundary: 'global',
      errorId,
      errorMessage: error.message,
      retryCount: this.state.retryCount,
    })

    this.setState({
      errorInfo,
      errorId,
    })
  }

  handleReset = () => {
    const { error, errorId, retryCount } = this.state

    logger.info('User attempting error recovery', {
      errorId,
      retryCount: retryCount + 1,
      errorMessage: error?.message,
    })

    createTelemetryEvent('error_boundary_reset', {
      boundary: 'global',
      errorId,
      retryCount: retryCount + 1,
    })

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: retryCount + 1,
    })
  }

  handleFullRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    const { hasError, error, errorId, retryCount } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.handleReset)
      }

      const isDevelopment = process.env.NODE_ENV === 'development'
      const userMessage = getUserErrorMessage(error)
      const showRetry = retryCount < 3

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
          <div className="max-w-md w-full space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    Something went wrong
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {userMessage}
                  </p>
                </div>
              </div>

              {errorId && (
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600">
                    Error ID: <code className="font-mono">{errorId}</code>
                  </p>
                </div>
              )}

              {isDevelopment && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                    Error details (development only)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="bg-gray-100 rounded p-3 overflow-x-auto">
                      <p className="text-xs font-mono text-red-700 whitespace-pre-wrap">
                        {error.message}
                      </p>
                    </div>
                    {error.stack && (
                      <div className="bg-gray-100 rounded p-3 overflow-x-auto max-h-40 overflow-y-auto">
                        <pre className="text-xs text-gray-700">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="flex space-x-3 pt-2">
                {showRetry && (
                  <Button
                    onClick={this.handleReset}
                    variant="default"
                    className="flex-1"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try again
                  </Button>
                )}
                <Button
                  onClick={this.handleFullRefresh}
                  variant={showRetry ? 'outline' : 'default'}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh page
                </Button>
              </div>

              <Link href="/" className="block">
                <Button variant="ghost" className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Go to homepage
                </Button>
              </Link>
            </div>

            {retryCount > 0 && (
              <p className="text-center text-sm text-gray-600">
                Retry attempt {retryCount} of 3
              </p>
            )}
          </div>
        </div>
      )
    }

    return children
  }
}