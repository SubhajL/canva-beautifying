import { NextRequest, NextResponse } from 'next/server';
import { getPerformanceMonitor } from '@/lib/observability/performance-monitor';
import { getPerformanceAnalyzer } from '@/lib/observability/performance-analyzer';
import { logger } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const metric = searchParams.get('metric');
    const period = searchParams.get('period') as '1m' | '5m' | '15m' | '1h' | '24h' | null;
    const analyze = searchParams.get('analyze') === 'true';

    // Get performance monitor
    const performanceMonitor = getPerformanceMonitor();
    
    if (metric) {
      // Get specific metric
      const metrics = await performanceMonitor.getMetrics(metric, {
        period: period || undefined,
        limit: 100
      });

      return NextResponse.json({
        metric,
        period: period || 'raw',
        count: metrics.length,
        data: metrics
      });
    }

    // Get summary of all metrics
    const summary = await performanceMonitor.getMetricsSummary(period || '1h');
    
    let analysis = null;
    if (analyze) {
      try {
        const analyzer = getPerformanceAnalyzer();
        const [trends, bottlenecks] = await Promise.all([
          analyzer.analyzeTrends(period || '1h'),
          analyzer.getResourceUsage()
        ]);

        analysis = {
          trends,
          currentUsage: bottlenecks
        };
      } catch (error) {
        logger.warn({ err: error }, 'Failed to analyze performance');
      }
    }

    return NextResponse.json({
      summary,
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, 'Performance endpoint error');
    
    return NextResponse.json(
      { error: 'Failed to get performance metrics' },
      { status: 500 }
    );
  }
}