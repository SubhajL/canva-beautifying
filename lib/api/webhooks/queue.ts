import { Job } from 'bullmq'
import { sendWebhook } from '../webhook'
import { createClient } from '@/lib/supabase/server'
import { WebhookEventType } from '../types'

export interface WebhookDeliveryData {
  webhookId: string
  url: string
  secret: string
  headers?: Record<string, string>
  retryPolicy: {
    max_attempts: number
    initial_delay_ms: number
    backoff_multiplier: number
    max_delay_ms: number
  }
  eventType: WebhookEventType
  payload: {
    event: string
    timestamp: string
    data: unknown
  }
  deliveryLogId?: string
}

/**
 * Process webhook delivery job
 */
export async function processWebhookDelivery(
  job: Job<WebhookDeliveryData>
): Promise<void> {
  const {
    webhookId,
    url,
    secret,
    headers,
    retryPolicy,
    eventType,
    payload,
    deliveryLogId
  } = job.data
  
  const supabase = await createClient()
  
  // Create or get delivery log
  let logId = deliveryLogId
  if (!logId) {
    const { data: log } = await supabase
      .from('webhook_delivery_logs')
      .insert({
        webhook_id: webhookId,
        event_type: eventType,
        payload,
        attempt_count: 0
      })
      .select()
      .single()
    
    logId = log?.id
  }
  
  // Update attempt count
  const attemptNumber = job.attemptsMade + 1
  if (logId) {
    await supabase
      .from('webhook_delivery_logs')
      .update({
        attempt_count: attemptNumber,
        next_retry_at: attemptNumber < retryPolicy.max_attempts
          ? new Date(Date.now() + calculateBackoff(attemptNumber, retryPolicy)).toISOString()
          : null
      })
      .eq('id', logId)
  }
  
  try {
    // Send webhook
    const result = await sendWebhook(url, payload, {
      timeout: 10000,
      retries: 1, // We handle retries at job level
      secret,
      headers
    })
    
    if (result.success) {
      // Update delivery log with success
      if (logId) {
        await supabase
          .from('webhook_delivery_logs')
          .update({
            status_code: result.statusCode,
            delivered_at: new Date().toISOString(),
            next_retry_at: null
          })
          .eq('id', logId)
      }
      
      console.log(`Webhook delivered successfully to ${url}`)
    } else {
      // Update delivery log with failure
      if (logId) {
        await supabase
          .from('webhook_delivery_logs')
          .update({
            status_code: result.statusCode,
            error: result.error,
            response: result.error
          })
          .eq('id', logId)
      }
      
      // Throw error to trigger retry if retryable
      if (result.retryable) {
        throw new Error(`Webhook delivery failed: ${result.error}`)
      }
      
      // Non-retryable error, mark as failed
      console.error(`Non-retryable webhook failure for ${url}: ${result.error}`)
    }
  } catch (error) {
    // Update delivery log with error
    if (logId) {
      await supabase
        .from('webhook_delivery_logs')
        .update({
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', logId)
    }
    
    // Re-throw to trigger BullMQ retry
    throw error
  }
}

/**
 * Calculate backoff delay
 */
function calculateBackoff(
  attemptNumber: number,
  retryPolicy: {
    initial_delay_ms: number
    backoff_multiplier: number
    max_delay_ms: number
  }
): number {
  const delay = retryPolicy.initial_delay_ms * Math.pow(
    retryPolicy.backoff_multiplier,
    attemptNumber - 1
  )
  
  return Math.min(delay, retryPolicy.max_delay_ms)
}

/**
 * Clean up old webhook delivery logs
 */
export async function cleanupOldDeliveryLogs(
  daysToKeep: number = 30
): Promise<number> {
  const supabase = await createClient()
  
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)
  
  const { data, error } = await supabase
    .from('webhook_delivery_logs')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select('id')
  
  if (error) {
    console.error('Failed to cleanup webhook logs:', error)
    return 0
  }
  
  return data?.length || 0
}