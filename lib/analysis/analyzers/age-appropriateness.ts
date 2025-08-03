import { DocumentContext, AgeAppropriateness } from '../types'

export class AgeAppropriatenessAnalyzer {
  async analyze(context: DocumentContext): Promise<AgeAppropriateness> {
    const { imageData, userPreferences } = context
    
    if (!imageData) {
      throw new Error('Image data is required for age appropriateness analysis')
    }

    const complexity = this.analyzeComplexity(imageData)
    const visualStyle = this.analyzeVisualStyle(imageData)
    const contentMaturity = this.analyzeContentMaturity(imageData, context)
    
    const detectedAge = this.determineTargetAge(complexity, visualStyle, contentMaturity, userPreferences?.targetAudience)
    const confidence = this.calculateConfidence(complexity, visualStyle, contentMaturity)

    return {
      detectedAge,
      confidence,
      factors: {
        complexity,
        visualStyle,
        contentMaturity
      }
    }
  }

  private analyzeComplexity(imageData: ImageData): number {
    const { data } = imageData
    
    // Analyze visual complexity through various metrics
    const colorVariety = this.calculateColorVariety(data)
    const edgeDensity = this.calculateEdgeDensity(imageData)
    const spatialFrequency = this.calculateSpatialFrequency(imageData)
    const elementCount = this.estimateElementCount(imageData)
    
    // Combine metrics with weights
    const complexity = (
      colorVariety * 0.2 +
      edgeDensity * 0.3 +
      spatialFrequency * 0.3 +
      elementCount * 0.2
    )
    
    return Math.min(100, complexity)
  }

  private analyzeVisualStyle(imageData: ImageData): number {
    const { data } = imageData
    
    // Extract style characteristics
    const saturation = this.calculateAverageSaturation(data)
    const brightness = this.calculateAverageBrightness(data)
    const roundedness = this.detectRoundedShapes(imageData)
    const whimsicalElements = this.detectWhimsicalElements(imageData)
    
    // Higher saturation, brightness, roundedness = more child-friendly
    // Scale: 0 = very adult, 100 = very child-friendly
    const childFriendliness = (
      saturation * 0.3 +
      brightness * 0.2 +
      roundedness * 0.3 +
      whimsicalElements * 0.2
    )
    
    // Invert for adult score (0-100 where 100 is most adult-oriented)
    return 100 - childFriendliness
  }

  private analyzeContentMaturity(imageData: ImageData, context: DocumentContext): number {
    // Analyze content sophistication
    const textDensity = this.estimateTextDensity(imageData)
    const formalElements = this.detectFormalElements(imageData)
    const professionalIndicators = this.detectProfessionalIndicators(context)
    
    // Higher text density and formal elements = more mature content
    const maturity = (
      textDensity * 0.4 +
      formalElements * 0.3 +
      professionalIndicators * 0.3
    )
    
    return Math.min(100, maturity)
  }

  private calculateColorVariety(data: Uint8ClampedArray): number {
    const colorSet = new Set<string>()
    
    // Sample colors
    for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
      const r = Math.round(data[i] / 10) * 10
      const g = Math.round(data[i + 1] / 10) * 10
      const b = Math.round(data[i + 2] / 10) * 10
      colorSet.add(`${r},${g},${b}`)
    }
    
    // More colors = higher variety, capped at 100
    return Math.min(100, colorSet.size / 10)
  }

  private calculateEdgeDensity(imageData: ImageData): number {
    const { data, width, height } = imageData
    let edges = 0
    
    // Simplified edge detection
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        const idx = (y * width + x) * 4
        const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        
        // Check neighbors
        const neighbors = [
          [(y - 1) * width + x, (y + 1) * width + x], // vertical
          [y * width + (x - 1), y * width + (x + 1)]  // horizontal
        ]
        
        for (const [n1, n2] of neighbors) {
          const gray1 = (data[n1 * 4] + data[n1 * 4 + 1] + data[n1 * 4 + 2]) / 3
          const gray2 = (data[n2 * 4] + data[n2 * 4 + 1] + data[n2 * 4 + 2]) / 3
          
          if (Math.abs(gray1 - center) > 30 || Math.abs(gray2 - center) > 30) {
            edges++
          }
        }
      }
    }
    
    const totalChecked = (width / 2) * (height / 2)
    return Math.min(100, (edges / totalChecked) * 100)
  }

  private calculateSpatialFrequency(imageData: ImageData): number {
    const { data, width, height } = imageData
    let changes = 0
    
    // Horizontal frequency
    for (let y = 0; y < height; y += 4) {
      for (let x = 1; x < width; x++) {
        const idx1 = (y * width + x - 1) * 4
        const idx2 = (y * width + x) * 4
        
        const diff = Math.abs(data[idx1] - data[idx2]) +
                     Math.abs(data[idx1 + 1] - data[idx2 + 1]) +
                     Math.abs(data[idx1 + 2] - data[idx2 + 2])
        
        if (diff > 50) changes++
      }
    }
    
    // Vertical frequency
    for (let x = 0; x < width; x += 4) {
      for (let y = 1; y < height; y++) {
        const idx1 = ((y - 1) * width + x) * 4
        const idx2 = (y * width + x) * 4
        
        const diff = Math.abs(data[idx1] - data[idx2]) +
                     Math.abs(data[idx1 + 1] - data[idx2 + 1]) +
                     Math.abs(data[idx1 + 2] - data[idx2 + 2])
        
        if (diff > 50) changes++
      }
    }
    
    const totalChecked = (width * height / 16) * 2
    return Math.min(100, (changes / totalChecked) * 200)
  }

  private estimateElementCount(imageData: ImageData): number {
    // Simplified element detection based on connected components
    const { width, height } = imageData
    const visited = new Set<string>()
    let elementCount = 0
    
    // Downsample for performance
    const step = 10
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const key = `${x},${y}`
        if (!visited.has(key) && this.isSignificantPixel(imageData, x, y)) {
          // Found new element
          elementCount++
          this.markConnectedRegion(imageData, x, y, visited, step)
        }
      }
    }
    
    // Normalize to 0-100 scale
    return Math.min(100, elementCount * 2)
  }

  private calculateAverageSaturation(data: Uint8ClampedArray): number {
    let totalSaturation = 0
    let count = 0
    
    for (let i = 0; i < data.length; i += 16) { // Sample
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      
      let s = 0
      if (max !== min) {
        s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
      }
      
      totalSaturation += s
      count++
    }
    
    return (totalSaturation / count) * 100
  }

  private calculateAverageBrightness(data: Uint8ClampedArray): number {
    let totalBrightness = 0
    let count = 0
    
    for (let i = 0; i < data.length; i += 16) { // Sample
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255
      totalBrightness += brightness
      count++
    }
    
    return (totalBrightness / count) * 100
  }

  private detectRoundedShapes(imageData: ImageData): number {
    // Simplified detection of curved vs angular shapes
    // In production, would use proper shape detection
    const edges = this.detectEdgeOrientations(imageData)
    const curvedRatio = edges.curved / (edges.curved + edges.straight)
    
    return curvedRatio * 100
  }

  private detectWhimsicalElements(imageData: ImageData): number {
    // Look for characteristics of playful design
    const brightColors = this.detectBrightColors(imageData)
    const irregularShapes = this.detectIrregularShapes(imageData)
    const patternVariety = this.detectPatternVariety(imageData)
    
    return (brightColors + irregularShapes + patternVariety) / 3
  }

  private estimateTextDensity(imageData: ImageData): number {
    // Estimate how much of the image is text
    const { data, width, height } = imageData
    let textLikePixels = 0
    
    for (let y = 1; y < height - 1; y += 2) {
      for (let x = 1; x < width - 1; x += 2) {
        if (this.isTextLikeRegion(data, x, y, width)) {
          textLikePixels++
        }
      }
    }
    
    const totalChecked = (width / 2) * (height / 2)
    return Math.min(100, (textLikePixels / totalChecked) * 100)
  }

  private detectFormalElements(imageData: ImageData): number {
    // Look for formal design elements
    const straightLines = this.detectStraightLines(imageData)
    const geometricShapes = this.detectGeometricShapes(imageData)
    const monochromaticAreas = this.detectMonochromaticAreas(imageData)
    
    return (straightLines + geometricShapes + monochromaticAreas) / 3
  }

  private detectProfessionalIndicators(context: DocumentContext): number {
    let score = 0
    
    // Document type indicators
    if (context.type === 'presentation') score += 30
    if (context.type === 'marketing') score += 20
    
    // User preference indicators
    if (context.userPreferences?.style === 'professional') score += 30
    if (context.userPreferences?.targetAudience === 'business') score += 20
    
    return Math.min(100, score)
  }

  private determineTargetAge(
    complexity: number,
    visualStyle: number,
    contentMaturity: number,
    userPreference?: string
  ): AgeAppropriateness['detectedAge'] {
    // If user specified a preference, weight it heavily
    if (userPreference) {
      switch (userPreference) {
        case 'children': return 'children'
        case 'teens': return 'teens'
        case 'adults': return 'adults'
        case 'business': return 'adults'
      }
    }
    
    // Calculate weighted score
    const score = (complexity * 0.3 + visualStyle * 0.4 + contentMaturity * 0.3)
    
    if (score < 25) return 'children'
    if (score < 50) return 'teens'
    if (score < 75) return 'adults'
    return 'all-ages'
  }

  private calculateConfidence(
    complexity: number,
    visualStyle: number,
    contentMaturity: number
  ): number {
    // Confidence is higher when all factors align
    const factors = [complexity, visualStyle, contentMaturity]
    const mean = factors.reduce((a, b) => a + b) / factors.length
    const variance = factors.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / factors.length
    const stdDev = Math.sqrt(variance)
    
    // Lower standard deviation = higher confidence
    const confidence = Math.max(0, 100 - stdDev)
    
    return confidence
  }

  // Helper methods
  private isSignificantPixel(imageData: ImageData, x: number, y: number): boolean {
    const { data, width } = imageData
    const idx = (y * width + x) * 4
    
    // Check if pixel is not white/transparent
    return data[idx + 3] > 128 && (data[idx] < 240 || data[idx + 1] < 240 || data[idx + 2] < 240)
  }

  private markConnectedRegion(
    imageData: ImageData,
    startX: number,
    startY: number,
    visited: Set<string>,
    step: number
  ): void {
    const { width, height } = imageData
    const queue = [[startX, startY]]
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!
      const key = `${x},${y}`
      
      if (visited.has(key)) continue
      visited.add(key)
      
      // Check neighbors
      const neighbors = [
        [x + step, y], [x - step, y],
        [x, y + step], [x, y - step]
      ]
      
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (this.isSignificantPixel(imageData, nx, ny)) {
            queue.push([nx, ny])
          }
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private detectEdgeOrientations(_: ImageData): {curved: number, straight: number} {
    // Simplified edge orientation detection
    // In production, would use Hough transform or similar
    return { curved: 40, straight: 60 } // Placeholder
  }

  private detectBrightColors(imageData: ImageData): number {
    const { data } = imageData
    let brightCount = 0
    let totalCount = 0
    
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      const s = max !== min ? (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)) : 0
      
      if (s > 0.5 && l > 0.4 && l < 0.8) {
        brightCount++
      }
      totalCount++
    }
    
    return (brightCount / totalCount) * 100
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private detectIrregularShapes(_: ImageData): number {
    // Placeholder - would implement shape irregularity detection
    return 30
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private detectPatternVariety(_: ImageData): number {
    // Placeholder - would implement pattern detection
    return 40
  }

  private isTextLikeRegion(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
    const idx = (y * width + x) * 4
    const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
    
    // Text is typically high contrast
    return gray < 100 || gray > 200
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private detectStraightLines(_: ImageData): number {
    // Placeholder - would use Hough line detection
    return 50
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private detectGeometricShapes(_: ImageData): number {
    // Placeholder - would implement shape detection
    return 40
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private detectMonochromaticAreas(_: ImageData): number {
    // Placeholder - would analyze color uniformity
    return 45
  }
}