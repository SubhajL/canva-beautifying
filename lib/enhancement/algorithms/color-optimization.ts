import chroma from 'chroma-js'

/**
 * Comprehensive color optimization algorithms
 */

// Types for color optimization
export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  neutral: string[]
  semantic: {
    success: string
    warning: string
    error: string
    info: string
  }
}

export interface ColorHarmony {
  type: 'monochromatic' | 'analogous' | 'complementary' | 'split-complementary' | 'triadic' | 'tetradic'
  colors: string[]
  score: number
}

export interface ContrastResult {
  ratio: number
  passes: {
    AA: boolean
    AAA: boolean
    AALarge: boolean
    AAALarge: boolean
  }
  recommendation?: string
}

export interface AccessibilityResult {
  wcagCompliant: boolean
  colorBlindSafe: boolean
  issues: string[]
  suggestions: string[]
}

/**
 * Color Optimization Class
 * Implements advanced color theory algorithms
 */
export class ColorOptimization {
  /**
   * Generate a complementary color scheme
   */
  static generateComplementary(baseColor: string, options?: {
    variations?: number
    preserveLuminance?: boolean
  }): string[] {
    const base = chroma(baseColor)
    const hsl = base.hsl()
    const complementaryHue = (hsl[0] + 180) % 360
    
    const colors = [baseColor]
    
    // Generate main complementary
    const complement = chroma.hsl(
      complementaryHue,
      hsl[1],
      options?.preserveLuminance ? hsl[2] : 0.5
    )
    colors.push(complement.hex())
    
    // Generate variations if requested
    if (options?.variations && options.variations > 0) {
      // Lighter variation
      colors.push(base.brighten(1).hex())
      colors.push(complement.brighten(1).hex())
      
      if (options.variations > 1) {
        // Darker variation
        colors.push(base.darken(1).hex())
        colors.push(complement.darken(1).hex())
      }
    }
    
    return colors
  }

  /**
   * Generate split-complementary color scheme
   */
  static generateSplitComplementary(baseColor: string): string[] {
    const base = chroma(baseColor)
    const hsl = base.hsl()
    
    // Split complementary uses base + two colors adjacent to complement
    const splitAngle = 30
    const complement1 = (hsl[0] + 180 - splitAngle) % 360
    const complement2 = (hsl[0] + 180 + splitAngle) % 360
    
    return [
      baseColor,
      chroma.hsl(complement1, hsl[1] * 0.8, hsl[2]).hex(),
      chroma.hsl(complement2, hsl[1] * 0.8, hsl[2]).hex()
    ]
  }

  /**
   * Generate analogous color scheme
   */
  static generateAnalogous(baseColor: string, count: number = 3): string[] {
    const base = chroma(baseColor)
    const hsl = base.hsl()
    const colors = [baseColor]
    
    const angleStep = 30 // Standard analogous angle
    
    for (let i = 1; i < count; i++) {
      const hue = (hsl[0] + angleStep * i) % 360
      colors.push(chroma.hsl(hue, hsl[1], hsl[2]).hex())
    }
    
    return colors
  }

  /**
   * Generate triadic color scheme
   */
  static generateTriadic(baseColor: string): string[] {
    const base = chroma(baseColor)
    const hsl = base.hsl()
    
    return [
      baseColor,
      chroma.hsl((hsl[0] + 120) % 360, hsl[1], hsl[2]).hex(),
      chroma.hsl((hsl[0] + 240) % 360, hsl[1], hsl[2]).hex()
    ]
  }

  /**
   * Generate tetradic (square) color scheme
   */
  static generateTetradic(baseColor: string): string[] {
    const base = chroma(baseColor)
    const hsl = base.hsl()
    
    return [
      baseColor,
      chroma.hsl((hsl[0] + 90) % 360, hsl[1], hsl[2]).hex(),
      chroma.hsl((hsl[0] + 180) % 360, hsl[1], hsl[2]).hex(),
      chroma.hsl((hsl[0] + 270) % 360, hsl[1], hsl[2]).hex()
    ]
  }

  /**
   * Fix contrast ratio between two colors
   */
  static fixContrast(
    foreground: string,
    background: string,
    targetRatio: number = 4.5,
    options?: {
      preferLightness?: 'light' | 'dark'
      maxIterations?: number
    }
  ): { foreground: string; background: string; ratio: number } {
    let fg = chroma(foreground)
    let bg = chroma(background)
    let ratio = chroma.contrast(fg, bg)
    
    if (ratio >= targetRatio) {
      return { foreground: fg.hex(), background: bg.hex(), ratio }
    }
    
    const maxIterations = options?.maxIterations || 50
    let iterations = 0
    
    // Determine which color to adjust
    const adjustForeground = bg.luminance() > 0.5
    
    while (ratio < targetRatio && iterations < maxIterations) {
      if (adjustForeground) {
        // Make foreground darker on light background
        if (options?.preferLightness === 'light') {
          bg = bg.brighten(0.1)
        } else {
          fg = fg.darken(0.1)
        }
      } else {
        // Make foreground lighter on dark background
        if (options?.preferLightness === 'dark') {
          bg = bg.darken(0.1)
        } else {
          fg = fg.brighten(0.1)
        }
      }
      
      ratio = chroma.contrast(fg, bg)
      iterations++
    }
    
    return { foreground: fg.hex(), background: bg.hex(), ratio }
  }

  /**
   * Harmonize a color palette
   */
  static harmonizePalette(colors: string[], options?: {
    method?: 'hue-shift' | 'saturation-match' | 'luminance-spread'
    targetHarmony?: ColorHarmony['type']
  }): string[] {
    if (colors.length === 0) return []
    if (colors.length === 1) return colors
    
    const method = options?.method || 'hue-shift'
    const baseColor = colors[0]
    const base = chroma(baseColor)
    
    switch (method) {
      case 'hue-shift':
        return this.harmonizeByHueShift(colors, base)
      
      case 'saturation-match':
        return this.harmonizeBySaturation(colors, base)
      
      case 'luminance-spread':
        return this.harmonizeByLuminance(colors)
      
      default:
        return colors
    }
  }

  private static harmonizeByHueShift(colors: string[], base: chroma.Color): string[] {
    const baseHsl = base.hsl()
    const targetHarmony = this.detectHarmonyType(colors)
    
    return colors.map((color, index) => {
      if (index === 0) return color
      
      const currentHsl = chroma(color).hsl()
      let newHue = currentHsl[0]
      
      switch (targetHarmony) {
        case 'analogous':
          newHue = (baseHsl[0] + 30 * index) % 360
          break
        case 'triadic':
          newHue = (baseHsl[0] + 120 * index) % 360
          break
        case 'complementary':
          newHue = index === 1 ? (baseHsl[0] + 180) % 360 : currentHsl[0]
          break
      }
      
      return chroma.hsl(newHue, currentHsl[1], currentHsl[2]).hex()
    })
  }

  private static harmonizeBySaturation(colors: string[], base: chroma.Color): string[] {
    const baseSaturation = base.hsl()[1]
    
    return colors.map(color => {
      const hsl = chroma(color).hsl()
      return chroma.hsl(hsl[0], baseSaturation, hsl[2]).hex()
    })
  }

  private static harmonizeByLuminance(colors: string[]): string[] {
    const luminances = colors.map(c => chroma(c).luminance())
    const minLum = Math.min(...luminances)
    const maxLum = Math.max(...luminances)
    
    if (maxLum - minLum < 0.2) return colors // Already well distributed
    
    // Spread luminances evenly
    const step = (maxLum - minLum) / (colors.length - 1)
    
    return colors.map((color, index) => {
      const targetLum = minLum + step * index
      return chroma(color).luminance(targetLum).hex()
    })
  }

  private static detectHarmonyType(colors: string[]): ColorHarmony['type'] {
    if (colors.length < 2) return 'monochromatic'
    
    const hues = colors.map(c => chroma(c).hsl()[0])
    const hueDiffs = []
    
    for (let i = 1; i < hues.length; i++) {
      hueDiffs.push(Math.abs(hues[i] - hues[0]))
    }
    
    const avgDiff = hueDiffs.reduce((a, b) => a + b, 0) / hueDiffs.length
    
    if (avgDiff < 30) return 'analogous'
    if (avgDiff > 150 && avgDiff < 210) return 'complementary'
    if (avgDiff > 100 && avgDiff < 140) return 'triadic'
    
    return 'analogous' // Default
  }

  /**
   * Ensure accessibility compliance
   */
  static ensureAccessibility(
    palette: ColorPalette,
    options?: {
      wcagLevel?: 'AA' | 'AAA'
      colorBlindTypes?: Array<'protanopia' | 'deuteranopia' | 'tritanopia'>
    }
  ): { palette: ColorPalette; report: AccessibilityResult } {
    const level = options?.wcagLevel || 'AA'
    const minRatio = level === 'AA' ? 4.5 : 7
    const issues: string[] = []
    const suggestions: string[] = []
    
    // Fix primary text contrast
    const primaryContrast = chroma.contrast(palette.primary, '#FFFFFF')
    if (primaryContrast < minRatio) {
      const fixed = this.fixContrast(palette.primary, '#FFFFFF', minRatio)
      palette.primary = fixed.foreground
      suggestions.push(`Adjusted primary color for ${level} compliance`)
    }
    
    // Fix semantic colors
    const semanticBg = '#FFFFFF'
    Object.entries(palette.semantic).forEach(([key, color]) => {
      const contrast = chroma.contrast(color, semanticBg)
      if (contrast < minRatio) {
        const fixed = this.fixContrast(color, semanticBg, minRatio)
        palette.semantic[key as keyof typeof palette.semantic] = fixed.foreground
        suggestions.push(`Adjusted ${key} color for ${level} compliance`)
      }
    })
    
    // Check color blind safety
    const colorBlindSafe = this.checkColorBlindSafety(
      [palette.primary, palette.secondary, palette.accent],
      options?.colorBlindTypes || ['protanopia', 'deuteranopia']
    )
    
    if (!colorBlindSafe.safe) {
      issues.push(...colorBlindSafe.issues)
      suggestions.push(...colorBlindSafe.suggestions)
    }
    
    return {
      palette,
      report: {
        wcagCompliant: issues.length === 0,
        colorBlindSafe: colorBlindSafe.safe,
        issues,
        suggestions
      }
    }
  }

  /**
   * Check color blind safety
   */
  private static checkColorBlindSafety(
    colors: string[],
    types: Array<'protanopia' | 'deuteranopia' | 'tritanopia'>
  ): { safe: boolean; issues: string[]; suggestions: string[] } {
    const issues: string[] = []
    const suggestions: string[] = []
    
    for (const type of types) {
      const simulated = colors.map(c => this.simulateColorBlindness(c, type))
      
      // Check if colors are distinguishable
      for (let i = 0; i < simulated.length; i++) {
        for (let j = i + 1; j < simulated.length; j++) {
          const distance = chroma.deltaE(simulated[i], simulated[j])
          if (distance < 20) {
            issues.push(`Colors ${i + 1} and ${j + 1} are too similar for ${type}`)
            suggestions.push(`Increase hue or luminance difference between colors ${i + 1} and ${j + 1}`)
          }
        }
      }
    }
    
    return {
      safe: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * Simulate color blindness
   */
  private static simulateColorBlindness(
    color: string,
    type: 'protanopia' | 'deuteranopia' | 'tritanopia'
  ): string {
    // Simplified simulation - in production use proper color blind simulation library
    const rgb = chroma(color).rgb()
    
    switch (type) {
      case 'protanopia': // No red
        return chroma(rgb[1], rgb[1], rgb[2]).hex()
      
      case 'deuteranopia': // No green
        return chroma(rgb[0], rgb[0], rgb[2]).hex()
      
      case 'tritanopia': // No blue
        return chroma(rgb[0], rgb[1], rgb[1]).hex()
      
      default:
        return color
    }
  }

  /**
   * Generate accessible color variations
   */
  static generateAccessibleVariations(
    baseColor: string,
    count: number = 5,
    options?: {
      includeNeutrals?: boolean
      maintainHue?: boolean
    }
  ): string[] {
    const base = chroma(baseColor)
    const variations: string[] = []
    
    // Generate luminance-based variations
    const lumStep = 0.8 / count
    for (let i = 0; i < count; i++) {
      const lum = 0.1 + lumStep * i
      variations.push(base.luminance(lum).hex())
    }
    
    // Add neutrals if requested
    if (options?.includeNeutrals) {
      const hsl = base.hsl()
      variations.push(
        chroma.hsl(hsl[0], 0.1, 0.95).hex(), // Light neutral
        chroma.hsl(hsl[0], 0.1, 0.15).hex()  // Dark neutral
      )
    }
    
    return variations
  }

  /**
   * Optimize palette for digital screens
   */
  static optimizeForScreen(colors: string[]): string[] {
    return colors.map(color => {
      const c = chroma(color)
      
      // Ensure colors aren't too saturated for screens
      const hsl = c.hsl()
      if (hsl[1] > 90) {
        return chroma.hsl(hsl[0], 85, hsl[2]).hex()
      }
      
      // Ensure sufficient luminance
      if (c.luminance() < 0.05) {
        return c.luminance(0.05).hex()
      }
      
      return color
    })
  }

  /**
   * Generate color palette from image/document analysis
   */
  static generatePaletteFromAnalysis(
    dominantColors: string[],
    style: 'vibrant' | 'muted' | 'monochrome' | 'professional',
    options?: {
      preserveBrand?: string
      targetColors?: number
    }
  ): ColorPalette {
    let primary = options?.preserveBrand || dominantColors[0] || '#3B82F6'
    
    // Adjust primary based on style
    switch (style) {
      case 'vibrant':
        primary = chroma(primary).saturate(2).hex()
        break
      case 'muted':
        primary = chroma(primary).desaturate(2).hex()
        break
      case 'monochrome':
        primary = chroma(primary).desaturate(3).hex()
        break
    }
    
    // Generate complementary colors
    const scheme = style === 'monochrome' 
      ? this.generateMonochromatic(primary, 3)
      : this.generateComplementary(primary, { variations: 1 })
    
    // Generate neutrals
    const neutralBase = chroma(primary).desaturate(3)
    const neutrals = [
      neutralBase.luminance(0.95).hex(), // Background
      neutralBase.luminance(0.85).hex(), // Light gray
      neutralBase.luminance(0.45).hex(), // Medium gray
      neutralBase.luminance(0.15).hex(), // Dark gray
      neutralBase.luminance(0.05).hex()  // Almost black
    ]
    
    // Generate semantic colors
    const semantic = {
      success: style === 'monochrome' ? neutrals[3] : '#10B981',
      warning: style === 'monochrome' ? neutrals[3] : '#F59E0B',
      error: style === 'monochrome' ? neutrals[3] : '#EF4444',
      info: style === 'monochrome' ? neutrals[3] : '#3B82F6'
    }
    
    return {
      primary,
      secondary: scheme[1] || chroma(primary).darken(1).hex(),
      accent: scheme[2] || chroma(primary).brighten(1).hex(),
      neutral: neutrals,
      semantic
    }
  }

  /**
   * Generate monochromatic variations
   */
  private static generateMonochromatic(baseColor: string, count: number): string[] {
    const base = chroma(baseColor)
    const colors = [baseColor]
    
    // Generate lighter variations
    for (let i = 1; i <= Math.floor(count / 2); i++) {
      colors.push(base.brighten(i * 0.5).hex())
    }
    
    // Generate darker variations
    for (let i = 1; i <= Math.floor(count / 2); i++) {
      colors.push(base.darken(i * 0.5).hex())
    }
    
    return colors.slice(0, count)
  }
}

/**
 * Export helper functions for easy use
 */
export const colorOptimization = {
  complementary: ColorOptimization.generateComplementary,
  splitComplementary: ColorOptimization.generateSplitComplementary,
  analogous: ColorOptimization.generateAnalogous,
  triadic: ColorOptimization.generateTriadic,
  tetradic: ColorOptimization.generateTetradic,
  fixContrast: ColorOptimization.fixContrast,
  harmonize: ColorOptimization.harmonizePalette,
  ensureAccessibility: ColorOptimization.ensureAccessibility,
  generateFromAnalysis: ColorOptimization.generatePaletteFromAnalysis,
  optimizeForScreen: ColorOptimization.optimizeForScreen
}