import { logger } from './logger';
import { metrics } from './metrics';

export interface AIOperationOptions {
  operation: string;
  model: string;
  provider: string;
  userId?: string;
  documentId?: string;
}

export interface AIOperationResult<T> {
  result: T;
  metadata: {
    duration: number;
    tokensUsed?: number;
    cost?: number;
  };
}

/**
 * Wraps an AI operation with comprehensive monitoring
 */
export async function monitorAIOperation<T>(
  options: AIOperationOptions,
  operation: () => Promise<T & { tokensUsed?: number; cost?: number }>
): Promise<AIOperationResult<T>> {
  const startTime = Date.now();
  const labels = {
    operation: options.operation,
    model: options.model,
    provider: options.provider,
  };

  // Increment operation counter
  metrics.aiOperationsTotal.inc(labels);

  try {
    // Execute the operation
    const result = await operation();
    const duration = Date.now() - startTime;

    // Extract metadata if available
    const { tokensUsed, cost, ...data } = result as any;

    // Log the operation
    logger.logAIOperation(
      options.operation,
      options.model,
      { operation: options.operation }, // Don't log actual prompts
      { success: true }, // Don't log actual responses
      {
        duration,
        tokensUsed,
        cost,
      }
    );

    // Record metrics
    metrics.aiOperationDuration.observe(labels, duration / 1000);
    
    if (tokensUsed) {
      metrics.aiTokensUsed.inc(labels, tokensUsed);
    }
    
    if (cost) {
      metrics.aiOperationCost.inc(labels, cost);
    }

    // Record performance metric
    logger.logPerformanceMetric(
      `ai.${options.operation}.duration`,
      duration,
      'ms',
      {
        model: options.model,
        provider: options.provider,
      }
    );

    return {
      result: data,
      metadata: {
        duration,
        tokensUsed,
        cost,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log the error
    logger.logAIOperation(
      options.operation,
      options.model,
      { operation: options.operation },
      null,
      {
        duration,
        error: error as Error,
      }
    );

    // Record error metrics
    metrics.aiOperationsErrors.inc({
      ...labels,
      error_type: error instanceof Error ? error.constructor.name : 'unknown',
    });

    // Log security event if it's an auth error
    if (error instanceof Error && error.message.includes('401')) {
      logger.logSecurityEvent('ai_auth_failure', 'high', {
        provider: options.provider,
        model: options.model,
        error: error.message,
      });
    }

    throw error;
  }
}

/**
 * Monitor AI model selection decisions
 */
export function logModelSelection(
  requestedModel: string,
  selectedModel: string,
  reason: string,
  metadata?: {
    userTier?: string;
    complexity?: number;
    fallbackReason?: string;
  }
) {
  logger.info({
    type: 'ai_model_selection',
    requestedModel,
    selectedModel,
    reason,
    ...metadata,
  }, 'AI model selected');

  if (requestedModel !== selectedModel) {
    metrics.aiModelFallbacks.inc({
      from_model: requestedModel,
      to_model: selectedModel,
      reason: metadata?.fallbackReason || reason,
    });
  }
}

/**
 * Monitor rate limiting for AI operations
 */
export function logAIRateLimit(
  model: string,
  provider: string,
  limit: number,
  remaining: number,
  resetTime?: Date
) {
  const utilizationPercent = ((limit - remaining) / limit) * 100;

  logger.warn({
    type: 'ai_rate_limit',
    model,
    provider,
    limit,
    remaining,
    utilizationPercent,
    resetTime,
  }, 'AI rate limit status');

  // Alert if usage is high
  if (utilizationPercent > 80) {
    logger.logSecurityEvent('ai_rate_limit_warning', 'medium', {
      model,
      provider,
      utilizationPercent,
      remaining,
    });
  }

  metrics.aiRateLimitUtilization.set(
    { model, provider },
    utilizationPercent
  );
}

/**
 * Create a monitored AI client wrapper
 */
export function createMonitoredAIClient<T extends object>(
  client: T,
  provider: string,
  model: string
): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value === 'function') {
        return async (...args: any[]) => {
          return monitorAIOperation(
            {
              operation: String(prop),
              model,
              provider,
            },
            () => value.apply(target, args)
          );
        };
      }

      return value;
    },
  });
}