import { NextRequest, NextResponse } from 'next/server';
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { extractContext, propagateContext } from '../context-propagation';
import { logger } from '../logger';

// Middleware configuration
const config = {
  excludePatterns: [
    /^\/_next\/static/,
    /^\/favicon\.ico/,
    /^\/robots\.txt/,
    /^\/sitemap\.xml/,
    /^\/api\/health/,
    /^\/api\/metrics/,
  ],
  includeQueryParams: ['page', 'filter', 'sort', 'search'],
  maskSensitiveHeaders: ['authorization', 'cookie', 'x-api-key'],
};

/**
 * Get default status text for HTTP status codes
 */
function getDefaultStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  
  return statusTexts[status] || 'Unknown Error';
}

/**
 * Next.js middleware for distributed tracing
 */
export async function tracingMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  // Check if request should be traced
  const shouldTrace = !config.excludePatterns.some(pattern => 
    pattern.test(request.nextUrl.pathname)
  );
  
  if (!shouldTrace) {
    return handler();
  }

  // Extract trace context from incoming headers
  const incomingHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    incomingHeaders[key] = value;
  });
  
  const extractedContext = extractContext(incomingHeaders);
  const tracer = trace.getTracer('http', '1.0.0');
  
  // Start span with extracted context
  const spanName = `${request.method} ${request.nextUrl.pathname}`;
  const span = tracer.startSpan(
    spanName,
    {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.target': request.nextUrl.pathname,
        'http.host': request.headers.get('host') || 'unknown',
        'http.scheme': request.nextUrl.protocol.replace(':', ''),
        'http.user_agent': request.headers.get('user-agent') || 'unknown',
        'net.peer.ip': request.ip || 'unknown',
      },
    },
    extractedContext
  );

  // Add additional attributes
  const attributes: Record<string, string | number | boolean> = {
    'app.route': request.nextUrl.pathname,
    'app.locale': request.headers.get('accept-language')?.split(',')[0] || 'unknown',
  };

  // Add selected query parameters
  config.includeQueryParams.forEach(param => {
    const value = request.nextUrl.searchParams.get(param);
    if (value) {
      attributes[`http.query.${param}`] = value;
    }
  });

  // Add safe headers
  request.headers.forEach((value, key) => {
    if (!config.maskSensitiveHeaders.includes(key.toLowerCase())) {
      attributes[`http.header.${key}`] = value;
    }
  });

  span.setAttributes(attributes);

  // Add event for request start
  span.addEvent('request.start', {
    timestamp: Date.now(),
    method: request.method,
    path: request.nextUrl.pathname,
  });

  try {
    // Execute handler within span context
    const response = await context.with(
      trace.setSpan(context.active(), span),
      handler
    );

    // Set response attributes
    span.setAttributes({
      'http.status_code': response.status,
      'http.status_text': response.statusText || '',
      'http.response.size': response.headers.get('content-length') || '0',
    });

    // Set span status based on HTTP status
    if (response.status >= 400) {
      const statusText = response.statusText || getDefaultStatusText(response.status);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${response.status}: ${statusText}`,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Add response event
    span.addEvent('request.complete', {
      timestamp: Date.now(),
      status: response.status,
      contentType: response.headers.get('content-type') || 'unknown',
    });

    // Propagate trace context to response
    const responseHeaders = new Headers(response.headers);
    propagateContext(responseHeaders);
    
    // Clone response with new headers
    const modifiedResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

    return modifiedResponse;
  } catch (error) {
    // Record exception
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    
    // Add error event
    span.addEvent('request.error', {
      timestamp: Date.now(),
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    // Log error
    logger.error({
      err: error as Error,
      spanId: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
    }, 'Request failed with error');

    throw error;
  } finally {
    // End span
    span.end();
  }
}

/**
 * Create a traced API route handler
 */
export function withTracing<T extends (...args: unknown[]) => Promise<unknown>>(
  handler: T,
  options?: {
    name?: string;
    attributes?: Record<string, string | number | boolean>;
  }
): T {
  return (async (...args: unknown[]) => {
    const tracer = trace.getTracer('api', '1.0.0');
    const span = tracer.startSpan(options?.name || handler.name || 'api-handler', {
      kind: SpanKind.SERVER,
      attributes: options?.attributes,
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        () => handler(...args)
      );
      
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      throw error;
    } finally {
      span.end();
    }
  }) as T;
}

/**
 * Trace a Next.js API route
 */
export function traceAPIRoute(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return tracingMiddleware(req, () => handler(req));
}

/**
 * Extract trace ID from request for logging
 */
export function getTraceIdFromRequest(request: NextRequest): string | undefined {
  const traceparent = request.headers.get('traceparent');
  if (!traceparent) {
    return undefined;
  }
  
  // Extract trace ID from W3C trace context header
  const parts = traceparent.split('-');
  return parts.length >= 2 ? parts[1] : undefined;
}

/**
 * Add trace context to fetch requests in API routes
 */
export function tracedAPIFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers);
  
  // Get current span and propagate context
  const span = trace.getActiveSpan();
  if (span) {
    propagateContext(headers);
    
    // Add custom headers
    headers.set('x-trace-id', span.spanContext().traceId);
    headers.set('x-parent-span-id', span.spanContext().spanId);
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
}