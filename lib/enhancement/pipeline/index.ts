export * from './types'
export { EnhancementPipeline } from './enhancement-pipeline'
export { PipelineCache } from './cache'

// Re-export stages for testing/debugging
export { InitialAnalysisStage } from './stages/initial-analysis'
export { EnhancementPlanningStage } from './stages/enhancement-planning'
export { AssetGenerationStage } from './stages/asset-generation'
export { FinalCompositionStage } from './stages/final-composition'