import { BaseEnhancer } from '../base-enhancer'
import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences, DecorativeElement } from '../types'
import { ImageGenerationService } from '@/lib/image-generation/image-generation-service'
import { DecorativeElementRequest } from '@/lib/image-generation/types'

export class DecorativeEnhancer extends BaseEnhancer {
  private imageGenerationService: ImageGenerationService
  
  private readonly shapes = {
    emphasis: ['circle', 'star', 'hexagon', 'badge'],
    decoration: ['dots', 'lines', 'curves', 'waves'],
    separation: ['divider', 'border', 'frame', 'rule']
  }

  private readonly icons = {
    education: ['book', 'pencil', 'graduation', 'lightbulb', 'calculator'],
    business: ['chart', 'briefcase', 'handshake', 'target', 'growth'],
    creative: ['palette', 'brush', 'camera', 'music', 'design'],
    general: ['star', 'heart', 'check', 'arrow', 'info']
  }

  constructor() {
    super('Decorative Elements', 'Adds visual interest with shapes, icons, and decorative elements', 'medium')
    this.imageGenerationService = new ImageGenerationService()
  }

  async analyze(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy[]> {
    const strategies: EnhancementStrategy[] = []
    
    // Add decorative elements if visual appeal is low
    if (analysis.engagement.visualAppeal < 60) {
      const decorativeStrategy = await this.generateDecorativeStrategy(analysis, preferences)
      strategies.push(decorativeStrategy)
    }

    // Add emphasis elements if hierarchy needs improvement
    if (analysis.layout.issues.includes('Unclear hierarchy')) {
      const emphasisStrategy = await this.generateEmphasisStrategy(analysis)
      strategies.push(emphasisStrategy)
    }

    return strategies
  }

  private async generateDecorativeStrategy(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy> {
    const style = preferences?.style || 'modern'
    const documentType = this.detectDocumentType(analysis)
    const elements = await this.generateDecorativeElements(style, documentType, analysis)

    return {
      id: this.generateStrategyId(),
      name: 'Add Decorative Elements',
      description: `Enhance visual appeal with ${style} decorative elements`,
      priority: 'medium',
      impact: this.calculateDecorativeImpact(analysis),
      changes: {
        decorativeElements: elements
      }
    }
  }

  private async generateEmphasisStrategy(
    analysis: DocumentAnalysis
  ): Promise<EnhancementStrategy> {
    const emphasisElements = this.generateEmphasisElements(analysis)

    return {
      id: this.generateStrategyId(),
      name: 'Add Emphasis Elements',
      description: 'Improve hierarchy with visual emphasis elements',
      priority: 'medium',
      impact: 60,
      changes: {
        decorativeElements: emphasisElements
      }
    }
  }

  private async generateDecorativeElements(
    style: EnhancementPreferences['style'],
    documentType: string,
    analysis: DocumentAnalysis
  ): Promise<DecorativeElement[]> {
    const elements: DecorativeElement[] = []
    
    // Add corner decorations
    if (style === 'playful' || style === 'creative') {
      elements.push(...this.generateCornerDecorations(style))
    }

    // Add section dividers
    if (analysis.layout.issues.includes('Poor section separation')) {
      elements.push(...this.generateSectionDividers(style))
    }

    // Add relevant icons with AI-generated options
    const iconSet = this.icons[documentType as keyof typeof this.icons] || this.icons.general
    const iconElements = await this.generateIconElements(iconSet, style)
    elements.push(...iconElements)

    // Add background shapes for visual interest
    if (analysis.engagement.visualAppeal < 50) {
      elements.push(...this.generateBackgroundShapes(style))
    }

    return elements
  }

  private generateEmphasisElements(analysis: DocumentAnalysis): DecorativeElement[] {
    const elements: DecorativeElement[] = []
    
    // Add highlight shapes behind important content
    elements.push({
      type: 'shape',
      position: { x: 10, y: 10 },
      size: { width: 200, height: 60 },
      style: {
        shape: 'rectangle',
        fill: this.getAccentColor(analysis),
        opacity: 0.1,
        borderRadius: 8
      },
      purpose: 'emphasis'
    })

    // Add badges for key points
    elements.push({
      type: 'shape',
      position: { x: 20, y: 100 },
      size: { width: 40, height: 40 },
      style: {
        shape: 'circle',
        fill: this.getPrimaryColor(analysis),
        border: '2px solid white'
      },
      purpose: 'emphasis'
    })

    return elements
  }

  private generateCornerDecorations(style: EnhancementPreferences['style']): DecorativeElement[] {
    const decorations: DecorativeElement[] = []
    const corners = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 }
    ]

    corners.forEach((corner, index) => {
      decorations.push({
        type: 'pattern',
        position: { x: corner.x, y: corner.y },
        size: { width: 80, height: 80 },
        style: {
          pattern: style === 'playful' ? 'dots' : 'lines',
          opacity: 0.15,
          rotation: index * 90
        },
        purpose: 'decoration'
      })
    })

    return decorations
  }

  private generateSectionDividers(style: EnhancementPreferences['style']): DecorativeElement[] {
    const dividers: DecorativeElement[] = []
    const dividerStyle = this.getDividerStyle(style)

    // Add horizontal dividers between sections
    for (let i = 0; i < 3; i++) {
      dividers.push({
        type: 'divider',
        position: { x: 10, y: 30 + (i * 100) },
        size: { width: 80, height: 2 },
        style: dividerStyle,
        purpose: 'separation'
      })
    }

    return dividers
  }

  private async generateIconElements(
    iconSet: string[],
    style: EnhancementPreferences['style']
  ): Promise<DecorativeElement[]> {
    const icons: DecorativeElement[] = []
    const selectedIcons = iconSet.slice(0, 3) // Select first 3 icons

    // Try to generate AI icons for premium users
    for (let index = 0; index < selectedIcons.length; index++) {
      const icon = selectedIcons[index]
      try {
        const request: DecorativeElementRequest = {
          prompt: `Simple ${icon} icon, ${style} style`,
          elementType: 'icon',
          style: this.mapToImageStyle(style),
          position: 'header',
          transparency: true,
          size: '256x256',
          userTier: 'pro'
        }

        const generatedImage = await this.imageGenerationService.generateDecorativeElement(request)
        
        icons.push({
          type: 'icon',
          position: { x: 20 + (index * 30), y: 20 },
          size: { width: 24, height: 24 },
          style: {
            backgroundImage: `url(${generatedImage.url})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat'
          },
          purpose: 'decoration'
        })
      } catch {
        // Fallback to simple colored icon
        icons.push({
          type: 'icon',
          position: { x: 20 + (index * 30), y: 20 },
          size: { width: 24, height: 24 },
          style: {
            icon,
            color: style === 'playful' ? '#f59e0b' : '#6b7280',
            opacity: 0.8
          },
          purpose: 'decoration'
        })
      }
    }

    return icons
  }

  private generateBackgroundShapes(style: EnhancementPreferences['style']): DecorativeElement[] {
    const shapes: DecorativeElement[] = []
    const shapeTypes = style === 'playful' ? ['circle', 'star'] : ['hexagon', 'square']

    // Add subtle background shapes
    for (let i = 0; i < 5; i++) {
      shapes.push({
        type: 'shape',
        position: { 
          x: Math.random() * 90, 
          y: Math.random() * 90 
        },
        size: { 
          width: 40 + Math.random() * 60, 
          height: 40 + Math.random() * 60 
        },
        style: {
          shape: shapeTypes[i % shapeTypes.length],
          fill: '#e5e7eb',
          opacity: 0.3,
          rotation: Math.random() * 360
        },
        purpose: 'background'
      })
    }

    return shapes
  }

  private detectDocumentType(analysis: DocumentAnalysis): string {
    // Simple detection based on analysis data
    if (analysis.engagement.score > 80) return 'education'
    if (analysis.layout.score > 80) return 'business'
    if (analysis.colors.palette.length > 4) return 'creative'
    return 'general'
  }

  private getDividerStyle(style: EnhancementPreferences['style']): Record<string, string | number> {
    switch (style) {
      case 'minimal':
        return { type: 'solid', color: '#e5e7eb', width: 1 }
      case 'playful':
        return { type: 'dotted', color: '#f59e0b', width: 2 }
      case 'professional':
        return { type: 'solid', color: '#9ca3af', width: 2 }
      default:
        return { type: 'solid', color: '#d1d5db', width: 1 }
    }
  }

  private calculateDecorativeImpact(analysis: DocumentAnalysis): number {
    const visualAppeal = analysis.engagement.visualAppeal
    if (visualAppeal < 40) return 70
    if (visualAppeal < 60) return 50
    return 30
  }

  private getAccentColor(analysis: DocumentAnalysis): string {
    const palette = analysis.colors.palette
    return palette[2] || palette[0] || '#3b82f6'
  }

  private getPrimaryColor(analysis: DocumentAnalysis): string {
    const palette = analysis.colors.palette
    return palette[0] || '#2563eb'
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
}