import { redis as defaultRedis } from '../queue/redis'
import type { AIModel, UserTier } from '../ai/types'
import type Redis from 'ioredis'

export interface AIRateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
  limit: number
}

export interface AIRateLimitConfig {
  model: AIModel
  tier: UserTier
  windowSeconds: number
  maxRequests: number
}

/**
 * Redis-based rate limiter specifically for AI model requests
 * Uses sliding window algorithm with Lua scripts for atomic operations
 */
export class AIRateLimiter {
  private static readonly KEY_PREFIX = 'ai:rate:'
  
  // Tier-based rate limits per model
  private static readonly RATE_LIMITS: Record<UserTier, Record<AIModel, {
    perMinute: number
    perHour: number
    perDay: number
  }>> = {
    free: {
      'gemini-2.0-flash': { perMinute: 5, perHour: 20, perDay: 50 },
      'gpt-4o-mini': { perMinute: 0, perHour: 0, perDay: 0 },
      'claude-3.5-sonnet': { perMinute: 0, perHour: 0, perDay: 0 },
      'claude-4-sonnet': { perMinute: 0, perHour: 0, perDay: 0 }
    },
    basic: {
      'gemini-2.0-flash': { perMinute: 10, perHour: 100, perDay: 500 },
      'gpt-4o-mini': { perMinute: 8, perHour: 80, perDay: 400 },
      'claude-3.5-sonnet': { perMinute: 0, perHour: 0, perDay: 0 },
      'claude-4-sonnet': { perMinute: 0, perHour: 0, perDay: 0 }
    },
    pro: {
      'gemini-2.0-flash': { perMinute: 30, perHour: 500, perDay: 2000 },
      'gpt-4o-mini': { perMinute: 25, perHour: 400, perDay: 1500 },
      'claude-3.5-sonnet': { perMinute: 15, perHour: 200, perDay: 800 },
      'claude-4-sonnet': { perMinute: 0, perHour: 0, perDay: 0 }
    },
    premium: {
      'gemini-2.0-flash': { perMinute: 60, perHour: 1000, perDay: 10000 },
      'gpt-4o-mini': { perMinute: 50, perHour: 800, perDay: 8000 },
      'claude-3.5-sonnet': { perMinute: 40, perHour: 600, perDay: 5000 },
      'claude-4-sonnet': { perMinute: 30, perHour: 400, perDay: 3000 }
    }
  }

  // Lua script for atomic sliding window rate limiting
  private static readonly SLIDING_WINDOW_SCRIPT = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local max_requests = tonumber(ARGV[3])
    
    -- Clean up old entries
    local clearBefore = now - window
    redis.call('zremrangebyscore', key, 0, clearBefore)
    
    -- Count current requests
    local current = redis.call('zcard', key)
    
    if current < max_requests then
      -- Add current request
      redis.call('zadd', key, now, now .. ':' .. math.random())
      redis.call('expire', key, window + 1)
      
      -- Calculate oldest entry for reset time
      local oldest = redis.call('zrange', key, 0, 0, 'WITHSCORES')
      local reset_at = oldest[2] and (tonumber(oldest[2]) + window) or (now + window)
      
      return { 1, max_requests - current - 1, reset_at, max_requests }
    else
      -- Request denied - calculate retry time
      local oldest = redis.call('zrange', key, 0, 0, 'WITHSCORES')
      local reset_at = tonumber(oldest[2]) + window
      local retry_after = reset_at - now
      
      return { 0, 0, reset_at, max_requests, retry_after }
    end
  `

  private scriptSha?: string
  private redis: Redis

  constructor(redisInstance?: Redis) {
    this.redis = redisInstance || defaultRedis
    this.loadScript()
  }

  private async loadScript(): Promise<void> {
    try {
      this.scriptSha = await this.redis.script('LOAD', AIRateLimiter.SLIDING_WINDOW_SCRIPT) as string
    } catch (error) {
      console.error('[AIRateLimiter] Failed to load Lua script:', error)
    }
  }

  /**
   * Check if an AI request is allowed based on user tier and model limits
   * @param userId User making the request
   * @param model AI model being requested
   * @param tier User's subscription tier
   * @param estimatedTokens Optional estimated tokens for pre-flight check
   */
  async checkLimit(
    userId: string,
    model: AIModel,
    tier: UserTier,
    estimatedTokens?: number
  ): Promise<AIRateLimitResult> {
    const limits = AIRateLimiter.RATE_LIMITS[tier]?.[model]
    
    if (!limits || (limits.perMinute === 0 && limits.perHour === 0 && limits.perDay === 0)) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 86400000, // 24 hours
        retryAfter: 86400,
        limit: 0
      }
    }

    // Check all time windows first (without incrementing)
    const windows = [
      { seconds: 60, limit: limits.perMinute, name: 'minute' },
      { seconds: 3600, limit: limits.perHour, name: 'hour' },
      { seconds: 86400, limit: limits.perDay, name: 'day' }
    ]

    // First pass: check if any window would deny the request
    for (const window of windows) {
      if (window.limit === 0) continue

      const result = await this.checkWindowReadOnly(
        userId,
        model,
        tier,
        window.seconds,
        window.limit,
        window.name
      )

      if (!result.allowed) {
        return result
      }
    }

    // All windows allow the request - now actually increment
    // Use the minute window for the final result since it's the most restrictive
    const minuteResult = await this.checkWindow(
      userId,
      model,
      tier,
      60,
      limits.perMinute,
      'minute'
    )

    // Also increment hour and day windows
    if (minuteResult.allowed) {
      await this.incrementWindow(userId, model, tier, 3600, limits.perHour, 'hour')
      await this.incrementWindow(userId, model, tier, 86400, limits.perDay, 'day')
    }

    return minuteResult
  }

  /**
   * Check a specific time window without incrementing (read-only)
   */
  private async checkWindowReadOnly(
    userId: string,
    model: AIModel,
    tier: UserTier,
    windowSeconds: number,
    maxRequests: number,
    windowName: string
  ): Promise<AIRateLimitResult> {
    const key = `${AIRateLimiter.KEY_PREFIX}${tier}:${userId}:${model}:${windowName}`
    const now = Date.now()
    const clearBefore = now - (windowSeconds * 1000)

    // Clean up and count without incrementing
    await this.redis.zremrangebyscore(key, 0, clearBefore)
    const current = await this.redis.zcard(key)

    if (current < maxRequests) {
      return {
        allowed: true,
        remaining: maxRequests - current,
        resetAt: now + windowSeconds * 1000,
        limit: maxRequests
      }
    } else {
      // Get oldest entry for accurate retry time
      const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES')
      const resetAt = oldest[1] ? parseInt(oldest[1]) + windowSeconds * 1000 : now + windowSeconds * 1000
      const retryAfter = resetAt - now

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: maxRequests,
        retryAfter: Math.ceil(retryAfter / 1000)
      }
    }
  }

  /**
   * Increment a specific time window
   */
  private async incrementWindow(
    userId: string,
    model: AIModel,
    tier: UserTier,
    windowSeconds: number,
    maxRequests: number,
    windowName: string
  ): Promise<void> {
    const key = `${AIRateLimiter.KEY_PREFIX}${tier}:${userId}:${model}:${windowName}`
    const now = Date.now()

    await this.redis.zadd(key, now, `${now}:${Math.random()}`)
    await this.redis.expire(key, windowSeconds + 1)
  }

  /**
   * Check a specific time window and increment if allowed
   */
  private async checkWindow(
    userId: string,
    model: AIModel,
    tier: UserTier,
    windowSeconds: number,
    maxRequests: number,
    windowName: string
  ): Promise<AIRateLimitResult> {
    const key = `${AIRateLimiter.KEY_PREFIX}${tier}:${userId}:${model}:${windowName}`
    const now = Date.now()

    try {
      let result: any[]
      
      if (this.scriptSha) {
        try {
          result = await this.redis.evalsha(
            this.scriptSha,
            1,
            key,
            now,
            windowSeconds * 1000,
            maxRequests
          ) as any[]
        } catch (error: any) {
          if (error.message?.includes('NOSCRIPT')) {
            await this.loadScript()
            result = await this.redis.eval(
              AIRateLimiter.SLIDING_WINDOW_SCRIPT,
              1,
              key,
              now,
              windowSeconds * 1000,
              maxRequests
            ) as any[]
          } else {
            throw error
          }
        }
      } else {
        result = await this.redis.eval(
          AIRateLimiter.SLIDING_WINDOW_SCRIPT,
          1,
          key,
          now,
          windowSeconds * 1000,
          maxRequests
        ) as any[]
      }

      const [allowed, remaining, resetAt, limit, retryAfter] = result

      return {
        allowed: allowed === 1,
        remaining: remaining || 0,
        resetAt: Math.floor(resetAt),
        limit: limit || maxRequests,
        ...(retryAfter && { retryAfter: Math.ceil(retryAfter / 1000) })
      }
    } catch (error) {
      console.error('[AIRateLimiter] Error checking rate limit:', error)
      // Fail open to avoid blocking legitimate requests due to Redis issues
      return {
        allowed: true,
        remaining: 1,
        resetAt: now + windowSeconds * 1000,
        limit: maxRequests
      }
    }
  }

  /**
   * Get current usage stats across all windows
   */
  async getUsageStats(userId: string, model: AIModel, tier: UserTier): Promise<{
    minute: { used: number; limit: number; remaining: number }
    hour: { used: number; limit: number; remaining: number }
    day: { used: number; limit: number; remaining: number }
  }> {
    const limits = AIRateLimiter.RATE_LIMITS[tier]?.[model]
    if (!limits) {
      return {
        minute: { used: 0, limit: 0, remaining: 0 },
        hour: { used: 0, limit: 0, remaining: 0 },
        day: { used: 0, limit: 0, remaining: 0 }
      }
    }

    const now = Date.now()
    const pipeline = this.redis.pipeline()

    const windows = [
      { name: 'minute', seconds: 60, limit: limits.perMinute },
      { name: 'hour', seconds: 3600, limit: limits.perHour },
      { name: 'day', seconds: 86400, limit: limits.perDay }
    ]

    for (const window of windows) {
      const key = `${AIRateLimiter.KEY_PREFIX}${tier}:${userId}:${model}:${window.name}`
      const clearBefore = now - (window.seconds * 1000)
      
      pipeline.zremrangebyscore(key, 0, clearBefore)
      pipeline.zcard(key)
    }

    const results = await pipeline.exec()
    if (!results) {
      throw new Error('Failed to get usage stats')
    }

    const stats: any = {}
    for (let i = 0; i < windows.length; i++) {
      const window = windows[i]
      const used = results[i * 2 + 1]?.[1] as number || 0
      stats[window.name] = {
        used,
        limit: window.limit,
        remaining: Math.max(0, window.limit - used)
      }
    }

    return stats
  }

  /**
   * Reset rate limits for a user (useful for testing or manual intervention)
   */
  async resetLimits(userId: string, model?: AIModel, tier?: UserTier): Promise<number> {
    const pattern = model && tier
      ? `${AIRateLimiter.KEY_PREFIX}${tier}:${userId}:${model}:*`
      : `${AIRateLimiter.KEY_PREFIX}*:${userId}:*`

    const keys = await this.redis.keys(pattern)
    if (keys.length === 0) return 0

    return await this.redis.del(...keys)
  }

  /**
   * Get remaining quota for the most restrictive window
   */
  async getRemainingQuota(
    userId: string,
    model: AIModel,
    tier: UserTier
  ): Promise<number> {
    const stats = await this.getUsageStats(userId, model, tier)
    return Math.min(
      stats.minute.remaining,
      stats.hour.remaining,
      stats.day.remaining
    )
  }

  /**
   * Track actual token usage after a successful API call
   * This creates a separate token usage tracking key for analytics
   * @param userId User who made the request
   * @param model AI model that was used
   * @param tokensUsed Actual number of tokens consumed
   * @param tier User's subscription tier
   */
  async trackTokenUsage(
    userId: string,
    model: AIModel,
    tokensUsed: number,
    tier: UserTier
  ): Promise<void> {
    const now = Date.now()
    const dayKey = `${AIRateLimiter.KEY_PREFIX}tokens:${tier}:${userId}:${model}:day`
    const hourKey = `${AIRateLimiter.KEY_PREFIX}tokens:${tier}:${userId}:${model}:hour`
    
    // Track daily token usage
    await this.redis.zadd(dayKey, now, `${now}:${tokensUsed}`)
    await this.redis.expire(dayKey, 86400) // 24 hours
    
    // Track hourly token usage  
    await this.redis.zadd(hourKey, now, `${now}:${tokensUsed}`)
    await this.redis.expire(hourKey, 3600) // 1 hour
    
    // Clean up old entries
    const dayBefore = now - 86400000
    const hourBefore = now - 3600000
    
    await this.redis.zremrangebyscore(dayKey, 0, dayBefore)
    await this.redis.zremrangebyscore(hourKey, 0, hourBefore)
  }
}

// Export singleton instance
export const aiRateLimiter = new AIRateLimiter()