/**
 * Secure API Client
 * Handles API requests with keys in headers, not URLs
 */

// No imports needed for now, will add when required

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  maxRetries?: number
  retryDelay?: number
}

export interface SecureRequestOptions extends RequestOptions {
  apiKey: string
  provider: 'openai' | 'anthropic' | 'gemini' | 'replicate' | 'dalle'
  followRedirects?: boolean
  validateHost?: boolean
  maxResponseSize?: number
}

export class SecureAPIClient {
  private static readonly DEFAULT_TIMEOUT = 30000
  private static readonly DEFAULT_MAX_RETRIES = 3
  private static readonly DEFAULT_RETRY_DELAY = 1000
  private static readonly MAX_REQUEST_BODY_SIZE = 5 * 1024 * 1024 // 5MB
  private static readonly MAX_RESPONSE_SIZE = 10 * 1024 * 1024 // 10MB

  /**
   * Sanitize error messages to remove sensitive data
   */
  private static sanitizeError(error: Error): Error {
    let message = error.message
    
    // Common API key patterns to redact
    const apiKeyPatterns = [
      /sk-[a-zA-Z0-9]{20,}/g,
      /sk-ant-[a-zA-Z0-9]{20,}/g,
      /AI[a-zA-Z0-9]{35,}/g,
      /r8_[a-zA-Z0-9]{37}/g,
      /Bearer [a-zA-Z0-9-_]+/g,
      /Token [a-zA-Z0-9-_]+/g,
      /key[=:]\s*[a-zA-Z0-9-_]+/gi,
      /api[_-]?key[=:]\s*[a-zA-Z0-9-_]+/gi
    ]
    
    for (const pattern of apiKeyPatterns) {
      message = message.replace(pattern, '[REDACTED]')
    }
    
    const sanitizedError = new Error(message)
    sanitizedError.stack = error.stack
    return sanitizedError
  }

  /**
   * Sanitize headers to prevent injection attacks
   */
  private static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {}
    
    for (const [key, value] of Object.entries(headers)) {
      // Remove any newline characters to prevent header injection
      const cleanKey = key.replace(/[\r\n]/g, '')
      const cleanValue = value.replace(/[\r\n]/g, '')
      
      // Skip Host header override attempts
      if (cleanKey.toLowerCase() === 'host') {
        continue
      }
      
      sanitized[cleanKey] = cleanValue
    }
    
    return sanitized
  }

  /**
   * Validate and sanitize request body
   */
  private static sanitizeBody(body: any): string {
    // Create a clean object without prototype pollution
    if (body && typeof body === 'object') {
      const clean = Object.create(null)
      
      // Copy only own properties, excluding dangerous keys
      for (const [key, value] of Object.entries(body)) {
        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
          clean[key] = value
        }
      }
      
      body = clean
    }
    
    const serialized = JSON.stringify(body)
    
    // Check body size
    const bodySize = Buffer.byteLength(serialized)
    if (bodySize > this.MAX_REQUEST_BODY_SIZE) {
      throw new Error('Request body too large')
    }
    
    return serialized
  }

  /**
   * Create secure headers with API key
   */
  static createSecureHeaders(apiKey: string, provider: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': this.generateRequestId(),
    }

    // Provider-specific authentication headers
    switch (provider) {
      case 'openai':
      case 'dalle':
        headers['Authorization'] = `Bearer ${apiKey}`
        break
      case 'anthropic':
        headers['X-API-Key'] = apiKey
        headers['anthropic-version'] = '2023-06-01'
        break
      case 'gemini':
        headers['X-API-Key'] = apiKey
        break
      case 'replicate':
        headers['Authorization'] = `Token ${apiKey}`
        break
      default:
        // Default to Authorization Bearer
        headers['Authorization'] = `Bearer ${apiKey}`
    }

    return this.sanitizeHeaders(headers)
  }

  /**
   * Make secure API request with retries and error handling
   */
  static async request(options: SecureRequestOptions): Promise<Response> {
    const {
      url,
      method = 'POST',
      headers = {},
      body,
      timeout = this.DEFAULT_TIMEOUT,
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      apiKey,
      provider,
      followRedirects = false,
      validateHost = false,
      maxResponseSize = this.MAX_RESPONSE_SIZE,
    } = options

    // Apply rate limiting
    const rateLimitKey = `${provider}:${apiKey.substring(0, 8)}`
    this.checkRateLimit(rateLimitKey)

    // Validate URL doesn't contain API key (except for Gemini which requires it)
    if (provider !== 'gemini' && (url.includes('key=') || url.includes('api_key=') || url.includes('apikey='))) {
      throw new Error('API key detected in URL. Use headers instead.')
    }
    
    // Special handling for Gemini - add key to URL
    let finalUrl = url;
    if (provider === 'gemini') {
      const urlObj = new URL(url);
      urlObj.searchParams.set('key', apiKey);
      finalUrl = urlObj.toString();
    }

    // Create secure headers with sanitization
    const secureHeaders = {
      ...this.createSecureHeaders(apiKey, provider),
      ...this.sanitizeHeaders(headers),
    }

    // Validate SSL in production
    if (process.env.NODE_ENV === 'production' && !finalUrl.startsWith('https://')) {
      throw new Error('HTTPS required in production')
    }

    // Validate host if requested (DNS rebinding prevention)
    if (validateHost) {
      const urlObj = new URL(finalUrl)
      const hostname = urlObj.hostname
      
      // Check for private IP ranges
      const privateIPPatterns = [
        /^127\./,           // 127.0.0.0/8
        /^10\./,            // 10.0.0.0/8
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
        /^192\.168\./,      // 192.168.0.0/16
        /^::1$/,            // IPv6 localhost
        /^fe80:/i,          // IPv6 link-local
      ]
      
      for (const pattern of privateIPPatterns) {
        if (pattern.test(hostname)) {
          throw new Error(`DNS resolved to private IP: ${hostname}`)
        }
      }
    }

    let lastError: Error | null = null
    
    // Retry logic with exponential backoff
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create new controller for each attempt
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        
        const requestOptions: RequestInit = {
          method,
          headers: secureHeaders,
          signal: controller.signal,
          redirect: followRedirects ? 'follow' : 'manual',
        }

        if (body) {
          requestOptions.body = this.sanitizeBody(body)
        }

        try {
          const response = await fetch(finalUrl, requestOptions)
          clearTimeout(timeoutId)

          if (!response) {
            throw new Error('No response received')
          }

          // Check for insecure redirects
          if (response.type === 'opaqueredirect' || response.status === 301 || response.status === 302) {
            const location = response.headers.get('location')
            if (location && process.env.NODE_ENV === 'production' && !location.startsWith('https://')) {
              throw new Error('Redirect to insecure HTTP blocked')
            }
          }

          // Validate content type - block HTML responses from API endpoints
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('text/html') && !contentType.includes('application/json')) {
            throw new Error(`Unexpected content type: ${contentType}`)
          }

          // Check response size
          const contentLength = response.headers.get('content-length')
          if (contentLength && parseInt(contentLength) > maxResponseSize) {
            throw new Error('Response size exceeds limit')
          }

          // Don't retry on client errors
          if (response.status >= 400 && response.status < 500) {
            return response
          }

          // Success
          if (response.ok) {
            return response
          }

          // Server error - retry
          if (response.status >= 500 && attempt < maxRetries) {
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
            await this.delay(retryDelay * Math.pow(2, attempt))
            continue
          }

          return response
        } catch (error) {
          clearTimeout(timeoutId)
          throw error
        }
      } catch (error) {
        const sanitizedError = this.sanitizeError(error as Error)
        lastError = sanitizedError

        // Check if aborted
        if (error.name === 'AbortError') {
          throw this.sanitizeError(new Error(`Request timeout after ${timeout}ms`))
        }

        // Don't retry on non-retryable errors
        if (
          error instanceof TypeError ||
          error.message?.includes('SSL') ||
          error.message?.includes('certificate')
        ) {
          throw sanitizedError
        }

        // Last attempt
        if (attempt === maxRetries) {
          throw sanitizedError
        }

        // Exponential backoff
        await this.delay(retryDelay * Math.pow(2, attempt))
      }
    }

    throw this.sanitizeError(lastError || new Error('Request failed after retries'))
  }

  /**
   * Generate unique request ID for tracing
   */
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Delay helper for retries
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Rate limiting map to track requests
   */
  private static rateLimitMap = new Map<string, number[]>()
  private static readonly RATE_LIMIT_WINDOW = 60000 // 1 minute
  private static readonly RATE_LIMIT_MAX_REQUESTS = 100
  private static readonly MIN_REQUEST_INTERVAL = 50 // 50ms between requests

  /**
   * Check rate limit for a key
   */
  private static checkRateLimit(key: string): void {
    const now = Date.now()
    const requests = this.rateLimitMap.get(key) || []
    
    // Clean old requests outside the window
    const validRequests = requests.filter(time => now - time < this.RATE_LIMIT_WINDOW)
    
    // Check if we're at the limit
    if (validRequests.length >= this.RATE_LIMIT_MAX_REQUESTS) {
      throw new Error('Rate limit exceeded')
    }
    
    // Check minimum interval between requests
    if (validRequests.length > 0) {
      const lastRequest = validRequests[validRequests.length - 1]
      if (now - lastRequest < this.MIN_REQUEST_INTERVAL) {
        // Add small delay to prevent rapid-fire requests
        const delay = this.MIN_REQUEST_INTERVAL - (now - lastRequest)
        const start = performance.now()
        while (performance.now() - start < delay) {
          // Busy wait to enforce minimum interval
        }
      }
    }
    
    // Add current request
    validRequests.push(now)
    this.rateLimitMap.set(key, validRequests)
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }
    
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    
    return result === 0
  }

  /**
   * Validate API key format with constant-time comparison
   */
  static validateApiKey(apiKey: string, provider: string): boolean {
    // Add small random delay to prevent timing analysis
    const delay = Math.random() * 2
    const start = performance.now()
    while (performance.now() - start < delay) {
      // Busy wait
    }
    
    let expectedPrefix = ''
    let minLength = 20
    
    switch (provider) {
      case 'openai':
      case 'dalle':
        expectedPrefix = 'sk-'
        break
      case 'anthropic':
        expectedPrefix = 'sk-ant-'
        break
      case 'gemini':
        expectedPrefix = 'AI'
        minLength = 35
        break
      case 'replicate':
        // For replicate, we need exact length check
        if (apiKey.length !== 40) return false
        expectedPrefix = 'r8_'
        break
      default:
        // No prefix check for unknown providers
        return apiKey.length > minLength
    }
    
    // Check length first (not timing sensitive)
    if (apiKey.length <= minLength) {
      return false
    }
    
    // Use constant-time comparison for prefix
    const prefix = apiKey.substring(0, expectedPrefix.length)
    return this.constantTimeCompare(prefix, expectedPrefix)
  }

  /**
   * Strip API key from URL if present (for migration)
   */
  static stripApiKeyFromUrl(url: string): string {
    const urlObj = new URL(url)
    urlObj.searchParams.delete('key')
    urlObj.searchParams.delete('api_key')
    urlObj.searchParams.delete('apikey')
    return urlObj.toString()
  }
}