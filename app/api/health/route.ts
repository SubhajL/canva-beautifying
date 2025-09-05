import { NextResponse } from 'next/server'
import { checkSystemHealth } from '@/lib/health/checker'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const health = await checkSystemHealth()
    
    // Return appropriate HTTP status code based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503
    
    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        checks: [],
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 503 }
    )
  }
}