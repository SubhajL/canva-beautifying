import crypto from 'crypto'
import { apiErrors } from '../response'

// Configuration
const TOKEN_EXPIRY_MINUTES = 60 // 1 hour default
const HMAC_ALGORITHM = 'sha256'

interface SecureDownloadConfig {
  secret: string
  baseUrl: string
}

interface SecureDownloadToken {
  documentId: string
  userId: string
  expires: number
  nonce: string
}

/**
 * Get secure download configuration from environment
 */
function getConfig(): SecureDownloadConfig {
  const secret = process.env.DOWNLOAD_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('DOWNLOAD_SECRET or NEXTAUTH_SECRET must be set')
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  
  return {
    secret,
    baseUrl: baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
  }
}

/**
 * Generate HMAC signature for token data
 */
function generateSignature(data: string, secret: string): string {
  return crypto
    .createHmac(HMAC_ALGORITHM, secret)
    .update(data)
    .digest('hex')
}

/**
 * Generate a secure download URL with time-limited token
 */
export function generateSecureDownloadUrl(
  documentId: string,
  userId: string,
  expiryMinutes: number = TOKEN_EXPIRY_MINUTES
): string {
  const config = getConfig()
  
  // Create token data
  const token: SecureDownloadToken = {
    documentId,
    userId,
    expires: Date.now() + (expiryMinutes * 60 * 1000),
    nonce: crypto.randomBytes(16).toString('hex')
  }
  
  // Create signed payload
  const payload = Buffer.from(JSON.stringify(token)).toString('base64url')
  const signature = generateSignature(payload, config.secret)
  
  // Construct secure URL
  const url = new URL(`/api/v1/secure-download/${documentId}`, config.baseUrl)
  url.searchParams.set('token', payload)
  url.searchParams.set('sig', signature)
  
  return url.toString()
}

/**
 * Parse and validate a secure download token
 */
export function validateSecureDownloadToken(
  token: string,
  signature: string,
  expectedDocumentId?: string
): SecureDownloadToken {
  const config = getConfig()
  
  // Verify signature
  const expectedSignature = generateSignature(token, config.secret)
  
  // Use timing-safe comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    throw apiErrors.INVALID_TOKEN
  }
  
  // Parse token
  let tokenData: SecureDownloadToken
  try {
    const json = Buffer.from(token, 'base64url').toString('utf-8')
    tokenData = JSON.parse(json)
  } catch (error) {
    throw apiErrors.INVALID_TOKEN
  }
  
  // Validate token structure
  if (!tokenData.documentId || !tokenData.userId || !tokenData.expires || !tokenData.nonce) {
    throw apiErrors.INVALID_TOKEN
  }
  
  // Check expiration
  if (Date.now() > tokenData.expires) {
    throw apiErrors.TOKEN_EXPIRED
  }
  
  // Validate document ID if provided
  if (expectedDocumentId && tokenData.documentId !== expectedDocumentId) {
    throw apiErrors.INVALID_TOKEN
  }
  
  return tokenData
}

/**
 * Generate a secure download URL for webhook callbacks
 * Uses a longer expiry time suitable for async processing
 */
export function generateWebhookDownloadUrl(
  documentId: string,
  userId: string,
  expiryHours: number = 24
): string {
  return generateSecureDownloadUrl(documentId, userId, expiryHours * 60)
}

/**
 * Check if a URL contains potential API key patterns
 * Used for security monitoring
 */
export function containsApiKeyPattern(url: string): boolean {
  const patterns = [
    /[?&](api_?key|apikey|key|token|auth|authorization)=/i,
    /(bai_[a-f0-9]{64})/i, // Our API key format
    /Bearer\s+[a-zA-Z0-9\-_]+/i, // Bearer tokens in URL
  ]
  
  return patterns.some(pattern => pattern.test(url))
}