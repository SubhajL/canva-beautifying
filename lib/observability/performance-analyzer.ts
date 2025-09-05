import { EventEmitter } from 'events';
import os from 'os';
import { logger } from './logger';
import { getPerformanceMonitor } from './performance-monitor';
import { metrics } from './metrics';
import { traceAsync } from './tracing';

export interface ResourceUsage {
  cpu: {
    usage: number; // percentage
    loadAverage: [number, number, number];
    cores: number;
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    percent: number;
    heap: {
      used: number;
      total: number;
      percent: number;
    };
  };
  eventLoop: {
    lag: number; // ms
    utilization: number; // percentage
  };
  handles: {
    activeHandles: number;
    activeRequests: number;
  };
}

export interface PerformanceBottleneck {
  type: 'cpu' | 'memory' | 'eventLoop' | 'io';
  severity: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  recommendation: string;
  timestamp: number;
}

export class PerformanceAnalyzer extends EventEmitter {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventLoopMonitor: NodeJS.Timeout | null = null;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;
  private lastMeasureTime: number = 0;
  private eventLoopLag: number = 0;
  private readonly MONITORING_INTERVAL = 5000; // 5 seconds
  private readonly EVENT_LOOP_INTERVAL = 100; // 100ms
  
  // Bottleneck detection thresholds
  private readonly thresholds = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    eventLoopLag: { warning: 50, critical: 100 }, // ms
    eventLoopUtilization: { warning: 0.8, critical: 0.95 }
  };

  constructor() {
    super();
    this.startMonitoring();
  }

  private startMonitoring() {
    // Start event loop lag monitoring
    this.eventLoopMonitor = setInterval(() => {
      const start = Date.now();
      setImmediate(() => {
        this.eventLoopLag = Date.now() - start;
      });
    }, this.EVENT_LOOP_INTERVAL);

    // Start resource monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.MONITORING_INTERVAL);

    logger.info('Performance analyzer started');
  }

  private async collectMetrics() {
    try {
      const usage = await this.getResourceUsage();
      
      // Record metrics
      const performanceMonitor = getPerformanceMonitor();
      
      // CPU metrics
      await performanceMonitor.recordMetric({
        name: 'system.cpu.usage',
        value: usage.cpu.usage,
        unit: 'percent',
        timestamp: Date.now(),
        metadata: { loadAverage: usage.cpu.loadAverage }
      });

      // Memory metrics
      await performanceMonitor.recordMetric({
        name: 'system.memory.usage',
        value: usage.memory.percent,
        unit: 'percent',
        timestamp: Date.now(),
        metadata: {
          used: usage.memory.used,
          total: usage.memory.total
        }
      });

      await performanceMonitor.recordMetric({
        name: 'system.heap.usage',
        value: usage.memory.heap.percent,
        unit: 'percent',
        timestamp: Date.now(),
        metadata: {
          used: usage.memory.heap.used,
          total: usage.memory.heap.total
        }
      });

      // Event loop metrics
      await performanceMonitor.recordMetric({
        name: 'system.eventloop.lag',
        value: usage.eventLoop.lag,
        unit: 'ms',
        timestamp: Date.now()
      });

      await performanceMonitor.recordMetric({
        name: 'system.eventloop.utilization',
        value: usage.eventLoop.utilization * 100,
        unit: 'percent',
        timestamp: Date.now()
      });

      // Update Prometheus metrics
      metrics.systemCpuUsage.set(usage.cpu.usage);
      metrics.systemMemoryUsage.set({ type: 'percent' }, usage.memory.percent);

      // Detect bottlenecks
      const bottlenecks = this.detectBottlenecks(usage);
      if (bottlenecks.length > 0) {
        this.emit('bottleneck', bottlenecks);
        
        for (const bottleneck of bottlenecks) {
          logger.warn({
            bottleneck,
            type: 'performance_bottleneck'
          }, 'Performance bottleneck detected');
        }
      }

    } catch (error) {
      logger.error({ err: error }, 'Failed to collect performance metrics');
    }
  }

  private async getResourceUsage(): Promise<ResourceUsage> {
    return traceAsync('performance.get_resource_usage', async () => {
      const now = Date.now();
      
      // CPU usage calculation
      const cpuUsage = process.cpuUsage(this.lastCpuUsage || undefined);
      this.lastCpuUsage = cpuUsage;
      
      let cpuPercent = 0;
      if (this.lastMeasureTime > 0) {
        const elapsedTime = (now - this.lastMeasureTime) * 1000; // Convert to microseconds
        const totalCpuTime = cpuUsage.user + cpuUsage.system;
        cpuPercent = (totalCpuTime / elapsedTime) * 100;
      }
      this.lastMeasureTime = now;

      // Memory usage
      const memUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedMemory = totalMemory - freeMemory;

      // Event loop utilization (if available in Node.js 14.10+)
      let eventLoopUtilization = 0;
      if (performance.eventLoopUtilization) {
        const elu = performance.eventLoopUtilization();
        eventLoopUtilization = elu.utilization;
      }

      return {
        cpu: {
          usage: Math.min(cpuPercent, 100),
          loadAverage: os.loadavg() as [number, number, number],
          cores: os.cpus().length
        },
        memory: {
          used: usedMemory,
          total: totalMemory,
          percent: (usedMemory / totalMemory) * 100,
          heap: {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percent: (memUsage.heapUsed / memUsage.heapTotal) * 100
          }
        },
        eventLoop: {
          lag: this.eventLoopLag,
          utilization: eventLoopUtilization
        },
        handles: {
          activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
          activeRequests: (process as any)._getActiveRequests?.()?.length || 0
        }
      };
    });
  }

  private detectBottlenecks(usage: ResourceUsage): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];

    // CPU bottleneck
    if (usage.cpu.usage >= this.thresholds.cpu.critical) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'critical',
        metric: 'cpu.usage',
        value: usage.cpu.usage,
        threshold: this.thresholds.cpu.critical,
        recommendation: 'CPU usage is critically high. Consider scaling horizontally or optimizing CPU-intensive operations.',
        timestamp: Date.now()
      });
    } else if (usage.cpu.usage >= this.thresholds.cpu.warning) {
      bottlenecks.push({
        type: 'cpu',
        severity: 'warning',
        metric: 'cpu.usage',
        value: usage.cpu.usage,
        threshold: this.thresholds.cpu.warning,
        recommendation: 'CPU usage is high. Monitor for sustained high usage.',
        timestamp: Date.now()
      });
    }

    // Memory bottleneck
    if (usage.memory.percent >= this.thresholds.memory.critical) {
      bottlenecks.push({
        type: 'memory',
        severity: 'critical',
        metric: 'memory.usage',
        value: usage.memory.percent,
        threshold: this.thresholds.memory.critical,
        recommendation: 'Memory usage is critically high. Check for memory leaks or increase available memory.',
        timestamp: Date.now()
      });
    } else if (usage.memory.percent >= this.thresholds.memory.warning) {
      bottlenecks.push({
        type: 'memory',
        severity: 'warning',
        metric: 'memory.usage',
        value: usage.memory.percent,
        threshold: this.thresholds.memory.warning,
        recommendation: 'Memory usage is high. Monitor for memory leaks.',
        timestamp: Date.now()
      });
    }

    // Event loop bottleneck
    if (usage.eventLoop.lag >= this.thresholds.eventLoopLag.critical) {
      bottlenecks.push({
        type: 'eventLoop',
        severity: 'critical',
        metric: 'eventLoop.lag',
        value: usage.eventLoop.lag,
        threshold: this.thresholds.eventLoopLag.critical,
        recommendation: 'Event loop lag is critically high. Offload synchronous operations to worker threads.',
        timestamp: Date.now()
      });
    } else if (usage.eventLoop.lag >= this.thresholds.eventLoopLag.warning) {
      bottlenecks.push({
        type: 'eventLoop',
        severity: 'warning',
        metric: 'eventLoop.lag',
        value: usage.eventLoop.lag,
        threshold: this.thresholds.eventLoopLag.warning,
        recommendation: 'Event loop lag detected. Review synchronous operations.',
        timestamp: Date.now()
      });
    }

    return bottlenecks;
  }

  public async analyzeTrends(
    duration: '1h' | '24h' = '1h',
    metrics: string[] = ['system.cpu.usage', 'system.memory.usage', 'system.eventloop.lag']
  ): Promise<Record<string, {
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
    prediction?: {
      willExceedThreshold: boolean;
      estimatedTime?: string;
      threshold: number;
    };
  }>> {
    const performanceMonitor = getPerformanceMonitor();
    const results: Record<string, any> = {};

    for (const metric of metrics) {
      const data = await performanceMonitor.getMetrics(metric, {
        period: duration === '1h' ? '5m' : '1h',
        limit: 100
      });

      if (data.length < 2) {
        results[metric] = {
          trend: 'stable',
          changePercent: 0
        };
        continue;
      }

      // Simple linear regression for trend analysis
      const points = data.map((d, i) => ({
        x: i,
        y: 'avg' in d ? d.avg : (d as any).value
      }));

      const n = points.length;
      const sumX = points.reduce((sum, p) => sum + p.x, 0);
      const sumY = points.reduce((sum, p) => sum + p.y, 0);
      const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
      const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const avgY = sumY / n;
      const changePercent = (slope / avgY) * 100;

      let trend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(changePercent) < 5) {
        trend = 'stable';
      } else if (changePercent > 0) {
        trend = 'increasing';
      } else {
        trend = 'decreasing';
      }

      // Predict threshold breach
      const threshold = this.getThresholdForMetric(metric);
      let prediction;
      
      if (trend === 'increasing' && threshold) {
        const currentValue = points[points.length - 1].y;
        if (currentValue < threshold) {
          const stepsToThreshold = (threshold - currentValue) / slope;
          if (stepsToThreshold > 0 && stepsToThreshold < 100) {
            const timeToThreshold = stepsToThreshold * (duration === '1h' ? 5 : 60); // minutes
            prediction = {
              willExceedThreshold: true,
              estimatedTime: `${Math.round(timeToThreshold)} minutes`,
              threshold
            };
          }
        }
      }

      results[metric] = {
        trend,
        changePercent: Math.round(changePercent * 100) / 100,
        prediction
      };
    }

    return results;
  }

  private getThresholdForMetric(metric: string): number | null {
    switch (metric) {
      case 'system.cpu.usage':
        return this.thresholds.cpu.warning;
      case 'system.memory.usage':
        return this.thresholds.memory.warning;
      case 'system.eventloop.lag':
        return this.thresholds.eventLoopLag.warning;
      default:
        return null;
    }
  }

  public stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.eventLoopMonitor) {
      clearInterval(this.eventLoopMonitor);
      this.eventLoopMonitor = null;
    }

    logger.info('Performance analyzer stopped');
  }
}

// Singleton instance
let performanceAnalyzer: PerformanceAnalyzer | null = null;

export function initializePerformanceAnalyzer(): PerformanceAnalyzer {
  if (!performanceAnalyzer) {
    performanceAnalyzer = new PerformanceAnalyzer();
  }
  return performanceAnalyzer;
}

export function getPerformanceAnalyzer(): PerformanceAnalyzer {
  if (!performanceAnalyzer) {
    throw new Error('Performance analyzer not initialized');
  }
  return performanceAnalyzer;
}