import { AssetCache } from '../asset-cache'
import { GeneratedImage } from '../types'
import { createClient } from '@/lib/supabase/server'

// Mock Supabase
jest.mock('@/lib/supabase/server')

describe('AssetCache', () => {
  let cache: AssetCache
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock Supabase client with proper chaining
    const selectResult = {
      textSearch: jest.fn(),
      eq: jest.fn(),
      order: jest.fn(),
      limit: jest.fn()
    }
    
    // Make each method return the selectResult object for chaining
    selectResult.textSearch.mockReturnValue(selectResult)
    selectResult.eq.mockReturnValue(selectResult)
    selectResult.order.mockReturnValue(selectResult)
    selectResult.limit.mockReturnValue(selectResult)
    
    const updateResult = {
      eq: jest.fn()
    }
    updateResult.eq.mockReturnValue(updateResult)
    
    const deleteResult = {
      lt: jest.fn()
    }
    deleteResult.lt.mockReturnValue(deleteResult)
    
    const fromResult = {
      select: jest.fn().mockReturnValue(selectResult),
      update: jest.fn().mockReturnValue(updateResult),
      insert: jest.fn().mockReturnValue({ error: null }),
      delete: jest.fn().mockReturnValue(deleteResult)
    }
    
    mockSupabase = {
      from: jest.fn().mockReturnValue(fromResult)
    }
    
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    
    cache = new AssetCache()
  })

  describe('findSimilar', () => {
    it('should find cached asset in memory', async () => {
      const cachedImage: GeneratedImage = {
        url: 'https://example.com/cached.png',
        model: 'stable-diffusion-xl',
        prompt: 'A beautiful sunset over mountains',
        size: '1024x1024',
        style: 'realistic',
        cost: 0,
        generatedAt: new Date()
      }

      // First store the image
      await cache.store(cachedImage)

      // Then find it
      const result = await cache.findSimilar('A beautiful sunset over mountains', 'realistic')

      expect(result).toBeTruthy()
      expect(result?.url).toBe(cachedImage.url)
      expect(result?.cached).toBe(true)
      expect(result?.cost).toBe(0) // Cached assets have no cost
    })

    it('should find cached asset in database', async () => {
      const dbAsset = {
        id: 'db-asset-1',
        url: 'https://example.com/db-cached.png',
        prompt: 'Abstract geometric pattern',
        model: 'dall-e-3',
        style: 'abstract',
        tags: ['geometric', 'abstract', 'pattern'],
        usage_count: 5,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }

      const fromMock = mockSupabase.from()
      fromMock.select().limit.mockResolvedValue({ data: [dbAsset] })
      fromMock.update().eq.mockResolvedValue({ error: null })

      const result = await cache.findSimilar('Abstract geometric', 'abstract')

      expect(result).toBeTruthy()
      expect(result?.url).toBe(dbAsset.url)
      expect(result?.cached).toBe(true)
      
      // Check that usage count was incremented
      expect(fromMock.update).toHaveBeenCalledWith({ 
        usage_count: dbAsset.usage_count + 1 
      })
    })

    it('should handle fuzzy matching in memory cache', async () => {
      const cachedImage: GeneratedImage = {
        url: 'https://example.com/fuzzy.png',
        model: 'stable-diffusion-xl',
        prompt: 'Modern minimalist background with blue gradient',
        size: '1024x1024',
        style: 'minimalist',
        cost: 0,
        generatedAt: new Date()
      }

      await cache.store(cachedImage)

      // Similar but not exact prompt
      const result = await cache.findSimilar('Minimalist modern blue background gradient', 'minimalist')

      expect(result).toBeTruthy()
      expect(result?.url).toBe(cachedImage.url)
    })

    it('should not return expired cached assets', async () => {
      // Mock an expired asset in database
      const _expiredAsset = {
        id: 'expired-1',
        url: 'https://example.com/expired.png',
        prompt: 'Expired image',
        model: 'dall-e-3',
        style: 'realistic',
        tags: [],
        usage_count: 1,
        created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Expired
      }

      mockSupabase.from().select().limit.mockResolvedValue({ data: [] }) // Return empty as expired

      const result = await cache.findSimilar('Expired image', 'realistic')

      expect(result).toBeNull()
    })

    it('should return null when no similar cache found', async () => {
      mockSupabase.from().select().limit.mockResolvedValue({ data: [] })

      const result = await cache.findSimilar('Completely unique prompt', 'artistic')

      expect(result).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      const selectResult = mockSupabase.from().select()
      selectResult.textSearch.mockImplementation(() => {
        throw new Error('Database error')
      })

      const result = await cache.findSimilar('Test prompt', 'realistic')

      expect(result).toBeNull() // Should return null on error
    })
  })

  describe('store', () => {
    it('should store image in both memory and database', async () => {
      const image: GeneratedImage = {
        url: 'https://example.com/new.png',
        model: 'dall-e-3',
        prompt: 'A colorful abstract pattern',
        size: '1024x1024',
        style: 'abstract',
        cost: 0.040,
        generatedAt: new Date()
      }

      mockSupabase.from().insert.mockResolvedValue({ error: null })

      await cache.store(image)

      // Check database insert
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(expect.objectContaining({
        url: image.url,
        prompt: image.prompt,
        model: image.model,
        style: image.style,
        usage_count: 1,
        tags: expect.arrayContaining(['abstract', 'pattern'])
      }))

      // Check memory cache
      const cached = await cache.findSimilar(image.prompt, image.style)
      expect(cached).toBeTruthy()
    })

    it('should extract tags from prompts', async () => {
      const testCases = [
        {
          prompt: 'Modern geometric background with red and blue colors',
          expectedTags: ['modern', 'geometric', 'background', 'red', 'blue']
        },
        {
          prompt: 'Minimalist black and white pattern',
          expectedTags: ['minimalist', 'pattern', 'black', 'white']
        },
        {
          prompt: 'Abstract watercolor illustration in pink',
          expectedTags: ['abstract', 'illustration', 'pink']
        }
      ]

      for (const test of testCases) {
        const image: GeneratedImage = {
          url: 'https://example.com/test.png',
          model: 'stable-diffusion-xl',
          prompt: test.prompt,
          size: '1024x1024',
          style: 'artistic',
          cost: 0.0032,
          generatedAt: new Date()
        }

        await cache.store(image)

        expect(mockSupabase.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: expect.arrayContaining(test.expectedTags)
          })
        )
      }
    })

    it('should handle storage errors gracefully', async () => {
      const image: GeneratedImage = {
        url: 'https://example.com/error.png',
        model: 'dall-e-3',
        prompt: 'Test image',
        size: '1024x1024',
        style: 'realistic',
        cost: 0.040,
        generatedAt: new Date()
      }

      mockSupabase.from().insert.mockRejectedValue(new Error('Storage error'))

      // Should not throw
      await expect(cache.store(image)).resolves.not.toThrow()

      // Should still be in memory cache
      const cached = await cache.findSimilar(image.prompt, image.style)
      expect(cached).toBeTruthy()
    })
  })

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      // Add some items to memory cache
      const images: GeneratedImage[] = [
        {
          url: 'https://example.com/1.png',
          model: 'stable-diffusion-xl',
          prompt: 'Modern abstract background',
          size: '1024x1024',
          style: 'abstract',
          cost: 0.0032,
          generatedAt: new Date()
        },
        {
          url: 'https://example.com/2.png',
          model: 'dall-e-3',
          prompt: 'Minimalist geometric pattern',
          size: '1024x1024',
          style: 'minimalist',
          cost: 0.040,
          generatedAt: new Date()
        }
      ]

      for (const img of images) {
        await cache.store(img)
      }

      // Mock database count
      mockSupabase.from().select.mockResolvedValue({ count: 100 })

      const stats = await cache.getCacheStats()

      expect(stats.totalCached).toBe(100)
      expect(stats.memoryCount).toBeGreaterThan(0)
      expect(stats.popularTags).toContain('modern')
      expect(stats.popularTags).toContain('abstract')
      expect(stats.popularTags).toContain('minimalist')
      expect(stats.popularTags).toContain('geometric')
    })
  })

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      // Store an image
      const image: GeneratedImage = {
        url: 'https://example.com/cleanup.png',
        model: 'stable-diffusion-xl',
        prompt: 'Test cleanup',
        size: '1024x1024',
        style: 'realistic',
        cost: 0.0032,
        generatedAt: new Date()
      }

      await cache.store(image)

      // Mock random to ensure cleanup runs
      jest.spyOn(Math, 'random').mockReturnValue(0.05)

      // Store another image to trigger cleanup
      await cache.store({ ...image, url: 'https://example.com/cleanup2.png' })

      // Check that database cleanup was called
      expect(mockSupabase.from().delete).toHaveBeenCalled()
      expect(mockSupabase.from().delete().lt).toHaveBeenCalledWith('expires_at', expect.any(String))

      jest.restoreAllMocks()
    })
  })

  describe('similarity matching', () => {
    it('should correctly identify similar prompts', async () => {
      const baseImage: GeneratedImage = {
        url: 'https://example.com/base.png',
        model: 'stable-diffusion-xl',
        prompt: 'Beautiful sunset over ocean waves',
        size: '1024x1024',
        style: 'realistic',
        cost: 0.0032,
        generatedAt: new Date()
      }

      await cache.store(baseImage)

      // Test various similar prompts
      const similarPrompts = [
        'Beautiful ocean sunset with waves',
        'Sunset over beautiful ocean waves',
        'Ocean waves with beautiful sunset'
      ]

      for (const prompt of similarPrompts) {
        const result = await cache.findSimilar(prompt, 'realistic')
        expect(result).toBeTruthy()
        expect(result?.url).toBe(baseImage.url)
      }

      // Test dissimilar prompt
      const dissimilarResult = await cache.findSimilar('Mountain landscape', 'realistic')
      expect(dissimilarResult).toBeNull()
    })
  })
})