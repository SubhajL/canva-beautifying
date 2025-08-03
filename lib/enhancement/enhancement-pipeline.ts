import { DocumentAnalysis } from '@/lib/ai/types'
import { DocumentAnalysisEngine } from '@/lib/analysis'
import { AIService } from '@/lib/ai/ai-service'
import { createClient } from '@/lib/supabase/server'
import { 
  EnhancementRequest, 
  EnhancementResult, 
  EnhancementStrategy,
  EnhancementPipeline as IPipeline,
  EnhancementPreferences
} from './types'
import { StrategyGenerator } from './strategy-generator'
import { EnhancementApplicator } from './enhancement-applicator'
import { QualityScorer } from './quality-scorer'

export class EnhancementPipeline implements IPipeline {
  private analysisEngine: DocumentAnalysisEngine
  private strategyGenerator: StrategyGenerator
  private applicator: EnhancementApplicator
  private scorer: QualityScorer
  private aiService: AIService

  constructor() {
    this.analysisEngine = new DocumentAnalysisEngine()
    this.strategyGenerator = new StrategyGenerator()
    this.applicator = new EnhancementApplicator()
    this.scorer = new QualityScorer()
    this.aiService = new AIService()
  }

  async enhance(request: EnhancementRequest): Promise<EnhancementResult> {
    const startTime = Date.now()
    
    try {
      // Step 1: Analyze the document if not already done
      const analysis = request.analysisData || await this.analyze(request)
      
      // Step 2: Generate enhancement strategies
      const strategies = await this.generateStrategies(analysis, request.preferences)
      
      // Step 3: Apply enhancements
      const enhancedUrl = await this.applyEnhancements(
        request.documentId,
        strategies
      )
      
      // Step 4: Evaluate quality improvement
      const qualityScore = await this.scorer.calculateImprovement(request.documentId, enhancedUrl)
      
      // Step 5: Store results
      await this.storeResults(request, strategies, enhancedUrl, qualityScore)
      
      return {
        success: true,
        documentId: request.documentId,
        strategies,
        appliedStrategies: strategies.map(s => s.id),
        enhancedUrl,
        qualityScore,
        metadata: {
          processingTime: Date.now() - startTime,
          enhancementCount: strategies.length,
          timestamp: new Date()
        }
      }
    } catch (error) {
      console.error('Enhancement pipeline error:', error)
      
      return {
        success: false,
        documentId: request.documentId,
        strategies: [],
        appliedStrategies: [],
        qualityScore: {
          before: 0,
          after: 0,
          improvement: 0
        },
        metadata: {
          processingTime: Date.now() - startTime,
          enhancementCount: 0,
          timestamp: new Date()
        },
        error: error instanceof Error ? error.message : 'Enhancement failed'
      }
    }
  }

  async analyze(request: EnhancementRequest): Promise<DocumentAnalysis> {
    // Get document URL from database
    const supabase = await createClient()
    const { data: enhancement } = await supabase
      .from('enhancements')
      .select('original_url')
      .eq('id', request.documentId)
      .single()
    
    if (!enhancement?.original_url) {
      throw new Error('Document not found')
    }
    
    // Analyze the document
    const context = {
      imageData: null, // Would be loaded from URL
      type: 'worksheet' as const,  // Default to worksheet - should be detected from document
      metadata: {
        width: 1920,  // Default values - should be extracted from actual document
        height: 1080,
        format: 'pdf',
        size: 1024000
      }
    }
    
    return this.analysisEngine.generateCompleteAnalysis(context)
  }

  async generateStrategies(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy[]> {
    return this.strategyGenerator.generateStrategies(analysis, preferences)
  }

  async applyEnhancements(
    documentUrl: string,
    strategies: EnhancementStrategy[]
  ): Promise<string> {
    return this.applicator.apply(documentUrl, strategies)
  }

  async evaluate(originalUrl: string, enhancedUrl: string): Promise<number> {
    const scores = await this.scorer.calculateImprovement(originalUrl, enhancedUrl)
    return scores.improvement
  }

  private async storeResults(
    request: EnhancementRequest,
    strategies: EnhancementStrategy[],
    enhancedUrl: string,
    qualityScore: { before: number; after: number; improvement: number }
  ): Promise<void> {
    const supabase = await createClient()
    
    // Update enhancement record
    await supabase
      .from('enhancements')
      .update({
        enhanced_url: enhancedUrl,
        status: 'completed',
        enhancement_data: {
          strategies: strategies.map(s => ({
            id: s.id,
            name: s.name,
            impact: s.impact
          })),
          qualityScore,
          preferences: request.preferences
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', request.documentId)
  }
}