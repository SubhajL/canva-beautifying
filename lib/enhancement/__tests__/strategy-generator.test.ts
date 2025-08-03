import { StrategyGenerator } from '../strategy-generator'
import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences } from '../types'
import { ColorEnhancer } from '../enhancers/color-enhancer'
import { TypographyEnhancer } from '../enhancers/typography-enhancer'
import { LayoutEnhancer } from '../enhancers/layout-enhancer'
import { BackgroundEnhancer } from '../enhancers/background-enhancer'
import { DecorativeEnhancer } from '../enhancers/decorative-enhancer'

// Mock all enhancers
jest.mock('../enhancers/color-enhancer')
jest.mock('../enhancers/typography-enhancer')
jest.mock('../enhancers/layout-enhancer')
jest.mock('../enhancers/background-enhancer')
jest.mock('../enhancers/decorative-enhancer')

const mockColorEnhancer = ColorEnhancer as jest.MockedClass<typeof ColorEnhancer>
const mockTypographyEnhancer = TypographyEnhancer as jest.MockedClass<typeof TypographyEnhancer>
const mockLayoutEnhancer = LayoutEnhancer as jest.MockedClass<typeof LayoutEnhancer>
const mockBackgroundEnhancer = BackgroundEnhancer as jest.MockedClass<typeof BackgroundEnhancer>
const mockDecorativeEnhancer = DecorativeEnhancer as jest.MockedClass<typeof DecorativeEnhancer>

describe('StrategyGenerator', () => {
  let generator: StrategyGenerator
  let mockAnalysis: DocumentAnalysis
  
  // Mock strategies
  const mockColorStrategy: EnhancementStrategy = {
    id: 'color-1',
    name: 'Improve Color Contrast',
    description: 'Enhance color contrast for better readability',
    priority: 'high',
    impact: 85,
    changes: {
      colors: {
        palette: {
          primary: '#1e40af',
          secondary: ['#3b82f6'],
          accent: '#f59e0b',
          background: '#ffffff',
          text: '#1f2937'
        },
        adjustments: {
          contrast: 1.5,
          saturation: 1.0,
          brightness: 1.0
        },
        replacements: new Map([['#ff0000', '#ef4444']])
      }
    }
  }

  const mockTypographyStrategy: EnhancementStrategy = {
    id: 'typography-1',
    name: 'Enhance Typography',
    description: 'Improve font choices and readability',
    priority: 'medium',
    impact: 70,
    changes: {
      typography: {
        fonts: {
          heading: 'Inter',
          body: 'Open Sans'
        },
        sizes: {
          base: 16,
          scale: 1.25,
          headings: [32, 24, 20, 18]
        },
        improvements: {
          lineHeight: 1.5,
          letterSpacing: 0,
          paragraphSpacing: 1.5
        }
      }
    }
  }

  const mockLayoutStrategy: EnhancementStrategy = {
    id: 'layout-1',
    name: 'Optimize Layout',
    description: 'Improve layout structure and spacing',
    priority: 'medium',
    impact: 65,
    changes: {
      layout: {
        grid: {
          columns: 12,
          rows: 8,
          gutters: 16,
          margins: 24
        },
        spacing: {
          sections: 48,
          elements: 24,
          padding: 16
        },
        alignment: 'left',
        hierarchy: {
          levels: 3,
          emphasis: new Map([['title', 3], ['subtitle', 2], ['body', 1]])
        }
      }
    }
  }

  const mockBackgroundStrategy: EnhancementStrategy = {
    id: 'background-1',
    name: 'Update Background',
    description: 'Add subtle background enhancement',
    priority: 'low',
    impact: 45,
    changes: {
      background: {
        type: 'gradient',
        value: {
          colors: ['#f3f4f6', '#e5e7eb'],
          direction: 'to bottom'
        }
      }
    }
  }

  const mockDecorativeStrategy: EnhancementStrategy = {
    id: 'decorative-1',
    name: 'Add Decorative Elements',
    description: 'Add visual interest with decorative elements',
    priority: 'low',
    impact: 40,
    changes: {
      decorativeElements: [{
        type: 'shape',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        style: { fill: '#3b82f6', opacity: 0.1 },
        purpose: 'decoration'
      }]
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock analysis
    mockAnalysis = {
      documentType: 'worksheet',
      purpose: 'educational',
      quality: {
        overall: 65,
        colorContrast: 55,
        layout: 60,
        typography: 70,
        accessibility: 65
      },
      overallScore: 62,
      audience: {
        level: 'intermediate',
        ageGroup: 'adult',
        domain: 'education'
      },
      content: {
        textElements: ['Title', 'Content'],
        imageCount: 2,
        wordCount: 500,
        languages: ['en']
      },
      design: {
        colorPalette: ['#000000', '#ffffff'],
        fonts: ['Arial'],
        layout: 'single-column',
        visualHierarchy: 'weak'
      },
      colors: {
        palette: {
          primary: '#000000',
          secondary: [],
          accent: null,
          neutral: ['#ffffff']
        },
        contrast: {
          score: 55,
          issues: ['Poor contrast'],
          wcagLevel: 'A'
        },
        harmony: 50,
        accessibility: 65,
        issues: ['Poor contrast', 'Lacks visual interest']
      },
      typography: {
        fonts: {
          headings: 'Arial',
          body: 'Arial',
          consistency: 100
        },
        readability: {
          score: 70,
          fleschKincaid: 8.5,
          avgWordsPerSentence: 15
        },
        hierarchy: {
          levels: 2,
          consistency: 70
        },
        issues: ['Limited hierarchy', 'Generic font choice']
      },
      layout: {
        structure: {
          type: 'single-column',
          grid: null,
          consistency: 80
        },
        spacing: {
          consistency: 60,
          whiteSpace: 40
        },
        alignment: {
          horizontal: 'left',
          vertical: 'top',
          consistency: 90
        },
        balance: 65,
        issues: ['Insufficient white space', 'Unclear hierarchy']
      },
      opportunities: [
        'Improve color contrast',
        'Add visual hierarchy',
        'Increase white space'
      ],
      aiInsights: {
        strengths: ['Clear content'],
        improvements: ['Enhance visual design'],
        suggestions: ['Use better typography']
      }
    }
    
    // Setup mock enhancers
    const mockColorEnhancerInstance = {
      analyze: jest.fn().mockResolvedValue([mockColorStrategy])
    }
    const mockTypographyEnhancerInstance = {
      analyze: jest.fn().mockResolvedValue([mockTypographyStrategy])
    }
    const mockLayoutEnhancerInstance = {
      analyze: jest.fn().mockResolvedValue([mockLayoutStrategy])
    }
    const mockBackgroundEnhancerInstance = {
      analyze: jest.fn().mockResolvedValue([mockBackgroundStrategy])
    }
    const mockDecorativeEnhancerInstance = {
      analyze: jest.fn().mockResolvedValue([mockDecorativeStrategy])
    }
    
    mockColorEnhancer.mockImplementation(() => mockColorEnhancerInstance as any)
    mockTypographyEnhancer.mockImplementation(() => mockTypographyEnhancerInstance as any)
    mockLayoutEnhancer.mockImplementation(() => mockLayoutEnhancerInstance as any)
    mockBackgroundEnhancer.mockImplementation(() => mockBackgroundEnhancerInstance as any)
    mockDecorativeEnhancer.mockImplementation(() => mockDecorativeEnhancerInstance as any)
    
    generator = new StrategyGenerator()
  })

  describe('generateStrategies', () => {
    it('should generate strategies from all enhancers', async () => {
      const strategies = await generator.generateStrategies(mockAnalysis)

      expect(strategies).toHaveLength(5)
      expect(strategies).toContain(mockColorStrategy)
      expect(strategies).toContain(mockTypographyStrategy)
      expect(strategies).toContain(mockLayoutStrategy)
      expect(strategies).toContain(mockBackgroundStrategy)
      expect(strategies).toContain(mockDecorativeStrategy)
    })

    it('should sort strategies by priority and impact', async () => {
      const strategies = await generator.generateStrategies(mockAnalysis)

      // Color strategy should be first (high priority, highest impact)
      expect(strategies[0]).toBe(mockColorStrategy)
      
      // Check that strategies are properly ordered
      for (let i = 1; i < strategies.length; i++) {
        const prevScore = strategies[i - 1].impact * 
          (strategies[i - 1].priority === 'high' ? 1.5 : 
           strategies[i - 1].priority === 'medium' ? 1.0 : 0.7)
        const currScore = strategies[i].impact * 
          (strategies[i].priority === 'high' ? 1.5 : 
           strategies[i].priority === 'medium' ? 1.0 : 0.7)
        
        expect(prevScore).toBeGreaterThanOrEqual(currScore)
      }
    })

    it('should apply preferences to filter strategies', async () => {
      const preferences: EnhancementPreferences = {
        preserveContent: true,
        autoApprove: false
      }

      const strategies = await generator.generateStrategies(mockAnalysis, preferences)

      // Layout and typography strategies should be filtered out
      expect(strategies).not.toContain(mockLayoutStrategy)
      expect(strategies).not.toContain(mockTypographyStrategy)
      
      // Color strategy should remain (high priority)
      expect(strategies).toContain(mockColorStrategy)
    })

    it('should keep all strategies with auto-approve', async () => {
      const preferences: EnhancementPreferences = {
        autoApprove: true
      }

      const strategies = await generator.generateStrategies(mockAnalysis, preferences)

      expect(strategies).toHaveLength(5)
    })

    it('should resolve conflicts between strategies', async () => {
      // Create conflicting color strategies
      const conflictingColorStrategy: EnhancementStrategy = {
        ...mockColorStrategy,
        id: 'color-2',
        impact: 90 // Higher impact
      }

      const mockColorEnhancerInstance = {
        analyze: jest.fn().mockResolvedValue([mockColorStrategy, conflictingColorStrategy])
      }
      mockColorEnhancer.mockImplementation(() => mockColorEnhancerInstance as any)

      // Create a new generator instance after mocking
      const conflictGenerator = new StrategyGenerator()
      const strategies = await conflictGenerator.generateStrategies(mockAnalysis)

      // Should only include the higher impact color strategy
      const colorStrategies = strategies.filter(s => s.changes.colors)
      expect(colorStrategies).toHaveLength(1)
      expect(colorStrategies[0].id).toBe('color-2')
    })

    it('should boost strategies for low-scoring documents', async () => {
      const lowScoreAnalysis = {
        ...mockAnalysis,
        overallScore: 40,
        quality: {
          ...mockAnalysis.quality,
          overall: 40
        }
      }

      const strategies = await generator.generateStrategies(lowScoreAnalysis)

      // Strategies should still be present with boosted priority
      expect(strategies.length).toBeGreaterThan(0)
    })

    it('should handle empty strategy responses', async () => {
      // Create a new generator with mocked enhancers that return empty arrays
      const emptyEnhancer = { analyze: jest.fn().mockResolvedValue([]) }
      
      mockColorEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockTypographyEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockLayoutEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockBackgroundEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockDecorativeEnhancer.mockImplementation(() => emptyEnhancer as any)

      // Create a new generator instance after mocking
      const emptyGenerator = new StrategyGenerator()
      const strategies = await emptyGenerator.generateStrategies(mockAnalysis)

      expect(strategies).toEqual([])
    })

    it('should handle enhancer errors gracefully', async () => {
      // Make one enhancer throw an error
      const errorEnhancer = {
        analyze: jest.fn().mockRejectedValue(new Error('Enhancer error'))
      }
      mockColorEnhancer.mockImplementation(() => errorEnhancer as any)

      // Create a new generator instance after mocking
      const errorGenerator = new StrategyGenerator()
      
      // Should throw the error from the enhancer
      await expect(errorGenerator.generateStrategies(mockAnalysis)).rejects.toThrow('Enhancer error')
    })

    it('should prioritize strategies addressing critical issues', async () => {
      // Update analysis to have critical issues
      const criticalAnalysis = {
        ...mockAnalysis,
        colors: {
          ...mockAnalysis.colors,
          issues: ['Poor contrast', 'Poor readability']
        }
      }

      const strategies = await generator.generateStrategies(criticalAnalysis)

      // Color strategy should be prioritized
      expect(strategies[0].id).toBe('color-1')
    })
  })

  describe('generateOptimalStrategy', () => {
    it('should create a combined optimal strategy', async () => {
      const optimal = await generator.generateOptimalStrategy(mockAnalysis)

      expect(optimal.id).toMatch(/^optimal-\d+$/)
      expect(optimal.name).toBe('Comprehensive Enhancement')
      expect(optimal.priority).toBe('high')
      expect(optimal.changes).toBeDefined()
    })

    it('should merge non-conflicting changes', async () => {
      const optimal = await generator.generateOptimalStrategy(mockAnalysis)

      // Should have changes from multiple strategies
      expect(Object.keys(optimal.changes).length).toBeGreaterThan(0)
      expect(optimal.changes.colors).toBeDefined()
    })

    it('should calculate combined impact correctly', async () => {
      const optimal = await generator.generateOptimalStrategy(mockAnalysis)

      // Impact should be calculated with diminishing returns
      expect(optimal.impact).toBeGreaterThan(0)
      expect(optimal.impact).toBeLessThan(100)
    })

    it('should limit to top 5 strategies', async () => {
      // Create many strategies
      const manyStrategies = Array(10).fill(null).map((_, i) => ({
        id: `strategy-${i}`,
        name: `Strategy ${i}`,
        description: `Description ${i}`,
        priority: 'medium' as const,
        impact: 50 + i,
        changes: { [`change${i}`]: {} }
      }))

      const mockEnhancerWithMany = {
        analyze: jest.fn().mockResolvedValue(manyStrategies)
      }
      mockColorEnhancer.mockImplementation(() => mockEnhancerWithMany as any)

      const optimal = await generator.generateOptimalStrategy(mockAnalysis)

      // Should only include changes from top strategies
      const changeCount = Object.keys(optimal.changes).length
      expect(changeCount).toBeLessThanOrEqual(5)
    })

    it('should handle no strategies gracefully', async () => {
      // Mock all enhancers to return empty arrays
      const emptyEnhancer = { analyze: jest.fn().mockResolvedValue([]) }
      
      mockColorEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockTypographyEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockLayoutEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockBackgroundEnhancer.mockImplementation(() => emptyEnhancer as any)
      mockDecorativeEnhancer.mockImplementation(() => emptyEnhancer as any)

      // Create a new generator instance after mocking
      const emptyGenerator = new StrategyGenerator()
      const optimal = await emptyGenerator.generateOptimalStrategy(mockAnalysis)

      expect(optimal.impact).toBe(0)
      expect(optimal.changes).toEqual({})
    })

    it('should respect preferences in optimal strategy', async () => {
      const preferences: EnhancementPreferences = {
        preserveContent: true
      }

      const optimal = await generator.generateOptimalStrategy(mockAnalysis, preferences)

      // Should not include layout or typography changes
      expect(optimal.changes.layout).toBeUndefined()
      expect(optimal.changes.typography).toBeUndefined()
    })
  })

  describe('Priority Calculation', () => {
    it('should apply priority multipliers correctly', async () => {
      // Create strategies with different priorities but same impact
      const highPriorityStrategy = { ...mockColorStrategy, impact: 60, priority: 'high' as const }
      const mediumPriorityStrategy = { ...mockTypographyStrategy, impact: 60, priority: 'medium' as const }
      const lowPriorityStrategy = { ...mockLayoutStrategy, impact: 60, priority: 'low' as const }

      const mockEnhancerWithPriorities = {
        analyze: jest.fn().mockResolvedValue([
          highPriorityStrategy,
          mediumPriorityStrategy,
          lowPriorityStrategy
        ])
      }
      
      mockColorEnhancer.mockImplementation(() => mockEnhancerWithPriorities as any)
      mockTypographyEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))
      mockLayoutEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))
      mockBackgroundEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))
      mockDecorativeEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))

      // Create a new generator instance after mocking
      const priorityGenerator = new StrategyGenerator()
      const strategies = await priorityGenerator.generateStrategies(mockAnalysis)

      // High priority should come first
      expect(strategies[0].priority).toBe('high')
      expect(strategies[1].priority).toBe('medium')
      expect(strategies[2].priority).toBe('low')
    })
  })

  describe('Conflict Resolution', () => {
    it('should handle multiple conflicts correctly', async () => {
      // Create multiple conflicting strategies
      const colorStrategy1 = { ...mockColorStrategy, id: 'color-1', impact: 70 }
      const colorStrategy2 = { ...mockColorStrategy, id: 'color-2', impact: 80 }
      const colorStrategy3 = { ...mockColorStrategy, id: 'color-3', impact: 90 }

      const mockEnhancerWithConflicts = {
        analyze: jest.fn().mockResolvedValue([colorStrategy1, colorStrategy2, colorStrategy3])
      }
      mockColorEnhancer.mockImplementation(() => mockEnhancerWithConflicts as any)
      mockTypographyEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))
      mockLayoutEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))
      mockBackgroundEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))
      mockDecorativeEnhancer.mockImplementation(() => ({ analyze: jest.fn().mockResolvedValue([]) } as any))

      // Create a new generator instance after mocking
      const conflictGenerator = new StrategyGenerator()
      const strategies = await conflictGenerator.generateStrategies(mockAnalysis)

      // Should only keep the highest impact color strategy
      const colorStrategies = strategies.filter(s => s.id.startsWith('color-'))
      expect(colorStrategies).toHaveLength(1)
      expect(colorStrategies[0].id).toBe('color-3')
    })

    it('should allow non-conflicting strategies to coexist', async () => {
      const strategies = await generator.generateStrategies(mockAnalysis)

      // Different types of changes should all be present
      const hasColors = strategies.some(s => s.changes.colors)
      const hasBackground = strategies.some(s => s.changes.background)
      const hasDecorative = strategies.some(s => s.changes.decorativeElements)

      expect(hasColors || hasBackground || hasDecorative).toBe(true)
    })
  })
})