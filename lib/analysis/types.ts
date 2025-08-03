import { DocumentAnalysis } from '@/lib/ai/types'

export interface LayoutMetrics {
  whitespace: number // Percentage of whitespace
  alignment: {
    horizontal: 'left' | 'center' | 'right' | 'mixed'
    vertical: 'top' | 'middle' | 'bottom' | 'mixed'
    consistency: number // 0-100
  }
  hierarchy: {
    levels: number
    clarity: number // 0-100
  }
  grid: {
    detected: boolean
    consistency: number // 0-100
  }
  margins: {
    top: number
    right: number
    bottom: number
    left: number
    consistency: number // 0-100
  }
}

export interface ColorMetrics {
  palette: {
    primary: string[]
    secondary: string[]
    accent: string[]
  }
  harmony: {
    type: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'custom'
    score: number // 0-100
  }
  contrast: {
    wcagAAA: boolean
    wcagAA: boolean
    score: number // 0-100
  }
  accessibility: {
    colorBlindSafe: boolean
    issues: string[]
  }
}

export interface TypographyMetrics {
  fonts: {
    families: string[]
    sizes: number[]
    weights: number[]
  }
  hierarchy: {
    levels: number
    consistency: number // 0-100
  }
  readability: {
    fleschKincaid: number
    lineHeight: number
    characterSpacing: number
    score: number // 0-100
  }
  consistency: {
    fontPairing: number // 0-100
    sizeRatio: number // 0-100
  }
}

export interface AgeAppropriateness {
  detectedAge: 'children' | 'teens' | 'adults' | 'all-ages'
  confidence: number // 0-100
  factors: {
    complexity: number
    visualStyle: number
    contentMaturity: number
  }
}

export interface SubjectMatter {
  primary: string
  secondary: string[]
  confidence: number // 0-100
  keywords: string[]
}

export interface EngagementMetrics {
  visualComplexity: number // 0-100
  interestElements: string[]
  attentionAnchors: number
  flowScore: number // 0-100
  emotionalTone: 'positive' | 'neutral' | 'negative' | 'mixed'
}

export interface DocumentContext {
  imageData: ImageData | null
  metadata: {
    width: number
    height: number
    format: string
    size: number
  }
  type: 'worksheet' | 'presentation' | 'marketing'
  userPreferences?: {
    style?: 'modern' | 'classic' | 'playful' | 'professional'
    colorScheme?: 'vibrant' | 'muted' | 'monochrome'
    targetAudience?: 'children' | 'teens' | 'adults' | 'business'
  }
}

export interface AnalysisEngine {
  analyzeLayout(context: DocumentContext): Promise<LayoutMetrics>
  analyzeColors(context: DocumentContext): Promise<ColorMetrics>
  analyzeTypography(context: DocumentContext): Promise<TypographyMetrics>
  analyzeAgeAppropriateness(context: DocumentContext): Promise<AgeAppropriateness>
  identifySubjectMatter(context: DocumentContext): Promise<SubjectMatter>
  calculateEngagement(context: DocumentContext): Promise<EngagementMetrics>
  generateCompleteAnalysis(context: DocumentContext): Promise<DocumentAnalysis>
}

export interface AnalysisCache {
  get(documentId: string): Promise<DocumentAnalysis | null>
  set(documentId: string, analysis: DocumentAnalysis): Promise<void>
  invalidate(documentId: string): Promise<void>
}