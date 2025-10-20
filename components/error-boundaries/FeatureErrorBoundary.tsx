"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react"
import {
  logger,
  captureErrorBoundaryException,
  createErrorId,
  createTelemetryEvent,
} from "@/lib/observability/client"
import { attemptAutoRecovery } from "@/lib/error-boundary/recovery-strategies"

interface Props {
  children: ReactNode
  featureName: string
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
  maxRetries?: number
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  retryCount: number
  showDetails: boolean
  isRecovering: boolean
}

export class FeatureErrorBoundary extends Component<Props, State> {
  private mounted = true
  private static currentErrorId: string | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      showDetails: false,
      isRecovering: false,
    }
  }

  componentDidMount() {
    this.mounted = true
  }

  componentWillUnmount() {
    this.mounted = false
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = createErrorId()
    // Store error ID statically so componentDidCatch can access it
    FeatureErrorBoundary.currentErrorId = errorId
    return {
      hasError: true,
      error,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { featureName, onError } = this.props
    const { retryCount } = this.state
    // Use the error ID from getDerivedStateFromError
    const errorId = FeatureErrorBoundary.currentErrorId || createErrorId()
    FeatureErrorBoundary.currentErrorId = null // Clear it after use

    logger.error(`Feature error boundary caught error in ${featureName}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId,
      feature: featureName,
      retryCount,
    })

    captureErrorBoundaryException(error, errorInfo, {
      boundary: "feature",
      feature: featureName,
      errorId,
      retryCount,
    })

    createTelemetryEvent("feature_error_boundary_triggered", {
      feature: featureName,
      errorId,
      errorMessage: error.message,
      retryCount,
    })

    onError?.(error, errorInfo)

    this.setState({ errorInfo, errorId })

    // Attempt auto-recovery for certain error types
    this.attemptRecovery(error)
  }

  private async attemptRecovery(error: Error) {
    const { featureName, maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      logger.warn(`Max retries reached for ${featureName}`, {
        errorId: this.state.errorId,
        retryCount,
      })
      return
    }

    const canRecover = await attemptAutoRecovery(error, featureName)

    if (canRecover && this.mounted) {
      this.setState({ isRecovering: true })

      setTimeout(() => {
        if (this.mounted) {
          this.handleRetry()
        }
      }, 1000)
    }
  }

  handleRetry = () => {
    const { featureName } = this.props
    const { errorId, retryCount } = this.state

    logger.info(`Retrying feature ${featureName}`, {
      errorId,
      retryCount: retryCount + 1,
    })

    createTelemetryEvent("feature_error_boundary_retry", {
      feature: featureName,
      errorId,
      retryCount: retryCount + 1,
    })

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: retryCount + 1,
      isRecovering: false,
    })
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render() {
    const { hasError, error, errorId, retryCount, showDetails, isRecovering } =
      this.state
    const {
      children,
      featureName,
      fallback,
      showDetails: propShowDetails = false,
      maxRetries = 3,
    } = this.props

    if (hasError && error) {
      if (fallback) {
        return <>{fallback}</>
      }

      const isDevelopment = process.env.NODE_ENV === "development"
      const canRetry = retryCount < maxRetries

      return (
        <div className="relative rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                {featureName} encountered an error
              </h3>
              <p className="mt-1 text-sm text-red-600">
                {error.message || "An unexpected error occurred"}
              </p>

              {errorId && (
                <p className="mt-2 text-xs text-red-500">
                  Error ID: <code className="font-mono">{errorId}</code>
                </p>
              )}

              {(isDevelopment || propShowDetails) && (
                <button
                  onClick={this.toggleDetails}
                  className="mt-2 flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  {showDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {showDetails ? "Hide" : "Show"} details
                </button>
              )}

              {showDetails && error.stack && (
                <div className="mt-2 overflow-x-auto rounded bg-red-100 p-2 font-mono text-xs text-red-700">
                  <pre className="whitespace-pre-wrap">{error.stack}</pre>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                {canRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={this.handleRetry}
                    disabled={isRecovering}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw
                      className={`mr-1 h-3 w-3 ${isRecovering ? "animate-spin" : ""}`}
                    />
                    {isRecovering ? "Recovering..." : "Retry"}
                  </Button>
                )}

                {retryCount > 0 && (
                  <span className="flex items-center text-xs text-red-600">
                    Attempt {retryCount} of {maxRetries}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return <>{children}</>
  }
}
