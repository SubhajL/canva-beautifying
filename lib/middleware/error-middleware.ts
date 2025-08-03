import { NextRequest, NextResponse } from 'next/server';
import { APIErrorHandler } from '@/lib/utils/api-error-handler';
import { v4 as uuidv4 } from 'uuid';

export async function withErrorHandling(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  const requestId = uuidv4();
  
  try {
    // Add request ID to headers
    const response = await handler(request);
    response.headers.set('X-Request-ID', requestId);
    return response;
  } catch (error) {
    // Handle the error using our error handler
    return APIErrorHandler.handleResponse(error as Error, requestId);
  }
}

// Async wrapper for API routes
export function asyncHandler<T = Record<string, unknown>>(
  fn: (req: NextRequest, params?: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, params?: T) => {
    return withErrorHandling(req, () => fn(req, params));
  };
}