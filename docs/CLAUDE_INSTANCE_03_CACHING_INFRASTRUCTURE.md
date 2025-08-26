# Claude Instance 03: Caching Infrastructure Specialist

## Role Overview
You are responsible for implementing a comprehensive caching layer that reduces AI costs, improves response times, and enables intelligent reuse of analysis and enhancement results. Your focus is on content-aware caching with similarity matching.

## Core Responsibilities

### 1. Document Analysis Cache

**Implementation Goals:**
- Cache AI analysis results based on document content
- Enable similarity-based cache retrieval
- Implement intelligent TTL based on complexity and tier

Create `lib/cache/document-cache.ts`:

```typescript
export interface CacheConfig {
  defaultTTL: number
  maxSize: number
  compressionEnabled: boolean
  similarityThreshold: number
}

export class DocumentCache {
  constructor(
    private redis: Redis,
    private config: CacheConfig
  ) {}
  
  async get(
    documentHash: string, 
    preferences?: UserPreferences
  ): Promise<DocumentAnalysis | null> {
    const key = this.generateKey(documentHash, preferences)
    const compressed = await this.redis.get(key)
    
    if (!compressed) {
      // Try similarity search
      return await this.findSimilar(documentHash, preferences)
    }
    
    return this.decompress(compressed)
  }
  
  async set(
    documentHash: string,
    analysis: DocumentAnalysis,
    preferences?: UserPreferences,
    complexity?: DocumentComplexity
  ): Promise<void> {
    const key = this.generateKey(documentHash, preferences)
    const ttl = this.calculateTTL(complexity, analysis.overallScore)
    const compressed = await this.compress(analysis)
    
    await this.redis.setex(key, ttl, compressed)
    
    // Store in similarity index
    await this.indexForSimilarity(documentHash, analysis)
  }
}
```

### 2. Perceptual Hashing Implementation

Create `lib/cache/perceptual-hash.ts`:

```typescript
export class PerceptualHasher {
  private readonly HASH_SIZE = 8 // 8x8 = 64 bit hash
  
  async generateHash(imageData: ImageData): Promise<string> {
    // 1. Resize to 9x9 (for 8x8 differences)
    const resized = await this.resize(imageData, 9, 9)
    
    // 2. Convert to grayscale
    const grayscale = this.toGrayscale(resized)
    
    // 3. Calculate differences
    const differences = this.calculateDifferences(grayscale)
    
    // 4. Generate hash
    return this.bitsToHex(differences)
  }
  
  calculateSimilarity(hash1: string, hash2: string): number {
    const bits1 = this.hexToBits(hash1)
    const bits2 = this.hexToBits(hash2)
    
    let differences = 0
    for (let i = 0; i < bits1.length; i++) {
      if (bits1[i] !== bits2[i]) differences++
    }
    
    // Return similarity score 0-1
    return 1 - (differences / bits1.length)
  }
  
  private calculateDifferences(pixels: number[][]): boolean[] {
    const differences: boolean[] = []
    
    for (let y = 0; y < this.HASH_SIZE; y++) {
      for (let x = 0; x < this.HASH_SIZE; x++) {
        // Compare with pixel to the right
        differences.push(pixels[y][x] > pixels[y][x + 1])
      }
    }
    
    return differences
  }
}
```

### 3. Enhancement Results Cache

Create `lib/cache/enhancement-cache.ts`:

```typescript
export interface EnhancementCacheEntry {
  result: EnhancementResult
  documentHash: string
  perceptualHash: string
  preferences: UserPreferences
  timestamp: number
  usageCount: number
  averageRating?: number
}

export class EnhancementCache {
  private readonly SIMILARITY_THRESHOLD = 0.85
  
  async getSimilar(
    documentHash: string,
    preferences: UserPreferences,
    perceptualHash?: string
  ): Promise<EnhancementResult | null> {
    // Try exact match first
    const exact = await this.getExact(documentHash, preferences)
    if (exact) return exact
    
    // Fallback to similarity search
    if (!perceptualHash) return null
    
    const candidates = await this.findSimilarHashes(perceptualHash)
    
    for (const candidate of candidates) {
      if (this.preferencesMatch(candidate.preferences, preferences)) {
        // Increment usage count
        await this.incrementUsage(candidate)
        return candidate.result
      }
    }
    
    return null
  }
  
  private async findSimilarHashes(
    targetHash: string
  ): Promise<EnhancementCacheEntry[]> {
    // Use Redis sorted set for efficient similarity search
    const script = `
      local results = {}
      local hashes = redis.call('zrange', 'perceptual_hashes', 0, -1)
      
      for i, hash in ipairs(hashes) do
        local similarity = calculate_similarity(hash, ARGV[1])
        if similarity >= tonumber(ARGV[2]) then
          table.insert(results, {hash, similarity})
        end
      end
      
      return results
    `
    
    const similar = await this.redis.eval(
      script, 
      0, 
      targetHash, 
      this.SIMILARITY_THRESHOLD
    )
    
    return this.loadEntries(similar)
  }
}
```

### 4. Cache Key Generation Strategy

Create `lib/cache/cache-key-generator.ts`:

```typescript
import { createHash } from 'crypto'
import xxhash from 'xxhash-wasm'

export class CacheKeyGenerator {
  private xxhash32: any
  
  async initialize(): Promise<void> {
    const { h32 } = await xxhash()
    this.xxhash32 = h32
  }
  
  generateDocumentKey(
    contentHash: string,
    preferences?: UserPreferences
  ): string {
    const parts = ['doc', contentHash]
    
    if (preferences) {
      parts.push(preferences.style || 'default')
      parts.push(preferences.colorScheme || 'default')
      parts.push(preferences.targetAudience || 'default')
    }
    
    return parts.join(':')
  }
  
  async generateContentHash(imageData: ImageData): Promise<string> {
    // Use xxHash for speed
    const buffer = Buffer.from(imageData.data)
    const hash = this.xxhash32(buffer, 0).toString(16)
    
    // Add dimensions to handle same image at different sizes
    return `${hash}_${imageData.width}x${imageData.height}`
  }
  
  generateEnhancementKey(
    documentHash: string,
    model: AIModel,
    preferences: UserPreferences
  ): string {
    return `enhance:${model}:${documentHash}:${this.hashPreferences(preferences)}`
  }
  
  private hashPreferences(prefs: UserPreferences): string {
    const normalized = JSON.stringify({
      style: prefs.style || 'default',
      colorScheme: prefs.colorScheme || 'default',
      targetAudience: prefs.targetAudience || 'default'
    })
    
    return createHash('md5').update(normalized).digest('hex').slice(0, 8)
  }
}
```

### 5. Cache Warming and Preloading

Create `lib/cache/cache-warmer.ts`:

```typescript
export class CacheWarmer {
  constructor(
    private documentCache: DocumentCache,
    private enhancementCache: EnhancementCache,
    private aiService: AIService
  ) {}
  
  async warmPopularDocuments(): Promise<void> {
    const popularDocuments = await this.getPopularDocuments()
    
    for (const doc of popularDocuments) {
      if (!await this.documentCache.exists(doc.hash)) {
        // Pre-analyze popular document types
        const analysis = await this.aiService.analyzeDocument(
          doc.url,
          doc.commonPreferences,
          'system'
        )
        
        await this.documentCache.set(
          doc.hash,
          analysis,
          doc.commonPreferences,
          'medium' // Default complexity
        )
      }
    }
  }
  
  async preloadUserHistory(userId: string): Promise<void> {
    // Load user's recent documents into cache
    const recentDocs = await this.getUserRecentDocuments(userId)
    
    await Promise.all(
      recentDocs.map(doc => this.ensureCached(doc))
    )
  }
}
```

### 6. Cache Invalidation Strategy

Create `lib/cache/cache-invalidator.ts`:

```typescript
export class CacheInvalidator {
  async invalidateDocument(documentId: string): Promise<void> {
    const patterns = [
      `doc:${documentId}:*`,
      `enhance:*:${documentId}:*`,
      `similar:${documentId}:*`
    ]
    
    for (const pattern of patterns) {
      await this.deletePattern(pattern)
    }
    
    // Remove from similarity index
    await this.removeFromSimilarityIndex(documentId)
  }
  
  async invalidateUserCache(userId: string): Promise<void> {
    // Clear user-specific cache entries
    await this.deletePattern(`user:${userId}:*`)
  }
  
  async invalidateModelCache(model: AIModel): Promise<void> {
    // Clear all cache entries for a specific model
    // Useful when model is updated or deprecated
    await this.deletePattern(`*:${model}:*`)
  }
  
  private async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }
}
```

## Implementation Guidelines

### Redis Data Structures

1. **Document Cache:**
```
Key: doc:{contentHash}:{preferencesHash}
Value: Compressed JSON of DocumentAnalysis
Type: String with TTL
```

2. **Perceptual Hash Index:**
```
Key: perceptual_hashes
Value: Sorted set with hash as member, similarity score
Type: ZSET
```

3. **Enhancement Cache:**
```
Key: enhance:{model}:{documentHash}:{preferencesHash}
Value: Compressed enhancement result
Type: String with TTL
```

4. **Similarity Mappings:**
```
Key: similar:{perceptualHash}
Value: Set of similar document hashes
Type: SET
```

### TTL Calculation Strategy

```typescript
private calculateTTL(
  complexity: DocumentComplexity,
  qualityScore: number,
  userTier: UserTier
): number {
  const baseTTL = {
    low: 86400,      // 1 day
    medium: 43200,   // 12 hours
    high: 21600      // 6 hours
  }[complexity]
  
  // Adjust based on quality
  const qualityMultiplier = qualityScore > 80 ? 2 : 1
  
  // Tier-based adjustments
  const tierMultiplier = {
    free: 0.5,      // Shorter cache for free tier
    basic: 1,
    pro: 1.5,
    premium: 2      // Longer cache for premium
  }[userTier]
  
  return Math.floor(baseTTL * qualityMultiplier * tierMultiplier)
}
```

### Compression Strategy

```typescript
import { compress, decompress } from 'lz4'

private async compress(data: any): Promise<Buffer> {
  const json = JSON.stringify(data)
  
  // Only compress if beneficial
  if (json.length < 1024) {
    return Buffer.from(json)
  }
  
  return compress(Buffer.from(json))
}

private async decompress(buffer: Buffer): Promise<any> {
  try {
    // Try LZ4 decompression first
    const decompressed = decompress(buffer)
    return JSON.parse(decompressed.toString())
  } catch {
    // Fallback to uncompressed
    return JSON.parse(buffer.toString())
  }
}
```

### Testing Requirements

Create tests in `__tests__/cache/`:

1. **Cache Hit/Miss Tests:**
```typescript
describe('DocumentCache', () => {
  it('should return cached analysis on hit', async () => {
    const cache = new DocumentCache(redis, config)
    const analysis = mockDocumentAnalysis()
    
    await cache.set('hash123', analysis)
    const retrieved = await cache.get('hash123')
    
    expect(retrieved).toEqual(analysis)
  })
  
  it('should find similar documents', async () => {
    // Test similarity matching
  })
})
```

2. **Performance Tests:**
- Cache operations < 10ms
- Compression ratio > 50%
- Memory usage under limits
- Concurrent access handling

3. **Invalidation Tests:**
- Pattern-based deletion
- Cascading invalidation
- Race condition prevention

### Coordination with Other Instances

1. **Instance 1 (State Management):**
- Share Redis connection
- Coordinate on key namespaces
- Align on connection pooling

2. **Instance 2 (AI Resilience):**
- Cache fallback responses
- Share health check results
- Coordinate on warming strategies

3. **Instance 4 (Observability):**
- Export cache metrics
- Monitor hit rates
- Track memory usage

## Performance Optimization

1. **Batch Operations:**
```typescript
async mget(keys: string[]): Promise<any[]> {
  const pipeline = this.redis.pipeline()
  
  for (const key of keys) {
    pipeline.get(key)
  }
  
  const results = await pipeline.exec()
  return results.map(([err, data]) => 
    err ? null : this.decompress(data)
  )
}
```

2. **Memory Management:**
- Monitor Redis memory usage
- Implement LRU eviction
- Set max memory limits
- Use memory-efficient formats

3. **Hit Rate Optimization:**
- Track cache hit rates by category
- Adjust TTLs based on usage
- Implement predictive caching
- Warm cache during low usage

## Success Criteria

1. **Performance:**
- Cache hit rate > 60%
- Response time < 10ms for hits
- Compression ratio > 50%
- Memory usage < 2GB

2. **Cost Savings:**
- 40% reduction in AI API calls
- 50% reduction in processing time
- Measurable cost savings per tier

3. **Reliability:**
- Cache available 99.9% uptime
- Graceful degradation without cache
- No stale data served

## Common Pitfalls to Avoid

1. **Don't:**
- Cache sensitive user data
- Use predictable cache keys
- Ignore cache stampede
- Cache without compression

2. **Do:**
- Monitor cache effectiveness
- Implement cache warming
- Handle concurrent updates
- Set appropriate TTLs

## Daily Workflow

1. **Morning:**
- Check cache hit rates
- Review memory usage
- Warm popular content

2. **Development:**
- Test cache behavior locally
- Monitor compression ratios
- Verify TTL calculations

3. **End of Day:**
- Export cache metrics
- Document new patterns
- Clear test cache data

Remember: Effective caching is invisible to users but critical for scalability!