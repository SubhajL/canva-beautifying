import { BaseAIProvider } from '@/lib/ai/providers/base';
import { monitorAIOperation, logModelSelection, logAIRateLimit } from '../ai-monitoring';
import { logger } from '../logger';
import { metrics } from '../metrics';

/**
 * Enhanced AI Provider that adds monitoring to any AI provider
 */
export class MonitoredAIProvider extends BaseAIProvider {
  private provider: BaseAIProvider;
  private providerName: string;

  constructor(provider: BaseAIProvider, providerName: string) {
    super();
    this.provider = provider;
    this.providerName = providerName;
  }

  get model(): string {
    return this.provider.model;
  }

  async analyzeDocument(imageData: string, options?: any) {
    return monitorAIOperation(
      {
        operation: 'analyzeDocument',
        model: this.model,
        provider: this.providerName,
        userId: options?.userId,
        documentId: options?.documentId,
      },
      async () => {
        const startTime = Date.now();
        
        try {
          const result = await this.provider.analyzeDocument(imageData, options);
          const duration = Date.now() - startTime;
          
          // Extract token usage if available
          const tokensUsed = (result as any).usage?.total_tokens;
          const cost = this.calculateCost(tokensUsed);

          return {
            ...result,
            tokensUsed,
            cost,
          };
        } catch (error) {
          // Check if it's a rate limit error
          if (error instanceof Error && error.message.includes('rate limit')) {
            this.handleRateLimit(error);
          }
          throw error;
        }
      }
    );
  }

  async generateEnhancement(analysis: any, originalImage: string, options?: any) {
    return monitorAIOperation(
      {
        operation: 'generateEnhancement',
        model: this.model,
        provider: this.providerName,
        userId: options?.userId,
        documentId: options?.documentId,
      },
      async () => {
        const startTime = Date.now();
        
        try {
          const result = await this.provider.generateEnhancement(
            analysis,
            originalImage,
            options
          );
          const duration = Date.now() - startTime;
          
          // Extract token usage if available
          const tokensUsed = (result as any).usage?.total_tokens;
          const cost = this.calculateCost(tokensUsed);

          return {
            ...result,
            tokensUsed,
            cost,
          };
        } catch (error) {
          // Check if it's a rate limit error
          if (error instanceof Error && error.message.includes('rate limit')) {
            this.handleRateLimit(error);
          }
          throw error;
        }
      }
    );
  }

  async generateAssets(enhancement: any, options?: any) {
    return monitorAIOperation(
      {
        operation: 'generateAssets',
        model: this.model,
        provider: this.providerName,
        userId: options?.userId,
        documentId: options?.documentId,
      },
      async () => {
        const startTime = Date.now();
        
        try {
          const result = await this.provider.generateAssets(enhancement, options);
          const duration = Date.now() - startTime;
          
          // Track number of assets generated
          metrics.aiOperationsTotal.inc({
            operation: 'generateAssets.asset',
            model: this.model,
            provider: this.providerName,
          }, (result as any).assets?.length || 0);

          return {
            ...result,
            cost: this.calculateAssetGenerationCost((result as any).assets?.length || 0),
          };
        } catch (error) {
          // Check if it's a rate limit error
          if (error instanceof Error && error.message.includes('rate limit')) {
            this.handleRateLimit(error);
          }
          throw error;
        }
      }
    );
  }

  private calculateCost(tokensUsed?: number): number {
    if (!tokensUsed) return 0;

    // Example cost calculation - adjust based on actual provider pricing
    const costPerToken = {
      'gpt-4': 0.00003,
      'gpt-3.5-turbo': 0.000002,
      'claude-3-opus': 0.00003,
      'claude-3-sonnet': 0.00001,
      'gemini-pro': 0.000001,
    };

    const rate = costPerToken[this.model] || 0.000001;
    return tokensUsed * rate;
  }

  private calculateAssetGenerationCost(assetCount: number): number {
    // Example: $0.04 per image generation
    return assetCount * 0.04;
  }

  private handleRateLimit(error: Error) {
    // Extract rate limit info from error if available
    const match = error.message.match(/limit: (\d+), remaining: (\d+)/);
    if (match) {
      const limit = parseInt(match[1]);
      const remaining = parseInt(match[2]);
      
      logAIRateLimit(
        this.model,
        this.providerName,
        limit,
        remaining
      );
    }
  }
}

/**
 * Example of integrating with ModelSelector
 */
export class MonitoredModelSelector {
  static selectModel(
    userTier: string,
    documentComplexity: number,
    preferredModel?: string
  ): { model: string; provider: string; reason: string } {
    const startTime = Date.now();
    
    // Simulate model selection logic
    const result = {
      model: preferredModel || 'gpt-4',
      provider: 'openai',
      reason: 'Selected based on user tier and complexity',
    };

    // Log the selection
    logModelSelection(
      preferredModel || 'auto',
      result.model,
      result.reason,
      {
        userTier,
        complexity: documentComplexity,
      }
    );

    // Record selection time
    const duration = Date.now() - startTime;
    logger.logPerformanceMetric(
      'ai.model_selection.duration',
      duration,
      'ms',
      {
        user_tier: userTier,
        complexity: documentComplexity.toString(),
      }
    );

    return result;
  }
}

/**
 * Example usage in AI service
 */
export function createMonitoredAIService() {
  // This would be integrated into the actual AI service
  logger.info('Creating monitored AI service');

  // Example of monitoring AI provider initialization
  const initStartTime = Date.now();
  
  // ... initialize providers ...
  
  const initDuration = Date.now() - initStartTime;
  logger.logPerformanceMetric(
    'ai.service.initialization',
    initDuration,
    'ms'
  );

  metrics.aiOperationsTotal.inc({
    operation: 'service_initialized',
    model: 'all',
    provider: 'all',
  });
}