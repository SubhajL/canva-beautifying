import { NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/health/checker';

export const dynamic = 'force-dynamic';

// Readiness probe for Kubernetes/container orchestration
export async function GET() {
  try {
    const health = await checkSystemHealth();
    
    // For readiness, we're more strict - only "healthy" is ready
    if (health.status === 'healthy') {
      return NextResponse.json(
        { 
          ready: true,
          timestamp: health.timestamp 
        },
        { status: 200 }
      );
    } else {
      // Not ready if degraded or unhealthy
      const failedChecks = health.checks
        .filter(c => c.status !== 'healthy')
        .map(c => ({
          service: c.service,
          status: c.status,
          error: c.error
        }));

      return NextResponse.json(
        { 
          ready: false,
          timestamp: health.timestamp,
          failedChecks 
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { 
        ready: false,
        error: error instanceof Error ? error.message : 'Readiness check failed' 
      },
      { status: 503 }
    );
  }
}