import { logger } from '../logger';
import { metrics } from '../metrics';
import type { EnhancementPipelineStage, EnhancementContext } from '@/lib/enhancement/pipeline/types';

/**
 * Wraps a pipeline stage with comprehensive monitoring
 */
export function monitorPipelineStage<T extends EnhancementPipelineStage>(
  stage: T
): T {
  return {
    ...stage,
    async execute(context: EnhancementContext): Promise<void> {
      const startTime = Date.now();
      const stageLogger = logger.child({
        stage: stage.name,
        enhancementId: context.enhancementId,
        documentId: context.documentId,
        userId: context.userId,
      });

      stageLogger.info({
        type: 'pipeline_stage_started',
        stage: stage.name,
        input: {
          hasDocument: !!context.document,
          hasAnalysis: !!context.analysis,
        },
      }, `Starting ${stage.name} stage`);

      try {
        // Execute the actual stage
        await stage.execute(context);

        const duration = Date.now() - startTime;
        
        // Log successful completion
        stageLogger.info({
          type: 'pipeline_stage_completed',
          stage: stage.name,
          duration,
          output: {
            hasEnhancement: !!context.enhancement,
            hasAssets: !!context.assets?.length,
            assetCount: context.assets?.length || 0,
          },
        }, `Completed ${stage.name} stage`);

        // Record metrics
        metrics.enhancementPipelineStagesDuration.observe(
          { stage: stage.name },
          duration / 1000
        );

        // Log performance metric
        logger.logPerformanceMetric(
          `pipeline.stage.${stage.name}.duration`,
          duration,
          'ms',
          {
            enhancement_id: context.enhancementId,
          }
        );

        // Report progress if callback is available
        if (context.onProgress) {
          const progress = calculateStageProgress(stage.name);
          context.onProgress(progress, `Completed ${stage.name}`);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log stage failure
        stageLogger.error({
          type: 'pipeline_stage_failed',
          stage: stage.name,
          duration,
          err: error,
        }, `Failed ${stage.name} stage`);

        // Record failure metrics
        metrics.enhancementPipelineTotal.inc({ status: 'stage_failed' });

        // Check if it's a critical error
        if (isCriticalError(error as Error)) {
          logger.logSecurityEvent('pipeline_critical_error', 'high', {
            stage: stage.name,
            error: (error as Error).message,
            enhancementId: context.enhancementId,
          });
        }

        throw error;
      }
    },
  };
}

/**
 * Monitor the entire enhancement pipeline
 */
export function monitorEnhancementPipeline() {
  return {
    onPipelineStart(context: EnhancementContext) {
      const pipelineLogger = logger.child({
        enhancementId: context.enhancementId,
        documentId: context.documentId,
        userId: context.userId,
      });

      pipelineLogger.info({
        type: 'enhancement_pipeline_started',
        documentType: context.document?.metadata?.type,
        documentSize: context.document?.metadata?.size,
      }, 'Enhancement pipeline started');

      metrics.enhancementPipelineTotal.inc({ status: 'started' });
    },

    onPipelineComplete(context: EnhancementContext, duration: number) {
      const pipelineLogger = logger.child({
        enhancementId: context.enhancementId,
        documentId: context.documentId,
        userId: context.userId,
      });

      pipelineLogger.info({
        type: 'enhancement_pipeline_completed',
        duration,
        stages: context.completedStages,
        assetCount: context.assets?.length || 0,
      }, 'Enhancement pipeline completed');

      metrics.enhancementPipelineTotal.inc({ status: 'completed' });
      
      logger.logPerformanceMetric(
        'pipeline.total.duration',
        duration,
        'ms',
        {
          enhancement_id: context.enhancementId,
          stages: context.completedStages?.join(','),
        }
      );
    },

    onPipelineError(context: EnhancementContext, error: Error, duration: number) {
      const pipelineLogger = logger.child({
        enhancementId: context.enhancementId,
        documentId: context.documentId,
        userId: context.userId,
      });

      pipelineLogger.error({
        type: 'enhancement_pipeline_failed',
        duration,
        failedStage: context.currentStage,
        completedStages: context.completedStages,
        err: error,
      }, 'Enhancement pipeline failed');

      metrics.enhancementPipelineTotal.inc({ status: 'failed' });
    },
  };
}

/**
 * Calculate stage progress percentage
 */
function calculateStageProgress(stageName: string): number {
  const stageWeights: Record<string, number> = {
    upload: 10,
    analysis: 30,
    enhancement: 60,
    'asset-generation': 80,
    export: 100,
  };

  return stageWeights[stageName] || 0;
}

/**
 * Check if an error is critical
 */
function isCriticalError(error: Error): boolean {
  const criticalPatterns = [
    'unauthorized',
    'forbidden',
    'invalid token',
    'security violation',
    'malicious',
  ];

  const errorMessage = error.message.toLowerCase();
  return criticalPatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Create pipeline performance report
 */
export async function generatePipelinePerformanceReport(
  startDate: Date,
  endDate: Date
) {
  const report = {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    metrics: await metrics.enhancementPipelineTotal.get(),
    stageMetrics: await metrics.enhancementPipelineStagesDuration.get(),
    summary: {
      totalPipelines: 0,
      successRate: 0,
      averageDuration: 0,
      stageBreakdown: {} as Record<string, number>,
    },
  };

  // Calculate summary statistics
  const totalMetrics = report.metrics.values;
  if (totalMetrics.length > 0) {
    const completed = totalMetrics.find(m => m.labels.status === 'completed')?.value || 0;
    const failed = totalMetrics.find(m => m.labels.status === 'failed')?.value || 0;
    const total = completed + failed;
    
    report.summary.totalPipelines = total;
    report.summary.successRate = total > 0 ? (completed / total) * 100 : 0;
  }

  logger.info({
    type: 'pipeline_performance_report',
    report,
  }, 'Generated pipeline performance report');

  return report;
}

/**
 * Monitor pipeline resource usage
 */
export function monitorPipelineResources(enhancementId: string) {
  const startMemory = process.memoryUsage();
  const startCpu = process.cpuUsage();

  return {
    recordResourceUsage(stage: string) {
      const currentMemory = process.memoryUsage();
      const currentCpu = process.cpuUsage();

      const memoryDelta = {
        rss: currentMemory.rss - startMemory.rss,
        heapTotal: currentMemory.heapTotal - startMemory.heapTotal,
        heapUsed: currentMemory.heapUsed - startMemory.heapUsed,
      };

      const cpuDelta = {
        user: (currentCpu.user - startCpu.user) / 1000, // Convert to ms
        system: (currentCpu.system - startCpu.system) / 1000,
      };

      logger.debug({
        type: 'pipeline_resource_usage',
        enhancementId,
        stage,
        memory: memoryDelta,
        cpu: cpuDelta,
      }, 'Pipeline resource usage');

      // Alert if memory usage is too high
      if (memoryDelta.heapUsed > 500 * 1024 * 1024) { // 500MB
        logger.warn({
          type: 'pipeline_high_memory_usage',
          enhancementId,
          stage,
          memoryUsed: memoryDelta.heapUsed,
        }, 'High memory usage detected in pipeline');
      }
    },
  };
}