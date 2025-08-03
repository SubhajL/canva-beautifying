/**
 * Enhancement Orchestrator
 * Combines all enhancement algorithms for comprehensive document improvement
 */

import { 
  colorOptimization,
  typographyImprovement,
  layoutRestructuring,
  ColorPalette,
  TypographySystem,
  GridSystem,
  LayoutElement
} from './index'

export interface DocumentAnalysisData {
  colors: {
    dominant: string[]
    issues: string[]
    score: number
  }
  typography: {
    fonts: string[]
    sizes: number[]
    issues: string[]
    score: number
  }
  layout: {
    elements: LayoutElement[]
    issues: string[]
    score: number
  }
}

export interface EnhancementOptions {
  style: 'modern' | 'classic' | 'playful' | 'professional'
  aggressiveness: 'subtle' | 'moderate' | 'dramatic'
  preserveBrand?: boolean
  targetAudience?: 'children' | 'teens' | 'adults' | 'business'
  wcagLevel?: 'AA' | 'AAA'
}

export interface EnhancementResult {
  colors: {
    palette: ColorPalette
    changes: Array<{ from: string; to: string; reason: string }>
  }
  typography: {
    system: TypographySystem
    changes: Array<{ element: string; property: string; from: any; to: any }>
  }
  layout: {
    grid: GridSystem
    elements: LayoutElement[]
    changes: string[]
  }
  summary: {
    totalChanges: number
    estimatedImpact: number
    warnings: string[]
  }
}

/**
 * Enhancement Orchestrator Class
 */
export class EnhancementOrchestrator {
  /**
   * Apply all enhancement algorithms
   */
  static async enhanceDocument(
    analysis: DocumentAnalysisData,
    options: EnhancementOptions
  ): Promise<EnhancementResult> {
    // 1. Enhance Colors
    const colorResult = await this.enhanceColors(analysis.colors, options)
    
    // 2. Enhance Typography
    const typographyResult = await this.enhanceTypography(
      analysis.typography,
      options,
      colorResult.palette
    )
    
    // 3. Enhance Layout
    const layoutResult = await this.enhanceLayout(
      analysis.layout,
      options,
      typographyResult.system
    )
    
    // 4. Calculate summary
    const summary = this.calculateSummary(colorResult, typographyResult, layoutResult)
    
    return {
      colors: colorResult,
      typography: typographyResult,
      layout: layoutResult,
      summary
    }
  }

  /**
   * Enhance colors
   */
  private static async enhanceColors(
    colorData: DocumentAnalysisData['colors'],
    options: EnhancementOptions
  ): Promise<EnhancementResult['colors']> {
    // Generate base palette
    const palette = colorOptimization.generateFromAnalysis(
      colorData.dominant,
      options.style === 'playful' ? 'vibrant' : 
      options.style === 'professional' ? 'professional' :
      options.style === 'modern' ? 'vibrant' :
      options.style === 'classic' ? 'muted' : 
      'professional',
      {
        preserveBrand: options.preserveBrand ? colorData.dominant[0] : undefined,
        targetColors: 5
      }
    )
    
    // Fix contrast issues
    if (colorData.issues.includes('Poor contrast')) {
      const fixed = colorOptimization.fixContrast(
        palette.primary,
        '#FFFFFF',
        options.wcagLevel === 'AAA' ? 7 : 4.5
      )
      palette.primary = fixed.foreground
    }
    
    // Ensure accessibility
    const { palette: accessiblePalette, report } = colorOptimization.ensureAccessibility(
      palette,
      { wcagLevel: options.wcagLevel || 'AA' }
    )
    
    // Harmonize if needed
    if (options.aggressiveness !== 'subtle') {
      const harmonized = colorOptimization.harmonize(
        [palette.primary, palette.secondary, palette.accent],
        { method: 'hue-shift' }
      )
      
      palette.primary = harmonized[0]
      palette.secondary = harmonized[1]
      palette.accent = harmonized[2]
    }
    
    // Generate changes list
    const changes: Array<{ from: string; to: string; reason: string }> = []
    
    colorData.dominant.forEach((oldColor, index) => {
      let newColor = palette.primary
      if (index === 1) newColor = palette.secondary
      if (index === 2) newColor = palette.accent
      
      if (oldColor !== newColor) {
        changes.push({
          from: oldColor,
          to: newColor,
          reason: report.suggestions[index] || 'Improved color harmony'
        })
      }
    })
    
    return { palette: accessiblePalette, changes }
  }

  /**
   * Enhance typography
   */
  private static async enhanceTypography(
    typographyData: DocumentAnalysisData['typography'],
    options: EnhancementOptions,
    _colorPalette: ColorPalette
  ): Promise<EnhancementResult['typography']> {
    // Generate typography system
    const system = typographyImprovement.generateSystem({
      baseSize: this.getBaseSizeForAudience(options.targetAudience),
      style: options.style === 'professional' ? 'modern' : 
             options.style === 'modern' ? 'modern' :
             options.style === 'classic' ? 'classic' :
             options.style === 'playful' ? 'playful' : 'modern',
      primaryFont: typographyData.fonts[0],
      purpose: 'website'
    })
    
    // Suggest better font pairings if needed
    if (typographyData.score < 70 || options.aggressiveness !== 'subtle') {
      const pairings = typographyImprovement.suggestPairings(
        system.fonts.heading,
        {
          style: 'contrast',
          purpose: 'heading-body',
          count: 3
        }
      )
      
      if (pairings.length > 0 && pairings[0].score > 80) {
        system.fonts.body = pairings[0].secondary
      }
    }
    
    // Fix spacing issues
    if (typographyData.issues.includes('Poor line spacing')) {
      const improvedMetrics = typographyImprovement.fixSpacing(
        system.metrics,
        system.scale.base,
        {
          targetReadability: options.targetAudience === 'children' ? 'spacious' : 'comfortable'
        }
      )
      system.metrics = improvedMetrics
    }
    
    // Generate changes list
    const changes: Array<{ element: string; property: string; from: any; to: any }> = []
    
    // Font changes
    if (typographyData.fonts[0] !== system.fonts.heading) {
      changes.push({
        element: 'headings',
        property: 'font-family',
        from: typographyData.fonts[0],
        to: system.fonts.heading
      })
    }
    
    // Size changes
    typographyData.sizes.forEach((oldSize, index) => {
      const sizeKey = index === 0 ? 'h1' : index === 1 ? 'h2' : 'body'
      const newSize = system.scale.sizes[sizeKey as keyof typeof system.scale.sizes]
      
      if (Math.abs(oldSize - newSize) > 2) {
        changes.push({
          element: sizeKey,
          property: 'font-size',
          from: oldSize,
          to: newSize
        })
      }
    })
    
    return { system, changes }
  }

  /**
   * Enhance layout
   */
  private static async enhanceLayout(
    layoutData: DocumentAnalysisData['layout'],
    options: EnhancementOptions,
    typographySystem: TypographySystem
  ): Promise<EnhancementResult['layout']> {
    let elements = [...layoutData.elements]
    const changes: string[] = []
    
    // 1. Apply grid system
    const containerBounds = this.calculateContainerBounds(elements)
    const gridResult = layoutRestructuring.applyGrid(
      elements,
      containerBounds,
      {
        columns: options.style === 'modern' ? 12 : 16,
        gap: typographySystem.scale.base * 1.5,
        margin: typographySystem.scale.base * 3,
        alignToGrid: options.aggressiveness !== 'subtle'
      }
    )
    
    elements = gridResult.elements
    changes.push(...gridResult.changes)
    
    // 2. Correct alignment
    if (layoutData.score < 80 || options.aggressiveness === 'dramatic') {
      const alignmentResult = layoutRestructuring.correctAlignment(
        elements,
        {
          threshold: 5,
          includeOptical: true
        }
      )
      
      elements = alignmentResult.elements
      changes.push(...alignmentResult.corrections)
    }
    
    // 3. Optimize spacing
    const spacingResult = layoutRestructuring.optimizeSpacing(
      elements,
      {
        method: options.style === 'playful' ? 'rhythmic' : 'proportional',
        minSpacing: typographySystem.scale.base,
        maxSpacing: typographySystem.scale.base * 4
      }
    )
    
    elements = spacingResult.elements
    changes.push(...spacingResult.changes)
    
    // 4. Improve visual flow
    if (options.aggressiveness === 'dramatic') {
      const flowResult = layoutRestructuring.improveFlow(
        elements,
        {
          targetPattern: 'F',
          emphasizeHierarchy: true,
          optimizeReadingPath: true
        }
      )
      
      elements = flowResult.elements
      changes.push(...flowResult.improvements)
    }
    
    return {
      grid: gridResult.grid,
      elements,
      changes
    }
  }

  /**
   * Helper methods
   */
  private static getBaseSizeForAudience(audience?: string): number {
    switch (audience) {
      case 'children': return 18
      case 'teens': return 16
      case 'business': return 15
      default: return 16
    }
  }

  private static calculateContainerBounds(elements: LayoutElement[]): {
    width: number
    height: number
  } {
    if (elements.length === 0) {
      return { width: 1200, height: 800 } // Default
    }
    
    let maxX = 0, maxY = 0
    
    elements.forEach(el => {
      maxX = Math.max(maxX, el.bounds.x + el.bounds.width)
      maxY = Math.max(maxY, el.bounds.y + el.bounds.height)
    })
    
    return {
      width: Math.max(1200, maxX + 100),
      height: Math.max(800, maxY + 100)
    }
  }

  private static calculateSummary(
    colorResult: EnhancementResult['colors'],
    typographyResult: EnhancementResult['typography'],
    layoutResult: EnhancementResult['layout']
  ): EnhancementResult['summary'] {
    const totalChanges = 
      colorResult.changes.length +
      typographyResult.changes.length +
      layoutResult.changes.length
    
    // Estimate impact based on number and type of changes
    let impact = 50 // Base
    impact += colorResult.changes.length * 5
    impact += typographyResult.changes.length * 3
    impact += layoutResult.changes.length * 2
    
    const warnings: string[] = []
    
    // Add warnings for significant changes
    if (colorResult.changes.length > 5) {
      warnings.push('Significant color changes may affect brand recognition')
    }
    
    if (typographyResult.changes.some(c => c.property === 'font-family')) {
      warnings.push('Font changes require loading new web fonts')
    }
    
    if (layoutResult.changes.length > 10) {
      warnings.push('Major layout restructuring may require content review')
    }
    
    return {
      totalChanges,
      estimatedImpact: Math.min(100, impact),
      warnings
    }
  }
}

/**
 * Export convenience function
 */
export const enhanceDocument = EnhancementOrchestrator.enhanceDocument.bind(EnhancementOrchestrator)