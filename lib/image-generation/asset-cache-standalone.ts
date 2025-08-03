import { CachedAsset, GeneratedImage, ImageStyle } from './types'

/**
 * Standalone asset cache for use outside of Next.js request context
 * This version doesn't use Supabase and only provides in-memory caching
 */
export class AssetCacheStandalone {
  private memoryCache: Map<string, CachedAsset> = new Map()
  private readonly cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours

  async findSimilar(prompt: string, style?: ImageStyle): Promise<GeneratedImage | null> {
    // Only check memory cache
    const memCached = this.findInMemoryCache(prompt, style)
    if (memCached) {
      return this.cachedAssetToGeneratedImage(memCached)
    }
    return null
  }

  async store(image: GeneratedImage): Promise<void> {
    const tags = this.extractTags(image.prompt)
    
    // Store in memory cache only
    const cachedAsset: CachedAsset = {
      id: `cache-${Date.now()}`,
      url: image.url,
      prompt: image.prompt,
      model: image.model,
      style: image.style,
      tags,
      usageCount: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.cacheExpiry)
    }
    
    this.memoryCache.set(this.getCacheKey(image.prompt, image.style), cachedAsset)
    
    // Clean up expired entries
    this.cleanupExpired()
  }

  private findInMemoryCache(prompt: string, style?: ImageStyle): CachedAsset | null {
    const key = this.getCacheKey(prompt, style)
    const cached = this.memoryCache.get(key)
    
    if (cached) {
      // Check if expired
      if (cached.expiresAt && cached.expiresAt < new Date()) {
        this.memoryCache.delete(key)
        return null
      }
      
      // Update usage count
      cached.usageCount++
      return cached
    }
    
    // Try fuzzy matching
    for (const [cachedKey, asset] of this.memoryCache.entries()) {
      if (this.isSimilarPrompt(prompt, asset.prompt) && asset.style === (style || 'realistic')) {
        if (asset.expiresAt && asset.expiresAt < new Date()) {
          this.memoryCache.delete(cachedKey)
          continue
        }
        
        asset.usageCount++
        return asset
      }
    }
    
    return null
  }

  private getCacheKey(prompt: string, style?: ImageStyle): string {
    const normalizedPrompt = prompt.toLowerCase().trim()
    return `${style || 'realistic'}:${normalizedPrompt}`
  }

  private isSimilarPrompt(prompt1: string, prompt2: string): boolean {
    // Simple similarity check - can be enhanced with more sophisticated algorithms
    const words1 = new Set(prompt1.toLowerCase().split(/\s+/))
    const words2 = new Set(prompt2.toLowerCase().split(/\s+/))
    
    let matches = 0
    for (const word of words1) {
      if (words2.has(word)) matches++
    }
    
    // Consider similar if 70% of words match
    return matches / words1.size >= 0.7
  }

  private extractTags(prompt: string): string[] {
    const tags: string[] = []
    
    // Extract style-related tags
    const styleKeywords = ['modern', 'vintage', 'minimalist', 'abstract', 'geometric', 'organic']
    const promptLower = prompt.toLowerCase()
    
    for (const keyword of styleKeywords) {
      if (promptLower.includes(keyword)) {
        tags.push(keyword)
      }
    }
    
    // Extract color tags
    const colorPattern = /(red|blue|green|yellow|purple|orange|pink|black|white|gray)/gi
    const colors = prompt.match(colorPattern)
    if (colors) {
      tags.push(...colors.map(c => c.toLowerCase()))
    }
    
    // Extract document type tags
    const docTypes = ['background', 'pattern', 'border', 'icon', 'illustration']
    for (const docType of docTypes) {
      if (promptLower.includes(docType)) {
        tags.push(docType)
      }
    }
    
    return [...new Set(tags)] // Remove duplicates
  }

  private cachedAssetToGeneratedImage(asset: CachedAsset): GeneratedImage {
    return {
      url: asset.url,
      model: asset.model as 'stable-diffusion-xl' | 'dall-e-3',
      prompt: asset.prompt,
      size: '1024x1024', // Default size
      style: asset.style,
      cost: 0, // Cached assets have no cost
      generatedAt: asset.createdAt,
      cached: true
    }
  }

  private cleanupExpired() {
    // Clean memory cache
    const now = new Date()
    for (const [key, asset] of this.memoryCache.entries()) {
      if (asset.expiresAt && asset.expiresAt < now) {
        this.memoryCache.delete(key)
      }
    }
  }

  async getCacheStats(): Promise<{
    totalCached: number
    memoryCount: number
    hitRate: number
    popularTags: string[]
  }> {
    // Calculate hit rate from memory cache
    let totalHits = 0
    for (const asset of this.memoryCache.values()) {
      totalHits += asset.usageCount
    }
    
    const hitRate = this.memoryCache.size > 0 
      ? totalHits / (totalHits + this.memoryCache.size) 
      : 0
    
    // Get popular tags
    const tagCounts = new Map<string, number>()
    for (const asset of this.memoryCache.values()) {
      for (const tag of asset.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }
    
    const popularTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag)
    
    return {
      totalCached: this.memoryCache.size,
      memoryCount: this.memoryCache.size,
      hitRate,
      popularTags
    }
  }
}