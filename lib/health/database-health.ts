import { createClient } from '@/lib/supabase/server'
import type { HealthCheckResult } from './types'

export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now()
  
  try {
    const supabase = await createClient()
    
    // Execute a simple query to test connectivity
    const queryStart = Date.now()
    const { error } = await supabase
      .from('_prisma_migrations')
      .select('id')
      .limit(1)
    
    const queryLatency = Date.now() - queryStart
    
    if (error) {
      throw error
    }
    
    // Determine health status based on latency
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    let message = 'Database is operational'
    
    if (queryLatency > 200) {
      status = 'degraded'
      message = `Database latency is high: ${queryLatency}ms`
    }
    
    if (queryLatency > 1000) {
      status = 'unhealthy'
      message = `Database latency is critical: ${queryLatency}ms`
    }
    
    return {
      service: 'database',
      status,
      responseTime: Date.now() - startTime,
      details: {
        latency: queryLatency,
        connected: true,
        message
      }
    }
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Database connection failed',
      details: {
        connected: false
      }
    }
  }
}