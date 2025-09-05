import { NextRequest, NextResponse } from 'next/server';
import { getMetricsResponse, recordHttpMetrics } from '@/lib/observability';
import { logger } from '@/lib/observability';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if metrics endpoint is enabled
    if (process.env.ENABLE_METRICS_ENDPOINT !== 'true') {
      return NextResponse.json(
        { error: 'Metrics endpoint is disabled' },
        { status: 404 }
      );
    }

    // Optional: Add authentication check
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.METRICS_AUTH_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      logger.logSecurityEvent('metrics_unauthorized_access', 'medium', {
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get metrics in Prometheus format
    const metrics = await getMetricsResponse();
    
    const response = new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

    const duration = Date.now() - startTime;
    recordHttpMetrics('GET', '/api/metrics', 200, duration);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordHttpMetrics('GET', '/api/metrics', 500, duration);

    logger.error({ err: error }, 'Failed to generate metrics');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}