import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandling, asyncHandler } from '../error-middleware'
import { APIErrorHandler } from '@/lib/utils/api-error-handler'
import { v4 as uuidv4 } from 'uuid'

// Mock dependencies
jest.mock('@/lib/utils/api-error-handler')
jest.mock('uuid')

const mockHandleResponse = APIErrorHandler.handleResponse as jest.MockedFunction<
  typeof APIErrorHandler.handleResponse
>
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>

describe('Error Middleware', () => {
  let request: NextRequest

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
    mockUuidv4.mockReturnValue('test-request-id')
    
    // Create a mock request
    request = new NextRequest(new URL('http://localhost:5000/api/test'))
  })

  describe('withErrorHandling', () => {
    it('should handle successful requests', async () => {
      const mockResponse = new NextResponse('Success', { status: 200 })
      const handler = jest.fn().mockResolvedValue(mockResponse)

      const response = await withErrorHandling(request, handler)

      expect(handler).toHaveBeenCalledWith(request)
      expect(response).toBe(mockResponse)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    })

    it('should add request ID to response headers', async () => {
      const mockResponse = new NextResponse()
      const handler = jest.fn().mockResolvedValue(mockResponse)

      const response = await withErrorHandling(request, handler)

      expect(mockUuidv4).toHaveBeenCalled()
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    })

    it('should handle errors using APIErrorHandler', async () => {
      const error = new Error('Test error')
      const handler = jest.fn().mockRejectedValue(error)
      const errorResponse = new NextResponse('Error', { status: 500 })
      
      mockHandleResponse.mockReturnValue(errorResponse)

      const response = await withErrorHandling(request, handler)

      expect(handler).toHaveBeenCalledWith(request)
      expect(mockHandleResponse).toHaveBeenCalledWith(error, 'test-request-id')
      expect(response).toBe(errorResponse)
    })

    it('should handle non-Error objects', async () => {
      const errorString = 'String error'
      const handler = jest.fn().mockRejectedValue(errorString)
      const errorResponse = new NextResponse('Error', { status: 500 })
      
      mockHandleResponse.mockReturnValue(errorResponse)

      const response = await withErrorHandling(request, handler)

      expect(mockHandleResponse).toHaveBeenCalledWith(errorString, 'test-request-id')
      expect(response).toBe(errorResponse)
    })

    it('should preserve existing response headers', async () => {
      const mockResponse = new NextResponse('Success')
      mockResponse.headers.set('Content-Type', 'application/json')
      mockResponse.headers.set('Cache-Control', 'no-cache')
      
      const handler = jest.fn().mockResolvedValue(mockResponse)

      const response = await withErrorHandling(request, handler)

      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    })

    it('should generate unique request IDs', async () => {
      const handler1 = jest.fn().mockResolvedValue(new NextResponse())
      const handler2 = jest.fn().mockResolvedValue(new NextResponse())

      // Create new requests to ensure isolation
      const request1 = new NextRequest(new URL('http://localhost:3000/api/test1'))
      const request2 = new NextRequest(new URL('http://localhost:3000/api/test2'))

      // Mock uuid to return different values
      let callCount = 0
      mockUuidv4.mockImplementation(() => {
        callCount++
        return `id-${callCount}`
      })

      const response1 = await withErrorHandling(request1, handler1)
      const response2 = await withErrorHandling(request2, handler2)

      const id1 = response1.headers.get('X-Request-ID')
      const id2 = response2.headers.get('X-Request-ID')

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^id-\d+$/)
      expect(id2).toMatch(/^id-\d+$/)
    })
  })

  describe('asyncHandler', () => {
    it('should wrap handler with error handling', async () => {
      const mockResponse = new NextResponse('Success')
      const handler = jest.fn().mockResolvedValue(mockResponse)
      
      const wrappedHandler = asyncHandler(handler)
      const response = await wrappedHandler(request)

      expect(handler).toHaveBeenCalledWith(request, undefined)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    })

    it('should pass params to handler', async () => {
      const params = { id: '123', slug: 'test' }
      const mockResponse = new NextResponse('Success')
      const handler = jest.fn().mockResolvedValue(mockResponse)
      
      const wrappedHandler = asyncHandler(handler)
      const response = await wrappedHandler(request, params)

      expect(handler).toHaveBeenCalledWith(request, params)
      expect(response).toBe(mockResponse)
    })

    it('should handle errors in wrapped handler', async () => {
      const error = new Error('Handler error')
      const handler = jest.fn().mockRejectedValue(error)
      const errorResponse = new NextResponse('Error', { status: 500 })
      
      mockHandleResponse.mockReturnValue(errorResponse)
      
      const wrappedHandler = asyncHandler(handler)
      const response = await wrappedHandler(request)

      expect(mockHandleResponse).toHaveBeenCalledWith(error, 'test-request-id')
      expect(response).toBe(errorResponse)
    })

    it('should work with typed params', async () => {
      interface RouteParams {
        userId: string
        documentId: string
      }

      const params: RouteParams = {
        userId: 'user-123',
        documentId: 'doc-456'
      }

      const mockResponse = new NextResponse('Success')
      const handler = jest.fn<Promise<NextResponse>, [NextRequest, RouteParams]>()
        .mockResolvedValue(mockResponse)
      
      const wrappedHandler = asyncHandler<RouteParams>(handler)
      const response = await wrappedHandler(request, params)

      expect(handler).toHaveBeenCalledWith(request, params)
      expect(response).toBe(mockResponse)
    })

    it('should handle synchronous errors', async () => {
      const error = new Error('Sync error')
      const handler = jest.fn().mockImplementation(() => {
        throw error
      })
      const errorResponse = new NextResponse('Error', { status: 500 })
      
      mockHandleResponse.mockReturnValue(errorResponse)
      
      const wrappedHandler = asyncHandler(handler)
      const response = await wrappedHandler(request)

      expect(mockHandleResponse).toHaveBeenCalledWith(error, 'test-request-id')
      expect(response).toBe(errorResponse)
    })

    it('should preserve handler context', async () => {
      const context = { value: 'test-context' }
      const handler = jest.fn().mockImplementation(function(this: typeof context) {
        return Promise.resolve(new NextResponse(this.value))
      })

      const boundHandler = handler.bind(context)
      const wrappedHandler = asyncHandler(boundHandler)
      
      const response = await wrappedHandler(request)
      const text = await response.text()

      expect(text).toBe('test-context')
    })
  })

  describe('Integration', () => {
    it('should work with real NextRequest objects', async () => {
      const realRequest = new NextRequest(
        new URL('http://localhost:3000/api/test'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token'
          }
        }
      )

      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const response = await withErrorHandling(realRequest, handler)

      expect(handler).toHaveBeenCalledWith(realRequest)
      expect(response.headers.get('X-Request-ID')).toBe('test-request-id')
    })

    it('should handle complex error scenarios', async () => {
      const complexError = {
        name: 'ValidationError',
        message: 'Invalid input',
        statusCode: 400,
        details: {
          field: 'email',
          reason: 'invalid format'
        }
      }

      const handler = jest.fn().mockRejectedValue(complexError)
      const errorResponse = NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      )
      
      mockHandleResponse.mockReturnValue(errorResponse)

      const response = await withErrorHandling(request, handler)

      expect(mockHandleResponse).toHaveBeenCalledWith(complexError, 'test-request-id')
      expect(response).toBe(errorResponse)
    })

    it('should handle multiple concurrent requests', async () => {
      mockUuidv4
        .mockReturnValueOnce('id-1')
        .mockReturnValueOnce('id-2')
        .mockReturnValueOnce('id-3')

      const handler1 = jest.fn().mockResolvedValue(new NextResponse('Response 1'))
      const handler2 = jest.fn().mockResolvedValue(new NextResponse('Response 2'))
      const handler3 = jest.fn().mockRejectedValue(new Error('Error 3'))

      mockHandleResponse.mockReturnValue(new NextResponse('Error', { status: 500 }))

      const [response1, response2, response3] = await Promise.all([
        withErrorHandling(request, handler1),
        withErrorHandling(request, handler2),
        withErrorHandling(request, handler3)
      ])

      expect(response1.headers.get('X-Request-ID')).toBe('id-1')
      expect(response2.headers.get('X-Request-ID')).toBe('id-2')
      expect(mockHandleResponse).toHaveBeenCalledWith(
        expect.any(Error),
        'id-3'
      )
    })
  })
})