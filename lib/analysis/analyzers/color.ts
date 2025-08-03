import { DocumentContext, ColorMetrics } from '../types'

interface RGB {
  r: number
  g: number
  b: number
}

interface HSL {
  h: number
  s: number
  l: number
}

export class ColorAnalyzer {
  private readonly COLOR_THRESHOLD = 10 // Minimum occurrences to consider a color
  private readonly CONTRAST_RATIO_AA = 4.5
  private readonly CONTRAST_RATIO_AAA = 7
  
  async analyze(context: DocumentContext): Promise<ColorMetrics> {
    const { imageData } = context
    
    if (!imageData) {
      throw new Error('Image data is required for color analysis')
    }

    const colors = this.extractColors(imageData)
    const palette = this.buildPalette(colors)
    const harmony = this.analyzeHarmony(palette)
    const contrast = this.analyzeContrast(colors)
    const accessibility = this.checkAccessibility(colors)

    return {
      palette,
      harmony,
      contrast,
      accessibility
    }
  }

  private extractColors(imageData: ImageData): Map<string, number> {
    const { data, width, height } = imageData
    const colorMap = new Map<string, number>()
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      
      // Skip transparent pixels
      if (a < 128) continue
      
      // Quantize colors to reduce noise
      const qr = Math.round(r / 5) * 5
      const qg = Math.round(g / 5) * 5
      const qb = Math.round(b / 5) * 5
      
      const key = `${qr},${qg},${qb}`
      colorMap.set(key, (colorMap.get(key) || 0) + 1)
    }
    
    // Filter out colors with low occurrence
    const significantColors = new Map<string, number>()
    const totalPixels = (width * height) / 4 // Since we sample every 4th pixel
    
    for (const [color, count] of colorMap.entries()) {
      const percentage = (count / totalPixels) * 100
      if (percentage > 0.1) { // At least 0.1% of the image
        significantColors.set(color, count)
      }
    }
    
    return significantColors
  }

  private buildPalette(colors: Map<string, number>): ColorMetrics['palette'] {
    // Sort colors by frequency
    const sortedColors = Array.from(colors.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color)
    
    // Convert to hex format
    const hexColors = sortedColors.map(color => {
      const [r, g, b] = color.split(',').map(Number)
      return this.rgbToHex({ r, g, b })
    })
    
    // Categorize colors
    const categorizedColors = hexColors.map(hex => ({
      hex,
      hsl: this.hexToHSL(hex),
      rgb: this.hexToRGB(hex)
    }))
    
    // Group by color characteristics
    const primary: string[] = []
    const secondary: string[] = []
    const accent: string[] = []
    
    categorizedColors.forEach((color, index) => {
      if (index < 3) {
        primary.push(color.hex)
      } else if (index < 6) {
        secondary.push(color.hex)
      } else if (color.hsl.s > 50) { // High saturation colors as accents
        accent.push(color.hex)
      }
    })
    
    return {
      primary: primary.slice(0, 3),
      secondary: secondary.slice(0, 3),
      accent: accent.slice(0, 2)
    }
  }

  private analyzeHarmony(palette: ColorMetrics['palette']): ColorMetrics['harmony'] {
    const allColors = [...palette.primary, ...palette.secondary, ...palette.accent]
      .map(hex => this.hexToHSL(hex))
    
    if (allColors.length < 2) {
      return { type: 'monochromatic', score: 100 }
    }
    
    // Analyze hue relationships
    const hues = allColors.map(c => c.h)
    const hueRange = Math.max(...hues) - Math.min(...hues)
    
    let type: ColorMetrics['harmony']['type']
    let score = 0
    
    if (hueRange < 30) {
      type = 'monochromatic'
      score = 100 - hueRange // Tighter range = better score
    } else if (hueRange < 90) {
      type = 'analogous'
      score = 100 - (hueRange - 30) * 0.5
    } else if (this.isComplementary(hues)) {
      type = 'complementary'
      score = this.calculateComplementaryScore(hues)
    } else if (this.isTriadic(hues)) {
      type = 'triadic'
      score = this.calculateTriadicScore(hues)
    } else {
      type = 'custom'
      score = this.calculateCustomHarmonyScore(allColors)
    }
    
    return { type, score }
  }

  private analyzeContrast(colors: Map<string, number>): ColorMetrics['contrast'] {
    const colorArray = Array.from(colors.keys()).map(color => {
      const [r, g, b] = color.split(',').map(Number)
      return { r, g, b }
    })
    
    if (colorArray.length < 2) {
      return { wcagAAA: false, wcagAA: false, score: 0 }
    }
    
    // Find the most common background and foreground colors
    const sortedColors = Array.from(colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Top 10 colors
    
    let maxContrast = 0
    let meetsAA = false
    let meetsAAA = false
    
    // Check contrast between color pairs
    for (let i = 0; i < sortedColors.length; i++) {
      for (let j = i + 1; j < sortedColors.length; j++) {
        
        const contrast = this.calculateContrastRatio(
          this.parseColorString(sortedColors[i][0]),
          this.parseColorString(sortedColors[j][0])
        )
        
        maxContrast = Math.max(maxContrast, contrast)
        
        if (contrast >= this.CONTRAST_RATIO_AA) meetsAA = true
        if (contrast >= this.CONTRAST_RATIO_AAA) meetsAAA = true
      }
    }
    
    const score = Math.min(100, (maxContrast / 21) * 100) // 21 is max contrast ratio
    
    return {
      wcagAAA: meetsAAA,
      wcagAA: meetsAA,
      score
    }
  }

  private checkAccessibility(colors: Map<string, number>): ColorMetrics['accessibility'] {
    const colorArray = Array.from(colors.keys()).map(color => this.parseColorString(color))
    const issues: string[] = []
    
    // Check for color blind problematic combinations
    const hasProblematicReds = this.hasProblematicColorBlindCombos(colorArray, 'protanopia')
    const hasProblematicGreens = this.hasProblematicColorBlindCombos(colorArray, 'deuteranopia')
    const hasProblematicBlues = this.hasProblematicColorBlindCombos(colorArray, 'tritanopia')
    
    if (hasProblematicReds) {
      issues.push('Red-green color blind users may have difficulty')
    }
    if (hasProblematicGreens) {
      issues.push('Green color blind users may have difficulty')
    }
    if (hasProblematicBlues) {
      issues.push('Blue-yellow color blind users may have difficulty')
    }
    
    // Check for low saturation issues
    const lowSaturationColors = colorArray.filter(rgb => {
      const hsl = this.rgbToHSL(rgb)
      return hsl.s < 20 && hsl.l > 20 && hsl.l < 80
    })
    
    if (lowSaturationColors.length > colorArray.length * 0.5) {
      issues.push('Many low saturation colors may reduce visual hierarchy')
    }
    
    return {
      colorBlindSafe: issues.length === 0,
      issues
    }
  }

  private rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
  }

  private hexToRGB(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  private rgbToHSL(rgb: RGB): HSL {
    const r = rgb.r / 255
    const g = rgb.g / 255
    const b = rgb.b / 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0
    const l = (max + min) / 2
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    }
  }

  private hexToHSL(hex: string): HSL {
    return this.rgbToHSL(this.hexToRGB(hex))
  }

  private parseColorString(colorStr: string): RGB {
    const [r, g, b] = colorStr.split(',').map(Number)
    return { r, g, b }
  }

  private calculateContrastRatio(color1: RGB, color2: RGB): number {
    const lum1 = this.calculateRelativeLuminance(color1)
    const lum2 = this.calculateRelativeLuminance(color2)
    
    const lighter = Math.max(lum1, lum2)
    const darker = Math.min(lum1, lum2)
    
    return (lighter + 0.05) / (darker + 0.05)
  }

  private calculateRelativeLuminance(rgb: RGB): number {
    const sRGB = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })
    
    return sRGB[0] * 0.2126 + sRGB[1] * 0.7152 + sRGB[2] * 0.0722
  }

  private isComplementary(hues: number[]): boolean {
    if (hues.length < 2) return false
    
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = Math.abs(hues[i] - hues[j])
        if (Math.abs(diff - 180) < 30) return true
      }
    }
    
    return false
  }

  private isTriadic(hues: number[]): boolean {
    if (hues.length < 3) return false
    
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        for (let k = j + 1; k < hues.length; k++) {
          const diffs = [
            Math.abs(hues[i] - hues[j]),
            Math.abs(hues[j] - hues[k]),
            Math.abs(hues[k] - hues[i])
          ].map(d => Math.min(d, 360 - d))
          
          const avgDiff = diffs.reduce((a, b) => a + b) / 3
          if (Math.abs(avgDiff - 120) < 30) return true
        }
      }
    }
    
    return false
  }

  private calculateComplementaryScore(hues: number[]): number {
    let bestScore = 0
    
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const diff = Math.abs(hues[i] - hues[j])
        const complementaryDiff = Math.abs(diff - 180)
        const score = Math.max(0, 100 - complementaryDiff * 2)
        bestScore = Math.max(bestScore, score)
      }
    }
    
    return bestScore
  }

  private calculateTriadicScore(hues: number[]): number {
    let bestScore = 0
    
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        for (let k = j + 1; k < hues.length; k++) {
          const diffs = [
            Math.abs(hues[i] - hues[j]),
            Math.abs(hues[j] - hues[k]),
            Math.abs(hues[k] - hues[i])
          ].map(d => Math.min(d, 360 - d))
          
          const avgDiff = diffs.reduce((a, b) => a + b) / 3
          const triadicDiff = Math.abs(avgDiff - 120)
          const score = Math.max(0, 100 - triadicDiff * 2)
          bestScore = Math.max(bestScore, score)
        }
      }
    }
    
    return bestScore
  }

  private calculateCustomHarmonyScore(colors: HSL[]): number {
    // Calculate based on saturation and lightness consistency
    const saturations = colors.map(c => c.s)
    const lightnesses = colors.map(c => c.l)
    
    const avgSat = saturations.reduce((a, b) => a + b) / saturations.length
    const avgLight = lightnesses.reduce((a, b) => a + b) / lightnesses.length
    
    const satVariance = saturations.reduce((sum, s) => sum + Math.pow(s - avgSat, 2), 0) / saturations.length
    const lightVariance = lightnesses.reduce((sum, l) => sum + Math.pow(l - avgLight, 2), 0) / lightnesses.length
    
    const satConsistency = Math.max(0, 100 - Math.sqrt(satVariance))
    const lightConsistency = Math.max(0, 100 - Math.sqrt(lightVariance))
    
    return (satConsistency + lightConsistency) / 2
  }

  private hasProblematicColorBlindCombos(colors: RGB[], type: 'protanopia' | 'deuteranopia' | 'tritanopia'): boolean {
    // Simplified check for problematic color combinations
    const simulatedColors = colors.map(color => this.simulateColorBlindness(color, type))
    
    // Check if colors that were different become too similar
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const originalDiff = this.colorDistance(colors[i], colors[j])
        const simulatedDiff = this.colorDistance(simulatedColors[i], simulatedColors[j])
        
        if (originalDiff > 50 && simulatedDiff < 20) {
          return true
        }
      }
    }
    
    return false
  }

  private simulateColorBlindness(color: RGB, type: 'protanopia' | 'deuteranopia' | 'tritanopia'): RGB {
    // Simplified color blindness simulation
    switch (type) {
      case 'protanopia': // Red blind
        return {
          r: 0.567 * color.r + 0.433 * color.g,
          g: 0.558 * color.r + 0.442 * color.g,
          b: color.b
        }
      case 'deuteranopia': // Green blind
        return {
          r: 0.625 * color.r + 0.375 * color.g,
          g: 0.7 * color.r + 0.3 * color.g,
          b: color.b
        }
      case 'tritanopia': // Blue blind
        return {
          r: 0.95 * color.r + 0.05 * color.b,
          g: color.g,
          b: 0.433 * color.g + 0.567 * color.b
        }
    }
  }

  private colorDistance(c1: RGB, c2: RGB): number {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    )
  }
}