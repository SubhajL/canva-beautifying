import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cacheMetrics } from '../../../../lib/cache/metrics'
import { redis } from '../../../../lib/queue/redis'
import { logger } from '../../../../lib/observability'
import { documentCache, enhancementCache, aiResponseCache } from '../../../../lib/cache/init'

interface CacheInfo {
  dbsize: number
  used_memory: string
  used_memory_human: string
  used_memory_peak_human: string
  connected_clients: number
  total_connections_received: number
  instantaneous_ops_per_sec: number
  keyspace_hits: number
  keyspace_misses: number
  expired_keys: number
  evicted_keys: number
}

export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const supabase = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get cache statistics from our metrics
    const applicationStats = cacheMetrics.getStats()
    const exportedMetrics = cacheMetrics.exportMetrics()

    // Get Redis server info
    const redisInfo: Partial<CacheInfo> = {}
    try {
      const info = await redis.info()
      const lines = info.split('\r\n')
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':')
          const trimmedKey = key.trim()
          
          // Extract specific metrics
          switch (trimmedKey) {
            case 'used_memory':
            case 'used_memory_human':
            case 'used_memory_peak_human':
            case 'connected_clients':
            case 'total_connections_received':
            case 'instantaneous_ops_per_sec':
            case 'keyspace_hits':
            case 'keyspace_misses':
            case 'expired_keys':
            case 'evicted_keys':
              (redisInfo as any)[trimmedKey] = isNaN(Number(value)) ? value : Number(value)
              break
            case 'db0':
              // Extract key count from db0 info
              const match = value.match(/keys=(\d+)/)
              if (match) {
                redisInfo.dbsize = parseInt(match[1])
              }
              break
          }
        }
      })
    } catch (error) {
      logger.warn('Failed to get Redis info', { error })
    }

    // Get pattern-based statistics
    const patterns = [
      { pattern: 'doc:*', name: 'documents' },
      { pattern: 'enhance:*', name: 'enhancements' },
      { pattern: 'airesponse:*', name: 'ai_responses' },
      { pattern: 'user:*', name: 'user_cache' },
      { pattern: 'perceptual:*', name: 'perceptual_hashes' }
    ]

    const patternStats: Record<string, number> = {}
    
    // Use scan to count keys for each pattern (more efficient than keys command)
    for (const { pattern, name } of patterns) {
      let count = 0
      let cursor = '0'
      
      do {
        const [nextCursor, batch] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        )
        cursor = nextCursor
        count += batch.length
      } while (cursor !== '0')
      
      patternStats[name] = count
    }

    // Calculate additional metrics
    const totalKeys = Object.values(patternStats).reduce((sum, count) => sum + count, 0)
    const hitMissRatio = redisInfo.keyspace_misses && redisInfo.keyspace_hits
      ? (redisInfo.keyspace_hits / (redisInfo.keyspace_hits + redisInfo.keyspace_misses)) * 100
      : 0

    // Get cache-specific metrics from our cache instances
    const cacheTypeMetrics = {
      documentCache: {
        configured: !!documentCache,
        defaultTTL: 43200, // 12 hours default
        compressionEnabled: true,
        similarityThreshold: 0.85
      },
      enhancementCache: {
        configured: !!enhancementCache,
        defaultTTL: 86400, // 24 hours default
        compressionEnabled: true,
        similarityThreshold: 0.95
      },
      aiResponseCache: {
        configured: !!aiResponseCache,
        defaultTTL: 3600, // 1 hour default
        compressionEnabled: true
      }
    }

    const response = {
      timestamp: new Date().toISOString(),
      application: {
        metrics: applicationStats,
        exported: exportedMetrics
      },
      redis: {
        server: redisInfo,
        patterns: patternStats,
        totalKeys,
        hitMissRatio: Math.round(hitMissRatio * 100) / 100
      },
      cacheTypes: cacheTypeMetrics,
      health: {
        status: redis.status === 'ready' ? 'healthy' : 'unhealthy',
        redisConnected: redis.status === 'ready',
        memoryUsagePercent: redisInfo.used_memory && process.env.REDIS_MAX_MEMORY
          ? (Number(redisInfo.used_memory) / Number(process.env.REDIS_MAX_MEMORY)) * 100
          : null
      },
      recommendations: generateRecommendations(applicationStats, redisInfo, patternStats)
    }

    logger.info('Cache stats retrieved', { userId: user.id })

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Failed to get cache stats', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateRecommendations(
  appStats: any,
  redisInfo: Partial<CacheInfo>,
  patternStats: Record<string, number>
): string[] {
  const recommendations: string[] = []

  // Check hit rate
  if (appStats.hitRate < 0.5) {
    recommendations.push('Low hit rate detected. Consider implementing cache warming strategies.')
  }

  // Check similarity usage
  if (appStats.similarityRate < 0.1 && appStats.similarityHits > 0) {
    recommendations.push('Low similarity match rate. Consider adjusting similarity thresholds.')
  }

  // Check memory usage
  if (redisInfo.evicted_keys && redisInfo.evicted_keys > 1000) {
    recommendations.push('High key eviction rate. Consider increasing Redis memory limit.')
  }

  // Check response time
  if (appStats.avgResponseTime > 100) {
    recommendations.push('High average response time. Consider enabling compression or connection pooling.')
  }

  // Check pattern distribution
  const totalPatternKeys = Object.values(patternStats).reduce((sum, count) => sum + count, 0)
  if (patternStats.user_cache > totalPatternKeys * 0.7) {
    recommendations.push('User cache dominates storage. Consider implementing user-specific TTLs.')
  }

  // Check expired keys
  if (redisInfo.expired_keys && redisInfo.expired_keys > totalPatternKeys * 0.3) {
    recommendations.push('High number of expired keys. Consider running cache invalidation more frequently.')
  }

  return recommendations
}