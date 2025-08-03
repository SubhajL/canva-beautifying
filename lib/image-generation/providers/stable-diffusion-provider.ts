import Replicate from 'replicate'
import { BaseImageProvider } from './base-provider'
import { ImageGenerationRequest, GeneratedImage, GenerationError } from '../types'

export class StableDiffusionProvider extends BaseImageProvider {
  private replicate: Replicate

  constructor(apiKey: string, fallbackKey?: string) {
    super(apiKey, 'stable-diffusion-xl', fallbackKey)
    this.replicate = new Replicate({
      auth: apiKey,
    })
  }

  async generate(request: ImageGenerationRequest): Promise<GeneratedImage> {
    let retries = 0
    const maxRetries = 2
    
    while (retries <= maxRetries) {
      try {
        const prompt = this.addStyleToPrompt(
          this.sanitizePrompt(request.prompt),
          request.style
        )
        
        const size = this.getSizeMapping(request.size || '1024x1024')
        
        // Use latest Stable Diffusion XL model on Replicate
        const model = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
        
        // Enhanced input parameters for better quality
        const input = {
          prompt,
          negative_prompt: request.negativePrompt || this.getDefaultNegativePrompt(request.style),
          width: size.width,
          height: size.height,
          num_outputs: 1,
          scheduler: "K_EULER_ANCESTRAL", // Better for creative outputs
          num_inference_steps: request.quality === 'hd' ? 50 : 30, // More steps for higher quality
          guidance_scale: this.getGuidanceScale(request.style),
          prompt_strength: 0.8,
          refine: request.quality === 'hd' ? "expert_ensemble_refiner" : "no_refiner",
          high_noise_frac: 0.8,
          seed: request.seed,
          apply_watermark: false // Remove watermark
        }

        console.log('Generating image with Stable Diffusion:', { model, prompt: prompt.substring(0, 100) })
        
        const output = await this.replicate.run(model, { input }) as string[]
        
        if (!output || output.length === 0) {
          throw new Error('No image generated')
        }
        
        const imageUrl = output[0]
        
        // Verify image is accessible
        const imgResponse = await fetch(imageUrl, { method: 'HEAD' })
        if (!imgResponse.ok) {
          throw new Error('Generated image URL is not accessible')
        }
        
        return {
          url: imageUrl,
          model: 'stable-diffusion-xl',
          prompt: request.prompt,
          size: request.size || '1024x1024',
          style: request.style || 'realistic',
          cost: this.estimateCost(request),
          generatedAt: new Date(),
          metadata: {
            scheduler: input.scheduler,
            steps: input.num_inference_steps,
            guidanceScale: input.guidance_scale,
            retries: retries
          }
        }
      } catch (error) {
        const isRetryable = this.isRetryableError(error)
        
        if (isRetryable && retries < maxRetries) {
          retries++
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
          continue
        }
        
        const genError: GenerationError = {
          code: 'API_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate image',
          model: 'stable-diffusion-xl',
          fallbackAvailable: !!process.env.OPENAI_API_KEY // Fallback to DALL-E if available
        }
        
        if (error instanceof Error) {
          if (error.message.includes('rate limit')) {
            genError.code = 'RATE_LIMIT'
          } else if (error.message.includes('NSFW')) {
            genError.code = 'INVALID_PROMPT'
            genError.message = 'Content policy violation detected'
          } else if (error.message.includes('payment')) {
            genError.code = 'INSUFFICIENT_CREDITS'
          } else if (error.message.includes('timeout')) {
            genError.code = 'TIMEOUT'
          }
        }
        
        throw genError
      }
    }
    
    throw new Error('Max retries exceeded')
  }
  
  private getDefaultNegativePrompt(style?: string): string {
    const base = "ugly, blurry, poor quality, distorted, disfigured, low quality, low resolution, jpeg artifacts, watermark, text, logo"
    
    const styleSpecific: Record<string, string> = {
      'photographic': 'cartoon, anime, illustration, painting, drawing',
      'digital-art': 'photographic, realistic photo',
      'cartoon': 'realistic, photographic, dark, serious',
      'watercolor': 'digital art, 3d render, photographic',
      'pencil-sketch': 'color, photographic, digital',
      'educational': 'dark, scary, violent, inappropriate'
    }
    
    return style && styleSpecific[style] ? `${base}, ${styleSpecific[style]}` : base
  }
  
  private getGuidanceScale(style?: string): number {
    const styleGuides: Record<string, number> = {
      'photographic': 7.5,
      'digital-art': 10,
      'cartoon': 12,
      'watercolor': 8,
      'pencil-sketch': 6,
      'educational': 8,
      'realistic': 7.5
    }
    
    return styleGuides[style || 'realistic'] || 7.5
  }
  
  private isRetryableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    
    const retryableMessages = [
      'rate limit',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT',
      'socket hang up',
      'network',
      'prediction is starting'
    ]
    
    const errorMessage = (error as Error).message?.toLowerCase() || ''
    return retryableMessages.some(msg => errorMessage.includes(msg))
  }

  estimateCost(request: ImageGenerationRequest): number {
    // Replicate pricing for SDXL: ~$0.0032 per image
    const baseCost = 0.0032
    
    // Adjust for size
    const size = request.size || '1024x1024'
    let sizeFactor = 1
    
    if (size === '1024x1792' || size === '1792x1024') {
      sizeFactor = 1.5 // Larger images cost more
    } else if (size === '512x512') {
      sizeFactor = 0.5 // Smaller images cost less
    } else if (size === '256x256') {
      sizeFactor = 0.25
    }
    
    return baseCost * sizeFactor
  }

  async isAvailable(): Promise<boolean> {
    if (!await super.isAvailable()) return false
    
    try {
      // Test API connection
      await this.replicate.models.get("stability-ai", "sdxl")
      return true
    } catch {
      // Try fallback key if available
      if (this.fallbackKey) {
        this.replicate = new Replicate({ auth: this.fallbackKey })
        try {
          await this.replicate.models.get("stability-ai", "sdxl")
          this.apiKey = this.fallbackKey // Switch to fallback
          return true
        } catch {
          return false
        }
      }
      return false
    }
  }
}