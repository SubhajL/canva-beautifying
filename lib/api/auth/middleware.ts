import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '../middleware'
import { apiErrors } from '../response'
import { APIRequestContext } from '../types'

/**
 * Higher-order function that creates authenticated route handlers
 */
export function withAuth<T extends (...args: any[]) => any>(
  handler: (request: NextRequest, context: APIRequestContext) => Promise<Response>
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    try {
      const { user, userId } = await authenticateRequest(request)
      const context: APIRequestContext = {
        version: 'v1',
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user,
        startTime: Date.now(),
        metadata: { userId }
      }
      
      return await handler(request, context)
    } catch (error) {
      if (error === apiErrors.UNAUTHORIZED || error === apiErrors.INVALID_TOKEN) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        )
      }
      throw error
    }
  }) as T
}