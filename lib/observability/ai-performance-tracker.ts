import { Redis } from 'ioredis';
import { logger } from './logger';
import { metrics } from './metrics';
import { getPerformanceMonitor } from './performance-monitor';
import { traceAsync } from './tracing';
import type { PerformanceMetric } from './performance-monitor';

export interface AIModelPerformance {
  model: string;
  provider: string;
  operation: string;
  duration: number;
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  success: boolean;
  error?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AIModelStats {
  model: string;
  provider: string;
  period: '1h' | '24h' | '7d' | '30d';
  requests: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  };
  performance: {
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
  };
  tokens: {
    total: number;
    avgPerRequest: number;
    promptAvg: number;
    completionAvg: number;
  };
  cost: {
    total: number;
    avgPerRequest: number;
    perToken: number;
  };
  errors: Record<string, number>;
  timestamp: number;
}

export interface ModelSelectionCriteria {
  maxLatency?: number; // ms
  maxCostPerRequest?: number; // dollars
  minSuccessRate?: number; // percentage
  preferredProviders?: string[];
  excludeModels?: string[];
}

export interface ModelRecommendation {
  model: string;
  provider: string;
  score: number;
  reasons: string[];
  stats: {
    avgLatency: number;
    successRate: number;
    avgCost: number;
    recentErrors: number;
  };
}

export class AIPerformanceTracker {
  private redis: Redis;
  private readonly TTL = {
    RAW: 86400,      // 24 hours for raw data
    '1h': 172800,    // 2 days for hourly stats
    '24h': 604800,   // 7 days for daily stats
    '7d': 2592000,   // 30 days for weekly stats
    '30d': 7776000   // 90 days for monthly stats
  };

  // Model cost configuration (per 1M tokens)
  private readonly modelCosts = new Map([
    // OpenAI
    ['gpt-4', { prompt: 30, completion: 60 }],
    ['gpt-4-turbo', { prompt: 10, completion: 30 }],
    ['gpt-3.5-turbo', { prompt: 1.5, completion: 2 }],
    ['gpt-4o-mini', { prompt: 0.15, completion: 0.6 }],
    
    // Anthropic
    ['claude-3-opus', { prompt: 15, completion: 75 }],
    ['claude-3-sonnet', { prompt: 3, completion: 15 }],
    ['claude-3-haiku', { prompt: 0.25, completion: 1.25 }],
    
    // Google
    ['gemini-2.0-flash', { prompt: 0.075, completion: 0.3 }],
    ['gemini-1.5-pro', { prompt: 3.5, completion: 10.5 }],
    ['gemini-1.5-flash', { prompt: 0.35, completion: 1.05 }],
  ]);

  constructor(redis: Redis) {
    this.redis = redis;
    this.startPeriodicAggregation();
  }

  public async trackModelPerformance(performance: AIModelPerformance) {
    await traceAsync('ai_performance.track', async () => {
      const key = this.getModelKey(performance.model, performance.provider);
      const value = JSON.stringify(performance);

      // Store raw performance data
      await this.redis.zadd(
        `ai:perf:raw:${key}`,
        performance.timestamp,
        value
      );
      await this.redis.expire(`ai:perf:raw:${key}`, this.TTL.RAW);

      // Update real-time metrics
      await this.updateRealtimeMetrics(performance);

      // Record in performance monitor
      const performanceMonitor = getPerformanceMonitor();
      await performanceMonitor.recordMetric({
        name: 'ai.model.latency',
        value: performance.duration,
        unit: 'ms',
        timestamp: performance.timestamp,
        tags: {
          model: performance.model,
          provider: performance.provider,
          operation: performance.operation
        }
      });

      if (performance.cost) {
        await performanceMonitor.recordMetric({
          name: 'ai.model.cost',
          value: performance.cost,
          unit: 'count',
          timestamp: performance.timestamp,
          tags: {
            model: performance.model,
            provider: performance.provider
          }
        });
      }

      // Update Prometheus metrics
      this.updatePrometheusMetrics(performance);

      logger.debug({
        model: performance.model,
        provider: performance.provider,
        duration: performance.duration,
        success: performance.success
      }, 'Tracked AI model performance');
    });
  }

  private async updateRealtimeMetrics(performance: AIModelPerformance) {
    const hourKey = this.getHourBucket(performance.timestamp);
    const statsKey = `ai:stats:${performance.model}:${performance.provider}:${hourKey}`;

    const pipeline = this.redis.pipeline();

    // Increment counters
    pipeline.hincrby(statsKey, 'total', 1);
    pipeline.hincrby(statsKey, performance.success ? 'successful' : 'failed', 1);

    // Add duration to sorted set for percentile calculations
    pipeline.zadd(
      `${statsKey}:durations`,
      performance.duration,
      `${performance.timestamp}:${Math.random()}`
    );

    // Update token usage
    if (performance.tokensUsed) {
      pipeline.hincrby(statsKey, 'tokens:total', performance.tokensUsed.total);
      pipeline.hincrby(statsKey, 'tokens:prompt', performance.tokensUsed.prompt);
      pipeline.hincrby(statsKey, 'tokens:completion', performance.tokensUsed.completion);
    }

    // Update cost
    if (performance.cost) {
      pipeline.hincrbyfloat(statsKey, 'cost:total', performance.cost);
    }

    // Track errors
    if (!performance.success && performance.error) {
      const errorType = this.categorizeError(performance.error);
      pipeline.hincrby(statsKey, `errors:${errorType}`, 1);
    }

    // Set TTL
    pipeline.expire(statsKey, this.TTL['1h']);
    pipeline.expire(`${statsKey}:durations`, this.TTL['1h']);

    await pipeline.exec();
  }

  private categorizeError(error: string): string {
    if (error.includes('rate limit')) return 'rate_limit';
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('token') || error.includes('context')) return 'token_limit';
    if (error.includes('auth') || error.includes('key')) return 'auth';
    if (error.includes('server') || error.includes('500')) return 'server_error';
    return 'other';
  }

  public async getModelStats(
    model: string,
    provider: string,
    period: '1h' | '24h' | '7d' | '30d' = '1h'
  ): Promise<AIModelStats | null> {
    const key = `ai:aggregate:${model}:${provider}:${period}`;
    const latestData = await this.redis.zrevrange(key, 0, 0, 'WITHSCORES');

    if (latestData.length === 0) {
      return null;
    }

    return JSON.parse(latestData[0]) as AIModelStats;
  }

  public async getAllModelStats(
    period: '1h' | '24h' | '7d' | '30d' = '1h'
  ): Promise<AIModelStats[]> {
    const pattern = `ai:aggregate:*:*:${period}`;
    const keys = await this.redis.keys(pattern);

    const allStats = await Promise.all(
      keys.map(async (key) => {
        const latestData = await this.redis.zrevrange(key, 0, 0);
        return latestData.length > 0 ? JSON.parse(latestData[0]) as AIModelStats : null;
      })
    );

    return allStats.filter((stats): stats is AIModelStats => stats !== null);
  }

  public async recommendModel(
    operation: string,
    criteria: ModelSelectionCriteria = {}
  ): Promise<ModelRecommendation[]> {
    const allStats = await this.getAllModelStats('1h');
    const recommendations: ModelRecommendation[] = [];

    for (const stats of allStats) {
      // Skip excluded models
      if (criteria.excludeModels?.includes(stats.model)) continue;

      // Check provider preference
      const providerScore = criteria.preferredProviders?.includes(stats.provider) ? 10 : 0;

      // Check if model meets criteria
      if (criteria.maxLatency && stats.performance.avgDuration > criteria.maxLatency) continue;
      if (criteria.maxCostPerRequest && stats.cost.avgPerRequest > criteria.maxCostPerRequest) continue;
      if (criteria.minSuccessRate && stats.requests.successRate < criteria.minSuccessRate) continue;

      // Calculate score (0-100)
      let score = providerScore;
      
      // Success rate component (0-30 points)
      score += stats.requests.successRate * 0.3;
      
      // Latency component (0-30 points, inverse)
      const latencyScore = Math.max(0, 30 - (stats.performance.avgDuration / 100));
      score += latencyScore;
      
      // Cost component (0-30 points, inverse)
      const costScore = Math.max(0, 30 - (stats.cost.avgPerRequest * 100));
      score += costScore;
      
      // Recent performance (0-10 points)
      const recentErrors = Object.values(stats.errors).reduce((sum, count) => sum + count, 0);
      const errorScore = Math.max(0, 10 - (recentErrors / stats.requests.total) * 100);
      score += errorScore;

      const reasons: string[] = [];
      if (stats.requests.successRate >= 99) reasons.push('Very high reliability');
      if (stats.performance.avgDuration < 1000) reasons.push('Fast response time');
      if (stats.cost.avgPerRequest < 0.01) reasons.push('Cost effective');
      if (providerScore > 0) reasons.push('Preferred provider');

      recommendations.push({
        model: stats.model,
        provider: stats.provider,
        score: Math.round(score),
        reasons,
        stats: {
          avgLatency: Math.round(stats.performance.avgDuration),
          successRate: Math.round(stats.requests.successRate * 100) / 100,
          avgCost: Math.round(stats.cost.avgPerRequest * 1000) / 1000,
          recentErrors: recentErrors
        }
      });
    }

    // Sort by score descending
    return recommendations.sort((a, b) => b.score - a.score);
  }

  public async getModelCostAnalysis(
    startDate: Date,
    endDate: Date,
    groupBy: 'model' | 'provider' | 'day' = 'model'
  ): Promise<Record<string, {
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    avgCostPerRequest: number;
    avgTokensPerRequest: number;
  }>> {
    const results: Record<string, any> = {};
    
    // Get all model stats for the period
    const allStats = await this.getAllModelStats('24h');
    
    for (const stats of allStats) {
      const key = groupBy === 'model' ? stats.model : stats.provider;
      
      if (!results[key]) {
        results[key] = {
          totalCost: 0,
          totalTokens: 0,
          requestCount: 0,
          avgCostPerRequest: 0,
          avgTokensPerRequest: 0
        };
      }
      
      results[key].totalCost += stats.cost.total;
      results[key].totalTokens += stats.tokens.total;
      results[key].requestCount += stats.requests.total;
    }
    
    // Calculate averages
    for (const key in results) {
      if (results[key].requestCount > 0) {
        results[key].avgCostPerRequest = results[key].totalCost / results[key].requestCount;
        results[key].avgTokensPerRequest = results[key].totalTokens / results[key].requestCount;
      }
    }
    
    return results;
  }

  private async startPeriodicAggregation() {
    // Aggregate hourly stats every 5 minutes
    setInterval(async () => {
      await this.aggregateStats('1h');
    }, 5 * 60 * 1000);

    // Aggregate daily stats every hour
    setInterval(async () => {
      await this.aggregateStats('24h');
    }, 60 * 60 * 1000);

    logger.info('AI performance aggregation started');
  }

  private async aggregateStats(period: '1h' | '24h' | '7d' | '30d') {
    try {
      const models = await this.getActiveModels();
      
      for (const { model, provider } of models) {
        const stats = await this.computeModelStats(model, provider, period);
        if (stats) {
          const key = `ai:aggregate:${model}:${provider}:${period}`;
          await this.redis.zadd(
            key,
            stats.timestamp,
            JSON.stringify(stats)
          );
          await this.redis.expire(key, this.TTL[period]);
        }
      }

      logger.debug({ period }, 'Completed AI performance aggregation');
    } catch (error) {
      logger.error({ err: error, period }, 'Failed to aggregate AI stats');
    }
  }

  private async getActiveModels(): Promise<Array<{ model: string; provider: string }>> {
    const keys = await this.redis.keys('ai:perf:raw:*');
    const models = new Set<string>();
    
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 4) {
        models.add(parts[3]);
      }
    }
    
    return Array.from(models).map(modelKey => {
      const [model, provider] = modelKey.split('|');
      return { model, provider };
    });
  }

  private async computeModelStats(
    model: string,
    provider: string,
    period: '1h' | '24h' | '7d' | '30d'
  ): Promise<AIModelStats | null> {
    const now = Date.now();
    const periodMs = this.getPeriodMilliseconds(period);
    const from = now - periodMs;
    
    const key = this.getModelKey(model, provider);
    const rawData = await this.redis.zrangebyscore(
      `ai:perf:raw:${key}`,
      from,
      now
    );
    
    if (rawData.length === 0) return null;
    
    const performances = rawData.map(d => JSON.parse(d) as AIModelPerformance);
    const durations = performances.map(p => p.duration).sort((a, b) => a - b);
    
    const successful = performances.filter(p => p.success).length;
    const failed = performances.length - successful;
    
    // Calculate token totals
    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    
    const errors: Record<string, number> = {};
    
    for (const perf of performances) {
      if (perf.tokensUsed) {
        totalTokens += perf.tokensUsed.total;
        totalPromptTokens += perf.tokensUsed.prompt;
        totalCompletionTokens += perf.tokensUsed.completion;
      }
      
      if (perf.cost) {
        totalCost += perf.cost;
      }
      
      if (!perf.success && perf.error) {
        const errorType = this.categorizeError(perf.error);
        errors[errorType] = (errors[errorType] || 0) + 1;
      }
    }
    
    return {
      model,
      provider,
      period,
      requests: {
        total: performances.length,
        successful,
        failed,
        successRate: performances.length > 0 ? successful / performances.length : 0
      },
      performance: {
        avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        p50Duration: this.percentile(durations, 50),
        p95Duration: this.percentile(durations, 95),
        p99Duration: this.percentile(durations, 99)
      },
      tokens: {
        total: totalTokens,
        avgPerRequest: performances.length > 0 ? totalTokens / performances.length : 0,
        promptAvg: performances.length > 0 ? totalPromptTokens / performances.length : 0,
        completionAvg: performances.length > 0 ? totalCompletionTokens / performances.length : 0
      },
      cost: {
        total: totalCost,
        avgPerRequest: performances.length > 0 ? totalCost / performances.length : 0,
        perToken: totalTokens > 0 ? totalCost / totalTokens : 0
      },
      errors,
      timestamp: now
    };
  }

  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private getPeriodMilliseconds(period: '1h' | '24h' | '7d' | '30d'): number {
    const ms = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    return ms[period];
  }

  private getModelKey(model: string, provider: string): string {
    return `${model}|${provider}`;
  }

  private getHourBucket(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}-${String(date.getUTCHours()).padStart(2, '0')}`;
  }

  private updatePrometheusMetrics(performance: AIModelPerformance) {
    const labels = {
      model: performance.model,
      provider: performance.provider,
      operation: performance.operation
    };

    // Update operation counter
    metrics.aiOperationsTotal.inc(labels);

    // Update duration histogram
    metrics.aiOperationDuration.observe(labels, performance.duration / 1000);

    // Update token usage
    if (performance.tokensUsed) {
      metrics.aiTokensUsed.inc(labels, performance.tokensUsed.total);
    }

    // Update cost
    if (performance.cost) {
      metrics.aiOperationCost.inc(labels, performance.cost);
    }

    // Update errors
    if (!performance.success) {
      metrics.aiOperationsErrors.inc({
        ...labels,
        error_type: this.categorizeError(performance.error || 'unknown')
      });
    }
  }

  public async calculateModelCost(
    model: string,
    tokensUsed: { prompt: number; completion: number }
  ): number {
    const costs = this.modelCosts.get(model);
    if (!costs) return 0;

    return (
      (tokensUsed.prompt / 1_000_000) * costs.prompt +
      (tokensUsed.completion / 1_000_000) * costs.completion
    );
  }
}

// Singleton instance
let aiPerformanceTracker: AIPerformanceTracker | null = null;

export function initializeAIPerformanceTracker(redis: Redis): AIPerformanceTracker {
  if (!aiPerformanceTracker) {
    aiPerformanceTracker = new AIPerformanceTracker(redis);
    logger.info('AI performance tracker initialized');
  }
  return aiPerformanceTracker;
}

export function getAIPerformanceTracker(): AIPerformanceTracker {
  if (!aiPerformanceTracker) {
    throw new Error('AI performance tracker not initialized');
  }
  return aiPerformanceTracker;
}