import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';
import { logger } from './logger';
import { metrics } from './metrics';
import { createChildSpan, withSpanAsync } from './context-propagation';
import { Queue, Job } from 'bullmq';

// Pipeline stages
export enum PipelineStage {
  UPLOAD = 'upload',
  ANALYSIS = 'analysis',
  ENHANCEMENT = 'enhancement',
  EXPORT = 'export',
  COMPLETE = 'complete',
}

// Pipeline metrics
const pipelineMetrics = {
  stageStarted: metrics.register.getSingleMetric('enhancement_stage_started') || 
    new (require('prom-client').Counter)({
      name: 'enhancement_stage_started',
      help: 'Enhancement pipeline stages started',
      labelNames: ['stage', 'document_type'],
    }),
    
  stageCompleted: metrics.register.getSingleMetric('enhancement_stage_completed') ||
    new (require('prom-client').Counter)({
      name: 'enhancement_stage_completed',
      help: 'Enhancement pipeline stages completed',
      labelNames: ['stage', 'document_type', 'status'],
    }),
    
  stageDuration: metrics.register.getSingleMetric('enhancement_stage_duration') ||
    new (require('prom-client').Histogram)({
      name: 'enhancement_stage_duration',
      help: 'Enhancement pipeline stage duration',
      labelNames: ['stage', 'document_type'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
    }),
    
  pipelineTotal: metrics.register.getSingleMetric('enhancement_pipeline_total') ||
    new (require('prom-client').Histogram)({
      name: 'enhancement_pipeline_total',
      help: 'Total enhancement pipeline duration',
      labelNames: ['document_type', 'status'],
      buckets: [5, 10, 30, 60, 120, 300, 600],
    }),
};

// Register metrics if not already registered
if (!metrics.register.getSingleMetric('enhancement_stage_started')) {
  metrics.register.registerMetric(pipelineMetrics.stageStarted);
}
if (!metrics.register.getSingleMetric('enhancement_stage_completed')) {
  metrics.register.registerMetric(pipelineMetrics.stageCompleted);
}
if (!metrics.register.getSingleMetric('enhancement_stage_duration')) {
  metrics.register.registerMetric(pipelineMetrics.stageDuration);
}
if (!metrics.register.getSingleMetric('enhancement_pipeline_total')) {
  metrics.register.registerMetric(pipelineMetrics.pipelineTotal);
}

/**
 * Enhancement pipeline tracer
 */
export class EnhancementPipelineTracer {
  private tracer = trace.getTracer('enhancement-pipeline', '1.0.0');
  private pipelineSpans = new Map<string, any>();
  
  /**
   * Start pipeline tracing
   */
  startPipeline(
    enhancementId: string,
    userId: string,
    documentType: string,
    metadata?: Record<string, any>
  ) {
    const span = this.tracer.startSpan('enhancement.pipeline', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'enhancement.id': enhancementId,
        'user.id': userId,
        'document.type': documentType,
        'pipeline.start_time': new Date().toISOString(),
        ...metadata,
      },
    });
    
    this.pipelineSpans.set(enhancementId, {
      span,
      startTime: Date.now(),
      documentType,
      stages: new Map(),
    });
    
    // Log pipeline start
    logger.info({
      enhancementId,
      userId,
      documentType,
      spanId: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
    }, 'Enhancement pipeline started');
    
    return span.spanContext().traceId;
  }
  
  /**
   * Track stage progress
   */
  async trackStage<T>(
    enhancementId: string,
    stage: PipelineStage,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const pipeline = this.pipelineSpans.get(enhancementId);
    if (!pipeline) {
      // No active pipeline, run without tracing
      return fn();
    }
    
    const { span: parentSpan, documentType } = pipeline;
    
    // Create stage span
    const stageSpan = createChildSpan(`enhancement.stage.${stage}`, parentSpan);
    
    // Set stage attributes
    stageSpan.setAttributes({
      'enhancement.id': enhancementId,
      'enhancement.stage': stage,
      'document.type': documentType,
      ...metadata,
    });
    
    // Record metrics
    pipelineMetrics.stageStarted.inc({ stage, document_type: documentType });
    const stageStart = Date.now();
    
    // Store stage info
    pipeline.stages.set(stage, {
      span: stageSpan,
      startTime: stageStart,
    });
    
    // Add stage event to parent
    parentSpan.addEvent(`stage.${stage}.started`, {
      stage,
      timestamp: stageStart,
    });
    
    try {
      // Execute stage within span context
      const result = await withSpanAsync(stageSpan, fn);
      
      // Record success
      const duration = (Date.now() - stageStart) / 1000;
      
      stageSpan.setStatus({ code: SpanStatusCode.OK });
      stageSpan.setAttributes({
        'enhancement.stage.duration': duration,
        'enhancement.stage.success': true,
      });
      
      parentSpan.addEvent(`stage.${stage}.completed`, {
        stage,
        duration,
        timestamp: Date.now(),
      });
      
      // Update metrics
      pipelineMetrics.stageCompleted.inc({ 
        stage, 
        document_type: documentType, 
        status: 'success' 
      });
      pipelineMetrics.stageDuration.observe({ 
        stage, 
        document_type: documentType 
      }, duration);
      
      // Log stage completion
      logger.info({
        enhancementId,
        stage,
        duration,
        spanId: stageSpan.spanContext().spanId,
      }, 'Enhancement stage completed');
      
      return result;
    } catch (error) {
      // Record failure
      const duration = (Date.now() - stageStart) / 1000;
      
      stageSpan.recordException(error as Error);
      stageSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      stageSpan.setAttributes({
        'enhancement.stage.duration': duration,
        'enhancement.stage.success': false,
        'enhancement.stage.error': (error as Error).message,
      });
      
      parentSpan.addEvent(`stage.${stage}.failed`, {
        stage,
        duration,
        error: (error as Error).message,
        timestamp: Date.now(),
      });
      
      // Update metrics
      pipelineMetrics.stageCompleted.inc({ 
        stage, 
        document_type: documentType, 
        status: 'error' 
      });
      pipelineMetrics.stageDuration.observe({ 
        stage, 
        document_type: documentType 
      }, duration);
      
      // Log stage error
      logger.error({
        enhancementId,
        stage,
        duration,
        err: error as Error,
        spanId: stageSpan.spanContext().spanId,
      }, 'Enhancement stage failed');
      
      throw error;
    } finally {
      stageSpan.end();
    }
  }
  
  /**
   * Complete pipeline tracing
   */
  completePipeline(
    enhancementId: string,
    status: 'success' | 'error' | 'cancelled',
    metadata?: Record<string, any>
  ) {
    const pipeline = this.pipelineSpans.get(enhancementId);
    if (!pipeline) {
      return;
    }
    
    const { span, startTime, documentType } = pipeline;
    const duration = (Date.now() - startTime) / 1000;
    
    // Set final attributes
    span.setAttributes({
      'enhancement.duration': duration,
      'enhancement.status': status,
      'enhancement.stages_completed': pipeline.stages.size,
      'pipeline.end_time': new Date().toISOString(),
      ...metadata,
    });
    
    // Set span status
    if (status === 'success') {
      span.setStatus({ code: SpanStatusCode.OK });
    } else {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Pipeline ${status}`,
      });
    }
    
    // Add completion event
    span.addEvent('pipeline.completed', {
      status,
      duration,
      stages_completed: pipeline.stages.size,
      timestamp: Date.now(),
    });
    
    // Update metrics
    pipelineMetrics.pipelineTotal.observe({
      document_type: documentType,
      status,
    }, duration);
    
    // Log pipeline completion
    logger.info({
      enhancementId,
      status,
      duration,
      stagesCompleted: pipeline.stages.size,
      spanId: span.spanContext().spanId,
      traceId: span.spanContext().traceId,
    }, 'Enhancement pipeline completed');
    
    // Clean up
    span.end();
    this.pipelineSpans.delete(enhancementId);
  }
  
  /**
   * Add custom event to pipeline
   */
  addPipelineEvent(
    enhancementId: string,
    eventName: string,
    attributes?: Record<string, any>
  ) {
    const pipeline = this.pipelineSpans.get(enhancementId);
    if (!pipeline) {
      return;
    }
    
    pipeline.span.addEvent(eventName, {
      timestamp: Date.now(),
      ...attributes,
    });
    
    logger.info({
      enhancementId,
      eventName,
      attributes,
    }, 'Pipeline event added');
  }
  
  /**
   * Track queue job within pipeline context
   */
  trackQueueJob(job: Job, queueName: string) {
    const enhancementId = job.data.enhancementId;
    const pipeline = this.pipelineSpans.get(enhancementId);
    
    if (!pipeline) {
      return;
    }
    
    // Add queue job info to pipeline span
    pipeline.span.setAttributes({
      [`queue.${queueName}.job_id`]: job.id,
      [`queue.${queueName}.attempt`]: job.attemptsMade,
      [`queue.${queueName}.timestamp`]: Date.now(),
    });
    
    // Add event
    pipeline.span.addEvent(`queue.${queueName}.job_started`, {
      job_id: job.id,
      queue: queueName,
      attempt: job.attemptsMade,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Get active pipeline trace ID
   */
  getTraceId(enhancementId: string): string | undefined {
    const pipeline = this.pipelineSpans.get(enhancementId);
    return pipeline?.span.spanContext().traceId;
  }
  
  /**
   * Check if pipeline is active
   */
  isActive(enhancementId: string): boolean {
    return this.pipelineSpans.has(enhancementId);
  }
  
  /**
   * Get pipeline duration
   */
  getDuration(enhancementId: string): number | undefined {
    const pipeline = this.pipelineSpans.get(enhancementId);
    if (!pipeline) {
      return undefined;
    }
    
    return (Date.now() - pipeline.startTime) / 1000;
  }
}

// Singleton instance
export const pipelineTracer = new EnhancementPipelineTracer();