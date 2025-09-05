import { registerInstrumentations as registerOtelInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { logger } from './logger';
import { setSpanAttributes } from './tracing';
import type { Span } from '@opentelemetry/api';

/**
 * Register auto-instrumentations for various libraries
 */
export function registerInstrumentations() {
  const instrumentations = [
    // HTTP instrumentation
    new HttpInstrumentation({
      requestHook: (span, request) => {
        // Add custom attributes to HTTP spans
        if (request.url) {
          span.setAttribute('http.url.path', new URL(request.url).pathname);
        }
        
        // Add user context if available
        const headers = request.headers || request.getHeaders?.();
        if (headers) {
          const userId = headers['x-user-id'];
          if (userId) {
            span.setAttribute('user.id', userId);
          }
        }
      },
      responseHook: (span, response) => {
        // Log slow requests
        const duration = Date.now() - (span as any).startTime;
        if (duration > 1000) {
          span.setAttribute('http.slow_request', true);
          span.addEvent('slow_request_detected', {
            duration,
            threshold: 1000,
          });
        }
      },
      ignoreIncomingRequestHook: (request) => {
        const url = request.url || '';
        // Ignore health checks and metrics endpoints
        return url.includes('/api/health') || 
               url.includes('/api/metrics') ||
               url.includes('/_next/');
      },
    }),

    // Express instrumentation
    new ExpressInstrumentation({
      requestHook: (span, { request }) => {
        // Add route information
        if (request.route) {
          span.setAttribute('express.route', request.route.path);
        }
      },
    }),

    // Redis instrumentation
    new IORedisInstrumentation({
      requestHook: (span, { cmdName, cmdArgs }) => {
        span.setAttribute('redis.command', cmdName);
        
        // Add key information for common commands
        if (cmdArgs && cmdArgs.length > 0) {
          const key = cmdArgs[0];
          if (typeof key === 'string') {
            span.setAttribute('redis.key', key);
          }
        }
        
        // Mark cache operations
        if (['GET', 'SET', 'DEL', 'EXISTS'].includes(cmdName)) {
          span.setAttribute('cache.operation', true);
        }
      },
      responseHook: (span, { response, cmdName }) => {
        // Track cache hits/misses
        if (cmdName === 'GET') {
          const hit = response !== null;
          span.setAttribute('cache.hit', hit);
          span.addEvent(hit ? 'cache_hit' : 'cache_miss');
        }
      },
    }),

    // Fetch instrumentation for client-side requests
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [
        /^https?:\/\/localhost/,
        /^https?:\/\/.*\.supabase\.co/,
        /^https?:\/\/api\.openai\.com/,
        /^https?:\/\/generativelanguage\.googleapis\.com/,
      ],
      clearTimingResources: true,
    }),
  ];

  registerOtelInstrumentations({
    instrumentations,
  });

  logger.info('OpenTelemetry instrumentations registered');
}

/**
 * Instrument database queries (Supabase/PostgreSQL)
 */
export function instrumentDatabase() {
  // This would be integrated with your Supabase client
  // Example implementation:
  
  const tracer = trace.getTracer('database');
  
  return {
    wrapQuery: async <T>(
      queryName: string,
      queryFn: () => Promise<T>,
      options?: {
        table?: string;
        operation?: string;
        sanitizeSql?: boolean;
      }
    ): Promise<T> => {
      const span = tracer.startSpan(`db.${queryName}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.system': 'postgresql',
          'db.name': 'beautifyai',
          'db.operation': options?.operation || 'query',
          'db.table': options?.table,
        },
      });

      try {
        const result = await queryFn();
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
    },
  };
}

/**
 * Instrument AI provider calls
 */
export function instrumentAIProviders() {
  const tracer = trace.getTracer('ai');
  
  return {
    wrapAICall: async <T>(
      operation: string,
      model: string,
      provider: string,
      callFn: () => Promise<T & { usage?: any }>,
    ): Promise<T> => {
      const span = tracer.startSpan(`ai.${operation}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'ai.operation': operation,
          'ai.model': model,
          'ai.provider': provider,
          'ai.system': 'beautifyai',
        },
      });

      const startTime = Date.now();

      try {
        const result = await callFn();
        const duration = Date.now() - startTime;
        
        // Add all attributes at once
        const attributes: Record<string, any> = {
          'ai.duration': duration,
          'ai.success': true,
        };
        
        // Add usage metrics if available
        if ((result as any).usage) {
          const usage = (result as any).usage;
          attributes['ai.tokens.prompt'] = usage.prompt_tokens;
          attributes['ai.tokens.completion'] = usage.completion_tokens;
          attributes['ai.tokens.total'] = usage.total_tokens;
          
          // Calculate approximate cost
          const cost = calculateAICost(model, usage);
          if (cost !== undefined) {
            attributes['ai.cost'] = cost;
          }
        }
        
        span.setAttributes(attributes);
        
        span.addEvent('ai_operation_completed', {
          model,
          provider,
          duration,
        });
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setAttributes({
          'ai.success': false,
          'ai.error': (error as Error).message,
        });
        
        // Check for rate limit errors
        if ((error as Error).message.includes('rate limit')) {
          span.addEvent('rate_limit_exceeded', {
            provider,
            model,
          });
        }
        
        span.setStatus({ 
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    },
  };
}

/**
 * Instrument BullMQ queue operations
 */
export function instrumentBullMQ() {
  const tracer = trace.getTracer('queue');
  
  return {
    wrapJobProcessor: <T, R>(
      queueName: string,
      processor: (job: any) => Promise<R>
    ) => {
      return async (job: any): Promise<R> => {
        // Extract trace context from job data if available
        const traceParent = job.data?._traceParent;
        let parentContext;
        
        // Only extract context if propagation API is available
        if (traceParent && (trace as any).propagation?.extract) {
          parentContext = (trace as any).propagation.extract(
            (trace as any).context?.active() || {}, 
            { traceparent: traceParent }
          );
        }
        
        const span = tracer.startSpan(
          `queue.${queueName}.process`,
          {
            kind: SpanKind.CONSUMER,
            attributes: {
              'messaging.system': 'bullmq',
              'messaging.destination': queueName,
              'messaging.destination_kind': 'queue',
              'messaging.operation': 'process',
              'messaging.message_id': job.id,
              'job.name': job.name,
              'job.attempt': job.attemptsMade,
            },
          },
          parentContext
        );

        try {
          const result = await processor(job);
          
          span.addEvent('job_completed', {
            attempts: job.attemptsMade,
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error as Error);
          span.addEvent('job_failed', {
            attempts: job.attemptsMade,
            error: (error as Error).message,
          });
          
          span.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          throw error;
        } finally {
          span.end();
        }
      };
    },
    
    // Add trace context to job when enqueueing
    addTraceContext: (jobData: any) => {
      const span = trace.getActiveSpan();
      if (span && (trace as any).getTraceParent) {
        const traceParent = (trace as any).getTraceParent(span.spanContext());
        return {
          ...jobData,
          _traceParent: traceParent,
        };
      }
      return jobData;
    },
  };
}

// Helper function to calculate AI costs
function calculateAICost(model: string, usage: any): number | undefined {
  const costPerToken: Record<string, { prompt: number; completion: number }> = {
    'gpt-4': { prompt: 0.00003, completion: 0.00006 },
    'gpt-3.5-turbo': { prompt: 0.0000015, completion: 0.000002 },
    'claude-3-opus': { prompt: 0.000015, completion: 0.000075 },
    'claude-3-sonnet': { prompt: 0.000003, completion: 0.000015 },
    'gemini-pro': { prompt: 0.0000005, completion: 0.0000015 },
  };
  
  const costs = costPerToken[model];
  if (costs && usage) {
    return (usage.prompt_tokens * costs.prompt) + 
           (usage.completion_tokens * costs.completion);
  }
  
  return undefined;
}