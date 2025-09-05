// This module is for server-side use only
if (typeof window !== 'undefined') {
  throw new Error(
    'Server-only module: @/lib/observability/logger cannot be imported in client-side code. ' +
    'Use @/lib/observability/client instead.'
  );
}

import pino from 'pino';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { getLogShipper } from './log-shipper';
import type { LogEntry } from '@/config/log-shipper.config';
import { createSafeError } from '@/lib/utils/create-safe-error';

interface LoggerOptions {
  service?: {
    name: string;
    version: string;
    environment: string;
    instance?: string;
  };
  level?: pino.LevelWithSilent;
  pretty?: boolean;
}

export class StructuredLogger {
  private pino: pino.Logger;
  private logShipper = getLogShipper();
  private service: LogEntry['service'];

  constructor(options: LoggerOptions = {}) {
    this.service = options.service || {
      name: process.env.SERVICE_NAME || 'canva-beautifying',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      instance: process.env.DYNO || process.env.HOSTNAME || 'local',
    };

    this.pino = pino({
      level: options.level || (process.env.LOG_LEVEL as pino.LevelWithSilent) || 'info',
      formatters: {
        level: (label) => ({ level: label }),
      },
      ...(options.pretty && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
    });

    // Bind methods to preserve context
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
    this.fatal = this.fatal.bind(this);
  }

  private getTraceContext() {
    const span = trace.getActiveSpan();
    if (!span) return undefined;

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      service: this.service,
      trace: this.getTraceContext(),
      error: error ? {
        type: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      metadata: {
        ...metadata,
        // Add any global metadata here
        correlationId: context.active().getValue('correlationId'),
      },
      labels: {
        // Add any labels for log filtering
        env: this.service.environment,
        service: this.service.name,
      },
    };
  }

  private async ship(entry: LogEntry) {
    try {
      await this.logShipper.log(entry);
    } catch (error) {
      // Log shipping failure shouldn't break the app
      console.error('Failed to ship log:', error);
    }
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.pino.debug({ ...metadata }, message);
    const entry = this.createLogEntry('debug', message, metadata);
    this.ship(entry);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.pino.info({ ...metadata }, message);
    const entry = this.createLogEntry('info', message, metadata);
    this.ship(entry);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.pino.warn({ ...metadata }, message);
    const entry = this.createLogEntry('warn', message, metadata);
    this.ship(entry);
  }

  error(message: string, error?: Error | unknown, metadata?: Record<string, any>) {
    const err = error instanceof Error ? error : createSafeError(String(error));
    
    this.pino.error({ ...metadata, err }, message);
    const entry = this.createLogEntry('error', message, metadata, err);
    this.ship(entry);

    // Update span status if in a trace
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      span.recordException(err);
    }
  }

  fatal(message: string, error?: Error | unknown, metadata?: Record<string, any>) {
    const err = error instanceof Error ? error : createSafeError(String(error));
    
    this.pino.fatal({ ...metadata, err }, message);
    const entry = this.createLogEntry('fatal', message, metadata, err);
    this.ship(entry);

    // Update span status if in a trace
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message });
      span.recordException(err);
    }
  }

  // Child logger with additional context
  child(bindings: Record<string, any>): StructuredLogger {
    const childPino = this.pino.child(bindings);
    const childLogger = Object.create(this);
    childLogger.pino = childPino;
    return childLogger;
  }

  // Measure operation duration
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    const span = trace.getActiveSpan();
    
    try {
      this.debug(`Starting ${operation}`, metadata);
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.info(`Completed ${operation}`, {
        ...metadata,
        duration,
        success: true,
      });

      if (span) {
        span.setAttribute('operation.duration', duration);
        span.setAttribute('operation.success', true);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.error(`Failed ${operation}`, error, {
        ...metadata,
        duration,
        success: false,
      });

      if (span) {
        span.setAttribute('operation.duration', duration);
        span.setAttribute('operation.success', false);
      }

      throw error;
    }
  }

  // Performance logging helper
  performance(metric: string, value: number, unit: string, metadata?: Record<string, any>) {
    this.info(`Performance metric: ${metric}`, {
      ...metadata,
      metric,
      value,
      unit,
      type: 'performance',
    });
  }

  // Security logging helper
  security(event: string, metadata?: Record<string, any>) {
    this.warn(`Security event: ${event}`, {
      ...metadata,
      type: 'security',
      securityEvent: event,
    });
  }

  // Audit logging helper
  audit(action: string, userId: string, metadata?: Record<string, any>) {
    this.info(`Audit: ${action}`, {
      ...metadata,
      type: 'audit',
      action,
      userId,
      timestamp: new Date().toISOString(),
    });
  }
}

// Create singleton instances
const loggers = new Map<string, StructuredLogger>();

export function getLogger(name?: string): StructuredLogger {
  const loggerName = name || 'default';
  
  if (!loggers.has(loggerName)) {
    loggers.set(loggerName, new StructuredLogger({
      service: {
        name: name || process.env.SERVICE_NAME || 'canva-beautifying',
        version: process.env.SERVICE_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        instance: process.env.DYNO || process.env.HOSTNAME || 'local',
      },
      pretty: process.env.NODE_ENV === 'development',
    }));
  }
  
  return loggers.get(loggerName)!;
}

// Request-scoped logger
export function getRequestLogger(req: any): StructuredLogger {
  const logger = getLogger();
  
  return logger.child({
    requestId: req.id || req.headers['x-request-id'],
    userId: req.user?.id,
    method: req.method,
    path: req.path || req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers['user-agent'],
  });
}

// Export convenience instances
export const logger = getLogger();
export const aiLogger = getLogger('ai-service');
export const queueLogger = getLogger('queue-processor');
export const dbLogger = getLogger('database');
export const apiLogger = getLogger('api');