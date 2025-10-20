import { redis } from '../queue/redis'
import type { DocumentAnalysis, EnhancementSuggestion } from '../ai/types'
import crypto from 'crypto'

export interface CachedEnhancement {
  analysis: DocumentAnalysis
  suggestions: EnhancementSuggestion[]
  metadata: {
    userId: string
    userTier: string
    model: string
    createdAt: Date
    lastAccessed: Date
    accessCount: number
  }
}

/**
 * Enhancement cache for storing document enhancement results
 */
export class EnhancementCache {
  private static readonly CACHE_PREFIX = 'enhance:cache:'
  private static readonly SIMILARITY_PREFIX = 'enhance:similar:'
  private static readonly DEFAULT_TTL = 86400 * 14 // 14 days

  constructor() {}

  /**
   * Get cached enhancement by key
   */
  async get(key: string): Promise<CachedEnhancement | null> {
    try {
      const cacheKey = this.generateCacheKey(key)
      const cached = await redis.get(cacheKey)
      
      if (cached) {
        const enhancement = JSON.parse(cached) as CachedEnhancement
        
        // Update access tracking
        enhancement.metadata.lastAccessed = new Date()
        enhancement.metadata.accessCount += 1
        
        // Update in cache with extended TTL
        await redis.setex(cacheKey, EnhancementCache.DEFAULT_TTL, JSON.stringify(enhancement))
        
        return enhancement
      }
      
      return null
    } catch (error) {
      console.error('[EnhancementCache] Error getting cached enhancement:', error)
      return null
    }
  }

  /**
   * Set cached enhancement
   */
  async set(
    key: string, 
    value: CachedEnhancement, 
    ttl: number = EnhancementCache.DEFAULT_TTL
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(key)
      
      // Ensure metadata is properly formatted
      const enhancement: CachedEnhancement = {
        ...value,
        metadata: {
          ...value.metadata,
          createdAt: value.metadata.createdAt instanceof Date 
            ? value.metadata.createdAt 
            : new Date(value.metadata.createdAt),
          lastAccessed: new Date(),
          accessCount: value.metadata.accessCount || 0
        }
      }
      
      const serialized = JSON.stringify(enhancement)
      await redis.setex(cacheKey, ttl, serialized)
      
      // Track for similarity searches
      await this.trackForSimilarity(key, enhancement)
      
      return true
    } catch (error) {
      console.error('[EnhancementCache] Error setting cached enhancement:', error)
      return false
    }
  }

  /**
   * Invalidate cached enhancement
   */
  async invalidate(key: string): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(key)
      const result = await redis.del(cacheKey)
      
      // Also remove from similarity tracking
      await this.removeFromSimilarity(key)
      
      return result > 0
    } catch (error) {
      console.error('[EnhancementCache] Error invalidating cached enhancement:', error)
      return false
    }
  }

  /**
   * Get similar enhancements based on document hash
   */
  async getSimilarEnhancements(
    documentHash: string, 
    threshold: number = 0.8
  ): Promise<CachedEnhancement[]> {
    try {
      const similarKey = `${EnhancementCache.SIMILARITY_PREFIX}${documentHash.substring(0, 8)}`
      const similar = await redis.lrange(similarKey, 0, 10)
      
      if (similar.length === 0) return []
      
      const enhancements: CachedEnhancement[] = []
      
      for (const enhancementKey of similar) {
        const enhancement = await this.get(enhancementKey)
        if (enhancement) {
          enhancements.push(enhancement)
        }
      }
      
      return enhancements
    } catch (error) {
      console.error('[EnhancementCache] Error getting similar enhancements:', error)
      return []
    }
  }

  /**
   * Generate cache key with prefix
   */
  generateCacheKey(...args: any[]): string {
    return `${EnhancementCache.CACHE_PREFIX}${args.join(':')}`
  }

  /**
   * Generate document hash for similarity tracking
   */
  generateDocumentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Store enhancement with document content for similarity
   */
  async storeEnhancement(
    documentId: string,
    documentContent: string,
    enhancement: CachedEnhancement,
    ttl: number = EnhancementCache.DEFAULT_TTL
  ): Promise<boolean> {
    const documentHash = this.generateDocumentHash(documentContent)
    const key = `${documentId}:${documentHash}`
    
    return await this.set(key, enhancement, ttl)
  }

  /**
   * Track enhancement for similarity searches
   */
  private async trackForSimilarity(key: string, enhancement: CachedEnhancement): Promise<void> {
    try {
      // Use a simplified hash for similarity grouping
      const contentHash = this.generateDocumentHash(JSON.stringify(enhancement.analysis))
      const similarKey = `${EnhancementCache.SIMILARITY_PREFIX}${contentHash.substring(0, 8)}`
      
      await redis.lpush(similarKey, key)
      await redis.ltrim(similarKey, 0, 49) // Keep only 50 most recent
      await redis.expire(similarKey, EnhancementCache.DEFAULT_TTL)
    } catch (error) {
      console.error('[EnhancementCache] Error tracking similarity:', error)
    }
  }

  /**
   * Remove enhancement from similarity tracking
   */
  private async removeFromSimilarity(key: string): Promise<void> {
    try {
      const pattern = `${EnhancementCache.SIMILARITY_PREFIX}*`
      const similarKeys = await redis.keys(pattern)
      
      for (const similarKey of similarKeys) {
        await redis.lrem(similarKey, 0, key)
      }
    } catch (error) {
      console.error('[EnhancementCache] Error removing from similarity:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEnhancements: number
    totalSimilarityGroups: number
    avgAccessCount: number
  }> {
    try {
      const enhancementPattern = `${EnhancementCache.CACHE_PREFIX}*`
      const similarityPattern = `${EnhancementCache.SIMILARITY_PREFIX}*`
      
      const [enhancementKeys, similarityKeys] = await Promise.all([
        redis.keys(enhancementPattern),
        redis.keys(similarityPattern)
      ])
      
      let totalAccess = 0
      
      // Sample some enhancements to calculate average access
      const sampleSize = Math.min(100, enhancementKeys.length)
      for (let i = 0; i < sampleSize; i++) {
        const cached = await redis.get(enhancementKeys[i])
        if (cached) {
          try {
            const enhancement = JSON.parse(cached) as CachedEnhancement
            totalAccess += enhancement.metadata.accessCount || 0
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
      
      return {
        totalEnhancements: enhancementKeys.length,
        totalSimilarityGroups: similarityKeys.length,
        avgAccessCount: sampleSize > 0 ? totalAccess / sampleSize : 0
      }
    } catch (error) {
      console.error('[EnhancementCache] Error getting stats:', error)
      return {
        totalEnhancements: 0,
        totalSimilarityGroups: 0,
        avgAccessCount: 0
      }
    }
  }

  /**
   * Clean up old or rarely accessed enhancements
   */
  async cleanup(options: {
    maxAge?: number // seconds
    minAccessCount?: number
  } = {}): Promise<number> {
    try {
      const { maxAge = 86400 * 30, minAccessCount = 1 } = options // 30 days default
      const cutoffTime = new Date(Date.now() - maxAge * 1000)
      
      const pattern = `${EnhancementCache.CACHE_PREFIX}*`
      const keys = await redis.keys(pattern)
      
      let cleaned = 0
      
      for (const key of keys) {
        const cached = await redis.get(key)
        if (cached) {
          try {
            const enhancement = JSON.parse(cached) as CachedEnhancement
            const lastAccessed = new Date(enhancement.metadata.lastAccessed)
            const accessCount = enhancement.metadata.accessCount || 0
            
            if (lastAccessed < cutoffTime && accessCount < minAccessCount) {
              await redis.del(key)
              await this.removeFromSimilarity(key.replace(EnhancementCache.CACHE_PREFIX, ''))
              cleaned++
            }
          } catch (e) {
            // If we can't parse it, it's corrupt - delete it
            await redis.del(key)
            cleaned++
          }
        }
      }
      
      return cleaned
    } catch (error) {
      console.error('[EnhancementCache] Error during cleanup:', error)
      return 0
    }
  }
}