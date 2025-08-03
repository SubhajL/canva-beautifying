export type AIModel = 
  | 'gemini-2.0-flash'
  | 'gpt-4o-mini'
  | 'claude-3.5-sonnet'
  | 'claude-4-sonnet'

export type UserTier = 'free' | 'basic' | 'pro' | 'premium'

export interface AIModelConfig {
  model: AIModel
  apiKey: string
  baseUrl?: string
  maxTokens?: number
  temperature?: number
  timeout?: number
}

export interface DocumentAnalysis {
  layout: {
    score: number
    issues: string[]
    suggestions: string[]
  }
  colors: {
    score: number
    palette: string[]
    issues: string[]
    suggestions: string[]
  }
  typography: {
    score: number
    fonts: string[]
    issues: string[]
    suggestions: string[]
  }
  engagement: {
    score: number
    readability: number
    visualAppeal: number
    suggestions: string[]
  }
  overallScore: number
  priority: 'low' | 'medium' | 'high'
}

export interface EnhancementRequest {
  documentUrl: string
  documentType: 'worksheet' | 'presentation' | 'marketing'
  userTier: UserTier
  preferences?: {
    style?: 'modern' | 'classic' | 'playful' | 'professional'
    colorScheme?: 'vibrant' | 'muted' | 'monochrome'
    targetAudience?: 'children' | 'teens' | 'adults' | 'business'
  }
}

export interface EnhancementResult {
  analysis: DocumentAnalysis
  suggestedEnhancements: Enhancement[]
  estimatedProcessingTime: number
  modelUsed: AIModel
}

export interface Enhancement {
  type: 'layout' | 'color' | 'typography' | 'graphic' | 'content'
  description: string
  priority: 'low' | 'medium' | 'high'
  estimatedImpact: number // 0-100
}

export interface AIProviderResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number
  maxRequestsPerHour: number
  maxRequestsPerDay: number
}

export interface CostTracking {
  model: AIModel
  timestamp: Date
  tokens: number
  cost: number
  userId: string
  documentId: string
}