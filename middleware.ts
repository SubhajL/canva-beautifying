import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { rateLimiters, MiddlewareRateLimiter } from '@/lib/redis/middleware-rate-limiter'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 1. HTTPS Enforcement (in production)
  if (process.env.NODE_ENV === 'production') {
    const proto = request.headers.get('x-forwarded-proto')
    if (proto !== 'https') {
      return NextResponse.redirect(
        `https://${request.headers.get('host')}${request.nextUrl.pathname}${request.nextUrl.search}`,
        301
      )
    }
  }
  
  // Create response with security headers
  const response = NextResponse.next()
  
  // 2. Security Headers
  if (!pathname.includes('.')) { // Don't add headers to static assets
    // HSTS - Enforce HTTPS
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
    
    // Prevent clickjacking
    response.headers.set('X-Frame-Options', 'DENY')
    
    // Prevent MIME type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff')
    
    // Enable XSS protection
    response.headers.set('X-XSS-Protection', '1; mode=block')
    
    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // Permissions policy
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    )
    
    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ')
    
    response.headers.set('Content-Security-Policy', csp)
  }
  
  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/demo',
    '/forgot-password',
    '/auth/callback',
    '/auth/error',
    '/auth/reset-password'
  ]
  
  // API routes that don't require authentication
  const publicApiRoutes = [
    '/api/auth',
    '/api/webhook',
    '/api/stripe/webhook',
    '/api/docs'
  ]
  
  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))
  const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route))
  const isStaticAsset = pathname.includes('.')
  
  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400')
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: response.headers })
    }
  }
  
  // Apply rate limiting to API v1 endpoints
  if (pathname.startsWith('/api/v1/')) {
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'anonymous'
    const identifier = `api:${ip}`
    
    try {
      // Use Redis-based rate limiter
      const result = await rateLimiters.api.checkLimit(identifier)
      
      // Add rate limit headers to response
      const rateLimitHeaders = rateLimiters.api.getRateLimitHeaders(result)
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        response.headers.set(key, value as string)
      })
      
      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Too many requests. Please try again in ${result.retryAfter} seconds`,
              details: { retryAfter: result.retryAfter },
            },
            meta: {
              timestamp: new Date().toISOString(),
              version: 'v1',
            },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': result.retryAfter?.toString() || '60',
              'Access-Control-Allow-Origin': '*',
              ...rateLimitHeaders
            },
          }
        )
      }
    } catch (error) {
      // Log error but don't block requests if rate limiting fails
      console.error('Rate limiting error:', error)
    }
  }
  
  // Apply stricter rate limiting to auth endpoints
  if (pathname.startsWith('/api/auth') || pathname === '/login' || pathname === '/signup') {
    const ip = request.headers.get('x-forwarded-for') || request.ip || 'anonymous'
    const identifier = `auth:${ip}`
    
    try {
      const result = await rateLimiters.auth.checkLimit(identifier)
      
      if (!result.allowed) {
        // For auth endpoints, show a user-friendly error page
        if (pathname === '/login' || pathname === '/signup') {
          const errorUrl = new URL('/auth/error', request.url)
          errorUrl.searchParams.set('error', 'rate_limit')
          errorUrl.searchParams.set('retry_after', result.retryAfter?.toString() || '60')
          return NextResponse.redirect(errorUrl, 307)
        }
        
        // For API auth endpoints
        return new Response(
          JSON.stringify({
            error: 'Too many authentication attempts. Please try again later.',
            retryAfter: result.retryAfter
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': result.retryAfter?.toString() || '60'
            }
          }
        )
      }
    } catch (error) {
      console.error('Auth rate limiting error:', error)
    }
  }
  
  // Apply rate limiting to upload endpoints
  if (pathname.startsWith('/api/upload') || pathname === '/api/v1/enhance') {
    const authHeader = request.headers.get('authorization')
    const userId = authHeader ? authHeader.replace('Bearer ', '').substring(0, 8) : 'anonymous'
    const identifier = `upload:${userId}`
    
    try {
      const result = await rateLimiters.upload.checkLimit(identifier)
      
      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
              message: 'Upload rate limit exceeded. Please wait before uploading more files.',
              details: { retryAfter: result.retryAfter }
            }
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': result.retryAfter?.toString() || '60'
            }
          }
        )
      }
    } catch (error) {
      console.error('Upload rate limiting error:', error)
    }
  }
  
  // Allow public routes and static assets
  if (isPublicRoute || isPublicApiRoute || isStaticAsset) {
    return response
  }
  
  try {
    // Update session and check authentication for protected routes
    const sessionResponse = await updateSession(request)
    
    // Copy session headers to our security-enhanced response
    sessionResponse.headers.forEach((value, key) => {
      if (!response.headers.has(key)) {
        response.headers.set(key, value)
      }
    })
    
    // Also copy cookies from session response
    const setCookieHeader = sessionResponse.headers.get('set-cookie')
    if (setCookieHeader) {
      response.headers.set('set-cookie', setCookieHeader)
    }
    
    // Check if user is authenticated by looking for session cookie
    const hasSession = request.cookies.has('sb-access-token') || 
                      request.cookies.has('sb-refresh-token')
    
    // Redirect to login if accessing protected route without session
    if (pathname.startsWith('/app') && !hasSession) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }
    
    return response
  } catch (error) {
    console.error('Middleware error:', error)
    // Redirect to login on error for protected routes
    if (pathname.startsWith('/app')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need auth
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}