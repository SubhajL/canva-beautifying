// Enhancement Pipeline Types and Interfaces

export type DocumentType = 
  | 'educational' 
  | 'presentation' 
  | 'marketing' 
  | 'business' 
  | 'creative' 
  | 'technical' 
  | 'general'

export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  additional?: string[]
}

export type PipelineStage = 
  | 'initial-analysis'
  | 'enhancement-planning'
  | 'asset-generation'
  | 'final-composition'

export type PipelineStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface PipelineContext {
  documentId: string
  userId: string
  subscriptionTier: 'free' | 'basic' | 'pro' | 'premium'
  originalFileUrl: string
  fileType: string
  startTime: number
  settings?: EnhancementSettings
}

export interface EnhancementSettings {
  targetStyle?: 'modern' | 'classic' | 'playful' | 'professional' | 'educational'
  colorScheme?: 'vibrant' | 'pastel' | 'monochrome' | 'brand' | 'auto'
  layoutPreference?: 'minimal' | 'balanced' | 'rich' | 'auto'
  aiModel?: string
  quality?: 'standard' | 'high' | 'premium'
  generateAssets?: boolean
  preserveContent?: boolean
}

// Stage 1: Initial Analysis Results
export interface InitialAnalysisResult {
  extractedText: {
    title?: string
    headings: string[]
    bodyText: string[]
    captions: string[]
  }
  layoutAnalysis: {
    structure: 'single-column' | 'multi-column' | 'grid' | 'freeform'
    sections: LayoutSection[]
    whitespace: number // percentage
    alignment: 'left' | 'center' | 'right' | 'justified' | 'mixed'
  }
  designIssues: DesignIssue[]
  currentScore: {
    overall: number // 0-100
    color: number
    typography: number
    layout: number
    visuals: number
  }
  metadata: {
    pageCount?: number
    dimensions: { width: number; height: number }
    fileSize: number
    hasImages: boolean
    imageCount: number
  }
}

export interface LayoutSection {
  id: string
  type: 'header' | 'content' | 'sidebar' | 'footer' | 'image' | 'text'
  bounds: { x: number; y: number; width: number; height: number }
  zIndex: number
}

export interface DesignIssue {
  type: 'color' | 'typography' | 'layout' | 'spacing' | 'alignment' | 'contrast'
  severity: 'low' | 'medium' | 'high'
  description: string
  location?: { x: number; y: number; width: number; height: number }
}

// Stage 2: Enhancement Planning Results
export interface EnhancementPlan {
  strategy: {
    approach: 'subtle' | 'moderate' | 'dramatic'
    priority: ('color' | 'typography' | 'layout' | 'visuals')[]
    estimatedImpact: number // 0-100
  }
  colorEnhancements: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    backgroundColor: string
    textColor: string
    adjustments: ColorAdjustment[]
  }
  typographyEnhancements: {
    headingFont: FontSelection
    bodyFont: FontSelection
    sizes: { h1: number; h2: number; h3: number; body: number; caption: number }
    lineHeight: number
    letterSpacing: number
  }
  layoutEnhancements: {
    grid: { columns: number; gutter: number; margin: number }
    sections: PlannedSection[]
    whitespaceAdjustments: WhitespaceAdjustment[]
  }
  assetRequirements: {
    backgrounds: BackgroundRequirement[]
    decorativeElements: DecorativeRequirement[]
    educationalGraphics: GraphicRequirement[]
  }
}

export interface ColorAdjustment {
  target: 'background' | 'text' | 'accent' | 'border'
  from: string
  to: string
  reason: string
}

export interface FontSelection {
  family: string
  weight: number
  style: 'normal' | 'italic'
  fallback: string[]
}

export interface PlannedSection {
  id: string
  type: string
  newBounds: { x: number; y: number; width: number; height: number }
  modifications: string[]
}

export interface WhitespaceAdjustment {
  area: 'margins' | 'padding' | 'spacing'
  value: number
  unit: 'px' | '%' | 'em'
}

export interface BackgroundRequirement {
  style: 'gradient' | 'pattern' | 'image' | 'solid'
  theme: string
  colors: string[]
  opacity: number
}

export interface DecorativeRequirement {
  type: 'icon' | 'shape' | 'border' | 'divider'
  style: string
  quantity: number
  placement: 'random' | 'grid' | 'edges' | 'corners'
}

export interface GraphicRequirement {
  type: 'chart' | 'diagram' | 'illustration' | 'infographic'
  data?: Record<string, unknown>
  style: string
  dimensions: { width: number; height: number }
}

// Stage 3: Asset Generation Results
export interface GeneratedAssets {
  backgrounds: GeneratedBackground[]
  decorativeElements: GeneratedElement[]
  educationalGraphics: GeneratedGraphic[]
  totalAssets: number
  storageUsed: number // in bytes
}

export interface GeneratedBackground {
  id: string
  url: string
  type: 'gradient' | 'pattern' | 'image'
  dimensions: { width: number; height: number }
  fileSize: number
}

export interface GeneratedElement {
  id: string
  url: string
  type: string
  position: { x: number; y: number }
  dimensions: { width: number; height: number }
  rotation?: number
}

export interface GeneratedGraphic {
  id: string
  url: string
  type: string
  caption?: string
  dimensions: { width: number; height: number }
  embedData?: Record<string, unknown>
}

// Stage 4: Final Composition Results
export interface CompositionResult {
  enhancedFileUrl: string
  thumbnailUrl: string
  improvements: {
    colorScore: { before: number; after: number }
    typographyScore: { before: number; after: number }
    layoutScore: { before: number; after: number }
    visualScore: { before: number; after: number }
    overallScore: { before: number; after: number }
  }
  appliedEnhancements: string[]
  processingTime: {
    analysis: number
    planning: number
    generation: number
    composition: number
    total: number
  }
  metadata: {
    fileSize: number
    format: string
    dimensions: { width: number; height: number }
    pageCount?: number
  }
}

// Pipeline State
export interface PipelineState {
  id: string
  context: PipelineContext
  currentStage: PipelineStage
  status: PipelineStatus
  progress: number // 0-100
  stages: {
    initialAnalysis?: {
      status: PipelineStatus
      result?: InitialAnalysisResult
      error?: Error
      startTime?: number
      endTime?: number
    }
    enhancementPlanning?: {
      status: PipelineStatus
      result?: EnhancementPlan
      error?: Error
      startTime?: number
      endTime?: number
    }
    assetGeneration?: {
      status: PipelineStatus
      result?: GeneratedAssets
      error?: Error
      startTime?: number
      endTime?: number
    }
    finalComposition?: {
      status: PipelineStatus
      result?: CompositionResult
      error?: Error
      startTime?: number
      endTime?: number
    }
  }
  errors: PipelineError[]
  createdAt: Date
  updatedAt: Date
}

export interface PipelineError {
  stage: PipelineStage
  message: string
  code?: string
  timestamp: Date
  retry?: number
}

// Pipeline Events
export type PipelineEvent = 
  | { type: 'stage-started'; stage: PipelineStage; timestamp: Date }
  | { type: 'stage-completed'; stage: PipelineStage; result: unknown; timestamp: Date }
  | { type: 'stage-failed'; stage: PipelineStage; error: Error; timestamp: Date }
  | { type: 'progress-updated'; progress: number; message?: string }
  | { type: 'pipeline-completed'; result: CompositionResult }
  | { type: 'pipeline-failed'; error: Error }
  | { type: 'pipeline-cancelled'; reason?: string }