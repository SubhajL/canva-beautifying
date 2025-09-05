import { aiRateLimiter } from '@/lib/redis/ai-rate-limiter'
import type { AIModel, UserTier } from '../types'

/**
 * Rate limiter for AI model requests
 * Now uses Redis for distributed rate limiting
 */
export class RateLimiter {
  /**
   * Check if a request is allowed based on rate limits
   * @param model The AI model being requested
   * @param userId The user making the request
   * @param userTier The user's subscription tier (defaults to 'free')
   * @param estimatedTokens Optional estimated tokens for the request
   */
  async checkLimit(
    model: AIModel,
    userId: string,
    userTier: UserTier = 'free',
    estimatedTokens?: number
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const result = await aiRateLimiter.checkLimit(userId, model, userTier, estimatedTokens)
    
    return {
      allowed: result.allowed,
      retryAfter: result.retryAfter
    }
  }

  /**
   * Get current usage statistics for a user
   */
  async getUsageStats(
    model: AIModel,
    userId: string,
    userTier: UserTier = 'free'
  ): Promise<{
    minute: { used: number; limit: number }
    hour: { used: number; limit: number }
    day: { used: number; limit: number }
  }> {
    const stats = await aiRateLimiter.getUsageStats(userId, model, userTier)
    
    return {
      minute: {
        used: stats.minute.used,
        limit: stats.minute.limit
      },
      hour: {
        used: stats.hour.used,
        limit: stats.hour.limit
      },
      day: {
        used: stats.day.used,
        limit: stats.day.limit
      }
    }
  }

  /**
   * Reset rate limits for a user (useful for testing or manual intervention)
   */
  async resetLimits(
    userId: string,
    model?: AIModel,
    userTier?: UserTier
  ): Promise<void> {
    await aiRateLimiter.resetLimits(userId, model, userTier)
  }

  /**
   * Get remaining quota for a user
   */
  async getRemainingQuota(
    model: AIModel,
    userId: string,
    userTier: UserTier = 'free'
  ): Promise<number> {
    return await aiRateLimiter.getRemainingQuota(userId, model, userTier)
  }

  /**
   * Track actual token usage after a successful API call
   * @param model The AI model that was used
   * @param userId The user who made the request
   * @param tokensUsed The actual number of tokens consumed
   * @param userTier The user's subscription tier
   */
  async trackTokenUsage(
    model: AIModel,
    userId: string,
    tokensUsed: number,
    userTier: UserTier = 'free'
  ): Promise<void> {
    await aiRateLimiter.trackTokenUsage(userId, model, tokensUsed, userTier)
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()