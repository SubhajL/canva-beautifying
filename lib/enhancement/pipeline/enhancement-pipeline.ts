import { EventEmitter } from 'events'
import { 
  PipelineContext, 
  PipelineState, 
  PipelineStage, 
  PipelineStatus,
  PipelineEvent,
  InitialAnalysisResult,
  GeneratedAssets,
  CompositionResult
} from './types'
import { InitialAnalysisStage } from './stages/initial-analysis'
import { EnhancementPlanningStage } from './stages/enhancement-planning'
import { AssetGenerationStage } from './stages/asset-generation'
import { FinalCompositionStage } from './stages/final-composition'
import { PipelineCache } from './cache'
import { createClient } from '@/lib/supabase/server'

export class EnhancementPipeline extends EventEmitter {
  private state: PipelineState
  private cache: PipelineCache
  private stages: {
    initialAnalysis: InitialAnalysisStage
    enhancementPlanning: EnhancementPlanningStage
    assetGeneration: AssetGenerationStage
    finalComposition: FinalCompositionStage
  }
  private abortController: AbortController

  constructor(context: PipelineContext) {
    super()
    
    this.state = this.initializeState(context)
    this.cache = new PipelineCache(context.documentId)
    this.abortController = new AbortController()
    
    // Initialize stages
    this.stages = {
      initialAnalysis: new InitialAnalysisStage(),
      enhancementPlanning: new EnhancementPlanningStage(),
      assetGeneration: new AssetGenerationStage(),
      finalComposition: new FinalCompositionStage(),
    }
  }

  private initializeState(context: PipelineContext): PipelineState {
    return {
      id: `pipeline-${context.documentId}-${Date.now()}`,
      context,
      currentStage: 'initial-analysis',
      status: 'pending',
      progress: 0,
      stages: {},
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async execute(): Promise<CompositionResult> {
    try {
      this.updateStatus('running')
      
      // Stage 1: Initial Analysis
      const analysisResult = await this.runStage('initial-analysis', async () => {
        const cached = await this.cache.getAnalysis()
        if (cached && !this.isExpired(cached.timestamp)) {
          return cached.data
        }
        
        const result = await this.stages.initialAnalysis.execute(
          this.state.context,
          this.abortController.signal
        )
        
        await this.cache.setAnalysis(result)
        return result
      })
      
      // Check if we should continue based on analysis
      if (!this.shouldContinue(analysisResult)) {
        throw new Error('Document does not meet minimum requirements for enhancement')
      }
      
      // Stage 2: Enhancement Planning
      const enhancementPlan = await this.runStage('enhancement-planning', async () => {
        const cached = await this.cache.getPlan()
        if (cached && !this.isExpired(cached.timestamp)) {
          return cached.data
        }
        
        const result = await this.stages.enhancementPlanning.execute(
          this.state.context,
          analysisResult,
          this.abortController.signal
        )
        
        await this.cache.setPlan(result)
        return result
      })
      
      // Stage 3: Asset Generation (can be skipped for basic tiers)
      let generatedAssets: GeneratedAssets | null = null
      if (this.shouldGenerateAssets()) {
        generatedAssets = await this.runStage('asset-generation', async () => {
          const cached = await this.cache.getAssets()
          if (cached && !this.isExpired(cached.timestamp)) {
            return cached.data
          }
          
          const result = await this.stages.assetGeneration.execute(
            this.state.context,
            enhancementPlan,
            this.abortController.signal,
            analysisResult
          )
          
          await this.cache.setAssets(result)
          return result
        })
      }
      
      // Stage 4: Final Composition
      const compositionResult = await this.runStage('final-composition', async () => {
        return await this.stages.finalComposition.execute(
          this.state.context,
          analysisResult,
          enhancementPlan,
          generatedAssets,
          this.abortController.signal
        )
      })
      
      // Save pipeline results
      await this.savePipelineResults(compositionResult)
      
      this.updateStatus('completed')
      this.emitEvent({ 
        type: 'pipeline-completed', 
        result: compositionResult 
      })
      
      return compositionResult
    } catch (error) {
      this.updateStatus('failed')
      this.state.errors.push({
        stage: this.state.currentStage,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      })
      
      this.emitEvent({ 
        type: 'pipeline-failed', 
        error: error as Error 
      })
      
      throw error
    }
  }

  private async runStage<T>(
    stage: PipelineStage,
    executor: () => Promise<T>
  ): Promise<T> {
    this.state.currentStage = stage
    this.state.stages[this.getStageKey(stage)] = {
      status: 'running',
      startTime: Date.now(),
    }
    
    this.emitEvent({ 
      type: 'stage-started', 
      stage, 
      timestamp: new Date() 
    })
    
    try {
      const result = await executor()
      
      this.state.stages[this.getStageKey(stage)] = {
        ...this.state.stages[this.getStageKey(stage)],
        status: 'completed',
        result,
        endTime: Date.now(),
      }
      
      this.updateProgress(stage)
      
      this.emitEvent({ 
        type: 'stage-completed', 
        stage, 
        result, 
        timestamp: new Date() 
      })
      
      return result
    } catch (error) {
      this.state.stages[this.getStageKey(stage)] = {
        ...this.state.stages[this.getStageKey(stage)],
        status: 'failed',
        error: error as Error,
        endTime: Date.now(),
      }
      
      this.emitEvent({ 
        type: 'stage-failed', 
        stage, 
        error: error as Error, 
        timestamp: new Date() 
      })
      
      throw error
    }
  }

  private getStageKey(stage: PipelineStage): keyof PipelineState['stages'] {
    const stageMap: Record<PipelineStage, keyof PipelineState['stages']> = {
      'initial-analysis': 'initialAnalysis',
      'enhancement-planning': 'enhancementPlanning',
      'asset-generation': 'assetGeneration',
      'final-composition': 'finalComposition',
    }
    return stageMap[stage]
  }

  private updateProgress(completedStage: PipelineStage) {
    const stageWeights: Record<PipelineStage, number> = {
      'initial-analysis': 20,
      'enhancement-planning': 30,
      'asset-generation': 30,
      'final-composition': 20,
    }
    
    let progress = 0
    const stages: PipelineStage[] = [
      'initial-analysis',
      'enhancement-planning',
      'asset-generation',
      'final-composition'
    ]
    
    for (const stage of stages) {
      const stageState = this.state.stages[this.getStageKey(stage)]
      if (stageState?.status === 'completed') {
        progress += stageWeights[stage]
      }
      if (stage === completedStage) {
        break
      }
    }
    
    this.state.progress = progress
    this.emitEvent({ 
      type: 'progress-updated', 
      progress 
    })
  }

  private updateStatus(status: PipelineStatus) {
    this.state.status = status
    this.state.updatedAt = new Date()
  }

  private emitEvent(event: PipelineEvent) {
    this.emit('pipeline-event', event)
  }

  private shouldContinue(analysis: InitialAnalysisResult): boolean {
    // Don't enhance if the document already has a high score
    if (analysis.currentScore.overall >= 85) {
      return false
    }
    
    // Don't enhance if there are no significant issues
    const significantIssues = analysis.designIssues.filter(
      issue => issue.severity === 'high' || issue.severity === 'medium'
    )
    
    return significantIssues.length > 0
  }

  private shouldGenerateAssets(): boolean {
    const { subscriptionTier, settings } = this.state.context
    
    // Free tier doesn't get asset generation
    if (subscriptionTier === 'free') {
      return false
    }
    
    // Check if explicitly disabled
    if (settings?.generateAssets === false) {
      return false
    }
    
    // Basic tier gets limited assets
    if (subscriptionTier === 'basic') {
      return Math.random() < 0.5 // 50% chance
    }
    
    return true
  }

  private isExpired(timestamp: number): boolean {
    const TTL = 60 * 60 * 1000 // 1 hour
    return Date.now() - timestamp > TTL
  }

  private async savePipelineResults(result: CompositionResult) {
    const supabase = createClient()
    
    await supabase
      .from('enhancement_pipelines')
      .insert({
        document_id: this.state.context.documentId,
        user_id: this.state.context.userId,
        pipeline_id: this.state.id,
        status: this.state.status,
        stages_completed: Object.keys(this.state.stages).filter(
          key => this.state.stages[key as keyof PipelineState['stages']]?.status === 'completed'
        ),
        processing_time: result.processingTime.total,
        quality_improvement: result.improvements.overallScore.after - result.improvements.overallScore.before,
        enhanced_file_url: result.enhancedFileUrl,
        metadata: {
          context: this.state.context,
          improvements: result.improvements,
          errors: this.state.errors,
        }
      })
  }

  cancel() {
    this.abortController.abort()
    this.updateStatus('cancelled')
    this.emitEvent({ 
      type: 'pipeline-cancelled', 
      reason: 'User cancelled' 
    })
  }

  getState(): PipelineState {
    return { ...this.state }
  }

  onProgress(callback: (progress: number) => void) {
    this.on('pipeline-event', (event: PipelineEvent) => {
      if (event.type === 'progress-updated') {
        callback(event.progress)
      }
    })
  }
}