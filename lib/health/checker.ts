import type { SystemHealthResult, HealthCheckResult } from './types'

// Health check timeout in milliseconds
const HEALTH_CHECK_TIMEOUT = 5000

export async function checkSystemHealth(): Promise<SystemHealthResult> {
  const checks: HealthCheckResult[] = []
  
  // Dynamically import health checks to avoid initialization errors
  const { checkRedisHealth } = await import('./redis-health')
  const { checkDatabaseHealth } = await import('./database-health')
  const { checkStorageHealth } = await import('./storage-health')
  const { checkAIHealth } = await import('./ai-health')
  const { checkQueueHealth } = await import('./queue-health')
  const { checkWebSocketHealth } = await import('./websocket-health')
  
  // Run all health checks in parallel with timeout
  const healthChecks = [
    withTimeout(checkRedisHealth(), 'redis'),
    withTimeout(checkDatabaseHealth(), 'database'),
    withTimeout(checkStorageHealth(), 'storage'),
    withTimeout(checkAIHealth(), 'ai'),
    withTimeout(checkQueueHealth(), 'queue'),
    withTimeout(checkWebSocketHealth(), 'websocket')
  ]
  
  const results = await Promise.allSettled(healthChecks)
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      checks.push(result.value)
    } else {
      // Handle timeout or error
      let serviceName = 'unknown'
      let errorMessage = 'Health check failed'
      
      // Determine service name from index
      const services = ['redis', 'database', 'storage', 'ai', 'queue', 'websocket']
      serviceName = services[i] || 'unknown'
      
      // Extract error message
      const reason = result.reason
      if (reason instanceof Error) {
        errorMessage = reason.message
      } else if (reason?.message) {
        errorMessage = reason.message
        serviceName = reason.service || serviceName
      } else if (typeof reason === 'string') {
        errorMessage = reason
      } else {
        errorMessage = 'Health check timed out'
      }
      
      checks.push({
        service: serviceName,
        status: 'unhealthy',
        responseTime: HEALTH_CHECK_TIMEOUT,
        error: errorMessage
      })
    }
  }
  
  // Determine overall system status
  const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length
  const degradedCount = checks.filter(c => c.status === 'degraded').length
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  // If any critical service (redis, database) is unhealthy, system is unhealthy
  const criticalServices = ['redis', 'database']
  const criticalUnhealthy = checks.filter(
    c => criticalServices.includes(c.service) && c.status === 'unhealthy'
  ).length > 0
  
  if (criticalUnhealthy || unhealthyCount >= 2) {
    overallStatus = 'unhealthy'
  } else if (unhealthyCount > 0 || degradedCount > 0) {
    overallStatus = 'degraded'
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks,
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development'
  }
}

async function withTimeout<T extends HealthCheckResult>(
  promise: Promise<T>,
  service: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject({ service, message: `Health check timed out after ${HEALTH_CHECK_TIMEOUT}ms` }),
        HEALTH_CHECK_TIMEOUT
      )
    )
  ])
}