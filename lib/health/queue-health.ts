import type { HealthCheckResult } from './types';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '@/lib/observability';

export async function checkQueueHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Create Redis connection for queue check
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    // Connect with timeout
    const connectPromise = redis.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );

    await Promise.race([connectPromise, timeoutPromise]);

    // Check main queues
    const queueNames = [
      'document-analysis',
      'enhancement-generation',
      'export-processing',
      'thumbnail-generation'
    ];

    const queueStats = await Promise.all(
      queueNames.map(async (name) => {
        try {
          const queue = new Queue(name, { connection: redis });
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
          ]);

          await queue.close();

          return {
            name,
            waiting,
            active,
            completed,
            failed,
            healthy: true
          };
        } catch (error) {
          return {
            name,
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    await redis.quit();

    const healthyQueues = queueStats.filter(q => q.healthy).length;
    const totalQueues = queueStats.length;
    const totalWaiting = queueStats.reduce((sum, q) => sum + q.waiting, 0);
    const totalActive = queueStats.reduce((sum, q) => sum + q.active, 0);
    const totalFailed = queueStats.reduce((sum, q) => sum + q.failed, 0);

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let error: string | undefined;

    if (healthyQueues === 0) {
      status = 'unhealthy';
      error = 'No queues are operational';
    } else if (healthyQueues < totalQueues) {
      status = 'degraded';
      error = `${totalQueues - healthyQueues} queues are not operational`;
    } else if (totalFailed > 100) {
      status = 'degraded';
      error = `High number of failed jobs: ${totalFailed}`;
    } else if (totalWaiting > 1000) {
      status = 'degraded';
      error = `Queue backlog is high: ${totalWaiting} waiting jobs`;
    }

    const responseTime = Date.now() - startTime;

    return {
      service: 'queue',
      status,
      responseTime,
      error,
      details: {
        queues: queueStats,
        summary: {
          healthy: healthyQueues,
          total: totalQueues,
          waiting: totalWaiting,
          active: totalActive,
          failed: totalFailed
        }
      }
    };
  } catch (error) {
    logger.error({ err: error }, 'Queue health check failed');
    return {
      service: 'queue',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Queue system unavailable'
    };
  }
}