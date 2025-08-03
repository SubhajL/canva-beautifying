'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export interface ErrorFallbackProps {
  error: Error;
  errorId: string | null;
  resetError: () => void;
}

class ErrorBoundaryInner extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorId: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    this.setState({ errorId });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorId={this.state.errorId}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, errorId, resetError }: ErrorFallbackProps) {
  const router = useRouter();
  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleReport = () => {
    if (errorId) {
      // Open feedback dialog with error ID
      const subject = encodeURIComponent(`Error Report: ${errorId}`);
      const body = encodeURIComponent(
        `I encountered an error with ID: ${errorId}\n\nWhat I was doing:\n[Please describe what you were doing when the error occurred]\n\nAdditional details:\n[Any other information that might help]`
      );
      window.open(`mailto:support@beautifyai.com?subject=${subject}&body=${body}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription>
            We apologize for the inconvenience. The error has been logged and our team will investigate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error details in development */}
          {isDevelopment && (
            <div className="bg-muted rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">Error Details (Development Only):</p>
              <p className="font-mono text-xs break-all">{error.message}</p>
              {error.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground">Stack trace</summary>
                  <pre className="mt-2 text-xs overflow-auto max-h-40">{error.stack}</pre>
                </details>
              )}
            </div>
          )}

          {/* Error ID for reference */}
          {errorId && (
            <div className="text-center text-sm text-muted-foreground">
              <p>Error ID: <code className="font-mono">{errorId}</code></p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={resetError}
              className="flex-1"
              variant="default"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button
              onClick={() => router.push('/dashboard')}
              className="flex-1"
              variant="outline"
            >
              <Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>

          {/* Report button */}
          {errorId && (
            <Button
              onClick={handleReport}
              className="w-full"
              variant="ghost"
              size="sm"
            >
              <Bug className="mr-2 h-4 w-4" />
              Report this error
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Export the error boundary component
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorBoundaryInner {...props} />;
}

// Hook to use error boundary programmatically
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    Sentry.captureException(error, {
      contexts: errorInfo ? {
        react: {
          componentStack: errorInfo.componentStack,
        },
      } : undefined,
    });

    // In development, also log to console
    if (process.env.NODE_ENV === 'development') {
      console.error('Error handled:', error, errorInfo);
    }
  };
}