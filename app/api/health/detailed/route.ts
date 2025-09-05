import { NextRequest, NextResponse } from 'next/server';
import { checkSystemHealth } from '@/lib/health/checker';
import { getPerformanceMonitor } from '@/lib/observability/performance-monitor';
import { getPerformanceAnalyzer } from '@/lib/observability/performance-analyzer';
import { getAIPerformanceTracker } from '@/lib/observability/ai-performance-tracker';
import { logger } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Optional authentication
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.HEALTH_AUTH_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get basic health
    const health = await checkSystemHealth();
    
    // Get performance metrics summary
    let performanceSummary = null;
    try {
      const performanceMonitor = getPerformanceMonitor();
      performanceSummary = await performanceMonitor.getMetricsSummary('1h');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get performance summary');
    }

    // Get resource usage
    let resourceUsage = null;
    try {
      const performanceAnalyzer = getPerformanceAnalyzer();
      resourceUsage = await performanceAnalyzer.getResourceUsage();
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get resource usage');
    }

    // Get AI model stats
    let aiStats = null;
    try {
      const aiTracker = getAIPerformanceTracker();
      aiStats = await aiTracker.getAllModelStats('1h');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get AI stats');
    }

    // Get performance trends
    let trends = null;
    try {
      const performanceAnalyzer = getPerformanceAnalyzer();
      trends = await performanceAnalyzer.analyzeTrends('1h');
    } catch (error) {
      logger.warn({ err: error }, 'Failed to get performance trends');
    }

    const detailedHealth = {
      ...health,
      performance: {
        summary: performanceSummary,
        resourceUsage,
        trends
      },
      ai: {
        modelStats: aiStats
      }
    };

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(detailedHealth, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    logger.error({ err: error }, 'Detailed health check error');
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 503 }
    );
  }
}