import { EventEmitter } from 'events'
import { EnhancementPipeline } from '../enhancement-pipeline'
import { PipelineCache } from '../cache'
import { InitialAnalysisStage } from '../stages/initial-analysis'
import { EnhancementPlanningStage } from '../stages/enhancement-planning'
import { AssetGenerationStage } from '../stages/asset-generation'
import { FinalCompositionStage } from '../stages/final-composition'
import { createClient } from '@/lib/supabase/server'
import type {
  PipelineContext,
  PipelineEvent,
  InitialAnalysisResult,
  EnhancementPlan,
  GeneratedAssets,
  CompositionResult,
  PipelineStage
} from '../types'

// Mock dependencies
jest.mock('../cache')
jest.mock('../stages/initial-analysis')
jest.mock('../stages/enhancement-planning')
jest.mock('../stages/asset-generation')
jest.mock('../stages/final-composition')
jest.mock('@/lib/supabase/server')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockPipelineCache = PipelineCache as jest.MockedClass<typeof PipelineCache>
const mockInitialAnalysisStage = InitialAnalysisStage as jest.MockedClass<typeof InitialAnalysisStage>
const mockEnhancementPlanningStage = EnhancementPlanningStage as jest.MockedClass<typeof EnhancementPlanningStage>
const mockAssetGenerationStage = AssetGenerationStage as jest.MockedClass<typeof AssetGenerationStage>
const mockFinalCompositionStage = FinalCompositionStage as jest.MockedClass<typeof FinalCompositionStage>

describe('EnhancementPipeline', () => {
  let pipeline: EnhancementPipeline
  let mockContext: PipelineContext
  let mockSupabase: any
  let mockCacheInstance: any
  let mockInitialAnalysisInstance: any
  let mockEnhancementPlanningInstance: any
  let mockAssetGenerationInstance: any
  let mockFinalCompositionInstance: any

  // Mock results
  const mockAnalysisResult: InitialAnalysisResult = {
    extractedText: {
      title: 'Test Document',
      headings: ['Section 1', 'Section 2'],
      bodyText: ['Body text here'],
      captions: []
    },
    layoutAnalysis: {
      structure: 'single-column',
      sections: [],
      whitespace: 20,
      alignment: 'left'
    },
    designIssues: [
      {
        type: 'color',
        severity: 'high',
        description: 'Poor color contrast'
      }
    ],
    currentScore: {
      overall: 60,
      color: 50,
      typography: 65,
      layout: 70,
      visuals: 55
    },
    metadata: {
      pageCount: 1,
      dimensions: { width: 800, height: 1200 },
      fileSize: 100000,
      hasImages: false,
      imageCount: 0
    }
  }

  const mockEnhancementPlan: EnhancementPlan = {
    strategy: {
      approach: 'moderate',
      priority: ['color', 'typography', 'layout', 'visuals'],
      estimatedImpact: 25
    },
    colorEnhancements: {
      primaryColor: '#1e40af',
      secondaryColor: '#3b82f6',
      accentColor: '#60a5fa',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      adjustments: []
    },
    typographyEnhancements: {
      headingFont: {
        family: 'Inter',
        weight: 700,
        style: 'normal',
        fallback: ['sans-serif']
      },
      bodyFont: {
        family: 'Inter',
        weight: 400,
        style: 'normal',
        fallback: ['sans-serif']
      },
      sizes: { h1: 32, h2: 24, h3: 20, body: 16, caption: 14 },
      lineHeight: 1.5,
      letterSpacing: 0
    },
    layoutEnhancements: {
      grid: { columns: 12, gutter: 16, margin: 24 },
      sections: [],
      whitespaceAdjustments: []
    },
    assetRequirements: {
      backgrounds: [],
      decorativeElements: [],
      educationalGraphics: []
    }
  }

  const mockGeneratedAssets: GeneratedAssets = {
    backgrounds: [],
    decorativeElements: [],
    educationalGraphics: [],
    totalAssets: 0,
    storageUsed: 0
  }

  const mockCompositionResult: CompositionResult = {
    enhancedFileUrl: 'https://example.com/enhanced.pdf',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    improvements: {
      colorScore: { before: 50, after: 85 },
      typographyScore: { before: 65, after: 90 },
      layoutScore: { before: 70, after: 85 },
      visualScore: { before: 55, after: 80 },
      overallScore: { before: 60, after: 85 }
    },
    appliedEnhancements: ['color-harmony', 'typography-hierarchy', 'layout-grid'],
    processingTime: {
      analysis: 1000,
      planning: 500,
      generation: 2000,
      composition: 1500,
      total: 5000
    },
    metadata: {
      fileSize: 150000,
      format: 'pdf',
      dimensions: { width: 800, height: 1200 },
      pageCount: 1
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup context
    mockContext = {
      documentId: 'doc-123',
      userId: 'user-123',
      subscriptionTier: 'pro',
      originalFileUrl: 'https://example.com/original.pdf',
      fileType: 'pdf',
      startTime: Date.now(),
      settings: {
        targetStyle: 'modern',
        colorScheme: 'vibrant',
        layoutPreference: 'balanced',
        quality: 'high',
        generateAssets: true,
        preserveContent: true
      }
    }

    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    }
    mockCreateClient.mockReturnValue(mockSupabase as any)

    // Setup cache mock
    mockCacheInstance = {
      getAnalysis: jest.fn(),
      setAnalysis: jest.fn(),
      getPlan: jest.fn(),
      setPlan: jest.fn(),
      getAssets: jest.fn(),
      setAssets: jest.fn(),
      clear: jest.fn()
    }
    mockPipelineCache.mockImplementation(() => mockCacheInstance)

    // Setup stage mocks
    mockInitialAnalysisInstance = {
      execute: jest.fn().mockResolvedValue(mockAnalysisResult)
    }
    mockInitialAnalysisStage.mockImplementation(() => mockInitialAnalysisInstance)

    mockEnhancementPlanningInstance = {
      execute: jest.fn().mockResolvedValue(mockEnhancementPlan)
    }
    mockEnhancementPlanningStage.mockImplementation(() => mockEnhancementPlanningInstance)

    mockAssetGenerationInstance = {
      execute: jest.fn().mockResolvedValue(mockGeneratedAssets)
    }
    mockAssetGenerationStage.mockImplementation(() => mockAssetGenerationInstance)

    mockFinalCompositionInstance = {
      execute: jest.fn().mockResolvedValue(mockCompositionResult)
    }
    mockFinalCompositionStage.mockImplementation(() => mockFinalCompositionInstance)

    // Create pipeline
    pipeline = new EnhancementPipeline(mockContext)
  })

  describe('Constructor', () => {
    it('should initialize with correct state', () => {
      const state = pipeline.getState()
      
      expect(state.context).toEqual(mockContext)
      expect(state.currentStage).toBe('initial-analysis')
      expect(state.status).toBe('pending')
      expect(state.progress).toBe(0)
      expect(state.stages).toEqual({})
      expect(state.errors).toEqual([])
    })

    it('should create cache instance', () => {
      expect(mockPipelineCache).toHaveBeenCalledWith(mockContext.documentId)
    })

    it('should initialize all stages', () => {
      expect(mockInitialAnalysisStage).toHaveBeenCalled()
      expect(mockEnhancementPlanningStage).toHaveBeenCalled()
      expect(mockAssetGenerationStage).toHaveBeenCalled()
      expect(mockFinalCompositionStage).toHaveBeenCalled()
    })

    it('should extend EventEmitter', () => {
      expect(pipeline).toBeInstanceOf(EventEmitter)
    })
  })

  describe('Execute', () => {
    it('should execute all stages successfully', async () => {
      const events: PipelineEvent[] = []
      pipeline.on('pipeline-event', (event) => events.push(event))

      const result = await pipeline.execute()

      expect(result).toEqual(mockCompositionResult)
      expect(mockInitialAnalysisInstance.execute).toHaveBeenCalled()
      expect(mockEnhancementPlanningInstance.execute).toHaveBeenCalled()
      expect(mockAssetGenerationInstance.execute).toHaveBeenCalled()
      expect(mockFinalCompositionInstance.execute).toHaveBeenCalled()
    })

    it('should cache analysis results', async () => {
      await pipeline.execute()

      expect(mockCacheInstance.setAnalysis).toHaveBeenCalledWith(mockAnalysisResult)
    })

    it('should use cached analysis when available', async () => {
      mockCacheInstance.getAnalysis.mockResolvedValue({
        data: mockAnalysisResult,
        timestamp: Date.now()
      })

      await pipeline.execute()

      expect(mockInitialAnalysisInstance.execute).not.toHaveBeenCalled()
      expect(mockCacheInstance.setAnalysis).not.toHaveBeenCalled()
    })

    it('should skip expired cache', async () => {
      mockCacheInstance.getAnalysis.mockResolvedValue({
        data: mockAnalysisResult,
        timestamp: Date.now() - 2 * 60 * 60 * 1000 // 2 hours old
      })

      await pipeline.execute()

      expect(mockInitialAnalysisInstance.execute).toHaveBeenCalled()
      expect(mockCacheInstance.setAnalysis).toHaveBeenCalled()
    })

    it('should skip enhancement for high-scoring documents', async () => {
      const highScoreAnalysis = {
        ...mockAnalysisResult,
        currentScore: { ...mockAnalysisResult.currentScore, overall: 90 }
      }
      mockInitialAnalysisInstance.execute.mockResolvedValue(highScoreAnalysis)

      await expect(pipeline.execute()).rejects.toThrow(
        'Document does not meet minimum requirements for enhancement'
      )
    })

    it('should skip asset generation for free tier', async () => {
      const freeContext = { ...mockContext, subscriptionTier: 'free' as const }
      pipeline = new EnhancementPipeline(freeContext)

      await pipeline.execute()

      expect(mockAssetGenerationInstance.execute).not.toHaveBeenCalled()
    })

    it('should handle asset generation settings', async () => {
      const noAssetsContext = {
        ...mockContext,
        settings: { ...mockContext.settings, generateAssets: false }
      }
      pipeline = new EnhancementPipeline(noAssetsContext)

      await pipeline.execute()

      expect(mockAssetGenerationInstance.execute).not.toHaveBeenCalled()
    })

    it('should emit stage events', async () => {
      const events: PipelineEvent[] = []
      pipeline.on('pipeline-event', (event) => events.push(event))

      await pipeline.execute()

      const stageEvents = events.filter(e => 
        e.type === 'stage-started' || e.type === 'stage-completed'
      )
      expect(stageEvents).toHaveLength(8) // 4 starts + 4 completes
    })

    it('should update progress correctly', async () => {
      const progressUpdates: number[] = []
      pipeline.onProgress((progress) => progressUpdates.push(progress))

      await pipeline.execute()

      expect(progressUpdates).toEqual([20, 50, 80, 100])
    })

    it('should save pipeline results', async () => {
      const insertMock = jest.fn().mockResolvedValue({ data: null, error: null })
      mockSupabase.from.mockReturnValue({ insert: insertMock })

      await pipeline.execute()

      expect(mockSupabase.from).toHaveBeenCalledWith('enhancement_pipelines')
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: mockContext.documentId,
          user_id: mockContext.userId,
          status: 'running', // Status is still running when saved
          enhanced_file_url: mockCompositionResult.enhancedFileUrl,
          quality_improvement: 25,
          processing_time: 5000
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle stage failures', async () => {
      const error = new Error('Analysis failed')
      mockInitialAnalysisInstance.execute.mockRejectedValue(error)

      await expect(pipeline.execute()).rejects.toThrow('Analysis failed')

      const state = pipeline.getState()
      expect(state.status).toBe('failed')
      expect(state.errors).toHaveLength(1)
      expect(state.errors[0]).toMatchObject({
        stage: 'initial-analysis',
        message: 'Analysis failed'
      })
    })

    it('should emit failure events', async () => {
      const error = new Error('Planning failed')
      mockEnhancementPlanningInstance.execute.mockRejectedValue(error)

      const events: PipelineEvent[] = []
      pipeline.on('pipeline-event', (event) => events.push(event))

      await expect(pipeline.execute()).rejects.toThrow()

      const failureEvents = events.filter(e => 
        e.type === 'stage-failed' || e.type === 'pipeline-failed'
      )
      expect(failureEvents).toHaveLength(2)
    })

    it('should handle unknown errors', async () => {
      mockInitialAnalysisInstance.execute.mockRejectedValue('Unknown error')

      try {
        await pipeline.execute()
      } catch (error) {
        // Expected to throw
      }

      const state = pipeline.getState()
      expect(state.errors[0].message).toBe('Unknown error')
    })
  })

  describe('Cancel', () => {
    it('should cancel pipeline execution', () => {
      const events: PipelineEvent[] = []
      pipeline.on('pipeline-event', (event) => events.push(event))

      pipeline.cancel()

      const state = pipeline.getState()
      expect(state.status).toBe('cancelled')

      const cancelEvent = events.find(e => e.type === 'pipeline-cancelled')
      expect(cancelEvent).toBeDefined()
    })

    it('should abort running operations', () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort')
      
      pipeline.cancel()

      expect(abortSpy).toHaveBeenCalled()
    })
  })

  describe('Stage Execution', () => {
    it('should pass abort signal to stages', async () => {
      await pipeline.execute()

      expect(mockInitialAnalysisInstance.execute).toHaveBeenCalledWith(
        mockContext,
        expect.any(AbortSignal)
      )
    })

    it('should track stage timing', async () => {
      await pipeline.execute()

      const state = pipeline.getState()
      expect(state.stages.initialAnalysis?.startTime).toBeDefined()
      expect(state.stages.initialAnalysis?.endTime).toBeDefined()
      expect(state.stages.initialAnalysis?.status).toBe('completed')
    })

    it('should handle no significant issues', async () => {
      const noIssuesAnalysis = {
        ...mockAnalysisResult,
        designIssues: [
          { type: 'spacing' as const, severity: 'low' as const, description: 'Minor spacing' }
        ]
      }
      mockInitialAnalysisInstance.execute.mockResolvedValue(noIssuesAnalysis)

      await expect(pipeline.execute()).rejects.toThrow(
        'Document does not meet minimum requirements for enhancement'
      )
    })
  })

  describe('Basic Tier Behavior', () => {
    it('should randomly generate assets for basic tier', async () => {
      // Mock Math.random to control randomness
      const randomSpy = jest.spyOn(Math, 'random')
      
      // Test with random < 0.5 (should generate assets)
      randomSpy.mockReturnValue(0.4)
      const basicContext = { ...mockContext, subscriptionTier: 'basic' as const }
      const basicPipeline = new EnhancementPipeline(basicContext)
      await basicPipeline.execute()
      expect(mockAssetGenerationInstance.execute).toHaveBeenCalled()

      // Reset mocks
      jest.clearAllMocks()
      
      // Test with random >= 0.5 (should not generate assets)
      randomSpy.mockReturnValue(0.6)
      const basicPipeline2 = new EnhancementPipeline(basicContext)
      await basicPipeline2.execute()
      expect(mockAssetGenerationInstance.execute).not.toHaveBeenCalled()

      randomSpy.mockRestore()
    })
  })

  describe('Event Listeners', () => {
    it('should support progress callback', async () => {
      const progressCallback = jest.fn()
      pipeline.onProgress(progressCallback)

      await pipeline.execute()

      expect(progressCallback).toHaveBeenCalledWith(20)
      expect(progressCallback).toHaveBeenCalledWith(50)
      expect(progressCallback).toHaveBeenCalledWith(80)
      expect(progressCallback).toHaveBeenCalledWith(100)
    })

    it('should handle multiple event listeners', async () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      pipeline.on('pipeline-event', listener1)
      pipeline.on('pipeline-event', listener2)

      await pipeline.execute()

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
    })
  })

  describe('State Management', () => {
    it('should return immutable state copy', () => {
      const state1 = pipeline.getState()
      const state2 = pipeline.getState()

      expect(state1).not.toBe(state2)
      expect(state1).toEqual(state2)
    })

    it('should update timestamps', async () => {
      const initialState = pipeline.getState()
      const initialUpdatedAt = initialState.updatedAt

      await new Promise(resolve => setTimeout(resolve, 10))
      await pipeline.execute()

      const finalState = pipeline.getState()
      expect(finalState.updatedAt.getTime()).toBeGreaterThan(initialUpdatedAt.getTime())
    })
  })

  describe('Cache Interactions', () => {
    it('should cache enhancement plan', async () => {
      await pipeline.execute()

      expect(mockCacheInstance.setPlan).toHaveBeenCalledWith(mockEnhancementPlan)
    })

    it('should cache generated assets', async () => {
      await pipeline.execute()

      expect(mockCacheInstance.setAssets).toHaveBeenCalledWith(mockGeneratedAssets)
    })

    it('should use all cached data when available', async () => {
      const now = Date.now()
      mockCacheInstance.getAnalysis.mockResolvedValue({
        data: mockAnalysisResult,
        timestamp: now
      })
      mockCacheInstance.getPlan.mockResolvedValue({
        data: mockEnhancementPlan,
        timestamp: now
      })
      mockCacheInstance.getAssets.mockResolvedValue({
        data: mockGeneratedAssets,
        timestamp: now
      })

      await pipeline.execute()

      expect(mockInitialAnalysisInstance.execute).not.toHaveBeenCalled()
      expect(mockEnhancementPlanningInstance.execute).not.toHaveBeenCalled()
      expect(mockAssetGenerationInstance.execute).not.toHaveBeenCalled()
      expect(mockFinalCompositionInstance.execute).toHaveBeenCalled()
    })
  })
})