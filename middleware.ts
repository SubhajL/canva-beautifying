import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Rate limit store using Map
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean up expired entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000) // Clean up every minute
}

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
    '/api/stripe/webhook'
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
    const key = `api:${ip}`
    const now = Date.now()
    
    // Rate limit: 100 requests per minute per IP
    const windowMs = 60 * 1000
    const maxRequests = 100
    
    const rateLimitInfo = rateLimitStore.get(key)
    
    if (!rateLimitInfo || rateLimitInfo.resetTime < now) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      })
    } else if (rateLimitInfo.count >= maxRequests) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please try again in ${retryAfter} seconds`,
            details: { retryAfter },
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
            'Retry-After': retryAfter.toString(),
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    } else {
      rateLimitInfo.count++
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