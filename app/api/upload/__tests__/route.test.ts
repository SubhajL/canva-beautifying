import { POST } from '../route'
import { uploadFile } from '@/lib/r2'
import { createClient } from '@/lib/supabase/server'

// Mock NextRequest globally
const mockNextRequest = jest.fn().mockImplementation((url, options = {}) => {
  const request = {
    url,
    method: options.method || 'GET',
    headers: new Map(Object.entries(options.headers || {})),
    formData: async () => {
      // Simulate FormData parsing error for invalid data
      if (options.body === 'invalid form data') {
        throw new Error('Failed to parse form data')
      }
      return options.body
    },
    json: async () => options.body ? JSON.parse(options.body) : {},
    text: async () => options.body || ''
  }
  return request
})

// @ts-ignore
global.NextRequest = mockNextRequest

// Mock dependencies
jest.mock('@/lib/r2')
jest.mock('@/lib/supabase/server')

const mockUploadFile = uploadFile as jest.MockedFunction<typeof uploadFile>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('POST /api/upload', () => {
  let mockSupabase: any
  let mockRequest: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup Supabase mock
    mockSupabase = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      }))
    }
    
    mockCreateClient.mockResolvedValue(mockSupabase)
  })

  describe('Authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      })

      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: new FormData()
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('returns 401 when auth check fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth error')
      })

      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: new FormData()
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('File validation', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('returns 400 when no file is provided', async () => {
      const formData = new FormData()
      
      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file provided')
    })

    it('returns 400 when file exceeds size limit', async () => {
      const formData = new FormData()
      const largeFile = new File(
        [new ArrayBuffer(51 * 1024 * 1024)], // 51MB
        'large.jpg',
        { type: 'image/jpeg' }
      )
      formData.append('file', largeFile)
      
      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('File size exceeds 50MB limit')
    })

    it('returns 400 for invalid file type', async () => {
      const formData = new FormData()
      const invalidFile = new File(
        ['test content'],
        'test.txt',
        { type: 'text/plain' }
      )
      formData.append('file', invalidFile)
      
      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid file type. Only PNG, JPG, and PDF files are allowed')
    })
  })

  describe('Successful upload', () => {
    let validFile: File
    let formData: FormData

    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      validFile = new File(
        ['test image content'],
        'test.jpg',
        { type: 'image/jpeg' }
      )

      formData = new FormData()
      formData.append('file', validFile)
    })

    it('uploads file successfully and returns correct response', async () => {
      const mockUploadResult = {
        key: 'original/user-123/test.jpg',
        url: 'https://r2.example.com/original/user-123/test.jpg'
      }

      const mockEnhancement = {
        id: 'enhancement-123'
      }

      mockUploadFile.mockResolvedValue(mockUploadResult)
      
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockEnhancement,
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        success: true,
        key: mockUploadResult.key,
        url: mockUploadResult.url,
        filename: 'test.jpg',
        size: validFile.size,
        type: 'image/jpeg',
        enhancementId: 'enhancement-123'
      })

      expect(mockUploadFile).toHaveBeenCalledWith({
        file: validFile,
        userId: 'user-123',
        filename: 'test.jpg',
        folder: 'ORIGINAL',
        contentType: 'image/jpeg'
      })

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        original_url: mockUploadResult.url,
        status: 'uploaded',
        analysis_data: {
          filename: 'test.jpg',
          size: validFile.size,
          type: 'image/jpeg',
          uploadedAt: expect.any(String)
        }
      })
    })

    it('succeeds even if database insert fails', async () => {
      const mockUploadResult = {
        key: 'original/user-123/test.jpg',
        url: 'https://r2.example.com/original/user-123/test.jpg'
      }

      mockUploadFile.mockResolvedValue(mockUploadResult)
      
      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error')
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.enhancementId).toBeUndefined()
    })

    it('accepts all allowed file types', async () => {
      const fileTypes = [
        { type: 'image/png', ext: 'png' },
        { type: 'image/jpeg', ext: 'jpg' },
        { type: 'image/jpg', ext: 'jpg' },
        { type: 'application/pdf', ext: 'pdf' }
      ]

      for (const { type, ext } of fileTypes) {
        const file = new File(['content'], `test.${ext}`, { type })
        const formData = new FormData()
        formData.append('file', file)

        mockUploadFile.mockResolvedValue({
          key: `original/user-123/test.${ext}`,
          url: `https://r2.example.com/original/user-123/test.${ext}`
        })

        const insertMock = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'enhancement-123' },
              error: null
            })
          })
        })
        
        mockSupabase.from.mockReturnValue({
          insert: insertMock
        })

        mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
          method: 'POST',
          body: formData
        })

        const response = await POST(mockRequest)
        expect(response.status).toBe(200)
      }
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('returns 500 when upload fails', async () => {
      const formData = new FormData()
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      mockUploadFile.mockRejectedValue(new Error('Upload failed'))

      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to upload file')
    })

    it('handles FormData parsing errors', async () => {
      // Create a request with invalid form data
      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: 'invalid form data',
        headers: {
          'content-type': 'multipart/form-data'
        }
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to upload file')
    })
  })

  describe('File metadata', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    })

    it('preserves original filename with special characters', async () => {
      const specialFilename = 'test file (2023) - version 1.0.jpg'
      const file = new File(['content'], specialFilename, { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', file)

      mockUploadFile.mockResolvedValue({
        key: 'original/user-123/test-file-2023-version-1.0.jpg',
        url: 'https://r2.example.com/original/user-123/test-file-2023-version-1.0.jpg'
      })

      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'enhancement-123' },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.filename).toBe(specialFilename)
      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: specialFilename
        })
      )
    })

    it('tracks correct file size', async () => {
      const content = 'a'.repeat(1024 * 10) // 10KB of content
      const file = new File([content], 'test.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('file', file)

      mockUploadFile.mockResolvedValue({
        key: 'original/user-123/test.jpg',
        url: 'https://r2.example.com/original/user-123/test.jpg'
      })

      const insertMock = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'enhancement-123' },
            error: null
          })
        })
      })
      
      mockSupabase.from.mockReturnValue({
        insert: insertMock
      })

      mockRequest = mockNextRequest('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(mockRequest)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.size).toBe(file.size)
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis_data: expect.objectContaining({
            size: file.size
          })
        })
      )
    })
  })
})