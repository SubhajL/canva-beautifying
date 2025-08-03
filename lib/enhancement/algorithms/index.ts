/**
 * Enhancement Algorithms
 * Export all enhancement algorithm modules
 */

export * from './color-optimization'
export * from './typography-improvement'
export * from './layout-restructuring'
export * from './composition'
export * from './asset-generation'

// Re-export convenient namespaces
export { colorOptimization } from './color-optimization'
export { typographyImprovement } from './typography-improvement'  
export { layoutRestructuring } from './layout-restructuring'
export { compositionAlgorithms } from './composition'
export { assetGeneration } from './asset-generation'

// Export types
export type {
  ColorPalette,
  ColorHarmony,
  ContrastResult,
  AccessibilityResult
} from './color-optimization'

export type {
  FontPairing,
  TypeScale,
  TypographyMetrics,
  TypographySystem
} from './typography-improvement'

export type {
  GridSystem,
  LayoutElement,
  AlignmentGuide,
  SpacingRule,
  VisualFlow,
  LayoutAnalysis
} from './layout-restructuring'

export type {
  CompositionLayer,
  BlendMode,
  CompositionGrid,
  GridCell,
  VisualBalance,
  PlacementCandidate
} from './composition'