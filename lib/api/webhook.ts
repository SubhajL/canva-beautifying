import { WebhookPayload, webhookPayloadSchema } from './validation'

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
  } = {}
): Promise<WebhookDeliveryResult> {
  const { timeout = 10000, retries = 3, secret } = options
  
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
  }
  
  // Add HMAC signature if secret is provided
  if (secret) {
    const signature = await generateHmacSignature(JSON.stringify(payload), secret)
    headers['X-BeautifyAI-Signature'] = signature
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
 * Generates HMAC signature for webhook payload
 */
async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
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
  enhancementId: string
): Promise<void> {
  // In production, this should be queued through BullMQ
  // For now, we'll send it directly with error handling
  try {
    const result = await sendWebhook(url, payload)
    
    if (!result.success) {
      console.error(`Webhook delivery failed for enhancement ${enhancementId}:`, result.error)
      
      // In production, store failed webhooks for retry/debugging
      // await storeFailedWebhook(enhancementId, url, payload, result)
    }
  } catch (error) {
    console.error(`Webhook delivery error for enhancement ${enhancementId}:`, error)
  }
}