import { DallE3Provider } from '../providers/dalle-provider'
import { ImageGenerationRequest } from '../types'
import OpenAI from 'openai'

// Mock OpenAI
jest.mock('openai')

// Mock fetch
global.fetch = jest.fn()

describe('DallE3Provider', () => {
  let provider: DallE3Provider
  let mockOpenAI: jest.Mocked<OpenAI>

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new DallE3Provider('test-api-key', 'fallback-key')
    mockOpenAI = (provider as any).openai as jest.Mocked<OpenAI>
  })

  describe('generate', () => {
    it('should generate an image successfully', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'A beautiful sunset',
        size: '1024x1024',
        quality: 'standard',
        style: 'realistic',
        userId: 'test-user'
      }

      const mockResponse = {
        data: [{
          url: 'https://example.com/image.png',
          revised_prompt: 'A beautiful sunset with enhanced details'
        }]
      }

      mockOpenAI.images = {
        generate: jest.fn().mockResolvedValue(mockResponse)
      } as any

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      })

      const result = await provider.generate(request)

      expect(result).toMatchObject({
        url: 'https://example.com/image.png',
        model: 'dall-e-3',
        prompt: request.prompt,
        revisedPrompt: 'A beautiful sunset with enhanced details',
        size: '1024x1024',
        style: 'realistic'
      })

      expect(result.cost).toBe(0.040) // Standard 1024x1024 pricing
      expect(result.generatedAt).toBeInstanceOf(Date)
    })

    it('should handle HD quality pricing correctly', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'A test image',
        size: '1792x1024',
        quality: 'hd',
        userId: 'test-user'
      }

      mockOpenAI.images = {
        generate: jest.fn().mockResolvedValue({
          data: [{ url: 'https://example.com/hd.png' }]
        })
      } as any

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      })

      const result = await provider.generate(request)
      expect(result.cost).toBe(0.120) // HD 1792x1024 pricing
    })

    it('should map sizes correctly for DALL-E 3', async () => {
      const testCases = [
        { input: '256x256', expected: '1024x1024' },
        { input: '512x512', expected: '1024x1024' },
        { input: '1024x1024', expected: '1024x1024' },
        { input: '1024x1792', expected: '1024x1792' },
        { input: '1792x1024', expected: '1792x1024' }
      ]

      for (const { input, expected } of testCases) {
        const request: ImageGenerationRequest = {
          prompt: 'Test',
          size: input as any,
          userId: 'test-user'
        }

        mockOpenAI.images = {
          generate: jest.fn().mockResolvedValue({
            data: [{ url: 'https://example.com/test.png' }]
          })
        } as any

        ;(global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true
        })

        await provider.generate(request)

        expect(mockOpenAI.images.generate).toHaveBeenCalledWith(
          expect.objectContaining({
            size: expected
          })
        )
      }
    })

    it('should retry on transient errors', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test retry',
        userId: 'test-user'
      }

      // First attempt fails with network error
      mockOpenAI.images = {
        generate: jest.fn()
          .mockRejectedValueOnce(new Error('socket hang up'))
          .mockResolvedValueOnce({
            data: [{ url: 'https://example.com/retry.png' }]
          })
      } as any

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      })

      const result = await provider.generate(request)

      expect(mockOpenAI.images.generate).toHaveBeenCalledTimes(2)
      expect(result.url).toBe('https://example.com/retry.png')
      expect(result.metadata?.retries).toBe(1)
    })

    it('should handle rate limit errors', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test rate limit',
        userId: 'test-user'
      }

      mockOpenAI.images = {
        generate: jest.fn().mockRejectedValue(new Error('rate limit exceeded'))
      } as any

      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'RATE_LIMIT',
        model: 'dall-e-3',
        fallbackAvailable: false
      })
    }, 10000)

    it('should handle content policy violations', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test content policy',
        userId: 'test-user'
      }

      mockOpenAI.images = {
        generate: jest.fn().mockRejectedValue(new Error('content policy violation'))
      } as any

      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'INVALID_PROMPT',
        model: 'dall-e-3'
      })
    })

    it('should validate URLs before returning', async () => {
      const request: ImageGenerationRequest = {
        prompt: 'Test URL validation',
        userId: 'test-user'
      }

      mockOpenAI.images = {
        generate: jest.fn().mockResolvedValue({
          data: [{ url: 'https://example.com/invalid.png' }]
        })
      } as any

      // URL validation fails
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      })

      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'API_ERROR',
        message: 'Generated image URL is not accessible'
      })
    })

    it.skip('should timeout after 60 seconds', async () => {
      jest.setTimeout(70000)
      
      const request: ImageGenerationRequest = {
        prompt: 'Test timeout',
        userId: 'test-user'
      }

      // Create a real delay promise that takes longer than our timeout
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
      
      mockOpenAI.images = {
        generate: jest.fn().mockImplementation(async () => {
          await delay(65000) // Wait longer than the 60s timeout
          return { data: [{ url: 'too-late' }] }
        })
      } as any

      const startTime = Date.now()
      
      await expect(provider.generate(request)).rejects.toMatchObject({
        code: 'TIMEOUT',
        message: 'Request timeout'
      })
      
      const elapsed = Date.now() - startTime
      expect(elapsed).toBeGreaterThanOrEqual(59000)
      expect(elapsed).toBeLessThanOrEqual(61000)
    })
  })

  describe('validatePrompt', () => {
    it('should reject prompts with banned words', () => {
      const bannedPrompts = [
        'Create a nude image',
        'Violence and gore',
        'Celebrity portrait',
        'Trademark logo',
        'Political figure'
      ]

      for (const prompt of bannedPrompts) {
        expect(provider.validatePrompt(prompt)).toBe(false)
      }
    })

    it('should accept valid prompts', () => {
      const validPrompts = [
        'A beautiful landscape',
        'Abstract geometric patterns',
        'Educational diagram',
        'Professional background'
      ]

      for (const prompt of validPrompts) {
        expect(provider.validatePrompt(prompt)).toBe(true)
      }
    })

    it('should reject empty or too long prompts', () => {
      expect(provider.validatePrompt('')).toBe(false)
      expect(provider.validatePrompt('   ')).toBe(false)
      expect(provider.validatePrompt('a'.repeat(5000))).toBe(false)
    })
  })

  describe('isAvailable', () => {
    it('should check API availability', async () => {
      mockOpenAI.models = {
        list: jest.fn().mockResolvedValue({ data: [] })
      } as any

      const available = await provider.isAvailable()
      expect(available).toBe(true)
    })

    it('should fallback to secondary key on failure', async () => {
      // Mock OpenAI constructor to return different instances
      const OpenAIMock = require('openai')
      let callCount = 0
      
      OpenAIMock.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First instance (primary key) - will fail
          return {
            models: {
              list: jest.fn().mockRejectedValue(new Error('Invalid API key'))
            }
          }
        } else {
          // Second instance (fallback key) - will succeed
          return {
            models: {
              list: jest.fn().mockResolvedValue({ data: [] })
            }
          }
        }
      })
      
      // Create provider with fallback key
      const testProvider = new DallE3Provider('bad-key', 'good-fallback-key')
      
      const available = await testProvider.isAvailable()
      expect(available).toBe(true)
      expect(OpenAIMock).toHaveBeenCalledTimes(3) // Once in constructor, twice for isAvailable (primary + fallback)
    })

    it('should return false when no keys work', async () => {
      // Reset the OpenAI mock
      const OpenAIMock = require('openai')
      OpenAIMock.mockImplementation(() => ({
        models: {
          list: jest.fn().mockRejectedValue(new Error('Invalid API key'))
        }
      }))
      
      const provider = new DallE3Provider('invalid-key')
      const available = await provider.isAvailable()
      expect(available).toBe(false)
    })
  })

  describe('estimateCost', () => {
    it('should calculate costs correctly', () => {
      const testCases = [
        { size: '1024x1024', quality: 'standard', expected: 0.040 },
        { size: '1024x1024', quality: 'hd', expected: 0.080 },
        { size: '1792x1024', quality: 'standard', expected: 0.080 },
        { size: '1792x1024', quality: 'hd', expected: 0.120 },
        { size: '1024x1792', quality: 'standard', expected: 0.080 },
        { size: '1024x1792', quality: 'hd', expected: 0.120 }
      ]

      for (const { size, quality, expected } of testCases) {
        const cost = provider.estimateCost({
          prompt: 'Test',
          size: size as any,
          quality: quality as any
        })
        expect(cost).toBe(expected)
      }
    })
  })
})