import { NextRequest } from 'next/server'
import { User } from '@supabase/supabase-js'
import { authenticateRequest as authenticateJWT } from '../middleware'
import { authenticateAPIKey, hasRequiredScopes } from './api-key'
import { APIKeyAuth, APIKeyScope } from '../types'
import { apiErrors } from '../response'

export * from './api-key'

export type AuthResult = 
  | { type: 'jwt'; user: User; userId: string }
  | { type: 'api-key'; auth: APIKeyAuth; userId: string }

/**
 * Unified authentication that supports both JWT and API keys
 */
export async function authenticate(
  request: NextRequest
): Promise<AuthResult> {
  // Check for API key first
  const apiKeyHeader = request.headers.get('x-api-key')
  const authHeader = request.headers.get('authorization')
  
  // If API key is present, use API key auth
  if (apiKeyHeader || authHeader?.includes('_')) {
    try {
      const auth = await authenticateAPIKey(request)
      return {
        type: 'api-key',
        auth,
        userId: auth.userId
      }
    } catch (error) {
      // If API key auth fails and no JWT is present, throw
      if (!authHeader?.startsWith('Bearer ') || authHeader.includes('_')) {
        throw error
      }
      // Otherwise, fall through to JWT auth
    }
  }
  
  // Use JWT authentication
  const { user, userId } = await authenticateJWT(request)
  return {
    type: 'jwt',
    user,
    userId
  }
}

/**
 * Authorization helper that checks scopes for API key auth
 */
export async function authorize(
  request: NextRequest,
  requiredScopes?: APIKeyScope[]
): Promise<AuthResult> {
  const auth = await authenticate(request)
  
  // If scopes are required and auth is API key, check them
  if (requiredScopes && auth.type === 'api-key') {
    if (!hasRequiredScopes(auth.auth, requiredScopes)) {
      throw apiErrors.FORBIDDEN
    }
  }
  
  return auth
}

/**
 * Middleware helper to require authentication
 */
export function requireAuth(
  handler: (req: NextRequest, auth: AuthResult) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    const auth = await authenticate(req)
    return handler(req, auth)
  }
}

/**
 * Middleware helper to require specific scopes
 */
export function requireScopes(
  scopes: APIKeyScope[],
  handler: (req: NextRequest, auth: AuthResult) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    const auth = await authorize(req, scopes)
    return handler(req, auth)
  }
}