import { EventEmitter } from 'events';
import type {
  LogShipperConfig,
  LogEntry,
  LogDestination,
  ElasticsearchConfig,
  CloudWatchConfig,
  DatadogConfig,
  FileConfig,
  HttpConfig,
} from '@/config/log-shipper.config';
import { loadLogShipperConfig } from '@/config/log-shipper.config';
import { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerMetrics } from '@/lib/ai/circuit-breaker';
import { createSafeError } from '@/lib/utils/create-safe-error';
import pino from 'pino';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

interface LogBatch {
  logs: LogEntry[];
  createdAt: Date;
  retryCount: number;
}

// Destination-specific circuit breaker configurations
const DESTINATION_CIRCUIT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  elasticsearch: {
    failureThreshold: 5,
    resetTimeout: 60000,      // 1 minute
    monitoringWindow: 300000, // 5 minutes
    halfOpenRequests: 3,
    volumeThreshold: 10
  },
  cloudwatch: {
    failureThreshold: 3,
    resetTimeout: 120000,     // 2 minutes - AWS can be slow to recover
    monitoringWindow: 600000, // 10 minutes
    halfOpenRequests: 2,
    volumeThreshold: 5
  },
  datadog: {
    failureThreshold: 4,
    resetTimeout: 45000,      // 45 seconds
    monitoringWindow: 180000, // 3 minutes
    halfOpenRequests: 3,
    volumeThreshold: 8
  },
  file: {
    failureThreshold: 10,     // File system is more reliable
    resetTimeout: 30000,      // 30 seconds
    monitoringWindow: 120000, // 2 minutes
    halfOpenRequests: 5,
    volumeThreshold: 20
  },
  http: {
    failureThreshold: 3,
    resetTimeout: 90000,      // 1.5 minutes
    monitoringWindow: 300000, // 5 minutes
    halfOpenRequests: 2,
    volumeThreshold: 5
  }
};

// Error categorization for better circuit breaker handling
export enum ErrorCategory {
  TRANSIENT = 'transient',     // Network errors, timeouts, 503s
  RATE_LIMIT = 'rate_limit',   // 429 errors
  AUTH = 'auth',               // 401, 403 errors
  CLIENT = 'client',           // 400, 422 errors
  SERVER = 'server',           // 500, 502 errors
  UNKNOWN = 'unknown'
}

export class LogShipper extends EventEmitter {
  private config: LogShipperConfig;
  private buffer: LogEntry[] = [];
  private batchQueue: Map<string, LogBatch[]> = new Map();
  private flushTimer?: NodeJS.Timeout;
  private circuitBreakers: Map<string, CircuitBreaker<void>> = new Map();
  private isShutdown = false;
  private fileLoggers: Map<string, pino.Logger> = new Map();

  constructor(config?: LogShipperConfig) {
    super();
    this.config = config || loadLogShipperConfig();
    this.initialize();
  }

  private initialize() {
    // Initialize circuit breakers for each destination
    this.config.destinations.forEach((dest) => {
      if (!dest.enabled) return;

      const config = DESTINATION_CIRCUIT_CONFIGS[dest.type] || {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 300000,
        halfOpenRequests: 3,
        volumeThreshold: 10
      };

      const breaker = new CircuitBreaker<void>(
        `log-shipper-${dest.name}`,
        config
      );

      // Add state change listener for monitoring
      breaker.onStateChange((name, oldState, newState, metrics) => {
        console.log(`Circuit breaker ${name} transitioned from ${oldState} to ${newState}`, metrics);
        this.emit('circuit-breaker-state-change', {
          destination: dest.name,
          oldState,
          newState,
          metrics
        });
      });

      this.circuitBreakers.set(dest.name, breaker);
      this.batchQueue.set(dest.name, []);
    });

    // Start flush timer
    this.startFlushTimer();
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('Error during auto-flush:', error);
      });
    }, this.config.flushInterval);
  }

  private categorizeError(error: any, destination: LogDestination): ErrorCategory {
    // Handle HTTP status codes
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      
      if (status === 429) return ErrorCategory.RATE_LIMIT;
      if (status === 401 || status === 403) return ErrorCategory.AUTH;
      if (status === 400 || status === 422) return ErrorCategory.CLIENT;
      if (status >= 500 && status < 600) return ErrorCategory.SERVER;
      if (status === 503) return ErrorCategory.TRANSIENT;
    }

    // Handle error messages
    const message = error.message?.toLowerCase() || '';
    
    // Rate limit patterns
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        message.includes('quota exceeded')) {
      return ErrorCategory.RATE_LIMIT;
    }
    
    // Auth patterns
    if (message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('invalid api key') ||
        message.includes('authentication failed')) {
      return ErrorCategory.AUTH;
    }
    
    // Network/transient patterns
    if (message.includes('econnrefused') ||
        message.includes('etimedout') ||
        message.includes('enotfound') ||
        message.includes('network') ||
        message.includes('timeout')) {
      return ErrorCategory.TRANSIENT;
    }
    
    // Destination-specific patterns
    if (destination.type === 'elasticsearch' && message.includes('circuit_breaking_exception')) {
      return ErrorCategory.TRANSIENT;
    }
    
    if (destination.type === 'cloudwatch' && message.includes('throttling')) {
      return ErrorCategory.RATE_LIMIT;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  private isRateLimitError(error: any): boolean {
    return this.categorizeError(error, {} as LogDestination) === ErrorCategory.RATE_LIMIT;
  }

  private shouldCountAsCircuitBreakerFailure(category: ErrorCategory): boolean {
    // Don't count rate limits or client errors as circuit breaker failures
    return category !== ErrorCategory.RATE_LIMIT && category !== ErrorCategory.CLIENT;
  }

  public async log(entry: LogEntry): Promise<void> {
    if (this.isShutdown) {
      throw createSafeError('LogShipper is shutdown', 'LOG_SHIPPER_SHUTDOWN');
    }

    // Add to buffer
    this.buffer.push(entry);

    // Check if we should flush
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush();
    }
  }

  public async flush(): Promise<void> {
    // Process new logs if any
    if (this.buffer.length > 0) {
      // Move current buffer to processing
      const logsToShip = [...this.buffer];
      this.buffer = [];

      // Create batches for each destination
      for (const destination of this.config.destinations) {
        if (!destination.enabled) continue;

        const batch: LogBatch = {
          logs: logsToShip,
          createdAt: new Date(),
          retryCount: 0,
        };

        const queue = this.batchQueue.get(destination.name) || [];
        queue.push(batch);
        this.batchQueue.set(destination.name, queue);
      }
    }

    // Always process queued batches (including retries)
    await this.processBatches();
  }

  private async processBatches(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [destName, batches] of this.batchQueue) {
      if (batches.length === 0) continue;

      const destination = this.config.destinations.find((d) => d.name === destName);
      if (!destination) continue;

      promises.push(this.processDestinationBatches(destination, batches));
    }

    await Promise.allSettled(promises);
  }

  private async processDestinationBatches(
    destination: LogDestination,
    batches: LogBatch[]
  ): Promise<void> {
    const breaker = this.circuitBreakers.get(destination.name);
    if (!breaker) return;

    // Process batches in order
    const processedBatches: LogBatch[] = [];
    const failedBatches: LogBatch[] = [];

    for (const batch of batches) {
      try {
        await breaker.execute(async () => {
          await this.shipBatch(destination, batch);
        });
        processedBatches.push(batch);
      } catch (error) {
        // Check if this is a rate limit error first
        if (this.isRateLimitError(error)) {
          // Handle rate limit without affecting circuit breaker
          batch.retryCount++;
          failedBatches.push(batch);
          
          // Add exponential backoff for rate limits
          const maxBackoff = process.env.NODE_ENV === 'test' ? 100 : 60000;
          const backoffMs = Math.min(1000 * Math.pow(2, batch.retryCount), maxBackoff);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        
        const errorCategory = this.categorizeError(error, destination);
        
        console.error(`Failed to ship logs to ${destination.name}:`, {
          error: error instanceof Error ? error.message : error,
          category: errorCategory,
          destination: destination.name,
          retryCount: batch.retryCount
        });
        
        // Handle based on error category
        if (errorCategory === ErrorCategory.AUTH || errorCategory === ErrorCategory.CLIENT) {
          // Don't retry auth or client errors - they won't succeed
          this.emit('batch-dropped', { 
            destination: destination.name, 
            batch,
            reason: `Permanent error: ${errorCategory}`
          });
        } else {
          // For transient and server errors, respect retry limit
          batch.retryCount++;
          
          if (batch.retryCount < this.config.maxRetries) {
            failedBatches.push(batch);
          } else {
            this.emit('batch-dropped', { 
              destination: destination.name, 
              batch,
              reason: `Max retries exceeded after ${errorCategory} errors`
            });
          }
        }
      }
    }

    // Update queue with failed batches for next flush
    const remainingBatches = this.batchQueue.get(destination.name) || [];
    // Filter out the batches we just processed
    const unprocessedBatches = remainingBatches.filter(b => !batches.includes(b));
    // Add failed batches back to queue
    this.batchQueue.set(destination.name, [...unprocessedBatches, ...failedBatches]);
    
    // Emit success events
    processedBatches.forEach((batch) => {
      this.emit('batch-shipped', { 
        destination: destination.name, 
        count: batch.logs.length 
      });
    });
  }

  private async shipBatch(destination: LogDestination, batch: LogBatch): Promise<void> {
    let logs = batch.logs;

    // Apply compression if enabled
    if (this.config.enableCompression && destination.type !== 'file') {
      // Most destinations accept compressed data
      logs = logs; // Keep as-is, compression handled per-destination
    }

    switch (destination.type) {
      case 'elasticsearch':
        await this.shipToElasticsearch(destination.config as ElasticsearchConfig, logs);
        break;
      case 'cloudwatch':
        await this.shipToCloudWatch(destination.config as CloudWatchConfig, logs);
        break;
      case 'datadog':
        await this.shipToDatadog(destination.config as DatadogConfig, logs);
        break;
      case 'file':
        await this.shipToFile(destination.config as FileConfig, logs);
        break;
      case 'http':
        await this.shipToHttp(destination.config as HttpConfig, logs);
        break;
      default:
        throw createSafeError(`Unknown destination type: ${destination.type}`, 'UNKNOWN_DESTINATION');
    }
  }

  private async shipToElasticsearch(config: ElasticsearchConfig, logs: LogEntry[]): Promise<void> {
    // Skip Elasticsearch in test mode
    if (process.env.NODE_ENV === 'test') {
      console.log('[LogShipper] Skipping Elasticsearch shipping in test mode');
      return;
    }
    
    // Dynamic import inside function to avoid build errors
    const loadElasticsearch = async () => {
      try {
        const module = await import('@elastic/elasticsearch');
        return module.Client;
      } catch (error) {
        console.error('[LogShipper] Failed to import Elasticsearch SDK:', error);
        return null;
      }
    };

    const Client = await loadElasticsearch();
    if (!Client) return;
    
    const client = new Client({
      nodes: config.nodes,
      auth: config.username && config.password
        ? { username: config.username, password: config.password }
        : config.apiKey
        ? { apiKey: config.apiKey }
        : undefined,
      cloud: config.cloudId ? { id: config.cloudId } : undefined,
      tls: config.tls,
    });

    // Prepare bulk request
    const body = logs.flatMap((log) => [
      { index: { _index: `${config.index}-${new Date().toISOString().slice(0, 10)}` } },
      {
        '@timestamp': log.timestamp,
        level: log.level,
        message: log.message,
        service: log.service,
        trace: log.trace,
        error: log.error,
        metadata: log.metadata,
        labels: log.labels,
      },
    ]);

    await client.bulk({ body });
  }

  private async shipToCloudWatch(config: CloudWatchConfig, logs: LogEntry[]): Promise<void> {
    // Skip CloudWatch in test mode
    if (process.env.NODE_ENV === 'test') {
      console.log('[LogShipper] Skipping CloudWatch shipping in test mode');
      return;
    }
    
    // Dynamic import inside function to avoid build errors
    const loadCloudWatch = async () => {
      // Skip in test mode
      if (process.env.NODE_ENV === 'test') {
        return null;
      }
      try {
        const module = await import('@aws-sdk/client-cloudwatch-logs');
        return module.CloudWatchLogs;
      } catch (error) {
        console.error('[LogShipper] Failed to import CloudWatch SDK:', error);
        return null;
      }
    };

    const CloudWatchLogs = await loadCloudWatch();
    if (!CloudWatchLogs) return;
    
    const client = new CloudWatchLogs({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
      credentials: config.awsAccessKeyId && config.awsSecretAccessKey
        ? {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: config.awsSecretAccessKey,
          }
        : undefined,
    });

    const logEvents = logs.map((log) => ({
      timestamp: log.timestamp.getTime(),
      message: JSON.stringify({
        level: log.level,
        message: log.message,
        service: log.service,
        trace: log.trace,
        error: log.error,
        metadata: log.metadata,
        labels: log.labels,
      }),
    }));

    await client.putLogEvents({
      logGroupName: config.logGroupName,
      logStreamName: config.logStreamName,
      logEvents,
    });
  }

  private async shipToDatadog(config: DatadogConfig, logs: LogEntry[]): Promise<void> {
    const url = `https://http-intake.logs.${config.site}/v1/input/${config.apiKey}`;
    
    const payload = logs.map((log) => ({
      ddsource: config.source,
      ddtags: config.tags?.join(','),
      service: config.service,
      hostname: log.service.instance || 'unknown',
      message: log.message,
      level: log.level,
      timestamp: log.timestamp.toISOString(),
      trace_id: log.trace?.traceId,
      span_id: log.trace?.spanId,
      error: log.error,
      ...log.metadata,
    }));

    const body = this.config.enableCompression
      ? await gzip(JSON.stringify(payload))
      : JSON.stringify(payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.enableCompression && { 'Content-Encoding': 'gzip' }),
      },
      body,
    });

    if (!response.ok) {
      throw createSafeError(
        `Datadog API error: ${response.status} ${response.statusText}`,
        'DATADOG_API_ERROR'
      );
    }
  }

  private async shipToFile(config: FileConfig, logs: LogEntry[]): Promise<void> {
    // Ensure directory exists
    await mkdir(dirname(config.path), { recursive: true });

    // Get or create file logger
    let logger = this.fileLoggers.get(config.path);
    if (!logger) {
      logger = pino({
        level: 'trace',
      }, pino.destination({
        dest: config.path,
        sync: false,
        ...(config.compress && {
          // Pino will handle compression and rotation
          // This is a simplified version - in production use pino-roll
        }),
      }));
      this.fileLoggers.set(config.path, logger);
    }

    // Write logs
    logs.forEach((log) => {
      logger![log.level]({
        service: log.service,
        trace: log.trace,
        error: log.error,
        metadata: log.metadata,
        labels: log.labels,
      }, log.message);
    });
  }

  private async shipToHttp(config: HttpConfig, logs: LogEntry[]): Promise<void> {
    const body = this.config.enableCompression
      ? await gzip(JSON.stringify(logs))
      : JSON.stringify(logs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.enableCompression && { 'Content-Encoding': 'gzip' }),
      ...config.headers,
    };

    // Add auth header
    if (config.auth) {
      if (config.auth.type === 'basic') {
        headers['Authorization'] = `Basic ${config.auth.credentials}`;
      } else if (config.auth.type === 'bearer') {
        headers['Authorization'] = `Bearer ${config.auth.credentials}`;
      }
    }

    let response: any;
    try {
      response = await fetch(config.url, {
        method: config.method || 'POST',
        headers,
        body,
        signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
      });
    } catch (error: any) {
      // Preserve original error properties for categorization
      const safeError = createSafeError(
        `HTTP endpoint fetch failed: ${error.message}`,
        'HTTP_FETCH_ERROR'
      );
      // Copy status/statusCode if present
      if (error.status) (safeError as any).status = error.status;
      if (error.statusCode) (safeError as any).statusCode = error.statusCode;
      throw safeError;
    }

    if (!response || !response.ok) {
      const safeError = createSafeError(
        `HTTP endpoint error: ${response?.status || 'unknown'} ${response?.statusText || 'no response'}`,
        'HTTP_ENDPOINT_ERROR'
      );
      // Set status for error categorization
      if (response?.status) (safeError as any).status = response.status;
      throw safeError;
    }
  }

  public async shutdown(): Promise<void> {
    this.isShutdown = true;

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Final flush
    await this.flush();

    // Close file loggers
    for (const logger of this.fileLoggers.values()) {
      // Pino loggers flush automatically on process exit
    }

    this.emit('shutdown');
  }

  // Metrics and monitoring
  public getMetrics(): {
    bufferSize: number;
    destinations: Record<string, {
      queueSize: number;
      totalLogs: number;
      circuitBreaker: CircuitBreakerMetrics | null;
    }>;
  } {
    const metrics = {
      bufferSize: this.buffer.length,
      destinations: {} as Record<string, any>,
    };

    for (const [name, queue] of this.batchQueue) {
      const breaker = this.circuitBreakers.get(name);
      const breakerMetrics = breaker?.getMetrics() || null;
      
      metrics.destinations[name] = {
        queueSize: queue.length,
        totalLogs: queue.reduce((sum, batch) => sum + batch.logs.length, 0),
        circuitBreaker: breakerMetrics,
      };
    }

    return metrics;
  }

  // Get circuit breaker states for monitoring
  public getCircuitBreakerStates(): Record<string, CircuitBreakerMetrics> {
    const states: Record<string, CircuitBreakerMetrics> = {};
    
    for (const [name, breaker] of this.circuitBreakers) {
      states[name] = breaker.getMetrics();
    }
    
    return states;
  }
}

// Singleton instance
let logShipper: LogShipper | null = null;

export function getLogShipper(config?: LogShipperConfig): LogShipper {
  if (!logShipper) {
    logShipper = new LogShipper(config);
  }
  return logShipper;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (logShipper) {
    await logShipper.shutdown();
  }
});

process.on('SIGINT', async () => {
  if (logShipper) {
    await logShipper.shutdown();
  }
});