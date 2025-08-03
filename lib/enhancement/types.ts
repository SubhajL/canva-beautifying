import { DocumentAnalysis } from '@/lib/ai/types'

export interface EnhancementRequest {
  documentId: string
  userId: string
  analysisData: DocumentAnalysis
  preferences?: EnhancementPreferences
  targetAudience?: {
    ageGroup: string
    industry?: string
  }
}

export interface EnhancementPreferences {
  style?: 'modern' | 'classic' | 'playful' | 'professional' | 'minimalist'
  colorScheme?: 'vibrant' | 'muted' | 'monochrome' | 'complementary' | 'analogous'
  preserveContent?: boolean
  autoApprove?: boolean
}

export interface ColorEnhancement {
  palette: {
    primary: string
    secondary: string[]
    accent: string
    background: string
    text: string
  }
  adjustments: {
    contrast: number
    saturation: number
    brightness: number
  }
  replacements: Map<string, string>
}

export interface TypographyEnhancement {
  fonts: {
    heading: string
    body: string
    accent?: string
  }
  sizes: {
    base: number
    scale: number
    headings: number[]
  }
  improvements: {
    lineHeight: number
    letterSpacing: number
    paragraphSpacing: number
  }
}

export interface LayoutEnhancement {
  grid: {
    columns: number
    rows: number
    gutters: number
    margins: number
  }
  spacing: {
    sections: number
    elements: number
    padding: number
  }
  alignment: 'left' | 'center' | 'right' | 'justify'
  hierarchy: {
    levels: number
    emphasis: Map<string, number>
  }
}

export interface BackgroundEnhancement {
  type: 'solid' | 'gradient' | 'pattern' | 'image'
  value: string | {
    colors?: string[]
    direction?: string
    pattern?: string
    imageUrl?: string
    opacity?: number
  }
}

export interface DecorativeElement {
  type: 'shape' | 'icon' | 'pattern' | 'divider'
  position: { x: number; y: number }
  size: { width: number; height: number }
  style: Record<string, string | number | boolean>
  purpose: 'emphasis' | 'decoration' | 'separation' | 'background'
}

export interface EnhancementStrategy {
  id: string
  name: string
  description: string
  priority: 'low' | 'medium' | 'high'
  impact: number // 0-100
  changes: {
    colors?: ColorEnhancement
    typography?: TypographyEnhancement
    layout?: LayoutEnhancement
    background?: BackgroundEnhancement
    decorativeElements?: DecorativeElement[]
  }
}

export interface EnhancementResult {
  success: boolean
  documentId: string
  strategies: EnhancementStrategy[]
  appliedStrategies: string[]
  enhancedUrl?: string
  qualityScore: {
    before: number
    after: number
    improvement: number
  }
  metadata: {
    processingTime: number
    enhancementCount: number
    timestamp: Date
  }
  error?: string
}

export interface EnhancementPipeline {
  analyze(request: EnhancementRequest): Promise<DocumentAnalysis>
  generateStrategies(analysis: DocumentAnalysis, preferences?: EnhancementPreferences): Promise<EnhancementStrategy[]>
  applyEnhancements(documentUrl: string, strategies: EnhancementStrategy[]): Promise<string>
  evaluate(originalUrl: string, enhancedUrl: string): Promise<number>
}