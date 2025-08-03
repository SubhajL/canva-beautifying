import { ImageGenerationService } from '../image-generation-service'
import { StableDiffusionProvider } from '../providers/stable-diffusion-provider'
import { DallE3Provider } from '../providers/dalle-provider'
import { ImageGenerationRequest, BackgroundGenerationRequest, DecorativeElementRequest } from '../types'

// Mock providers and dependencies
jest.mock('../providers/stable-diffusion-provider')
jest.mock('../providers/dalle-provider')
jest.mock('../prompt-engineering')
jest.mock('../asset-cache')

// Import mocked constructors
import { PromptEngineer } from '../prompt-engineering'
import { AssetCache } from '../asset-cache'

const MockedStableDiffusionProvider = StableDiffusionProvider as jest.MockedClass<typeof StableDiffusionProvider>
const MockedDallE3Provider = DallE3Provider as jest.MockedClass<typeof DallE3Provider>
const MockedPromptEngineer = PromptEngineer as jest.MockedClass<typeof PromptEngineer>
const MockedAssetCache = AssetCache as jest.MockedClass<typeof AssetCache>

describe('ImageGenerationService', () => {
  let service: ImageGenerationService
  let mockStableDiffusion: jest.Mocked<StableDiffusionProvider>
  let mockDallE3: jest.Mocked<DallE3Provider>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up environment variables
    process.env.REPLICATE_API_KEY = 'test-replicate-key'
    process.env.OPENAI_API_KEY = 'test-openai-key'
    
    // Set up mock implementations
    mockStableDiffusion = {
      generate: jest.fn(),
      validatePrompt: jest.fn(),
      isAvailable: jest.fn(),
      estimateCost: jest.fn()
    } as any
    
    mockDallE3 = {
      generate: jest.fn(),
      validatePrompt: jest.fn(),
      isAvailable: jest.fn(),
      estimateCost: jest.fn()
    } as any
    
    MockedStableDiffusionProvider.mockImplementation(() => mockStableDiffusion)
    MockedDallE3Provider.mockImplementation(() => mockDallE3)
    
    // Mock PromptEngineer
    MockedPromptEngineer.mockImplementation(() => ({
      generateBackgroundPrompt: jest.fn(),
      generateDecorativeElementPrompt: jest.fn(),
      generateNegativePrompt: jest.fn(),
      enhancePromptForModel: jest.fn(),
      suggestPromptImprovements: jest.fn()
    } as any))
    
    // Mock AssetCache
    MockedAssetCache.mockImplementation(() => ({
      findSimilar: jest.fn(),
      store: jest.fn()
    } as any))
    
    service = new ImageGenerationService()
  })

  describe('generateBackground', () => {
    it('should generate a background successfully', async () => {
      const request: BackgroundGenerationRequest = {
        documentType: 'worksheet',
        colorPalette: ['#1a73e8', '#34a853'],
        theme: 'educational',
        style: 'modern',
        mood: 'professional',
        size: '1792x1024',
        userTier: 'pro',
        userId: 'test-user'
      }

      const mockResult = {
        url: 'https://example.com/background.png',
        model: 'dall-e-3' as const,
        prompt: 'Generated background',
        size: '1792x1024' as any,
        style: 'modern' as any,
        cost: 0.080,
        generatedAt: new Date()
      }

      // Mock cache miss
      ;(service as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
      ;(service as any).cache.store = jest.fn()

      // Mock prompt engineering
      ;(service as any).promptEngineer.generateBackgroundPrompt = jest.fn()
        .mockReturnValue('A modern educational background')
      ;(service as any).promptEngineer.generateNegativePrompt = jest.fn()
        .mockReturnValue('blurry, low quality')
      ;(service as any).promptEngineer.enhancePromptForModel = jest.fn()
        .mockImplementation((prompt) => `${prompt}, enhanced`)

      // Mock provider selection and generation
      // Pro users get DALL-E 3, so mock that
      mockDallE3.generate = jest.fn().mockResolvedValue(mockResult)
      mockDallE3.validatePrompt = jest.fn().mockReturnValue(true)

      const result = await service.generateBackground(request)

      expect(result).toEqual(mockResult)
      expect((service as any).cache.store).toHaveBeenCalledWith(mockResult)
    })

    it('should return cached result if available', async () => {
      const request: BackgroundGenerationRequest = {
        documentType: 'presentation',
        colorPalette: ['#000000', '#ffffff'],
        theme: 'minimal',
        style: 'minimalist',
        mood: 'clean',
        size: '1792x1024',
        userTier: 'basic',
        userId: 'test-user'
      }

      const cachedResult = {
        url: 'https://example.com/cached-bg.png',
        model: 'dall-e-3' as const,
        prompt: 'Cached background',
        size: '1792x1024' as any,
        style: 'minimalist' as any,
        cost: 0,
        generatedAt: new Date(),
        cached: true
      }

      ;(service as any).cache.findSimilar = jest.fn().mockResolvedValue(cachedResult)
      ;(service as any).promptEngineer.generateBackgroundPrompt = jest.fn()
        .mockReturnValue('A minimalist background')

      const result = await service.generateBackground(request)

      expect(result).toEqual({ ...cachedResult, cached: true })
      expect(mockStableDiffusion.generate).not.toHaveBeenCalled()
      expect(mockDallE3.generate).not.toHaveBeenCalled()
    })
  })

  describe('generateDecorativeElement', () => {
    it('should generate a decorative element', async () => {
      const request: DecorativeElementRequest = {
        elementType: 'icon',
        position: 'header',
        transparency: true,
        style: 'minimalist',
        prompt: 'lightbulb icon',
        userTier: 'premium',
        userId: 'test-user'
      }

      const mockResult = {
        url: 'https://example.com/icon.png',
        model: 'dall-e-3' as const,
        prompt: 'lightbulb icon',
        size: '512x512' as any,
        style: 'minimalist' as any,
        cost: 0.040,
        generatedAt: new Date()
      }

      ;(service as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
      ;(service as any).cache.store = jest.fn()
      ;(service as any).promptEngineer.generateDecorativeElementPrompt = jest.fn()
        .mockReturnValue('A minimalist lightbulb icon')
      ;(service as any).promptEngineer.generateNegativePrompt = jest.fn()
        .mockReturnValue('complex, cluttered')
      ;(service as any).promptEngineer.enhancePromptForModel = jest.fn()
        .mockImplementation((prompt) => prompt)

      mockDallE3.generate = jest.fn().mockResolvedValue(mockResult)
      mockDallE3.validatePrompt = jest.fn().mockReturnValue(true)

      const result = await service.generateDecorativeElement(request)

      expect(result).toEqual(mockResult)
      expect((service as any).promptEngineer.generateDecorativeElementPrompt)
        .toHaveBeenCalledWith(request)
    })
  })

  describe('generateImage', () => {
    it('should validate prompt before generation', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'invalid content nsfw',
        userId: 'test-user'
      }

      mockStableDiffusion.validatePrompt = jest.fn().mockReturnValue(false)

      await expect(service.generateImage(request))
        .rejects.toThrow('Invalid prompt: contains prohibited content')
    })

    it('should use fallback provider on primary failure', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'A beautiful landscape',
        userTier: 'premium',
        userId: 'test-user'
      }

      const fallbackResult = {
        url: 'https://example.com/fallback.png',
        model: 'stable-diffusion-xl' as const,
        prompt: request.prompt,
        size: '1024x1024' as any,
        style: 'realistic' as any,
        cost: 0.0032,
        generatedAt: new Date()
      }

      ;(service as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
      ;(service as any).cache.store = jest.fn()
      ;(service as any).promptEngineer.enhancePromptForModel = jest.fn()
        .mockImplementation((prompt) => prompt)

      // Primary provider (DALL-E) fails
      mockDallE3.validatePrompt = jest.fn().mockReturnValue(true)
      mockDallE3.generate = jest.fn().mockRejectedValue({
        code: 'RATE_LIMIT',
        message: 'Rate limit exceeded',
        model: 'dall-e-3',
        fallbackAvailable: true
      })

      // Fallback provider (SD) succeeds
      mockStableDiffusion.generate = jest.fn().mockResolvedValue(fallbackResult)

      const result = await service.generateImage(request)

      expect(result).toEqual(fallbackResult)
      expect(mockDallE3.generate).toHaveBeenCalled()
      expect(mockStableDiffusion.generate).toHaveBeenCalled()
    })

    it('should track costs per user', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test image',
        userId: 'user-123',
        userTier: 'pro'
      }

      const mockResult = {
        url: 'https://example.com/test.png',
        model: 'dall-e-3' as const,
        prompt: request.prompt,
        size: '1024x1024' as any,
        style: 'realistic' as any,
        cost: 0.040,
        generatedAt: new Date()
      }

      ;(service as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
      ;(service as any).cache.store = jest.fn()
      ;(service as any).promptEngineer.enhancePromptForModel = jest.fn()
        .mockImplementation((prompt) => prompt)

      mockDallE3.validatePrompt = jest.fn().mockReturnValue(true)
      mockDallE3.generate = jest.fn().mockResolvedValue(mockResult)

      // Generate multiple images
      await service.generateImage(request)
      await service.generateImage({ ...request, prompt: 'Another image' })

      const totalCost = await service.getUserCost('user-123')
      expect(totalCost).toBe(0.080) // 2 images at 0.040 each
    })
  })

  describe('provider selection', () => {
    it('should select provider based on user tier', async () => {
      const testCases = [
        { tier: 'free', expectedProvider: 'stable-diffusion' },
        { tier: 'basic', expectedProvider: 'stable-diffusion' },
        { tier: 'pro', expectedProvider: 'dall-e-3' },
        { tier: 'premium', expectedProvider: 'dall-e-3' }
      ]

      for (const { tier, expectedProvider } of testCases) {
        const request: ImageGenerationRequest = {
          prompt: 'Test',
          userTier: tier as any,
          userId: 'test-user'
        }

        ;(service as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
        ;(service as any).cache.store = jest.fn()
        ;(service as any).promptEngineer.enhancePromptForModel = jest.fn()
          .mockImplementation((prompt) => prompt)

        const mockResult = {
          url: 'https://example.com/test.png',
          model: expectedProvider === 'dall-e-3' ? 'dall-e-3' : 'stable-diffusion-xl' as any,
          prompt: request.prompt,
          size: '1024x1024' as any,
          style: 'realistic' as any,
          cost: 0.01,
          generatedAt: new Date()
        }

        if (expectedProvider === 'dall-e-3') {
          mockDallE3.validatePrompt = jest.fn().mockReturnValue(true)
          mockDallE3.generate = jest.fn().mockResolvedValue(mockResult)
        } else {
          mockStableDiffusion.validatePrompt = jest.fn().mockReturnValue(true)
          mockStableDiffusion.generate = jest.fn().mockResolvedValue(mockResult)
        }

        await service.generateImage(request)

        if (expectedProvider === 'dall-e-3') {
          expect(mockDallE3.generate).toHaveBeenCalled()
        } else {
          expect(mockStableDiffusion.generate).toHaveBeenCalled()
        }

        jest.clearAllMocks()
      }
    })

    it('should respect explicit model selection', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test',
        model: 'stable-diffusion-xl',
        userTier: 'premium', // Even premium users get SD if explicitly requested
        userId: 'test-user'
      }

      ;(service as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
      ;(service as any).cache.store = jest.fn()
      ;(service as any).promptEngineer.enhancePromptForModel = jest.fn()
        .mockImplementation((prompt) => prompt)

      mockStableDiffusion.validatePrompt = jest.fn().mockReturnValue(true)
      mockStableDiffusion.generate = jest.fn().mockResolvedValue({
        url: 'https://example.com/sd.png',
        model: 'stable-diffusion-xl',
        prompt: request.prompt,
        size: '1024x1024',
        style: 'realistic',
        cost: 0.0032,
        generatedAt: new Date()
      })

      await service.generateImage(request)

      expect(mockStableDiffusion.generate).toHaveBeenCalled()
      expect(mockDallE3.generate).not.toHaveBeenCalled()
    })
  })

  describe('getAvailableModels', () => {
    it('should return available models with status', async () => {
      mockStableDiffusion.isAvailable = jest.fn().mockResolvedValue(true)
      mockStableDiffusion.estimateCost = jest.fn().mockReturnValue(0.0032)
      
      mockDallE3.isAvailable = jest.fn().mockResolvedValue(false)
      mockDallE3.estimateCost = jest.fn().mockReturnValue(0.040)

      const models = await service.getAvailableModels()

      expect(models).toEqual([
        {
          model: 'stable-diffusion-xl',
          available: true,
          estimatedCost: 0.0032
        },
        {
          model: 'dall-e-3',
          available: false,
          estimatedCost: 0.040
        }
      ])
    })
  })

  describe('suggestPromptImprovements', () => {
    it('should delegate to prompt engineer', () => {
      const mockSuggestions = [
        'Add more descriptive details',
        'Include style descriptors'
      ]

      ;(service as any).promptEngineer.suggestPromptImprovements = jest.fn()
        .mockReturnValue(mockSuggestions)

      const suggestions = service.suggestPromptImprovements('A house')

      expect(suggestions).toEqual(mockSuggestions)
    })
  })

  describe('error handling', () => {
    it('should throw error when no providers available', async () => {
      // Create service without API keys
      delete process.env.REPLICATE_API_KEY
      delete process.env.OPENAI_API_KEY
      
      const serviceNoProviders = new ImageGenerationService()

      await expect(serviceNoProviders.generateImage({
        prompt: 'Test',
        userId: 'test-user'
      })).rejects.toThrow('No image generation providers available')
    })
  })
})