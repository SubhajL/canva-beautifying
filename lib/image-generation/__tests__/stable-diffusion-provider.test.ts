import { StableDiffusionProvider } from '../providers/stable-diffusion-provider'
import { ImageGenerationRequest } from '../types'
import Replicate from 'replicate'

// Mock Replicate
jest.mock('replicate')

// Mock fetch
global.fetch = jest.fn()

describe('StableDiffusionProvider', () => {
  let provider: StableDiffusionProvider
  let mockReplicate: jest.Mocked<Replicate>

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new StableDiffusionProvider('test-api-key', 'fallback-key')
    mockReplicate = (provider as any).replicate as jest.Mocked<Replicate>
  })

  describe('generate', () => {
    it('should generate an image successfully', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'A futuristic city',
        size: '1024x1024',
        quality: 'standard',
        style: 'digital-art',
        userId: 'test-user'
      }

      const mockImageUrl = 'https://replicate.com/output.png'
      mockReplicate.run = jest.fn().mockResolvedValue([mockImageUrl])

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      })

      const result = await provider.generate(request)

      expect(result).toMatchObject({
        url: mockImageUrl,
        model: 'stable-diffusion-xl',
        prompt: request.prompt,
        size: '1024x1024',
        style: 'digital-art'
      })

      expect(result.cost).toBe(0.0032) // Base cost for 1024x1024
      expect(result.generatedAt).toBeInstanceOf(Date)

      // Check that proper input was sent to Replicate
      expect(mockReplicate.run).toHaveBeenCalledWith(
        expect.stringContaining('stability-ai/sdxl'),
        expect.objectContaining({
          input: expect.objectContaining({
            prompt: expect.stringContaining('futuristic city'),
            negative_prompt: expect.stringContaining('ugly, blurry'),
            width: 1024,
            height: 1024,
            num_inference_steps: 30,
            guidance_scale: 10 // for digital-art style
          })
        })
      )
    })

    it('should use HD settings for HD quality', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'HD artwork',
        quality: 'hd',
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn().mockResolvedValue(['https://example.com/hd.png'])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

      await provider.generate(request)

      expect(mockReplicate.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            num_inference_steps: 50, // Higher for HD
            refine: 'expert_ensemble_refiner'
          })
        })
      )
    })

    it('should apply style-specific settings', async () => {
      const styleTests = [
        { style: 'photographic', expectedGuidance: 7.5, negativeIncludes: 'cartoon' },
        { style: 'cartoon', expectedGuidance: 12, negativeIncludes: 'realistic' },
        { style: 'watercolor', expectedGuidance: 8, negativeIncludes: 'digital art' },
        { style: 'educational', expectedGuidance: 8, negativeIncludes: 'dark' }
      ]

      for (const test of styleTests) {
        const request: ImageGenerationRequest = {
          prompt: 'Test prompt',
          style: test.style as any,
          userId: 'test-user'
        }

        mockReplicate.run = jest.fn().mockResolvedValue(['https://example.com/test.png'])
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

        await provider.generate(request)

        expect(mockReplicate.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            input: expect.objectContaining({
              guidance_scale: test.expectedGuidance,
              negative_prompt: expect.stringContaining(test.negativeIncludes)
            })
          })
        )
      }
    })

    it('should calculate size-based costs correctly', () => {
      const testCases = [
        { size: '256x256', expected: 0.0008 },
        { size: '512x512', expected: 0.0016 },
        { size: '1024x1024', expected: 0.0032 },
        { size: '1792x1024', expected: 0.0048 },
        { size: '1024x1792', expected: 0.0048 }
      ]

      for (const { size, expected } of testCases) {
        const cost = provider.estimateCost({
          prompt: 'Test',
          size: size as any
        })
        expect(cost).toBeCloseTo(expected, 4)
      }
    })

    it('should retry on transient errors', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test retry',
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn()
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValueOnce(['https://example.com/retry.png'])

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

      const result = await provider.generate(request)

      expect(mockReplicate.run).toHaveBeenCalledTimes(2)
      expect(result.url).toBe('https://example.com/retry.png')
      expect(result.metadata?.retries).toBe(1)
    })

    it('should handle timeout errors with retry', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test timeout',
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(['https://example.com/timeout.png'])

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

      const result = await provider.generate(request)

      expect(mockReplicate.run).toHaveBeenCalledTimes(2)
      expect(result.url).toBe('https://example.com/timeout.png')
    })

    it('should handle NSFW content errors', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test nsfw',
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn().mockRejectedValue(new Error('NSFW content detected'))

      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'INVALID_PROMPT',
        message: 'Content policy violation detected',
        model: 'stable-diffusion-xl'
      })
    })

    it('should handle insufficient credits', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test credits',
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn().mockRejectedValue(new Error('payment required'))

      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'INSUFFICIENT_CREDITS',
        model: 'stable-diffusion-xl'
      })
    })

    it('should validate generated image URLs', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test validation',
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn().mockResolvedValue(['https://example.com/invalid.png'])

      // Clear any previous fetch mocks and set up the failing response
      ;(global.fetch as jest.Mock).mockReset()
      ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 404
        })
      )

      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Generated image URL is not accessible',
        model: 'stable-diffusion-xl'
      })
    })

    it('should handle empty output', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test empty',
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn().mockResolvedValue([])

      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'No image generated',
        model: 'stable-diffusion-xl'
      })
    })

    it('should use seed when provided', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test seed',
        seed: 12345,
        userId: 'test-user'
      }

      mockReplicate.run = jest.fn().mockResolvedValue(['https://example.com/seed.png'])
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

      await provider.generate(request)

      expect(mockReplicate.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: expect.objectContaining({
            seed: 12345
          })
        })
      )
    })
  })

  describe('isAvailable', () => {
    it('should check API availability', async () => {
      mockReplicate.models = {
        get: jest.fn().mockResolvedValue({ id: 'sdxl' })
      } as any

      const available = await provider.isAvailable()
      expect(available).toBe(true)
    })

    it('should fallback to secondary key', async () => {
      // Mock Replicate constructor to return a new mock instance when called with fallback key
      const mockReplicateConstructor = jest.mocked(Replicate)
      const secondMockReplicate = {
        models: {
          get: jest.fn().mockResolvedValue({ id: 'sdxl' })
        }
      }
      
      mockReplicateConstructor.mockImplementationOnce(() => secondMockReplicate as any)
      
      mockReplicate.models = {
        get: jest.fn().mockRejectedValue(new Error('Invalid key'))
      } as any

      const available = await provider.isAvailable()
      expect(available).toBe(true)
      expect(mockReplicate.models.get).toHaveBeenCalledTimes(1)
      expect(secondMockReplicate.models.get).toHaveBeenCalledTimes(1)
    })

    it('should return false when no keys work', async () => {
      const provider = new StableDiffusionProvider('invalid-key')
      mockReplicate = (provider as any).replicate as jest.Mocked<Replicate>
      
      mockReplicate.models = {
        get: jest.fn().mockRejectedValue(new Error('Invalid key'))
      } as any

      const available = await provider.isAvailable()
      expect(available).toBe(false)
    })
  })

  describe('prompt enhancement', () => {
    it('should add style modifiers to prompts', async () => {
      const styleTests = [
        { style: 'realistic', expected: 'photorealistic, high detail' },
        { style: 'artistic', expected: 'artistic, painted' },
        { style: 'cartoon', expected: 'cartoon style, animated' },
        { style: 'minimalist', expected: 'minimalist, simple' }
      ]

      for (const test of styleTests) {
        const request: ImageGenerationRequest = {
          prompt: 'A house',
          style: test.style as any,
          userId: 'test-user'
        }

        mockReplicate.run = jest.fn().mockResolvedValue(['https://example.com/style.png'])
        ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

        await provider.generate(request)

        expect(mockReplicate.run).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            input: expect.objectContaining({
              prompt: expect.stringContaining(test.expected)
            })
          })
        )
      }
    })
  })
})