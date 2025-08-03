import { AIModel, UserTier, DocumentAnalysis } from './types'
import { ABTestManager } from './utils/ab-testing'

interface ModelSelectionCriteria {
  userTier: UserTier
  documentComplexity?: 'low' | 'medium' | 'high'
  processingPriority?: 'speed' | 'quality' | 'balanced'
  previousFailures?: AIModel[]
  costOptimization?: boolean
  documentType?: 'worksheet' | 'presentation' | 'marketing'
  estimatedTokens?: number
  userId?: string
}

interface DocumentComplexityFactors {
  overallScore: number
  issueCount: number
  elementCount: number
  colorVariety: number
  typographyComplexity: number
  documentType: 'worksheet' | 'presentation' | 'marketing'
}

interface ModelPerformanceMetrics {
  averageResponseTime: number
  successRate: number
  averageCost: number
  lastUsed: Date
}

export class ModelSelector {
  private static readonly tierModelMap: Record<UserTier, AIModel[]> = {
    free: ['gemini-2.0-flash'],
    basic: ['gemini-2.0-flash', 'gpt-4o-mini'],
    pro: ['gpt-4o-mini', 'claude-3.5-sonnet', 'gemini-2.0-flash'],
    premium: ['claude-4-sonnet', 'claude-3.5-sonnet', 'gpt-4o-mini', 'gemini-2.0-flash']
  }

  private static readonly complexityModelMap: Record<string, AIModel[]> = {
    low: ['gemini-2.0-flash', 'gpt-4o-mini'],
    medium: ['gpt-4o-mini', 'claude-3.5-sonnet'],
    high: ['claude-3.5-sonnet', 'claude-4-sonnet']
  }

  private static readonly speedPriorityOrder: AIModel[] = [
    'gemini-2.0-flash',
    'gpt-4o-mini',
    'claude-3.5-sonnet',
    'claude-4-sonnet'
  ]

  private static readonly qualityPriorityOrder: AIModel[] = [
    'claude-4-sonnet',
    'claude-3.5-sonnet',
    'gpt-4o-mini',
    'gemini-2.0-flash'
  ]

  private static readonly documentTypeModelPreference: Record<string, AIModel[]> = {
    worksheet: ['gpt-4o-mini', 'claude-3.5-sonnet', 'gemini-2.0-flash'],
    presentation: ['claude-3.5-sonnet', 'claude-4-sonnet', 'gpt-4o-mini'],
    marketing: ['claude-4-sonnet', 'claude-3.5-sonnet', 'gpt-4o-mini']
  }

  private static performanceHistory: Map<AIModel, ModelPerformanceMetrics> = new Map([
    ['gemini-2.0-flash', { averageResponseTime: 5000, successRate: 0.95, averageCost: 0.0003, lastUsed: new Date() }],
    ['gpt-4o-mini', { averageResponseTime: 8000, successRate: 0.92, averageCost: 0.00075, lastUsed: new Date() }],
    ['claude-3.5-sonnet', { averageResponseTime: 12000, successRate: 0.94, averageCost: 0.018, lastUsed: new Date() }],
    ['claude-4-sonnet', { averageResponseTime: 15000, successRate: 0.96, averageCost: 0.03, lastUsed: new Date() }]
  ])

  static selectModel(criteria: ModelSelectionCriteria): AIModel {
    const { 
      userTier, 
      documentComplexity, 
      previousFailures = [],
      documentType,
      estimatedTokens = 2000,
      userId
    } = criteria

    // Use let for variables that may be reassigned
    let processingPriority = criteria.processingPriority
    let costOptimization = criteria.costOptimization ?? false

    // Apply A/B test variants if user is in a test
    if (userId) {
      const activeTests = ABTestManager.getActiveTestsForUser(userId, userTier)
      
      for (const test of activeTests) {
        const testCriteria = ABTestManager.applyTestVariant(userId, test.id, {
          costOptimization,
          processingPriority,
          modelPriority: null
        })

        if (testCriteria.costOptimization !== undefined) {
          costOptimization = testCriteria.costOptimization
        }
        if (testCriteria.qualityBias !== undefined) {
          processingPriority = testCriteria.qualityBias > 0.7 ? 'quality' : 
                              testCriteria.qualityBias < 0.3 ? 'speed' : 'balanced'
        }
      }
    }

    // Get available models based on user tier
    let availableModels = [...this.tierModelMap[userTier]]

    // Filter out previously failed models
    availableModels = availableModels.filter(model => !previousFailures.includes(model))

    if (availableModels.length === 0) {
      // If all models have failed, fallback to the most reliable one
      this.logModelSelection('fallback', 'gemini-2.0-flash', criteria, 'All models failed')
      return 'gemini-2.0-flash'
    }

    // Apply document type preference if specified
    if (documentType) {
      const typePreferredModels = this.documentTypeModelPreference[documentType]
      const typeFilteredModels = availableModels.filter(model => typePreferredModels.includes(model))
      if (typeFilteredModels.length > 0) {
        availableModels = typeFilteredModels
      }
    }

    // Apply complexity filter if specified
    if (documentComplexity) {
      const complexityModels = this.complexityModelMap[documentComplexity]
      const complexityFilteredModels = availableModels.filter(model => complexityModels.includes(model))
      if (complexityFilteredModels.length > 0) {
        availableModels = complexityFilteredModels
      }
    }

    // Apply cost optimization if enabled
    if (costOptimization && estimatedTokens) {
      const costThreshold = userTier === 'premium' ? 0.10 : userTier === 'pro' ? 0.05 : 0.02
      availableModels = availableModels.filter(model => {
        const estimatedCost = this.getCostEstimate(model, estimatedTokens)
        return estimatedCost <= costThreshold
      })
    }

    // Sort by performance metrics if available
    const scoredModels = availableModels.map(model => {
      const performance = this.performanceHistory.get(model)
      if (!performance) return { model, score: 0 }

      let score = 0
      
      // Factor in success rate (40% weight)
      score += performance.successRate * 40

      // Factor in speed based on priority (30% weight)
      const speedScore = (20000 - performance.averageResponseTime) / 20000
      if (processingPriority === 'speed') {
        score += speedScore * 40
      } else if (processingPriority === 'quality') {
        score += speedScore * 20
      } else {
        score += speedScore * 30
      }

      // Factor in cost (20% weight)
      const costScore = (0.05 - performance.averageCost) / 0.05
      score += Math.max(0, costScore) * 20

      // Factor in recency (10% weight)
      const hoursSinceLastUse = (Date.now() - performance.lastUsed.getTime()) / (1000 * 60 * 60)
      const recencyScore = Math.max(0, 1 - (hoursSinceLastUse / 168)) // Decay over a week
      score += recencyScore * 10

      // Apply document type preference boost (30% bonus for preferred models)
      if (documentType) {
        const typePreferredModels = this.documentTypeModelPreference[documentType]
        const preferenceIndex = typePreferredModels.indexOf(model)
        if (preferenceIndex !== -1) {
          // Higher boost for models listed earlier in preference
          const preferenceBoost = 30 * (1 - preferenceIndex / typePreferredModels.length)
          score += preferenceBoost
        }
      }

      return { model, score }
    })

    // Sort by score descending
    scoredModels.sort((a, b) => b.score - a.score)

    // Apply priority ordering as a tiebreaker
    let _priorityOrder: AIModel[]
    switch (processingPriority) {
      case 'speed':
        _priorityOrder = this.speedPriorityOrder
        break
      case 'quality':
        _priorityOrder = this.qualityPriorityOrder
        break
      case 'balanced':
      default:
        _priorityOrder = ['gpt-4o-mini', 'claude-3.5-sonnet', 'gemini-2.0-flash', 'claude-4-sonnet']
    }

    // Select the best model based on scoring and priority
    const selectedModel = scoredModels.length > 0 
      ? scoredModels[0].model 
      : availableModels[0]

    this.logModelSelection('selected', selectedModel, criteria, `Score: ${scoredModels[0]?.score || 0}`)
    return selectedModel
  }

  static determineComplexity(analysis: DocumentAnalysis): 'low' | 'medium' | 'high' {
    // Calculate complexity based on multiple factors
    const factors: DocumentComplexityFactors = {
      overallScore: analysis.overallScore,
      issueCount: this.countTotalIssues(analysis),
      elementCount: this.estimateElementCount(analysis),
      colorVariety: analysis.colors.palette.length,
      typographyComplexity: analysis.typography.fonts.length,
      documentType: 'worksheet' // Default, should be passed in
    }

    return this.calculateComplexityScore(factors)
  }

  static determineComplexityWithContext(
    analysis: DocumentAnalysis,
    documentType: 'worksheet' | 'presentation' | 'marketing'
  ): 'low' | 'medium' | 'high' {
    const factors: DocumentComplexityFactors = {
      overallScore: analysis.overallScore,
      issueCount: this.countTotalIssues(analysis),
      elementCount: this.estimateElementCount(analysis),
      colorVariety: analysis.colors.palette.length,
      typographyComplexity: analysis.typography.fonts.length,
      documentType
    }

    return this.calculateComplexityScore(factors)
  }

  private static calculateComplexityScore(factors: DocumentComplexityFactors): 'low' | 'medium' | 'high' {
    let complexityScore = 0

    // Overall score impact (inverted - lower score = higher complexity)
    if (factors.overallScore < 40) {
      complexityScore += 30
    } else if (factors.overallScore < 70) {
      complexityScore += 20
    } else {
      complexityScore += 10
    }

    // Issue count impact
    if (factors.issueCount > 15) {
      complexityScore += 25
    } else if (factors.issueCount > 8) {
      complexityScore += 15
    } else {
      complexityScore += 5
    }

    // Element count impact (estimated)
    if (factors.elementCount > 50) {
      complexityScore += 20
    } else if (factors.elementCount > 20) {
      complexityScore += 10
    } else {
      complexityScore += 5
    }

    // Color variety impact
    if (factors.colorVariety > 10) {
      complexityScore += 15
    } else if (factors.colorVariety > 5) {
      complexityScore += 10
    } else {
      complexityScore += 5
    }

    // Typography complexity
    if (factors.typographyComplexity > 5) {
      complexityScore += 10
    } else if (factors.typographyComplexity > 3) {
      complexityScore += 5
    } else {
      complexityScore += 2
    }

    // Document type modifiers
    switch (factors.documentType) {
      case 'presentation':
        complexityScore *= 1.2 // Presentations typically more complex
        break
      case 'marketing':
        complexityScore *= 1.3 // Marketing materials need high polish
        break
      case 'worksheet':
      default:
        complexityScore *= 1.0
    }

    // Determine final complexity level
    if (complexityScore >= 70) {
      return 'high'
    } else if (complexityScore >= 40) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  private static countTotalIssues(analysis: DocumentAnalysis): number {
    return (
      analysis.layout.issues.length +
      analysis.colors.issues.length +
      analysis.typography.issues.length
    )
  }

  private static estimateElementCount(analysis: DocumentAnalysis): number {
    // Estimate based on issues and suggestions
    const totalItems = 
      analysis.layout.issues.length + 
      analysis.layout.suggestions.length +
      analysis.colors.palette.length +
      analysis.typography.fonts.length

    return Math.max(10, totalItems * 3) // Rough estimation
  }

  static getFallbackModel(currentModel: AIModel, userTier: UserTier): AIModel | null {
    const availableModels = this.tierModelMap[userTier]
    const currentIndex = availableModels.indexOf(currentModel)

    if (currentIndex === -1 || currentIndex === availableModels.length - 1) {
      return null // No fallback available
    }

    return availableModels[currentIndex + 1]
  }

  static estimateProcessingTime(model: AIModel, documentComplexity: 'low' | 'medium' | 'high'): number {
    // Base processing times in seconds
    const baseTime: Record<AIModel, number> = {
      'gemini-2.0-flash': 5,
      'gpt-4o-mini': 8,
      'claude-3.5-sonnet': 12,
      'claude-4-sonnet': 15
    }

    const complexityMultiplier = {
      low: 1,
      medium: 1.5,
      high: 2
    }

    return Math.ceil(baseTime[model] * complexityMultiplier[documentComplexity])
  }

  static getCostEstimate(model: AIModel, estimatedTokens: number = 2000): number {
    // Approximate cost per 1k tokens (average of input/output)
    const costPer1kTokens: Record<AIModel, number> = {
      'gemini-2.0-flash': 0.00015,
      'gpt-4o-mini': 0.000375, // Average of input/output
      'claude-3.5-sonnet': 0.009,  // Average of input/output
      'claude-4-sonnet': 0.015     // Average of input/output
    }

    return (estimatedTokens / 1000) * costPer1kTokens[model]
  }

  static updatePerformanceMetrics(
    model: AIModel,
    responseTime: number,
    success: boolean,
    tokensUsed: number
  ): void {
    const current = this.performanceHistory.get(model)
    if (!current) return

    // Update with exponential moving average
    const alpha = 0.3 // Weight for new data
    
    current.averageResponseTime = alpha * responseTime + (1 - alpha) * current.averageResponseTime
    current.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * current.successRate
    current.averageCost = alpha * this.getCostEstimate(model, tokensUsed) + (1 - alpha) * current.averageCost
    current.lastUsed = new Date()

    this.performanceHistory.set(model, current)
  }

  static determineProcessingPriority(
    userTier: UserTier,
    documentComplexity: 'low' | 'medium' | 'high',
    userPreference?: 'speed' | 'quality' | 'balanced'
  ): 'speed' | 'quality' | 'balanced' {
    // User preference takes precedence if specified
    if (userPreference) return userPreference

    // Otherwise, determine based on tier and complexity
    if (userTier === 'free') {
      return 'speed' // Free users get fastest processing
    }

    if (userTier === 'premium') {
      return documentComplexity === 'high' ? 'quality' : 'balanced'
    }

    // Basic and Pro tiers
    switch (documentComplexity) {
      case 'low':
        return 'speed'
      case 'medium':
        return 'balanced'
      case 'high':
        return userTier === 'pro' ? 'quality' : 'balanced'
    }
  }

  private static logModelSelection(
    action: 'selected' | 'fallback' | 'rejected',
    model: AIModel,
    criteria: ModelSelectionCriteria,
    reason: string
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      model,
      criteria: {
        userTier: criteria.userTier,
        complexity: criteria.documentComplexity,
        priority: criteria.processingPriority,
        failures: criteria.previousFailures,
        documentType: criteria.documentType
      },
      reason
    }

    // In production, this would go to a logging service
    console.log('[ModelSelector]', JSON.stringify(logEntry))
  }

  static getModelRecommendations(
    userTier: UserTier,
    recentUsage: { model: AIModel; timestamp: Date; success: boolean }[]
  ): { recommended: AIModel[]; reasoning: string[] } {
    const availableModels = this.tierModelMap[userTier]
    const recommendations: AIModel[] = []
    const reasoning: string[] = []

    // Analyze recent usage patterns
    const successRates = new Map<AIModel, number>()
    const usageCounts = new Map<AIModel, number>()

    recentUsage.forEach(usage => {
      const current = successRates.get(usage.model) || 0
      const count = usageCounts.get(usage.model) || 0
      successRates.set(usage.model, current + (usage.success ? 1 : 0))
      usageCounts.set(usage.model, count + 1)
    })

    // Calculate actual success rates
    availableModels.forEach(model => {
      const successes = successRates.get(model) || 0
      const total = usageCounts.get(model) || 0
      if (total > 0) {
        const rate = successes / total
        if (rate > 0.9) {
          recommendations.push(model)
          reasoning.push(`${model} has ${(rate * 100).toFixed(0)}% success rate`)
        }
      } else {
        // Include models that haven't been tried yet
        recommendations.push(model)
        reasoning.push(`${model} is available but hasn't been used recently`)
      }
    })

    return { recommended: recommendations, reasoning }
  }
}