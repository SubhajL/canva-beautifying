import { PromptTemplate, ImageStyle, BackgroundGenerationRequest, DecorativeElementRequest } from './types'

export class PromptEngineer {
  private templates: Map<string, PromptTemplate>

  constructor() {
    this.templates = this.initializeTemplates()
  }

  private initializeTemplates(): Map<string, PromptTemplate> {
    const templates = new Map<string, PromptTemplate>()

    // Background templates
    templates.set('background-modern', {
      id: 'background-modern',
      name: 'Modern Background',
      template: 'A modern abstract background with {colors} gradient, subtle {pattern}, professional design, high quality, 4k resolution',
      variables: ['colors', 'pattern'],
      style: 'modern' as ImageStyle,
      examples: [
        'A modern abstract background with blue and purple gradient, subtle geometric shapes, professional design',
        'A modern abstract background with teal and orange gradient, subtle geometric shapes, professional design'
      ]
    })

    templates.set('background-playful', {
      id: 'background-playful',
      name: 'Playful Background',
      template: 'A playful, colorful background with {theme} theme, fun patterns, child-friendly design, bright {colors} colors, whimsical elements',
      variables: ['theme', 'colors'],
      style: 'playful' as ImageStyle,
      examples: [
        'A playful, colorful background with space theme, fun patterns, child-friendly design, bright blue and yellow colors',
        'A playful, colorful background with ocean theme, fun patterns, child-friendly design, bright aqua and coral colors'
      ]
    })

    templates.set('background-professional', {
      id: 'background-professional',
      name: 'Professional Background',
      template: 'A professional, minimalist background with subtle {pattern} pattern, {colors} color scheme, corporate design, clean and elegant',
      variables: ['pattern', 'colors'],
      style: 'professional' as ImageStyle,
      examples: [
        'A professional, minimalist background with subtle grid pattern, navy and gray color scheme, corporate design',
        'A professional, minimalist background with subtle dots pattern, black and white color scheme, corporate design'
      ]
    })

    // Decorative element templates
    templates.set('element-icon', {
      id: 'element-icon',
      name: 'Icon Element',
      template: 'A simple {style} icon of {subject}, minimalist design, vector style, {colors} colors, transparent background',
      variables: ['style', 'subject', 'colors'],
      style: 'minimalist' as ImageStyle,
      examples: [
        'A simple flat icon of lightbulb, minimalist design, vector style, yellow and gray colors, transparent background',
        'A simple line icon of gear, minimalist design, vector style, blue colors, transparent background'
      ]
    })

    templates.set('element-pattern', {
      id: 'element-pattern',
      name: 'Pattern Element',
      template: 'A seamless {pattern} pattern, {style} style, {colors} color palette, tileable design, decorative element',
      variables: ['pattern', 'style', 'colors'],
      style: 'abstract' as ImageStyle,
      examples: [
        'A seamless hexagon pattern, geometric style, blue and white color palette, tileable design',
        'A seamless wave pattern, organic style, green gradient color palette, tileable design'
      ]
    })

    templates.set('element-border', {
      id: 'element-border',
      name: 'Border Element',
      template: 'A decorative {style} border frame, {thickness} lines, {colors} colors, ornamental design, transparent center',
      variables: ['style', 'thickness', 'colors'],
      style: 'artistic' as ImageStyle,
      examples: [
        'A decorative vintage border frame, thin lines, gold and black colors, ornamental design, transparent center',
        'A decorative modern border frame, thick lines, neon blue colors, ornamental design, transparent center'
      ]
    })

    return templates
  }

  generateBackgroundPrompt(request: BackgroundGenerationRequest): string {
    const templateId = this.selectBackgroundTemplate(request)
    
    if (!templateId) {
      return this.generateFallbackPrompt(request)
    }
    
    const template = this.templates.get(templateId)
    
    if (!template) {
      return this.generateFallbackPrompt(request)
    }

    let prompt = template.template
    
    // Replace variables
    const variables: Record<string, string> = {
      colors: this.formatColors(request.colorPalette),
      theme: request.theme || 'abstract',
      pattern: this.selectPattern(request.documentType)
    }

    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(`{${key}}`, value)
    }

    // Add quality modifiers
    prompt = this.addQualityModifiers(prompt, request.style)

    return prompt
  }

  generateDecorativeElementPrompt(request: DecorativeElementRequest): string {
    const templateId = `element-${request.elementType}`
    const template = this.templates.get(templateId)
    
    if (!template) {
      return this.generateElementFallbackPrompt(request)
    }

    let prompt = template.template
    
    // Element-specific variables
    const variables = this.getElementVariables(request)
    
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(`{${key}}`, value)
    }

    // Add position-specific modifiers
    if (request.position) {
      prompt += `, positioned for ${request.position} placement`
    }

    if (request.transparency) {
      prompt += ', transparent background, PNG format'
    }

    return prompt
  }

  enhancePromptForModel(prompt: string, model: 'stable-diffusion-xl' | 'dall-e-3'): string {
    if (model === 'stable-diffusion-xl') {
      // Add SDXL-specific enhancements
      return `${prompt}, masterpiece, best quality, highly detailed, sharp focus, professional`
    } else {
      // DALL-E 3 understands natural language better
      return `Create ${prompt}. Ensure high quality and professional appearance.`
    }
  }

  generateNegativePrompt(style?: ImageStyle): string {
    const baseNegative = 'blurry, low quality, pixelated, watermark, text, logo'
    
    const styleNegatives: Record<ImageStyle, string> = {
      realistic: 'cartoon, anime, illustration, painting',
      artistic: 'photorealistic, photography',
      cartoon: 'realistic, photographic, serious',
      watercolor: 'digital, computer-generated, sharp edges',
      minimalist: 'complex, busy, cluttered, detailed',
      abstract: 'realistic, representational, literal',
      professional: 'casual, playful, unprofessional',
      playful: 'serious, corporate, formal'
    }

    const additional = style ? styleNegatives[style] || '' : ''
    return additional ? `${baseNegative}, ${additional}` : baseNegative
  }

  private selectBackgroundTemplate(request: BackgroundGenerationRequest): string | null {
    const style = request.style || 'modern'
    
    const templateMap: Record<string, string> = {
      modern: 'background-modern',
      playful: 'background-playful',
      professional: 'background-professional',
      minimalist: 'background-professional',
      classic: 'background-professional'
    }

    // Return null for unknown styles to trigger fallback
    return templateMap[style] || null
  }

  private formatColors(colors: string[]): string {
    if (colors.length === 0) return 'blue and purple'
    if (colors.length === 1) return colors[0]
    if (colors.length === 2) return `${colors[0]} and ${colors[1]}`
    return `${colors.slice(0, -1).join(', ')}, and ${colors[colors.length - 1]}`
  }

  private selectPattern(documentType: string): string {
    const patterns: Record<string, string> = {
      worksheet: 'grid',
      presentation: 'geometric shapes',
      poster: 'abstract waves',
      flyer: 'dynamic lines'
    }
    return patterns[documentType] || 'geometric'
  }

  private addQualityModifiers(prompt: string, style?: ImageStyle): string {
    const qualityTerms = [
      'high resolution',
      '4k quality',
      'professional design',
      'clean composition'
    ]

    // Add style-specific quality terms
    if (style === 'professional') {
      qualityTerms.push('corporate quality', 'premium design')
    } else if (style === 'playful') {
      qualityTerms.push('vibrant', 'engaging')
    }

    return `${prompt}, ${qualityTerms.join(', ')}`
  }

  private generateFallbackPrompt(request: BackgroundGenerationRequest): string {
    return `A ${request.style || 'modern'} background for a ${request.documentType}, ` +
           `using ${this.formatColors(request.colorPalette)} colors, ` +
           `professional quality, suitable for ${request.theme || 'general'} theme`
  }

  private generateElementFallbackPrompt(request: DecorativeElementRequest): string {
    return `A ${request.style || 'modern'} ${request.elementType} decorative element, ` +
           `professional design, high quality, ${request.transparency ? 'transparent background' : ''}`
  }

  private getElementVariables(request: DecorativeElementRequest): Record<string, string> {
    const baseVars: Record<string, string> = {
      style: request.style || 'modern',
      colors: 'complementary'
    }

    switch (request.elementType) {
      case 'icon':
        return {
          ...baseVars,
          subject: 'abstract shape'
        }
      case 'pattern':
        return {
          ...baseVars,
          pattern: 'geometric'
        }
      case 'border':
        return {
          ...baseVars,
          thickness: 'medium'
        }
      default:
        return baseVars
    }
  }

  suggestPromptImprovements(prompt: string): string[] {
    const suggestions: string[] = []
    
    // Check prompt length
    if (prompt.length < 20) {
      suggestions.push('Add more descriptive details to get better results')
    }
    
    // Check for style keywords
    const hasStyle = /style|design|aesthetic|look/.test(prompt.toLowerCase())
    if (!hasStyle) {
      suggestions.push('Consider adding style descriptors (modern, vintage, minimalist, etc.)')
    }
    
    // Check for quality keywords
    const hasQuality = /quality|resolution|detailed|professional/.test(prompt.toLowerCase())
    if (!hasQuality) {
      suggestions.push('Add quality modifiers like "high quality" or "professional"')
    }
    
    // Check for color mentions
    const hasColor = /color|colour|palette|scheme/.test(prompt.toLowerCase())
    if (!hasColor) {
      suggestions.push('Specify color preferences for better results')
    }

    return suggestions
  }
}