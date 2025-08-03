import OpenAI from 'openai'
import { BaseImageProvider } from './base-provider'
import { ImageGenerationRequest, GeneratedImage, GenerationError, ImageSize } from '../types'

export class DallE3Provider extends BaseImageProvider {
  private openai: OpenAI

  constructor(apiKey: string, fallbackKey?: string) {
    super(apiKey, 'dall-e-3', fallbackKey)
    this.openai = new OpenAI({
      apiKey: apiKey,
    })
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    // Validate prompt before processing
    if (!this.validatePrompt(request.prompt)) {
      const genError: GenerationError = {
        code: 'INVALID_PROMPT',
        message: 'Prompt contains banned content',
        model: 'dall-e-3',
        fallbackAvailable: !!process.env.REPLICATE_API_KEY
      }
      throw genError
    }
    
    let retries = 0
    const maxRetries = 2
    let usedFallbackKey = false
    
    while (retries <= maxRetries) {
      try {
        const prompt = this.addStyleToPrompt(
          this.sanitizePrompt(request.prompt),
          request.style
        )
        
        // DALL-E 3 only supports specific sizes
        const dalleSize = this.mapToDalleSize(request.size || '1024x1024')
        
        // Create a promise that will reject after timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 60000)
        })
        
        // Race between the API call and timeout
        const response = await Promise.race([
          this.openai.images.generate({
            model: "dall-e-3",
            prompt,
            n: 1,
            size: dalleSize,
            quality: request.quality || 'standard',
            response_format: 'url'
          }),
          timeoutPromise
        ])

        if (!response.data || response.data.length === 0) {
          throw new Error('No image generated')
        }

        const imageData = response.data[0]
        
        // Download and validate the image URL
        if (!imageData.url) {
          throw new Error('No image URL returned')
        }
        
        // Verify image is accessible
        const imgResponse = await fetch(imageData.url, { method: 'HEAD' })
        if (!imgResponse.ok) {
          throw new Error('Generated image URL is not accessible')
        }
        
        return {
          url: imageData.url,
          model: 'dall-e-3',
          prompt: request.prompt,
          revisedPrompt: imageData.revised_prompt,
          size: request.size || '1024x1024',
          style: request.style || 'realistic',
          cost: this.estimateCost(request),
          generatedAt: new Date(),
          metadata: {
            quality: request.quality || 'standard',
            retries: retries
          }
        }
      } catch (error) {
        const isRetryable = this.isRetryableError(error)
        
        // Try fallback key on auth errors
        if (!usedFallbackKey && this.fallbackKey && error instanceof Error && 
            (error.message.includes('Invalid API key') || error.message.includes('Unauthorized'))) {
          this.openai = new OpenAI({ apiKey: this.fallbackKey })
          this.apiKey = this.fallbackKey
          usedFallbackKey = true
          retries++ // Increment to avoid infinite loop
          continue
        }
        
        if (isRetryable && retries < maxRetries) {
          retries++
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
          continue
        }
        
        const genError: GenerationError = {
          code: 'API_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate image',
          model: 'dall-e-3',
          fallbackAvailable: !!process.env.REPLICATE_API_KEY // Fallback to SD if available
        }
        
        if (error instanceof Error) {
          if (error.message.includes('rate limit')) {
            genError.code = 'RATE_LIMIT'
            genError.message = 'Rate limit exceeded'
          } else if (error.message.includes('content policy')) {
            genError.code = 'INVALID_PROMPT'
          } else if (error.message.includes('insufficient_quota')) {
            genError.code = 'INSUFFICIENT_CREDITS'
          } else if (error.message.includes('timeout') || error.message === 'Request timeout') {
            genError.code = 'TIMEOUT'
            genError.message = 'Request timeout'
          }
        }
        
        throw genError
      }
    }
    
    throw new Error('Max retries exceeded')
  }
  
  private isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    
    const retryableMessages = [
      'rate limit',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'socket hang up',
      'network'
    ]
    
    const errorMessage = (error as Error).message?.toLowerCase() || ''
    return retryableMessages.some(msg => errorMessage.includes(msg))
  }

  private mapToDalleSize(size: ImageSize): "1024x1024" | "1024x1792" | "1792x1024" {
    // DALL-E 3 only supports these specific sizes
    switch (size) {
      case '1024x1792':
        return '1024x1792'
      case '1792x1024':
        return '1792x1024'
      default:
        return '1024x1024'
    }
  }

  estimateCost(request: ImageGenerationRequest): number {
    // DALL-E 3 pricing
    const quality = request.quality || 'standard'
    const size = request.size || '1024x1024'
    
    // Standard quality pricing
    if (quality === 'standard') {
      if (size === '1024x1024') return 0.040
      if (size === '1024x1792' || size === '1792x1024') return 0.080
    }
    
    // HD quality pricing
    if (quality === 'hd') {
      if (size === '1024x1024') return 0.080
      if (size === '1024x1792' || size === '1792x1024') return 0.120
    }
    
    return 0.040 // Default
  }

  async isAvailable(): Promise<boolean> {
    if (!await super.isAvailable()) return false
    
    try {
      // Test API connection
      await this.openai.models.list()
      return true
    } catch (error) {
      // Try fallback key if available
      if (this.fallbackKey) {
        const originalApiKey = this.apiKey
        const originalOpenAI = this.openai
        
        this.openai = new OpenAI({ apiKey: this.fallbackKey })
        this.apiKey = this.fallbackKey
        
        try {
          await this.openai.models.list()
          // Keep using fallback key
          return true
        } catch {
          // Restore original if fallback also fails
          this.openai = originalOpenAI
          this.apiKey = originalApiKey
          return false
        }
      }
      return false
    }
  }

  override validatePrompt(prompt: string): boolean {
    // DALL-E 3 has stricter content policies
    if (!super.validatePrompt(prompt)) return false
    
    // Additional checks for DALL-E 3
    const additionalBannedWords = [
      'celebrity', 'politician', 'political', 'public figure',
      'trademark', 'copyright', 'brand'
    ]
    
    const lowerPrompt = prompt.toLowerCase()
    return !additionalBannedWords.some(word => lowerPrompt.includes(word))
  }
}