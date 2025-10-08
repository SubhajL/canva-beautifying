// In-memory AI rate limiter for tests and local dev.
// Production should replace this with a Redis-backed implementation.

import type { AIModel, UserTier } from '@/lib/ai/types'

type WindowStats = { used: number; limit: number }
type Usage = {
  minute: WindowStats
  hour: WindowStats
  day: WindowStats
}

const DEFAULT_LIMITS: Usage = {
  minute: { used: 0, limit: 1000 },
  hour: { used: 0, limit: 10000 },
  day: { used: 0, limit: 100000 },
}

const usage = new Map<string, Usage>()

function key(userId: string, model?: AIModel, tier?: UserTier) {
  return `${userId}:${model || 'any'}:${tier || 'free'}`
}

export const aiRateLimiter = {
  async checkLimit(
    userId: string,
    _model: AIModel,
    _tier: UserTier = 'free',
    _estimatedTokens?: number
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    // Always allow in tests/local; callers can override if needed.
    return { allowed: true }
  },

  async getUsageStats(
    userId: string,
    model: AIModel,
    tier: UserTier = 'free'
  ): Promise<Usage> {
    const k = key(userId, model, tier)
    return usage.get(k) || { ...DEFAULT_LIMITS }
  },

  async resetLimits(userId: string, model?: AIModel, tier?: UserTier): Promise<void> {
    usage.delete(key(userId, model, tier))
  },

  async getRemainingQuota(
    userId: string,
    model: AIModel,
    tier: UserTier = 'free'
  ): Promise<number> {
    const stats = await this.getUsageStats(userId, model, tier)
    return Math.max(
      stats.minute.limit - stats.minute.used,
      stats.hour.limit - stats.hour.used,
      stats.day.limit - stats.day.used
    )
  },

  async trackTokenUsage(
    userId: string,
    model: AIModel,
    tokensUsed: number,
    tier: UserTier = 'free'
  ): Promise<void> {
    const k = key(userId, model, tier)
    const current = usage.get(k) || JSON.parse(JSON.stringify(DEFAULT_LIMITS))
    current.minute.used += tokensUsed
    current.hour.used += tokensUsed
    current.day.used += tokensUsed
    usage.set(k, current)
  },
}

