import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiErrors, ApiError } from './response'
import { User } from '@supabase/supabase-js'

export interface AuthenticatedRequest extends NextRequest {
  user?: User
  userId?: string
  requestId?: string
}

/**
 * Validates the Authorization header and authenticates the user
 */
export async function authenticateRequest(request: NextRequest): Promise<{
  user: User
  userId: string
}> {
  const authorization = request.headers.get('authorization')
  
  if (!authorization) {
    throw apiErrors.UNAUTHORIZED
  }
  
  const [type, token] = authorization.split(' ')
  
  if (type !== 'Bearer' || !token) {
    throw new ApiError('INVALID_AUTH_HEADER', 'Invalid authorization header format', 401)
  }
  
  const supabase = await createClient()
  
  // Verify the token
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    throw apiErrors.INVALID_TOKEN
  }
  
  return { user, userId: user.id }
}

/**
 * Rate limiting implementation using in-memory storage
 * In production, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  maxRequests: number  // Max requests per window
  keyGenerator?: (request: NextRequest) => string  // Custom key generator
  skipSuccessfulRequests?: boolean  // Don't count successful requests
  skipFailedRequests?: boolean  // Don't count failed requests
}

export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<void> {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.headers.get('x-forwarded-for') || req.ip || 'anonymous',
    _skipSuccessfulRequests = false,
    _skipFailedRequests = false,
  } = config
  
  const key = keyGenerator(request)
  const now = Date.now()
  
  // Clean up expired entries
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k)
    }
  }
  
  const rateLimitInfo = rateLimitStore.get(key)
  
  if (!rateLimitInfo || rateLimitInfo.resetTime < now) {
    // Create new rate limit window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return
  }
  
  if (rateLimitInfo.count >= maxRequests) {
    const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000)
    throw new ApiError(
      'RATE_LIMIT_EXCEEDED',
      `Too many requests. Please try again in ${retryAfter} seconds`,
      429,
      { retryAfter }
    )
  }
  
  // Increment counter
  rateLimitInfo.count++
}

/**
 * Per-user rate limiting based on subscription tier
 */
export async function checkUserRateLimit(
  userId: string,
  endpoint: string
): Promise<void> {
  const supabase = await createClient()
  
  // Get user's subscription tier
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single()
  
  const tier = userProfile?.subscription_tier || 'free'
  
  // Define rate limits per tier
  const rateLimits: Record<string, RateLimitConfig> = {
    free: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10 per hour
    basic: { windowMs: 60 * 60 * 1000, maxRequests: 50 }, // 50 per hour
    pro: { windowMs: 60 * 60 * 1000, maxRequests: 200 }, // 200 per hour
    premium: { windowMs: 60 * 60 * 1000, maxRequests: 1000 }, // 1000 per hour
  }
  
  const config = rateLimits[tier]
  const key = `${userId}:${endpoint}`
  
  const now = Date.now()
  const rateLimitInfo = rateLimitStore.get(key)
  
  if (!rateLimitInfo || rateLimitInfo.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return
  }
  
  if (rateLimitInfo.count >= config.maxRequests) {
    const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000)
    throw new ApiError(
      'USER_RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded for your subscription tier (${tier}). Please try again in ${retryAfter} seconds`,
      429,
      { retryAfter, tier, limit: config.maxRequests }
    )
  }
  
  rateLimitInfo.count++
}

/**
 * Validates file upload parameters
 */
export function validateFileUpload(file: File | null): void {
  if (!file) {
    throw new ApiError('NO_FILE', 'No file provided', 400)
  }
  
  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    throw new ApiError(
      'FILE_TOO_LARGE',
      `File size exceeds limit of ${maxSize / 1024 / 1024}MB`,
      400,
      { maxSize, fileSize: file.size }
    )
  }
  
  // Check file type
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ]
  
  if (!allowedTypes.includes(file.type)) {
    throw new ApiError(
      'INVALID_FILE_TYPE',
      'Invalid file type. Supported types: PDF, PNG, JPG, WEBP, PPT, PPTX',
      400,
      { fileType: file.type, allowedTypes }
    )
  }
}

/**
 * Generates a unique request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Middleware to add CORS headers for API responses
 */
export function setCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Max-Age', '86400')
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}