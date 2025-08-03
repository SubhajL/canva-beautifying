import { BaseAIProvider } from './base-provider'
import { GeminiProvider, OpenAIProvider, ClaudeProvider } from './providers'
import { ModelSelector } from './model-selector'
import { rateLimiter, apiKeyManager, costTracker, ModelSelectionLogger, ABTestManager } from './utils'
import {
  AIModel,
  UserTier,
  DocumentAnalysis,
  EnhancementRequest,
  EnhancementResult
} from './types'
import { DocumentAnalysisEngine, SupabaseAnalysisCache, DocumentContext } from '@/lib/analysis'

export class AIService {
  private providers: Map<AIModel, BaseAIProvider> = new Map()
  private analysisEngine: DocumentAnalysisEngine
  private analysisCache: SupabaseAnalysisCache

  constructor() {
    this.initializeProviders()
    this.analysisEngine = new DocumentAnalysisEngine()
    this.analysisCache = new SupabaseAnalysisCache()
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

      // Check rate limit
      const rateLimitCheck = await rateLimiter.checkLimit(model, userId)
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
        // Perform document analysis
        const analysisResponse = await provider.analyzeDocument(imageUrl, request)
        
        if (!analysisResponse.success || !analysisResponse.data) {
          throw new Error(analysisResponse.error || 'Analysis failed')
        }

        const analysis = analysisResponse.data

        // Track costs
        if (analysisResponse.usage) {
          await costTracker.trackUsage(
            model,
            userId,
            imageUrl, // Using imageUrl as documentId for now
            analysisResponse.usage.totalTokens,
            analysisResponse.usage.cost
          )
        }

        // Generate enhancement suggestions
        const enhancementResponse = await provider.generateEnhancementPrompt(analysis, request)
        
        if (!enhancementResponse.success || !enhancementResponse.data) {
          throw new Error(enhancementResponse.error || 'Enhancement generation failed')
        }

        // Track enhancement costs
        if (enhancementResponse.usage) {
          await costTracker.trackUsage(
            model,
            userId,
            imageUrl,
            enhancementResponse.usage.totalTokens,
            enhancementResponse.usage.cost
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

  // Get provider status
  getProviderStatus(): Record<AIModel, boolean> {
    const models: AIModel[] = [
      'gemini-2.0-flash',
      'gpt-4o-mini',
      'claude-3.5-sonnet',
      'claude-4-sonnet'
    ]

    const status: Record<AIModel, boolean> = {} as Record<AIModel, boolean>
    for (const model of models) {
      status[model] = this.providers.has(model)
    }

    return status
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