/**
 * Client-safe logger for browser and Edge Runtime environments
 * This logger does not depend on any Node.js modules
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogMetadata {
  [key: string]: any
}

export class ClientLogger {
  private name: string
  private isDevelopment: boolean

  constructor(name: string = 'app') {
    this.name = name
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${this.name}] [${level.toUpperCase()}]`
    
    if (metadata && Object.keys(metadata).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(metadata)}`
    }
    
    return `${prefix} ${message}`
  }

  private log(level: LogLevel, message: string, metadata?: LogMetadata) {
    if (typeof window === 'undefined') {
      // We're in a server environment, don't log
      return
    }

    const formattedMessage = this.formatMessage(level, message, metadata)
    
    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage)
        }
        break
      case 'info':
        console.info(formattedMessage)
        break
      case 'warn':
        console.warn(formattedMessage)
        break
      case 'error':
        console.error(formattedMessage)
        break
    }

    // Send to analytics if available
    if (typeof window !== 'undefined' && window.analytics?.track) {
      window.analytics.track('log_event', {
        level,
        message,
        logger: this.name,
        ...metadata
      })
    }
  }

  debug(message: string, metadata?: LogMetadata) {
    this.log('debug', message, metadata)
  }

  info(message: string, metadata?: LogMetadata) {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata?: LogMetadata) {
    this.log('warn', message, metadata)
  }

  error(message: string, error?: Error | unknown, metadata?: LogMetadata) {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    
    this.log('error', message, {
      ...metadata,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack
      }
    })
  }

  // Create a child logger with additional context
  child(bindings: LogMetadata): ClientLogger {
    const childLogger = new ClientLogger(`${this.name}:${bindings.name || 'child'}`)
    // Store bindings for future use
    ;(childLogger as any)._bindings = { ...bindings }
    return childLogger
  }

  // Measure operation duration
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: LogMetadata
  ): Promise<T> {
    const startTime = performance.now()
    
    try {
      this.debug(`Starting ${operation}`, metadata)
      const result = await fn()
      const duration = performance.now() - startTime
      
      this.info(`Completed ${operation}`, {
        ...metadata,
        duration: Math.round(duration),
        success: true,
      })

      return result
    } catch (error) {
      const duration = performance.now() - startTime
      
      this.error(`Failed ${operation}`, error, {
        ...metadata,
        duration: Math.round(duration),
        success: false,
      })

      throw error
    }
  }

  // Performance logging helper
  performance(metric: string, value: number, unit: string, metadata?: LogMetadata) {
    this.info(`Performance metric: ${metric}`, {
      ...metadata,
      metric,
      value,
      unit,
      type: 'performance',
    })
  }

  // Security logging helper
  security(event: string, metadata?: LogMetadata) {
    this.warn(`Security event: ${event}`, {
      ...metadata,
      type: 'security',
      securityEvent: event,
    })
  }

  // Audit logging helper
  audit(action: string, userId: string, metadata?: LogMetadata) {
    this.info(`Audit: ${action}`, {
      ...metadata,
      type: 'audit',
      action,
      userId,
      timestamp: new Date().toISOString(),
    })
  }
}

// Singleton instances
const loggers = new Map<string, ClientLogger>()

export function getClientLogger(name?: string): ClientLogger {
  const loggerName = name || 'default'
  
  if (!loggers.has(loggerName)) {
    loggers.set(loggerName, new ClientLogger(loggerName))
  }
  
  return loggers.get(loggerName)!
}

// Export convenience instances
export const logger = getClientLogger()

// Type declarations for global analytics
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties?: Record<string, any>) => void
    }
  }
}