/**
 * Safe Error Creation Factory
 * Creates standardized safe errors with proper sanitization
 */

import { AppError, ErrorCode, ErrorFactory } from './error-types'
import { ErrorSanitizer } from './error-sanitizer'
import SecureLogger from './error-logger'

export interface SafeErrorOptions {
  code?: ErrorCode
  userMessage?: string
  statusCode?: number
  details?: Record<string, any>
  logError?: boolean
  requestId?: string
}

/**
 * Create a safe error for API responses
 */
export function createSafeError(
  internalMessage: string,
  userMessage: string,
  internalError?: Error,
  options: SafeErrorOptions = {}
): AppError {
  const {
    code = ErrorCode.INTERNAL_ERROR,
    statusCode,
    details,
    logError = true,
    requestId,
  } = options

  // Create the app error
  const appError = new AppError(internalMessage, {
    code,
    userMessage,
    statusCode,
    details,
    cause: internalError,
  })

  // Log the error if requested
  if (logError) {
    const correlationId = SecureLogger.logError(appError, {
      requestId,
      ...(details && { errorDetails: details }),
    })
    
    // Add correlation ID to error details
    if (!appError.details) {
      appError.details = {}
    }
    appError.details.correlationId = correlationId
  }

  return appError
}

/**
 * Create safe error response for API
 */
export function createErrorResponse(
  error: unknown,
  requestId?: string
): {
  status: number
  body: Record<string, any>
  headers?: Record<string, string>
} {
  // Convert to AppError
  const appError = error instanceof AppError
    ? error
    : ErrorFactory.internal('An unexpected error occurred')

  // Log if not already logged
  if (!appError.details?.correlationId) {
    const correlationId = SecureLogger.logError(appError, { requestId })
    if (!appError.details) {
      appError.details = {}
    }
    appError.details.correlationId = correlationId
  }

  // Create sanitized response
  const response = ErrorSanitizer.forResponse(appError, requestId)

  // Add retry-after header for rate limit errors
  const headers: Record<string, string> = {}
  if (appError.code === ErrorCode.RATE_LIMIT_EXCEEDED && appError.details?.retryAfter) {
    headers['Retry-After'] = String(appError.details.retryAfter)
  }

  return {
    status: appError.statusCode,
    body: response,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  }
}

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      // Extract request from args if available
      const request = args.find(arg => arg instanceof Request) as Request | undefined
      const requestId = request?.headers.get('x-request-id') || undefined

      // Create error response
      const { status, body, headers } = createErrorResponse(error, requestId)

      // Return Response object
      return new Response(JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      })
    }
  }) as T
}

/**
 * Express-style error handler middleware
 */
export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  next: Function
): Response {
  const requestId = req.headers.get('x-request-id') || undefined
  const { status, body, headers } = createErrorResponse(error, requestId)

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

/**
 * Create safe error with validation details
 */
export function createValidationError(
  field: string,
  message: string,
  value?: any
): AppError {
  return createSafeError(
    `Validation failed for field: ${field}`,
    'Please check your input and try again',
    undefined,
    {
      code: ErrorCode.VALIDATION_ERROR,
      details: {
        field,
        message,
        ...(value !== undefined && { value }),
      },
    }
  )
}

/**
 * Create safe authentication error
 */
export function createAuthError(
  reason: string,
  requiresAuth = true
): AppError {
  const code = requiresAuth ? ErrorCode.AUTH_REQUIRED : ErrorCode.AUTH_FORBIDDEN
  const userMessage = requiresAuth
    ? 'Please sign in to continue'
    : 'You do not have permission to access this resource'

  return createSafeError(
    `Authentication failed: ${reason}`,
    userMessage,
    undefined,
    { code }
  )
}

/**
 * Create safe API error
 */
export function createApiError(
  service: string,
  originalError: Error,
  userMessage = 'External service error. Please try again'
): AppError {
  return createSafeError(
    `${service} API error: ${originalError.message}`,
    userMessage,
    originalError,
    {
      code: ErrorCode.API_ERROR,
      details: { service },
    }
  )
}

/**
 * Create safe file error
 */
export function createFileError(
  operation: string,
  reason: string,
  fileDetails?: {
    filename?: string
    size?: number
    type?: string
  }
): AppError {
  let code = ErrorCode.FILE_PROCESSING_FAILED
  let userMessage = 'File processing failed'

  // Determine specific error type
  if (reason.includes('size') || reason.includes('large')) {
    code = ErrorCode.FILE_TOO_LARGE
    userMessage = 'File too large'
  } else if (reason.includes('type') || reason.includes('format')) {
    code = ErrorCode.INVALID_FILE_TYPE
    userMessage = 'Invalid file type'
  } else if (reason.includes('not found')) {
    code = ErrorCode.FILE_NOT_FOUND
    userMessage = 'File not found'
  }

  return createSafeError(
    `File ${operation} failed: ${reason}`,
    userMessage,
    undefined,
    {
      code,
      details: fileDetails,
    }
  )
}

/**
 * Export all error utilities
 */
export * from './error-types'
export { ErrorSanitizer } from './error-sanitizer'
export { SecureLogger } from './error-logger'