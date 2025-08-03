import { BaseEnhancer } from '../base-enhancer'
import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences, LayoutEnhancement } from '../types'

export class LayoutEnhancer extends BaseEnhancer {
  private readonly gridSystems = {
    classic: { columns: 12, gutters: 20, margins: 60 },
    modern: { columns: 16, gutters: 24, margins: 80 },
    minimal: { columns: 8, gutters: 32, margins: 120 },
    magazine: { columns: 6, gutters: 16, margins: 40 },
    presentation: { columns: 4, gutters: 40, margins: 100 }
  }

  constructor() {
    super('Layout Optimization', 'Restructures layout for better visual hierarchy and flow', 'high')
  }

  async analyze(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy[]> {
    const strategies: EnhancementStrategy[] = []
    const layoutScore = analysis.layout.score

    // Generate layout enhancement strategies
    if (layoutScore < 80) {
      const layoutStrategy = await this.generateLayoutStrategy(analysis, preferences)
      strategies.push(layoutStrategy)
    }

    // Add spacing-focused strategy if needed
    if (analysis.layout.issues.includes('Insufficient white space')) {
      const spacingStrategy = await this.generateSpacingStrategy(analysis)
      strategies.push(spacingStrategy)
    }

    // Add alignment strategy if needed
    if (analysis.layout.issues.includes('Poor alignment')) {
      const alignmentStrategy = await this.generateAlignmentStrategy(analysis)
      strategies.push(alignmentStrategy)
    }

    return strategies
  }

  private async generateLayoutStrategy(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy> {
    const style = preferences?.style || 'modern'
    const gridSystem = this.selectGridSystem(style)
    const spacing = this.calculateOptimalSpacing(analysis)
    const alignment = this.determineAlignment(style)

    const enhancement: LayoutEnhancement = {
      grid: {
        columns: gridSystem.columns,
        rows: this.calculateOptimalRows(analysis),
        gutters: gridSystem.gutters,
        margins: gridSystem.margins
      },
      spacing: {
        sections: spacing.sections,
        elements: spacing.elements,
        padding: spacing.padding
      },
      alignment: alignment,
      hierarchy: {
        levels: this.calculateHierarchyLevels(analysis),
        emphasis: this.generateEmphasisMap()
      }
    }

    return {
      id: this.generateStrategyId(),
      name: 'Optimize Layout Structure',
      description: `Apply ${style} grid system with ${gridSystem.columns}-column layout`,
      priority: 'high',
      impact: this.scoreToImpact(analysis.layout.score),
      changes: {
        layout: enhancement
      }
    }
  }

  private async generateSpacingStrategy(
    analysis: DocumentAnalysis
  ): Promise<EnhancementStrategy> {
    // const targetWhitespace = this.calculateTargetWhitespace(analysis)
    
    const enhancement: LayoutEnhancement = {
      grid: {
        columns: 12,
        rows: this.calculateOptimalRows(analysis),
        gutters: 32, // Increased gutters
        margins: 100 // Increased margins
      },
      spacing: {
        sections: 80, // Generous section spacing
        elements: 24, // Comfortable element spacing
        padding: 32 // Increased padding
      },
      alignment: 'left',
      hierarchy: {
        levels: 3,
        emphasis: new Map([
          ['heading', 3],
          ['subheading', 2],
          ['body', 1]
        ])
      }
    }

    return {
      id: this.generateStrategyId(),
      name: 'Improve White Space',
      description: 'Add breathing room with increased spacing and margins',
      priority: 'high',
      impact: 80,
      changes: {
        layout: enhancement
      }
    }
  }

  private async generateAlignmentStrategy(
    analysis: DocumentAnalysis
  ): Promise<EnhancementStrategy> {
    const optimalAlignment = this.determineOptimalAlignment(analysis)
    
    const enhancement: LayoutEnhancement = {
      grid: {
        columns: 12,
        rows: this.calculateOptimalRows(analysis),
        gutters: 24,
        margins: 60
      },
      spacing: {
        sections: 60,
        elements: 20,
        padding: 24
      },
      alignment: optimalAlignment,
      hierarchy: {
        levels: this.calculateHierarchyLevels(analysis),
        emphasis: this.generateEmphasisMap()
      }
    }

    return {
      id: this.generateStrategyId(),
      name: 'Fix Alignment Issues',
      description: `Apply consistent ${optimalAlignment} alignment throughout`,
      priority: 'medium',
      impact: 70,
      changes: {
        layout: enhancement
      }
    }
  }

  private selectGridSystem(
    style: EnhancementPreferences['style']
  ): { columns: number; gutters: number; margins: number } {
    switch (style) {
      case 'minimal':
        return this.gridSystems.minimal
      case 'classic':
        return this.gridSystems.classic
      case 'professional':
        return this.gridSystems.modern
      case 'playful':
        return this.gridSystems.magazine
      default:
        return this.gridSystems.modern
    }
  }

  private calculateOptimalRows(analysis: DocumentAnalysis): number {
    // Estimate rows based on content density
    const contentSections = analysis.layout.issues.length > 3 ? 8 : 6
    return contentSections
  }

  private calculateOptimalSpacing(analysis: DocumentAnalysis): {
    sections: number
    elements: number
    padding: number
  } {
    const hasSpacingIssues = analysis.layout.issues.includes('Insufficient white space')
    
    if (hasSpacingIssues) {
      return {
        sections: 72,
        elements: 24,
        padding: 28
      }
    }

    return {
      sections: 60,
      elements: 20,
      padding: 24
    }
  }

  private determineAlignment(
    style: EnhancementPreferences['style']
  ): LayoutEnhancement['alignment'] {
    // Choose alignment based on style and content
    if (style === 'classic' || style === 'professional') {
      return 'justify'
    } else if (style === 'playful') {
      return 'center'
    }
    return 'left'
  }

  private calculateHierarchyLevels(analysis: DocumentAnalysis): number {
    // Determine optimal hierarchy levels
    const currentScore = analysis.layout.score
    if (currentScore < 50) return 4 // Need clear hierarchy
    if (currentScore < 70) return 3 // Standard hierarchy
    return 2 // Minimal hierarchy needed
  }

  private generateEmphasisMap(): Map<string, number> {
    const emphasis = new Map<string, number>()
    
    // Set emphasis levels for different content types
    emphasis.set('title', 5)
    emphasis.set('heading', 4)
    emphasis.set('subheading', 3)
    emphasis.set('callout', 3)
    emphasis.set('body', 1)
    emphasis.set('caption', 1)
    
    return emphasis
  }

  private estimateWhitespace(analysis: DocumentAnalysis): number {
    // Estimate current whitespace percentage
    if (analysis.layout.issues.includes('Insufficient white space')) {
      return 20 // Low whitespace
    }
    return 40 // Normal whitespace
  }

  private calculateTargetWhitespace(analysis: DocumentAnalysis): number {
    // Calculate ideal whitespace percentage
    const complexity = analysis.engagement.visualAppeal
    if (complexity > 80) return 50 // Complex designs need more whitespace
    if (complexity > 60) return 40
    return 30
  }

  private determineOptimalAlignment(analysis: DocumentAnalysis): LayoutEnhancement['alignment'] {
    // Analyze content to determine best alignment
    const hasLongText = analysis.typography.issues.includes('Poor readability')
    const isFormal = analysis.engagement.score > 70
    
    if (hasLongText && isFormal) return 'justify'
    if (isFormal) return 'left'
    return 'center'
  }
}