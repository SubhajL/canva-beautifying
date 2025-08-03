import { StableDiffusionProvider } from './providers/stable-diffusion-provider'
import { DallE3Provider } from './providers/dalle-provider'
import { PromptEngineer } from './prompt-engineering'
import { AssetCacheStandalone } from './asset-cache-standalone'
import { 
  ImageGenerationRequest, 
  GeneratedImage, 
  BackgroundGenerationRequest,
  DecorativeElementRequest,
  GenerationError,
  ImageGenerationProvider
} from './types'

/**
 * Standalone version of ImageGenerationService for use outside Next.js context
 */
export class ImageGenerationServiceStandalone {
  private stableDiffusion?: StableDiffusionProvider
  private dalle3?: DallE3Provider
  private promptEngineer: PromptEngineer
  private cache: AssetCacheStandalone
  private costTracker: Map<string, number> = new Map()

  constructor() {
    this.promptEngineer = new PromptEngineer()
    this.cache = new AssetCacheStandalone()
    this.initializeProviders()
  }

  private initializeProviders() {
    // Initialize Stable Diffusion if API key is available
    const replicateKey = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY
    const replicateFallback = process.env.REPLICATE_API_KEY_FALLBACK
    
    if (replicateKey && replicateKey !== 'your_replicate_api_token_here') {
      this.stableDiffusion = new StableDiffusionProvider(replicateKey, replicateFallback)
    }

    // Initialize DALL-E 3 if API key is available
    const openaiKey = process.env.OPENAI_API_KEY
    const openaiFallback = process.env.OPENAI_API_KEY_FALLBACK
    
    if (openaiKey && !openaiKey.includes('your_openai_api_key_here') && !openaiKey.includes('your-')) {
      this.dalle3 = new DallE3Provider(openaiKey, openaiFallback)
    }
  }

  async generateBackground(request: BackgroundGenerationRequest): Promise<GeneratedImage> {
    // Generate optimized prompt
    const basePrompt = this.promptEngineer.generateBackgroundPrompt(request)
    
    // Check cache first
    const cached = await this.cache.findSimilar(basePrompt, request.style)
    if (cached) {
      return {
        ...cached,
        cached: true
      }
    }

    // Prepare generation request
    const genRequest: ImageGenerationRequest = {
      ...request,
      prompt: basePrompt,
      negativePrompt: this.promptEngineer.generateNegativePrompt(request.style)
    }

    // Generate with appropriate model
    return this.generateWithFallback(genRequest)
  }

  async generateDecorativeElement(request: DecorativeElementRequest): Promise<GeneratedImage> {
    // Generate optimized prompt
    const basePrompt = this.promptEngineer.generateDecorativeElementPrompt(request)
    
    // Check cache first
    const cached = await this.cache.findSimilar(basePrompt, request.style)
    if (cached) {
      return {
        ...cached,
        cached: true
      }
    }

    // Prepare generation request
    const genRequest: ImageGenerationRequest = {
      ...request,
      prompt: basePrompt,
      negativePrompt: this.promptEngineer.generateNegativePrompt(request.style)
    }

    // Generate with appropriate model
    return this.generateWithFallback(genRequest)
  }

  async generateImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    // Validate prompt
    const provider = this.selectProvider(request)
    if (!provider.validatePrompt(request.prompt)) {
      throw new Error('Invalid prompt: contains prohibited content')
    }

    // Check cache
    const cached = await this.cache.findSimilar(request.prompt, request.style)
    if (cached) {
      return {
        ...cached,
        cached: true
      }
    }

    // Generate with fallback support
    return this.generateWithFallback(request)
  }

  private async generateWithFallback(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const primaryProvider = this.selectProvider(request)
    
    try {
      // Enhance prompt for the specific model
      const enhancedRequest = {
        ...request,
        prompt: this.promptEngineer.enhancePromptForModel(
          request.prompt,
          primaryProvider === this.dalle3 ? 'dall-e-3' : 'stable-diffusion-xl'
        )
      }

      // Try primary provider
      const result = await primaryProvider.generate(enhancedRequest)
      
      // Track cost
      this.trackCost(request.userId || 'anonymous', result.cost)
      
      // Cache result
      await this.cache.store(result)
      
      return result
    } catch (error) {
      // Handle generation error
      const genError = error as GenerationError
      
      // Try fallback if available
      if (genError.fallbackAvailable && this.stableDiffusion && primaryProvider !== this.stableDiffusion) {
        console.warn(`Primary generation failed, falling back to Stable Diffusion: ${genError.message}`)
        
        const fallbackRequest = {
          ...request,
          prompt: this.promptEngineer.enhancePromptForModel(request.prompt, 'stable-diffusion-xl')
        }
        
        const result = await this.stableDiffusion.generate(fallbackRequest)
        
        // Track cost
        this.trackCost(request.userId || 'anonymous', result.cost)
        
        // Cache result
        await this.cache.store(result)
        
        return result
      }
      
      throw error
    }
  }

  private selectProvider(request: ImageGenerationRequest): ImageGenerationProvider {
    // If model is explicitly specified
    if (request.model === 'dall-e-3' && this.dalle3) {
      return this.dalle3
    }
    if (request.model === 'stable-diffusion-xl' && this.stableDiffusion) {
      return this.stableDiffusion
    }

    // Select based on user tier and availability
    const userTier = request.userTier || 'free'
    
    // Pro and Premium users get DALL-E 3 if available
    if ((userTier === 'premium' || userTier === 'pro') && this.dalle3) {
      return this.dalle3
    }
    
    // Free and Basic users get Stable Diffusion if available
    if ((userTier === 'free' || userTier === 'basic') && this.stableDiffusion) {
      return this.stableDiffusion
    }
    
    // If tier-based selection didn't work, use any available provider
    if (this.stableDiffusion) {
      return this.stableDiffusion
    }
    
    if (this.dalle3) {
      return this.dalle3
    }
    
    throw new Error('No image generation providers available')
  }

  private trackCost(userId: string, cost: number) {
    const currentCost = this.costTracker.get(userId) || 0
    this.costTracker.set(userId, currentCost + cost)
  }

  async getUserCost(userId: string): Promise<number> {
    return this.costTracker.get(userId) || 0
  }

  async getAvailableModels(): Promise<Array<{ model: string; available: boolean; estimatedCost: number }>> {
    const models = []
    
    if (this.stableDiffusion) {
      models.push({
        model: 'stable-diffusion-xl',
        available: await this.stableDiffusion.isAvailable(),
        estimatedCost: this.stableDiffusion.estimateCost({ prompt: '', size: '1024x1024' })
      })
    }
    
    if (this.dalle3) {
      models.push({
        model: 'dall-e-3',
        available: await this.dalle3.isAvailable(),
        estimatedCost: this.dalle3.estimateCost({ prompt: '', size: '1024x1024', quality: 'standard' })
      })
    }
    
    return models
  }

  suggestPromptImprovements(prompt: string): string[] {
    return this.promptEngineer.suggestPromptImprovements(prompt)
  }
}