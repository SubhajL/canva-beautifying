import { 
  context,
  trace,
  Context,
  Span,
  SpanContext,
  TraceFlags,
  TextMapGetter,
  TextMapSetter,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// Initialize W3C Trace Context propagator (singleton)
let w3cPropagator: W3CTraceContextPropagator;

function getPropagator(): W3CTraceContextPropagator {
  if (!w3cPropagator) {
    w3cPropagator = new W3CTraceContextPropagator();
  }
  return w3cPropagator;
}

/**
 * Headers getter for extracting context
 */
const headersGetter: TextMapGetter<Record<string, string>> = {
  keys: (carrier) => Object.keys(carrier),
  get: (carrier, key) => carrier[key],
};

/**
 * Headers setter for injecting context
 */
const headersSetter: TextMapSetter<Record<string, string>> = {
  set: (carrier, key, value) => {
    carrier[key] = value;
  },
};

/**
 * Extract trace context from incoming headers
 */
export function extractContext(headers: Headers | Record<string, string>): Context {
  // Convert Headers to plain object if needed
  const carrier: Record<string, string> = {};
  
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      carrier[key.toLowerCase()] = value;
    });
  } else {
    Object.entries(headers).forEach(([key, value]) => {
      carrier[key.toLowerCase()] = value;
    });
  }

  // Extract context using W3C propagator
  return getPropagator().extract(context.active(), carrier, headersGetter);
}

/**
 * Inject current trace context into outgoing headers
 */
export function propagateContext(headers: Headers | Record<string, string>): void {
  const activeContext = context.active();
  const span = trace.getActiveSpan();
  
  if (!span) {
    return;
  }

  // Convert Headers to plain object if needed
  let carrier: Record<string, string>;
  
  if (headers instanceof Headers) {
    carrier = {};
    getPropagator().inject(activeContext, carrier, headersSetter);
    
    // Add headers to Headers object
    Object.entries(carrier).forEach(([key, value]) => {
      headers.set(key, value);
    });
  } else {
    // Inject directly into object
    getPropagator().inject(activeContext, headers, headersSetter);
  }
}

/**
 * Execute a function within a span context
 */
export function withSpan<T>(span: Span, fn: () => T): T {
  return context.with(trace.setSpan(context.active(), span), fn);
}

/**
 * Execute an async function within a span context
 */
export async function withSpanAsync<T>(
  span: Span, 
  fn: () => Promise<T>
): Promise<T> {
  return context.with(trace.setSpan(context.active(), span), fn);
}

/**
 * Get the currently active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Create a child span from the current context
 */
export function createChildSpan(name: string, parentSpan?: Span): Span {
  const tracer = trace.getTracer('default');
  const parent = parentSpan || getCurrentSpan();
  
  if (parent) {
    const ctx = trace.setSpan(context.active(), parent);
    return tracer.startSpan(name, undefined, ctx);
  }
  
  return tracer.startSpan(name);
}

/**
 * Get trace headers from current context
 */
export function getTraceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const activeContext = context.active();
  const span = trace.getActiveSpan();
  
  if (span) {
    getPropagator().inject(activeContext, headers, headersSetter);
  }
  
  return headers;
}

/**
 * Create a detached context with trace information
 */
export function createDetachedContext(
  traceId: string,
  spanId: string,
  traceFlags: TraceFlags = TraceFlags.SAMPLED
): Context {
  const spanContext: SpanContext = {
    traceId,
    spanId,
    traceFlags,
    isRemote: true,
  };

  // Create a non-recording span with the context
  const span = trace.wrapSpanContext(spanContext);
  return trace.setSpan(context.active(), span);
}

/**
 * Enhanced fetch with automatic trace propagation
 */
export async function tracedFetch(
  url: string, 
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers);
  
  // Propagate trace context
  propagateContext(headers);
  
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Create a trace context carrier for async jobs
 */
export function createTraceCarrier(): Record<string, string> {
  const carrier: Record<string, string> = {};
  const activeContext = context.active();
  const span = trace.getActiveSpan();
  
  if (span) {
    getPropagator().inject(activeContext, carrier, headersSetter);
  }
  
  return carrier;
}

/**
 * Restore context from a trace carrier
 */
export function restoreFromCarrier(
  carrier: Record<string, string>, 
  fn: () => void
): void {
  const restoredContext = getPropagator().extract(
    context.active(), 
    carrier, 
    headersGetter
  );
  
  context.with(restoredContext, fn);
}

/**
 * Format trace parent header manually
 */
export function formatTraceParent(spanContext: SpanContext): string {
  const version = '00';
  const traceFlags = spanContext.traceFlags.toString(16).padStart(2, '0');
  return `${version}-${spanContext.traceId}-${spanContext.spanId}-${traceFlags}`;
}

/**
 * Parse trace parent header
 */
export function parseTraceParent(traceParent: string): SpanContext | null {
  const parts = traceParent.split('-');
  
  if (parts.length !== 4) {
    return null;
  }
  
  const [version, traceId, spanId, traceFlagsHex] = parts;
  
  if (version !== '00') {
    return null;
  }
  
  // Validate trace flags is a valid hex string
  const traceFlags = parseInt(traceFlagsHex, 16);
  if (isNaN(traceFlags)) {
    return null;
  }
  
  return {
    traceId,
    spanId,
    traceFlags,
    isRemote: true,
  };
}