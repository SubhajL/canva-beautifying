import { Queue, Worker, Job } from 'bullmq';
import { logger } from '../logger';
import { metrics } from '../metrics';

/**
 * Create a monitored queue with automatic metrics and logging
 */
export function createMonitoredQueue(name: string, options?: any): Queue {
  const queue = new Queue(name, options);

  // Monitor queue events
  queue.on('waiting', (jobId: string) => {
    logger.logQueueJob(name, jobId, 'created');
    metrics.queueJobsTotal.inc({ queue: name, status: 'waiting' });
    updateQueueDepth(queue);
  });

  queue.on('completed', (job: Job, result: any) => {
    logger.logQueueJob(name, job.id!, 'completed', {
      duration: Date.now() - job.timestamp,
    });
    metrics.queueJobsTotal.inc({ queue: name, status: 'completed' });
    metrics.queueJobDuration.observe(
      { queue: name },
      (Date.now() - job.timestamp) / 1000
    );
    updateQueueDepth(queue);
  });

  queue.on('failed', (job: Job | undefined, err: Error) => {
    if (job) {
      logger.logQueueJob(name, job.id!, 'failed', {
        error: err,
        attempts: job.attemptsMade,
      });
      metrics.queueJobsTotal.inc({ queue: name, status: 'failed' });
    }
    updateQueueDepth(queue);
  });

  queue.on('stalled', (jobId: string) => {
    logger.logQueueJob(name, jobId, 'stalled');
    metrics.queueJobsTotal.inc({ queue: name, status: 'stalled' });
  });

  // Periodically update queue depth metrics
  const updateInterval = setInterval(() => updateQueueDepth(queue), 10000);
  
  // Clean up on queue close
  queue.on('close', () => {
    clearInterval(updateInterval);
  });

  return queue;
}

/**
 * Create a monitored worker with automatic metrics and logging
 */
export function createMonitoredWorker<T = any, R = any>(
  name: string,
  processor: (job: Job<T>) => Promise<R>,
  options?: any
): Worker<T, R> {
  const workerId = `worker-${name}-${Date.now()}`;

  const monitoredProcessor = async (job: Job<T>): Promise<R> => {
    const startTime = Date.now();
    
    logger.logQueueJob(name, job.id!, 'started', {
      workerId,
      attempt: job.attemptsMade + 1,
    });

    try {
      const result = await processor(job);
      
      const duration = Date.now() - startTime;
      logger.logQueueJob(name, job.id!, 'completed', {
        workerId,
        duration,
      });

      // Record job-specific metrics
      logger.logPerformanceMetric(
        `queue.${name}.job.duration`,
        duration,
        'ms',
        {
          worker_id: workerId,
        }
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.logQueueJob(name, job.id!, 'failed', {
        workerId,
        duration,
        error: error as Error,
      });

      // Log security event if the error seems suspicious
      if (error instanceof Error && error.message.includes('unauthorized')) {
        logger.logSecurityEvent('queue_unauthorized_job', 'medium', {
          queue: name,
          jobId: job.id,
          error: error.message,
        });
      }

      throw error;
    }
  };

  const worker = new Worker<T, R>(name, monitoredProcessor, options);

  // Monitor worker events
  worker.on('active', (job: Job<T>) => {
    logger.debug({
      type: 'worker_active',
      workerId,
      jobId: job.id,
      queue: name,
    }, 'Worker processing job');
  });

  worker.on('completed', (job: Job<T>, result: R) => {
    metrics.queueJobsTotal.inc({ queue: name, status: 'processed' });
  });

  worker.on('failed', (job: Job<T> | undefined, error: Error) => {
    logger.error({
      type: 'worker_job_failed',
      workerId,
      jobId: job?.id,
      queue: name,
      err: error,
    }, 'Worker job failed');
  });

  // Monitor worker utilization
  let activeJobs = 0;
  worker.on('active', () => {
    activeJobs++;
    updateWorkerUtilization(workerId, activeJobs, worker.concurrency);
  });

  worker.on('completed', () => {
    activeJobs--;
    updateWorkerUtilization(workerId, activeJobs, worker.concurrency);
  });

  worker.on('failed', () => {
    activeJobs--;
    updateWorkerUtilization(workerId, activeJobs, worker.concurrency);
  });

  // Monitor worker health
  const healthCheckInterval = setInterval(() => {
    checkWorkerHealth(worker, workerId);
  }, 30000); // Every 30 seconds

  worker.on('close', () => {
    clearInterval(healthCheckInterval);
    logger.info({
      type: 'worker_closed',
      workerId,
      queue: name,
    }, 'Worker closed');
  });

  return worker;
}

/**
 * Update queue depth metrics
 */
async function updateQueueDepth(queue: Queue) {
  try {
    const [waiting, active, delayed, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    metrics.queueDepth.set({ queue: queue.name, status: 'waiting' }, waiting);
    metrics.queueDepth.set({ queue: queue.name, status: 'active' }, active);
    metrics.queueDepth.set({ queue: queue.name, status: 'delayed' }, delayed);
    metrics.queueDepth.set({ queue: queue.name, status: 'completed' }, completed);
    metrics.queueDepth.set({ queue: queue.name, status: 'failed' }, failed);

    // Log if queue is getting too deep
    if (waiting > 1000) {
      logger.warn({
        type: 'queue_depth_warning',
        queue: queue.name,
        waiting,
        active,
      }, 'Queue depth is high');
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to update queue depth metrics');
  }
}

/**
 * Update worker utilization metrics
 */
function updateWorkerUtilization(
  workerId: string,
  activeJobs: number,
  concurrency: number
) {
  const utilization = (activeJobs / concurrency) * 100;
  metrics.queueWorkerUtilization.set({ worker_id: workerId }, utilization);
}

/**
 * Check worker health
 */
async function checkWorkerHealth(worker: Worker, workerId: string) {
  try {
    if (worker.isPaused()) {
      logger.warn({
        type: 'worker_paused',
        workerId,
      }, 'Worker is paused');
    }

    if (worker.isRunning()) {
      logger.debug({
        type: 'worker_health_check',
        workerId,
        running: true,
      }, 'Worker health check passed');
    } else {
      logger.error({
        type: 'worker_not_running',
        workerId,
      }, 'Worker is not running');
    }
  } catch (error) {
    logger.error({
      type: 'worker_health_check_failed',
      workerId,
      err: error,
    }, 'Worker health check failed');
  }
}

/**
 * Create monitored job options with tracking
 */
export function createMonitoredJobOptions(
  jobName: string,
  userId?: string,
  metadata?: any
) {
  return {
    ...metadata,
    // Add tracking metadata
    trackingId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    createdAt: new Date().toISOString(),
    // Add attempts configuration with monitoring
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    // Remove on complete to save memory
    removeOnComplete: {
      count: 100,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 1000,
      age: 7 * 24 * 3600, // 7 days
    },
  };
}

/**
 * Monitor queue job progress
 */
export async function reportJobProgress(
  job: Job,
  progress: number,
  stage?: string
) {
  await job.updateProgress(progress);
  
  logger.debug({
    type: 'job_progress',
    queue: job.queueName,
    jobId: job.id,
    progress,
    stage,
  }, 'Job progress update');

  // Log performance metric for stage completion
  if (stage && progress === 100) {
    logger.logPerformanceMetric(
      `queue.${job.queueName}.stage.${stage}`,
      job.processedOn ? Date.now() - job.processedOn : 0,
      'ms'
    );
  }
}