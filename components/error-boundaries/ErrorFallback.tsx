'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

interface ErrorFallbackProps {
  error: Error
  errorId?: string
  resetError: () => void
  showDetails?: boolean
  isDevelopment?: boolean
  minimal?: boolean
}

export function ErrorFallback({
  error,
  errorId,
  resetError,
  showDetails: defaultShowDetails = false,
  isDevelopment = process.env.NODE_ENV === 'development',
  minimal = false,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(defaultShowDetails)

  if (minimal) {
    return (
      <div className="flex items-center justify-center p-4 text-center">
        <div className="space-y-2">
          <AlertTriangle className="h-6 w-6 text-red-500 mx-auto" />
          <p className="text-sm text-gray-600">Something went wrong</p>
          <Button size="sm" variant="outline" onClick={resetError}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 space-y-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              Oops! Something went wrong
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {getErrorMessage(error)}
            </p>
          </div>
        </div>

        {errorId && (
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-600">
              Error ID: <code className="font-mono text-gray-800">{errorId}</code>
            </p>
          </div>
        )}

        {(isDevelopment || defaultShowDetails) && (
          <>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              type="button"
            >
              {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDetails ? 'Hide' : 'Show'} error details
            </button>

            {showDetails && (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <p className="text-xs font-mono text-red-800 whitespace-pre-wrap break-words">
                    {error.message}
                  </p>
                </div>
                
                {error.stack && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                      Stack trace
                    </summary>
                    <div className="mt-2 bg-gray-100 rounded p-3 overflow-x-auto">
                      <pre className="text-gray-700 whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            onClick={resetError}
            className="flex-1"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
          
          <Link href="/" className="flex-1">
            <Button variant="outline" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Go home
            </Button>
          </Link>
        </div>

        <p className="text-xs text-center text-gray-500">
          If this problem persists, please contact support
        </p>
      </div>
    </div>
  )
}

function getErrorMessage(error: Error): string {
  // Map common error types to user-friendly messages
  const errorMessages: Record<string, string> = {
    ChunkLoadError: 'Failed to load application resources. Please refresh the page.',
    NetworkError: 'Connection error. Please check your internet and try again.',
    TimeoutError: 'The operation took too long. Please try again.',
    'Failed to fetch': 'Could not connect to the server. Please try again later.',
  }

  for (const [key, message] of Object.entries(errorMessages)) {
    if (error.message.includes(key) || error.name === key) {
      return message
    }
  }

  return 'An unexpected error occurred. Please try again.'
}