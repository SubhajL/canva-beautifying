import { NextRequest } from 'next/server'
import { CircuitBreaker } from '@/lib/ai/circuit-breaker'
import { APIRequestContext, CircuitBreakerConfig, CircuitBreakerState } from '../types'
import { errorResponse } from '../response'
import { MetricsCollector } from '@/lib/observability'

// Store circuit breakers by name
const circuitBreakers = new Map<string, CircuitBreaker>()

/**
 * Default circuit breaker configurations
 */
const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  api: {
    name: 'api',
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenMaxAttempts: 3,
    monitoringPeriod: 300000, // 5 minutes
    minimumRequests: 10
  },
  enhance: {
    name: 'enhance',
    failureThreshold: 3,
    resetTimeout: 120000, // 2 minutes
    halfOpenMaxAttempts: 2,
    monitoringPeriod: 600000, // 10 minutes
    minimumRequests: 5
  },
  ai: {
    name: 'ai-service',
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds
    halfOpenMaxAttempts: 3,
    monitoringPeriod: 300000, // 5 minutes
    minimumRequests: 10
  }
}

/**
 * Gets or creates a circuit breaker instance
 */
function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    const defaultConfig = DEFAULT_CONFIGS[name] || DEFAULT_CONFIGS.api
    const finalConfig = {
      ...defaultConfig,
      ...config,
      name
    }
    
    const breaker = new CircuitBreaker(
      name,
      finalConfig.failureThreshold,
      finalConfig.resetTimeout,
      finalConfig.halfOpenMaxAttempts
    )
    
    circuitBreakers.set(name, breaker)
  }
  
  return circuitBreakers.get(name)!
}

/**
 * Circuit breaker middleware
 */
export function withCircuitBreaker(
  handler: (req: NextRequest, ctx?: APIRequestContext) => Promise<Response>,
  breakerName: string,
  options: {
    config?: Partial<CircuitBreakerConfig>
    fallbackResponse?: (req: NextRequest) => Promise<Response>
    shouldTripOnError?: (error: unknown) => boolean
    getCacheKey?: (req: NextRequest) => string
  } = {}
) {
  return async (
    request: NextRequest,
    context?: APIRequestContext
  ): Promise<Response> => {
    const breaker = getCircuitBreaker(breakerName, options.config)
    
    // Check if circuit is open
    if (!breaker.canAttempt()) {
      MetricsCollector.getInstance().recordCircuitBreakerTrip(breakerName)
      
      // Try fallback response
      if (options.fallbackResponse) {
        try {
          const fallback = await options.fallbackResponse(request)
          fallback.headers.set('X-Circuit-Breaker', 'open')
          fallback.headers.set('X-Fallback-Response', 'true')
          return fallback
        } catch (fallbackError) {
          console.error('Fallback response failed:', fallbackError)
        }
      }
      
      // Return circuit open error
      const response = errorResponse(
        {
          code: 'CIRCUIT_BREAKER_OPEN',
          message: `Service temporarily unavailable. Circuit breaker is open for ${breakerName}`,
          statusCode: 503,
          details: {
            breakerName,
            resetIn: breaker.getTimeUntilReset()
          }
        },
        { requestId: context?.requestId }
      )
      
      response.headers.set('Retry-After', String(Math.ceil(breaker.getTimeUntilReset() / 1000)))
      return response
    }
    
    try {
      // Execute the handler through circuit breaker
      const response = await breaker.execute(async () => {
        return await handler(request, context)
      })
      
      // Add circuit breaker headers
      response.headers.set('X-Circuit-Breaker', breaker.getState())
      
      // Check if response indicates a failure
      if (response.status >= 500) {
        breaker.recordFailure()
      }
      
      return response
    } catch (error) {
      // Check if we should trip on this error
      if (options.shouldTripOnError && !options.shouldTripOnError(error)) {
        // Don't count this as a circuit breaker failure
        throw error
      }
      
      // Don't trip on rate limit errors
      if (error instanceof Error && error.message.includes('429')) {
        throw error
      }
      
      // Record failure (circuit breaker already does this internally)
      MetricsCollector.getInstance().recordCircuitBreakerFailure(breakerName)
      
      // Try cache fallback if available
      if (options.fallbackResponse && options.getCacheKey) {
        try {
          const fallback = await options.fallbackResponse(request)
          fallback.headers.set('X-Circuit-Breaker', 'fallback')
          fallback.headers.set('X-Cached-Response', 'true')
          return fallback
        } catch (fallbackError) {
          console.error('Cache fallback failed:', fallbackError)
        }
      }
      
      throw error
    }
  }
}

/**
 * Gets the current state of a circuit breaker
 */
export function getCircuitBreakerState(name: string): CircuitBreakerState | null {
  const breaker = circuitBreakers.get(name)
  
  if (!breaker) {
    return null
  }
  
  return {
    status: breaker.getState() as 'closed' | 'open' | 'half-open',
    failures: breaker.getFailureCount(),
    successes: breaker.getSuccessCount(),
    lastFailureTime: breaker.getLastFailureTime(),
    nextAttemptTime: breaker.getState() === 'open' 
      ? Date.now() + breaker.getTimeUntilReset()
      : undefined
  }
}

/**
 * Gets states of all circuit breakers
 */
export function getAllCircuitBreakerStates(): Record<string, CircuitBreakerState> {
  const states: Record<string, CircuitBreakerState> = {}
  
  for (const [name, breaker] of circuitBreakers) {
    states[name] = {
      status: breaker.getState() as 'closed' | 'open' | 'half-open',
      failures: breaker.getFailureCount(),
      successes: breaker.getSuccessCount(),
      lastFailureTime: breaker.getLastFailureTime(),
      nextAttemptTime: breaker.getState() === 'open' 
        ? Date.now() + breaker.getTimeUntilReset()
        : undefined
    }
  }
  
  return states
}

/**
 * Resets a circuit breaker
 */
export function resetCircuitBreaker(name: string): void {
  const breaker = circuitBreakers.get(name)
  if (breaker) {
    breaker.reset()
  }
}

/**
 * Pre-configured circuit breakers for common endpoints
 */
export const endpointCircuitBreakers = {
  enhance: (handler: (req: NextRequest, ctx?: APIRequestContext) => Promise<Response>, options?: Parameters<typeof withCircuitBreaker>[2]) => 
    withCircuitBreaker(handler, 'enhance', options),
  
  ai: (handler: (req: NextRequest, ctx?: APIRequestContext) => Promise<Response>, options?: Parameters<typeof withCircuitBreaker>[2]) => 
    withCircuitBreaker(handler, 'ai', options),
  
  storage: (handler: (req: NextRequest, ctx?: APIRequestContext) => Promise<Response>, options?: Parameters<typeof withCircuitBreaker>[2]) => 
    withCircuitBreaker(handler, 'storage', {
      ...options,
      config: {
        failureThreshold: 3,
        resetTimeout: 60000
      }
    }),
  
  webhook: (handler: (req: NextRequest, ctx?: APIRequestContext) => Promise<Response>, options?: Parameters<typeof withCircuitBreaker>[2]) => 
    withCircuitBreaker(handler, 'webhook', {
      ...options,
      config: {
        failureThreshold: 10,
        resetTimeout: 30000
      }
    })
}