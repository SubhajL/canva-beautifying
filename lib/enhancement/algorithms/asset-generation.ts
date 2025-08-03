/**
 * Enhanced Asset Generation Algorithms
 * Creates context-aware backgrounds, educational graphics, and age-appropriate decorations
 */

import chroma from 'chroma-js'
import { 
  DocumentType,
  ColorPalette,
  BackgroundRequirement,
  DecorativeRequirement,
  GraphicRequirement,
  InitialAnalysisResult
} from '../pipeline/types'

// Educational graphic templates
const EDUCATIONAL_TEMPLATES = {
  'math': {
    shapes: ['circle', 'square', 'triangle', 'hexagon', 'pentagon'],
    symbols: ['+', '-', '×', '÷', '=', '>', '<', '≥', '≤', 'π', '∞'],
    patterns: ['grid', 'dots', 'lines', 'geometric'],
    colors: ['#4A90E2', '#7B68EE', '#50C878', '#FFB347', '#FF6B6B']
  },
  'science': {
    shapes: ['atom', 'molecule', 'flask', 'microscope', 'dna'],
    symbols: ['H₂O', 'CO₂', 'E=mc²', 'DNA', 'RNA'],
    patterns: ['waves', 'particles', 'cellular', 'molecular'],
    colors: ['#00CED1', '#32CD32', '#FF6347', '#4169E1', '#9370DB']
  },
  'language': {
    shapes: ['book', 'pen', 'speech-bubble', 'letter', 'scroll'],
    symbols: ['A', 'B', 'C', 'abc', '123', '!', '?', '"'],
    patterns: ['lines', 'notebook', 'text', 'cursive'],
    colors: ['#FF7F50', '#DDA0DD', '#20B2AA', '#F0E68C', '#87CEEB']
  },
  'history': {
    shapes: ['scroll', 'map', 'globe', 'timeline', 'monument'],
    symbols: ['📅', '🗺️', '🏛️', '📜', '⏰'],
    patterns: ['vintage', 'parchment', 'aged', 'classic'],
    colors: ['#8B7355', '#D2691E', '#B8860B', '#CD853F', '#A0522D']
  },
  'art': {
    shapes: ['palette', 'brush', 'canvas', 'easel', 'frame'],
    symbols: ['🎨', '✏️', '🖌️', '🎭', '🖼️'],
    patterns: ['splatter', 'watercolor', 'abstract', 'mosaic'],
    colors: ['#FF1493', '#FF4500', '#FFD700', '#00FA9A', '#1E90FF']
  }
}

// Age-appropriate visual styles
const AGE_STYLES = {
  'preschool': {
    complexity: 'simple',
    colors: 'bright',
    shapes: 'basic',
    animations: 'bouncy',
    fontSize: 'large',
    iconStyle: 'cartoon',
    patterns: ['dots', 'stars', 'hearts', 'smiley']
  },
  'elementary': {
    complexity: 'moderate',
    colors: 'vibrant',
    shapes: 'varied',
    animations: 'smooth',
    fontSize: 'medium',
    iconStyle: 'friendly',
    patterns: ['geometric', 'nature', 'space', 'animals']
  },
  'middle-school': {
    complexity: 'detailed',
    colors: 'balanced',
    shapes: 'complex',
    animations: 'subtle',
    fontSize: 'standard',
    iconStyle: 'modern',
    patterns: ['tech', 'abstract', 'gradient', 'minimal']
  },
  'high-school': {
    complexity: 'sophisticated',
    colors: 'mature',
    shapes: 'refined',
    animations: 'minimal',
    fontSize: 'professional',
    iconStyle: 'clean',
    patterns: ['professional', 'minimal', 'tech', 'gradient']
  },
  'adult': {
    complexity: 'professional',
    colors: 'professional',
    shapes: 'minimal',
    animations: 'none',
    fontSize: 'standard',
    iconStyle: 'professional',
    patterns: ['subtle', 'corporate', 'elegant', 'minimal']
  }
}

// Document type visual themes
const DOCUMENT_THEMES = {
  'educational': {
    backgrounds: ['notebook', 'chalkboard', 'whiteboard', 'graph-paper'],
    decorations: ['pencil', 'ruler', 'book', 'graduation-cap'],
    accents: ['stars', 'checkmarks', 'lightbulb', 'apple']
  },
  'presentation': {
    backgrounds: ['gradient', 'geometric', 'professional', 'tech'],
    decorations: ['arrow', 'bullet', 'highlight', 'frame'],
    accents: ['dot', 'line', 'shape', 'icon']
  },
  'marketing': {
    backgrounds: ['vibrant', 'dynamic', 'trendy', 'bold'],
    decorations: ['badge', 'banner', 'burst', 'ribbon'],
    accents: ['star', 'sale', 'new', 'hot']
  },
  'business': {
    backgrounds: ['corporate', 'minimal', 'elegant', 'professional'],
    decorations: ['chart', 'graph', 'arrow', 'briefcase'],
    accents: ['check', 'bullet', 'divider', 'icon']
  },
  'creative': {
    backgrounds: ['artistic', 'colorful', 'abstract', 'texture'],
    decorations: ['brush', 'palette', 'splash', 'swirl'],
    accents: ['paint', 'crayon', 'marker', 'spray']
  },
  'technical': {
    backgrounds: ['grid', 'blueprint', 'circuit', 'minimal'],
    decorations: ['gear', 'code', 'terminal', 'database'],
    accents: ['bracket', 'slash', 'dot', 'arrow']
  },
  'general': {
    backgrounds: ['simple', 'gradient', 'pattern', 'solid'],
    decorations: ['circle', 'square', 'star', 'diamond'],
    accents: ['dot', 'line', 'shape', 'icon']
  }
}

/**
 * Asset Generation Algorithms Class
 */
export class AssetGenerationAlgorithms {
  /**
   * Generate context-aware background
   */
  static generateContextAwareBackground(
    requirement: BackgroundRequirement,
    documentType: DocumentType,
    analysis: InitialAnalysisResult,
    colorPalette: ColorPalette
  ): {
    svg: string
    metadata: {
      theme: string
      complexity: number
      ageAppropriate: boolean
      educationalValue: number
    }
  } {
    const theme = DOCUMENT_THEMES[documentType as keyof typeof DOCUMENT_THEMES]
    const ageGroup = AssetGenerationAlgorithms.detectAgeGroup(analysis)
    const subject = AssetGenerationAlgorithms.detectSubject(analysis)
    
    // Select appropriate background style
    const backgroundStyle = AssetGenerationAlgorithms.selectBackgroundStyle(
      requirement,
      theme,
      ageGroup,
      subject
    )
    
    // Generate the background
    let svg: string
    let metadata: any
    
    switch (backgroundStyle.type) {
      case 'educational':
        const result = AssetGenerationAlgorithms.createEducationalBackground(
          backgroundStyle,
          colorPalette,
          ageGroup,
          subject
        )
        svg = result.svg
        metadata = result.metadata
        break
        
      case 'professional':
        const profResult = AssetGenerationAlgorithms.createProfessionalBackground(
          backgroundStyle,
          colorPalette
        )
        svg = profResult.svg
        metadata = profResult.metadata
        break
        
      case 'creative':
        const creativeResult = AssetGenerationAlgorithms.createCreativeBackground(
          backgroundStyle,
          colorPalette,
          ageGroup
        )
        svg = creativeResult.svg
        metadata = creativeResult.metadata
        break
        
      default:
        const defaultResult = AssetGenerationAlgorithms.createAdaptiveGradientBackground(
          colorPalette,
          documentType
        )
        svg = defaultResult.svg
        metadata = defaultResult.metadata
    }
    
    return { svg, metadata }
  }

  /**
   * Generate educational graphics
   */
  static generateEducationalGraphic(
    requirement: GraphicRequirement,
    subject: string,
    ageGroup: string,
    colorPalette: ColorPalette
  ): {
    svg: string
    metadata: {
      type: string
      subject: string
      complexity: number
      educationalValue: number
      interactiveElements?: string[]
    }
  } {
    const template = EDUCATIONAL_TEMPLATES[subject as keyof typeof EDUCATIONAL_TEMPLATES] || EDUCATIONAL_TEMPLATES['language']
    const ageStyle = AGE_STYLES[ageGroup as keyof typeof AGE_STYLES] || AGE_STYLES['elementary']
    
    let svg: string
    let metadata: any
    
    switch (requirement.type) {
      case 'chart':
        const chartResult = AssetGenerationAlgorithms.createEducationalChart(
          requirement,
          template,
          ageStyle,
          colorPalette
        )
        svg = chartResult.svg
        metadata = chartResult.metadata
        break
        
      case 'diagram':
        const diagramResult = AssetGenerationAlgorithms.createEducationalDiagram(
          requirement,
          template,
          ageStyle,
          colorPalette
        )
        svg = diagramResult.svg
        metadata = diagramResult.metadata
        break
        
      case 'infographic':
        const infoResult = AssetGenerationAlgorithms.createEducationalInfographic(
          requirement,
          template,
          ageStyle,
          colorPalette
        )
        svg = infoResult.svg
        metadata = infoResult.metadata
        break
        
      case 'illustration':
      default:
        const illusResult = AssetGenerationAlgorithms.createSubjectIllustration(
          requirement,
          template,
          ageStyle,
          colorPalette
        )
        svg = illusResult.svg
        metadata = illusResult.metadata
    }
    
    return { svg, metadata }
  }

  /**
   * Generate subject-appropriate decorations
   */
  static generateSubjectDecoration(
    requirement: DecorativeRequirement,
    subject: string,
    documentType: DocumentType,
    colorPalette: ColorPalette
  ): {
    svg: string
    metadata: {
      subject: string
      decorationType: string
      educationalRelevance: number
    }
  } {
    const template = EDUCATIONAL_TEMPLATES[subject as keyof typeof EDUCATIONAL_TEMPLATES]
    const theme = DOCUMENT_THEMES[documentType as keyof typeof DOCUMENT_THEMES]
    
    let svg: string
    let metadata: any
    
    switch (requirement.type) {
      case 'icon':
        svg = AssetGenerationAlgorithms.createSubjectIcon(
          template?.symbols || ['📚'],
          colorPalette,
          50 // Default size
        )
        metadata = {
          subject,
          decorationType: 'icon',
          educationalRelevance: 0.8
        }
        break
        
      case 'border':
        svg = AssetGenerationAlgorithms.createThemedBorder(
          template?.patterns || ['dots'],
          colorPalette,
          requirement.style
        )
        metadata = {
          subject,
          decorationType: 'border',
          educationalRelevance: 0.5
        }
        break
        
      case 'shape':
        svg = AssetGenerationAlgorithms.createSubjectShape(
          template?.shapes || ['circle'],
          colorPalette,
          100 // Default size
        )
        metadata = {
          subject,
          decorationType: 'shape',
          educationalRelevance: 0.6
        }
        break
        
      case 'divider':
      default:
        svg = AssetGenerationAlgorithms.createThemedDivider(
          theme.accents,
          colorPalette
        )
        metadata = {
          subject,
          decorationType: 'divider',
          educationalRelevance: 0.3
        }
    }
    
    return { svg, metadata }
  }

  /**
   * Generate age-appropriate visual elements
   */
  static generateAgeAppropriateElement(
    type: 'background' | 'decoration' | 'graphic',
    ageGroup: string,
    colorPalette: ColorPalette,
    options?: {
      subject?: string
      complexity?: number
      educational?: boolean
    }
  ): {
    svg: string
    metadata: {
      ageGroup: string
      appropriateness: number
      visualComplexity: number
      engagement: number
    }
  } {
    const ageStyle = AGE_STYLES[ageGroup as keyof typeof AGE_STYLES] || AGE_STYLES['elementary']
    
    // Adjust colors for age group
    const adjustedPalette = AssetGenerationAlgorithms.adjustColorsForAge(colorPalette, ageGroup)
    
    let svg: string
    let visualComplexity: number
    
    switch (type) {
      case 'background':
        const bgResult = AssetGenerationAlgorithms.createAgeAppropriateBackground(
          ageStyle,
          adjustedPalette,
          options?.educational || false
        )
        svg = bgResult.svg
        visualComplexity = bgResult.complexity
        break
        
      case 'decoration':
        const decorResult = AssetGenerationAlgorithms.createAgeAppropriateDecoration(
          ageStyle,
          adjustedPalette,
          options?.subject
        )
        svg = decorResult.svg
        visualComplexity = decorResult.complexity
        break
        
      case 'graphic':
        const graphicResult = AssetGenerationAlgorithms.createAgeAppropriateGraphic(
          ageStyle,
          adjustedPalette,
          options?.complexity || 0.5
        )
        svg = graphicResult.svg
        visualComplexity = graphicResult.complexity
        break
        
      default:
        svg = AssetGenerationAlgorithms.createSimpleShape(adjustedPalette.primary)
        visualComplexity = 0.2
    }
    
    // Calculate engagement score based on age group
    const engagement = AssetGenerationAlgorithms.calculateAgeEngagement(ageGroup, visualComplexity)
    
    return {
      svg,
      metadata: {
        ageGroup,
        appropriateness: AssetGenerationAlgorithms.calculateAppropriateness(ageGroup, visualComplexity),
        visualComplexity,
        engagement
      }
    }
  }

  // Helper methods

  private static detectAgeGroup(analysis: InitialAnalysisResult): string {
    // Simple heuristic based on available data
    // In a real implementation, this would analyze text complexity
    const hasComplexLayout = analysis.layoutAnalysis.structure === 'multi-column' || 
                            analysis.layoutAnalysis.structure === 'grid'
    const textLength = analysis.extractedText.bodyText.join(' ').length
    
    if (textLength < 100 && !hasComplexLayout) return 'preschool'
    if (textLength < 500 && !hasComplexLayout) return 'elementary'
    if (textLength < 1000) return 'middle-school'
    if (textLength < 2000) return 'high-school'
    return 'adult'
  }

  private static detectSubject(analysis: InitialAnalysisResult): string {
    // Simple heuristic based on extracted text
    const allText = [
      analysis.extractedText.title || '',
      ...analysis.extractedText.headings,
      ...analysis.extractedText.bodyText
    ].join(' ').toLowerCase()
    
    const subjects = Object.keys(EDUCATIONAL_TEMPLATES)
    
    // Simple keyword matching
    for (const subject of subjects) {
      const keywords = EDUCATIONAL_TEMPLATES[subject as keyof typeof EDUCATIONAL_TEMPLATES].symbols
      if (keywords.some(keyword => allText.includes(keyword.toLowerCase()))) {
        return subject
      }
    }
    
    return 'language' // Default
  }

  private static selectBackgroundStyle(
    requirement: BackgroundRequirement,
    theme: any,
    ageGroup: string,
    subject: string
  ): any {
    // Combine requirements with detected context
    return {
      type: requirement.theme === 'educational' ? 'educational' : 
            requirement.theme === 'business' ? 'professional' :
            'creative',
      pattern: theme.backgrounds[0],
      complexity: AGE_STYLES[ageGroup as keyof typeof AGE_STYLES]?.complexity || 'moderate',
      subject
    }
  }

  private static createEducationalBackground(
    style: any,
    colorPalette: ColorPalette,
    ageGroup: string,
    subject: string
  ): { svg: string; metadata: any } {
    const width = 1792
    const height = 1024
    const pattern = EDUCATIONAL_TEMPLATES[subject as keyof typeof EDUCATIONAL_TEMPLATES]?.patterns[0] || 'grid'
    
    let patternSvg = ''
    
    switch (pattern) {
      case 'grid':
        patternSvg = `
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${colorPalette.primary}" stroke-width="0.5" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#grid)"/>
        `
        break
        
      case 'notebook':
        patternSvg = `
          <defs>
            <pattern id="notebook" width="100%" height="30" patternUnits="userSpaceOnUse">
              <line x1="0" y1="29" x2="${width}" y2="29" stroke="${colorPalette.primary}" stroke-width="1" opacity="0.2"/>
              <line x1="80" y1="0" x2="80" y2="${height}" stroke="${colorPalette.accent}" stroke-width="2" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="${width}" height="${height}" fill="${colorPalette.background}"/>
          <rect width="${width}" height="${height}" fill="url(#notebook)"/>
        `
        break
        
      case 'dots':
        const dotSize = ageGroup === 'preschool' ? 5 : 3
        const dotSpacing = ageGroup === 'preschool' ? 50 : 30
        patternSvg = `
          <defs>
            <pattern id="dots" x="0" y="0" width="${dotSpacing}" height="${dotSpacing}" patternUnits="userSpaceOnUse">
              <circle cx="${dotSpacing/2}" cy="${dotSpacing/2}" r="${dotSize}" 
                      fill="${colorPalette.accent}" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="${width}" height="${height}" fill="${colorPalette.background}"/>
          <rect width="${width}" height="${height}" fill="url(#dots)"/>
        `
        break
        
      default:
        // Fallback gradient
        patternSvg = `
          <defs>
            <linearGradient id="eduGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${colorPalette.background};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${chroma(colorPalette.primary).alpha(0.05).css()};stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#eduGrad)"/>
        `
    }
    
    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${patternSvg}
    </svg>`
    
    return {
      svg,
      metadata: {
        theme: 'educational',
        complexity: ageGroup === 'preschool' ? 0.2 : 0.5,
        ageAppropriate: true,
        educationalValue: 0.8
      }
    }
  }

  private static createProfessionalBackground(
    style: any,
    colorPalette: ColorPalette
  ): { svg: string; metadata: any } {
    const width = 1792
    const height = 1024
    
    // Subtle gradient with geometric accent
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="profGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colorPalette.background};stop-opacity:1" />
            <stop offset="50%" style="stop-color:${chroma(colorPalette.background).brighten(0.1).css()};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${colorPalette.background};stop-opacity:1" />
          </linearGradient>
          <pattern id="subtle" width="200" height="200" patternUnits="userSpaceOnUse">
            <circle cx="100" cy="100" r="1" fill="${colorPalette.primary}" opacity="0.05"/>
          </pattern>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#profGrad)"/>
        <rect width="${width}" height="${height}" fill="url(#subtle)"/>
        <path d="M 0 ${height} L ${width/3} ${height-100} L ${width} ${height}" 
              fill="${chroma(colorPalette.primary).alpha(0.03).css()}"/>
      </svg>
    `
    
    return {
      svg,
      metadata: {
        theme: 'professional',
        complexity: 0.3,
        ageAppropriate: true,
        educationalValue: 0.2
      }
    }
  }

  private static createCreativeBackground(
    style: any,
    colorPalette: ColorPalette,
    ageGroup: string
  ): { svg: string; metadata: any } {
    const width = 1792
    const height = 1024
    const isYoung = ['preschool', 'elementary'].includes(ageGroup)
    
    // Create organic shapes with vibrant colors
    const shapes = []
    const shapeCount = isYoung ? 5 : 8
    
    for (let i = 0; i < shapeCount; i++) {
      const x = Math.random() * width
      const y = Math.random() * height
      const radius = isYoung ? 100 + Math.random() * 200 : 50 + Math.random() * 150
      const color = chroma(colorPalette.accent)
        .set('hsl.h', '+' + (i * 45))
        .alpha(0.1)
        .css()
      
      shapes.push(`
        <circle cx="${x}" cy="${y}" r="${radius}" 
                fill="${color}" 
                filter="url(#blur)"/>
      `)
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="blur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="${isYoung ? 20 : 10}"/>
          </filter>
        </defs>
        <rect width="${width}" height="${height}" fill="${colorPalette.background}"/>
        ${shapes.join('')}
      </svg>
    `
    
    return {
      svg,
      metadata: {
        theme: 'creative',
        complexity: isYoung ? 0.4 : 0.6,
        ageAppropriate: true,
        educationalValue: 0.5
      }
    }
  }

  private static createAdaptiveGradientBackground(
    colorPalette: ColorPalette,
    documentType: DocumentType
  ): { svg: string; metadata: any } {
    const width = 1792
    const height = 1024
    
    // Create gradient based on document type
    const _gradientAngle = documentType === 'presentation' ? '0deg' : '45deg'
    const gradientSteps = documentType === 'creative' ? 5 : 2
    
    const stops = []
    for (let i = 0; i < gradientSteps; i++) {
      const position = (i / (gradientSteps - 1)) * 100
      const color = i % 2 === 0 ? colorPalette.background : 
                    chroma(colorPalette.primary).alpha(0.05).css()
      stops.push(`<stop offset="${position}%" style="stop-color:${color};stop-opacity:1" />`)
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="adaptiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            ${stops.join('')}
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#adaptiveGrad)"/>
      </svg>
    `
    
    return {
      svg,
      metadata: {
        theme: 'adaptive',
        complexity: 0.3,
        ageAppropriate: true,
        educationalValue: 0.3
      }
    }
  }

  private static createEducationalChart(
    requirement: GraphicRequirement,
    template: any,
    ageStyle: any,
    colorPalette: ColorPalette
  ): { svg: string; metadata: any } {
    const width = requirement.dimensions.width
    const height = requirement.dimensions.height
    const defaultData = [30, 60, 45, 80, 55]
    const data = Array.isArray(requirement.data) ? requirement.data as number[] : defaultData
    const colors = template.colors
    
    // Create bar chart
    const barWidth = width / (data.length * 1.5)
    const maxValue = Math.max(...data)
    
    const bars = data.map((value, index) => {
      const barHeight = (value / maxValue) * (height * 0.7)
      const x = (index * barWidth * 1.5) + barWidth * 0.25
      const y = height - barHeight - 30
      const color = colors[index % colors.length]
      
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"
              fill="${color}" rx="${ageStyle.complexity === 'simple' ? 5 : 0}"/>
        <text x="${x + barWidth/2}" y="${height - 10}" 
              text-anchor="middle" font-size="${ageStyle.fontSize === 'large' ? 16 : 12}"
              fill="${colorPalette.text}">${value}</text>
      `
    }).join('')
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="${colorPalette.background}" rx="10"/>
        ${bars}
        <line x1="30" y1="${height - 30}" x2="${width - 30}" y2="${height - 30}" 
              stroke="${colorPalette.text}" stroke-width="2" opacity="0.3"/>
      </svg>
    `
    
    return {
      svg,
      metadata: {
        type: 'chart',
        subject: 'data',
        complexity: 0.6,
        educationalValue: 0.9,
        interactiveElements: ['bars', 'values']
      }
    }
  }

  private static createEducationalDiagram(
    requirement: GraphicRequirement,
    template: any,
    ageStyle: any,
    colorPalette: ColorPalette
  ): { svg: string; metadata: any } {
    const width = requirement.dimensions.width
    const height = requirement.dimensions.height
    
    // Create a simple cycle diagram
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.3
    const steps = 4
    
    const elements = []
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 - Math.PI / 2
      const x = centerX + Math.cos(angle) * radius
      const y = centerY + Math.sin(angle) * radius
      const nextAngle = ((i + 1) / steps) * Math.PI * 2 - Math.PI / 2
      const nextX = centerX + Math.cos(nextAngle) * radius
      const nextY = centerY + Math.sin(nextAngle) * radius
      
      // Circle
      elements.push(`
        <circle cx="${x}" cy="${y}" r="40" 
                fill="${template.colors[i % template.colors.length]}"
                opacity="0.8"/>
        <text x="${x}" y="${y}" text-anchor="middle" dy="5"
              font-size="${ageStyle.fontSize === 'large' ? 18 : 14}"
              fill="white" font-weight="bold">${i + 1}</text>
      `)
      
      // Arrow to next
      const _midX = (x + nextX) / 2
      const _midY = (y + nextY) / 2
      const arrowAngle = Math.atan2(nextY - y, nextX - x)
      
      elements.push(`
        <path d="M ${x + 40 * Math.cos(arrowAngle)} ${y + 40 * Math.sin(arrowAngle)} 
                 L ${nextX - 40 * Math.cos(arrowAngle)} ${nextY - 40 * Math.sin(arrowAngle)}"
              stroke="${colorPalette.text}" stroke-width="2" 
              marker-end="url(#arrowhead)" opacity="0.5"/>
      `)
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" 
                  refX="9" refY="3" orient="auto">
            <polygon points="0 0, 10 3, 0 6" fill="${colorPalette.text}" opacity="0.5"/>
          </marker>
        </defs>
        <rect width="${width}" height="${height}" fill="${colorPalette.background}" rx="10"/>
        ${elements.join('')}
        <text x="${centerX}" y="${centerY}" text-anchor="middle" 
              font-size="${ageStyle.fontSize === 'large' ? 20 : 16}"
              fill="${colorPalette.text}" opacity="0.7">Cycle</text>
      </svg>
    `
    
    return {
      svg,
      metadata: {
        type: 'diagram',
        subject: 'process',
        complexity: 0.7,
        educationalValue: 0.85,
        interactiveElements: ['nodes', 'arrows']
      }
    }
  }

  private static createEducationalInfographic(
    requirement: GraphicRequirement,
    template: any,
    ageStyle: any,
    colorPalette: ColorPalette
  ): { svg: string; metadata: any } {
    const width = requirement.dimensions.width
    const height = requirement.dimensions.height
    
    // Create icon-based infographic
    const sections = 3
    const sectionHeight = height / sections
    
    const elements = []
    for (let i = 0; i < sections; i++) {
      const y = i * sectionHeight
      const icon = template.symbols[i % template.symbols.length]
      const color = template.colors[i % template.colors.length]
      
      elements.push(`
        <rect x="0" y="${y}" width="${width}" height="${sectionHeight}"
              fill="${chroma(color).alpha(0.1).css()}"/>
        <text x="50" y="${y + sectionHeight/2}" font-size="40" dy="10">${icon}</text>
        <rect x="100" y="${y + sectionHeight/2 - 15}" width="${width - 150}" height="30"
              fill="${color}" opacity="0.3" rx="15"/>
        <text x="120" y="${y + sectionHeight/2}" dy="5"
              font-size="${ageStyle.fontSize === 'large' ? 18 : 14}"
              fill="${colorPalette.text}">Information ${i + 1}</text>
      `)
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="${colorPalette.background}" rx="10"/>
        ${elements.join('')}
      </svg>
    `
    
    return {
      svg,
      metadata: {
        type: 'infographic',
        subject: 'mixed',
        complexity: 0.5,
        educationalValue: 0.8,
        interactiveElements: ['sections', 'icons']
      }
    }
  }

  private static createSubjectIllustration(
    requirement: GraphicRequirement,
    template: any,
    ageStyle: any,
    colorPalette: ColorPalette
  ): { svg: string; metadata: any } {
    const width = requirement.dimensions.width
    const height = requirement.dimensions.height
    
    // Create subject-specific illustration
    const shape = template.shapes[0]
    const centerX = width / 2
    const centerY = height / 2
    
    let illustration = ''
    
    switch (shape) {
      case 'atom':
        // Create simple atom illustration
        illustration = `
          <circle cx="${centerX}" cy="${centerY}" r="20" fill="${template.colors[0]}"/>
          <ellipse cx="${centerX}" cy="${centerY}" rx="80" ry="30" 
                   fill="none" stroke="${template.colors[1]}" stroke-width="2"/>
          <ellipse cx="${centerX}" cy="${centerY}" rx="80" ry="30" 
                   fill="none" stroke="${template.colors[2]}" stroke-width="2"
                   transform="rotate(60 ${centerX} ${centerY})"/>
          <ellipse cx="${centerX}" cy="${centerY}" rx="80" ry="30" 
                   fill="none" stroke="${template.colors[3]}" stroke-width="2"
                   transform="rotate(-60 ${centerX} ${centerY})"/>
          <circle cx="${centerX - 80}" cy="${centerY}" r="8" fill="${template.colors[1]}"/>
          <circle cx="${centerX + 40}" cy="${centerY - 69}" r="8" fill="${template.colors[2]}"/>
          <circle cx="${centerX + 40}" cy="${centerY + 69}" r="8" fill="${template.colors[3]}"/>
        `
        break
        
      case 'book':
        // Create simple book illustration
        illustration = `
          <rect x="${centerX - 60}" y="${centerY - 80}" width="120" height="160"
                fill="${template.colors[0]}" rx="5"/>
          <rect x="${centerX - 50}" y="${centerY - 70}" width="100" height="140"
                fill="${colorPalette.background}" rx="3"/>
          <line x1="${centerX}" y1="${centerY - 70}" x2="${centerX}" y2="${centerY + 70}"
                stroke="${template.colors[1]}" stroke-width="2"/>
          <rect x="${centerX - 45}" y="${centerY - 60}" width="40" height="5"
                fill="${template.colors[2]}"/>
          <rect x="${centerX + 5}" y="${centerY - 60}" width="40" height="5"
                fill="${template.colors[2]}"/>
        `
        break
        
      default:
        // Default geometric shape
        illustration = `
          <circle cx="${centerX}" cy="${centerY}" r="80" 
                  fill="${template.colors[0]}" opacity="0.8"/>
          <polygon points="${centerX},${centerY - 60} ${centerX - 52},${centerY + 30} ${centerX + 52},${centerY + 30}"
                   fill="${template.colors[1]}" opacity="0.6"/>
        `
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="${colorPalette.background}" rx="10"/>
        ${illustration}
      </svg>
    `
    
    return {
      svg,
      metadata: {
        type: 'illustration',
        subject: shape,
        complexity: 0.6,
        educationalValue: 0.7
      }
    }
  }

  private static createSubjectIcon(
    symbols: string[],
    colorPalette: ColorPalette,
    size: number
  ): string {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)]
    
    return `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" 
                fill="${colorPalette.accent}" opacity="0.2"/>
        <text x="${size/2}" y="${size/2}" text-anchor="middle" dy="${size/3}"
              font-size="${size * 0.6}" fill="${colorPalette.accent}">${symbol}</text>
      </svg>
    `
  }

  private static createSubjectShape(
    shapes: string[],
    colorPalette: ColorPalette,
    size: number
  ): string {
    const shape = shapes[Math.floor(Math.random() * shapes.length)]
    const centerX = size / 2
    const centerY = size / 2
    
    let shapeElement = ''
    
    switch (shape) {
      case 'hexagon':
        const points = []
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2
          const x = centerX + Math.cos(angle) * (size / 2 - 5)
          const y = centerY + Math.sin(angle) * (size / 2 - 5)
          points.push(`${x},${y}`)
        }
        shapeElement = `<polygon points="${points.join(' ')}" fill="${colorPalette.primary}" opacity="0.3"/>`
        break
        
      case 'star':
        const starPoints = []
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
          const radius = i % 2 === 0 ? size / 2 - 5 : size / 4
          const x = centerX + Math.cos(angle) * radius
          const y = centerY + Math.sin(angle) * radius
          starPoints.push(`${x},${y}`)
        }
        shapeElement = `<polygon points="${starPoints.join(' ')}" fill="${colorPalette.accent}" opacity="0.3"/>`
        break
        
      default:
        shapeElement = `<circle cx="${centerX}" cy="${centerY}" r="${size/2 - 5}" 
                               fill="${colorPalette.primary}" opacity="0.3"/>`
    }
    
    return `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        ${shapeElement}
      </svg>
    `
  }

  private static createThemedBorder(
    patterns: string[],
    colorPalette: ColorPalette,
    _style?: string
  ): string {
    const pattern = patterns[0]
    const width = 300
    const height = 20
    
    let borderPattern = ''
    
    switch (pattern) {
      case 'dots':
        for (let i = 0; i < width; i += 20) {
          borderPattern += `<circle cx="${i + 10}" cy="${height/2}" r="2" 
                                   fill="${colorPalette.primary}" opacity="0.5"/>`
        }
        break
        
      case 'lines':
        for (let i = 0; i < width; i += 15) {
          borderPattern += `<line x1="${i}" y1="5" x2="${i}" y2="${height - 5}" 
                                 stroke="${colorPalette.primary}" stroke-width="1" opacity="0.3"/>`
        }
        break
        
      default:
        borderPattern = `<rect x="0" y="${height/2 - 1}" width="${width}" height="2" 
                              fill="${colorPalette.primary}" opacity="0.3"/>`
    }
    
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${borderPattern}
      </svg>
    `
  }

  private static createThemedDivider(
    accents: string[],
    colorPalette: ColorPalette
  ): string {
    const width = 400
    const height = 10
    
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="${height/2}" x2="${width * 0.4}" y2="${height/2}" 
              stroke="${colorPalette.primary}" stroke-width="1" opacity="0.3"/>
        <circle cx="${width/2}" cy="${height/2}" r="3" 
                fill="${colorPalette.accent}" opacity="0.5"/>
        <line x1="${width * 0.6}" y1="${height/2}" x2="${width}" y2="${height/2}" 
              stroke="${colorPalette.primary}" stroke-width="1" opacity="0.3"/>
      </svg>
    `
  }

  private static adjustColorsForAge(
    colorPalette: ColorPalette,
    ageGroup: string
  ): ColorPalette {
    const adjusted = { ...colorPalette }
    
    switch (ageGroup) {
      case 'preschool':
        // Make colors brighter and more saturated
        adjusted.primary = chroma(colorPalette.primary).saturate(1).brighten(0.5).css()
        adjusted.secondary = chroma(colorPalette.secondary).saturate(1).brighten(0.5).css()
        adjusted.accent = chroma(colorPalette.accent).saturate(2).css()
        break
        
      case 'elementary':
        // Slightly brighter colors
        adjusted.primary = chroma(colorPalette.primary).saturate(0.5).brighten(0.3).css()
        adjusted.secondary = chroma(colorPalette.secondary).saturate(0.5).brighten(0.3).css()
        break
        
      case 'high-school':
      case 'adult':
        // More muted, sophisticated colors
        adjusted.primary = chroma(colorPalette.primary).desaturate(0.5).css()
        adjusted.secondary = chroma(colorPalette.secondary).desaturate(0.5).css()
        adjusted.accent = chroma(colorPalette.accent).desaturate(0.3).css()
        break
    }
    
    return adjusted
  }

  private static createAgeAppropriateBackground(
    ageStyle: any,
    colorPalette: ColorPalette,
    _educational: boolean
  ): { svg: string; complexity: number } {
    const width = 1792
    const height = 1024
    const patterns = ageStyle.patterns
    const pattern = patterns[Math.floor(Math.random() * patterns.length)]
    
    let patternSvg = ''
    let complexity = 0.5
    
    switch (pattern) {
      case 'stars':
        complexity = 0.3
        const starCount = ageStyle.complexity === 'simple' ? 10 : 20
        const stars = []
        for (let i = 0; i < starCount; i++) {
          const x = Math.random() * width
          const y = Math.random() * height
          const size = 10 + Math.random() * 20
          stars.push(`
            <path d="M ${x} ${y - size} L ${x + size/3} ${y - size/3} L ${x + size} ${y} 
                     L ${x + size/3} ${y + size/3} L ${x} ${y + size} L ${x - size/3} ${y + size/3} 
                     L ${x - size} ${y} L ${x - size/3} ${y - size/3} Z"
                  fill="${colorPalette.accent}" opacity="0.1"/>
          `)
        }
        patternSvg = stars.join('')
        break
        
      case 'hearts':
        complexity = 0.2
        const heartCount = 15
        const hearts = []
        for (let i = 0; i < heartCount; i++) {
          const x = Math.random() * width
          const y = Math.random() * height
          const size = 20 + Math.random() * 30
          hearts.push(`
            <path d="M ${x} ${y + size/4} 
                     C ${x} ${y}, ${x - size/2} ${y}, ${x - size/2} ${y + size/4} 
                     C ${x - size/2} ${y + size/2}, ${x} ${y + size}, ${x} ${y + size} 
                     C ${x} ${y + size}, ${x + size/2} ${y + size/2}, ${x + size/2} ${y + size/4} 
                     C ${x + size/2} ${y}, ${x} ${y}, ${x} ${y + size/4} Z"
                  fill="${colorPalette.accent}" opacity="0.15"/>
          `)
        }
        patternSvg = hearts.join('')
        break
        
      default:
        complexity = 0.4
        patternSvg = `
          <defs>
            <pattern id="agePattern" width="50" height="50" patternUnits="userSpaceOnUse">
              <circle cx="25" cy="25" r="20" fill="${colorPalette.primary}" opacity="0.05"/>
            </pattern>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#agePattern)"/>
        `
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="${colorPalette.background}"/>
        ${patternSvg}
      </svg>
    `
    
    return { svg, complexity }
  }

  private static createAgeAppropriateDecoration(
    ageStyle: any,
    colorPalette: ColorPalette,
    _subject?: string
  ): { svg: string; complexity: number } {
    const size = 100
    const iconStyle = ageStyle.iconStyle
    
    let decorationSvg = ''
    let complexity = 0.5
    
    switch (iconStyle) {
      case 'cartoon':
        complexity = 0.3
        // Smiley face
        decorationSvg = `
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 5}" 
                  fill="${colorPalette.accent}" opacity="0.8"/>
          <circle cx="${size/3}" cy="${size/2.5}" r="5" fill="${colorPalette.background}"/>
          <circle cx="${size*2/3}" cy="${size/2.5}" r="5" fill="${colorPalette.background}"/>
          <path d="M ${size/3} ${size*2/3} Q ${size/2} ${size*5/6} ${size*2/3} ${size*2/3}" 
                stroke="${colorPalette.background}" stroke-width="3" fill="none"/>
        `
        break
        
      case 'friendly':
        complexity = 0.4
        // Rounded star
        decorationSvg = `
          <path d="M ${size/2} ${size/4} 
                   Q ${size*3/5} ${size*2/5} ${size*3/4} ${size*2/5}
                   Q ${size*3/5} ${size/2} ${size*3/5} ${size*3/4}
                   Q ${size/2} ${size*3/5} ${size/4} ${size*3/4}
                   Q ${size*2/5} ${size/2} ${size/4} ${size*2/5}
                   Q ${size*2/5} ${size*2/5} ${size/2} ${size/4} Z"
                fill="${colorPalette.primary}" opacity="0.6"/>
        `
        break
        
      case 'modern':
      case 'clean':
      case 'professional':
      default:
        complexity = 0.5
        // Geometric shape
        decorationSvg = `
          <rect x="${size/4}" y="${size/4}" width="${size/2}" height="${size/2}" 
                fill="${colorPalette.primary}" opacity="0.3" 
                transform="rotate(45 ${size/2} ${size/2})"/>
        `
    }
    
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        ${decorationSvg}
      </svg>
    `
    
    return { svg, complexity }
  }

  private static createAgeAppropriateGraphic(
    ageStyle: any,
    colorPalette: ColorPalette,
    targetComplexity: number
  ): { svg: string; complexity: number } {
    const width = 200
    const height = 200
    
    let graphicSvg = ''
    let complexity = targetComplexity
    
    if (ageStyle.complexity === 'simple') {
      // Simple shapes for young children
      complexity = Math.min(0.3, targetComplexity)
      graphicSvg = `
        <circle cx="${width/2}" cy="${height/2}" r="${width/3}" 
                fill="${colorPalette.primary}" opacity="0.6"/>
        <rect x="${width/3}" y="${height/3}" width="${width/3}" height="${height/3}" 
              fill="${colorPalette.accent}" opacity="0.5"/>
      `
    } else if (ageStyle.complexity === 'moderate') {
      // More complex composition
      complexity = Math.min(0.6, targetComplexity)
      graphicSvg = `
        <polygon points="${width/2},${height/4} ${width*3/4},${height/2} ${width*3/4},${height*3/4} 
                        ${width/2},${height} ${width/4},${height*3/4} ${width/4},${height/2}"
                 fill="${colorPalette.primary}" opacity="0.4"/>
        <circle cx="${width/2}" cy="${height/2}" r="${width/4}" 
                fill="${colorPalette.accent}" opacity="0.6"/>
      `
    } else {
      // Complex abstract design
      complexity = targetComplexity
      const paths = []
      for (let i = 0; i < 3; i++) {
        const startX = width * (0.2 + i * 0.3)
        const startY = height * 0.2
        const cp1X = width * (0.3 + i * 0.2)
        const cp1Y = height * 0.5
        const cp2X = width * (0.7 - i * 0.2)
        const cp2Y = height * 0.5
        const endX = width * (0.8 - i * 0.3)
        const endY = height * 0.8
        
        paths.push(`
          <path d="M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}"
                stroke="${chroma(colorPalette.primary).set('hsl.h', '+' + (i * 120)).css()}" 
                stroke-width="3" fill="none" opacity="0.6"/>
        `)
      }
      graphicSvg = paths.join('')
    }
    
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="${colorPalette.background}" rx="10"/>
        ${graphicSvg}
      </svg>
    `
    
    return { svg, complexity }
  }

  private static createSimpleShape(color: string): string {
    return `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="${color}" opacity="0.5"/>
      </svg>
    `
  }

  private static calculateAgeEngagement(ageGroup: string, complexity: number): number {
    const baseEngagement = {
      'preschool': 0.9,
      'elementary': 0.8,
      'middle-school': 0.7,
      'high-school': 0.6,
      'adult': 0.5
    }
    
    const base = baseEngagement[ageGroup as keyof typeof baseEngagement] || 0.6
    
    // Adjust based on complexity match
    const idealComplexity = {
      'preschool': 0.2,
      'elementary': 0.4,
      'middle-school': 0.6,
      'high-school': 0.7,
      'adult': 0.8
    }
    
    const ideal = idealComplexity[ageGroup as keyof typeof idealComplexity] || 0.5
    const complexityMatch = 1 - Math.abs(complexity - ideal)
    
    return base * complexityMatch
  }

  private static calculateAppropriateness(ageGroup: string, complexity: number): number {
    const idealComplexity = {
      'preschool': 0.2,
      'elementary': 0.4,
      'middle-school': 0.6,
      'high-school': 0.7,
      'adult': 0.8
    }
    
    const ideal = idealComplexity[ageGroup as keyof typeof idealComplexity] || 0.5
    const difference = Math.abs(complexity - ideal)
    
    // Calculate appropriateness (1 = perfect match, 0 = completely inappropriate)
    return Math.max(0, 1 - difference * 2)
  }
}

/**
 * Export convenience functions
 */
export const assetGeneration = {
  generateBackground: AssetGenerationAlgorithms.generateContextAwareBackground,
  generateEducationalGraphic: AssetGenerationAlgorithms.generateEducationalGraphic,
  generateDecoration: AssetGenerationAlgorithms.generateSubjectDecoration,
  generateAgeAppropriateElement: AssetGenerationAlgorithms.generateAgeAppropriateElement
}