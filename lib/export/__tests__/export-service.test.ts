import { ExportService } from '../export-service'
import { createClient } from '@/lib/supabase/server'
import { PngExporter } from '../exporters/png-exporter'
import { JpgExporter } from '../exporters/jpg-exporter'
import { PdfExporter } from '../exporters/pdf-exporter'
import { CanvaExporter } from '../exporters/canva-exporter'
import { BatchExporter } from '../batch-exporter'
import { ExportProgressTracker } from '../progress-tracker'
import { ExportRequest, ExportFormat } from '../types'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('../exporters/png-exporter')
jest.mock('../exporters/jpg-exporter')
jest.mock('../exporters/pdf-exporter')
jest.mock('../exporters/canva-exporter')
jest.mock('../batch-exporter')
jest.mock('../progress-tracker')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('ExportService', () => {
  let service: ExportService
  let mockSupabase: any
  let mockInsert: jest.Mock
  let mockFrom: any
  let mockPngExporter: jest.Mocked<PngExporter>
  let mockJpgExporter: jest.Mocked<JpgExporter>
  let mockPdfExporter: jest.Mocked<PdfExporter>
  let mockCanvaExporter: jest.Mocked<CanvaExporter>
  let mockBatchExporter: jest.Mocked<BatchExporter>
  let mockProgressTracker: jest.Mocked<ExportProgressTracker>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create stable mock references
    mockInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
    
    mockFrom = {
      insert: mockInsert
    }
    
    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn(() => mockFrom)
    }
    
    mockCreateClient.mockReturnValue(mockSupabase as any)
    
    // Setup exporter mocks
    mockPngExporter = {
      validateOptions: jest.fn(),
      export: jest.fn()
    } as any
    
    mockJpgExporter = {
      validateOptions: jest.fn(),
      export: jest.fn()
    } as any
    
    mockPdfExporter = {
      validateOptions: jest.fn(),
      export: jest.fn()
    } as any
    
    mockCanvaExporter = {
      validateOptions: jest.fn(),
      export: jest.fn()
    } as any
    
    mockBatchExporter = {
      setExportService: jest.fn(),
      exportBatch: jest.fn()
    } as any
    
    mockProgressTracker = {
      startExport: jest.fn(),
      updateProgress: jest.fn(),
      completeExport: jest.fn(),
      failExport: jest.fn(),
      getProgress: jest.fn()
    } as any
    
    // Mock constructors
    ;(PngExporter as jest.MockedClass<typeof PngExporter>).mockImplementation(() => mockPngExporter)
    ;(JpgExporter as jest.MockedClass<typeof JpgExporter>).mockImplementation(() => mockJpgExporter)
    ;(PdfExporter as jest.MockedClass<typeof PdfExporter>).mockImplementation(() => mockPdfExporter)
    ;(CanvaExporter as jest.MockedClass<typeof CanvaExporter>).mockImplementation(() => mockCanvaExporter)
    ;(BatchExporter as jest.MockedClass<typeof BatchExporter>).mockImplementation(() => mockBatchExporter)
    ;(ExportProgressTracker as jest.MockedClass<typeof ExportProgressTracker>).mockImplementation(() => mockProgressTracker)
    
    service = new ExportService()
  })

  describe('constructor', () => {
    it('initializes all exporters', () => {
      expect(PngExporter).toHaveBeenCalled()
      expect(JpgExporter).toHaveBeenCalled()
      expect(PdfExporter).toHaveBeenCalled()
      expect(CanvaExporter).toHaveBeenCalled()
    })

    it('sets up batch exporter with service reference', () => {
      expect(BatchExporter).toHaveBeenCalled()
      expect(mockBatchExporter.setExportService).toHaveBeenCalledWith(service)
    })

    it('initializes progress tracker', () => {
      expect(ExportProgressTracker).toHaveBeenCalled()
    })
  })

  describe('exportDocument', () => {
    const baseRequest: ExportRequest = {
      documentId: 'doc-123',
      userId: 'user-123',
      originalUrl: 'https://example.com/original.pdf',
      enhancedUrl: 'https://example.com/enhanced.pdf',
      options: {
        format: 'png' as ExportFormat,
        quality: 90,
        scale: 1.0
      }
    }

    describe('Validation', () => {
      it('returns error for unsupported format', async () => {
        const request = {
          ...baseRequest,
          options: {
            ...baseRequest.options,
            format: 'unsupported' as ExportFormat
          }
        }

        const result = await service.exportDocument(request)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Unsupported export format: unsupported')
        expect(result.processingTime).toBe(0)
      })

      it('returns error for invalid options', async () => {
        mockPngExporter.validateOptions.mockReturnValue(false)

        const result = await service.exportDocument(baseRequest)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid export options')
      })

      it('returns specific error for invalid scale', async () => {
        mockPngExporter.validateOptions.mockReturnValue(false)
        
        const request = {
          ...baseRequest,
          options: {
            ...baseRequest.options,
            scale: 5.0 // Invalid scale
          }
        }

        const result = await service.exportDocument(request)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Invalid scale parameter. Scale must be between 0.1 and 4')
      })
    })

    describe('Successful export', () => {
      beforeEach(() => {
        mockPngExporter.validateOptions.mockReturnValue(true)
        mockProgressTracker.startExport.mockReturnValue('progress-123')
      })

      it('exports PNG successfully', async () => {
        const mockResult = {
          success: true,
          documentId: 'doc-123',
          format: 'png' as ExportFormat,
          exportUrl: 'https://example.com/exports/doc-123.png',
          processingTime: 1500
        }

        mockPngExporter.export.mockResolvedValue(mockResult)

        const result = await service.exportDocument(baseRequest)

        expect(result).toEqual(mockResult)
        expect(mockPngExporter.export).toHaveBeenCalledWith(baseRequest)
        expect(mockProgressTracker.completeExport).toHaveBeenCalledWith(
          'progress-123',
          mockResult.exportUrl
        )
      })

      it('exports JPG successfully', async () => {
        const jpgRequest = {
          ...baseRequest,
          options: {
            ...baseRequest.options,
            format: 'jpg' as ExportFormat
          }
        }

        mockJpgExporter.validateOptions.mockReturnValue(true)
        mockJpgExporter.export.mockResolvedValue({
          success: true,
          documentId: 'doc-123',
          format: 'jpg' as ExportFormat,
          exportUrl: 'https://example.com/exports/doc-123.jpg',
          processingTime: 1200
        })

        const result = await service.exportDocument(jpgRequest)

        expect(result.success).toBe(true)
        expect(result.format).toBe('jpg')
        expect(mockJpgExporter.export).toHaveBeenCalled()
      })

      it('exports PDF successfully', async () => {
        const pdfRequest = {
          ...baseRequest,
          options: {
            ...baseRequest.options,
            format: 'pdf' as ExportFormat
          }
        }

        mockPdfExporter.validateOptions.mockReturnValue(true)
        mockPdfExporter.export.mockResolvedValue({
          success: true,
          documentId: 'doc-123',
          format: 'pdf' as ExportFormat,
          exportUrl: 'https://example.com/exports/doc-123.pdf',
          metadata: {
            pageCount: 5,
            fileSize: 2048000
          },
          processingTime: 3000
        })

        const result = await service.exportDocument(pdfRequest)

        expect(result.success).toBe(true)
        expect(result.format).toBe('pdf')
        expect(result.metadata?.pageCount).toBe(5)
      })

      it('exports to Canva successfully', async () => {
        const canvaRequest = {
          ...baseRequest,
          options: {
            ...baseRequest.options,
            format: 'canva' as ExportFormat
          }
        }

        mockCanvaExporter.validateOptions.mockReturnValue(true)
        mockCanvaExporter.export.mockResolvedValue({
          success: true,
          documentId: 'doc-123',
          format: 'canva' as ExportFormat,
          canvaDesignId: 'DAF123abc',
          canvaEditUrl: 'https://canva.com/design/DAF123abc/edit',
          processingTime: 2000
        })

        const result = await service.exportDocument(canvaRequest)

        expect(result.success).toBe(true)
        expect(result.format).toBe('canva')
        expect((result as any).canvaDesignId).toBe('DAF123abc')
      })

      it('stores export history on success', async () => {
        mockPngExporter.export.mockResolvedValue({
          success: true,
          documentId: 'doc-123',
          format: 'png' as ExportFormat,
          exportUrl: 'https://example.com/exports/doc-123.png',
          processingTime: 1500
        })

        const insertMock = mockSupabase.from().insert().select()
        insertMock.single.mockResolvedValue({
          data: { id: 'history-123' },
          error: null
        })

        await service.exportDocument(baseRequest)

        expect(mockSupabase.from).toHaveBeenCalledWith('export_history')
        expect(mockInsert).toHaveBeenCalledWith({
          user_id: 'user-123',
          document_id: 'doc-123',
          format: 'png',
          export_url: 'https://example.com/exports/doc-123.png',
          file_size: 0,
          metadata: {
            quality: 90,
            scale: 1,
            dimensions: undefined,
            processingTime: 1500
          },
          expires_at: expect.any(Date)
        })
      })
    })

    describe('Error handling', () => {
      beforeEach(() => {
        mockPngExporter.validateOptions.mockReturnValue(true)
        mockProgressTracker.startExport.mockReturnValue('progress-123')
      })

      it('handles export failure', async () => {
        mockPngExporter.export.mockResolvedValue({
          success: false,
          documentId: 'doc-123',
          format: 'png' as ExportFormat,
          error: 'Failed to render image',
          processingTime: 500
        })

        const result = await service.exportDocument(baseRequest)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Failed to render image')
        expect(mockProgressTracker.failExport).toHaveBeenCalledWith(
          'progress-123',
          'Failed to render image'
        )
      })

      it('handles export exception', async () => {
        mockPngExporter.export.mockRejectedValue(new Error('Network error'))

        const result = await service.exportDocument(baseRequest)

        expect(result.success).toBe(false)
        expect(result.error).toBe('Network error')
        expect(mockProgressTracker.failExport).toHaveBeenCalledWith(
          'progress-123',
          'Network error'
        )
      })

      it('does not store history on failure', async () => {
        mockPngExporter.export.mockResolvedValue({
          success: false,
          documentId: 'doc-123',
          format: 'png' as ExportFormat,
          error: 'Export failed',
          processingTime: 100
        })

        await service.exportDocument(baseRequest)

        expect(mockSupabase.from).not.toHaveBeenCalled()
      })
    })
  })

  describe('batchExport', () => {
    it('delegates to batch exporter', async () => {
      const batchOptions = {
        documentIds: ['doc-1', 'doc-2', 'doc-3'],
        format: 'png' as ExportFormat,
        userId: 'user-123'
      }

      mockBatchExporter.exportBatch.mockResolvedValue({
        totalDocuments: 3,
        successful: 3,
        failed: 0,
        results: []
      })

      await service.exportBatch('user-123', batchOptions)

      expect(mockBatchExporter.exportBatch).toHaveBeenCalledWith('user-123', batchOptions, undefined)
    })
  })

  describe('getExportHistory', () => {
    it('retrieves export history for user', async () => {
      const selectMock = {
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [
                {
                  id: 'history-1',
                  document_id: 'doc-1',
                  format: 'png',
                  export_url: 'https://example.com/export1.png',
                  created_at: '2024-01-01T00:00:00Z'
                }
              ],
              error: null
            }))
          }))
        }))
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => selectMock)
      })

      const history = await service.getUserExportHistory('user-123')

      expect(history).toHaveLength(1)
      expect(history[0].documentId).toBe('doc-1')
      expect(mockSupabase.from).toHaveBeenCalledWith('export_history')
    })

    it('retrieves export history without format filter', async () => {
      const selectMock = {
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              data: [
                {
                  id: 'history-1',
                  user_id: 'user-123',
                  document_id: 'doc-1',
                  format: 'png',
                  created_at: '2024-01-01T00:00:00Z'
                },
                {
                  id: 'history-2',
                  user_id: 'user-123',
                  document_id: 'doc-2',
                  format: 'pdf',
                  created_at: '2024-01-02T00:00:00Z'
                }
              ],
              error: null
            }))
          }))
        }))
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => selectMock)
      })

      const history = await service.getUserExportHistory('user-123')

      expect(history).toHaveLength(2)
      expect(selectMock.eq).toHaveBeenCalledWith('user_id', 'user-123')
      // The implementation doesn't support format filtering
    })
  })

  describe('getExportProgress', () => {
    it('retrieves progress for export', async () => {
      const mockProgress = {
        documentId: 'doc-123',
        format: 'png' as ExportFormat,
        status: 'processing' as const,
        progress: 45,
        startedAt: new Date()
      }

      mockProgressTracker.getProgress.mockReturnValue(mockProgress)

      const progress = service.getProgress('doc-123')

      expect(progress).toEqual(mockProgress)
      expect(mockProgressTracker.getProgress).toHaveBeenCalledWith('doc-123')
    })
  })
})