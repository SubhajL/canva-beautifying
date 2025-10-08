// Minimal in-memory dual rate limiter for tests/local

export type DualRateLimitConfig = {
  authenticated: {
    perUser: { windowMs: number; maxRequests: number }
    perIP: { windowMs: number; maxRequests: number }
  }
  anonymous: {
    perIP: { windowMs: number; maxRequests: number }
  }
}

export const DUAL_TIER_LIMITS: Record<string, DualRateLimitConfig> = {
  anonymous: {
    authenticated: { perUser: { windowMs: 60000, maxRequests: 10 }, perIP: { windowMs: 60000, maxRequests: 20 } },
    anonymous: { perIP: { windowMs: 60000, maxRequests: 5 } },
  },
  free: {
    authenticated: { perUser: { windowMs: 60000, maxRequests: 30 }, perIP: { windowMs: 60000, maxRequests: 60 } },
    anonymous: { perIP: { windowMs: 60000, maxRequests: 10 } },
  },
  basic: {
    authenticated: { perUser: { windowMs: 60000, maxRequests: 60 }, perIP: { windowMs: 60000, maxRequests: 120 } },
    anonymous: { perIP: { windowMs: 60000, maxRequests: 10 } },
  },
  pro: {
    authenticated: { perUser: { windowMs: 60000, maxRequests: 120 }, perIP: { windowMs: 60000, maxRequests: 240 } },
    anonymous: { perIP: { windowMs: 60000, maxRequests: 10 } },
  },
}

export class DualRateLimiter {
  constructor(_config: DualRateLimitConfig) {}

  async checkAuthenticatedLimit(userId: string, ip: string, endpoint: string) {
    return this.allow({ type: 'user', id: userId, ip, endpoint })
  }

  async checkAnonymousLimit(ip: string, endpoint: string) {
    return this.allow({ type: 'ip', id: ip, ip, endpoint })
  }

  private allow(_ctx: { type: 'user' | 'ip'; id: string; ip: string; endpoint: string }) {
    return Promise.resolve({
      allowed: true,
      mostRestrictive: 'none',
      userLimit: undefined,
      ipLimit: undefined,
      headers: {
        'X-RateLimit-Limit': '0',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
      },
    })
  }
}

