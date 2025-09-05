import { NextResponse } from 'next/server'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    timestamp: string
    version: string
    requestId?: string
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const apiErrorConstants = {
  // Authentication errors
  UNAUTHORIZED: new ApiError('UNAUTHORIZED', 'Authentication required', 401),
  INVALID_TOKEN: new ApiError('INVALID_TOKEN', 'Invalid or expired token', 401),
  TOKEN_EXPIRED: new ApiError('TOKEN_EXPIRED', 'Token has expired', 401),
  INSUFFICIENT_PERMISSIONS: new ApiError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions', 403),
  INSECURE_API_KEY_USAGE: new ApiError('INSECURE_API_KEY_USAGE', 'API keys must be sent in headers, not query parameters', 400),
  
  // Validation errors
  INVALID_REQUEST: new ApiError('INVALID_REQUEST', 'Invalid request data', 400),
  MISSING_REQUIRED_FIELD: new ApiError('MISSING_REQUIRED_FIELD', 'Missing required field', 400),
  INVALID_FILE_TYPE: new ApiError('INVALID_FILE_TYPE', 'Invalid file type', 400),
  FILE_TOO_LARGE: new ApiError('FILE_TOO_LARGE', 'File size exceeds limit', 400),
  
  // Resource errors
  NOT_FOUND: new ApiError('NOT_FOUND', 'Resource not found', 404),
  ALREADY_EXISTS: new ApiError('ALREADY_EXISTS', 'Resource already exists', 409),
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: new ApiError('RATE_LIMIT_EXCEEDED', 'Too many requests', 429),
  QUOTA_EXCEEDED: new ApiError('QUOTA_EXCEEDED', 'Monthly quota exceeded', 429),
  
  // Processing errors
  ENHANCEMENT_FAILED: new ApiError('ENHANCEMENT_FAILED', 'Enhancement processing failed', 500),
  QUEUE_ERROR: new ApiError('QUEUE_ERROR', 'Failed to queue enhancement', 500),
  
  // Generic errors
  INTERNAL_ERROR: new ApiError('INTERNAL_ERROR', 'Internal server error', 500),
  SERVICE_UNAVAILABLE: new ApiError('SERVICE_UNAVAILABLE', 'Service temporarily unavailable', 503),
}

export function successResponse<T>(data: T, meta?: Partial<ApiResponse['meta']>): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
      ...meta,
    },
  })
}

export function errorResponse(error: ApiError | Error, requestId?: string): NextResponse<ApiResponse> {
  const isApiError = error instanceof ApiError
  
  const response: ApiResponse = {
    success: false,
    error: {
      code: isApiError ? error.code : 'INTERNAL_ERROR',
      message: isApiError ? error.message : 'An unexpected error occurred',
      details: isApiError ? error.details : undefined,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
      requestId,
    },
  }
  
  const statusCode = isApiError ? error.statusCode : 500
  
  // Log error for debugging
  if (statusCode >= 500) {
    console.error('API Error:', error)
  }
  
  return NextResponse.json(response, { status: statusCode })
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  totalItems: number,
  meta?: Partial<ApiResponse['meta']>
): NextResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(totalItems / pageSize)
  
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
      ...meta,
    },
  })
}

// Helper functions for common error responses
export const apiErrorFunctions = {
  badRequest: (message: string, details?: any) => 
    new ApiError('BAD_REQUEST', message, 400, details),
  
  unauthorized: (message: string = 'Authentication required') => 
    new ApiError('UNAUTHORIZED', message, 401),
  
  forbidden: (message: string = 'Insufficient permissions') => 
    new ApiError('FORBIDDEN', message, 403),
  
  notFound: (message: string = 'Resource not found') => 
    new ApiError('NOT_FOUND', message, 404),
  
  tooManyRequests: (message: string = 'Rate limit exceeded') => 
    new ApiError('TOO_MANY_REQUESTS', message, 429),
  
  internalServerError: (message: string = 'An unexpected error occurred') => 
    new ApiError('INTERNAL_ERROR', message, 500),
}

// Alias for backward compatibility
export { apiErrorFunctions as apiErrors }

// Create API response helper
export function createAPIResponse<T>(
  data: T | null,
  error?: ApiError | Error | null,
  meta?: Partial<ApiResponse['meta']>
): NextResponse<ApiResponse<T>> {
  if (error) {
    return errorResponse(error, meta?.requestId)
  }
  
  return successResponse(data, meta)
}