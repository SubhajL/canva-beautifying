import { ImageGenerationService } from '../image-generation-service'
import { AssetGenerationStage } from '../../enhancement/pipeline/stages/asset-generation'
import { PipelineContext, EnhancementPlan } from '../../enhancement/pipeline/types'
import { uploadFile } from '@/lib/r2'

// Mock dependencies
jest.mock('@/lib/r2')
jest.mock('openai')
jest.mock('replicate')
jest.mock('@/lib/supabase/server')

// Mock fetch globally
global.fetch = jest.fn()

describe('Image Generation Integration Tests', () => {
  let imageService: ImageGenerationService
  let assetStage: AssetGenerationStage

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key'
    process.env.REPLICATE_API_KEY = 'test-replicate-key'
    
    // Mock R2 upload
    ;(uploadFile as jest.Mock).mockResolvedValue({
      url: 'https://r2.example.com/uploaded-file.png',
      key: 'test-key',
      size: 1000
    })
    
    // Mock fetch for image validation
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1000))
    })
    
    imageService = new ImageGenerationService()
    assetStage = new AssetGenerationStage()
  })

  describe('End-to-end asset generation', () => {
    it('should generate complete asset set for enhancement', async () => {
      const context: PipelineContext = {
        userId: 'user-123',
        documentId: 'doc-456',
        subscriptionTier: 'pro',
        enhancementType: 'full',
        uploadedFiles: [],
        outputPath: '/tmp/output'
      }

      const plan: EnhancementPlan = {
        assetRequirements: {
          backgrounds: [
            {
              style: 'gradient',
              theme: 'professional',
              colors: ['#0066cc', '#004499'],
              opacity: 0.9
            }
          ],
          decorativeElements: [
            {
              type: 'icon',
              placement: 'corners',
              quantity: 4,
              style: 'minimalist'
            }
          ],
          educationalGraphics: [
            {
              type: 'chart',
              data: { labels: ['A', 'B', 'C'], values: [10, 20, 30] },
              style: 'modern',
              dimensions: { width: 400, height: 300 }
            }
          ]
        },
        colorEnhancements: {
          primaryColor: '#0066cc',
          secondaryColor: '#004499',
          accentColor: '#ff6600',
          backgroundColor: '#ffffff'
        },
        layoutChanges: [],
        typographyUpdates: []
      }

      // Mock the image generation service in the asset stage
      const mockGenerate = jest.fn().mockResolvedValue({
        url: 'https://example.com/generated.png',
        model: 'stable-diffusion-xl',
        prompt: 'Test prompt',
        size: '1024x1024',
        style: 'educational',
        cost: 0.0032,
        generatedAt: new Date()
      })
      
      ;(assetStage as any).imageService.generateImage = mockGenerate
      ;(assetStage as any).imageService.generateBackground = mockGenerate

      const result = await assetStage.execute(context, plan)

      expect(result).toBeDefined()
      expect(result.backgrounds).toHaveLength(1)
      expect(result.decorativeElements).toHaveLength(4) // 4 corner icons
      expect(result.educationalGraphics).toHaveLength(1)
      expect(result.totalAssets).toBe(6)
      
      // Verify uploads
      expect(uploadFile).toHaveBeenCalledTimes(6)
    })

    it('should handle tier-based restrictions', async () => {
      const contexts = [
        { tier: 'free', expectGraphics: false },
        { tier: 'basic', expectGraphics: false },
        { tier: 'pro', expectGraphics: true },
        { tier: 'premium', expectGraphics: true }
      ]

      for (const { tier, expectGraphics } of contexts) {
        jest.clearAllMocks()

        const context: PipelineContext = {
          userId: 'user-123',
          documentId: 'doc-456',
          subscriptionTier: tier as any,
          enhancementType: 'full',
          uploadedFiles: [],
          outputPath: '/tmp/output'
        }

        const plan: EnhancementPlan = {
          assetRequirements: {
            backgrounds: [],
            decorativeElements: [],
            educationalGraphics: [
              {
                type: 'illustration',
                style: 'educational',
                dimensions: { width: 500, height: 500 }
              }
            ]
          },
          colorEnhancements: {
            primaryColor: '#000000',
            secondaryColor: '#ffffff',
            accentColor: '#ff0000',
            backgroundColor: '#f0f0f0'
          },
          layoutChanges: [],
          typographyUpdates: []
        }

        const result = await assetStage.execute(context, plan)

        if (expectGraphics) {
          expect(result.educationalGraphics).toHaveLength(1)
        } else {
          expect(result.educationalGraphics).toHaveLength(0)
        }
      }
    })

    it('should handle provider failures gracefully', async () => {
      const context: PipelineContext = {
        userId: 'user-123',
        documentId: 'doc-456',
        subscriptionTier: 'premium',
        enhancementType: 'full',
        uploadedFiles: [],
        outputPath: '/tmp/output'
      }

      const plan: EnhancementPlan = {
        assetRequirements: {
          backgrounds: [
            { style: 'image', theme: 'nature', colors: ['#00ff00'], opacity: 1 }
          ],
          decorativeElements: [],
          educationalGraphics: []
        },
        colorEnhancements: {
          primaryColor: '#00ff00',
          secondaryColor: '#008800',
          accentColor: '#ffff00',
          backgroundColor: '#ffffff'
        },
        layoutChanges: [],
        typographyUpdates: []
      }

      // Mock generation failure
      ;(assetStage as any).imageService.generateBackground = jest.fn()
        .mockRejectedValue(new Error('API error'))

      const result = await assetStage.execute(context, plan)

      // Should continue with other assets even if one fails
      expect(result.backgrounds).toHaveLength(0)
      expect(result.totalAssets).toBe(0)
    })
  })

  describe('Background generation with analysis', () => {
    it('should use enhanced generation when analysis is available', async () => {
      const context: PipelineContext = {
        userId: 'user-123',
        documentId: 'doc-456',
        subscriptionTier: 'pro',
        enhancementType: 'full',
        uploadedFiles: [],
        outputPath: '/tmp/output'
      }

      const analysisResult = {
        documentType: 'educational',
        layoutAnalysis: {
          structure: 'single-column',
          elements: []
        },
        extractedText: {
          title: 'Math Equations',
          headings: ['Introduction', 'Practice'],
          bodyText: ['Learn how to solve equations', 'Practice problems']
        },
        contentAnalysis: {
          keywords: ['math', 'equation', 'calculate'],
          readabilityScore: 45
        },
        visualHierarchy: {
          complexityScore: 0.4
        }
      }

      const plan: EnhancementPlan = {
        assetRequirements: {
          backgrounds: [
            { style: 'pattern', theme: 'educational', colors: ['#0066cc'], opacity: 0.8 }
          ],
          decorativeElements: [],
          educationalGraphics: []
        },
        colorEnhancements: {
          primaryColor: '#0066cc',
          secondaryColor: '#0099ff',
          accentColor: '#ff6600',
          backgroundColor: '#ffffff'
        },
        layoutChanges: [],
        typographyUpdates: []
      }

      const result = await assetStage.execute(context, plan, undefined, analysisResult as any)

      expect(result.backgrounds).toHaveLength(2) // One from plan, one age-appropriate
      expect(result.backgrounds[0].metadata).toBeDefined()
      expect(result.backgrounds[1].metadata).toBeDefined()
      expect(result.backgrounds[1].metadata.ageGroup).toBeDefined() // Age-appropriate background
    })
  })

  describe('Model selection and fallback', () => {
    it('should use appropriate models based on user tier', async () => {
      const testCases = [
        { tier: 'free', expectedModel: 'stable-diffusion-xl' },
        { tier: 'basic', expectedModel: 'stable-diffusion-xl' },
        { tier: 'pro', expectedModel: 'dall-e-3' },
        { tier: 'premium', expectedModel: 'dall-e-3' }
      ]

      for (const { tier, expectedModel } of testCases) {
        const request = {
          prompt: 'Test image',
          userTier: tier as any,
          userId: 'test-user'
        }

        // Mock the providers
        const mockSDGenerate = jest.fn().mockResolvedValue({
          url: 'https://sd.example.com/image.png',
          model: 'stable-diffusion-xl',
          prompt: request.prompt,
          size: '1024x1024',
          style: 'realistic',
          cost: 0.0032,
          generatedAt: new Date()
        })

        const mockDalleGenerate = jest.fn().mockResolvedValue({
          url: 'https://dalle.example.com/image.png',
          model: 'dall-e-3',
          prompt: request.prompt,
          size: '1024x1024',
          style: 'realistic',
          cost: 0.040,
          generatedAt: new Date()
        })

        ;(imageService as any).stableDiffusion = {
          generate: mockSDGenerate,
          validatePrompt: jest.fn().mockReturnValue(true),
          isAvailable: jest.fn().mockResolvedValue(true),
          estimateCost: jest.fn().mockReturnValue(0.0032)
        }

        ;(imageService as any).dalle3 = {
          generate: mockDalleGenerate,
          validatePrompt: jest.fn().mockReturnValue(true),
          isAvailable: jest.fn().mockResolvedValue(true),
          estimateCost: jest.fn().mockReturnValue(0.040)
        }

        // Mock cache and prompt engineer
        ;(imageService as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
        ;(imageService as any).cache.store = jest.fn()
        ;(imageService as any).promptEngineer.enhancePromptForModel = jest.fn()
          .mockImplementation((prompt) => prompt)

        await imageService.generateImage(request)

        if (expectedModel === 'stable-diffusion-xl') {
          expect(mockSDGenerate).toHaveBeenCalled()
          expect(mockDalleGenerate).not.toHaveBeenCalled()
        } else {
          expect(mockDalleGenerate).toHaveBeenCalled()
          expect(mockSDGenerate).not.toHaveBeenCalled()
        }

        jest.clearAllMocks()
      }
    })
  })

  describe('Cost tracking', () => {
    it('should track costs across multiple generations', async () => {
      const userId = 'cost-test-user'
      
      // Mock providers
      ;(imageService as any).dalle3 = {
        generate: jest.fn().mockResolvedValue({
          url: 'https://example.com/image.png',
          model: 'dall-e-3',
          prompt: 'Test',
          size: '1024x1024',
          style: 'realistic',
          cost: 0.040,
          generatedAt: new Date()
        }),
        validatePrompt: jest.fn().mockReturnValue(true)
      }

      ;(imageService as any).stableDiffusion = {
        generate: jest.fn().mockResolvedValue({
          url: 'https://example.com/sd.png',
          model: 'stable-diffusion-xl',
          prompt: 'Test',
          size: '1024x1024',
          style: 'realistic',
          cost: 0.0032,
          generatedAt: new Date()
        }),
        validatePrompt: jest.fn().mockReturnValue(true)
      }

      // Mock cache and prompt engineer
      ;(imageService as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
      ;(imageService as any).cache.store = jest.fn()
      ;(imageService as any).promptEngineer.enhancePromptForModel = jest.fn()
        .mockImplementation((prompt) => prompt)

      // Generate with DALL-E (premium user)
      await imageService.generateImage({
        prompt: 'Premium image',
        userTier: 'premium',
        userId
      })

      // Generate with SD (basic user)
      await imageService.generateImage({
        prompt: 'Basic image',
        userTier: 'basic',
        userId
      })

      // Check total cost
      const totalCost = await imageService.getUserCost(userId)
      expect(totalCost).toBeCloseTo(0.0432) // 0.040 + 0.0032
    })
  })

  describe('Caching behavior', () => {
    it('should use cache for repeated similar requests', async () => {
      const mockGenerate = jest.fn().mockResolvedValue({
        url: 'https://example.com/generated.png',
        model: 'stable-diffusion-xl',
        prompt: 'Cached test image',
        size: '1024x1024',
        style: 'realistic',
        cost: 0.0032,
        generatedAt: new Date()
      })

      ;(imageService as any).stableDiffusion = {
        generate: mockGenerate,
        validatePrompt: jest.fn().mockReturnValue(true)
      }

      ;(imageService as any).promptEngineer.enhancePromptForModel = jest.fn()
        .mockImplementation((prompt) => prompt)

      // First request - should generate
      ;(imageService as any).cache.findSimilar = jest.fn().mockResolvedValue(null)
      ;(imageService as any).cache.store = jest.fn()

      const result1 = await imageService.generateImage({
        prompt: 'Cached test image',
        userId: 'cache-user'
      })

      expect(mockGenerate).toHaveBeenCalledTimes(1)
      expect(result1.cached).toBeUndefined()

      // Second request - should use cache
      ;(imageService as any).cache.findSimilar = jest.fn().mockResolvedValue({
        ...result1,
        cached: true,
        cost: 0
      })

      const result2 = await imageService.generateImage({
        prompt: 'Cached test image',
        userId: 'cache-user'
      })

      expect(mockGenerate).toHaveBeenCalledTimes(1) // Still 1, not called again
      expect(result2.cached).toBe(true)
      expect(result2.cost).toBe(0)
    })
  })
})