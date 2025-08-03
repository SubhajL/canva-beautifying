import { POST, GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { EnhancementService } from '@/lib/enhancement'
import { checkUsageLimit, trackUsageAfterSuccess } from '@/lib/usage/middleware'

// Mock NextRequest globally
const mockNextRequest = jest.fn().mockImplementation((url, options = {}) => {
  const request = {
    url,
    method: options.method || 'GET',
    headers: new Map(Object.entries(options.headers || {})),
    json: async () => {
      if (options.body === 'invalid json') {
        throw new Error('Invalid JSON')
      }
      return JSON.parse(options.body || '{}')
    },
    text: async () => options.body || '',
    formData: async () => options.body
  }
  return request
})

// @ts-ignore
global.NextRequest = mockNextRequest

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/enhancement')
jest.mock('@/lib/usage/middleware')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCheckUsageLimit = checkUsageLimit as jest.MockedFunction<typeof checkUsageLimit>
const mockTrackUsageAfterSuccess = trackUsageAfterSuccess as jest.MockedFunction<typeof trackUsageAfterSuccess>

describe('/api/enhance', () => {
  let mockSupabase: any
  let mockEnhancementService: jest.Mocked<EnhancementService>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      }
    }
    
    mockCreateClient.mockResolvedValue(mockSupabase)
    
    // Setup EnhancementService mock
    mockEnhancementService = {
      enhanceDocument: jest.fn(),
      listUserEnhancements: jest.fn(),
      getEnhancementStatus: jest.fn()
    } as any
    
    ;(EnhancementService as jest.MockedClass<typeof EnhancementService>).mockImplementation(() => mockEnhancementService)
  })

  describe('POST /api/enhance', () => {
    describe('Authentication', () => {
      it('returns 401 when user is not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        })

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-123' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Authentication required')
      })

      it('returns 401 when auth check fails', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: new Error('Auth error')
        })

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-123' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Authentication required')
      })
    })

    describe('Usage limits', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
      })

      it('returns 402 when usage limit exceeded', async () => {
        mockCheckUsageLimit.mockResolvedValue({
          success: false,
          error: 'Usage limit exceeded',
          limit: 10,
          used: 10,
          remaining: 0
        })

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-123' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(402)
        expect(data.error).toBe('Usage limit exceeded')
        expect(data.limit).toBe(10)
        expect(data.remaining).toBe(0)
      })

      it('proceeds when usage limit check passes', async () => {
        mockCheckUsageLimit.mockResolvedValue(null)
        mockEnhancementService.enhanceDocument.mockResolvedValue({
          success: true,
          documentId: 'doc-123',
          enhancementId: 'enh-123'
        })

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-123' })
        })

        const response = await POST(request)
        
        expect(response.status).toBe(200)
        expect(mockCheckUsageLimit).toHaveBeenCalledWith(request, 1)
      })
    })

    describe('Request validation', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
        mockCheckUsageLimit.mockResolvedValue(null)
      })

      it('returns 400 when documentId is missing', async () => {
        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferences: {} })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Document ID is required')
      })

      it('handles invalid JSON body', async () => {
        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json'
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
      })
    })

    describe('Enhancement processing', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
        mockCheckUsageLimit.mockResolvedValue(null)
      })

      it('successfully enhances document', async () => {
        const mockResult = {
          success: true,
          documentId: 'doc-123',
          enhancementId: 'enh-123',
          status: 'processing'
        }

        mockEnhancementService.enhanceDocument.mockResolvedValue(mockResult)

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentId: 'doc-123',
            preferences: {
              style: 'modern',
              colorScheme: 'vibrant'
            }
          })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data).toEqual(mockResult)
        expect(mockEnhancementService.enhanceDocument).toHaveBeenCalledWith(
          'doc-123',
          'user-123',
          {
            style: 'modern',
            colorScheme: 'vibrant'
          }
        )
      })

      it('tracks usage after successful enhancement', async () => {
        const mockResult = {
          success: true,
          documentId: 'doc-123',
          enhancementId: 'enh-123'
        }

        mockEnhancementService.enhanceDocument.mockResolvedValue(mockResult)

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-123' })
        })

        await POST(request)

        expect(mockTrackUsageAfterSuccess).toHaveBeenCalledWith(
          'user-123',
          'enhancement',
          'doc-123',
          1
        )
      })

      it('does not track usage when enhancement fails', async () => {
        const mockResult = {
          success: false,
          error: 'Enhancement failed'
        }

        mockEnhancementService.enhanceDocument.mockResolvedValue(mockResult)

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-123' })
        })

        await POST(request)

        expect(mockTrackUsageAfterSuccess).not.toHaveBeenCalled()
      })

      it('handles enhancement service errors', async () => {
        mockEnhancementService.enhanceDocument.mockRejectedValue(
          new Error('Service unavailable')
        )

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-123' })
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Service unavailable')
        expect(data.success).toBe(false)
      })
    })
  })

  describe('GET /api/enhance', () => {
    describe('Authentication', () => {
      it('returns 401 when user is not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        })

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'GET'
        })

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Authentication required')
      })
    })

    describe('List enhancements', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
      })

      it('returns list of user enhancements when no documentId provided', async () => {
        const mockEnhancements = [
          { id: 'enh-1', documentId: 'doc-1', status: 'completed' },
          { id: 'enh-2', documentId: 'doc-2', status: 'processing' }
        ]

        mockEnhancementService.listUserEnhancements.mockResolvedValue(mockEnhancements)

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'GET'
        })

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.enhancements).toEqual(mockEnhancements)
        expect(mockEnhancementService.listUserEnhancements).toHaveBeenCalledWith('user-123')
      })

      it('handles errors when listing enhancements', async () => {
        mockEnhancementService.listUserEnhancements.mockRejectedValue(
          new Error('Database error')
        )

        const request = mockNextRequest('http://localhost:5000/api/enhance', {
          method: 'GET'
        })

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Database error')
      })
    })

    describe('Get enhancement status', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null
        })
      })

      it('returns status for specific document', async () => {
        const mockStatus = {
          documentId: 'doc-123',
          status: 'completed',
          progress: 100,
          result: {
            enhancedUrl: 'https://example.com/enhanced.jpg'
          }
        }

        mockEnhancementService.getEnhancementStatus.mockResolvedValue(mockStatus)

        const request = mockNextRequest('http://localhost:5000/api/enhance?documentId=doc-123', {
          method: 'GET'
        })

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data).toEqual(mockStatus)
        expect(mockEnhancementService.getEnhancementStatus).toHaveBeenCalledWith(
          'doc-123',
          'user-123'
        )
      })

      it('handles invalid documentId parameter', async () => {
        mockEnhancementService.getEnhancementStatus.mockResolvedValue(null)

        const request = mockNextRequest('http://localhost:5000/api/enhance?documentId=invalid', {
          method: 'GET'
        })

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data).toBeNull()
      })

      it('handles errors when getting status', async () => {
        mockEnhancementService.getEnhancementStatus.mockRejectedValue(
          new Error('Status not found')
        )

        const request = mockNextRequest('http://localhost:5000/api/enhance?documentId=doc-123', {
          method: 'GET'
        })

        const response = await GET(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Status not found')
      })
    })
  })
})