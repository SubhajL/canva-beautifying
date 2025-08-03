import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy } from '@/lib/enhancement/types'

export interface EnhancementReport {
  id: string
  documentId: string
  userId: string
  generatedAt: Date
  
  // Document information
  documentInfo: {
    name: string
    originalUrl: string
    enhancedUrl: string
    documentType: 'worksheet' | 'presentation' | 'poster' | 'flyer' | 'other'
    originalSize: number
    enhancedSize: number
  }
  
  // Before/After comparison
  comparison: {
    before: AnalysisSnapshot
    after: AnalysisSnapshot
    improvements: ImprovementMetrics
  }
  
  // Applied enhancements
  enhancements: {
    applied: AppliedEnhancement[]
    strategies: EnhancementStrategy[]
    totalCount: number
    byCategory: Record<string, number>
  }
  
  // Predicted engagement
  engagement: {
    predictedScore: number
    improvementPercentage: number
    audienceImpact: AudienceImpact
  }
  
  // Educational insights
  insights: EducationalInsight[]
  
  // Report metadata
  metadata: {
    reportVersion: string
    processingTime: number
    generationMethod: 'automatic' | 'manual'
    customizations?: ReportCustomization
  }
}

export interface AnalysisSnapshot {
  overallScore: number
  visualAppeal: number
  readability: number
  engagement: number
  colorHarmony: number
  layoutScore: number
  typographyScore: number
  screenshot?: string // Base64 or URL
}

export interface ImprovementMetrics {
  overallImprovement: number
  visualAppealGain: number
  readabilityGain: number
  engagementGain: number
  colorHarmonyGain: number
  layoutImprovement: number
  typographyImprovement: number
  percentageGains: Record<string, number>
}

export interface AppliedEnhancement {
  id: string
  name: string
  category: 'color' | 'typography' | 'layout' | 'background' | 'decorative'
  description: string
  impact: 'low' | 'medium' | 'high'
  beforeValue?: string | number | Record<string, unknown>
  afterValue?: string | number | Record<string, unknown>
  visualExample?: {
    before: string
    after: string
  }
}

export interface AudienceImpact {
  targetAudience: string
  engagementLikelihood: 'low' | 'medium' | 'high' | 'very high'
  keyImprovements: string[]
  expectedOutcomes: string[]
}

export interface EducationalInsight {
  id: string
  category: string
  title: string
  description: string
  tip: string
  relatedEnhancement?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  resources?: Array<{
    title: string
    url: string
    type: 'article' | 'video' | 'tutorial'
  }>
}

export interface ReportCustomization {
  includeScreenshots: boolean
  detailLevel: 'summary' | 'detailed' | 'comprehensive'
  includeTechnicalDetails: boolean
  includeEducationalContent: boolean
  focusAreas?: Array<'color' | 'typography' | 'layout' | 'engagement'>
  language?: string
}

export interface ShareableReportLink {
  id: string
  reportId: string
  shortCode: string
  url: string
  expiresAt?: Date
  accessCount: number
  password?: string
  createdAt: Date
}

export interface ReportGenerationOptions {
  documentId: string
  userId: string
  analysisData: {
    before: DocumentAnalysis
    after: DocumentAnalysis
  }
  enhancementData: {
    strategies: EnhancementStrategy[]
    appliedStrategies: string[]
  }
  customization?: ReportCustomization
  format?: 'json' | 'pdf' | 'html'
}