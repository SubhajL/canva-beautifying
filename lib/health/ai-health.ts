import type { HealthCheckResult } from './types';
import { aiService } from '@/lib/ai/ai-service';
import { logger } from '@/lib/observability';

interface AIProviderHealth {
  provider: string;
  model: string;
  available: boolean;
  responseTime?: number;
  error?: string;
  healthStatus?: string;
  errorRate?: number;
  circuitState?: string;
}

export async function checkAIHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const providers: AIProviderHealth[] = [];

  try {
    // Get provider status from AI service which includes health monitoring
    const providerStatus = aiService.getProviderStatus();
    
    for (const [model, status] of Object.entries(providerStatus)) {
      const provider: AIProviderHealth = {
        provider: model.includes('gemini') ? 'google' : 
                 model.includes('gpt') ? 'openai' : 
                 model.includes('claude') ? 'anthropic' : 'unknown',
        model,
        available: status.available && status.healthStatus !== 'unhealthy',
        responseTime: status.healthMetrics?.responseTime,
        healthStatus: status.healthStatus,
        errorRate: status.healthMetrics?.errorRate,
        circuitState: status.circuitState
      };
      
      if (!provider.available) {
        if (status.healthStatus === 'unhealthy') {
          provider.error = 'Provider health check failed';
        } else if (!status.available) {
          provider.error = 'Provider not configured';
        }
      }
      
      providers.push(provider);
    }

    const availableProviders = providers.filter(p => p.available).length;
    const totalProviders = providers.length;
    const availability = totalProviders > 0 ? (availableProviders / totalProviders) * 100 : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let error: string | undefined;

    if (availability === 0) {
      status = 'unhealthy';
      error = 'No AI providers available';
    } else if (availability < 50) {
      status = 'degraded';
      error = `Only ${availableProviders} of ${totalProviders} providers available`;
    }

    const responseTime = Date.now() - startTime;

    return {
      service: 'ai',
      status,
      responseTime,
      error,
      details: {
        providers,
        availableCount: availableProviders,
        totalCount: totalProviders,
        availabilityPercent: availability,
        healthMonitoring: {
          enabled: true,
          checkInterval: 30000, // 30 seconds
          lastCheck: new Date().toISOString()
        }
      }
    };
  } catch (error) {
    logger.error({ err: error }, 'AI health check failed');
    return {
      service: 'ai',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}