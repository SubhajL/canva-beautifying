import { ExportService } from '@/lib/export/export-service'
import { ExportFormat } from '@/lib/export/types'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => {
    const mockChain = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ 
        data: [
          {
            id: '1',
            user_id: 'user-456',
            document_id: 'doc-1',
            format: 'png',
            created_at: new Date().toISOString(),
            file_size: 1024,
            download_count: 5
          }
        ], 
        error: null 
      }),
    }
    mockChain.from.mockReturnValue(mockChain)
    return Promise.resolve(mockChain)
  }),
}))

jest.mock('@/lib/r2', () => ({
  uploadFile: jest.fn((buffer, path, contentType) => {
    // Return appropriate URL based on content type or path
    if (contentType === 'application/zip' || path.endsWith('.zip')) {
      return Promise.resolve('https://r2.example.com/test-batch.zip')
    }
    return Promise.resolve('https://r2.example.com/test.png')
  }),
}))

// Mock sharp - already mocked in jest.setup.js but let's ensure it works
jest.mock('sharp')

// Mock fetch for downloadImage
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
  })
) as jest.Mock

describe('ExportService', () => {
  let exportService: ExportService

  beforeEach(() => {
    exportService = new ExportService()
    jest.clearAllMocks()
  })

  describe('exportDocument', () => {
    it('should export PNG with default options', async () => {
      const request = {
        documentId: 'test-123',
        userId: 'user-456',
        enhancedUrl: 'https://example.com/image.png',
        options: {
          format: 'png' as ExportFormat,
        },
      }

      const result = await exportService.exportDocument(request)

      expect(result.success).toBe(true)
      expect(result.format).toBe('png')
      expect(result.exportUrl).toBeDefined()
    })

    it('should export JPG with quality setting', async () => {
      const request = {
        documentId: 'test-123',
        userId: 'user-456',
        enhancedUrl: 'https://example.com/image.png',
        options: {
          format: 'jpg' as ExportFormat,
          quality: 85,
        },
      }

      const result = await exportService.exportDocument(request)

      expect(result.success).toBe(true)
      expect(result.format).toBe('jpg')
    })

    it('should validate scale parameter', async () => {
      const request = {
        documentId: 'test-123',
        userId: 'user-456',
        enhancedUrl: 'https://example.com/image.png',
        options: {
          format: 'png' as ExportFormat,
          scale: 5, // Invalid - too high
        },
      }

      const result = await exportService.exportDocument(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid scale')
    })

    it('should track export progress', async () => {
      const request = {
        documentId: 'test-123',
        userId: 'user-456',
        enhancedUrl: 'https://example.com/image.png',
        options: {
          format: 'pdf' as ExportFormat,
        },
      }

      // Start export
      exportService.exportDocument(request)

      // Check progress is being tracked
      const progress = exportService.getProgress('test-123')
      expect(progress).toBeDefined()
      expect(progress?.status).toBe('processing')
    })
  })

  describe('batch export', () => {
    it('should export multiple documents', async () => {
      const progressCallback = jest.fn()

      const result = await exportService.exportBatch(
        'user-456',
        {
          documentIds: ['doc-1', 'doc-2'],
          format: 'png',
          zipFileName: 'test-batch.zip',
        },
        progressCallback
      )

      expect(result).toContain('.zip')
      expect(progressCallback).toHaveBeenCalled()
    })
  })

  describe('export history', () => {
    it('should retrieve user export history', async () => {
      const history = await exportService.getUserExportHistory('user-456', 10)

      expect(Array.isArray(history)).toBe(true)
    })
  })
})