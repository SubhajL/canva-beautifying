import { NextRequest, NextResponse } from 'next/server';
import { getAIPerformanceTracker } from '@/lib/observability/ai-performance-tracker';
import { logger } from '@/lib/observability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model');
    const provider = searchParams.get('provider');
    const period = searchParams.get('period') as '1h' | '24h' | '7d' | '30d' | null;
    const recommend = searchParams.get('recommend') === 'true';

    const aiTracker = getAIPerformanceTracker();

    // Get model recommendations
    if (recommend) {
      const operation = searchParams.get('operation') || 'enhance';
      const maxLatency = searchParams.get('maxLatency') 
        ? parseInt(searchParams.get('maxLatency')!) 
        : undefined;
      const maxCost = searchParams.get('maxCost') 
        ? parseFloat(searchParams.get('maxCost')!) 
        : undefined;

      const recommendations = await aiTracker.recommendModel(operation, {
        maxLatency,
        maxCostPerRequest: maxCost,
        minSuccessRate: 95
      });

      return NextResponse.json({
        operation,
        criteria: { maxLatency, maxCost, minSuccessRate: 95 },
        recommendations,
        timestamp: new Date().toISOString()
      });
    }

    // Get specific model stats
    if (model && provider) {
      const stats = await aiTracker.getModelStats(model, provider, period || '1h');
      
      if (!stats) {
        return NextResponse.json(
          { error: 'No data available for specified model' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        model,
        provider,
        period: period || '1h',
        stats,
        timestamp: new Date().toISOString()
      });
    }

    // Get all model stats
    const allStats = await aiTracker.getAllModelStats(period || '1h');

    // Get cost analysis if requested
    let costAnalysis = null;
    if (searchParams.get('includeCost') === 'true') {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      costAnalysis = await aiTracker.getModelCostAnalysis(
        startOfDay,
        now,
        'model'
      );
    }

    return NextResponse.json({
      period: period || '1h',
      models: allStats,
      costAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ err: error }, 'AI models endpoint error');
    
    return NextResponse.json(
      { error: 'Failed to get AI model stats' },
      { status: 500 }
    );
  }
}