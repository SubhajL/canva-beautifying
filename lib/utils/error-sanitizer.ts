/**
 * Error Sanitizer
 * Removes sensitive information from errors based on environment
 */

export interface SanitizeOptions {
  includeStack?: boolean
  includeDetails?: boolean
  includeContext?: boolean
}

export interface SanitizedError {
  code: string
  message: string
  userMessage: string
  stack?: string
  details?: Record<string, any>
  timestamp: string
  requestId?: string
}

export class ErrorSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    // API Keys
    /sk-[a-zA-Z0-9]{20,}/g,
    /sk-ant-[a-zA-Z0-9]{20,}/g,
    /AI[a-zA-Z0-9]{35,}/g,
    /r8_[a-zA-Z0-9]{37}/g,
    /Bearer [a-zA-Z0-9-_]+/g,
    /Token [a-zA-Z0-9-_]+/g,
    
    // Generic API keys and secrets
    /api[_-]?key[=:\s]+[a-zA-Z0-9-_]+/gi,
    /secret[=:\s]+[a-zA-Z0-9-_]+/gi,
    /password[=:\s]+[a-zA-Z0-9-_]+/gi,
    /token[=:\s]+[a-zA-Z0-9-_]+/gi,
    /auth[=:\s]+[a-zA-Z0-9-_]+/gi,
    
    // Database connection strings
    /postgres:\/\/[^@]+@[^/]+/g,
    /mysql:\/\/[^@]+@[^/]+/g,
    /mongodb:\/\/[^@]+@[^/]+/g,
    /redis:\/\/[^@]+@[^/]+/g,
    
    // File paths (in production)
    /\/Users\/[^/]+/g,
    /\/home\/[^/]+/g,
    /C:\\Users\\[^\\]+/g,
    /\/var\/[^/]+/g,
    
    // IP addresses (optional, be careful with this)
    /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    
    // Email addresses
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    
    // Credit card patterns (just in case)
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    /\b\d{3,4}[\s-]?\d{6}[\s-]?\d{5}\b/g,
  ]

  /**
   * Sanitize error message by removing sensitive information
   */
  private static sanitizeMessage(message: string): string {
    let sanitized = message
    
    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]')
    }
    
    return sanitized
  }

  /**
   * Sanitize stack trace
   */
  private static sanitizeStack(stack: string | undefined): string | undefined {
    if (!stack) return undefined
    
    // In production, remove file paths and internal details
    if (process.env.NODE_ENV === 'production') {
      return stack
        .split('\n')
        .map(line => {
          // Remove absolute file paths
          line = line.replace(/\sat\s.*\((.+)\)/g, ' at [REDACTED]')
          line = line.replace(/\sat\s(.+):\d+:\d+/g, ' at [REDACTED]')
          
          // Remove sensitive data from the line
          return this.sanitizeMessage(line)
        })
        .filter(line => !line.includes('node_modules'))
        .join('\n')
    }
    
    // In development, sanitize sensitive data but keep paths
    return stack
      .split('\n')
      .map(line => this.sanitizeMessage(line))
      .join('\n')
  }

  /**
   * Sanitize error details object
   */
  private static sanitizeDetails(details: any): any {
    if (!details) return undefined
    
    if (typeof details === 'string') {
      return this.sanitizeMessage(details)
    }
    
    if (Array.isArray(details)) {
      return details.map(item => this.sanitizeDetails(item))
    }
    
    if (typeof details === 'object' && details !== null) {
      const sanitized: Record<string, any> = {}
      
      for (const [key, value] of Object.entries(details)) {
        // Skip certain keys entirely in production
        if (process.env.NODE_ENV === 'production') {
          const skipKeys = ['stack', 'stacktrace', 'env', 'process', 'config']
          if (skipKeys.includes(key.toLowerCase())) {
            continue
          }
        }
        
        // Don't sanitize the key name itself, just the value
        // Recursively sanitize the value
        sanitized[key] = this.sanitizeDetails(value)
      }
      
      return sanitized
    }
    
    return details
  }

  /**
   * Main sanitize function
   */
  static sanitize(
    error: unknown,
    options: SanitizeOptions = {}
  ): SanitizedError {
    const {
      includeStack = process.env.NODE_ENV !== 'production',
      includeDetails = process.env.NODE_ENV !== 'production',
      includeContext = true,
    } = options

    // Handle different error types
    if (error instanceof Error) {
      const sanitizedMessage = this.sanitizeMessage(error.message)
      
      // Extract error code if available
      const errorCode = (error as any).code || 'UNKNOWN_ERROR'
      
      // Generate user-friendly message
      const userMessage = this.getUserMessage(errorCode, error)
      
      const sanitized: SanitizedError = {
        code: errorCode,
        message: sanitizedMessage,
        userMessage,
        timestamp: new Date().toISOString(),
      }
      
      if (includeStack && error.stack) {
        sanitized.stack = this.sanitizeStack(error.stack)
      }
      
      if (includeDetails) {
        const details: Record<string, any> = {}
        
        // Extract additional properties from error
        for (const key in error) {
          if (key !== 'message' && key !== 'stack' && key !== 'name') {
            details[key] = (error as any)[key]
          }
        }
        
        if (Object.keys(details).length > 0) {
          sanitized.details = this.sanitizeDetails(details)
        }
      }
      
      return sanitized
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        code: 'STRING_ERROR',
        message: this.sanitizeMessage(error),
        userMessage: 'An error occurred',
        timestamp: new Date().toISOString(),
      }
    }

    // Handle object errors
    if (typeof error === 'object' && error !== null) {
      const message = (error as any).message || JSON.stringify(error)
      return {
        code: (error as any).code || 'OBJECT_ERROR',
        message: this.sanitizeMessage(message),
        userMessage: 'An error occurred',
        details: includeDetails ? this.sanitizeDetails(error) : undefined,
        timestamp: new Date().toISOString(),
      }
    }

    // Fallback for unknown error types
    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred',
      userMessage: 'An unexpected error occurred. Please try again.',
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Get user-friendly error message based on error code
   */
  private static getUserMessage(code: string, error: Error): string {
    const errorMessages: Record<string, string> = {
      // Authentication errors
      'AUTH_REQUIRED': 'Please sign in to continue',
      'AUTH_INVALID': 'Invalid credentials provided',
      'AUTH_EXPIRED': 'Your session has expired. Please sign in again',
      'AUTH_FORBIDDEN': 'You do not have permission to access this resource',
      
      // Validation errors
      'VALIDATION_ERROR': 'Please check your input and try again',
      'INVALID_REQUEST': 'Invalid request format',
      'MISSING_REQUIRED_FIELD': 'Required information is missing',
      
      // Rate limiting
      'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later',
      
      // File errors
      'FILE_TOO_LARGE': 'File size exceeds the maximum allowed',
      'INVALID_FILE_TYPE': 'File type not supported',
      'FILE_UPLOAD_FAILED': 'Failed to upload file. Please try again',
      
      // API errors
      'API_ERROR': 'External service error. Please try again',
      'TIMEOUT': 'Request timed out. Please try again',
      'SERVICE_UNAVAILABLE': 'Service temporarily unavailable',
      
      // Database errors
      'DB_ERROR': 'A database error occurred',
      'NOT_FOUND': 'Requested resource not found',
      'ALREADY_EXISTS': 'Resource already exists',
      
      // Generic errors
      'INTERNAL_ERROR': 'An internal error occurred. Please try again',
      'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again',
    }

    // Check if we have a specific message for this code
    if (errorMessages[code]) {
      return errorMessages[code]
    }

    // Try to extract a user-friendly message from the error
    const message = error.message.toLowerCase()
    
    if (message.includes('auth') || message.includes('permission')) {
      return 'Authentication error. Please check your credentials'
    }
    
    if (message.includes('not found')) {
      return 'Resource not found'
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return 'Invalid input provided'
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return 'Network error. Please check your connection'
    }
    
    // Default message
    return 'An error occurred. Please try again'
  }

  /**
   * Check if error contains sensitive information
   */
  static containsSensitiveInfo(text: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(text))
  }

  /**
   * Create a safe error for logging
   */
  static forLogging(error: unknown): Record<string, any> {
    const sanitized = this.sanitize(error, {
      includeStack: true,
      includeDetails: true,
      includeContext: true,
    })
    
    // Add additional logging context
    return {
      code: sanitized.code,
      message: sanitized.message,
      userMessage: sanitized.userMessage,
      timestamp: sanitized.timestamp,
      ...(sanitized.stack && { stack: sanitized.stack }),
      ...(sanitized.details && { details: sanitized.details }),
      environment: process.env.NODE_ENV,
      nodeVersion: process.version,
    }
  }

  /**
   * Create a safe error for API responses
   */
  static forResponse(error: unknown, requestId?: string): Record<string, any> {
    const sanitized = this.sanitize(error, {
      includeStack: false,
      includeDetails: false,
      includeContext: false,
    })
    
    return {
      error: {
        code: sanitized.code,
        message: sanitized.userMessage,
        timestamp: sanitized.timestamp,
        ...(requestId && { requestId }),
      },
    }
  }
}

export default ErrorSanitizer