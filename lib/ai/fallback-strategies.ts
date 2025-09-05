import type { AIModel, DocumentType, UserTier, EnhancementRequest, DocumentAnalysis, EnhancementSuggestion } from './types'
import { DocumentCache } from '../cache/document-cache'
import { EnhancementCache } from '../cache/enhancement-cache'

interface FallbackStrategy {
  name: string
  priority: number
  canHandle: (documentType: DocumentType, userTier: UserTier) => boolean
  execute: (request: EnhancementRequest, failedModel: AIModel) => Promise<FallbackResponse>
}

interface FallbackResponse {
  analysis?: DocumentAnalysis
  enhancements?: EnhancementSuggestion[]
  degraded: boolean
  source: 'cache' | 'template' | 'basic-ai' | 'none'
  message: string
}

/**
 * Manages fallback strategies when AI providers are unavailable
 */
export class FallbackStrategySelector {
  private static strategies: FallbackStrategy[] = []
  private static documentCache = new DocumentCache()
  private static enhancementCache: EnhancementCache | null = null
  private static initialized = false

  static registerStrategy(strategy: FallbackStrategy): void {
    this.strategies.push(strategy)
    this.strategies.sort((a, b) => b.priority - a.priority)
  }

  private static ensureInitialized(): void {
    if (!this.initialized) {
      // Register strategies in priority order
      this.registerStrategy(new CachedResultStrategy())
      this.registerStrategy(new TemplateBasedStrategy())
      this.registerStrategy(new BasicAnalysisStrategy())
      this.registerStrategy(new GracefulDegradationStrategy())
      this.initialized = true
    }
  }

  /**
   * Select the best fallback strategy based on context
   */
  static async selectStrategy(
    documentType: DocumentType,
    userTier: UserTier,
    request: EnhancementRequest,
    failedModel: AIModel
  ): Promise<FallbackResponse> {
    this.ensureInitialized()
    
    for (const strategy of this.strategies) {
      if (strategy.canHandle(documentType, userTier)) {
        try {
          return await strategy.execute(request, failedModel)
        } catch (error) {
          console.error(`Fallback strategy ${strategy.name} failed:`, error)
          continue
        }
      }
    }

    // If all strategies fail, return minimal response
    return {
      degraded: true,
      source: 'none',
      message: 'All enhancement services are temporarily unavailable. Please try again later.'
    }
  }
}

/**
 * Strategy 1: Use cached results from previous successful enhancements
 */
class CachedResultStrategy implements FallbackStrategy {
  name = 'CachedResults'
  priority = 100

  private documentCache = new DocumentCache()
  private enhancementCache = new EnhancementCache()

  canHandle(documentType: DocumentType, userTier: UserTier): boolean {
    // Premium and Pro users get cache fallback
    return userTier === 'premium' || userTier === 'pro'
  }

  async execute(request: EnhancementRequest, failedModel: AIModel): Promise<FallbackResponse> {
    try {
      // Try to find a similar cached document
      const similarDocs = await this.documentCache.getSimilar(request.documentType, 1)
      
      if (similarDocs && similarDocs.length > 0 && FallbackStrategySelector.enhancementCache) {
        const docId = similarDocs[0].id
        const cachedEnhancement = await FallbackStrategySelector.enhancementCache.get(docId)
        
        if (cachedEnhancement) {
          return {
            analysis: cachedEnhancement.analysis as DocumentAnalysis,
            enhancements: cachedEnhancement.suggestions,
            degraded: true,
            source: 'cache',
            message: 'Using cached results from a similar document. Results may not be fully tailored to your specific content.'
          }
        }
      }
    } catch (error) {
      console.error('Cache lookup failed:', error)
    }

    throw new Error('No cached results available')
  }
}

/**
 * Strategy 2: Use pre-defined templates based on document type
 */
class TemplateBasedStrategy implements FallbackStrategy {
  name = 'TemplateBasedFallback'
  priority = 80

  canHandle(documentType: DocumentType, userTier: UserTier): boolean {
    // Available for all users
    return true
  }

  async execute(request: EnhancementRequest, failedModel: AIModel): Promise<FallbackResponse> {
    const templates = this.getTemplatesForType(request.documentType)
    
    return {
      analysis: this.createBasicAnalysis(request.documentType),
      enhancements: templates,
      degraded: true,
      source: 'template',
      message: 'Using pre-defined templates. For personalized suggestions, please try again when our AI services are available.'
    }
  }

  private createBasicAnalysis(documentType: DocumentType): DocumentAnalysis {
    return {
      layout: {
        structure: 'standard',
        alignment: 'left',
        spacing: 'normal',
        grid: false
      },
      colors: {
        primary: '#000000',
        secondary: '#666666',
        accent: '#0066cc',
        background: '#ffffff'
      },
      typography: {
        headingFont: 'Arial',
        bodyFont: 'Arial',
        fontSize: 12,
        lineHeight: 1.5
      },
      engagement: {
        visualHierarchy: 3,
        readability: 3,
        balance: 3,
        overall: 3
      },
      contentType: documentType,
      targetAudience: 'general'
    }
  }

  private getTemplatesForType(documentType: DocumentType): EnhancementSuggestion[] {
    const templates: Record<DocumentType, EnhancementSuggestion[]> = {
      worksheet: [
        {
          category: 'layout',
          priority: 'high',
          description: 'Add clear section headers',
          impact: 'high',
          implementation: 'Divide content into clear sections with bold headers'
        },
        {
          category: 'visual',
          priority: 'medium',
          description: 'Include visual elements',
          impact: 'medium',
          implementation: 'Add simple icons or illustrations to break up text'
        }
      ],
      presentation: [
        {
          category: 'layout',
          priority: 'high',
          description: 'Use consistent slide layouts',
          impact: 'high',
          implementation: 'Apply a consistent template across all slides'
        },
        {
          category: 'typography',
          priority: 'high',
          description: 'Increase font size for readability',
          impact: 'high',
          implementation: 'Use minimum 24pt for body text, 32pt for headers'
        }
      ],
      document: [
        {
          category: 'typography',
          priority: 'high',
          description: 'Improve text hierarchy',
          impact: 'medium',
          implementation: 'Use consistent heading styles and spacing'
        },
        {
          category: 'layout',
          priority: 'medium',
          description: 'Add white space',
          impact: 'medium',
          implementation: 'Increase margins and paragraph spacing'
        }
      ],
      marketing: [
        {
          category: 'visual',
          priority: 'high',
          description: 'Add eye-catching visuals',
          impact: 'high',
          implementation: 'Include high-quality images or graphics'
        },
        {
          category: 'content',
          priority: 'high',
          description: 'Create compelling headline',
          impact: 'high',
          implementation: 'Use action words and clear value proposition'
        }
      ]
    }

    return templates[documentType] || templates.document
  }
}

/**
 * Strategy 3: Provide basic analysis without AI
 */
class BasicAnalysisStrategy implements FallbackStrategy {
  name = 'BasicAnalysis'
  priority = 60

  canHandle(documentType: DocumentType, userTier: UserTier): boolean {
    return userTier !== 'free' // Not available for free tier
  }

  async execute(request: EnhancementRequest, failedModel: AIModel): Promise<FallbackResponse> {
    const suggestions = this.generateBasicSuggestions(request.documentType, request.preferences)
    
    return {
      enhancements: suggestions,
      degraded: true,
      source: 'basic-ai',
      message: 'Providing basic enhancement suggestions. Advanced AI analysis is currently unavailable.'
    }
  }

  private generateBasicSuggestions(
    documentType: DocumentType,
    preferences?: any
  ): EnhancementSuggestion[] {
    const suggestions: EnhancementSuggestion[] = []

    // Universal suggestions
    suggestions.push({
      category: 'layout',
      priority: 'high',
      description: 'Ensure consistent spacing throughout',
      impact: 'medium',
      implementation: 'Review and standardize margins, padding, and line spacing'
    })

    if (preferences?.style === 'professional') {
      suggestions.push({
        category: 'color',
        priority: 'medium',
        description: 'Use a professional color palette',
        impact: 'medium',
        implementation: 'Stick to 2-3 colors with good contrast ratios'
      })
    }

    if (preferences?.style === 'creative') {
      suggestions.push({
        category: 'visual',
        priority: 'high',
        description: 'Add creative visual elements',
        impact: 'high',
        implementation: 'Incorporate unique graphics or illustrations'
      })
    }

    return suggestions
  }
}

/**
 * Strategy 4: Graceful degradation with user notification
 */
class GracefulDegradationStrategy implements FallbackStrategy {
  name = 'GracefulDegradation'
  priority = 0 // Lowest priority, last resort

  canHandle(): boolean {
    return true // Can always handle as last resort
  }

  async execute(request: EnhancementRequest, failedModel: AIModel): Promise<FallbackResponse> {
    return {
      degraded: true,
      source: 'none',
      message: `Our AI enhancement service is experiencing high demand. Your document will be processed as soon as possible. Failed model: ${failedModel}`
    }
  }
}

/**
 * Provider for cached fallback responses
 */
export class CachedFallbackProvider {
  private documentCache = new DocumentCache()
  private enhancementCache: EnhancementCache | null = null

  async getCachedResponse(
    request: EnhancementRequest,
    documentId: string
  ): Promise<FallbackResponse | null> {
    try {
      if (!this.enhancementCache) {
        return null
      }

      // First try exact match
      const cachedEnhancement = await this.enhancementCache.get(documentId)
      if (cachedEnhancement?.analysis && cachedEnhancement?.suggestions) {
        return {
          analysis: cachedEnhancement.analysis as DocumentAnalysis,
          enhancements: cachedEnhancement.suggestions,
          degraded: false,
          source: 'cache',
          message: 'Using cached analysis results'
        }
      }

      // Then try similar documents
      const similarDocs = await this.documentCache.getSimilar(request.documentType, 1)
      
      if (similarDocs && similarDocs.length > 0) {
        const similarEnhancement = await this.enhancementCache.get(similarDocs[0].id)
        
        if (similarEnhancement) {
          return {
            analysis: similarEnhancement.analysis as DocumentAnalysis,
            enhancements: similarEnhancement.suggestions,
            degraded: true,
            source: 'cache',
            message: 'Using analysis from a similar document'
          }
        }
      }
    } catch (error) {
      console.error('Cache fallback failed:', error)
    }

    return null
  }
}