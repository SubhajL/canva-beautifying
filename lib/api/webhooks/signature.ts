import crypto from 'crypto'

/**
 * Creates webhook signature headers for secure delivery
 */
export function createWebhookSignature(
  payload: any,
  secret: string
): {
  headers: Record<string, string>
  signature: string
  timestamp: string
} {
  const timestamp = Date.now().toString()
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
  
  // Create signature with timestamp to prevent replay attacks
  const signaturePayload = `${timestamp}.${payloadString}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(signaturePayload)
  const signature = hmac.digest('hex')
  
  return {
    headers: {
      'X-BeautifyAI-Signature': signature,
      'X-BeautifyAI-Signature-Timestamp': timestamp
    },
    signature,
    timestamp
  }
}

/**
 * Verifies webhook signature from incoming request
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes
): boolean {
  // Check timestamp freshness
  const now = Date.now()
  const requestTime = parseInt(timestamp, 10)
  
  if (isNaN(requestTime)) {
    return false
  }
  
  const age = Math.abs(now - requestTime)
  if (age > maxAgeMs) {
    return false
  }
  
  // Compute expected signature
  const signaturePayload = `${timestamp}.${payload}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(signaturePayload)
  const expectedSignature = hmac.digest('hex')
  
  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Extract signature components from webhook headers
 */
export function extractSignatureComponents(headers: Record<string, string | string[]>) {
  const signature = Array.isArray(headers['x-beautifyai-signature']) 
    ? headers['x-beautifyai-signature'][0] 
    : headers['x-beautifyai-signature']
    
  const timestamp = Array.isArray(headers['x-beautifyai-signature-timestamp'])
    ? headers['x-beautifyai-signature-timestamp'][0]
    : headers['x-beautifyai-signature-timestamp']
    
  return { signature, timestamp }
}