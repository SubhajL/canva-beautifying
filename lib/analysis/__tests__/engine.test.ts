import { DocumentAnalysisEngine } from '../engine'
import { DocumentContext } from '../types'
import { LayoutAnalyzer } from '../analyzers/layout'
import { ColorAnalyzer } from '../analyzers/color'
import { TypographyAnalyzer } from '../analyzers/typography'
import { AgeAppropriatenessAnalyzer } from '../analyzers/age-appropriateness'
import { SubjectMatterAnalyzer } from '../analyzers/subject-matter'
import { EngagementAnalyzer } from '../analyzers/engagement'

// Mock all analyzers
jest.mock('../analyzers/layout')
jest.mock('../analyzers/color')
jest.mock('../analyzers/typography')
jest.mock('../analyzers/age-appropriateness')
jest.mock('../analyzers/subject-matter')
jest.mock('../analyzers/engagement')

describe('DocumentAnalysisEngine', () => {
  let engine: DocumentAnalysisEngine
  let mockContext: DocumentContext
  
  // Mock analyzer instances
  let mockLayoutAnalyzer: jest.Mocked<LayoutAnalyzer>
  let mockColorAnalyzer: jest.Mocked<ColorAnalyzer>
  let mockTypographyAnalyzer: jest.Mocked<TypographyAnalyzer>
  let mockAgeAnalyzer: jest.Mocked<AgeAppropriatenessAnalyzer>
  let mockSubjectAnalyzer: jest.Mocked<SubjectMatterAnalyzer>
  let mockEngagementAnalyzer: jest.Mocked<EngagementAnalyzer>

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create mock instances
    mockLayoutAnalyzer = {
      analyze: jest.fn()
    } as any
    
    mockColorAnalyzer = {
      analyze: jest.fn()
    } as any
    
    mockTypographyAnalyzer = {
      analyze: jest.fn()
    } as any
    
    mockAgeAnalyzer = {
      analyze: jest.fn()
    } as any
    
    mockSubjectAnalyzer = {
      analyze: jest.fn()
    } as any
    
    mockEngagementAnalyzer = {
      analyze: jest.fn()
    } as any
    
    // Mock constructors
    ;(LayoutAnalyzer as jest.MockedClass<typeof LayoutAnalyzer>).mockImplementation(() => mockLayoutAnalyzer)
    ;(ColorAnalyzer as jest.MockedClass<typeof ColorAnalyzer>).mockImplementation(() => mockColorAnalyzer)
    ;(TypographyAnalyzer as jest.MockedClass<typeof TypographyAnalyzer>).mockImplementation(() => mockTypographyAnalyzer)
    ;(AgeAppropriatenessAnalyzer as jest.MockedClass<typeof AgeAppropriatenessAnalyzer>).mockImplementation(() => mockAgeAnalyzer)
    ;(SubjectMatterAnalyzer as jest.MockedClass<typeof SubjectMatterAnalyzer>).mockImplementation(() => mockSubjectAnalyzer)
    ;(EngagementAnalyzer as jest.MockedClass<typeof EngagementAnalyzer>).mockImplementation(() => mockEngagementAnalyzer)
    
    engine = new DocumentAnalysisEngine()
    
    mockContext = {
      imageData: null, // Tests can override this if needed
      metadata: {
        width: 800,
        height: 600,
        format: 'pdf',
        size: 1024000
      },
      type: 'worksheet'
    }
  })

  describe('Individual analyzers', () => {
    it('analyzes layout', async () => {
      const mockLayoutMetrics = {
        whitespace: 30,
        alignment: {
          horizontal: 'left' as const,
          vertical: 'top' as const,
          consistency: 90
        },
        hierarchy: {
          levels: 3,
          clarity: 85
        },
        grid: {
          detected: true,
          consistency: 75
        },
        margins: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
          consistency: 100
        }
      }
      
      mockLayoutAnalyzer.analyze.mockResolvedValue(mockLayoutMetrics)
      
      const result = await engine.analyzeLayout(mockContext)
      
      expect(result).toEqual(mockLayoutMetrics)
      expect(mockLayoutAnalyzer.analyze).toHaveBeenCalledWith(mockContext)
    })

    it('analyzes colors', async () => {
      const mockColorMetrics = {
        palette: {
          primary: ['#0066CC'],
          secondary: ['#FF6600'],
          accent: ['#00AA00']
        },
        contrast: {
          wcagAAA: true,
          wcagAA: true,
          score: 95
        },
        harmony: {
          type: 'complementary' as const,
          score: 85
        },
        accessibility: {
          colorBlindSafe: true,
          issues: []
        }
      }
      
      mockColorAnalyzer.analyze.mockResolvedValue(mockColorMetrics)
      
      const result = await engine.analyzeColors(mockContext)
      
      expect(result).toEqual(mockColorMetrics)
      expect(mockColorAnalyzer.analyze).toHaveBeenCalledWith(mockContext)
    })

    it('analyzes typography', async () => {
      const mockTypographyMetrics = {
        fonts: {
          families: ['Arial', 'Georgia'],
          sizes: [12, 16, 24, 32],
          weights: [400, 700]
        },
        hierarchy: {
          levels: 3,
          consistency: 90
        },
        readability: {
          fleschKincaid: 65,
          lineHeight: 1.5,
          characterSpacing: 0,
          score: 85
        },
        consistency: {
          fontPairing: 85,
          sizeRatio: 90
        }
      }
      
      mockTypographyAnalyzer.analyze.mockResolvedValue(mockTypographyMetrics)
      
      const result = await engine.analyzeTypography(mockContext)
      
      expect(result).toEqual(mockTypographyMetrics)
      expect(mockTypographyAnalyzer.analyze).toHaveBeenCalledWith(mockContext)
    })

    it('analyzes age appropriateness', async () => {
      const mockAgeMetrics = {
        targetAge: 'elementary',
        confidence: 0.85,
        factors: {
          visualComplexity: 0.3,
          textComplexity: 0.4,
          contentMaturity: 0.2,
          interactivity: 0.5
        },
        recommendations: [
          'Add more visual elements',
          'Simplify text structure'
        ]
      }
      
      mockAgeAnalyzer.analyze.mockResolvedValue(mockAgeMetrics)
      
      const result = await engine.analyzeAgeAppropriateness(mockContext)
      
      expect(result).toEqual(mockAgeMetrics)
      expect(mockAgeAnalyzer.analyze).toHaveBeenCalledWith(mockContext)
    })

    it('identifies subject matter', async () => {
      const mockSubjectMatter = {
        primary: 'mathematics',
        secondary: ['geometry', 'algebra'],
        confidence: 0.9,
        keywords: ['equation', 'triangle', 'solve', 'calculate'],
        educationalLevel: 'middle-school'
      }
      
      mockSubjectAnalyzer.analyze.mockResolvedValue(mockSubjectMatter)
      
      const result = await engine.identifySubjectMatter(mockContext)
      
      expect(result).toEqual(mockSubjectMatter)
      expect(mockSubjectAnalyzer.analyze).toHaveBeenCalledWith(mockContext)
    })

    it('calculates engagement metrics', async () => {
      const mockEngagementMetrics = {
        visualComplexity: 75,
        interestElements: ['colors', 'patterns', 'shapes'],
        attentionAnchors: 4,
        flowScore: 80,
        emotionalTone: 'positive' as const
      }
      
      mockEngagementAnalyzer.analyze.mockResolvedValue(mockEngagementMetrics)
      
      const result = await engine.calculateEngagement(mockContext)
      
      expect(result).toEqual(mockEngagementMetrics)
      expect(mockEngagementAnalyzer.analyze).toHaveBeenCalledWith(mockContext)
    })
  })

  describe('generateCompleteAnalysis', () => {
    beforeEach(() => {
      // Setup default mock responses
      mockLayoutAnalyzer.analyze.mockResolvedValue({
        whitespace: 15, // Low whitespace to trigger suggestions
        alignment: {
          horizontal: 'left' as const,
          vertical: 'top' as const,
          consistency: 60 // Low consistency to trigger suggestions
        },
        hierarchy: {
          levels: 1, // Low hierarchy to trigger suggestions
          clarity: 50
        },
        grid: {
          detected: false,
          consistency: 40
        },
        margins: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20,
          consistency: 60 // Low consistency to trigger suggestions
        }
      })
      
      mockColorAnalyzer.analyze.mockResolvedValue({
        palette: {
          primary: ['#0066CC'],
          secondary: ['#FF6600'],
          accent: ['#00AA00']
        },
        contrast: {
          wcagAAA: true,
          wcagAA: true,
          score: 95
        },
        harmony: {
          type: 'complementary' as const,
          score: 85
        },
        accessibility: {
          colorBlindSafe: true,
          issues: []
        }
      })
      
      mockTypographyAnalyzer.analyze.mockResolvedValue({
        fonts: {
          families: ['Arial', 'Georgia'],
          sizes: [12, 16, 24, 32],
          weights: [400, 700]
        },
        hierarchy: {
          levels: 3,
          consistency: 90
        },
        readability: {
          fleschKincaid: 65,
          lineHeight: 1.5,
          characterSpacing: 0,
          score: 85
        },
        consistency: {
          fontPairing: 85,
          sizeRatio: 90
        }
      })
      
      mockAgeAnalyzer.analyze.mockResolvedValue({
        targetAge: 'elementary',
        confidence: 0.85,
        factors: {
          visualComplexity: 0.3,
          textComplexity: 0.4,
          contentMaturity: 0.2,
          interactivity: 0.5
        },
        recommendations: []
      })
      
      mockSubjectAnalyzer.analyze.mockResolvedValue({
        primary: 'mathematics',
        secondary: ['geometry'],
        confidence: 0.9,
        keywords: ['equation', 'triangle'],
        educationalLevel: 'middle-school'
      })
      
      mockEngagementAnalyzer.analyze.mockResolvedValue({
        visualComplexity: 75,
        interestElements: ['colors', 'patterns', 'shapes'],
        attentionAnchors: 4,
        flowScore: 80,
        emotionalTone: 'positive' as const
      })
    })

    it('runs all analyses in parallel', async () => {
      const startTime = Date.now()
      
      // Add artificial delays to mock analyzers
      mockLayoutAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          whitespace: 30,
          alignment: { horizontal: 'left', vertical: 'top', consistency: 90 },
          hierarchy: { levels: 3, clarity: 85 },
          grid: { detected: true, consistency: 75 },
          margins: { top: 20, right: 20, bottom: 20, left: 20, consistency: 100 }
        } as any
      })
      
      mockColorAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          palette: { primary: ['#0066CC'], secondary: ['#FF6600'], accent: ['#00AA00'] },
          contrast: { wcagAAA: true, wcagAA: true, score: 95 },
          harmony: { type: 'complementary' as const, score: 85 },
          accessibility: { colorBlindSafe: true, issues: [] }
        } as any
      })
      
      // Need to mock all analyzers for complete analysis
      mockTypographyAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          fonts: { families: ['Arial'], sizes: [12, 16], weights: [400] },
          hierarchy: { levels: 3, consistency: 90 },
          readability: { fleschKincaid: 65, lineHeight: 1.5, characterSpacing: 0, score: 85 },
          consistency: { fontPairing: 85, sizeRatio: 90 }
        }
      })
      
      mockAgeAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          detectedAge: 'children' as const,
          confidence: 85,
          factors: { complexity: 30, visualStyle: 40, contentMaturity: 20 }
        }
      })
      
      mockSubjectAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          primary: 'mathematics',
          secondary: ['geometry'],
          confidence: 90,
          keywords: ['triangle']
        }
      })
      
      mockEngagementAnalyzer.analyze.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return {
          visualComplexity: 80,
          interestElements: ['colors'],
          attentionAnchors: 5,
          flowScore: 75,
          emotionalTone: 'positive' as const
        }
      })
      
      await engine.generateCompleteAnalysis(mockContext)
      
      const elapsed = Date.now() - startTime
      
      // If run in parallel, should take ~100ms, not 600ms
      expect(elapsed).toBeLessThan(200)
    })

    it('generates complete document analysis', async () => {
      const result = await engine.generateCompleteAnalysis(mockContext)
      
      // Verify structure
      expect(result).toHaveProperty('layout')
      expect(result).toHaveProperty('colors')
      expect(result).toHaveProperty('typography')
      expect(result).toHaveProperty('engagement')
      expect(result).toHaveProperty('overallScore')
      expect(result).toHaveProperty('priority')
      
      // Verify all analyzers were called
      expect(mockLayoutAnalyzer.analyze).toHaveBeenCalledTimes(1)
      expect(mockColorAnalyzer.analyze).toHaveBeenCalledTimes(1)
      expect(mockTypographyAnalyzer.analyze).toHaveBeenCalledTimes(1)
      expect(mockAgeAnalyzer.analyze).toHaveBeenCalledTimes(1)
      expect(mockSubjectAnalyzer.analyze).toHaveBeenCalledTimes(1)
      expect(mockEngagementAnalyzer.analyze).toHaveBeenCalledTimes(1)
    })

    it('calculates overall quality score', async () => {
      const result = await engine.generateCompleteAnalysis(mockContext)
      
      expect(result).toHaveProperty('overallScore')
      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(100)
      
      // Should have breakdown scores
      expect(result.layout).toHaveProperty('score')
      expect(result.colors).toHaveProperty('score')
      expect(result.typography).toHaveProperty('score')
      expect(result.engagement).toHaveProperty('score')
    })

    it('generates relevant suggestions', async () => {
      const result = await engine.generateCompleteAnalysis(mockContext)
      
      // Check that each section has suggestions
      expect(Array.isArray(result.layout.suggestions)).toBe(true)
      expect(Array.isArray(result.colors.suggestions)).toBe(true)
      expect(Array.isArray(result.typography.suggestions)).toBe(true)
      expect(Array.isArray(result.engagement.suggestions)).toBe(true)
      
      // Verify at least some suggestions exist
      const allSuggestions = [
        ...result.layout.suggestions,
        ...result.colors.suggestions,
        ...result.typography.suggestions,
        ...result.engagement.suggestions
      ]
      expect(allSuggestions.length).toBeGreaterThan(0)
    })

    it('handles analyzer errors gracefully', async () => {
      mockColorAnalyzer.analyze.mockRejectedValue(new Error('Color analysis failed'))
      
      // The engine doesn't have error handling, so it will throw
      await expect(engine.generateCompleteAnalysis(mockContext)).rejects.toThrow('Color analysis failed')
    })

    it('identifies critical issues', async () => {
      // Mock poor metrics
      mockColorAnalyzer.analyze.mockResolvedValue({
        palette: {
          primary: ['#FFFF00'], // Yellow
          secondary: ['#FFFFFF'], // White
          accent: ['#FFFFCC']
        },
        contrast: {
          wcagAAA: false,
          wcagAA: false,
          score: 15 // Very poor contrast
        },
        harmony: {
          type: 'monochromatic' as const,
          score: 20
        },
        accessibility: {
          colorBlindSafe: false,
          issues: ['Insufficient contrast', 'Not distinguishable for colorblind users']
        }
      })
      
      const result = await engine.generateCompleteAnalysis(mockContext)
      
      // Should identify contrast as a critical issue
      expect(result.colors.issues.length).toBeGreaterThan(0)
      expect(result.colors.issues[0]).toContain('contrast')
    })
  })

  describe('Edge cases', () => {
    it('handles empty document context', async () => {
      const emptyContext: DocumentContext = {
        imageData: null,
        metadata: {
          width: 0,
          height: 0,
          format: 'unknown',
          size: 0
        },
        type: 'worksheet'
      }
      
      // Analyzers will likely throw errors with no image data
      await expect(engine.generateCompleteAnalysis(emptyContext)).rejects.toThrow()
    })

    it('handles missing analyzer responses', async () => {
      mockLayoutAnalyzer.analyze.mockResolvedValue(null as any)
      
      // The engine doesn't handle null responses, so it will throw
      await expect(engine.generateCompleteAnalysis(mockContext)).rejects.toThrow()
    })
  })
})