import { createClient } from '@/lib/supabase/server'
import { WebhookConfig, WebhookEventType, WebhookDeliveryLog } from '../types'
import { apiErrors } from '../response'
import { sendWebhook, queueWebhookDelivery } from '../webhook'
import { getQueue } from '@/lib/queue/client'
import crypto from 'crypto'

/**
 * Webhook Manager for CRUD operations and delivery management
 */
export class WebhookManager {
  private static instance: WebhookManager

  private constructor() {}

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager()
    }
    return WebhookManager.instance
  }

  /**
   * Create a new webhook configuration
   */
  async createWebhook(
    userId: string,
    config: {
      url: string
      events: WebhookEventType[]
      headers?: Record<string, string>
      retryPolicy?: {
        max_attempts?: number
        initial_delay_ms?: number
        backoff_multiplier?: number
        max_delay_ms?: number
      }
    }
  ): Promise<WebhookConfig> {
    const supabase = await createClient()
    
    // Generate secure webhook secret
    const secret = crypto.randomBytes(32).toString('hex')
    
    // Validate URL
    try {
      const url = new URL(config.url)
      if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
        throw new Error('Webhook URLs must use HTTPS in production')
      }
    } catch (error) {
      throw apiErrors.VALIDATION_ERROR('Invalid webhook URL')
    }
    
    // Create webhook config
    const { data, error } = await supabase
      .from('webhook_configs')
      .insert({
        user_id: userId,
        url: config.url,
        secret,
        events: config.events,
        headers: config.headers || {},
        retry_policy: {
          max_attempts: config.retryPolicy?.max_attempts || 3,
          initial_delay_ms: config.retryPolicy?.initial_delay_ms || 1000,
          backoff_multiplier: config.retryPolicy?.backoff_multiplier || 2,
          max_delay_ms: config.retryPolicy?.max_delay_ms || 30000
        }
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create webhook:', error)
      throw apiErrors.INTERNAL_ERROR
    }
    
    return data
  }

  /**
   * List webhook configurations for a user
   */
  async listWebhooks(
    userId: string,
    options?: {
      isActive?: boolean
      events?: WebhookEventType[]
    }
  ): Promise<WebhookConfig[]> {
    const supabase = await createClient()
    
    let query = supabase
      .from('webhook_configs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive)
    }
    
    if (options?.events && options.events.length > 0) {
      query = query.contains('events', options.events)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Failed to list webhooks:', error)
      throw apiErrors.INTERNAL_ERROR
    }
    
    return data || []
  }

  /**
   * Get a specific webhook configuration
   */
  async getWebhook(userId: string, webhookId: string): Promise<WebhookConfig> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('id', webhookId)
      .eq('user_id', userId)
      .single()
    
    if (error || !data) {
      throw apiErrors.NOT_FOUND
    }
    
    return data
  }

  /**
   * Update a webhook configuration
   */
  async updateWebhook(
    userId: string,
    webhookId: string,
    updates: Partial<{
      url: string
      events: WebhookEventType[]
      is_active: boolean
      headers: Record<string, string>
      retry_policy: WebhookConfig['retry_policy']
    }>
  ): Promise<WebhookConfig> {
    const supabase = await createClient()
    
    // Validate URL if provided
    if (updates.url) {
      try {
        const url = new URL(updates.url)
        if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
          throw new Error('Webhook URLs must use HTTPS in production')
        }
      } catch (error) {
        throw apiErrors.VALIDATION_ERROR('Invalid webhook URL')
      }
    }
    
    const { data, error } = await supabase
      .from('webhook_configs')
      .update(updates)
      .eq('id', webhookId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error || !data) {
      throw apiErrors.NOT_FOUND
    }
    
    return data
  }

  /**
   * Delete a webhook configuration
   */
  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('webhook_configs')
      .delete()
      .eq('id', webhookId)
      .eq('user_id', userId)
    
    if (error) {
      throw apiErrors.NOT_FOUND
    }
  }

  /**
   * Rotate webhook secret
   */
  async rotateWebhookSecret(
    userId: string,
    webhookId: string
  ): Promise<{ secret: string }> {
    const supabase = await createClient()
    
    // Generate new secret
    const newSecret = crypto.randomBytes(32).toString('hex')
    
    const { error } = await supabase
      .from('webhook_configs')
      .update({ secret: newSecret })
      .eq('id', webhookId)
      .eq('user_id', userId)
    
    if (error) {
      throw apiErrors.NOT_FOUND
    }
    
    return { secret: newSecret }
  }

  /**
   * Get webhook delivery logs
   */
  async getDeliveryLogs(
    userId: string,
    webhookId: string,
    options?: {
      eventType?: WebhookEventType
      delivered?: boolean
      limit?: number
      offset?: number
    }
  ): Promise<WebhookDeliveryLog[]> {
    const supabase = await createClient()
    
    // Verify webhook ownership
    await this.getWebhook(userId, webhookId)
    
    let query = supabase
      .from('webhook_delivery_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
    
    if (options?.eventType) {
      query = query.eq('event_type', options.eventType)
    }
    
    if (options?.delivered !== undefined) {
      query = options.delivered
        ? query.not('delivered_at', 'is', null)
        : query.is('delivered_at', null)
    }
    
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Failed to get delivery logs:', error)
      throw apiErrors.INTERNAL_ERROR
    }
    
    return data || []
  }

  /**
   * Retry a failed webhook delivery
   */
  async retryDelivery(
    userId: string,
    webhookId: string,
    deliveryLogId: string
  ): Promise<void> {
    const supabase = await createClient()
    
    // Verify webhook ownership
    const webhook = await this.getWebhook(userId, webhookId)
    
    // Get delivery log
    const { data: log, error } = await supabase
      .from('webhook_delivery_logs')
      .select('*')
      .eq('id', deliveryLogId)
      .eq('webhook_id', webhookId)
      .single()
    
    if (error || !log) {
      throw apiErrors.NOT_FOUND
    }
    
    // Queue for retry
    await queueWebhookDelivery(webhook.url, log.payload, log.id)
  }

  /**
   * Trigger a webhook for an event
   */
  async triggerWebhooks(
    userId: string,
    eventType: WebhookEventType,
    payload: unknown
  ): Promise<void> {
    // Get active webhooks for this event
    const webhooks = await this.listWebhooks(userId, {
      isActive: true,
      events: [eventType]
    })
    
    // Queue delivery for each webhook
    const deliveryPromises = webhooks
      .filter(webhook => webhook.events.includes(eventType))
      .map(webhook => this.queueDelivery(webhook, eventType, payload))
    
    await Promise.allSettled(deliveryPromises)
  }

  /**
   * Queue webhook for delivery
   */
  async queueDelivery(
    config: WebhookConfig,
    eventType: WebhookEventType,
    payload: unknown
  ): Promise<string> {
    const queue = getQueue('webhook')
    
    const job = await queue.add(
      'deliver-webhook',
      {
        webhookId: config.id,
        url: config.url,
        secret: config.secret,
        headers: config.headers,
        retryPolicy: config.retry_policy,
        eventType,
        payload: {
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload
        }
      },
      {
        attempts: config.retry_policy.max_attempts,
        backoff: {
          type: 'exponential',
          delay: config.retry_policy.initial_delay_ms
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    )
    
    // Create delivery log
    const supabase = await createClient()
    await supabase
      .from('webhook_delivery_logs')
      .insert({
        webhook_id: config.id,
        event_type: eventType,
        payload: {
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload
        },
        attempt_count: 0
      })
    
    return job.id!
  }

  /**
   * Validate webhook signature
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp?: number
  ): boolean {
    // Check timestamp freshness (5 minutes)
    if (timestamp) {
      const now = Date.now()
      const age = Math.abs(now - timestamp)
      if (age > 5 * 60 * 1000) {
        return false
      }
    }
    
    // Compute expected signature
    const hmac = crypto.createHmac('sha256', secret)
    const data = timestamp ? `${timestamp}.${payload}` : payload
    hmac.update(data)
    const expectedSignature = hmac.digest('hex')
    
    // Constant-time comparison
    const sig = Buffer.from(signature)
    const expected = Buffer.from(expectedSignature)
    
    // Buffers must be same length for timingSafeEqual
    if (sig.length !== expected.length) {
      return false
    }
    
    return crypto.timingSafeEqual(sig, expected)
  }
}

// Export singleton instance
export const webhookManager = WebhookManager.getInstance()