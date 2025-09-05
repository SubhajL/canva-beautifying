import type { HealthCheckResult } from './types'

export async function checkRedisHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  
  try {
    // Check if Redis is configured
    if (!process.env.REDIS_URL && !process.env.UPSTASH_REDIS_URL) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: 'Redis is not configured',
        details: {
          connected: false
        }
      }
    }
    
    // Dynamically import Redis client to avoid initialization errors in tests
    const { getRedisClient } = await import('@/lib/queue/redis')
    const redis = getRedisClient()
    
    // Ping Redis
    const pingStart = Date.now()
    await redis.ping()
    const pingLatency = Date.now() - pingStart
    
    // Get Redis info
    const info = await redis.info()
    const stats = parseRedisInfo(info)
    
    // Check memory usage
    const maxMemory = Number(stats['maxmemory']) || 0
    const usedMemory = Number(stats['used_memory']) || 0
    const memoryUsagePercent = maxMemory > 0 ? Math.round((usedMemory / maxMemory) * 100) : 0
    
    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let message = 'Redis is operational'
    
    if (pingLatency > 100) {
      status = 'degraded'
      message = `Redis latency is high: ${pingLatency}ms`
    }
    
    if (memoryUsagePercent > 90) {
      status = 'degraded'
      message = `Redis memory usage is high: ${memoryUsagePercent}%`
    }
    
    if (pingLatency > 500) {
      status = 'unhealthy'
      message = `Redis latency is critical: ${pingLatency}ms`
    }
    
    return {
      service: 'redis',
      status,
      responseTime: Date.now() - startTime,
      details: {
        latency: pingLatency,
        memoryUsage: memoryUsagePercent,
        connected: true,
        uptime: Number(stats['uptime_in_seconds']) || 0,
        connectedClients: Number(stats['connected_clients']) || 0,
        role: String(stats['role'] || 'unknown'),
        message
      }
    }
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Redis connection failed',
      details: {
        connected: false
      }
    }
  }
}

function parseRedisInfo(info: string): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  const lines = info.split('\r\n')
  
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':')
      result[key] = isNaN(Number(value)) ? value : Number(value)
    }
  }
  
  return result
}