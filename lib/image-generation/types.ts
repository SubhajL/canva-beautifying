export interface ImageGenerationRequest {
  prompt: string
  style?: ImageStyle
  model?: 'stable-diffusion-xl' | 'dall-e-3'
  size?: ImageSize
  quality?: 'standard' | 'hd'
  negativePrompt?: string
  seed?: number
  userTier?: 'free' | 'basic' | 'pro' | 'premium'
  userId?: string
}

export type ImageStyle = 
  | 'realistic'
  | 'artistic'
  | 'cartoon'
  | 'watercolor'
  | 'minimalist'
  | 'abstract'
  | 'professional'
  | 'playful'
  | 'educational'
  | 'photographic'
  | 'digital-art'
  | 'pencil-sketch'

export type ImageSize = 
  | '256x256'
  | '512x512'
  | '1024x1024'
  | '1024x1792'
  | '1792x1024'

export interface GeneratedImage {
  url: string
  model: 'stable-diffusion-xl' | 'dall-e-3'
  prompt: string
  revisedPrompt?: string
  size: ImageSize
  style: ImageStyle
  cost: number
  generatedAt: Date
  cached?: boolean
}

export interface PromptTemplate {
  id: string
  name: string
  template: string
  variables: string[]
  style: ImageStyle
  examples: string[]
}

export interface GenerationError {
  code: 'RATE_LIMIT' | 'INVALID_PROMPT' | 'API_ERROR' | 'INSUFFICIENT_CREDITS'
  message: string
  model: string
  fallbackAvailable: boolean
}

export interface ImageGenerationProvider {
  generate(request: ImageGenerationRequest): Promise<GeneratedImage>
  validatePrompt(prompt: string): boolean
  estimateCost(request: ImageGenerationRequest): number
  isAvailable(): Promise<boolean>
}

export interface BackgroundGenerationRequest extends ImageGenerationRequest {
  documentType: 'worksheet' | 'presentation' | 'poster' | 'flyer'
  colorPalette: string[]
  theme?: string
}

export interface DecorativeElementRequest extends ImageGenerationRequest {
  elementType: 'icon' | 'pattern' | 'border' | 'illustration' | 'divider'
  position?: 'header' | 'footer' | 'corner' | 'center' | 'side'
  transparency?: boolean
}

export interface CachedAsset {
  id: string
  url: string
  prompt: string
  model: string
  style: ImageStyle
  tags: string[]
  usageCount: number
  createdAt: Date
  expiresAt?: Date
}

export interface GenerationMetrics {
  totalRequests: number
  successfulGenerations: number
  failedGenerations: number
  totalCost: number
  averageGenerationTime: number
  cacheHitRate: number
  modelUsage: {
    'stable-diffusion-xl': number
    'dall-e-3': number
  }
}