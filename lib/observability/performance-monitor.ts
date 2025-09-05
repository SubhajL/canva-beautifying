import { Redis } from 'ioredis';
import { logger } from './logger';
import { metrics } from './metrics';
import { traceAsync } from './tracing';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
}

export interface AggregatedMetric {
  metric: string;
  period: '1m' | '5m' | '15m' | '1h' | '24h';
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  count: number;
  timestamp: number;
}

export class PerformanceMonitor {
  private redis: Redis;
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private buffer: PerformanceMetric[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 10000; // 10 seconds
  private readonly TTL = {
    RAW: 300,      // 5 minutes for raw metrics
    '1m': 3600,    // 1 hour for 1-minute aggregates  
    '5m': 10800,   // 3 hours for 5-minute aggregates
    '15m': 21600,  // 6 hours for 15-minute aggregates
    '1h': 86400,   // 24 hours for 1-hour aggregates
    '24h': 604800  // 7 days for 24-hour aggregates
  };

  constructor(redis: Redis) {
    this.redis = redis;
    this.initializeDefaultThresholds();
    this.startFlushInterval();
  }

  private initializeDefaultThresholds() {
    // HTTP endpoints
    this.thresholds.set('http.request.duration', {
      metric: 'http.request.duration',
      warning: 1000,  // 1s
      critical: 5000, // 5s
      unit: 'ms'
    });

    // AI operations
    this.thresholds.set('ai.operation.duration', {
      metric: 'ai.operation.duration',
      warning: 10000,  // 10s
      critical: 30000, // 30s
      unit: 'ms'
    });

    // Queue processing
    this.thresholds.set('queue.job.duration', {
      metric: 'queue.job.duration',
      warning: 60000,   // 1 minute
      critical: 300000, // 5 minutes
      unit: 'ms'
    });

    // Storage operations
    this.thresholds.set('storage.operation.duration', {
      metric: 'storage.operation.duration',
      warning: 2000,  // 2s
      critical: 10000, // 10s
      unit: 'ms'
    });

    // Database queries
    this.thresholds.set('database.query.duration', {
      metric: 'database.query.duration',
      warning: 100,  // 100ms
      critical: 1000, // 1s
      unit: 'ms'
    });

    // Memory usage
    this.thresholds.set('system.memory.usage', {
      metric: 'system.memory.usage',
      warning: 85,  // 85%
      critical: 95, // 95%
      unit: 'percent'
    });

    // CPU usage
    this.thresholds.set('system.cpu.usage', {
      metric: 'system.cpu.usage',
      warning: 80,  // 80%
      critical: 95, // 95%
      unit: 'percent'
    });
  }

  private startFlushInterval() {
    this.flushInterval = setInterval(async () => {
      await this.flush();
    }, this.FLUSH_INTERVAL);
  }

  public setThreshold(threshold: PerformanceThreshold) {
    this.thresholds.set(threshold.metric, threshold);
  }

  public async recordMetric(metric: PerformanceMetric) {
    return traceAsync('performance.record_metric', async () => {
      // Check thresholds
      const threshold = this.thresholds.get(metric.name);
      if (threshold) {
        if (metric.value >= threshold.critical) {
          logger.error({
            metric: metric.name,
            value: metric.value,
            threshold: threshold.critical,
            tags: metric.tags
          }, 'Performance metric exceeded critical threshold');

          // Emit critical alert event
          this.emitAlert('critical', metric, threshold);
        } else if (metric.value >= threshold.warning) {
          logger.warn({
            metric: metric.name,
            value: metric.value,
            threshold: threshold.warning,
            tags: metric.tags
          }, 'Performance metric exceeded warning threshold');

          // Emit warning alert event
          this.emitAlert('warning', metric, threshold);
        }
      }

      // Add to buffer
      this.buffer.push(metric);

      // Flush if buffer is full
      if (this.buffer.length >= this.BUFFER_SIZE) {
        await this.flush();
      }

      // Update Prometheus metrics
      this.updatePrometheusMetrics(metric);
    });
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const metrics = [...this.buffer];
    this.buffer = [];

    try {
      await traceAsync('performance.flush_metrics', async () => {
        const pipeline = this.redis.pipeline();

        for (const metric of metrics) {
          const key = this.getMetricKey(metric);
          const value = JSON.stringify(metric);

          // Store raw metric
          pipeline.zadd(key, metric.timestamp, value);
          pipeline.expire(key, this.TTL.RAW);

          // Update aggregates
          await this.updateAggregates(metric, pipeline);
        }

        await pipeline.exec();

        logger.debug({
          count: metrics.length
        }, 'Flushed performance metrics to Redis');
      });
    } catch (error) {
      logger.error({
        err: error,
        metricsCount: metrics.length
      }, 'Failed to flush performance metrics');

      // Re-add metrics to buffer if flush failed
      this.buffer = [...metrics, ...this.buffer].slice(0, this.BUFFER_SIZE * 2);
    }
  }

  private async updateAggregates(metric: PerformanceMetric, pipeline: any) {
    const periods: Array<'1m' | '5m' | '15m' | '1h' | '24h'> = ['1m', '5m', '15m', '1h', '24h'];

    for (const period of periods) {
      const bucketKey = this.getAggregateBucketKey(metric.name, period, metric.timestamp);
      const aggregateKey = `perf:agg:${metric.name}:${period}`;

      // Add to current bucket
      pipeline.zadd(bucketKey, metric.value, metric.timestamp);
      pipeline.expire(bucketKey, this.getPeriodSeconds(period) * 2);

      // Schedule aggregation
      const lockKey = `perf:lock:${bucketKey}`;
      const locked = await this.redis.set(lockKey, '1', 'NX', 'EX', 60);

      if (locked) {
        setTimeout(() => this.computeAggregate(metric.name, period, bucketKey, aggregateKey), 1000);
      }
    }
  }

  private async computeAggregate(
    metricName: string, 
    period: '1m' | '5m' | '15m' | '1h' | '24h',
    bucketKey: string,
    aggregateKey: string
  ) {
    try {
      const values = await this.redis.zrange(bucketKey, 0, -1, 'WITHSCORES');
      if (values.length === 0) return;

      const metrics: number[] = [];
      for (let i = 0; i < values.length; i += 2) {
        metrics.push(parseFloat(values[i]));
      }

      metrics.sort((a, b) => a - b);

      const aggregate: AggregatedMetric = {
        metric: metricName,
        period,
        avg: metrics.reduce((sum, val) => sum + val, 0) / metrics.length,
        min: metrics[0],
        max: metrics[metrics.length - 1],
        p50: this.percentile(metrics, 50),
        p95: this.percentile(metrics, 95),
        p99: this.percentile(metrics, 99),
        count: metrics.length,
        timestamp: Date.now()
      };

      // Store aggregate
      await this.redis.zadd(
        aggregateKey,
        aggregate.timestamp,
        JSON.stringify(aggregate)
      );
      await this.redis.expire(aggregateKey, this.TTL[period]);

      // Clean up bucket
      await this.redis.del(bucketKey);

      logger.debug({
        metric: metricName,
        period,
        aggregate
      }, 'Computed performance aggregate');
    } catch (error) {
      logger.error({
        err: error,
        metric: metricName,
        period
      }, 'Failed to compute aggregate');
    }
  }

  private percentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  public async getMetrics(
    metricName: string,
    options: {
      from?: number;
      to?: number;
      period?: '1m' | '5m' | '15m' | '1h' | '24h';
      limit?: number;
    } = {}
  ): Promise<PerformanceMetric[] | AggregatedMetric[]> {
    const from = options.from || Date.now() - 3600000; // Default 1 hour ago
    const to = options.to || Date.now();
    const limit = options.limit || 1000;

    try {
      if (options.period) {
        // Get aggregated metrics
        const key = `perf:agg:${metricName}:${options.period}`;
        const results = await this.redis.zrangebyscore(
          key,
          from,
          to,
          'LIMIT',
          0,
          limit
        );

        return results.map(r => JSON.parse(r) as AggregatedMetric);
      } else {
        // Get raw metrics
        const key = this.getMetricKey({ name: metricName } as PerformanceMetric);
        const results = await this.redis.zrangebyscore(
          key,
          from,
          to,
          'LIMIT',
          0,
          limit
        );

        return results.map(r => JSON.parse(r) as PerformanceMetric);
      }
    } catch (error) {
      logger.error({
        err: error,
        metric: metricName,
        options
      }, 'Failed to get metrics');
      return [];
    }
  }

  public async getMetricsSummary(
    duration: '5m' | '15m' | '1h' | '24h' = '1h'
  ): Promise<Record<string, AggregatedMetric | null>> {
    const summary: Record<string, AggregatedMetric | null> = {};
    const metricNames = Array.from(this.thresholds.keys());

    await Promise.all(
      metricNames.map(async (metricName) => {
        const aggregates = await this.getMetrics(metricName, {
          period: duration,
          limit: 1
        }) as AggregatedMetric[];

        summary[metricName] = aggregates[0] || null;
      })
    );

    return summary;
  }

  private getMetricKey(metric: PerformanceMetric): string {
    const tags = metric.tags ? `:${Object.entries(metric.tags).map(([k, v]) => `${k}=${v}`).join(':')}` : '';
    return `perf:raw:${metric.name}${tags}`;
  }

  private getAggregateBucketKey(metricName: string, period: string, timestamp: number): string {
    const bucket = Math.floor(timestamp / (this.getPeriodSeconds(period) * 1000));
    return `perf:bucket:${metricName}:${period}:${bucket}`;
  }

  private getPeriodSeconds(period: '1m' | '5m' | '15m' | '1h' | '24h'): number {
    const seconds = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '24h': 86400
    };
    return seconds[period];
  }

  private updatePrometheusMetrics(metric: PerformanceMetric) {
    // Update generic performance metric histogram
    if (metric.unit === 'ms') {
      const metricName = metric.name.replace(/\./g, '_');
      const labels = metric.tags || {};
      
      // Find or create a dynamic histogram for this metric
      // This is simplified - in production you'd want a registry of histograms
      logger.debug({
        metric: metricName,
        value: metric.value,
        labels
      }, 'Would update Prometheus histogram');
    }
  }

  private emitAlert(level: 'warning' | 'critical', metric: PerformanceMetric, threshold: PerformanceThreshold) {
    const alert = {
      level,
      metric: metric.name,
      value: metric.value,
      threshold: level === 'warning' ? threshold.warning : threshold.critical,
      unit: metric.unit,
      timestamp: metric.timestamp,
      tags: metric.tags,
      metadata: metric.metadata
    };

    logger.info({
      alert,
      type: 'performance_alert'
    }, `Performance ${level} alert`);

    // Here you would integrate with your alerting system
    // e.g., send to PagerDuty, Slack, etc.
  }

  public async cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flush();
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function initializePerformanceMonitor(redis: Redis): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor(redis);
    logger.info('Performance monitor initialized');
  }
  return performanceMonitor;
}

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    throw new Error('Performance monitor not initialized');
  }
  return performanceMonitor;
}