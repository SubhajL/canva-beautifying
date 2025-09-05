import { NextRequest, NextResponse } from 'next/server'
import { apiErrors } from '../response'

// API key patterns to detect
const API_KEY_PATTERNS = [
  // Common query parameter names
  /[?&](api_?key|apikey|key|token|auth|authorization|access_?token|secret)=/i,
  
  // Specific API key formats
  /bai_[a-f0-9]{64}/i, // Our API key format
  /sk_live_[a-zA-Z0-9]+/i, // Stripe format
  /pk_live_[a-zA-Z0-9]+/i, // Stripe format
  /Bearer\s+[a-zA-Z0-9\-_.]+/i, // Bearer tokens
  /Basic\s+[a-zA-Z0-9+/]+=*/i, // Basic auth
  
  // Generic patterns
  /[?&][a-zA-Z_]*key[a-zA-Z_]*=[a-zA-Z0-9\-_]{20,}/i,
]

// Headers that might leak API keys
const SENSITIVE_HEADERS = [
  'referer',
  'x-forwarded-for',
  'x-real-ip',
  'x-forwarded-proto',
]

export interface SecurityEvent {
  type: 'api_key_in_url' | 'api_key_in_header' | 'suspicious_pattern'
  severity: 'low' | 'medium' | 'high' | 'critical'
  url: string
  method: string
  userAgent?: string
  ip?: string
  timestamp: string
  details?: Record<string, any>
}

/**
 * Detect potential API keys in URLs
 */
export function detectApiKeyInUrl(url: string): boolean {
  return API_KEY_PATTERNS.some(pattern => pattern.test(url))
}

/**
 * Detect potential API keys in request
 */
export function detectInsecureApiKeyUsage(request: NextRequest): SecurityEvent | null {
  const url = request.url
  const method = request.method
  
  // Check URL for API keys
  if (detectApiKeyInUrl(url)) {
    return {
      type: 'api_key_in_url',
      severity: 'critical',
      url,
      method,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
      timestamp: new Date().toISOString(),
      details: {
        queryParams: Object.fromEntries(new URL(url).searchParams)
      }
    }
  }
  
  // Check sensitive headers for API keys
  for (const header of SENSITIVE_HEADERS) {
    const value = request.headers.get(header)
    if (value && API_KEY_PATTERNS.some(pattern => pattern.test(value))) {
      return {
        type: 'api_key_in_header',
        severity: 'high',
        url,
        method,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
        timestamp: new Date().toISOString(),
        details: {
          header,
          value: value.substring(0, 10) + '...' // Truncate for security
        }
      }
    }
  }
  
  return null
}

/**
 * Security detection middleware
 */
export async function securityDetectionMiddleware(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Detect security issues
  const securityEvent = detectInsecureApiKeyUsage(request)
  
  if (securityEvent) {
    // Log security event
    console.error('[SECURITY EVENT]', JSON.stringify(securityEvent, null, 2))
    
    // For critical issues, reject the request
    if (securityEvent.severity === 'critical' && securityEvent.type === 'api_key_in_url') {
      throw apiErrors.INSECURE_API_KEY_USAGE
    }
  }
  
  // Continue with request
  return handler(request)
}

/**
 * Log security event to monitoring system
 */
export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  // In production, this would send to a security monitoring service
  // For now, we'll just log to console with structured format
  
  const logData = {
    '@timestamp': event.timestamp,
    'event.category': 'security',
    'event.type': event.type,
    'event.severity': event.severity,
    'http.request.method': event.method,
    'url.full': event.url,
    'user_agent.original': event.userAgent,
    'source.ip': event.ip,
    ...event.details
  }
  
  console.error('[SECURITY LOG]', JSON.stringify(logData))
  
  // TODO: Send to monitoring service (Datadog, Sentry, etc.)
}

/**
 * Sanitize URLs in logs to prevent key exposure
 */
export function sanitizeUrl(url: string): string {
  let sanitized = url
  
  // Replace any detected API keys with [REDACTED]
  API_KEY_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), (match) => {
      // For query parameters, replace the value
      if (match.includes('=')) {
        const [param] = match.split('=')
        return `${param}=[REDACTED]`
      }
      // For other patterns (e.g., Bearer tokens), replace the whole thing
      return '[REDACTED]'
    })
  })
  
  return sanitized
}

/**
 * Check if request is from a known bot/scanner
 */
export function isSecurityScanner(userAgent: string | null): boolean {
  if (!userAgent) return false
  
  const scannerPatterns = [
    /nuclei/i,
    /sqlmap/i,
    /nikto/i,
    /burp/i,
    /owasp/i,
    /security\s*scan/i,
    /vulnerability\s*scan/i,
  ]
  
  return scannerPatterns.some(pattern => pattern.test(userAgent))
}