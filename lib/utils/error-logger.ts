/**
 * Secure Error Logger
 * Logs full error details securely while returning sanitized versions to users
 */

import { ErrorSanitizer } from './error-sanitizer'

export interface LogContext {
  userId?: string
  requestId?: string
  method?: string
  url?: string
  userAgent?: string
  ip?: string
  [key: string]: any
}

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug'
  message: string
  error?: any
  context?: LogContext
  timestamp: string
  correlationId?: string
}

export class SecureLogger {
  private static instance: SecureLogger
  private logQueue: LogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null

  private constructor() {
    // Start flush interval
    this.startFlushInterval()
  }

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger()
    }
    return SecureLogger.instance
  }

  /**
   * Log error with full context
   */
  static logError(error: Error, context?: LogContext): string {
    const logger = SecureLogger.getInstance()
    const correlationId = logger.generateCorrelationId()
    
    const logEntry: LogEntry = {
      level: 'error',
      message: error.message,
      error: ErrorSanitizer.forLogging(error),
      context: logger.sanitizeContext(context),
      timestamp: new Date().toISOString(),
      correlationId,
    }
    
    logger.addToQueue(logEntry)
    
    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      logger.sendToMonitoring(logEntry)
    } else {
      // In development, log to console
      console.error('SecureLogger:', logEntry)
    }
    
    return correlationId
  }

  /**
   * Log warning with context
   */
  static logWarning(message: string, context?: LogContext): void {
    const logger = SecureLogger.getInstance()
    
    const logEntry: LogEntry = {
      level: 'warn',
      message: ErrorSanitizer.sanitize(message).message,
      context: logger.sanitizeContext(context),
      timestamp: new Date().toISOString(),
    }
    
    logger.addToQueue(logEntry)
    
    if (process.env.NODE_ENV !== 'production') {
      console.warn('SecureLogger:', logEntry)
    }
  }

  /**
   * Log info with context
   */
  static logInfo(message: string, context?: LogContext): void {
    const logger = SecureLogger.getInstance()
    
    const logEntry: LogEntry = {
      level: 'info',
      message,
      context: logger.sanitizeContext(context),
      timestamp: new Date().toISOString(),
    }
    
    logger.addToQueue(logEntry)
    
    if (process.env.NODE_ENV !== 'production') {
      console.info('SecureLogger:', logEntry)
    }
  }

  /**
   * Generate correlation ID for tracking errors
   */
  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sanitize context to remove sensitive data
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined
    
    const sanitized: LogContext = {}
    
    for (const [key, value] of Object.entries(context)) {
      // Skip sensitive headers
      if (key.toLowerCase() === 'authorization' || 
          key.toLowerCase() === 'cookie' ||
          key.toLowerCase() === 'x-api-key') {
        sanitized[key] = '[REDACTED]'
        continue
      }
      
      // Sanitize values
      if (typeof value === 'string') {
        sanitized[key] = ErrorSanitizer.containsSensitiveInfo(value) 
          ? '[REDACTED]' 
          : value
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }

  /**
   * Add log entry to queue
   */
  private addToQueue(entry: LogEntry): void {
    this.logQueue.push(entry)
    
    // If queue is getting large, flush immediately
    if (this.logQueue.length >= 100) {
      this.flush()
    }
  }

  /**
   * Start interval to periodically flush logs
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 5000) // Flush every 5 seconds
  }

  /**
   * Flush log queue
   */
  private flush(): void {
    if (this.logQueue.length === 0) return
    
    const logsToFlush = [...this.logQueue]
    this.logQueue = []
    
    // In production, batch send to logging service
    if (process.env.NODE_ENV === 'production') {
      this.batchSendToLoggingService(logsToFlush)
    }
  }

  /**
   * Send log entry to monitoring service (e.g., Sentry, DataDog)
   */
  private async sendToMonitoring(entry: LogEntry): Promise<void> {
    try {
      // TODO: Implement actual monitoring service integration
      // For now, this is a placeholder
      
      // Example Sentry integration:
      // if (process.env.SENTRY_DSN) {
      //   Sentry.captureException(entry.error, {
      //     contexts: {
      //       app: entry.context
      //     },
      //     tags: {
      //       correlationId: entry.correlationId
      //     }
      //   })
      // }
      
      // Example DataDog integration:
      // if (process.env.DATADOG_API_KEY) {
      //   await fetch('https://http-intake.logs.datadoghq.com/v1/input', {
      //     method: 'POST',
      //     headers: {
      //       'Content-Type': 'application/json',
      //       'DD-API-KEY': process.env.DATADOG_API_KEY
      //     },
      //     body: JSON.stringify(entry)
      //   })
      // }
    } catch (error) {
      // Don't throw if monitoring fails - log locally
      console.error('Failed to send to monitoring:', error)
    }
  }

  /**
   * Batch send logs to logging service
   */
  private async batchSendToLoggingService(logs: LogEntry[]): Promise<void> {
    try {
      // TODO: Implement actual logging service integration
      // This is where you'd send to CloudWatch, ELK, etc.
      
      // Example CloudWatch integration:
      // if (process.env.AWS_REGION) {
      //   const cloudwatch = new AWS.CloudWatchLogs()
      //   await cloudwatch.putLogEvents({
      //     logGroupName: '/aws/lambda/beautifyai',
      //     logStreamName: `${new Date().toISOString().split('T')[0]}`,
      //     logEvents: logs.map(log => ({
      //       message: JSON.stringify(log),
      //       timestamp: new Date(log.timestamp).getTime()
      //     }))
      //   }).promise()
      // }
    } catch (error) {
      console.error('Failed to batch send logs:', error)
    }
  }

  /**
   * Create structured error log
   */
  static createErrorLog(
    error: Error,
    request?: Request,
    userId?: string
  ): LogEntry {
    const context: LogContext = {}
    
    if (request) {
      context.method = request.method
      context.url = request.url
      context.userAgent = request.headers.get('user-agent') || undefined
      context.ip = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') ||
                   undefined
    }
    
    if (userId) {
      context.userId = userId
    }
    
    const correlationId = SecureLogger.logError(error, context)
    
    return {
      level: 'error',
      message: error.message,
      error: ErrorSanitizer.forLogging(error),
      context,
      timestamp: new Date().toISOString(),
      correlationId,
    }
  }

  /**
   * Cleanup on shutdown
   */
  static shutdown(): void {
    const logger = SecureLogger.getInstance()
    
    if (logger.flushInterval) {
      clearInterval(logger.flushInterval)
      logger.flushInterval = null
    }
    
    // Final flush
    logger.flush()
  }
}

// Register shutdown handler
if (typeof process !== 'undefined') {
  process.on('exit', () => SecureLogger.shutdown())
  process.on('SIGINT', () => SecureLogger.shutdown())
  process.on('SIGTERM', () => SecureLogger.shutdown())
}

export default SecureLogger