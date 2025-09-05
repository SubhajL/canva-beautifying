import { NextRequest } from 'next/server'
import { User } from '@supabase/supabase-js'

// API Versions
export type APIVersion = 'v1' | 'v2'
export type APIStatus = 'stable' | 'beta' | 'deprecated'

// API Key Types
export interface APIKey {
  id: string
  key_hash: string
  name: string
  prefix: string
  user_id: string
  scopes: APIKeyScope[]
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  is_active: boolean
  metadata?: Record<string, unknown>
}

export type APIKeyScope = 
  | 'enhance:read'
  | 'enhance:write'
  | 'enhance:delete'
  | 'webhooks:read'
  | 'webhooks:write'
  | 'webhooks:delete'
  | 'admin:all'

export interface APIKeyAuth {
  apiKey: APIKey
  userId: string
  scopes: APIKeyScope[]
}

// Rate Limiting Types
export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (req: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  handler?: (req: NextRequest) => Response
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

// Webhook Types
export interface WebhookConfig {
  id: string
  user_id: string
  url: string
  events: WebhookEventType[]
  secret: string
  is_active: boolean
  retry_policy: WebhookRetryPolicy
  headers?: Record<string, string>
  created_at: string
  updated_at: string
}

export type WebhookEventType = 
  | 'enhancement.started'
  | 'enhancement.progress' 
  | 'enhancement.completed'
  | 'enhancement.failed'
  | 'document.uploaded'
  | 'document.analyzed'
  | 'export.completed'

export interface WebhookRetryPolicy {
  max_attempts: number
  initial_delay_ms: number
  backoff_multiplier: number
  max_delay_ms: number
}

export interface WebhookDeliveryLog {
  id: string
  webhook_id: string
  event_type: WebhookEventType
  payload: unknown
  attempt_count: number
  status_code?: number
  response?: string
  error?: string
  delivered_at?: string
  next_retry_at?: string
  created_at: string
}

// Circuit Breaker Types
export interface CircuitBreakerConfig {
  name: string
  failureThreshold: number
  resetTimeout: number
  halfOpenMaxAttempts?: number
  monitoringPeriod?: number
  minimumRequests?: number
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open'
  failures: number
  successes: number
  lastFailureTime?: number
  nextAttemptTime?: number
}

// Request Context
export interface APIRequestContext {
  version: APIVersion
  requestId: string
  user?: User
  apiKey?: APIKeyAuth
  startTime: number
  metadata?: Record<string, unknown>
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: APIError
  metadata: APIResponseMetadata
}

export interface APIError {
  code: string
  message: string
  details?: Record<string, any>
  statusCode: number
}

export interface APIResponseMetadata {
  requestId: string
  timestamp: string
  version: APIVersion
  deprecation?: DeprecationInfo
  rateLimit?: RateLimitInfo
}

export interface DeprecationInfo {
  deprecated: boolean
  sunsetDate?: string
  alternativeVersion?: string
  migrationGuide?: string
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

// Middleware Types
export type APIMiddleware = (
  request: NextRequest,
  context?: APIRequestContext
) => Promise<Response | void>

export interface MiddlewareOptions {
  skipAuth?: boolean
  rateLimit?: RateLimitConfig
  circuitBreaker?: CircuitBreakerConfig
  requiredScopes?: APIKeyScope[]
}

// Validation Types
export interface ValidationOptions {
  schema: unknown // Zod schema
  source: 'body' | 'query' | 'params'
  errorHandler?: (errors: unknown) => APIError
}

// OpenAPI Types
export interface OpenAPIRoute {
  path: string
  method: string
  operationId: string
  summary?: string
  description?: string
  tags?: string[]
  security?: OpenAPISecurity[]
  parameters?: OpenAPIParameter[]
  requestBody?: OpenAPIRequestBody
  responses: Record<string, OpenAPIResponse>
}

export interface OpenAPISecurity {
  apiKey: string[]
}

export interface OpenAPIParameter {
  name: string
  in: 'path' | 'query' | 'header'
  required?: boolean
  schema: unknown
  description?: string
}

export interface OpenAPIRequestBody {
  required?: boolean
  content: Record<string, { schema: unknown }>
}

export interface OpenAPIResponse {
  description: string
  content?: Record<string, { schema: unknown }>
  headers?: Record<string, { schema: unknown; description?: string }>
}