import { WebhookPayload, webhookPayloadSchema } from './validation'
import { createWebhookSignature } from './webhooks/signature'

interface WebhookDeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
  retryable?: boolean
}

/**
 * Sends a webhook notification to the specified URL
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  options: {
    timeout?: number
    retries?: number
    secret?: string
    headers?: Record<string, string>
  } = {}
): Promise<WebhookDeliveryResult> {
  const { timeout = 10000, retries = 3, secret, headers: customHeaders } = options
  
  // Validate payload
  try {
    webhookPayloadSchema.parse(payload)
  } catch (error) {
    console.error('Invalid webhook payload:', error)
    return { success: false, error: 'Invalid payload' }
  }
  
  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'BeautifyAI/1.0',
    'X-BeautifyAI-Event': payload.event,
    'X-BeautifyAI-Timestamp': payload.timestamp,
    ...customHeaders
  }
  
  // Add HMAC signature if secret is provided
  if (secret) {
    const { headers: signatureHeaders } = createWebhookSignature(payload, secret)
    Object.assign(headers, signatureHeaders)
  }
  
  // Attempt delivery with retries
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      // Success
      if (response.ok) {
        return { success: true, statusCode: response.status }
      }
      
      // Client error (4xx) - don't retry
      if (response.status >= 400 && response.status < 500) {
        return {
          success: false,
          statusCode: response.status,
          error: `Client error: ${response.status} ${response.statusText}`,
          retryable: false,
        }
      }
      
      // Server error (5xx) - retry
      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      return {
        success: false,
        statusCode: response.status,
        error: `Server error: ${response.status} ${response.statusText}`,
        retryable: true,
      }
      
    } catch (error) {
      // Network error or timeout
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      }
    }
  }
  
  return { success: false, error: 'Max retries exceeded', retryable: true }
}


/**
 * Creates webhook payloads for different events
 */
export const webhookEvents = {
  enhancementStarted: (enhancementId: string, _documentId: string): WebhookPayload => ({
    event: 'enhancement.started',
    timestamp: new Date().toISOString(),
    data: {
      enhancementId,
      status: 'processing',
      progress: 0,
    },
  }),
  
  enhancementProgress: (
    enhancementId: string,
    progress: number,
    _currentStage?: string
  ): WebhookPayload => ({
    event: 'enhancement.progress',
    timestamp: new Date().toISOString(),
    data: {
      enhancementId,
      status: 'processing',
      progress,
    },
  }),
  
  enhancementCompleted: (
    enhancementId: string,
    result: {
      enhancedFileUrl: string
      thumbnailUrl?: string
      improvements?: { before: number; after: number }
      enhancementsApplied?: string[]
      processingTime?: number
      metadata?: Record<string, unknown>
    }
  ): WebhookPayload => ({
    event: 'enhancement.completed',
    timestamp: new Date().toISOString(),
    data: {
      enhancementId,
      status: 'completed',
      progress: 100,
      result,
    },
  }),
  
  enhancementFailed: (
    enhancementId: string,
    error: { code: string; message: string; details?: Record<string, unknown> }
  ): WebhookPayload => ({
    event: 'enhancement.failed',
    timestamp: new Date().toISOString(),
    data: {
      enhancementId,
      status: 'failed',
      error,
    },
  }),
}

/**
 * Queue webhook delivery job
 */
export async function queueWebhookDelivery(
  url: string,
  payload: WebhookPayload,
  enhancementId: string,
  options?: {
    secret?: string
    headers?: Record<string, string>
    retryPolicy?: {
      max_attempts?: number
      initial_delay_ms?: number
      backoff_multiplier?: number
      max_delay_ms?: number
    }
  }
): Promise<void> {
  const { getQueue } = await import('@/lib/queue/client')
  const queue = getQueue('webhook')
  
  await queue.add(
    'deliver-webhook',
    {
      webhookId: enhancementId, // Using enhancement ID as webhook ID for now
      url,
      secret: options?.secret || '',
      headers: options?.headers || {},
      retryPolicy: {
        max_attempts: options?.retryPolicy?.max_attempts || 3,
        initial_delay_ms: options?.retryPolicy?.initial_delay_ms || 1000,
        backoff_multiplier: options?.retryPolicy?.backoff_multiplier || 2,
        max_delay_ms: options?.retryPolicy?.max_delay_ms || 30000
      },
      eventType: payload.event as any,
      payload
    },
    {
      attempts: options?.retryPolicy?.max_attempts || 3,
      backoff: {
        type: 'exponential',
        delay: options?.retryPolicy?.initial_delay_ms || 1000
      }
    }
  )
}