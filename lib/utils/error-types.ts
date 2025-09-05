/**
 * Standardized Error Types
 * Defines error codes and structures for consistent error handling
 */

export enum ErrorCode {
  // Authentication & Authorization
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_FORBIDDEN = 'AUTH_FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  INSECURE_API_KEY_USAGE = 'INSECURE_API_KEY_USAGE',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // File Operations
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_PROCESSING_FAILED = 'FILE_PROCESSING_FAILED',
  
  // API & External Services
  API_ERROR = 'API_ERROR',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Database
  DB_ERROR = 'DB_ERROR',
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  
  // Business Logic
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  FEATURE_NOT_AVAILABLE = 'FEATURE_NOT_AVAILABLE',
  
  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

export interface AppErrorOptions {
  code?: ErrorCode
  statusCode?: number
  userMessage?: string
  details?: Record<string, any>
  cause?: Error
  isOperational?: boolean
}

/**
 * Custom Application Error Class
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly userMessage: string
  public details?: Record<string, any>
  public readonly isOperational: boolean
  public readonly timestamp: Date
  public readonly cause?: Error

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message)
    
    this.name = this.constructor.name
    this.code = options.code || ErrorCode.UNKNOWN_ERROR
    this.statusCode = options.statusCode || this.getDefaultStatusCode(this.code)
    this.userMessage = options.userMessage || this.getDefaultUserMessage(this.code)
    this.details = options.details
    this.isOperational = options.isOperational !== false
    this.timestamp = new Date()
    this.cause = options.cause
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * Get default HTTP status code for error code
   */
  private getDefaultStatusCode(code: ErrorCode): number {
    const statusMap: Record<ErrorCode, number> = {
      // 400 Bad Request
      [ErrorCode.VALIDATION_ERROR]: 400,
      [ErrorCode.INVALID_REQUEST]: 400,
      [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
      [ErrorCode.INVALID_FORMAT]: 400,
      [ErrorCode.INVALID_FILE_TYPE]: 400,
      [ErrorCode.INSECURE_API_KEY_USAGE]: 400,
      
      // 401 Unauthorized
      [ErrorCode.AUTH_REQUIRED]: 401,
      [ErrorCode.AUTH_INVALID]: 401,
      [ErrorCode.AUTH_EXPIRED]: 401,
      
      // 403 Forbidden
      [ErrorCode.AUTH_FORBIDDEN]: 403,
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
      [ErrorCode.INSUFFICIENT_CREDITS]: 403,
      [ErrorCode.SUBSCRIPTION_REQUIRED]: 403,
      [ErrorCode.FEATURE_NOT_AVAILABLE]: 403,
      
      // 404 Not Found
      [ErrorCode.RECORD_NOT_FOUND]: 404,
      [ErrorCode.FILE_NOT_FOUND]: 404,
      
      // 409 Conflict
      [ErrorCode.DUPLICATE_RECORD]: 409,
      
      // 413 Payload Too Large
      [ErrorCode.FILE_TOO_LARGE]: 413,
      
      // 429 Too Many Requests
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
      [ErrorCode.QUOTA_EXCEEDED]: 429,
      
      // 500 Internal Server Error
      [ErrorCode.INTERNAL_ERROR]: 500,
      [ErrorCode.DB_ERROR]: 500,
      [ErrorCode.DB_CONNECTION_FAILED]: 500,
      [ErrorCode.FILE_UPLOAD_FAILED]: 500,
      [ErrorCode.FILE_PROCESSING_FAILED]: 500,
      [ErrorCode.UNKNOWN_ERROR]: 500,
      
      // 501 Not Implemented
      [ErrorCode.NOT_IMPLEMENTED]: 501,
      
      // 502 Bad Gateway
      [ErrorCode.API_ERROR]: 502,
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
      
      // 503 Service Unavailable
      [ErrorCode.SERVICE_UNAVAILABLE]: 503,
      
      // 504 Gateway Timeout
      [ErrorCode.TIMEOUT]: 504,
    }
    
    return statusMap[code] || 500
  }

  /**
   * Get default user message for error code
   */
  private getDefaultUserMessage(code: ErrorCode): string {
    const messageMap: Record<ErrorCode, string> = {
      // Authentication & Authorization
      [ErrorCode.AUTH_REQUIRED]: 'Authentication required',
      [ErrorCode.AUTH_INVALID]: 'Invalid credentials',
      [ErrorCode.AUTH_EXPIRED]: 'Session expired',
      [ErrorCode.AUTH_FORBIDDEN]: 'Access forbidden',
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
      [ErrorCode.INSECURE_API_KEY_USAGE]: 'API keys must be sent in headers, not query parameters',
      
      // Validation
      [ErrorCode.VALIDATION_ERROR]: 'Validation error',
      [ErrorCode.INVALID_REQUEST]: 'Invalid request',
      [ErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required field',
      [ErrorCode.INVALID_FORMAT]: 'Invalid format',
      
      // Rate Limiting
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
      [ErrorCode.QUOTA_EXCEEDED]: 'Quota exceeded',
      
      // File Operations
      [ErrorCode.FILE_TOO_LARGE]: 'File too large',
      [ErrorCode.INVALID_FILE_TYPE]: 'Invalid file type',
      [ErrorCode.FILE_UPLOAD_FAILED]: 'File upload failed',
      [ErrorCode.FILE_NOT_FOUND]: 'File not found',
      [ErrorCode.FILE_PROCESSING_FAILED]: 'File processing failed',
      
      // API & External Services
      [ErrorCode.API_ERROR]: 'External API error',
      [ErrorCode.TIMEOUT]: 'Request timeout',
      [ErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable',
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
      
      // Database
      [ErrorCode.DB_ERROR]: 'Database error',
      [ErrorCode.DB_CONNECTION_FAILED]: 'Database connection failed',
      [ErrorCode.RECORD_NOT_FOUND]: 'Record not found',
      [ErrorCode.DUPLICATE_RECORD]: 'Record already exists',
      
      // Business Logic
      [ErrorCode.INSUFFICIENT_CREDITS]: 'Insufficient credits',
      [ErrorCode.SUBSCRIPTION_REQUIRED]: 'Subscription required',
      [ErrorCode.FEATURE_NOT_AVAILABLE]: 'Feature not available',
      
      // Generic
      [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
      [ErrorCode.UNKNOWN_ERROR]: 'Unknown error occurred',
      [ErrorCode.NOT_IMPLEMENTED]: 'Feature not implemented',
    }
    
    return messageMap[code] || 'An error occurred'
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      code: this.code,
      message: this.userMessage,
      ...(this.details && { details: this.details }),
      timestamp: this.timestamp.toISOString(),
    }
  }

  /**
   * Check if error is operational (expected)
   */
  static isOperational(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational
    }
    return false
  }
}

/**
 * Common error factory functions
 */
export class ErrorFactory {
  static authRequired(message = 'Authentication required'): AppError {
    return new AppError(message, {
      code: ErrorCode.AUTH_REQUIRED,
      userMessage: 'Please sign in to continue',
    })
  }

  static forbidden(message = 'Access forbidden'): AppError {
    return new AppError(message, {
      code: ErrorCode.AUTH_FORBIDDEN,
      userMessage: 'You do not have permission to access this resource',
    })
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError(`${resource} not found`, {
      code: ErrorCode.RECORD_NOT_FOUND,
      userMessage: `${resource} not found`,
    })
  }

  static validation(message: string, details?: Record<string, any>): AppError {
    return new AppError(message, {
      code: ErrorCode.VALIDATION_ERROR,
      userMessage: 'Please check your input and try again',
      details,
    })
  }

  static rateLimit(retryAfter?: number): AppError {
    return new AppError('Rate limit exceeded', {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      userMessage: 'Too many requests. Please try again later',
      details: retryAfter ? { retryAfter } : undefined,
    })
  }

  static fileTooLarge(maxSize: number): AppError {
    return new AppError(`File exceeds maximum size of ${maxSize} bytes`, {
      code: ErrorCode.FILE_TOO_LARGE,
      userMessage: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`,
      details: { maxSize },
    })
  }

  static invalidFileType(allowedTypes: string[]): AppError {
    return new AppError('Invalid file type', {
      code: ErrorCode.INVALID_FILE_TYPE,
      userMessage: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      details: { allowedTypes },
    })
  }

  static apiError(service: string, originalError?: Error): AppError {
    return new AppError(`${service} API error`, {
      code: ErrorCode.API_ERROR,
      userMessage: 'External service error. Please try again',
      cause: originalError,
      details: { service },
    })
  }

  static database(operation: string, originalError?: Error): AppError {
    return new AppError(`Database ${operation} failed`, {
      code: ErrorCode.DB_ERROR,
      userMessage: 'A database error occurred',
      cause: originalError,
      isOperational: false,
    })
  }

  static internal(message: string, originalError?: Error): AppError {
    return new AppError(message, {
      code: ErrorCode.INTERNAL_ERROR,
      userMessage: 'An internal error occurred',
      cause: originalError,
      isOperational: false,
    })
  }

  static insecureApiKeyUsage(details?: Record<string, any>): AppError {
    return new AppError('Insecure API key usage detected', {
      code: ErrorCode.INSECURE_API_KEY_USAGE,
      userMessage: 'API keys must be sent in headers (X-API-Key or Authorization: Bearer), not in URL query parameters',
      details,
    })
  }
}

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase()
    
    if (message.includes('auth') || message.includes('unauthorized')) {
      return ErrorFactory.authRequired(error.message)
    }
    
    if (message.includes('not found')) {
      return ErrorFactory.notFound()
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorFactory.validation(error.message)
    }
    
    if (message.includes('rate limit')) {
      return ErrorFactory.rateLimit()
    }
    
    // Default to internal error
    return ErrorFactory.internal(error.message, error)
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return new AppError(error)
  }
  
  // Handle unknown errors
  return ErrorFactory.internal('Unknown error occurred')
}