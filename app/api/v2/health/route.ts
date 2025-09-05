import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api/response'
import { checkSystemHealth } from '@/lib/health/checker'
import { getAllCircuitBreakerStates } from '@/lib/api/middleware/circuit-breaker'
import { APIVersionManager } from '@/lib/api/versioning'
import { MetricsCollector } from '@/lib/observability'
import { rateLimiter } from '@/lib/redis/rate-limiter'
import { documentCache } from '@/lib/cache/init'
import { redis } from '@/lib/queue/redis'
import { getQueue, QUEUE_NAMES } from '@/lib/queue/client'

export const dynamic = 'force-dynamic'

// GET /api/v2/health - Comprehensive health check
export async function GET(request: NextRequest) {
  const versionManager = APIVersionManager.getInstance()
  const version = versionManager.extractVersion(request)
  const startTime = Date.now()
  
  try {
    // Get basic system health
    const systemHealth = await checkSystemHealth()
    
    // Get circuit breaker states
    const circuitBreakers = getAllCircuitBreakerStates()
    
    // Get queue health
    const queueHealth = await getQueueHealth()
    
    // Get cache health
    const cacheHealth = await getCacheHealth()
    
    // Get rate limiter health
    const rateLimiterHealth = await rateLimiter.healthCheck()
    
    // Get metrics summary
    const metrics = MetricsCollector.getInstance()
    const metricsSummary = {
      httpRequests: metrics.getHttpRequestMetrics(),
      aiUsage: metrics.getAIUsageMetrics(),
      cacheHitRate: metrics.getCacheHitRate(),
      errorRate: metrics.getErrorRate()
    }
    
    // Calculate overall status
    const overallStatus = calculateOverallStatus({
      system: systemHealth.status,
      queues: queueHealth.status,
      cache: cacheHealth.status,
      rateLimiter: rateLimiterHealth ? 'healthy' : 'unhealthy',
      circuitBreakers: Object.values(circuitBreakers).some(cb => cb.status === 'open') 
        ? 'degraded' 
        : 'healthy'
    })
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      version: {
        api: version,
        app: process.env.npm_package_version || 'unknown'
      },
      components: {
        system: systemHealth,
        queues: queueHealth,
        cache: cacheHealth,
        rateLimiter: {
          status: rateLimiterHealth ? 'healthy' : 'unhealthy',
          message: rateLimiterHealth ? 'Redis connection active' : 'Redis connection failed'
        },
        circuitBreakers
      },
      metrics: metricsSummary,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)
        },
        cpu: process.cpuUsage()
      }
    }
    
    // Return appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503
    
    return new Response(JSON.stringify({
      success: true,
      data: response,
      metadata: {
        requestId: `health_${Date.now()}`,
        timestamp: new Date().toISOString(),
        version
      }
    }), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    console.error('Health check error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      metadata: {
        requestId: `health_error_${Date.now()}`,
        timestamp: new Date().toISOString(),
        version
      }
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

// Get queue health status
async function getQueueHealth() {
  try {
    const queues = Object.values(QUEUE_NAMES).map(name => getQueue(name))
    
    const queueStats = await Promise.all(
      queues.map(async (queue) => {
        try {
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount()
          ])
          
          return {
            name: queue.name,
            status: 'healthy' as const,
            stats: {
              waiting,
              active,
              completed,
              failed
            }
          }
        } catch (error) {
          return {
            name: queue.name,
            status: 'unhealthy' as const,
            error: error instanceof Error ? error.message : 'Queue check failed'
          }
        }
      })
    )
    
    const allHealthy = queueStats.every(q => q.status === 'healthy')
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      queues: queueStats
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Queue health check failed'
    }
  }
}

// Get cache health status
async function getCacheHealth() {
  try {
    // Test Redis connection
    const redisPing = await redis.ping()
    
    // Get cache stats
    const cacheStats = {
      redisConnected: redisPing === 'PONG',
      documentCacheSize: await documentCache.getCacheSize()
    }
    
    return {
      status: cacheStats.redisConnected ? 'healthy' : 'unhealthy',
      stats: cacheStats
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Cache health check failed'
    }
  }
}

// Calculate overall status
function calculateOverallStatus(statuses: Record<string, string>): 'healthy' | 'degraded' | 'unhealthy' {
  const statusValues = Object.values(statuses)
  
  if (statusValues.every(s => s === 'healthy')) {
    return 'healthy'
  }
  
  if (statusValues.some(s => s === 'unhealthy')) {
    return 'unhealthy'
  }
  
  return 'degraded'
}

// Handle CORS preflight
export async function OPTIONS(_request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-API-Version',
      'Access-Control-Max-Age': '86400',
    },
  })
}