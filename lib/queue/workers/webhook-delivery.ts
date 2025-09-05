import { Worker, Job } from 'bullmq'
import { processWebhookDelivery, WebhookDeliveryData } from '@/lib/api/webhooks/queue'
import { redis } from '../redis'
import { logger } from '@/lib/observability'

// Create webhook delivery worker
export const webhookDeliveryWorker = new Worker<WebhookDeliveryData>(
  'webhook',
  async (job: Job<WebhookDeliveryData>) => {
    logger.info({
      jobId: job.id,
      webhookId: job.data.webhookId,
      eventType: job.data.eventType,
      attempt: job.attemptsMade + 1
    }, 'Processing webhook delivery')
    
    try {
      await processWebhookDelivery(job)
      
      logger.info({
        jobId: job.id,
        webhookId: job.data.webhookId
      }, 'Webhook delivered successfully')
    } catch (error) {
      logger.error({
        err: error,
        jobId: job.id,
        webhookId: job.data.webhookId,
        attempt: job.attemptsMade + 1
      }, 'Webhook delivery failed')
      
      throw error
    }
  },
  {
    connection: redis,
    concurrency: 10,
    limiter: {
      max: 100,
      duration: 1000 // 100 webhooks per second max
    }
  }
)

// Error handling
webhookDeliveryWorker.on('failed', (job, err) => {
  if (!job) return
  
  logger.error({
    err,
    jobId: job.id,
    webhookId: job.data.webhookId,
    finalAttempt: job.attemptsMade >= job.opts.attempts!
  }, 'Webhook job failed')
})

// Stalled job handling
webhookDeliveryWorker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Webhook job stalled')
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down webhook delivery worker...')
  await webhookDeliveryWorker.close()
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('Shutting down webhook delivery worker...')
  await webhookDeliveryWorker.close()
  process.exit(0)
})