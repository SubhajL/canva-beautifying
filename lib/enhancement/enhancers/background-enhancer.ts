import { BaseEnhancer } from '../base-enhancer'
import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences, BackgroundEnhancement } from '../types'
import { ImageGenerationService } from '@/lib/image-generation/image-generation-service'
import { BackgroundGenerationRequest } from '@/lib/image-generation/types'

export class BackgroundEnhancer extends BaseEnhancer {
  private imageGenerationService: ImageGenerationService

  private readonly patterns = {
    subtle: [
      'dots', 'grid', 'lines', 'waves', 'circles'
    ],
    geometric: [
      'triangles', 'hexagons', 'diamonds', 'squares', 'polygons'
    ],
    organic: [
      'blobs', 'clouds', 'bubbles', 'leaves', 'curves'
    ]
  }

  private readonly gradients = {
    modern: [
      { colors: ['#667eea', '#764ba2'], direction: '135deg' },
      { colors: ['#f093fb', '#f5576c'], direction: '120deg' },
      { colors: ['#4facfe', '#00f2fe'], direction: '45deg' }
    ],
    professional: [
      { colors: ['#e0e0e0', '#f5f5f5'], direction: '180deg' },
      { colors: ['#d3d3d3', '#ffffff'], direction: '90deg' },
      { colors: ['#f8f9fa', '#e9ecef'], direction: '135deg' }
    ],
    playful: [
      { colors: ['#fa709a', '#fee140'], direction: '30deg' },
      { colors: ['#30cfd0', '#330867'], direction: '150deg' },
      { colors: ['#a8edea', '#fed6e3'], direction: '60deg' }
    ]
  }

  constructor() {
    super('Background Enhancement', 'Adds or improves background elements for visual interest', 'medium')
    this.imageGenerationService = new ImageGenerationService()
  }

  async analyze(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy[]> {
    const strategies: EnhancementStrategy[] = []
    
    // Check if background enhancement is needed
    const needsBackground = this.assessBackgroundNeed(analysis)
    
    if (needsBackground) {
      const backgroundStrategy = await this.generateBackgroundStrategy(analysis, preferences)
      strategies.push(backgroundStrategy)
    }

    // Add subtle pattern if document is too plain
    if (analysis.engagement.visualAppeal < 50) {
      const patternStrategy = await this.generatePatternStrategy(analysis, preferences)
      strategies.push(patternStrategy)
    }

    return strategies
  }

  private async generateBackgroundStrategy(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy> {
    const style = preferences?.style || 'modern'
    const backgroundType = this.selectBackgroundType(style, analysis)
    const backgroundValue = await this.generateBackgroundValue(backgroundType, style, analysis)

    const enhancement: BackgroundEnhancement = {
      type: backgroundType,
      value: backgroundValue
    }

    return {
      id: this.generateStrategyId(),
      name: 'Enhance Background',
      description: `Add ${backgroundType} background for visual depth`,
      priority: 'medium',
      impact: this.calculateBackgroundImpact(analysis),
      changes: {
        background: enhancement
      }
    }
  }

  private async generatePatternStrategy(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy> {
    const style = preferences?.style || 'modern'
    const patternType = this.selectPattern(style)
    
    const enhancement: BackgroundEnhancement = {
      type: 'pattern',
      value: {
        pattern: patternType,
        opacity: 0.05, // Very subtle
        colors: [this.getSubtlePatternColor(analysis)]
      }
    }

    return {
      id: this.generateStrategyId(),
      name: 'Add Subtle Pattern',
      description: `Add subtle ${patternType} pattern for texture`,
      priority: 'low',
      impact: 40,
      changes: {
        background: enhancement
      }
    }
  }

  private assessBackgroundNeed(analysis: DocumentAnalysis): boolean {
    // Check if document needs background enhancement
    const hasPlainBackground = analysis.engagement.visualAppeal < 60
    const lacksDepth = analysis.layout.issues.includes('Lacks visual hierarchy')
    const lowEngagement = analysis.engagement.score < 70
    
    return hasPlainBackground || lacksDepth || lowEngagement
  }

  private selectBackgroundType(
    style: EnhancementPreferences['style'],
    analysis: DocumentAnalysis
  ): BackgroundEnhancement['type'] {
    // Select appropriate background type based on style and content
    if (style === 'minimalist') return 'solid'
    if (style === 'modern' || style === 'professional') return 'gradient'
    if (style === 'playful') return 'pattern'
    
    // Default based on analysis
    if (analysis.engagement.visualAppeal < 40) return 'gradient'
    return 'solid'
  }

  private async generateBackgroundValue(
    type: BackgroundEnhancement['type'],
    style: EnhancementPreferences['style'],
    analysis: DocumentAnalysis
  ): Promise<BackgroundEnhancement['value']> {
    switch (type) {
      case 'solid':
        return this.selectSolidColor(analysis)
      
      case 'gradient':
        return this.selectGradient(style)
      
      case 'pattern':
        return this.selectPatternValue(style)
      
      case 'image':
        return await this.generateImageBackground(style, analysis)
      
      default:
        return '#f8f9fa' // Light gray fallback
    }
  }

  private selectSolidColor(analysis: DocumentAnalysis): string {
    // Select a subtle background color based on document palette
    const palette = analysis.colors.palette
    if (palette.length > 0) {
      // Use a very light version of the primary color
      const primary = palette[0]
      return this.lightenColor(primary, 90)
    }
    return '#f8f9fa' // Default light gray
  }

  private selectGradient(style: EnhancementPreferences['style']): BackgroundEnhancement['value'] {
    const gradientSet = this.gradients[style as keyof typeof this.gradients] || this.gradients.modern
    const selected = gradientSet[Math.floor(Math.random() * gradientSet.length)]
    
    return {
      colors: selected.colors,
      direction: selected.direction
    }
  }

  private selectPattern(style: EnhancementPreferences['style']): string {
    let patternSet: string[]
    
    switch (style) {
      case 'minimalist':
      case 'professional':
        patternSet = this.patterns.subtle
        break
      case 'modern':
        patternSet = this.patterns.geometric
        break
      case 'playful':
        patternSet = this.patterns.organic
        break
      default:
        patternSet = this.patterns.subtle
    }
    
    return patternSet[Math.floor(Math.random() * patternSet.length)]
  }

  private selectPatternValue(style: EnhancementPreferences['style']): BackgroundEnhancement['value'] {
    const pattern = this.selectPattern(style)
    
    return {
      pattern,
      opacity: 0.1,
      colors: ['#e0e0e0', '#f5f5f5']
    }
  }

  private async generateImageBackground(
    style: EnhancementPreferences['style'],
    analysis?: DocumentAnalysis
  ): Promise<BackgroundEnhancement['value']> {
    try {
      // Prepare generation request
      const request: BackgroundGenerationRequest = {
        prompt: `Professional ${style} background for document enhancement`,
        style: this.mapToImageStyle(style),
        documentType: 'presentation', // Default, could be inferred from analysis
        colorPalette: analysis?.colors.palette || ['#667eea', '#764ba2'],
        theme: style,
        size: '1792x1024',
        userTier: 'pro' // Would come from actual user context
      }

      const generatedImage = await this.imageGenerationService.generateBackground(request)
      
      return {
        imageUrl: generatedImage.url,
        opacity: 0.15
      }
    } catch (error) {
      console.error('Failed to generate background image:', error)
      // Fallback to gradient
      return this.selectGradient(style)
    }
  }

  private mapToImageStyle(style?: EnhancementPreferences['style']): 'realistic' | 'artistic' | 'minimalist' | 'professional' | 'playful' {
    switch (style) {
      case 'modern':
        return 'artistic'
      case 'classic':
        return 'realistic'
      case 'professional':
        return 'professional'
      case 'playful':
        return 'playful'
      case 'minimalist':
        return 'minimalist'
      default:
        return 'professional'
    }
  }

  private calculateBackgroundImpact(analysis: DocumentAnalysis): number {
    const visualAppeal = analysis.engagement.visualAppeal
    const overallScore = analysis.overallScore
    
    // Higher impact for documents with low visual appeal
    if (visualAppeal < 40) return 70
    if (visualAppeal < 60) return 50
    if (overallScore < 70) return 40
    return 30
  }

  private getSubtlePatternColor(analysis: DocumentAnalysis): string {
    // Get a subtle color for pattern based on document colors
    const palette = analysis.colors.palette
    if (palette.length > 0) {
      return this.lightenColor(palette[0], 80)
    }
    return '#e0e0e0'
  }

  private lightenColor(hex: string, percent: number): string {
    // Convert hex to RGB
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    
    // Lighten
    const lighten = (value: number) => {
      return Math.round(value + (255 - value) * (percent / 100))
    }
    
    const newR = lighten(r)
    const newG = lighten(g)
    const newB = lighten(b)
    
    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
  }
}