/**
 * Typography improvement algorithms
 */

// Font pairing data
const FONT_PAIRINGS = {
  'Inter': ['Source Serif Pro', 'Merriweather', 'Lora', 'IBM Plex Sans'],
  'Roboto': ['Roboto Slab', 'Playfair Display', 'Lora', 'Open Sans'],
  'Open Sans': ['Merriweather', 'Playfair Display', 'Montserrat', 'Source Serif Pro'],
  'Montserrat': ['Source Serif Pro', 'Lora', 'Open Sans', 'Roboto'],
  'Poppins': ['Lora', 'Source Serif Pro', 'Inter', 'IBM Plex Sans'],
  'Playfair Display': ['Open Sans', 'Lato', 'Source Sans Pro', 'Roboto'],
  'Merriweather': ['Open Sans', 'Montserrat', 'Lato', 'Source Sans Pro'],
  'Lato': ['Merriweather', 'Playfair Display', 'Source Serif Pro', 'Roboto Slab'],
  'Source Sans Pro': ['Source Serif Pro', 'Playfair Display', 'Merriweather', 'Lora'],
  'IBM Plex Sans': ['IBM Plex Serif', 'Merriweather', 'Source Serif Pro', 'Lora']
}

// Font characteristics
const FONT_CHARACTERISTICS = {
  'Inter': { category: 'sans-serif', personality: 'modern', weight: 'variable', readability: 'excellent' },
  'Roboto': { category: 'sans-serif', personality: 'friendly', weight: 'variable', readability: 'excellent' },
  'Open Sans': { category: 'sans-serif', personality: 'neutral', weight: 'variable', readability: 'excellent' },
  'Montserrat': { category: 'sans-serif', personality: 'geometric', weight: 'variable', readability: 'good' },
  'Poppins': { category: 'sans-serif', personality: 'playful', weight: 'variable', readability: 'good' },
  'Playfair Display': { category: 'serif', personality: 'elegant', weight: 'normal', readability: 'moderate' },
  'Merriweather': { category: 'serif', personality: 'traditional', weight: 'normal', readability: 'excellent' },
  'Lora': { category: 'serif', personality: 'friendly', weight: 'normal', readability: 'excellent' },
  'Lato': { category: 'sans-serif', personality: 'warm', weight: 'variable', readability: 'excellent' },
  'Source Sans Pro': { category: 'sans-serif', personality: 'clean', weight: 'variable', readability: 'excellent' },
  'Source Serif Pro': { category: 'serif', personality: 'professional', weight: 'variable', readability: 'excellent' },
  'IBM Plex Sans': { category: 'sans-serif', personality: 'technical', weight: 'variable', readability: 'excellent' },
  'IBM Plex Serif': { category: 'serif', personality: 'technical', weight: 'normal', readability: 'good' },
  'Roboto Slab': { category: 'slab-serif', personality: 'modern', weight: 'variable', readability: 'good' }
}

// Types for typography
export interface FontPairing {
  primary: string
  secondary: string
  score: number
  rationale: string
}

export interface TypeScale {
  base: number
  scale: number
  sizes: {
    h1: number
    h2: number
    h3: number
    h4: number
    h5: number
    h6: number
    body: number
    small: number
    tiny: number
  }
}

export interface TypographyMetrics {
  lineHeight: number
  letterSpacing: number
  paragraphSpacing: number
  wordSpacing: number
  readabilityScore: number
}

export interface TypographySystem {
  fonts: {
    heading: string
    body: string
    mono?: string
  }
  scale: TypeScale
  metrics: TypographyMetrics
  weights: {
    light: number
    regular: number
    medium: number
    semibold: number
    bold: number
  }
}

/**
 * Typography Improvement Class
 */
export class TypographyImprovement {
  /**
   * Suggest font pairings based on primary font
   */
  static suggestFontPairings(
    primaryFont: string,
    options?: {
      style?: 'contrast' | 'harmony' | 'safe'
      purpose?: 'heading-body' | 'display-text' | 'ui'
      count?: number
    }
  ): FontPairing[] {
    const style = options?.style || 'contrast'
    const purpose = options?.purpose || 'heading-body'
    const count = options?.count || 3
    
    const pairings: FontPairing[] = []
    const primaryChar = FONT_CHARACTERISTICS[primaryFont as keyof typeof FONT_CHARACTERISTICS]
    
    if (!primaryChar) {
      // Unknown font, suggest safe defaults
      return this.getDefaultPairings(purpose, count)
    }
    
    // Get predefined pairings
    const suggestions = FONT_PAIRINGS[primaryFont as keyof typeof FONT_PAIRINGS] || []
    
    // Score each pairing
    suggestions.forEach(secondary => {
      const secondaryChar = FONT_CHARACTERISTICS[secondary as keyof typeof FONT_CHARACTERISTICS]
      if (!secondaryChar) return
      
      const score = this.scorePairing(primaryChar, secondaryChar, style, purpose)
      const rationale = this.getPairingRationale(primaryChar, secondaryChar, style)
      
      pairings.push({
        primary: primaryFont,
        secondary,
        score,
        rationale
      })
    })
    
    // Sort by score and return top matches
    return pairings
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  }

  private static scorePairing(
    primary: any,
    secondary: any,
    style: string,
    purpose: string
  ): number {
    let score = 50 // Base score
    
    // Style-based scoring
    switch (style) {
      case 'contrast':
        if (primary.category !== secondary.category) score += 30
        if (primary.personality !== secondary.personality) score += 20
        break
      
      case 'harmony':
        if (primary.category === secondary.category) score += 20
        if (primary.personality === secondary.personality) score += 30
        break
      
      case 'safe':
        if (secondary.readability === 'excellent') score += 30
        if (primary.category !== secondary.category) score += 20
        break
    }
    
    // Purpose-based scoring
    switch (purpose) {
      case 'heading-body':
        if (primary.category === 'serif' && secondary.category === 'sans-serif') score += 20
        if (primary.category === 'sans-serif' && secondary.category === 'serif') score += 20
        break
      
      case 'display-text':
        if (primary.personality === 'elegant' || primary.personality === 'playful') score += 15
        if (secondary.readability === 'excellent') score += 25
        break
      
      case 'ui':
        if (primary.readability === 'excellent' && secondary.readability === 'excellent') score += 30
        if (primary.category === 'sans-serif' && secondary.category === 'sans-serif') score += 10
        break
    }
    
    // Readability bonus
    const readabilityScore = {
      'excellent': 20,
      'good': 10,
      'moderate': 0
    }
    score += (readabilityScore[primary.readability as keyof typeof readabilityScore] || 0) / 2
    score += (readabilityScore[secondary.readability as keyof typeof readabilityScore] || 0) / 2
    
    return Math.min(100, score)
  }

  private static getPairingRationale(primary: any, secondary: any, _style: string): string {
    const contrastRationale = primary.category !== secondary.category
      ? `${primary.category} and ${secondary.category} create visual contrast`
      : `Both ${primary.category} fonts create consistency`
    
    const personalityRationale = primary.personality !== secondary.personality
      ? `${primary.personality} paired with ${secondary.personality} adds character`
      : `Matching ${primary.personality} personality maintains tone`
    
    return `${contrastRationale}. ${personalityRationale}.`
  }

  private static getDefaultPairings(purpose: string, count: number): FontPairing[] {
    const defaults = [
      { primary: 'Inter', secondary: 'Source Serif Pro', score: 90, rationale: 'Classic sans-serif and serif combination' },
      { primary: 'Roboto', secondary: 'Roboto Slab', score: 85, rationale: 'Same family provides consistency' },
      { primary: 'Open Sans', secondary: 'Merriweather', score: 88, rationale: 'Popular and highly readable pairing' }
    ]
    
    return defaults.slice(0, count)
  }

  /**
   * Optimize size hierarchy using modular scale
   */
  static optimizeSizeHierarchy(
    baseSize: number,
    options?: {
      scale?: 'minor-second' | 'major-second' | 'minor-third' | 'major-third' | 'perfect-fourth' | 'augmented-fourth' | 'perfect-fifth' | 'golden-ratio'
      steps?: number
      minSize?: number
      maxSize?: number
    }
  ): TypeScale {
    const scaleRatios = {
      'minor-second': 1.067,
      'major-second': 1.125,
      'minor-third': 1.2,
      'major-third': 1.25,
      'perfect-fourth': 1.333,
      'augmented-fourth': 1.414,
      'perfect-fifth': 1.5,
      'golden-ratio': 1.618
    }
    
    const scale = scaleRatios[options?.scale || 'major-third']
    const minSize = options?.minSize || 12
    const maxSize = options?.maxSize || 72
    
    // Generate scale
    const sizes = {
      h1: Math.min(maxSize, Math.round(baseSize * Math.pow(scale, 4))),
      h2: Math.round(baseSize * Math.pow(scale, 3)),
      h3: Math.round(baseSize * Math.pow(scale, 2)),
      h4: Math.round(baseSize * Math.pow(scale, 1)),
      h5: Math.round(baseSize * Math.pow(scale, 0.5)),
      h6: baseSize,
      body: baseSize,
      small: Math.max(minSize, Math.round(baseSize / scale)),
      tiny: Math.max(minSize - 2, Math.round(baseSize / Math.pow(scale, 2)))
    }
    
    return {
      base: baseSize,
      scale,
      sizes
    }
  }

  /**
   * Calculate optimal line height based on font size and line length
   */
  static calculateLineHeight(
    fontSize: number,
    options?: {
      lineLength?: number // Characters per line
      fontCategory?: 'serif' | 'sans-serif' | 'mono'
      purpose?: 'body' | 'heading' | 'display'
    }
  ): number {
    const lineLength = options?.lineLength || 65
    const category = options?.fontCategory || 'sans-serif'
    const purpose = options?.purpose || 'body'
    
    let baseRatio = 1.5 // Default
    
    // Adjust for font size
    if (fontSize < 14) {
      baseRatio = 1.6
    } else if (fontSize > 20) {
      baseRatio = 1.4
    }
    
    // Adjust for line length
    if (lineLength > 80) {
      baseRatio += 0.1
    } else if (lineLength < 45) {
      baseRatio -= 0.1
    }
    
    // Adjust for font category
    if (category === 'serif') {
      baseRatio += 0.05
    } else if (category === 'mono') {
      baseRatio += 0.1
    }
    
    // Adjust for purpose
    if (purpose === 'heading') {
      baseRatio = Math.max(1.2, baseRatio - 0.3)
    } else if (purpose === 'display') {
      baseRatio = Math.max(1.1, baseRatio - 0.4)
    }
    
    return Math.round(baseRatio * 100) / 100
  }

  /**
   * Calculate optimal letter spacing
   */
  static calculateLetterSpacing(
    fontSize: number,
    options?: {
      fontWeight?: number
      purpose?: 'body' | 'heading' | 'display' | 'caps'
      density?: 'tight' | 'normal' | 'loose'
    }
  ): number {
    const weight = options?.fontWeight || 400
    const purpose = options?.purpose || 'body'
    const density = options?.density || 'normal'
    
    let spacing = 0 // Base (em units)
    
    // Purpose-based adjustments
    switch (purpose) {
      case 'heading':
        if (fontSize > 24) spacing = -0.02
        if (weight > 600) spacing -= 0.01
        break
      
      case 'display':
        if (fontSize > 36) spacing = -0.03
        if (weight > 700) spacing -= 0.02
        break
      
      case 'caps':
        spacing = 0.1 // Always add spacing for all caps
        break
      
      case 'body':
      default:
        if (fontSize < 14) spacing = 0.01
        break
    }
    
    // Density adjustments
    switch (density) {
      case 'tight':
        spacing -= 0.02
        break
      case 'loose':
        spacing += 0.02
        break
    }
    
    return Math.round(spacing * 1000) / 1000
  }

  /**
   * Fix line height and spacing issues
   */
  static fixSpacing(
    currentMetrics: Partial<TypographyMetrics>,
    fontSize: number,
    options?: {
      lineLength?: number
      fontCategory?: 'serif' | 'sans-serif' | 'mono'
      targetReadability?: 'comfortable' | 'compact' | 'spacious'
    }
  ): TypographyMetrics {
    const target = options?.targetReadability || 'comfortable'
    
    // Calculate optimal line height
    const lineHeight = this.calculateLineHeight(fontSize, {
      lineLength: options?.lineLength,
      fontCategory: options?.fontCategory,
      purpose: 'body'
    })
    
    // Calculate letter spacing
    const letterSpacing = this.calculateLetterSpacing(fontSize, {
      purpose: 'body',
      density: target === 'compact' ? 'tight' : target === 'spacious' ? 'loose' : 'normal'
    })
    
    // Calculate paragraph spacing
    let paragraphSpacing = lineHeight * 0.75
    if (target === 'spacious') paragraphSpacing *= 1.25
    if (target === 'compact') paragraphSpacing *= 0.75
    
    // Word spacing (subtle adjustments)
    let wordSpacing = 0
    if (target === 'spacious') wordSpacing = 0.05
    if (target === 'compact') wordSpacing = -0.02
    
    // Calculate readability score
    const readabilityScore = this.calculateReadabilityScore({
      fontSize,
      lineHeight,
      lineLength: options?.lineLength || 65,
      contrast: 10 // Assume good contrast
    })
    
    return {
      lineHeight,
      letterSpacing,
      paragraphSpacing,
      wordSpacing,
      readabilityScore
    }
  }

  /**
   * Enhance readability
   */
  static enhanceReadability(
    text: string,
    currentMetrics: {
      fontSize: number
      lineHeight: number
      lineLength: number
      fontFamily: string
    }
  ): {
    recommendations: string[]
    improvedMetrics: Partial<TypographyMetrics>
    score: { before: number; after: number }
  } {
    const recommendations: string[] = []
    const beforeScore = this.calculateReadabilityScore(currentMetrics)
    
    // Check font size
    if (currentMetrics.fontSize < 14) {
      recommendations.push('Increase body font size to at least 16px for better readability')
    }
    
    // Check line length
    if (currentMetrics.lineLength > 75) {
      recommendations.push('Reduce line length to 65-75 characters for optimal reading')
    } else if (currentMetrics.lineLength < 45) {
      recommendations.push('Increase line length to at least 45 characters')
    }
    
    // Check line height
    const optimalLineHeight = this.calculateLineHeight(currentMetrics.fontSize, {
      lineLength: currentMetrics.lineLength
    })
    
    if (Math.abs(currentMetrics.lineHeight - optimalLineHeight) > 0.1) {
      recommendations.push(`Adjust line height to ${optimalLineHeight} for better readability`)
    }
    
    // Calculate improved metrics
    const improvedMetrics = this.fixSpacing(
      {},
      Math.max(16, currentMetrics.fontSize),
      { lineLength: Math.min(75, Math.max(45, currentMetrics.lineLength)) }
    )
    
    const afterScore = this.calculateReadabilityScore({
      fontSize: Math.max(16, currentMetrics.fontSize),
      lineHeight: improvedMetrics.lineHeight,
      lineLength: Math.min(75, Math.max(45, currentMetrics.lineLength)),
      contrast: 10
    })
    
    return {
      recommendations,
      improvedMetrics,
      score: { before: beforeScore, after: afterScore }
    }
  }

  /**
   * Calculate readability score
   */
  private static calculateReadabilityScore(metrics: {
    fontSize?: number
    lineHeight?: number
    lineLength?: number
    contrast?: number
  }): number {
    let score = 50 // Base score
    
    // Font size scoring (16px is ideal)
    const fontSize = metrics.fontSize || 16
    if (fontSize >= 16 && fontSize <= 18) score += 20
    else if (fontSize >= 14 && fontSize < 16) score += 10
    else if (fontSize > 18 && fontSize <= 20) score += 15
    else if (fontSize < 14) score -= 10
    
    // Line height scoring (1.5 is ideal)
    const lineHeight = metrics.lineHeight || 1.5
    if (lineHeight >= 1.4 && lineHeight <= 1.6) score += 15
    else if (lineHeight >= 1.3 && lineHeight < 1.4) score += 10
    else if (lineHeight > 1.6 && lineHeight <= 1.7) score += 10
    else score -= 5
    
    // Line length scoring (65 characters is ideal)
    const lineLength = metrics.lineLength || 65
    if (lineLength >= 45 && lineLength <= 75) score += 15
    else if (lineLength > 75 && lineLength <= 85) score += 5
    else if (lineLength < 45 && lineLength >= 35) score += 5
    else score -= 10
    
    // Contrast bonus
    const contrast = metrics.contrast || 7
    if (contrast >= 7) score += 10
    else if (contrast >= 4.5) score += 5
    
    return Math.min(100, Math.max(0, score))
  }

  /**
   * Generate complete typography system
   */
  static generateTypographySystem(
    options: {
      baseSize?: number
      style?: 'modern' | 'classic' | 'playful' | 'technical'
      primaryFont?: string
      purpose?: 'website' | 'app' | 'document' | 'presentation'
    }
  ): TypographySystem {
    const baseSize = options.baseSize || 16
    const style = options.style || 'modern'
    const purpose = options.purpose || 'website'
    
    // Select fonts based on style
    const fontMap = {
      modern: { heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' },
      classic: { heading: 'Playfair Display', body: 'Lora', mono: 'Courier New' },
      playful: { heading: 'Poppins', body: 'Open Sans', mono: 'Fira Code' },
      technical: { heading: 'IBM Plex Sans', body: 'IBM Plex Sans', mono: 'IBM Plex Mono' }
    }
    
    const fonts = options.primaryFont 
      ? { heading: options.primaryFont, body: options.primaryFont, mono: 'monospace' }
      : fontMap[style]
    
    // Generate scale based on purpose
    const scaleMap = {
      website: 'major-third',
      app: 'major-second',
      document: 'minor-third',
      presentation: 'perfect-fourth'
    }
    
    const scale = this.optimizeSizeHierarchy(baseSize, {
      scale: scaleMap[purpose] as any
    })
    
    // Generate metrics
    const metrics = this.fixSpacing({}, baseSize, {
      targetReadability: purpose === 'document' ? 'spacious' : 'comfortable'
    })
    
    // Define weights
    const weights = {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
    
    return {
      fonts,
      scale,
      metrics,
      weights
    }
  }
}

/**
 * Export helper functions
 */
export const typographyImprovement = {
  suggestPairings: TypographyImprovement.suggestFontPairings,
  optimizeHierarchy: TypographyImprovement.optimizeSizeHierarchy,
  calculateLineHeight: TypographyImprovement.calculateLineHeight,
  calculateLetterSpacing: TypographyImprovement.calculateLetterSpacing,
  fixSpacing: TypographyImprovement.fixSpacing,
  enhanceReadability: TypographyImprovement.enhanceReadability,
  generateSystem: TypographyImprovement.generateTypographySystem
}