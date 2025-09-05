import { BaseAIProvider } from './base-provider'
import { GeminiProvider, OpenAIProvider, ClaudeProvider } from './providers'
import { ModelSelector } from './model-selector'
import { rateLimiter, apiKeyManager, costTracker, ModelSelectionLogger, ABTestManager } from './utils'
import {
  AIModel,
  UserTier,
  DocumentAnalysis,
  EnhancementRequest,
  EnhancementResult,
  AIProviderResponse,
  HealthStatus
} from './types'
import { DocumentAnalysisEngine, SupabaseAnalysisCache, DocumentContext } from '@/lib/analysis'
import { CircuitBreaker, getCircuitBreakerConfig, CircuitBreakerMetrics, CircuitState } from './circuit-breaker'
import { ProviderHealthMonitor } from './provider-health-monitor'
import { FallbackStrategySelector, CachedFallbackProvider } from './fallback-strategies'
import { traceAIOperation, recordPipelineEvent, recordModelFallback } from '@/lib/observability/tracing'
import { SpanStatusCode } from '@opentelemetry/api'

export class AIService {
  private providers: Map<AIModel, BaseAIProvider> = new Map()
  private circuitBreakers: Map<AIModel, CircuitBreaker<AIProviderResponse>> = new Map()
  private analysisEngine: DocumentAnalysisEngine
  private analysisCache: SupabaseAnalysisCache
  private healthMonitor: ProviderHealthMonitor
  private cachedFallbackProvider: CachedFallbackProvider

  constructor() {
    this.initializeProviders()
    this.initializeCircuitBreakers()
    this.analysisEngine = new DocumentAnalysisEngine()
    this.analysisCache = new SupabaseAnalysisCache()
    this.healthMonitor = new ProviderHealthMonitor(this.providers)
    this.cachedFallbackProvider = new CachedFallbackProvider()
    this.setupHealthMonitoring()
  }

  private initializeProviders(): void {
    // Initialize Gemini provider
    const geminiKey = apiKeyManager.getApiKey('gemini-2.0-flash')
    if (geminiKey) {
      this.providers.set('gemini-2.0-flash', new GeminiProvider({
        model: 'gemini-2.0-flash',
        apiKey: geminiKey
      }))
    }

    // Initialize OpenAI provider
    const openaiKey = apiKeyManager.getApiKey('gpt-4o-mini')
    if (openaiKey) {
      this.providers.set('gpt-4o-mini', new OpenAIProvider({
        model: 'gpt-4o-mini',
        apiKey: openaiKey
      }))
    }

    // Initialize Claude providers
    const claudeKey = apiKeyManager.getApiKey('claude-3.5-sonnet')
    if (claudeKey) {
      this.providers.set('claude-3.5-sonnet', new ClaudeProvider({
        model: 'claude-3.5-sonnet',
        apiKey: claudeKey
      }, 'claude-3.5-sonnet'))

      this.providers.set('claude-4-sonnet', new ClaudeProvider({
        model: 'claude-4-sonnet',
        apiKey: claudeKey
      }, 'claude-4-sonnet'))
    }
  }

  private initializeCircuitBreakers(): void {
    // Create circuit breaker for each provider with model-specific config
    for (const [model] of this.providers.entries()) {
      const config = getCircuitBreakerConfig(model)
      const breaker = new CircuitBreaker<AIProviderResponse>(
        model,
        config,
        async () => this.getFallbackResponse(model) // Request will be passed in context
      )
      
      // Monitor circuit state changes
      breaker.onStateChange((name, oldState, newState, metrics) => {
        console.log(`Circuit breaker ${name}: ${oldState} → ${newState}`, metrics)
        // Could emit events here for monitoring systems
      })
      
      this.circuitBreakers.set(model, breaker)
    }
  }

  private setupHealthMonitoring(): void {
    // Start health monitoring with 30-second interval
    this.healthMonitor.startMonitoring(30000)
    
    // Listen for health status changes
    this.healthMonitor.onHealthChange((model, oldStatus, newStatus, result) => {
      console.log(`Health status changed for ${model}: ${oldStatus} → ${newStatus}`)
      
      // If a provider becomes unhealthy, open its circuit breaker
      if (newStatus === 'unhealthy') {
        const breaker = this.circuitBreakers.get(model)
        if (breaker) {
          console.warn(`Opening circuit breaker for unhealthy provider: ${model}`)
          // The circuit breaker will handle its own state management
        }
      }
    })
  }

  private async getFallbackResponse(
    failedModel: AIModel,
    request?: EnhancementRequest
  ): Promise<AIProviderResponse> {
    // This is called when circuit is open
    // If we have request context, try fallback strategies
    if (request) {
      try {
        const fallbackResponse = await FallbackStrategySelector.selectStrategy(
          request.documentType,
          request.userTier,
          request,
          failedModel
        )

        // Convert fallback response to provider response format
        if (fallbackResponse.analysis || fallbackResponse.enhancements) {
          return {
            success: true,
            data: fallbackResponse.analysis || fallbackResponse.enhancements,
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 },
            metadata: {
              degraded: true,
              source: fallbackResponse.source,
              message: fallbackResponse.message
            }
          }
        }
      } catch (error) {
        console.error('Fallback strategy failed:', error)
      }
    }

    // Default response if no fallback available
    return {
      success: false,
      error: `Service temporarily unavailable for ${failedModel}. Circuit breaker is open.`,
      data: null,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
    }
  }

  private async analyzeWithCircuitBreaker(
    model: AIModel,
    imageUrl: string,
    request: EnhancementRequest
  ): Promise<AIProviderResponse> {
    const breaker = this.circuitBreakers.get(model)
    if (!breaker) {
      throw new Error(`No circuit breaker for model: ${model}`)
    }

    const provider = this.providers.get(model)
    if (!provider) {
      throw new Error(`No provider for model: ${model}`)
    }

    // Create tracing span for AI operation
    const span = traceAIOperation('document_analysis', model, {
      'ai.document_type': request.documentType,
      'ai.user_tier': request.userTier,
      'ai.image_url': imageUrl,
    })

    try {
      recordPipelineEvent('ai.analysis.started', {
        model,
        documentType: request.documentType,
      })

      const response = await breaker.execute(async () => {
        const response = await provider.analyzeDocument(imageUrl, request)
        
        // Circuit breaker considers these as failures
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Analysis failed')
        }
        
        return response
      })

      // Record success metrics
      if (response.usage) {
        span.setAttributes({
          'ai.tokens.prompt': response.usage.promptTokens,
          'ai.tokens.completion': response.usage.completionTokens,
          'ai.tokens.total': response.usage.totalTokens,
          'ai.cost': response.usage.cost,
        })
      }

      recordPipelineEvent('ai.analysis.completed', {
        model,
        tokensUsed: response.usage?.totalTokens,
      })

      span.setStatus({ code: SpanStatusCode.OK })
      return response
    } catch (error: any) {
      span.recordException(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      })

      // If circuit breaker is open, try fallback with request context
      if (error.message?.includes('Circuit breaker is open')) {
        recordModelFallback(model, 'circuit-breaker-fallback', 'Circuit breaker open')
        return await this.getFallbackResponse(model, request)
      }
      throw error
    } finally {
      span.end()
    }
  }

  private async enhanceWithCircuitBreaker(
    model: AIModel,
    analysis: DocumentAnalysis,
    request: EnhancementRequest
  ): Promise<AIProviderResponse> {
    const breaker = this.circuitBreakers.get(model)
    if (!breaker) {
      throw new Error(`No circuit breaker for model: ${model}`)
    }

    const provider = this.providers.get(model)
    if (!provider) {
      throw new Error(`No provider for model: ${model}`)
    }

    // Create tracing span for AI enhancement operation
    const span = traceAIOperation('enhancement_generation', model, {
      'ai.document_type': request.documentType,
      'ai.user_tier': request.userTier,
      'ai.analysis_score': analysis.overallScore,
    })

    try {
      recordPipelineEvent('ai.enhancement.started', {
        model,
        documentType: request.documentType,
        analysisScore: analysis.overallScore,
      })

      const response = await breaker.execute(async () => {
        const response = await provider.generateEnhancementPrompt(analysis, request)
        
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Enhancement generation failed')
        }
        
        return response
      })

      // Record success metrics
      if (response.usage) {
        span.setAttributes({
          'ai.tokens.prompt': response.usage.promptTokens,
          'ai.tokens.completion': response.usage.completionTokens,
          'ai.tokens.total': response.usage.totalTokens,
          'ai.cost': response.usage.cost,
        })
      }

      recordPipelineEvent('ai.enhancement.completed', {
        model,
        tokensUsed: response.usage?.totalTokens,
      })

      span.setStatus({ code: SpanStatusCode.OK })
      return response
    } catch (error: any) {
      span.recordException(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      })

      // If circuit breaker is open, try fallback with request context
      if (error.message?.includes('Circuit breaker is open')) {
        recordModelFallback(model, 'circuit-breaker-fallback', 'Circuit breaker open')
        return await this.getFallbackResponse(model, request)
      }
      throw error
    } finally {
      span.end()
    }
  }

  async analyzeDocument(
    imageUrl: string,
    request: EnhancementRequest,
    userId: string
  ): Promise<EnhancementResult> {
    const failedModels: AIModel[] = []
    let lastError: Error | null = null
    const startTime = Date.now()

    // Determine initial processing priority
    const processingPriority = ModelSelector.determineProcessingPriority(
      request.userTier,
      'medium', // Default complexity until we analyze
      request.preferences?.style === 'professional' ? 'quality' : undefined
    )

    // Try models based on selection criteria
    while (failedModels.length < 3) { // Max 3 attempts with different models
      const model = ModelSelector.selectModel({
        userTier: request.userTier,
        processingPriority,
        previousFailures: failedModels,
        documentType: request.documentType,
        costOptimization: request.userTier === 'free' || request.userTier === 'basic',
        estimatedTokens: 2500, // Rough estimate for document analysis
        userId
      })

      // Check health status before proceeding
      const healthStatus = this.healthMonitor.getHealthStatus(model)
      if (healthStatus && healthStatus.status === 'unhealthy') {
        lastError = new Error(`Provider ${model} is unhealthy`)
        failedModels.push(model)
        console.warn(`Skipping unhealthy provider: ${model}`)
        continue
      }

      // Check rate limit with user tier and estimated tokens
      const rateLimitCheck = await rateLimiter.checkLimit(model, userId, request.userTier, 2500)
      if (!rateLimitCheck.allowed) {
        lastError = new Error(`Rate limit exceeded. Retry after ${rateLimitCheck.retryAfter} seconds`)
        failedModels.push(model)
        continue
      }

      const provider = this.providers.get(model)
      if (!provider) {
        lastError = new Error(`Provider not available for model: ${model}`)
        failedModels.push(model)
        continue
      }

      try {
        // Perform document analysis with circuit breaker protection
        const analysisResponse = await this.analyzeWithCircuitBreaker(model, imageUrl, request)
        const analysis = analysisResponse.data!

        // Track costs and token usage for rate limiting
        if (analysisResponse.usage) {
          await costTracker.trackUsage(
            model,
            userId,
            imageUrl, // Using imageUrl as documentId for now
            analysisResponse.usage.totalTokens,
            analysisResponse.usage.cost
          )
          
          // Track token usage for rate limiting
          await rateLimiter.trackTokenUsage(
            model,
            userId,
            analysisResponse.usage.totalTokens,
            request.userTier
          )
        }

        // Generate enhancement suggestions with circuit breaker protection
        const enhancementResponse = await this.enhanceWithCircuitBreaker(model, analysis, request)

        // Track enhancement costs and token usage
        if (enhancementResponse.usage) {
          await costTracker.trackUsage(
            model,
            userId,
            imageUrl,
            enhancementResponse.usage.totalTokens,
            enhancementResponse.usage.cost
          )
          
          // Track token usage for rate limiting
          await rateLimiter.trackTokenUsage(
            model,
            userId,
            enhancementResponse.usage.totalTokens,
            request.userTier
          )
        }

        // Determine complexity and estimate processing time
        const complexity = ModelSelector.determineComplexityWithContext(
          analysis, 
          request.documentType
        )
        const estimatedTime = ModelSelector.estimateProcessingTime(model, complexity)

        // Parse enhancement suggestions from the prompt
        const suggestedEnhancements = this.parseEnhancementSuggestions(
          enhancementResponse.data,
          analysis
        )

        // Update performance metrics
        const totalTime = Date.now() - startTime
        const totalTokens = (analysisResponse.usage?.totalTokens || 0) + 
                          (enhancementResponse.usage?.totalTokens || 0)
        
        ModelSelector.updatePerformanceMetrics(
          model,
          totalTime,
          true, // Success
          totalTokens
        )

        // Log the successful model selection
        await ModelSelectionLogger.logSelection({
          userId,
          documentId: imageUrl, // Using URL as ID for now
          selectedModel: model,
          userTier: request.userTier,
          documentType: request.documentType,
          documentComplexity: complexity,
          processingPriority: processingPriority || 'balanced',
          selectionReason: `Selected based on tier: ${request.userTier}, complexity: ${complexity}`,
          alternativeModels: this.getAvailableModels(request.userTier).filter(m => m !== model),
          success: true,
          responseTime: totalTime,
          tokensUsed: totalTokens,
          cost: (analysisResponse.usage?.cost || 0) + (enhancementResponse.usage?.cost || 0)
        })

        // Record A/B test metrics if applicable
        if (userId) {
          const activeTests = ABTestManager.getActiveTestsForUser(userId, request.userTier)
          for (const test of activeTests) {
            ABTestManager.recordTestMetric(test.id, userId, 'completion_rate', 1)
            ABTestManager.recordTestMetric(test.id, userId, 'response_time', totalTime)
            ABTestManager.recordTestMetric(test.id, userId, 'cost_per_request', 
              (analysisResponse.usage?.cost || 0) + (enhancementResponse.usage?.cost || 0))
          }
        }

        return {
          analysis,
          suggestedEnhancements,
          estimatedProcessingTime: estimatedTime,
          modelUsed: model
        }

      } catch (error) {
        console.error(`Error with model ${model}:`, error)
        lastError = error as Error
        failedModels.push(model)

        // Record model fallback if we'll try another model
        if (failedModels.length < 3) {
          const nextModel = ModelSelector.selectModel({
            userTier: request.userTier,
            processingPriority,
            previousFailures: [...failedModels, model],
            documentType: request.documentType,
            costOptimization: request.userTier === 'free' || request.userTier === 'basic',
            estimatedTokens: 2500,
            userId
          })
          
          if (nextModel !== model) {
            recordModelFallback(model, nextModel, error instanceof Error ? error.message : 'Unknown error')
          }
        }

        // Track failure
        ModelSelector.updatePerformanceMetrics(
          model,
          Date.now() - startTime,
          false, // Failure
          0
        )

        // Log the failed model selection
        await ModelSelectionLogger.logSelection({
          userId,
          documentId: imageUrl,
          selectedModel: model,
          userTier: request.userTier,
          documentType: request.documentType,
          documentComplexity: 'medium', // Default as we haven't analyzed yet
          processingPriority: processingPriority || 'balanced',
          selectionReason: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          alternativeModels: this.getAvailableModels(request.userTier).filter(m => m !== model),
          success: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // All models failed
    throw lastError || new Error('All AI models failed to process the document')
  }

  async analyzeDocumentLocal(
    imageData: ImageData,
    documentId: string,
    documentType: 'worksheet' | 'presentation' | 'marketing',
    userPreferences?: {
      style?: 'modern' | 'classic' | 'playful' | 'professional'
      colorScheme?: 'vibrant' | 'muted' | 'monochrome'
      targetAudience?: 'children' | 'teens' | 'adults' | 'business'
    }
  ): Promise<DocumentAnalysis> {
    // Check cache first
    const cachedAnalysis = await this.analysisCache.get(documentId)
    if (cachedAnalysis) {
      return cachedAnalysis
    }

    // Create document context
    const context: DocumentContext = {
      imageData,
      metadata: {
        width: imageData.width,
        height: imageData.height,
        format: 'bitmap',
        size: imageData.data.length
      },
      type: documentType,
      userPreferences
    }

    // Run local analysis
    const analysis = await this.analysisEngine.generateCompleteAnalysis(context)

    // Cache the results
    await this.analysisCache.set(documentId, analysis)

    return analysis
  }

  private parseEnhancementSuggestions(prompt: string, analysis: DocumentAnalysis): Enhancement[] {
    const enhancements: Enhancement[] = []

    // Extract layout improvements
    if (analysis.layout.score < 80) {
      enhancements.push({
        type: 'layout',
        description: 'Improve document structure and spacing',
        priority: analysis.layout.score < 50 ? 'high' : 'medium',
        estimatedImpact: 100 - analysis.layout.score
      })
    }

    // Extract color improvements
    if (analysis.colors.score < 80) {
      enhancements.push({
        type: 'color',
        description: 'Enhance color palette for better harmony and contrast',
        priority: analysis.colors.score < 50 ? 'high' : 'medium',
        estimatedImpact: 100 - analysis.colors.score
      })
    }

    // Extract typography improvements
    if (analysis.typography.score < 80) {
      enhancements.push({
        type: 'typography',
        description: 'Optimize font choices and text hierarchy',
        priority: analysis.typography.score < 50 ? 'high' : 'medium',
        estimatedImpact: 100 - analysis.typography.score
      })
    }

    // Add graphic enhancement if overall score is low
    if (analysis.overallScore < 70) {
      enhancements.push({
        type: 'graphic',
        description: 'Add visual elements to increase engagement',
        priority: 'medium',
        estimatedImpact: 30
      })
    }

    return enhancements
  }

  // Get provider status with circuit breaker and health information
  getProviderStatus(): Record<AIModel, {
    available: boolean
    circuitState?: CircuitState
    circuitMetrics?: CircuitBreakerMetrics
    healthStatus?: HealthStatus
    healthMetrics?: {
      responseTime: number
      errorRate: number
      lastChecked: Date
    }
  }> {
    const models: AIModel[] = [
      'gemini-2.0-flash',
      'gpt-4o-mini',
      'claude-3.5-sonnet',
      'claude-4-sonnet'
    ]

    const status: Record<AIModel, {
      available: boolean
      circuitState?: CircuitState
      circuitMetrics?: CircuitBreakerMetrics
      healthStatus?: HealthStatus
      healthMetrics?: {
        responseTime: number
        errorRate: number
        lastChecked: Date
      }
    }> = {} as any

    for (const model of models) {
      const breaker = this.circuitBreakers.get(model)
      const health = this.healthMonitor.getHealthStatus(model)
      
      status[model] = {
        available: this.providers.has(model),
        circuitState: breaker?.getMetrics().state,
        circuitMetrics: breaker?.getMetrics(),
        healthStatus: health?.status,
        healthMetrics: health ? {
          responseTime: health.responseTime,
          errorRate: health.errorRate,
          lastChecked: health.lastChecked
        } : undefined
      }
    }

    return status
  }

  // Get circuit breaker metrics for all providers
  getCircuitBreakerMetrics(): Record<AIModel, CircuitBreakerMetrics | null> {
    const metrics: Record<AIModel, CircuitBreakerMetrics | null> = {} as any
    
    for (const [model, breaker] of this.circuitBreakers.entries()) {
      metrics[model] = breaker.getMetrics()
    }
    
    return metrics
  }

  // Get health monitoring information for all providers
  getHealthMonitoringInfo(): Map<AIModel, any> {
    return this.healthMonitor.getAllHealthStatuses()
  }

  // Check if a specific provider is healthy
  isProviderHealthy(model: AIModel): boolean {
    return this.healthMonitor.isProviderHealthy(model)
  }

  // Get available models for a user tier
  private getAvailableModels(userTier: UserTier): AIModel[] {
    const tierModels = {
      free: ['gemini-2.0-flash'] as AIModel[],
      basic: ['gemini-2.0-flash', 'gpt-4o-mini'] as AIModel[],
      pro: ['gpt-4o-mini', 'claude-3.5-sonnet', 'gemini-2.0-flash'] as AIModel[],
      premium: ['claude-4-sonnet', 'claude-3.5-sonnet', 'gpt-4o-mini', 'gemini-2.0-flash'] as AIModel[]
    }
    
    return tierModels[userTier].filter(model => this.providers.has(model))
  }

  // Validate configuration
  validateConfiguration(): {
    valid: boolean
    issues: string[]
  } {
    const issues: string[] = []
    
    // Check API keys
    const keyStatus = apiKeyManager.validateKeys()
    if (!keyStatus.valid) {
      issues.push(`Missing API keys for: ${keyStatus.missing.join(', ')}`)
    }

    // Check providers
    const providerStatus = this.getProviderStatus()
    const missingProviders = Object.entries(providerStatus)
      .filter(([, available]) => !available)
      .map(([model]) => model)

    if (missingProviders.length > 0) {
      issues.push(`Providers not initialized for: ${missingProviders.join(', ')}`)
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }
}

// Type import for Enhancement
interface Enhancement {
  type: 'layout' | 'color' | 'typography' | 'graphic' | 'content'
  description: string
  priority: 'low' | 'medium' | 'high'
  estimatedImpact: number
}

// Singleton instance
export const aiService = new AIService()