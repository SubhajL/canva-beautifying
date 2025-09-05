import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAPIResponse, apiErrors } from '@/lib/api/response'

export function withValidation<T>(
  schema: z.ZodSchema<T>
) {
  return async (
    request: NextRequest,
    handler: (request: NextRequest, data: T, ...args: any[]) => Promise<NextResponse>,
    ...handlerArgs: any[]
  ): Promise<NextResponse> => {
    try {
      // Parse request body
      const body = await request.json()
      
      // Validate against schema
      const validatedData = schema.parse(body)
      
      // Call handler with validated data
      return handler(request, validatedData, ...handlerArgs)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createAPIResponse(
          null,
          apiErrors.badRequest(
            'Validation failed',
            error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          )
        )
      }
      
      return createAPIResponse(
        null,
        apiErrors.badRequest('Invalid request body')
      )
    }
  }
}