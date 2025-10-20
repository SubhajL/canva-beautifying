"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h1 className="mb-4 text-2xl font-bold text-red-600">
              Critical Error
            </h1>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              A critical error occurred. Please refresh the page or contact
              support if the problem persists.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => reset()}
                className="w-full rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="w-full rounded bg-gray-200 px-4 py-2 text-gray-800 transition-colors hover:bg-gray-300"
              >
                Go to Homepage
              </button>
            </div>
            {error.digest && (
              <p className="mt-4 text-center text-xs text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
