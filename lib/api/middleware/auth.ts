import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAPIResponse, apiErrors } from '@/lib/api/response'

export function withAuth(handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      // Get authorization header
      const authHeader = request.headers.get('authorization')
      console.log('[Auth Middleware] Authorization header:', authHeader)
      console.log('[Auth Middleware] Headers:', Object.fromEntries(request.headers.entries()))
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[Auth Middleware] Rejecting - invalid header format')
        return createAPIResponse(
          null,
          apiErrors.unauthorized('Missing or invalid authorization header')
        )
      }

      // Extract token
      const token = authHeader.slice(7)
      
      // Verify token with Supabase
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser(token)
      
      if (error || !user) {
        return createAPIResponse(
          null,
          apiErrors.unauthorized('Invalid or expired token')
        )
      }

      // Add user to request context
      const context = { ...args[0], user }
      
      // Call the handler with the authenticated context
      return handler(request, context, ...args.slice(1))
    } catch (error) {
      console.error('Auth middleware error:', error)
      return createAPIResponse(
        null,
        apiErrors.internalServerError('Authentication failed')
      )
    }
  }
}