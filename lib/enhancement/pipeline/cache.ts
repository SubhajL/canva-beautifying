import { redis } from '@/lib/queue/config'
import { 
  InitialAnalysisResult,
  EnhancementPlan,
  GeneratedAssets 
} from './types'

export class PipelineCache {
  private documentId: string
  private ttl: number = 3600 // 1 hour default TTL

  constructor(documentId: string) {
    this.documentId = documentId
  }

  // Analysis cache
  async getAnalysis(): Promise<{ data: InitialAnalysisResult; timestamp: number } | null> {
    const key = this.getCacheKey('analysis')
    const cached = await redis.get(key)
    
    if (cached) {
      return JSON.parse(cached)
    }
    
    return null
  }

  async setAnalysis(data: InitialAnalysisResult): Promise<void> {
    const key = this.getCacheKey('analysis')
    const value = JSON.stringify({
      data,
      timestamp: Date.now(),
    })
    
    await redis.setex(key, this.ttl, value)
  }

  // Plan cache
  async getPlan(): Promise<{ data: EnhancementPlan; timestamp: number } | null> {
    const key = this.getCacheKey('plan')
    const cached = await redis.get(key)
    
    if (cached) {
      return JSON.parse(cached)
    }
    
    return null
  }

  async setPlan(data: EnhancementPlan): Promise<void> {
    const key = this.getCacheKey('plan')
    const value = JSON.stringify({
      data,
      timestamp: Date.now(),
    })
    
    await redis.setex(key, this.ttl, value)
  }

  // Assets cache
  async getAssets(): Promise<{ data: GeneratedAssets; timestamp: number } | null> {
    const key = this.getCacheKey('assets')
    const cached = await redis.get(key)
    
    if (cached) {
      return JSON.parse(cached)
    }
    
    return null
  }

  async setAssets(data: GeneratedAssets): Promise<void> {
    const key = this.getCacheKey('assets')
    const value = JSON.stringify({
      data,
      timestamp: Date.now(),
    })
    
    // Longer TTL for assets since they're expensive to generate
    await redis.setex(key, this.ttl * 2, value)
  }

  // Clear all cache for a document
  async clearAll(): Promise<void> {
    const keys = [
      this.getCacheKey('analysis'),
      this.getCacheKey('plan'),
      this.getCacheKey('assets'),
    ]
    
    await Promise.all(keys.map(key => redis.del(key)))
  }

  // Check if pipeline has recent results
  async hasRecentResults(): Promise<boolean> {
    const analysis = await this.getAnalysis()
    const plan = await this.getPlan()
    
    if (!analysis || !plan) {
      return false
    }
    
    const now = Date.now()
    const analysisAge = now - analysis.timestamp
    const planAge = now - plan.timestamp
    
    // Consider results recent if less than 30 minutes old
    return analysisAge < 30 * 60 * 1000 && planAge < 30 * 60 * 1000
  }

  private getCacheKey(stage: string): string {
    return `pipeline:${this.documentId}:${stage}`
  }
}