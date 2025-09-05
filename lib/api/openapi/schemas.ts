import { z } from 'zod'
import { 
  OpenAPIRoute, 
  OpenAPIParameter, 
  OpenAPIResponse 
} from '../types'

// Re-export common schemas from validation
export * from '../validation'

/**
 * OpenAPI component schemas
 */
export const openAPISchemas = {
  // Error response schema
  Error: z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.any()).optional()
    }),
    metadata: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      version: z.string()
    })
  }),
  
  // Success response wrapper
  SuccessResponse: z.object({
    success: z.literal(true),
    data: z.any(),
    metadata: z.object({
      requestId: z.string(),
      timestamp: z.string(),
      version: z.string(),
      deprecation: z.object({
        deprecated: z.boolean(),
        sunsetDate: z.string().optional(),
        alternativeVersion: z.string().optional(),
        migrationGuide: z.string().optional()
      }).optional(),
      rateLimit: z.object({
        limit: z.number(),
        remaining: z.number(),
        reset: z.number(),
        retryAfter: z.number().optional()
      }).optional()
    })
  }),
  
  // Pagination schema
  Pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalItems: z.number(),
    totalPages: z.number()
  }),
  
  // API Key schemas
  APIKey: z.object({
    id: z.string().uuid(),
    name: z.string(),
    prefix: z.string(),
    scopes: z.array(z.string()),
    created_at: z.string().datetime(),
    expires_at: z.string().datetime().nullable(),
    last_used_at: z.string().datetime().nullable(),
    is_active: z.boolean()
  }),
  
  CreateAPIKey: z.object({
    name: z.string().min(1).max(100),
    scopes: z.array(z.enum([
      'enhance:read',
      'enhance:write',
      'enhance:delete',
      'webhooks:read',
      'webhooks:write',
      'webhooks:delete'
    ])),
    expiresIn: z.number().min(1).max(365).optional()
  }),
  
  // Webhook schemas
  Webhook: z.object({
    id: z.string().uuid(),
    url: z.string().url(),
    events: z.array(z.string()),
    secret: z.string(),
    is_active: z.boolean(),
    headers: z.record(z.string()).optional(),
    retry_policy: z.object({
      max_attempts: z.number(),
      initial_delay_ms: z.number(),
      backoff_multiplier: z.number(),
      max_delay_ms: z.number()
    }),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime()
  }),
  
  CreateWebhook: z.object({
    url: z.string().url(),
    events: z.array(z.enum([
      'enhancement.started',
      'enhancement.progress',
      'enhancement.completed',
      'enhancement.failed',
      'document.uploaded',
      'document.analyzed',
      'export.completed'
    ])),
    headers: z.record(z.string()).optional(),
    retry_policy: z.object({
      max_attempts: z.number().min(1).max(10).default(3),
      initial_delay_ms: z.number().min(100).max(10000).default(1000),
      backoff_multiplier: z.number().min(1).max(5).default(2),
      max_delay_ms: z.number().min(1000).max(60000).default(30000)
    }).optional()
  }),
  
  // Enhancement schemas
  Enhancement: z.object({
    id: z.string(),
    documentId: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    progress: z.number().min(0).max(100),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    enhancedUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    improvements: z.object({
      before: z.number(),
      after: z.number()
    }).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.any()).optional()
    }).optional()
  }),
  
  // Health check schema
  HealthCheck: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    timestamp: z.string().datetime(),
    uptime: z.number(),
    checks: z.array(z.object({
      name: z.string(),
      status: z.enum(['healthy', 'unhealthy']),
      message: z.string().optional(),
      details: z.record(z.any()).optional()
    })),
    circuitBreakers: z.record(z.object({
      status: z.enum(['closed', 'open', 'half-open']),
      failures: z.number(),
      successes: z.number(),
      lastFailureTime: z.number().optional(),
      nextAttemptTime: z.number().optional()
    })).optional()
  })
}

/**
 * Common OpenAPI parameters
 */
export const commonParameters: Record<string, OpenAPIParameter> = {
  requestId: {
    name: 'X-Request-ID',
    in: 'header',
    required: false,
    schema: { type: 'string', format: 'uuid' },
    description: 'Unique request identifier for tracing'
  },
  apiVersion: {
    name: 'X-API-Version',
    in: 'header',
    required: false,
    schema: { type: 'string', enum: ['v1', 'v2'] },
    description: 'API version to use'
  },
  apiKey: {
    name: 'X-API-Key',
    in: 'header',
    required: true,
    schema: { type: 'string' },
    description: 'API key for authentication'
  },
  page: {
    name: 'page',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
    description: 'Page number for pagination'
  },
  pageSize: {
    name: 'pageSize',
    in: 'query',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    description: 'Number of items per page'
  },
  sortBy: {
    name: 'sortBy',
    in: 'query',
    required: false,
    schema: { type: 'string' },
    description: 'Field to sort by'
  },
  sortOrder: {
    name: 'sortOrder',
    in: 'query',
    required: false,
    schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    description: 'Sort order'
  }
}

/**
 * Common OpenAPI responses
 */
export const commonResponses: Record<string, OpenAPIResponse> = {
  BadRequest: {
    description: 'Bad Request - Invalid input data',
    content: {
      'application/json': {
        schema: openAPISchemas.Error
      }
    }
  },
  Unauthorized: {
    description: 'Unauthorized - Missing or invalid authentication',
    content: {
      'application/json': {
        schema: openAPISchemas.Error
      }
    }
  },
  Forbidden: {
    description: 'Forbidden - Insufficient permissions',
    content: {
      'application/json': {
        schema: openAPISchemas.Error
      }
    }
  },
  NotFound: {
    description: 'Not Found - Resource does not exist',
    content: {
      'application/json': {
        schema: openAPISchemas.Error
      }
    }
  },
  RateLimitExceeded: {
    description: 'Too Many Requests - Rate limit exceeded',
    content: {
      'application/json': {
        schema: openAPISchemas.Error
      }
    },
    headers: {
      'X-RateLimit-Limit': {
        schema: { type: 'integer' },
        description: 'Request limit per time window'
      },
      'X-RateLimit-Remaining': {
        schema: { type: 'integer' },
        description: 'Remaining requests in time window'
      },
      'X-RateLimit-Reset': {
        schema: { type: 'integer' },
        description: 'Unix timestamp when limit resets'
      },
      'Retry-After': {
        schema: { type: 'integer' },
        description: 'Seconds until next request allowed'
      }
    }
  },
  InternalServerError: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: openAPISchemas.Error
      }
    }
  },
  ServiceUnavailable: {
    description: 'Service Unavailable - Circuit breaker open or service down',
    content: {
      'application/json': {
        schema: openAPISchemas.Error
      }
    },
    headers: {
      'Retry-After': {
        schema: { type: 'integer' },
        description: 'Seconds until service available'
      }
    }
  }
}

/**
 * Helper to create OpenAPI route documentation
 */
export function createRouteDoc(
  config: Partial<OpenAPIRoute> & {
    path: string
    method: string
    operationId: string
  }
): OpenAPIRoute {
  return {
    ...config,
    security: config.security || [{ apiKey: [] }],
    responses: {
      ...commonResponses,
      ...config.responses
    }
  }
}