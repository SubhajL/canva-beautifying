import { redis } from '../queue/redis'
import type { DocumentType } from '../ai/types'

export interface CachedDocument {
  id: string
  documentType: DocumentType
  hash: string
  analysis: any
  createdAt: Date
  usageCount: number
}

/**
 * Document cache for storing analyzed documents
 */
export class DocumentCache {
  private static readonly CACHE_PREFIX = 'doc:cache:'
  private static readonly SIMILAR_PREFIX = 'doc:similar:'
  private static readonly DEFAULT_TTL = 86400 * 7 // 7 days

  constructor() {}

  /**
   * Get cached document by key
   */
  async get(key: string): Promise<any | null> {
    try {
      const cacheKey = this.generateCacheKey(key)
      const cached = await redis.get(cacheKey)
      
      if (cached) {
        return JSON.parse(cached)
      }
      
      return null
    } catch (error) {
      console.error('[DocumentCache] Error getting cached document:', error)
      return null
    }
  }

  /**
   * Set cached document
   */
  async set(key: string, value: any, ttl: number = DocumentCache.DEFAULT_TTL): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(key)
      const serialized = JSON.stringify(value)
      
      await redis.setex(cacheKey, ttl, serialized)
      return true
    } catch (error) {
      console.error('[DocumentCache] Error setting cached document:', error)
      return false
    }
  }

  /**
   * Invalidate cached document
   */
  async invalidate(key: string): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(key)
      const result = await redis.del(cacheKey)
      return result > 0
    } catch (error) {
      console.error('[DocumentCache] Error invalidating cached document:', error)
      return false
    }
  }

  /**
   * Invalidate documents matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<boolean> {
    try {
      const searchPattern = `${DocumentCache.CACHE_PREFIX}${pattern}`
      const keys = await redis.keys(searchPattern)
      
      if (keys.length === 0) return true
      
      const result = await redis.del(...keys)
      return result > 0
    } catch (error) {
      console.error('[DocumentCache] Error invalidating pattern:', error)
      return false
    }
  }

  /**
   * Get similar documents by type
   */
  async getSimilar(
    documentType: DocumentType, 
    limit: number = 5
  ): Promise<CachedDocument[]> {
    try {
      const similarKey = `${DocumentCache.SIMILAR_PREFIX}${documentType}`
      const documentIds = await redis.lrange(similarKey, 0, limit - 1)
      
      if (documentIds.length === 0) return []
      
      const documents: CachedDocument[] = []
      
      for (const id of documentIds) {
        const doc = await this.get(id)
        if (doc) {
          documents.push({
            id,
            documentType: doc.documentType || documentType,
            hash: doc.hash || '',
            analysis: doc.analysis || doc,
            createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
            usageCount: doc.usageCount || 0
          })
        }
      }
      
      return documents
    } catch (error) {
      console.error('[DocumentCache] Error getting similar documents:', error)
      return []
    }
  }

  /**
   * Generate cache key with prefix
   */
  generateCacheKey(...args: any[]): string {
    return `${DocumentCache.CACHE_PREFIX}${args.join(':')}`
  }

  /**
   * Store document with similarity tracking
   */
  async storeWithSimilarity(
    id: string,
    document: any,
    documentType: DocumentType,
    ttl: number = DocumentCache.DEFAULT_TTL
  ): Promise<boolean> {
    try {
      // Store the document
      const stored = await this.set(id, {
        ...document,
        documentType,
        createdAt: new Date().toISOString(),
        usageCount: 0
      }, ttl)
      
      if (stored) {
        // Add to similarity list
        const similarKey = `${DocumentCache.SIMILAR_PREFIX}${documentType}`
        await redis.lpush(similarKey, id)
        await redis.ltrim(similarKey, 0, 99) // Keep only 100 most recent
        await redis.expire(similarKey, ttl)
      }
      
      return stored
    } catch (error) {
      console.error('[DocumentCache] Error storing document with similarity:', error)
      return false
    }
  }

  /**
   * Increment usage count for a document
   */
  async incrementUsage(key: string): Promise<void> {
    try {
      const doc = await this.get(key)
      if (doc) {
        doc.usageCount = (doc.usageCount || 0) + 1
        await this.set(key, doc)
      }
    } catch (error) {
      console.error('[DocumentCache] Error incrementing usage:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalDocuments: number
    byType: Record<DocumentType, number>
  }> {
    try {
      const pattern = `${DocumentCache.CACHE_PREFIX}*`
      const keys = await redis.keys(pattern)
      
      const stats = {
        totalDocuments: keys.length,
        byType: {} as Record<DocumentType, number>
      }
      
      // This is expensive for large caches, but useful for debugging
      for (const key of keys.slice(0, 100)) { // Sample first 100
        const doc = await redis.get(key)
        if (doc) {
          try {
            const parsed = JSON.parse(doc)
            const type = parsed.documentType as DocumentType
            if (type) {
              stats.byType[type] = (stats.byType[type] || 0) + 1
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
      
      return stats
    } catch (error) {
      console.error('[DocumentCache] Error getting stats:', error)
      return { totalDocuments: 0, byType: {} as Record<DocumentType, number> }
    }
  }
}