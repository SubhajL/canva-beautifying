import { Redis } from 'ioredis';
import { logger } from './logger';
import { getPerformanceMonitor } from './performance-monitor';
import { traceAsync } from './tracing';
import { EventEmitter } from 'events';

export interface SLI {
  name: string;
  description: string;
  measurement: 'availability' | 'latency' | 'error_rate' | 'throughput' | 'custom';
  query: SLIQuery;
  unit: string;
}

export interface SLIQuery {
  good: QueryDefinition;
  total: QueryDefinition;
}

export interface QueryDefinition {
  metric: string;
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'count';
  filter?: Record<string, string>;
  threshold?: {
    operator: '<' | '<=' | '>' | '>=' | '=' | '!=';
    value: number;
  };
}

export interface SLO {
  id: string;
  name: string;
  description: string;
  sli: string; // SLI name
  target: number; // Target percentage (e.g., 99.9)
  window: '1h' | '24h' | '7d' | '30d';
  alerting: {
    burnRate: {
      short: { window: string; threshold: number };
      long: { window: string; threshold: number };
    };
  };
}

export interface SLOStatus {
  slo: SLO;
  currentValue: number;
  errorBudgetRemaining: number;
  errorBudgetUsed: number;
  isViolated: boolean;
  burnRate: {
    short: number;
    long: number;
  };
  prediction?: {
    willViolateIn: number; // hours
    confidence: number;
  };
}

export class SLISLOTracker extends EventEmitter {
  private redis: Redis;
  private slis: Map<string, SLI> = new Map();
  private slos: Map<string, SLO> = new Map();
  private perfMonitor = getPerformanceMonitor();
  private checkInterval?: NodeJS.Timeout;

  constructor(redis: Redis) {
    super();
    this.redis = redis;
    this.initializeDefaultSLIs();
    this.initializeDefaultSLOs();
    this.startMonitoring();
  }

  private initializeDefaultSLIs() {
    // API Availability
    this.slis.set('api.availability', {
      name: 'api.availability',
      description: 'API endpoint availability',
      measurement: 'availability',
      query: {
        good: {
          metric: 'http.request.count',
          aggregation: 'count',
          filter: { status: '2xx,3xx' }
        },
        total: {
          metric: 'http.request.count',
          aggregation: 'count'
        }
      },
      unit: 'percent'
    });

    // API Latency
    this.slis.set('api.latency', {
      name: 'api.latency',
      description: 'API response time under threshold',
      measurement: 'latency',
      query: {
        good: {
          metric: 'http.request.duration',
          aggregation: 'count',
          threshold: { operator: '<', value: 1000 } // 1 second
        },
        total: {
          metric: 'http.request.duration',
          aggregation: 'count'
        }
      },
      unit: 'percent'
    });

    // AI Success Rate
    this.slis.set('ai.success_rate', {
      name: 'ai.success_rate',
      description: 'AI operation success rate',
      measurement: 'error_rate',
      query: {
        good: {
          metric: 'ai.operation.count',
          aggregation: 'count',
          filter: { status: 'success' }
        },
        total: {
          metric: 'ai.operation.count',
          aggregation: 'count'
        }
      },
      unit: 'percent'
    });

    // Queue Processing Time
    this.slis.set('queue.processing_time', {
      name: 'queue.processing_time',
      description: 'Queue jobs processed within SLA',
      measurement: 'latency',
      query: {
        good: {
          metric: 'queue.job.duration',
          aggregation: 'count',
          threshold: { operator: '<', value: 300000 } // 5 minutes
        },
        total: {
          metric: 'queue.job.duration',
          aggregation: 'count'
        }
      },
      unit: 'percent'
    });

    // Storage Availability
    this.slis.set('storage.availability', {
      name: 'storage.availability',
      description: 'Storage service availability',
      measurement: 'availability',
      query: {
        good: {
          metric: 'storage.operation.count',
          aggregation: 'count',
          filter: { status: 'success' }
        },
        total: {
          metric: 'storage.operation.count',
          aggregation: 'count'
        }
      },
      unit: 'percent'
    });
  }

  private initializeDefaultSLOs() {
    // API Availability SLO
    this.slos.set('api-availability-99.9', {
      id: 'api-availability-99.9',
      name: 'API Availability',
      description: 'API should be available 99.9% of the time',
      sli: 'api.availability',
      target: 99.9,
      window: '30d',
      alerting: {
        burnRate: {
          short: { window: '1h', threshold: 14.4 }, // 14.4x burn rate
          long: { window: '6h', threshold: 6 }      // 6x burn rate
        }
      }
    });

    // API Latency SLO
    this.slos.set('api-latency-95', {
      id: 'api-latency-95',
      name: 'API Latency',
      description: '95% of requests should complete within 1 second',
      sli: 'api.latency',
      target: 95,
      window: '7d',
      alerting: {
        burnRate: {
          short: { window: '5m', threshold: 14.4 },
          long: { window: '1h', threshold: 6 }
        }
      }
    });

    // AI Success Rate SLO
    this.slos.set('ai-success-99', {
      id: 'ai-success-99',
      name: 'AI Success Rate',
      description: 'AI operations should succeed 99% of the time',
      sli: 'ai.success_rate',
      target: 99,
      window: '24h',
      alerting: {
        burnRate: {
          short: { window: '10m', threshold: 14.4 },
          long: { window: '1h', threshold: 6 }
        }
      }
    });

    // Queue Processing SLO
    this.slos.set('queue-processing-90', {
      id: 'queue-processing-90',
      name: 'Queue Processing Time',
      description: '90% of jobs should complete within 5 minutes',
      sli: 'queue.processing_time',
      target: 90,
      window: '24h',
      alerting: {
        burnRate: {
          short: { window: '30m', threshold: 14.4 },
          long: { window: '2h', threshold: 6 }
        }
      }
    });
  }

  private startMonitoring() {
    // Check SLOs every minute
    this.checkInterval = setInterval(async () => {
      await this.checkAllSLOs();
    }, 60000);

    // Initial check
    this.checkAllSLOs();
  }

  public async recordSLIData(
    metric: string,
    value: number,
    labels?: Record<string, string>
  ) {
    return traceAsync('sli.record_data', async () => {
      const timestamp = Date.now();
      const key = this.getSLIDataKey(metric, labels);

      // Store in time series
      await this.redis.zadd(key, timestamp, JSON.stringify({
        value,
        timestamp,
        labels
      }));

      // Set TTL based on longest SLO window (30 days + buffer)
      await this.redis.expire(key, 35 * 24 * 60 * 60);

      // Update real-time counters for faster queries
      await this.updateCounters(metric, value, labels);
    });
  }

  private async updateCounters(
    metric: string,
    value: number,
    labels?: Record<string, string>
  ) {
    const windows = ['1m', '5m', '1h', '24h', '7d', '30d'];
    const now = Date.now();

    for (const window of windows) {
      const bucketKey = this.getCounterBucketKey(metric, window, now, labels);
      const ttl = this.getWindowSeconds(window) * 2;

      if (labels?.status) {
        // Increment status counter
        await this.redis.hincrby(bucketKey, labels.status, 1);
      } else {
        // Add value to list for percentile calculations
        await this.redis.rpush(bucketKey, value);
        await this.redis.ltrim(bucketKey, -1000, -1); // Keep last 1000 values
      }

      await this.redis.expire(bucketKey, ttl);
    }
  }

  public async calculateSLI(sli: SLI, window: string): Promise<number> {
    return traceAsync('sli.calculate', async (span) => {
      span.setAttributes({
        'sli.name': sli.name,
        'sli.window': window
      });

      const now = Date.now();
      const windowMs = this.getWindowMilliseconds(window);
      const from = now - windowMs;

      // Calculate good events
      const goodCount = await this.queryMetric(sli.query.good, from, now);
      
      // Calculate total events
      const totalCount = await this.queryMetric(sli.query.total, from, now);

      if (totalCount === 0) {
        return 100; // No data means we're meeting SLO
      }

      const sliValue = (goodCount / totalCount) * 100;

      // Record the calculated SLI
      await this.redis.zadd(
        `sli:calculated:${sli.name}`,
        now,
        JSON.stringify({ value: sliValue, window, timestamp: now })
      );

      logger.debug({
        sli: sli.name,
        window,
        goodCount,
        totalCount,
        sliValue
      }, 'Calculated SLI');

      return sliValue;
    });
  }

  private async queryMetric(
    query: QueryDefinition,
    from: number,
    to: number
  ): Promise<number> {
    const baseKey = `sli:counter:${query.metric}:*`;
    const keys = await this.redis.keys(baseKey);
    
    let result = 0;

    for (const key of keys) {
      // Check if key matches time range
      const keyParts = key.split(':');
      const timestamp = parseInt(keyParts[keyParts.length - 1]);
      
      if (timestamp >= from && timestamp <= to) {
        if (query.filter?.status) {
          // Sum specific status counts
          const statuses = query.filter.status.split(',');
          for (const status of statuses) {
            const count = await this.redis.hget(key, status);
            result += parseInt(count || '0');
          }
        } else if (query.threshold) {
          // Count values meeting threshold
          const values = await this.redis.lrange(key, 0, -1);
          for (const value of values) {
            const num = parseFloat(value);
            if (this.meetsThreshold(num, query.threshold)) {
              result++;
            }
          }
        } else {
          // Count all values
          const len = await this.redis.llen(key);
          result += len;
        }
      }
    }

    return result;
  }

  private meetsThreshold(
    value: number,
    threshold: { operator: string; value: number }
  ): boolean {
    switch (threshold.operator) {
      case '<': return value < threshold.value;
      case '<=': return value <= threshold.value;
      case '>': return value > threshold.value;
      case '>=': return value >= threshold.value;
      case '=': return value === threshold.value;
      case '!=': return value !== threshold.value;
      default: return false;
    }
  }

  public async getSLOStatus(sloId: string): Promise<SLOStatus | null> {
    const slo = this.slos.get(sloId);
    if (!slo) return null;

    const sli = this.slis.get(slo.sli);
    if (!sli) return null;

    return traceAsync('slo.get_status', async () => {
      // Calculate current SLI value
      const currentValue = await this.calculateSLI(sli, slo.window);

      // Calculate error budget
      const errorBudgetTotal = 100 - slo.target;
      const errorBudgetUsed = Math.max(0, slo.target - currentValue);
      const errorBudgetRemaining = errorBudgetTotal - errorBudgetUsed;

      // Calculate burn rates
      const burnRate = await this.calculateBurnRates(slo, sli);

      // Check if violated
      const isViolated = currentValue < slo.target;

      // Predict future violations
      const prediction = await this.predictViolation(slo, currentValue, burnRate);

      const status: SLOStatus = {
        slo,
        currentValue,
        errorBudgetRemaining,
        errorBudgetUsed,
        isViolated,
        burnRate,
        prediction
      };

      // Check alerting conditions
      await this.checkAlertingConditions(status);

      return status;
    });
  }

  private async calculateBurnRates(
    slo: SLO,
    sli: SLI
  ): Promise<{ short: number; long: number }> {
    const shortWindow = slo.alerting.burnRate.short.window;
    const longWindow = slo.alerting.burnRate.long.window;

    const [shortValue, longValue] = await Promise.all([
      this.calculateSLI(sli, shortWindow),
      this.calculateSLI(sli, longWindow)
    ]);

    // Calculate how fast we're burning through error budget
    const targetErrorRate = (100 - slo.target) / 100;
    const shortErrorRate = (100 - shortValue) / 100;
    const longErrorRate = (100 - longValue) / 100;

    return {
      short: shortErrorRate / targetErrorRate,
      long: longErrorRate / targetErrorRate
    };
  }

  private async predictViolation(
    slo: SLO,
    currentValue: number,
    burnRate: { short: number; long: number }
  ): Promise<{ willViolateIn: number; confidence: number } | undefined> {
    if (currentValue >= slo.target) {
      // Not currently at risk
      return undefined;
    }

    // Simple linear prediction based on burn rate
    const avgBurnRate = (burnRate.short + burnRate.long) / 2;
    if (avgBurnRate <= 1) {
      return undefined; // Burn rate is normal
    }

    const errorBudgetRemaining = (currentValue - slo.target) / 100;
    const hoursUntilViolation = Math.abs(errorBudgetRemaining / (avgBurnRate - 1) * 24);

    // Confidence based on consistency of burn rates
    const burnRateConsistency = 1 - Math.abs(burnRate.short - burnRate.long) / Math.max(burnRate.short, burnRate.long);
    const confidence = burnRateConsistency * 100;

    return {
      willViolateIn: hoursUntilViolation,
      confidence
    };
  }

  private async checkAlertingConditions(status: SLOStatus) {
    const slo = status.slo;
    
    // Check burn rate alerts
    const shouldAlertShort = status.burnRate.short >= slo.alerting.burnRate.short.threshold;
    const shouldAlertLong = status.burnRate.long >= slo.alerting.burnRate.long.threshold;

    if (shouldAlertShort && shouldAlertLong) {
      // Both conditions met - high severity alert
      this.emit('slo:alert', {
        severity: 'critical',
        slo: slo.id,
        message: `SLO ${slo.name} is burning error budget too quickly`,
        burnRate: status.burnRate,
        currentValue: status.currentValue,
        target: slo.target
      });
    } else if (shouldAlertShort || shouldAlertLong) {
      // One condition met - warning
      this.emit('slo:alert', {
        severity: 'warning',
        slo: slo.id,
        message: `SLO ${slo.name} burn rate elevated`,
        burnRate: status.burnRate,
        currentValue: status.currentValue,
        target: slo.target
      });
    }

    // Check prediction alerts
    if (status.prediction && status.prediction.willViolateIn < 24 && status.prediction.confidence > 80) {
      this.emit('slo:alert', {
        severity: 'warning',
        slo: slo.id,
        message: `SLO ${slo.name} predicted to violate within ${Math.round(status.prediction.willViolateIn)} hours`,
        prediction: status.prediction,
        currentValue: status.currentValue,
        target: slo.target
      });
    }
  }

  private async checkAllSLOs() {
    for (const [sloId] of this.slos) {
      try {
        await this.getSLOStatus(sloId);
      } catch (error) {
        logger.error({ error, sloId }, 'Failed to check SLO status');
      }
    }
  }

  public async getAllSLOStatuses(): Promise<SLOStatus[]> {
    const statuses: SLOStatus[] = [];

    for (const [sloId] of this.slos) {
      const status = await this.getSLOStatus(sloId);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  // Helper methods
  private getSLIDataKey(metric: string, labels?: Record<string, string>): string {
    const labelStr = labels ? `:${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(':')}` : '';
    return `sli:data:${metric}${labelStr}`;
  }

  private getCounterBucketKey(
    metric: string,
    window: string,
    timestamp: number,
    labels?: Record<string, string>
  ): string {
    const bucket = Math.floor(timestamp / (this.getWindowMilliseconds(window) / 10));
    const labelStr = labels ? `:${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(':')}` : '';
    return `sli:counter:${metric}:${window}${labelStr}:${bucket}`;
  }

  private getWindowMilliseconds(window: string): number {
    const units: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '10m': 10 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return units[window] || units['1h'];
  }

  private getWindowSeconds(window: string): number {
    return this.getWindowMilliseconds(window) / 1000;
  }

  public cleanup() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Singleton instance
let sliSloTracker: SLISLOTracker | null = null;

export function initializeSLISLOTracker(redis: Redis): SLISLOTracker {
  if (!sliSloTracker) {
    sliSloTracker = new SLISLOTracker(redis);
    logger.info('SLI/SLO tracker initialized');
  }
  return sliSloTracker;
}

export function getSLISLOTracker(): SLISLOTracker {
  if (!sliSloTracker) {
    throw new Error('SLI/SLO tracker not initialized');
  }
  return sliSloTracker;
}