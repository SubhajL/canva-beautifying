import { EnhancementService } from '../enhancement-service'
import { EnhancementPipeline } from '../enhancement-pipeline'
import { createClient } from '@/lib/supabase/server'
import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementRequest, EnhancementResult } from '../types'

// Mock dependencies
jest.mock('../enhancement-pipeline')
jest.mock('@/lib/supabase/server')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockEnhancementPipeline = EnhancementPipeline as jest.MockedClass<typeof EnhancementPipeline>

describe('EnhancementService', () => {
  let service: EnhancementService
  let mockSupabase: any
  let mockPipelineInstance: any
  
  // Mock data
  const mockDocumentId = 'doc-123'
  const mockUserId = 'user-456'
  
  const mockAnalysisData: DocumentAnalysis = {
    documentType: 'educational',
    purpose: 'Teaching material',
    quality: {
      overall: 65,
      colorContrast: 70,
      layout: 60,
      typography: 68,
      accessibility: 72
    },
    audience: {
      level: 'intermediate',
      ageGroup: 'adult',
      domain: 'education'
    },
    content: {
      textElements: ['Title', 'Subtitle', 'Body text'],
      imageCount: 2,
      wordCount: 500,
      languages: ['en']
    },
    design: {
      colorPalette: ['#000000', '#FFFFFF', '#FF0000'],
      fonts: ['Arial', 'Times New Roman'],
      layout: 'single-column',
      visualHierarchy: 'weak'
    },
    issues: [
      {
        type: 'color',
        severity: 'high',
        description: 'Poor color contrast',
        recommendation: 'Increase contrast ratio'
      }
    ],
    opportunities: [
      'Improve visual hierarchy',
      'Add more whitespace',
      'Use consistent color scheme'
    ]
  }

  const mockEnhancementResult: EnhancementResult = {
    success: true,
    documentId: mockDocumentId,
    strategies: [
      {
        id: 'strategy-1',
        name: 'Color Harmony',
        description: 'Improve color scheme',
        priority: 'high',
        impact: 85,
        changes: {
          colors: {
            palette: {
              primary: '#1e40af',
              secondary: ['#3b82f6', '#60a5fa'],
              accent: '#f59e0b',
              background: '#ffffff',
              text: '#1f2937'
            },
            adjustments: {
              contrast: 1.2,
              saturation: 0.9,
              brightness: 1.0
            },
            replacements: new Map([
              ['#FF0000', '#ef4444'],
              ['#000000', '#1f2937']
            ])
          }
        }
      }
    ],
    appliedStrategies: ['strategy-1'],
    enhancedUrl: 'https://example.com/enhanced.pdf',
    qualityScore: {
      before: 65,
      after: 85,
      improvement: 20
    },
    metadata: {
      processingTime: 5000,
      enhancementCount: 1,
      timestamp: new Date()
    }
  }

  const mockEnhancement = {
    id: mockDocumentId,
    user_id: mockUserId,
    original_url: 'https://example.com/original.pdf',
    enhanced_url: null,
    status: 'pending',
    analysis_data: mockAnalysisData,
    metadata: {
      ageGroup: 'adult'
    },
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    error_message: null,
    enhancement_data: null
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create stable mock references for chaining
    const singleMock = jest.fn()
    const eqMock = jest.fn()
    const selectMock = jest.fn()
    const updateMock = jest.fn()
    const fromMock = jest.fn()
    
    // Setup chaining for select queries
    eqMock.mockReturnValue({
      eq: jest.fn().mockReturnValue({ single: singleMock }),
      single: singleMock
    })
    
    selectMock.mockReturnValue({ eq: eqMock })
    
    // Setup chaining for update queries
    updateMock.mockReturnValue({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) })
    
    // Setup from mock
    fromMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
      insert: jest.fn().mockResolvedValue({ data: null, error: null })
    })
    
    // Setup Supabase mock
    mockSupabase = {
      from: fromMock
    }
    
    mockCreateClient.mockResolvedValue(mockSupabase as any)
    
    // Setup pipeline mock
    mockPipelineInstance = {
      enhance: jest.fn().mockResolvedValue(mockEnhancementResult)
    }
    
    mockEnhancementPipeline.mockImplementation(() => mockPipelineInstance)
    
    // Create service instance
    service = new EnhancementService()
  })

  describe('constructor', () => {
    it('should create an instance with pipeline', () => {
      expect(service).toBeInstanceOf(EnhancementService)
      expect(mockEnhancementPipeline).toHaveBeenCalled()
    })
  })

  describe('enhanceDocument', () => {
    beforeEach(() => {
      // Setup default mock responses
      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      
      // Set default response for single()
      eqResult.eq().single.mockResolvedValue({
        data: mockEnhancement,
        error: null
      })
    })

    it('should enhance a document successfully', async () => {
      const result = await service.enhanceDocument(mockDocumentId, mockUserId)

      expect(result).toEqual(mockEnhancementResult)
      expect(mockPipelineInstance.enhance).toHaveBeenCalledWith({
        documentId: mockDocumentId,
        userId: mockUserId,
        analysisData: mockAnalysisData,
        preferences: undefined,
        targetAudience: {
          ageGroup: 'adult'
        }
      })
    })

    it('should use preferences when provided', async () => {
      const preferences = {
        style: 'modern' as const,
        colorScheme: 'vibrant' as const,
        preserveContent: true,
        autoApprove: false
      }

      await service.enhanceDocument(mockDocumentId, mockUserId, preferences)

      expect(mockPipelineInstance.enhance).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences
        })
      )
    })

    it('should return existing result if already enhanced', async () => {
      const completedEnhancement = {
        ...mockEnhancement,
        status: 'completed',
        enhanced_url: 'https://example.com/enhanced.pdf',
        completed_at: new Date().toISOString(),
        enhancement_data: {
          strategies: mockEnhancementResult.strategies.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            impact: s.impact,
            changes: Object.keys(s.changes)
          })),
          appliedStrategies: mockEnhancementResult.appliedStrategies,
          qualityScore: mockEnhancementResult.qualityScore,
          metadata: mockEnhancementResult.metadata
        }
      }

      // Override the default mock for this test
      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: completedEnhancement,
        error: null
      })

      const result = await service.enhanceDocument(mockDocumentId, mockUserId)

      expect(mockPipelineInstance.enhance).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(result.enhancedUrl).toBe(completedEnhancement.enhanced_url)
    })

    it('should throw error if document not found', async () => {
      // Override the default mock for this test
      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await expect(service.enhanceDocument(mockDocumentId, mockUserId))
        .rejects.toThrow('Document not found')
    })

    it('should update status to processing before enhancement', async () => {
      await service.enhanceDocument(mockDocumentId, mockUserId)

      const updateCalls = mockSupabase.from().update.mock.calls
      expect(updateCalls[0][0]).toMatchObject({
        status: 'processing',
        started_at: expect.any(String)
      })
    })

    it('should store enhancement results', async () => {
      await service.enhanceDocument(mockDocumentId, mockUserId)

      const updateCalls = mockSupabase.from().update.mock.calls
      const finalUpdate = updateCalls[updateCalls.length - 1][0]
      
      expect(finalUpdate).toMatchObject({
        status: 'completed',
        completed_at: expect.any(String),
        enhanced_url: mockEnhancementResult.enhancedUrl,
        enhancement_data: expect.objectContaining({
          strategies: expect.any(Array),
          appliedStrategies: mockEnhancementResult.appliedStrategies,
          qualityScore: mockEnhancementResult.qualityScore
        })
      })
    })

    it('should handle enhancement failure', async () => {
      const error = new Error('Enhancement failed')
      mockPipelineInstance.enhance.mockRejectedValue(error)

      await expect(service.enhanceDocument(mockDocumentId, mockUserId))
        .rejects.toThrow('Enhancement failed')

      const updateCalls = mockSupabase.from().update.mock.calls
      const errorUpdate = updateCalls[updateCalls.length - 1][0]
      
      expect(errorUpdate).toMatchObject({
        status: 'failed',
        error_message: 'Enhancement failed'
      })
    })

    it('should handle non-Error failures', async () => {
      mockPipelineInstance.enhance.mockRejectedValue('String error')

      // This should reject but doesn't need to match a specific error message
      const promise = service.enhanceDocument(mockDocumentId, mockUserId)
      await expect(promise).rejects.toBeDefined()

      // Check that the error was handled properly
      const updateResult = mockSupabase.from().update()
      expect(updateResult.eq).toHaveBeenCalled()
      
      // Get the update data from the first call to update
      const updateData = mockSupabase.from().update.mock.calls.find(
        call => call[0]?.status === 'failed'
      )?.[0]
      
      expect(updateData).toMatchObject({
        status: 'failed',
        error_message: 'Enhancement failed'
      })
    })

    it('should use default age group if not provided', async () => {
      const enhancementWithoutMetadata = {
        ...mockEnhancement,
        metadata: {}
      }

      // Override the default mock for this test
      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: enhancementWithoutMetadata,
        error: null
      })

      await service.enhanceDocument(mockDocumentId, mockUserId)

      expect(mockPipelineInstance.enhance).toHaveBeenCalledWith(
        expect.objectContaining({
          targetAudience: {
            ageGroup: 'general'
          }
        })
      )
    })
  })

  describe('getEnhancementStatus', () => {
    it('should return status for pending enhancement', async () => {
      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: mockEnhancement,
        error: null
      })

      const result = await service.getEnhancementStatus(mockDocumentId, mockUserId)

      expect(result).toEqual({
        status: 'pending'
      })
    })

    it('should return progress for processing enhancement', async () => {
      const processingEnhancement = {
        ...mockEnhancement,
        status: 'processing',
        started_at: new Date(Date.now() - 10000).toISOString() // Started 10s ago
      }

      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: processingEnhancement,
        error: null
      })

      const result = await service.getEnhancementStatus(mockDocumentId, mockUserId)

      expect(result.status).toBe('processing')
      expect(result.progress).toBeGreaterThan(0)
      expect(result.progress).toBeLessThanOrEqual(95)
    })

    it('should return result for completed enhancement', async () => {
      const completedEnhancement = {
        ...mockEnhancement,
        status: 'completed',
        enhanced_url: 'https://example.com/enhanced.pdf',
        completed_at: new Date().toISOString(),
        enhancement_data: {
          strategies: [],
          appliedStrategies: [],
          qualityScore: { before: 60, after: 80, improvement: 20 }
        }
      }

      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: completedEnhancement,
        error: null
      })

      const result = await service.getEnhancementStatus(mockDocumentId, mockUserId)

      expect(result.status).toBe('completed')
      expect(result.result).toBeDefined()
      expect(result.result?.success).toBe(true)
      expect(result.result?.enhancedUrl).toBe(completedEnhancement.enhanced_url)
    })

    it('should throw error if enhancement not found', async () => {
      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: null,
        error: null
      })

      await expect(service.getEnhancementStatus(mockDocumentId, mockUserId))
        .rejects.toThrow('Enhancement not found')
    })

    it('should cap progress at 95%', async () => {
      const processingEnhancement = {
        ...mockEnhancement,
        status: 'processing',
        started_at: new Date(Date.now() - 60000).toISOString() // Started 60s ago
      }

      const fromResult = mockSupabase.from()
      const selectResult = fromResult.select()
      const eqResult = selectResult.eq()
      eqResult.eq().single.mockResolvedValue({
        data: processingEnhancement,
        error: null
      })

      const result = await service.getEnhancementStatus(mockDocumentId, mockUserId)

      expect(result.progress).toBe(95)
    })
  })

  describe('listUserEnhancements', () => {
    it('should return list of user enhancements', async () => {
      const enhancements = [
        {
          id: 'doc-1',
          original_url: 'https://example.com/doc1.pdf',
          enhanced_url: 'https://example.com/doc1-enhanced.pdf',
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        },
        {
          id: 'doc-2',
          original_url: 'https://example.com/doc2.pdf',
          enhanced_url: null,
          status: 'processing',
          created_at: new Date().toISOString(),
          completed_at: null
        }
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: enhancements,
              error: null
            }))
          }))
        }))
      })

      const result = await service.listUserEnhancements(mockUserId)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: 'doc-1',
        originalUrl: enhancements[0].original_url,
        enhancedUrl: enhancements[0].enhanced_url,
        status: 'completed',
        createdAt: expect.any(Date),
        completedAt: expect.any(Date)
      })
      expect(result[1].completedAt).toBeUndefined()
    })

    it('should handle empty enhancement list', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: [],
              error: null
            }))
          }))
        }))
      })

      const result = await service.listUserEnhancements(mockUserId)

      expect(result).toEqual([])
    })

    it('should handle null data response', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: null,
              error: null
            }))
          }))
        }))
      })

      const result = await service.listUserEnhancements(mockUserId)

      expect(result).toEqual([])
    })
  })

  describe('Private Methods', () => {
    describe('getExistingResult', () => {
      it('should handle missing enhancement data gracefully', async () => {
        const minimalEnhancement = {
          ...mockEnhancement,
          status: 'completed',
          enhanced_url: 'https://example.com/enhanced.pdf',
          completed_at: new Date().toISOString(),
          enhancement_data: undefined
        }

        const fromResult = mockSupabase.from()
        const selectResult = fromResult.select()
        const eqResult = selectResult.eq()
        eqResult.eq().single.mockResolvedValue({
          data: minimalEnhancement,
          error: null
        })

        const result = await service.enhanceDocument(mockDocumentId, mockUserId)

        expect(result.success).toBe(true)
        expect(result.strategies).toEqual([])
        expect(result.appliedStrategies).toEqual([])
        expect(result.qualityScore).toEqual({
          before: 0,
          after: 0,
          improvement: 0
        })
      })

      it('should handle partial enhancement data', async () => {
        const partialEnhancement = {
          ...mockEnhancement,
          status: 'completed',
          enhanced_url: 'https://example.com/enhanced.pdf',
          completed_at: new Date().toISOString(),
          enhancement_data: {
            strategies: [{
              id: 'test-1',
              name: 'Test Strategy',
              description: 'Test',
              impact: 50,
              changes: ['colors']
            }],
            // Missing other fields
          }
        }

        const fromResult = mockSupabase.from()
        const selectResult = fromResult.select()
        const eqResult = selectResult.eq()
        eqResult.eq().single.mockResolvedValue({
          data: partialEnhancement,
          error: null
        })

        const result = await service.enhanceDocument(mockDocumentId, mockUserId)

        expect(result.success).toBe(true)
        expect(result.strategies).toHaveLength(1)
        expect(result.appliedStrategies).toEqual([])
      })
    })

    describe('storeEnhancementResult', () => {
      it('should handle failed enhancement result', async () => {
        // Setup the mock response for this test
        const fromResult = mockSupabase.from()
        const selectResult = fromResult.select()
        const eqResult = selectResult.eq()
        eqResult.eq().single.mockResolvedValue({
          data: mockEnhancement,
          error: null
        })

        const failedResult: EnhancementResult = {
          ...mockEnhancementResult,
          success: false,
          error: 'Test error',
          enhancedUrl: undefined
        }

        mockPipelineInstance.enhance.mockResolvedValue(failedResult)

        // Run the enhancement (it should succeed but return a failed result)
        const result = await service.enhanceDocument(mockDocumentId, mockUserId)
        
        // The result should indicate failure
        expect(result.success).toBe(false)
        expect(result.error).toBe('Test error')
        
        // Get the update data from the second call to update (first is for status=processing)
        const updateData = mockSupabase.from().update.mock.calls.find(
          call => call[0]?.status === 'failed' || call[0]?.status === 'completed'
        )?.[0]
        
        expect(updateData).toMatchObject({
          status: 'failed',
          error_message: 'Test error'
        })
        expect(updateData.enhanced_url).toBeUndefined()
      })
    })
  })
})