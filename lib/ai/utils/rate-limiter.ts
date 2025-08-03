import { AIModel, RateLimitConfig } from '../types'

interface RateLimitEntry {
  count: number
  resetTime: number
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  
  private static readonly modelLimits: Record<AIModel, RateLimitConfig> = {
    'gemini-2.0-flash': {
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000
    },
    'gpt-4o-mini': {
      maxRequestsPerMinute: 500,
      maxRequestsPerHour: 10000,
      maxRequestsPerDay: 100000
    },
    'claude-3.5-sonnet': {
      maxRequestsPerMinute: 50,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000
    },
    'claude-4-sonnet': {
      maxRequestsPerMinute: 40,
      maxRequestsPerHour: 800,
      maxRequestsPerDay: 8000
    }
  }

  constructor() {
    // Clean up expired entries every minute
    setInterval(() => this.cleanupExpiredEntries(), 60000)
  }

  async checkLimit(
    model: AIModel, 
    userId: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const limits = RateLimiter.modelLimits[model]
    const now = Date.now()

    // Check minute limit
    const minuteKey = `${model}:${userId}:minute`
    const minuteCheck = this.checkTimeWindow(minuteKey, now, 60000, limits.maxRequestsPerMinute)
    if (!minuteCheck.allowed) {
      return minuteCheck
    }

    // Check hour limit
    const hourKey = `${model}:${userId}:hour`
    const hourCheck = this.checkTimeWindow(hourKey, now, 3600000, limits.maxRequestsPerHour)
    if (!hourCheck.allowed) {
      return hourCheck
    }

    // Check day limit
    const dayKey = `${model}:${userId}:day`
    const dayCheck = this.checkTimeWindow(dayKey, now, 86400000, limits.maxRequestsPerDay)
    if (!dayCheck.allowed) {
      return dayCheck
    }

    // Increment all counters
    this.incrementCounter(minuteKey, now + 60000)
    this.incrementCounter(hourKey, now + 3600000)
    this.incrementCounter(dayKey, now + 86400000)

    return { allowed: true }
  }

  private checkTimeWindow(
    key: string, 
    now: number, 
    windowMs: number, 
    maxRequests: number
  ): { allowed: boolean; retryAfter?: number } {
    const entry = this.limits.get(key)

    if (!entry || entry.resetTime <= now) {
      // Window has expired or doesn't exist
      return { allowed: true }
    }

    if (entry.count >= maxRequests) {
      // Limit exceeded
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000) // seconds
      }
    }

    return { allowed: true }
  }

  private incrementCounter(key: string, resetTime: number): void {
    const entry = this.limits.get(key)
    
    if (!entry || entry.resetTime <= Date.now()) {
      // Create new entry
      this.limits.set(key, { count: 1, resetTime })
    } else {
      // Increment existing
      entry.count++
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    for (const [key, entry] of this.limits) {
      if (entry.resetTime <= now) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.limits.delete(key))
  }

  // Get current usage stats for a user
  getUsageStats(model: AIModel, userId: string): {
    minute: { used: number; limit: number }
    hour: { used: number; limit: number }
    day: { used: number; limit: number }
  } {
    const limits = RateLimiter.modelLimits[model]
    const now = Date.now()

    const minuteEntry = this.limits.get(`${model}:${userId}:minute`)
    const hourEntry = this.limits.get(`${model}:${userId}:hour`)
    const dayEntry = this.limits.get(`${model}:${userId}:day`)

    return {
      minute: {
        used: (minuteEntry && minuteEntry.resetTime > now) ? minuteEntry.count : 0,
        limit: limits.maxRequestsPerMinute
      },
      hour: {
        used: (hourEntry && hourEntry.resetTime > now) ? hourEntry.count : 0,
        limit: limits.maxRequestsPerHour
      },
      day: {
        used: (dayEntry && dayEntry.resetTime > now) ? dayEntry.count : 0,
        limit: limits.maxRequestsPerDay
      }
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter()