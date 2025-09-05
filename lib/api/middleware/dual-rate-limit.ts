import { NextRequest } from 'next/server'
import { DualRateLimiter, DUAL_TIER_LIMITS, DualRateLimitConfig } from '@/lib/redis/dual-rate-limiter'
import { AuthResult } from '../auth'
import { APIRequestContext, RateLimitInfo } from '../types'
import { errorResponse, ApiError } from '../response'
import { createClient } from '@/lib/supabase/server'

// Cache rate limiters by tier to avoid recreating
const rateLimiterCache = new Map<string, DualRateLimiter>()

/**
 * Get or create a dual rate limiter for a tier
 */
function getRateLimiterForTier(tier: string): DualRateLimiter {
  const cacheKey = tier
  
  if (!rateLimiterCache.has(cacheKey)) {
    const config = DUAL_TIER_LIMITS[tier] || DUAL_TIER_LIMITS.anonymous
    const limiter = new DualRateLimiter(config)
    rateLimiterCache.set(cacheKey, limiter)
  }
  
  return rateLimiterCache.get(cacheKey)!
}

/**
 * Extract client IP from request
 */
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         request.headers.get('x-real-ip') || 
         request.headers.get('cf-connecting-ip') || // Cloudflare
         request.headers.get('x-client-ip') ||
         'unknown'
}

/**
 * Get user tier from auth context
 */
async function getUserTier(auth?: AuthResult): Promise<string> {
  if (!auth) return 'anonymous'
  
  if (auth.type === 'api-key') {
    // API keys get tier from metadata
    return auth.auth.apiKey.metadata?.tier || 'basic'
  } else {
    // JWT users get tier from profile
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', auth.userId)
      .single()
    
    return profile?.subscription_tier || 'free'
  }
}

/**
 * Dual rate limit middleware that enforces both user and IP limits
 * Prevents authenticated users from bypassing rate limits
 */
export function withDualRateLimit(
  handler: (req: NextRequest, ctx?: APIRequestContext) => Promise<Response>,
  options?: {
    endpoint?: string
    customLimits?: Partial<DualRateLimitConfig>
    skipOnError?: boolean
  }
) {
  return async (
    request: NextRequest,
    context?: APIRequestContext
  ): Promise<Response> => {
    const endpoint = options?.endpoint || request.nextUrl.pathname
    const clientIP = getClientIP(request)
    
    // Get auth info from context
    const auth = context?.user ? {
      type: 'jwt' as const,
      user: context.user,
      userId: context.user.id
    } : context?.apiKey ? {
      type: 'api-key' as const,
      auth: {
        apiKey: context.apiKey.apiKey,
        userId: context.apiKey.userId,
        scopes: context.apiKey.scopes
      },
      userId: context.apiKey.userId
    } : undefined
    
    try {
      // Get user tier
      const tier = await getUserTier(auth)
      
      // Get rate limiter for tier
      const rateLimiter = getRateLimiterForTier(tier)
      
      // Check rate limits
      const result = auth
        ? await rateLimiter.checkAuthenticatedLimit(auth.userId, clientIP, endpoint)
        : await rateLimiter.checkAnonymousLimit(clientIP, endpoint)
      
      // Add rate limit info to context
      if (context) {
        context.metadata = {
          ...context.metadata,
          rateLimit: {
            allowed: result.allowed,
            limitType: result.mostRestrictive,
            userLimit: result.userLimit ? {
              limit: result.userLimit.remaining + 1,
              remaining: result.userLimit.remaining,
              reset: Math.floor(result.userLimit.resetAt / 1000),
              retryAfter: result.userLimit.retryAfter
            } as RateLimitInfo : undefined,
            ipLimit: result.ipLimit ? {
              limit: result.ipLimit.remaining + 1,
              remaining: result.ipLimit.remaining,
              reset: Math.floor(result.ipLimit.resetAt / 1000),
              retryAfter: result.ipLimit.retryAfter
            } as RateLimitInfo : undefined
          }
        }
      }
      
      // If rate limit exceeded, return error
      if (!result.allowed) {
        const limitType = result.mostRestrictive
        const details: Record<string, unknown> = {
          limitType,
          tier,
          endpoint
        }
        
        if (result.userLimit && !result.userLimit.allowed) {
          details.userLimitExceeded = true
        }
        if (result.ipLimit && !result.ipLimit.allowed) {
          details.ipLimitExceeded = true
        }
        
        const error = new ApiError(
          'RATE_LIMIT_EXCEEDED',
          `Rate limit exceeded (${limitType} limit)`,
          429,
          details
        )
        
        const response = errorResponse(error, context?.requestId)
        
        // Add rate limit headers
        Object.entries(result.headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
        
        return response
      }
      
      // Call handler
      const response = await handler(request, context)
      
      // Add rate limit headers to successful response
      Object.entries(result.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      return response
      
    } catch (error) {
      // If skipOnError is true and we hit an error checking limits, 
      // allow the request through
      if (options?.skipOnError) {
        console.error('Rate limit check failed, allowing request:', error)
        return handler(request, context)
      }
      
      throw error
    }
  }
}

/**
 * Create endpoint-specific rate limiter with custom limits
 */
export function createDualEndpointRateLimiter(
  endpoint: string,
  customLimits?: Partial<DualRateLimitConfig>
): typeof withDualRateLimit {
  return (handler) => withDualRateLimit(handler, {
    endpoint,
    customLimits
  })
}

/**
 * Pre-configured dual rate limiters for common endpoints
 */
export const dualEndpointRateLimits = {
  enhance: createDualEndpointRateLimiter('enhance'),
  upload: createDualEndpointRateLimiter('upload'),
  auth: createDualEndpointRateLimiter('auth', {
    // Stricter limits for auth endpoints
    authenticated: {
      perUser: { windowMs: 60 * 1000, maxRequests: 10 },
      perIP: { windowMs: 60 * 1000, maxRequests: 20 }
    },
    anonymous: {
      perIP: { windowMs: 60 * 1000, maxRequests: 5 }
    }
  }),
  webhook: createDualEndpointRateLimiter('webhook'),
  apiKey: createDualEndpointRateLimiter('api-key', {
    // Strict limits for API key operations
    authenticated: {
      perUser: { windowMs: 60 * 1000, maxRequests: 5 },
      perIP: { windowMs: 60 * 1000, maxRequests: 10 }
    },
    anonymous: {
      perIP: { windowMs: 60 * 1000, maxRequests: 2 }
    }
  })
}