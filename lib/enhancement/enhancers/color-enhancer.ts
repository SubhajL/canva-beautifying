import { BaseEnhancer } from '../base-enhancer'
import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences, ColorEnhancement } from '../types'

export class ColorEnhancer extends BaseEnhancer {
  constructor() {
    super('Color Palette Optimization', 'Optimizes color harmony, contrast, and accessibility', 'high')
  }

  async analyze(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy[]> {
    const strategies: EnhancementStrategy[] = []
    const colorScore = analysis.colors.score

    // Generate color enhancement strategies based on issues
    if (colorScore < 80) {
      const colorStrategy = await this.generateColorStrategy(analysis, preferences)
      strategies.push(colorStrategy)
    }

    // Add accessibility-focused strategy if needed
    if (analysis.colors.issues.includes('Poor contrast')) {
      const accessibilityStrategy = await this.generateAccessibilityStrategy(analysis)
      strategies.push(accessibilityStrategy)
    }

    return strategies
  }

  private async generateColorStrategy(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy> {
    const colorScheme = preferences?.colorScheme || this.detectBestColorScheme(analysis)
    const optimizedPalette = this.optimizePalette(analysis.colors.palette, colorScheme)

    const enhancement: ColorEnhancement = {
      palette: {
        primary: optimizedPalette.primary,
        secondary: optimizedPalette.secondary,
        accent: optimizedPalette.accent,
        background: optimizedPalette.background,
        text: optimizedPalette.text
      },
      adjustments: {
        contrast: this.calculateContrastAdjustment(analysis),
        saturation: this.calculateSaturationAdjustment(analysis, colorScheme),
        brightness: this.calculateBrightnessAdjustment(analysis)
      },
      replacements: this.generateColorReplacements(analysis.colors.palette, optimizedPalette)
    }

    return {
      id: this.generateStrategyId(),
      name: 'Optimize Color Palette',
      description: `Apply ${colorScheme} color scheme with improved harmony and contrast`,
      priority: 'high',
      impact: this.scoreToImpact(analysis.colors.score),
      changes: {
        colors: enhancement
      }
    }
  }

  private async generateAccessibilityStrategy(
    analysis: DocumentAnalysis
  ): Promise<EnhancementStrategy> {
    const currentPalette = analysis.colors.palette
    const accessiblePalette = this.makeAccessible(currentPalette)

    const enhancement: ColorEnhancement = {
      palette: {
        primary: accessiblePalette[0],
        secondary: accessiblePalette.slice(1, 3),
        accent: accessiblePalette[3] || accessiblePalette[0],
        background: this.ensureContrast('#FFFFFF', accessiblePalette[0]),
        text: this.ensureContrast('#000000', '#FFFFFF')
      },
      adjustments: {
        contrast: 1.5, // Increase contrast
        saturation: 0.9, // Slightly reduce saturation for better readability
        brightness: 1.1 // Slightly increase brightness
      },
      replacements: new Map()
    }

    return {
      id: this.generateStrategyId(),
      name: 'Improve Color Accessibility',
      description: 'Enhance color contrast to meet WCAG AA standards',
      priority: 'high',
      impact: 90, // High impact for accessibility
      changes: {
        colors: enhancement
      }
    }
  }

  private detectBestColorScheme(analysis: DocumentAnalysis): EnhancementPreferences['colorScheme'] {
    // Analyze current palette to determine best scheme
    const colorCount = analysis.colors.palette.length
    
    if (colorCount <= 2) return 'monochrome'
    if (colorCount <= 3) return 'complementary'
    if (colorCount <= 5) return 'analogous'
    return 'vibrant'
  }

  private optimizePalette(
    currentPalette: string[],
    scheme: EnhancementPreferences['colorScheme']
  ): {
    primary: string
    secondary: string[]
    accent: string
    background: string
    text: string
  } {
    const primary = currentPalette[0] || '#2563EB' // Default blue
    
    switch (scheme) {
      case 'monochrome':
        return this.generateMonochromePalette(primary)
      case 'complementary':
        return this.generateComplementaryPalette(primary)
      case 'analogous':
        return this.generateAnalogousPalette(primary)
      case 'vibrant':
        return this.generateVibrantPalette(primary)
      default:
        return this.generateMutedPalette(primary)
    }
  }

  private generateMonochromePalette(baseColor: string) {
    const hsl = this.hexToHSL(baseColor)
    return {
      primary: baseColor,
      secondary: [
        this.hslToHex({ ...hsl, l: Math.min(90, hsl.l + 30) }),
        this.hslToHex({ ...hsl, l: Math.max(20, hsl.l - 20) })
      ],
      accent: this.hslToHex({ ...hsl, s: Math.min(100, hsl.s + 20) }),
      background: '#FFFFFF',
      text: '#1F2937'
    }
  }

  private generateComplementaryPalette(baseColor: string) {
    const hsl = this.hexToHSL(baseColor)
    const complementary = { ...hsl, h: (hsl.h + 180) % 360 }
    
    return {
      primary: baseColor,
      secondary: [
        this.hslToHex(complementary),
        this.hslToHex({ ...hsl, l: Math.min(80, hsl.l + 20) })
      ],
      accent: this.hslToHex({ ...complementary, s: Math.min(100, complementary.s + 10) }),
      background: '#FAFAFA',
      text: '#111827'
    }
  }

  private generateAnalogousPalette(baseColor: string) {
    const hsl = this.hexToHSL(baseColor)
    
    return {
      primary: baseColor,
      secondary: [
        this.hslToHex({ ...hsl, h: (hsl.h + 30) % 360 }),
        this.hslToHex({ ...hsl, h: (hsl.h - 30 + 360) % 360 })
      ],
      accent: this.hslToHex({ ...hsl, h: (hsl.h + 60) % 360, s: Math.min(100, hsl.s + 10) }),
      background: '#FFFFFF',
      text: '#1F2937'
    }
  }

  private generateVibrantPalette(baseColor: string) {
    const hsl = this.hexToHSL(baseColor)
    
    return {
      primary: this.hslToHex({ ...hsl, s: Math.min(100, hsl.s + 20) }),
      secondary: [
        this.hslToHex({ ...hsl, h: (hsl.h + 120) % 360, s: 80 }),
        this.hslToHex({ ...hsl, h: (hsl.h + 240) % 360, s: 80 })
      ],
      accent: this.hslToHex({ ...hsl, h: (hsl.h + 45) % 360, s: 90, l: 50 }),
      background: '#FFFFFF',
      text: '#111827'
    }
  }

  private generateMutedPalette(baseColor: string) {
    const hsl = this.hexToHSL(baseColor)
    
    return {
      primary: this.hslToHex({ ...hsl, s: Math.max(20, hsl.s - 30) }),
      secondary: [
        this.hslToHex({ ...hsl, s: 20, l: 70 }),
        this.hslToHex({ ...hsl, s: 15, l: 50 })
      ],
      accent: this.hslToHex({ ...hsl, s: 40 }),
      background: '#F9FAFB',
      text: '#374151'
    }
  }

  private calculateContrastAdjustment(analysis: DocumentAnalysis): number {
    const currentScore = analysis.colors.score
    if (currentScore < 50) return 1.5
    if (currentScore < 70) return 1.2
    return 1.0
  }

  private calculateSaturationAdjustment(
    analysis: DocumentAnalysis,
    scheme: EnhancementPreferences['colorScheme']
  ): number {
    switch (scheme) {
      case 'vibrant': return 1.2
      case 'muted': return 0.7
      case 'monochrome': return 0.5
      default: return 1.0
    }
  }

  private calculateBrightnessAdjustment(analysis: DocumentAnalysis): number {
    // Adjust brightness based on current issues
    if (analysis.colors.issues.includes('Too dark')) return 1.2
    if (analysis.colors.issues.includes('Too bright')) return 0.8
    return 1.0
  }

  private generateColorReplacements(
    currentPalette: string[],
    optimizedPalette: {
      primary: string
      secondary: string[]
      accent: string
      background: string
      text: string
    }
  ): Map<string, string> {
    const replacements = new Map<string, string>()
    
    // Map current colors to optimized colors
    if (currentPalette[0]) replacements.set(currentPalette[0], optimizedPalette.primary)
    if (currentPalette[1]) replacements.set(currentPalette[1], optimizedPalette.secondary[0])
    if (currentPalette[2]) replacements.set(currentPalette[2], optimizedPalette.secondary[1])
    if (currentPalette[3]) replacements.set(currentPalette[3], optimizedPalette.accent)
    
    return replacements
  }

  private ensureContrast(color1: string, color2: string, minRatio: number = 4.5): string {
    const ratio = this.getContrastRatio(color1, color2)
    if (ratio >= minRatio) return color1
    
    // Adjust color1 to meet contrast requirement
    const hsl1 = this.hexToHSL(color1)
    const luminance2 = this.getLuminance(color2)
    
    // Adjust lightness to meet contrast
    if (luminance2 > 0.5) {
      // Dark text on light background
      hsl1.l = Math.max(0, hsl1.l - 10)
    } else {
      // Light text on dark background
      hsl1.l = Math.min(100, hsl1.l + 10)
    }
    
    return this.hslToHex(hsl1)
  }

  // Color utility functions
  private hexToHSL(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    
    if (max === min) return { h: 0, s: 0, l: l * 100 }
    
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    let h = 0
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  private hslToHex(hsl: { h: number; s: number; l: number }): string {
    const h = hsl.h / 360
    const s = hsl.s / 100
    const l = hsl.l / 100
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255)
    const g = Math.round(hue2rgb(p, q, h) * 255)
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255)
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  private getLuminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255
    
    const srgb = [r, g, b].map(val => {
      if (val <= 0.03928) return val / 12.92
      return Math.pow((val + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
  }

  private getContrastRatio(hex1: string, hex2: string): number {
    const l1 = this.getLuminance(hex1)
    const l2 = this.getLuminance(hex2)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }
}