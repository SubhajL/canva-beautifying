import { NextRequest, NextResponse } from 'next/server'
import { createAPIResponse, apiErrors } from '@/lib/api/response'

// Simple in-memory rate limiter for testing
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

interface RateLimitOptions {
  max?: number
  windowMs?: number
  identifier?: string
}

export function withRateLimit(options: RateLimitOptions = {}) {
  return (handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) => {
    return async (request: NextRequest, ...handlerArgs: any[]): Promise<NextResponse> => {
      const {
        max = 100,
        windowMs = 60 * 1000, // 1 minute
        identifier = 'api'
      } = options

      try {
        // Get client IP
        const ip = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
        
        const key = `${identifier}:${ip}`
        const now = Date.now()
        
        // Check existing rate limit
        const existing = rateLimitStore.get(key)
        
        if (existing && existing.resetTime > now) {
          // Still within window
          existing.count++
          
          if (existing.count > max) {
            return createAPIResponse(
              null,
              apiErrors.tooManyRequests('Rate limit exceeded')
            )
          }
        } else {
          // New window
          rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs
          })
        }
        
        const current = rateLimitStore.get(key)!
        
        // Add rate limit headers
        const response = await handler(request, ...handlerArgs)
        response.headers.set('X-RateLimit-Limit', max.toString())
        response.headers.set('X-RateLimit-Remaining', Math.max(0, max - current.count).toString())
        response.headers.set('X-RateLimit-Reset', current.resetTime.toString())
        
        return response
      } catch (error) {
        console.error('Rate limit middleware error:', error)
        // If rate limiting fails, allow request through
        return handler(request, ...handlerArgs)
      }
    }
  }
}