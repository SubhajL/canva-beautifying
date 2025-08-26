# Claude Instance 09: API & Integration Specialist

## Role Overview
You are responsible for updating the API layer to work with the new distributed architecture, implementing enhanced rate limiting, managing webhooks with retry logic, maintaining backward compatibility, and updating client SDKs.

## Core Responsibilities

### 1. API Middleware Updates

**Update Rate Limiting Middleware:**

Update `lib/api/middleware.ts`:

```typescript
import { NextRequest } from 'next/server'
import { RedisRateLimiter } from '@/lib/redis/rate-limiter'
import { redis } from '@/lib/queue/redis'
import { Tracer } from '@/lib/monitoring/tracer'
import { MetricsCollector } from '@/lib/monitoring/metrics'

export interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
  keyGenerator?: (req: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  handler?: (req: NextRequest) => Response
}

export async function withRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  options: RateLimitOptions = {}
) {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    handler: limitHandler = defaultLimitHandler
  } = options
  
  return async (req: NextRequest): Promise<Response> => {
    const span = Tracer.getInstance().startSpan('api.rateLimit', {
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'rate_limit.window_ms': windowMs,
        'rate_limit.max_requests': maxRequests
      }
    })
    
    try {
      const key = keyGenerator(req)
      const rateLimiter = new RedisRateLimiter(redis, { windowMs, maxRequests })
      
      const result = await rateLimiter.checkLimit('api', key)
      
      // Add rate limit headers
      const headers = new Headers({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      })
      
      if (!result.allowed) {
        span.setAttribute('rate_limit.exceeded', true)
        MetricsCollector.getInstance().recordRateLimitExceeded('api', key)
        
        headers.set('Retry-After', result.retryAfter!.toString())
        return limitHandler(req)
      }
      
      // Process request
      const response = await handler(req)
      
      // Skip counting based on response
      if (
        (skipSuccessfulRequests && response.ok) ||
        (skipFailedRequests && !response.ok)
      ) {
        await rateLimiter.decrement('api', key)
      }
      
      // Copy rate limit headers to response
      headers.forEach((value, key) => response.headers.set(key, value))
      
      span.setStatus({ code: SpanStatusCode.OK })
      return response
      
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  }
}

function defaultKeyGenerator(req: NextRequest): string {
  // Try different methods to get client identifier
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const auth = req.headers.get('authorization')
  
  if (auth) {
    // Extract user ID from JWT if available
    try {
      const token = auth.replace('Bearer ', '')
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString()
      )
      return `user:${payload.sub}`
    } catch {}
  }
  
  // Fallback to IP
  return `ip:${forwarded || realIp || req.ip || 'unknown'}`
}

function defaultLimitHandler(req: NextRequest): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        type: 'rate_limit'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}
```

### 2. Enhanced API Endpoints

Create `app/api/v2/enhance/route.ts`:

```typescript
import { withRateLimit } from '@/lib/api/middleware'
import { authenticateRequest } from '@/lib/api/auth'
import { validateRequest } from '@/lib/api/validation'
import { CircuitBreaker } from '@/lib/ai/circuit-breaker'
import { EnhancementCache } from '@/lib/cache/enhancement-cache'
import { aiService } from '@/lib/ai'

const enhancementBreaker = new CircuitBreaker('enhancement-api', {
  failureThreshold: 5,
  resetTimeout: 30000,
  monitoringWindow: 60000,
  halfOpenRequests: 2,
  volumeThreshold: 10
})

export const POST = withRateLimit(
  async (req: NextRequest) => {
    const span = Tracer.getInstance().startSpan('api.enhance.analyze')
    
    try {
      // Authenticate
      const { userId } = await authenticateRequest(req)
      span.setAttribute('user.id', userId)
      
      // Validate request
      const body = await req.json()
      const validation = validateRequest(body, enhancementSchema)
      
      if (!validation.success) {
        return Response.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: validation.errors
          }
        }, { status: 400 })
      }
      
      const { imageUrl, preferences, webhookUrl } = validation.data
      
      // Check cache first
      const cache = new EnhancementCache()
      const cachedResult = await cache.getSimilar(
        imageUrl, // This would be hashed internally
        preferences
      )
      
      if (cachedResult) {
        MetricsCollector.getInstance().recordCacheHit('enhancement', true)
        span.setAttribute('cache.hit', true)
        
        return Response.json({
          success: true,
          data: {
            ...cachedResult,
            cached: true
          },
          meta: {
            requestId: req.headers.get('x-request-id'),
            timestamp: new Date().toISOString(),
            cached: true
          }
        })
      }
      
      MetricsCollector.getInstance().recordCacheHit('enhancement', false)
      
      // Execute with circuit breaker
      const result = await enhancementBreaker.execute(async () => {
        return await aiService.analyzeDocument(imageUrl, {
          documentType: body.documentType,
          userTier: await getUserTier(userId),
          preferences
        }, userId)
      })
      
      // Store in cache
      await cache.set(imageUrl, result, preferences)
      
      // Queue for async processing if webhook provided
      if (webhookUrl) {
        await queueWebhookNotification({
          webhookUrl,
          documentId: result.documentId,
          userId,
          event: 'enhancement.completed'
        })
      }
      
      span.setStatus({ code: SpanStatusCode.OK })
      
      return Response.json({
        success: true,
        data: result,
        meta: {
          requestId: req.headers.get('x-request-id'),
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - span.startTime,
          modelUsed: result.modelUsed
        }
      })
      
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      
      if (error instanceof CircuitBreakerError) {
        return Response.json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Enhancement service is temporarily unavailable',
            type: 'circuit_breaker'
          }
        }, { status: 503 })
      }
      
      return Response.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          type: 'internal'
        }
      }, { status: 500 })
      
    } finally {
      span.end()
    }
  },
  {
    windowMs: 60000, // 1 minute
    maxRequests: 10, // 10 requests per minute for enhancement
    keyGenerator: (req) => {
      // Use user ID for authenticated requests
      const auth = req.headers.get('authorization')
      if (auth) {
        try {
          const token = auth.replace('Bearer ', '')
          const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64').toString()
          )
          return `enhance:${payload.sub}`
        } catch {}
      }
      return `enhance:anonymous`
    }
  }
)
```

### 3. Webhook Management System

Create `lib/api/webhook-manager.ts`:

```typescript
export interface WebhookConfig {
  url: string
  events: WebhookEvent[]
  secret?: string
  retryConfig?: RetryConfig
  headers?: Record<string, string>
}

export interface RetryConfig {
  maxAttempts: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export class WebhookManager {
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2
  }
  
  async sendWebhook(
    config: WebhookConfig,
    event: WebhookEvent,
    data: any
  ): Promise<WebhookResult> {
    const span = Tracer.getInstance().startSpan('webhook.send', {
      attributes: {
        'webhook.url': config.url,
        'webhook.event': event,
        'webhook.retry.max_attempts': config.retryConfig?.maxAttempts || this.defaultRetryConfig.maxAttempts
      }
    })
    
    try {
      const payload = this.buildPayload(event, data)
      const signature = this.generateSignature(payload, config.secret)
      
      const result = await this.sendWithRetry(
        config.url,
        payload,
        {
          ...config.headers,
          'Content-Type': 'application/json',
          'X-BeautifyAI-Event': event,
          'X-BeautifyAI-Signature': signature,
          'X-BeautifyAI-Timestamp': Date.now().toString()
        },
        config.retryConfig || this.defaultRetryConfig,
        span
      )
      
      span.setStatus({ code: SpanStatusCode.OK })
      return result
      
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      
      // Log to webhook failure table
      await this.logWebhookFailure({
        url: config.url,
        event,
        error: error.message,
        payload: data
      })
      
      throw error
    } finally {
      span.end()
    }
  }
  
  private async sendWithRetry(
    url: string,
    payload: any,
    headers: Record<string, string>,
    retryConfig: RetryConfig,
    span: Span
  ): Promise<WebhookResult> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000) // 30s timeout
        })
        
        if (response.ok) {
          return {
            success: true,
            statusCode: response.status,
            attempt,
            responseTime: Date.now() - startTime
          }
        }
        
        // Don't retry 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw new WebhookError(
            `Webhook rejected with status ${response.status}`,
            response.status,
            false // not retriable
          )
        }
        
        lastError = new Error(`HTTP ${response.status}`)
        
      } catch (error) {
        lastError = error as Error
        
        // Don't retry non-retriable errors
        if (error instanceof WebhookError && !error.retriable) {
          throw error
        }
      }
      
      // Calculate delay for next attempt
      if (attempt < retryConfig.maxAttempts) {
        const delay = Math.min(
          retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay
        )
        
        span.addEvent('webhook.retry', {
          'retry.attempt': attempt,
          'retry.delay': delay,
          'retry.error': lastError.message
        })
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw new WebhookError(
      `Webhook failed after ${retryConfig.maxAttempts} attempts: ${lastError.message}`,
      0,
      false
    )
  }
  
  private generateSignature(payload: any, secret?: string): string {
    if (!secret) return ''
    
    const timestamp = Date.now()
    const message = `${timestamp}.${JSON.stringify(payload)}`
    
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex')
  }
  
  async validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string,
    secret: string
  ): boolean {
    // Prevent replay attacks
    const age = Date.now() - parseInt(timestamp)
    if (age > 300000) { // 5 minutes
      return false
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }
}
```

### 4. API Versioning Strategy

Create `lib/api/versioning.ts`:

```typescript
export interface VersionConfig {
  version: string
  deprecated?: boolean
  deprecationDate?: Date
  removalDate?: Date
  migrationGuide?: string
}

export class APIVersionManager {
  private versions: Map<string, VersionConfig> = new Map([
    ['v1', {
      version: 'v1',
      deprecated: true,
      deprecationDate: new Date('2025-03-01'),
      removalDate: new Date('2025-06-01'),
      migrationGuide: 'https://docs.beautifyai.com/api/migration/v1-to-v2'
    }],
    ['v2', {
      version: 'v2',
      deprecated: false
    }]
  ])
  
  negotiateVersion(request: Request): string {
    // Check Accept header for version
    const acceptHeader = request.headers.get('Accept')
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/version=(\w+)/)
      if (versionMatch && this.versions.has(versionMatch[1])) {
        return versionMatch[1]
      }
    }
    
    // Check URL path
    const pathMatch = request.url.match(/\/api\/(\w+)\//)
    if (pathMatch && this.versions.has(pathMatch[1])) {
      return pathMatch[1]
    }
    
    // Default to latest stable version
    return 'v2'
  }
  
  addDeprecationHeaders(response: Response, version: string): void {
    const config = this.versions.get(version)
    if (!config || !config.deprecated) return
    
    response.headers.set('Sunset', config.removalDate!.toISOString())
    response.headers.set('Deprecation', 'true')
    response.headers.set('Link', `<${config.migrationGuide}>; rel="deprecation"`)
    
    // Add warning header
    const daysUntilRemoval = Math.ceil(
      (config.removalDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    
    response.headers.set(
      'Warning',
      `299 - "This API version is deprecated and will be removed in ${daysUntilRemoval} days"`
    )
  }
}
```

### 5. Client SDK Updates

Create `sdk/javascript/src/beautifyai-client.ts`:

```typescript
export interface BeautifyAIConfig {
  apiKey: string
  baseUrl?: string
  version?: string
  retryConfig?: RetryConfig
  webhookSecret?: string
  timeout?: number
}

export class BeautifyAIClient {
  private config: Required<BeautifyAIConfig>
  private rateLimiter: LocalRateLimiter
  private requestCoalescer: RequestCoalescer
  
  constructor(config: BeautifyAIConfig) {
    this.config = {
      baseUrl: 'https://api.beautifyai.com',
      version: 'v2',
      timeout: 30000,
      retryConfig: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
      },
      ...config
    }
    
    this.rateLimiter = new LocalRateLimiter()
    this.requestCoalescer = new RequestCoalescer({
      ttl: 60000,
      maxPending: 100,
      keyGenerator: (args) => JSON.stringify(args)
    })
  }
  
  async analyzeDocument(
    imageUrl: string,
    options?: AnalyzeOptions
  ): Promise<AnalysisResult> {
    // Check local rate limit first
    await this.rateLimiter.checkLimit()
    
    // Coalesce duplicate requests
    return this.requestCoalescer.coalesce(
      async () => {
        const response = await this.request('/enhance/analyze', {
          method: 'POST',
          body: {
            imageUrl,
            ...options
          }
        })
        
        return response.data
      },
      imageUrl,
      options
    )
  }
  
  async enhanceDocument(
    documentId: string,
    preferences: EnhancementPreferences
  ): Promise<EnhancementResult> {
    return this.request('/enhance/process', {
      method: 'POST',
      body: {
        documentId,
        preferences
      }
    })
  }
  
  private async request(
    path: string,
    options: RequestOptions
  ): Promise<any> {
    const url = `${this.config.baseUrl}/api/${this.config.version}${path}`
    
    const response = await this.fetchWithRetry(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': `application/json; version=${this.config.version}`,
        'X-SDK-Version': SDK_VERSION,
        'X-SDK-Language': 'javascript',
        ...options.headers
      },
      timeout: this.config.timeout
    })
    
    // Handle rate limit headers
    const remaining = response.headers.get('X-RateLimit-Remaining')
    if (remaining) {
      this.rateLimiter.updateFromHeaders({
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '100'),
        remaining: parseInt(remaining),
        reset: new Date(response.headers.get('X-RateLimit-Reset') || Date.now())
      })
    }
    
    // Check for deprecation
    if (response.headers.get('Deprecation')) {
      console.warn(
        `API version ${this.config.version} is deprecated. ${response.headers.get('Warning')}`
      )
    }
    
    const data = await response.json()
    
    if (!response.ok) {
      throw new BeautifyAIError(
        data.error?.message || 'Request failed',
        data.error?.code || 'UNKNOWN_ERROR',
        response.status,
        data.error?.details
      )
    }
    
    return data
  }
  
  // Webhook signature validation for server-side use
  validateWebhook(
    payload: string,
    headers: Record<string, string>
  ): boolean {
    if (!this.config.webhookSecret) {
      throw new Error('Webhook secret not configured')
    }
    
    const signature = headers['x-beautifyai-signature']
    const timestamp = headers['x-beautifyai-timestamp']
    
    if (!signature || !timestamp) {
      return false
    }
    
    // Prevent replay attacks
    const age = Date.now() - parseInt(timestamp)
    if (age > 300000) { // 5 minutes
      return false
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex')
    
    return signature === expectedSignature
  }
}

// SDK Error class
export class BeautifyAIError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: any
  ) {
    super(message)
    this.name = 'BeautifyAIError'
  }
}
```

### 6. API Documentation Updates

Create `docs/api/v2/README.md`:

```markdown
# BeautifyAI API v2

## What's New in v2

### Distributed Architecture Support
- Improved rate limiting with Redis backend
- Circuit breaker protection for high availability
- Response caching for repeated requests
- WebSocket support for real-time updates

### Enhanced Features
- Perceptual hash-based similarity matching
- Multi-model AI support with automatic failover
- Batch processing endpoints
- Webhook delivery with retry logic

## Migration from v1

### Breaking Changes

1. **Rate Limit Headers**
   - Old: `X-RateLimit-Remaining-Minute`
   - New: `X-RateLimit-Remaining`

2. **Error Response Format**
   ```json
   // v1
   {
     "error": "Rate limit exceeded",
     "retry_after": 60
   }
   
   // v2
   {
     "success": false,
     "error": {
       "code": "RATE_LIMIT_EXCEEDED",
       "message": "Too many requests, please try again later",
       "type": "rate_limit"
     },
     "meta": {
       "timestamp": "2025-01-26T10:00:00Z"
     }
   }
   ```

3. **Webhook Payload Structure**
   ```json
   // v2 webhook payload
   {
     "event": "enhancement.completed",
     "data": {
       "documentId": "doc_123",
       "enhancementId": "enh_456",
       "status": "completed"
     },
     "timestamp": "2025-01-26T10:00:00Z",
     "webhookId": "whk_789"
   }
   ```

### New Endpoints

#### Batch Processing
```http
POST /api/v2/enhance/batch
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "documents": [
    {
      "imageUrl": "https://example.com/doc1.jpg",
      "preferences": {...}
    },
    {
      "imageUrl": "https://example.com/doc2.jpg",
      "preferences": {...}
    }
  ],
  "webhookUrl": "https://your-app.com/webhook"
}
```

#### Status Check
```http
GET /api/v2/enhance/status/{enhancementId}
Authorization: Bearer {api_key}

Response:
{
  "success": true,
  "data": {
    "id": "enh_456",
    "status": "processing",
    "progress": 65,
    "stages": {
      "analysis": "completed",
      "enhancement": "processing",
      "generation": "pending",
      "export": "pending"
    }
  }
}
```

### Rate Limits by Tier

| Tier    | Requests/min | Requests/hour | Requests/day |
|---------|--------------|---------------|--------------|
| Free    | 10           | 100           | 500          |
| Basic   | 50           | 1,000         | 10,000       |
| Pro     | 200          | 5,000         | 50,000       |
| Premium | 1000         | 20,000        | 200,000      |

### SDK Examples

#### JavaScript/TypeScript
```typescript
import { BeautifyAIClient } from '@beautifyai/sdk'

const client = new BeautifyAIClient({
  apiKey: process.env.BEAUTIFYAI_API_KEY,
  version: 'v2', // Optional, defaults to v2
  retryConfig: {
    maxAttempts: 3,
    initialDelay: 1000
  }
})

// Analyze with caching
const analysis = await client.analyzeDocument(imageUrl, {
  useCache: true,
  preferences: {
    style: 'modern',
    colorScheme: 'vibrant'
  }
})

// Handle webhooks
app.post('/webhook', (req, res) => {
  if (!client.validateWebhook(req.body, req.headers)) {
    return res.status(401).send('Invalid signature')
  }
  
  // Process webhook
  const { event, data } = req.body
  console.log(`Received ${event} for document ${data.documentId}`)
  
  res.status(200).send('OK')
})
```

#### Python
```python
from beautifyai import Client, WebhookHandler

client = Client(
    api_key=os.environ['BEAUTIFYAI_API_KEY'],
    version='v2',
    retry_attempts=3
)

# Batch processing
results = client.enhance_batch([
    {'image_url': url1, 'preferences': {...}},
    {'image_url': url2, 'preferences': {...}}
])

# Webhook handling
webhook_handler = WebhookHandler(
    secret=os.environ['WEBHOOK_SECRET']
)

@app.post('/webhook')
async def handle_webhook(request: Request):
    if not webhook_handler.verify(request):
        raise HTTPException(401, 'Invalid signature')
    
    event = await request.json()
    print(f"Received {event['event']} event")
    return {'status': 'ok'}
```
```

## Testing Strategy

### API Contract Tests

Create `__tests__/api/contract.test.ts`:

```typescript
describe('API v2 Contract Tests', () => {
  it('should maintain backward compatibility for v1 endpoints', async () => {
    // Test that v1 endpoints still work
    const v1Response = await fetch('/api/v1/enhance', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-key'
      },
      body: JSON.stringify({
        imageUrl: 'https://example.com/test.jpg'
      })
    })
    
    expect(v1Response.status).toBe(200)
    expect(v1Response.headers.get('Deprecation')).toBe('true')
    expect(v1Response.headers.get('Sunset')).toBeTruthy()
  })
  
  it('should handle version negotiation correctly', async () => {
    const response = await fetch('/api/enhance', {
      method: 'POST',
      headers: {
        'Accept': 'application/json; version=v2',
        'Authorization': 'Bearer test-key'
      }
    })
    
    expect(response.headers.get('API-Version')).toBe('v2')
  })
})
```

## Coordination with Other Instances

### Instance 1 (State Management)
- Use Redis rate limiter
- Share connection pool
- Coordinate on key patterns

### Instance 2 (AI Resilience)
- Integrate circuit breaker
- Handle fallback responses
- Report service health

### Instance 3 (Caching)
- Check cache before processing
- Implement cache headers
- Handle cache invalidation

### Instance 4 (Observability)
- Add tracing to all endpoints
- Export API metrics
- Monitor response times

## Daily Tasks

### Morning
1. Review API error rates
2. Check deprecation warnings
3. Monitor rate limit violations

### Continuous
1. Update API documentation
2. Respond to integration issues
3. Update client SDKs

### End of Day
1. Generate API usage report
2. Review webhook failures
3. Plan version updates

## Success Criteria

1. **Compatibility:**
- 100% backward compatibility for v1
- Smooth migration path to v2
- Clear deprecation timeline

2. **Performance:**
- < 50ms API response time (cached)
- < 200ms API response time (uncached)
- 99.9% webhook delivery success

3. **Developer Experience:**
- Comprehensive documentation
- SDKs for major languages
- Interactive API explorer

Remember: APIs are contracts. Honor them!