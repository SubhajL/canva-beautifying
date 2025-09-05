import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger, requestContext } from './logger';
import { randomBytes } from 'crypto';

export function withLogging(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || randomBytes(16).toString('hex');
  const startTime = Date.now();

  // Extract context from request
  const context = {
    requestId,
    path: request.nextUrl.pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
  };

  // Log incoming request
  logger.withContext(context, () => {
    logger.info({
      type: 'http_request_started',
      method: request.method,
      path: request.nextUrl.pathname,
      query: Object.fromEntries(request.nextUrl.searchParams),
    }, 'Incoming request');
  });

  // Add request ID to response headers
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);

  // Log response (Note: In middleware we can't get the actual status code)
  const responseTime = Date.now() - startTime;
  logger.withContext(context, () => {
    logger.info({
      type: 'http_request_completed',
      method: request.method,
      path: request.nextUrl.pathname,
      responseTime,
    }, 'Request completed');
  });

  return response;
}

// Helper to wrap API routes with logging context
export function withApiLogging<T extends (...args: any[]) => any>(
  handler: T
): T {
  return (async (req: any, ...args: any[]) => {
    const requestId = req.headers?.['x-request-id'] || randomBytes(16).toString('hex');
    const startTime = Date.now();

    const context = {
      requestId,
      path: req.url,
      method: req.method,
      userAgent: req.headers?.['user-agent'],
      ip: req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'],
    };

    return logger.withContext(context, async () => {
      try {
        logger.info({
          type: 'api_handler_started',
          method: req.method,
          path: req.url,
        }, 'API handler started');

        const result = await handler(req, ...args);

        const responseTime = Date.now() - startTime;
        logger.info({
          type: 'api_handler_completed',
          method: req.method,
          path: req.url,
          responseTime,
        }, 'API handler completed');

        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error({
          type: 'api_handler_error',
          method: req.method,
          path: req.url,
          responseTime,
          err: error,
        }, 'API handler error');

        throw error;
      }
    });
  }) as T;
}

// Helper to get current request context
export function getCurrentContext() {
  return requestContext.getStore();
}