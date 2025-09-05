// This module is for server-side use only
if (typeof window !== 'undefined') {
  throw new Error(
    'Server-only module: @/lib/observability/tracing cannot be imported in client-side code. ' +
    'Use @/lib/observability/client instead.'
  );
}

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
// @ts-ignore - Resource import may have issues in some environments
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { 
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { 
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  Span,
  SpanAttributes,
  Context,
  propagation,
  defaultTextMapSetter,
  defaultTextMapGetter,
  ROOT_CONTEXT,
} from '@opentelemetry/api';
import { logger } from './logger';

// Global tracer instance
let tracerProvider: NodeTracerProvider | null = null;

// Configuration
const config = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'beautifyai',
  serviceVersion: process.env.npm_package_version || '0.1.0',
  environment: process.env.NODE_ENV || 'development',
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  enableConsoleExporter: process.env.OTEL_LOG_LEVEL === 'debug',
};

/**
 * Initialize OpenTelemetry tracing
 */
export async function initializeTracing(): Promise<void> {
  if (tracerProvider) {
    logger.warn('Tracing already initialized');
    return;
  }

  try {
    // Create resource with service information
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
      [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.DYNO || process.pid.toString(),
      [SemanticResourceAttributes.HOST_NAME]: process.env.HOSTNAME || 'localhost',
      [SemanticResourceAttributes.PROCESS_PID]: process.pid,
    });

    // Create tracer provider
    tracerProvider = new NodeTracerProvider({
      resource,
    });

    // Configure OTLP exporter
    const otlpExporter = new OTLPTraceExporter({
      url: `${config.otlpEndpoint}/v1/traces`,
      headers: {},
    });

    // Add span processors
    if (config.environment === 'production') {
      // Use batch processor in production for better performance
      tracerProvider.addSpanProcessor(
        new BatchSpanProcessor(otlpExporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
        })
      );
    } else {
      // Use simple processor in development for immediate export
      tracerProvider.addSpanProcessor(new SimpleSpanProcessor(otlpExporter));
      
      // Optionally add console exporter for debugging
      if (config.enableConsoleExporter) {
        tracerProvider.addSpanProcessor(
          new SimpleSpanProcessor(new ConsoleSpanExporter())
        );
      }
    }

    // Register the tracer provider globally
    tracerProvider.register();

    logger.info({
      service: config.serviceName,
      version: config.serviceVersion,
      environment: config.environment,
      otlpEndpoint: config.otlpEndpoint,
    }, 'OpenTelemetry tracing initialized');
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize OpenTelemetry tracing');
    throw error;
  }
}

/**
 * Shutdown tracing gracefully
 */
export async function shutdownTracing(): Promise<void> {
  if (tracerProvider) {
    await tracerProvider.shutdown();
    tracerProvider = null;
    logger.info('OpenTelemetry tracing shut down');
  }
}

/**
 * Get a tracer instance
 */
export function getTracer(name: string = 'default') {
  return trace.getTracer(name, config.serviceVersion);
}

/**
 * Create a new span with consistent naming and attributes
 */
export function createSpan(
  name: string,
  options?: {
    kind?: SpanKind;
    attributes?: SpanAttributes;
    context?: Context;
  }
): Span {
  const tracer = getTracer();
  const ctx = options?.context || context.active();
  
  return tracer.startSpan(
    name,
    {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: {
        'service.name': config.serviceName,
        'service.environment': config.environment,
        ...options?.attributes,
      },
    },
    ctx
  );
}

/**
 * Trace an async operation automatically
 */
export async function traceAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: {
    kind?: SpanKind;
    attributes?: SpanAttributes;
    recordException?: boolean;
  }
): Promise<T> {
  const span = createSpan(name, {
    kind: options?.kind,
    attributes: options?.attributes,
  });

  try {
    // Execute function with span in context
    const result = await context.with(
      trace.setSpan(context.active(), span),
      () => fn(span)
    );

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    // Record exception on span
    if (options?.recordException !== false) {
      span.recordException(error as Error);
    }
    
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(
  name: string,
  attributes?: SpanAttributes
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current span
 */
export function setSpanAttributes(attributes: SpanAttributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Get the current trace ID
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    return spanContext.traceId;
  }
  return undefined;
}

/**
 * Get the current span ID
 */
export function getCurrentSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    return spanContext.spanId;
  }
  return undefined;
}

// Enhancement Pipeline Tracing

/**
 * Create a trace context for enhancement pipeline
 */
export function createEnhancementTrace(
  documentId: string,
  userId: string,
  enhancementSettings?: Record<string, any>
): { span: Span; traceId: string; spanId: string; context: Context } {
  const span = createSpan('enhancement.pipeline', {
    kind: SpanKind.SERVER,
    attributes: {
      'enhancement.document_id': documentId,
      'enhancement.user_id': userId,
      'enhancement.settings': JSON.stringify(enhancementSettings || {}),
      'enhancement.start_time': new Date().toISOString(),
    },
  });

  const spanContext = span.spanContext();
  const ctx = trace.setSpan(context.active(), span);

  return {
    span,
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    context: ctx,
  };
}

/**
 * Extract trace context from various sources (headers, job data, etc.)
 */
export function extractTraceContext(
  source: Record<string, any>
): Context | undefined {
  // Try to extract from W3C Trace Context headers
  if (source.traceparent || source['x-trace-id']) {
    const carrier: Record<string, string> = {};
    
    // W3C format
    if (source.traceparent) {
      carrier.traceparent = source.traceparent;
      if (source.tracestate) {
        carrier.tracestate = source.tracestate;
      }
    }
    
    // Legacy format
    if (source['x-trace-id'] && source['x-span-id']) {
      // Convert to W3C format
      const version = '00';
      const traceId = source['x-trace-id'];
      const spanId = source['x-span-id'];
      const flags = source['x-trace-flags'] || '01';
      carrier.traceparent = `${version}-${traceId}-${spanId}-${flags}`;
    }

    return propagation.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter);
  }

  // Try to extract from job data
  if (source.traceContext) {
    return propagation.extract(ROOT_CONTEXT, source.traceContext, defaultTextMapGetter);
  }

  return undefined;
}

/**
 * Inject trace context for propagation
 */
export function injectTraceContext(
  carrier: Record<string, any> = {}
): Record<string, any> {
  const ctx = context.active();
  propagation.inject(ctx, carrier, defaultTextMapSetter);
  
  // Also add simplified format for easier access
  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    carrier['x-trace-id'] = spanContext.traceId;
    carrier['x-span-id'] = spanContext.spanId;
    carrier['x-trace-flags'] = spanContext.traceFlags.toString();
  }
  
  return carrier;
}

/**
 * Create a span for a specific pipeline stage
 */
export function createPipelineStageSpan(
  stage: 'upload' | 'analysis' | 'planning' | 'generation' | 'composition' | 'export',
  attributes?: SpanAttributes
): Span {
  const stageAttributes: SpanAttributes = {
    'enhancement.stage': stage,
    'enhancement.stage.start_time': new Date().toISOString(),
    ...attributes,
  };

  return createSpan(`enhancement.stage.${stage}`, {
    kind: SpanKind.INTERNAL,
    attributes: stageAttributes,
  });
}

/**
 * Trace an AI operation
 */
export function traceAIOperation(
  operationName: string,
  modelName: string,
  attributes?: SpanAttributes
): Span {
  return createSpan(`ai.${operationName}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      'ai.model': modelName,
      'ai.operation': operationName,
      'ai.start_time': new Date().toISOString(),
      ...attributes,
    },
  });
}

/**
 * Record a pipeline event
 */
export function recordPipelineEvent(
  eventName: string,
  attributes?: SpanAttributes
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(`enhancement.${eventName}`, {
      'event.timestamp': new Date().toISOString(),
      ...attributes,
    });
  }
}

/**
 * Link spans together (e.g., upload to enhancement)
 */
export function linkSpans(
  targetSpan: Span,
  sourceTraceId: string,
  sourceSpanId: string,
  attributes?: SpanAttributes
): void {
  targetSpan.addLink({
    traceId: sourceTraceId,
    spanId: sourceSpanId,
    traceFlags: 1,
    traceState: undefined,
  }, attributes);
}

// Graceful shutdown handlers
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGINT', async () => {
    await shutdownTracing();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await shutdownTracing();
    process.exit(0);
  });
}