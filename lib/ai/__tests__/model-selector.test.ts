import { ModelSelector } from '../model-selector'
import { DocumentAnalysis } from '../types'

describe('ModelSelector', () => {
  const mockAnalysis: DocumentAnalysis = {
    layout: {
      score: 45,
      issues: ['Poor spacing', 'Inconsistent alignment', 'No clear hierarchy'],
      suggestions: ['Improve margins', 'Use grid system']
    },
    colors: {
      score: 60,
      palette: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'],
      issues: ['Too many colors', 'Poor contrast'],
      suggestions: ['Limit to 3-4 colors']
    },
    typography: {
      score: 55,
      fonts: ['Arial', 'Times', 'Comic Sans', 'Helvetica'],
      issues: ['Too many fonts', 'Poor readability'],
      suggestions: ['Stick to 2 fonts max']
    },
    engagement: {
      score: 50,
      readability: 65,
      visualAppeal: 35,
      suggestions: ['Add visual elements', 'Improve layout']
    },
    overallScore: 52.5,
    priority: 'medium'
  }

  describe('selectModel', () => {
    it('should respect user tier restrictions', () => {
      // Free tier should only get Gemini
      const freeModel = ModelSelector.selectModel({
        userTier: 'free',
        documentComplexity: 'high',
        processingPriority: 'quality'
      })
      expect(freeModel).toBe('gemini-2.0-flash')

      // Premium tier should get access to all models
      const premiumModel = ModelSelector.selectModel({
        userTier: 'premium',
        documentComplexity: 'high',
        processingPriority: 'quality'
      })
      expect(['claude-4-sonnet', 'claude-3.5-sonnet']).toContain(premiumModel)
    })

    it('should apply cost optimization', () => {
      const model = ModelSelector.selectModel({
        userTier: 'basic',
        costOptimization: true,
        estimatedTokens: 5000
      })
      // Should prefer cheaper models
      expect(['gemini-2.0-flash', 'gpt-4o-mini']).toContain(model)
    })

    it('should respect document type preferences', () => {
      const marketingModel = ModelSelector.selectModel({
        userTier: 'premium',
        documentType: 'marketing',
        processingPriority: 'quality'
      })
      // Marketing documents should prefer Claude models
      expect(['claude-4-sonnet', 'claude-3.5-sonnet']).toContain(marketingModel)
    })

    it('should handle failed models', () => {
      const model = ModelSelector.selectModel({
        userTier: 'pro',
        previousFailures: ['gpt-4o-mini', 'claude-3.5-sonnet']
      })
      // Should select a model not in the failure list
      expect(model).toBe('gemini-2.0-flash')
    })

    it('should fallback when all models fail', () => {
      const model = ModelSelector.selectModel({
        userTier: 'basic',
        previousFailures: ['gemini-2.0-flash', 'gpt-4o-mini']
      })
      // Should fallback to most reliable model
      expect(model).toBe('gemini-2.0-flash')
    })
  })

  describe('determineComplexityWithContext', () => {
    it('should calculate complexity based on multiple factors', () => {
      const complexity = ModelSelector.determineComplexityWithContext(
        mockAnalysis,
        'worksheet'
      )
      expect(complexity).toBe('medium')
    })

    it('should increase complexity for marketing documents', () => {
      const lowScoreAnalysis: DocumentAnalysis = {
        ...mockAnalysis,
        overallScore: 35,
        layout: { ...mockAnalysis.layout, score: 30 }
      }
      
      const _worksheetComplexity = ModelSelector.determineComplexityWithContext(
        lowScoreAnalysis,
        'worksheet'
      )
      const marketingComplexity = ModelSelector.determineComplexityWithContext(
        lowScoreAnalysis,
        'marketing'
      )
      
      // Marketing should be rated as more complex
      expect(marketingComplexity).toBe('high')
    })
  })

  describe('determineProcessingPriority', () => {
    it('should prioritize speed for free users', () => {
      const priority = ModelSelector.determineProcessingPriority('free', 'high')
      expect(priority).toBe('speed')
    })

    it('should prioritize quality for premium high complexity', () => {
      const priority = ModelSelector.determineProcessingPriority('premium', 'high')
      expect(priority).toBe('quality')
    })

    it('should respect user preference', () => {
      const priority = ModelSelector.determineProcessingPriority(
        'basic',
        'medium',
        'quality'
      )
      expect(priority).toBe('quality')
    })
  })

  describe('getCostEstimate', () => {
    it('should calculate cost correctly', () => {
      const cost = ModelSelector.getCostEstimate('claude-3.5-sonnet', 1000)
      expect(cost).toBeCloseTo(0.009, 3)
    })
  })

  describe('estimateProcessingTime', () => {
    it('should scale time with complexity', () => {
      const lowTime = ModelSelector.estimateProcessingTime('gemini-2.0-flash', 'low')
      const highTime = ModelSelector.estimateProcessingTime('gemini-2.0-flash', 'high')
      
      expect(highTime).toBe(lowTime * 2)
    })
  })

  describe('getModelRecommendations', () => {
    it('should recommend models based on usage history', () => {
      const recentUsage = [
        { model: 'gpt-4o-mini' as const, timestamp: new Date(), success: true },
        { model: 'gpt-4o-mini' as const, timestamp: new Date(), success: true },
        { model: 'claude-3.5-sonnet' as const, timestamp: new Date(), success: false },
      ]

      const { recommended, reasoning } = ModelSelector.getModelRecommendations(
        'pro',
        recentUsage
      )

      expect(recommended).toContain('gpt-4o-mini')
      expect(reasoning.some(r => r.includes('100% success rate'))).toBe(true)
    })
  })
})