import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { APIKey, APIKeyAuth, APIKeyScope } from '../types'
import { apiErrors } from '../response'
import crypto from 'crypto'

// Constants
const API_KEY_PREFIX = 'bai'
const API_KEY_LENGTH = 32
const HASH_ALGORITHM = 'sha256'
const SALT_LENGTH = 16

/**
 * Generates a secure API key with prefix
 */
export function generateSecureAPIKey(prefix: string = API_KEY_PREFIX): {
  key: string
  hash: string
  salt: string
} {
  // Generate random bytes for the key
  const keyBytes = crypto.randomBytes(API_KEY_LENGTH)
  const keyHex = keyBytes.toString('hex')
  
  // Create the full key with prefix
  const fullKey = `${prefix}_${keyHex}`
  
  // Generate salt for hashing
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
  
  // Hash the key with salt
  const hash = hashAPIKey(fullKey, salt)
  
  return {
    key: fullKey,
    hash,
    salt
  }
}

/**
 * Hashes an API key with salt
 */
function hashAPIKey(key: string, salt: string): string {
  return crypto
    .createHash(HASH_ALGORITHM)
    .update(key + salt)
    .digest('hex')
}

/**
 * Extracts API key from request
 * Throws error if API key is detected in query parameters
 */
function extractAPIKey(request: NextRequest): string | null {
  // Check for API key in query parameters (security violation)
  const url = new URL(request.url)
  const queryKey = url.searchParams.get('api_key') || url.searchParams.get('apikey') || url.searchParams.get('key')
  
  if (queryKey) {
    // Log security warning
    console.error('[SECURITY WARNING] API key detected in query parameters:', {
      url: request.url,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    
    throw apiErrors.INSECURE_API_KEY_USAGE
  }
  
  // Check X-API-Key header
  const headerKey = request.headers.get('x-api-key')
  if (headerKey) return headerKey
  
  // Check Authorization header with Bearer token
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    // Check if it's an API key format
    if (token.startsWith(`${API_KEY_PREFIX}_`)) {
      return token
    }
  }
  
  return null
}

/**
 * Validates API key from request
 */
export async function authenticateAPIKey(
  request: NextRequest
): Promise<APIKeyAuth> {
  const apiKey = extractAPIKey(request)
  
  if (!apiKey) {
    throw apiErrors.UNAUTHORIZED
  }
  
  // Validate key format
  if (!apiKey.startsWith(`${API_KEY_PREFIX}_`)) {
    throw apiErrors.INVALID_TOKEN
  }
  
  const supabase = await createClient()
  
  // Look up API key in database
  // First, get all active keys (we need to check hashes)
  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('is_active', true)
    .eq('prefix', API_KEY_PREFIX)
  
  if (error) {
    console.error('Failed to fetch API keys:', error)
    throw apiErrors.INTERNAL_ERROR
  }
  
  if (!keys || keys.length === 0) {
    throw apiErrors.INVALID_TOKEN
  }
  
  // Check each key's hash
  let matchedKey: APIKey | null = null
  
  for (const key of keys) {
    const hash = hashAPIKey(apiKey, key.salt)
    if (hash === key.key_hash) {
      matchedKey = key
      break
    }
  }
  
  if (!matchedKey) {
    throw apiErrors.INVALID_TOKEN
  }
  
  // Check expiration
  if (matchedKey.expires_at && new Date(matchedKey.expires_at) < new Date()) {
    throw apiErrors.TOKEN_EXPIRED
  }
  
  // Update last used timestamp
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', matchedKey.id)
  
  // Parse scopes
  const scopes = (matchedKey.scopes || []) as APIKeyScope[]
  
  return {
    apiKey: matchedKey,
    userId: matchedKey.user_id,
    scopes
  }
}

/**
 * Checks if API key has required scopes
 */
export function hasRequiredScopes(
  auth: APIKeyAuth,
  requiredScopes: APIKeyScope[]
): boolean {
  // Admin scope has access to everything
  if (auth.scopes.includes('admin:all')) {
    return true
  }
  
  // Check each required scope
  return requiredScopes.every(scope => auth.scopes.includes(scope))
}

/**
 * Creates a new API key for a user
 */
export async function createAPIKey(
  userId: string,
  name: string,
  scopes: APIKeyScope[],
  expiresIn?: number // days
): Promise<{
  key: string
  apiKey: APIKey
}> {
  const supabase = await createClient()
  
  // Generate key
  const { key, hash, salt } = generateSecureAPIKey()
  
  // Calculate expiration
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
    : null
  
  // Store in database
  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: userId,
      name,
      key_hash: hash,
      salt,
      prefix: API_KEY_PREFIX,
      scopes,
      expires_at: expiresAt,
      is_active: true
    })
    .select()
    .single()
  
  if (error) {
    console.error('Failed to create API key:', error)
    throw apiErrors.INTERNAL_ERROR
  }
  
  return {
    key, // Return the actual key only once
    apiKey: data
  }
}

/**
 * Lists API keys for a user
 */
export async function listAPIKeys(userId: string): Promise<APIKey[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Failed to list API keys:', error)
    throw apiErrors.INTERNAL_ERROR
  }
  
  return data || []
}

/**
 * Revokes an API key
 */
export async function revokeAPIKey(
  userId: string,
  keyId: string
): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('user_id', userId)
  
  if (error) {
    console.error('Failed to revoke API key:', error)
    throw apiErrors.INTERNAL_ERROR
  }
}

/**
 * Rotates an API key
 */
export async function rotateAPIKey(
  userId: string,
  oldKeyId: string,
  gracePeriodDays: number = 7
): Promise<{
  key: string
  apiKey: APIKey
}> {
  const supabase = await createClient()
  
  // Get old key details
  const { data: oldKey, error: fetchError } = await supabase
    .from('api_keys')
    .select('*')
    .eq('id', oldKeyId)
    .eq('user_id', userId)
    .single()
  
  if (fetchError || !oldKey) {
    throw apiErrors.NOT_FOUND
  }
  
  // Create new key with same scopes
  const newKey = await createAPIKey(
    userId,
    `${oldKey.name} (Rotated)`,
    oldKey.scopes
  )
  
  // Set grace period for old key
  const graceExpiration = new Date(
    Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000
  ).toISOString()
  
  await supabase
    .from('api_keys')
    .update({
      expires_at: graceExpiration,
      metadata: {
        ...oldKey.metadata,
        rotated_to: newKey.apiKey.id,
        rotation_date: new Date().toISOString()
      }
    })
    .eq('id', oldKeyId)
  
  return newKey
}