import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { ErrorSanitizer } from './error-sanitizer';
import { SecureLogger } from './error-logger';
import { AppError, ErrorCode, toAppError } from './error-types';

export interface APIError extends Error {
  statusCode: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class APIErrorHandler {
  static createError(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any
  ): APIError {
    const error = new Error(message) as APIError;
    error.statusCode = statusCode;
    error.code = code;
    error.details = details;
    error.isOperational = true;
    return error;
  }

  static logError(error: APIError | Error, context?: Record<string, any>) {
    // Capture to Sentry with context
    Sentry.captureException(error, {
      tags: {
        type: 'api_error',
        operational: (error as APIError).isOperational ? 'true' : 'false',
      },
      extra: {
        ...context,
        statusCode: (error as APIError).statusCode,
        code: (error as APIError).code,
        details: (error as APIError).details,
      },
    });

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        message: error.message,
        statusCode: (error as APIError).statusCode,
        code: (error as APIError).code,
        details: (error as APIError).details,
        stack: error.stack,
        context,
      });
    }
  }

  static handleResponse(error: APIError | Error, requestId?: string) {
    // Convert to AppError if needed
    const appError = toAppError(error);
    
    // Log the error securely
    const correlationId = SecureLogger.logError(appError, { requestId });
    
    // Create sanitized response
    const sanitizedResponse = ErrorSanitizer.forResponse(appError, requestId);
    
    // Add correlation ID for debugging
    if (sanitizedResponse.error) {
      sanitizedResponse.error.correlationId = correlationId;
    }

    const statusCode = appError.statusCode || (error as APIError).statusCode || 500;
    
    // Handle rate limit headers
    const headers: Record<string, string> = {};
    if (appError.code === ErrorCode.RATE_LIMIT_EXCEEDED && appError.details?.retryAfter) {
      headers['Retry-After'] = String(appError.details.retryAfter);
    }

    return NextResponse.json(sanitizedResponse, { 
      status: statusCode,
      headers 
    });
  }
}

// Error types for categorization
export const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_PROCESSING_ERROR: 'FILE_PROCESSING_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// Common API errors
export class ValidationError extends APIErrorHandler {
  static create(message: string, details?: any) {
    return this.createError(message, 400, ErrorTypes.VALIDATION_ERROR, details);
  }
}

export class AuthenticationError extends APIErrorHandler {
  static create(message: string = 'Authentication required') {
    return this.createError(message, 401, ErrorTypes.AUTHENTICATION_ERROR);
  }
}

export class AuthorizationError extends APIErrorHandler {
  static create(message: string = 'Insufficient permissions') {
    return this.createError(message, 403, ErrorTypes.AUTHORIZATION_ERROR);
  }
}

export class NotFoundError extends APIErrorHandler {
  static create(resource: string) {
    return this.createError(`${resource} not found`, 404, ErrorTypes.NOT_FOUND);
  }
}

export class ConflictError extends APIErrorHandler {
  static create(message: string) {
    return this.createError(message, 409, ErrorTypes.CONFLICT);
  }
}

export class RateLimitError extends APIErrorHandler {
  static create(message: string = 'Too many requests') {
    return this.createError(message, 429, ErrorTypes.RATE_LIMIT);
  }
}

export class ExternalServiceError extends APIErrorHandler {
  static create(service: string, originalError?: Error) {
    return this.createError(
      `External service error: ${service}`,
      502,
      ErrorTypes.EXTERNAL_SERVICE_ERROR,
      { service, originalError: originalError?.message }
    );
  }
}

export class DatabaseError extends APIErrorHandler {
  static create(operation: string, originalError?: Error) {
    return this.createError(
      'Database operation failed',
      500,
      ErrorTypes.DATABASE_ERROR,
      { operation, originalError: originalError?.message }
    );
  }
}

export class FileProcessingError extends APIErrorHandler {
  static create(message: string, details?: any) {
    return this.createError(
      message,
      422,
      ErrorTypes.FILE_PROCESSING_ERROR,
      details
    );
  }
}

export class AIServiceError extends APIErrorHandler {
  static create(model: string, originalError?: Error) {
    return this.createError(
      'AI service temporarily unavailable',
      503,
      ErrorTypes.AI_SERVICE_ERROR,
      { model, originalError: originalError?.message }
    );
  }
}