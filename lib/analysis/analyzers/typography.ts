import { DocumentContext, TypographyMetrics } from '../types'

interface TextBlock {
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  lineHeight: number
  characterDensity: number
}

export class TypographyAnalyzer {
  private readonly MIN_TEXT_BLOCK_SIZE = 10
  private readonly TEXT_CONTRAST_THRESHOLD = 0.3
  
  async analyze(context: DocumentContext): Promise<TypographyMetrics> {
    const { imageData } = context
    
    if (!imageData) {
      throw new Error('Image data is required for typography analysis')
    }

    // Note: In a production environment, we would use OCR (like Tesseract.js)
    // to extract actual text and font information. For now, we'll analyze
    // visual characteristics that indicate typography quality.
    
    const textBlocks = this.detectTextBlocks(imageData)
    const fonts = this.estimateFontMetrics(textBlocks)
    const hierarchy = this.analyzeHierarchy(textBlocks)
    const readability = this.calculateReadability(textBlocks, imageData)
    const consistency = this.analyzeConsistency(textBlocks)

    return {
      fonts,
      hierarchy,
      readability,
      consistency
    }
  }

  private detectTextBlocks(imageData: ImageData): TextBlock[] {
    const { width, height } = imageData
    const blocks: TextBlock[] = []
    
    // Edge detection to find text regions
    const edges = this.detectEdges(imageData)
    const regions = this.findTextRegions(edges, width, height)
    
    // Analyze each region
    for (const region of regions) {
      const metrics = this.analyzeTextRegion(region, imageData)
      if (metrics) {
        blocks.push(metrics)
      }
    }
    
    return blocks
  }

  private detectEdges(imageData: ImageData): Uint8ClampedArray {
    const { data, width, height } = imageData
    const edges = new Uint8ClampedArray(width * height)
    
    // Simplified Sobel edge detection
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x
        
        // Get surrounding pixels
        const pixels = []
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const pidx = ((y + dy) * width + (x + dx)) * 4
            const gray = (data[pidx] + data[pidx + 1] + data[pidx + 2]) / 3
            pixels.push(gray)
          }
        }
        
        // Sobel X kernel: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]
        const gx = -pixels[0] + pixels[2] - 2 * pixels[3] + 2 * pixels[5] - pixels[6] + pixels[8]
        
        // Sobel Y kernel: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]]
        const gy = -pixels[0] - 2 * pixels[1] - pixels[2] + pixels[6] + 2 * pixels[7] + pixels[8]
        
        // Magnitude
        const magnitude = Math.sqrt(gx * gx + gy * gy)
        edges[idx] = magnitude > 30 ? 255 : 0
      }
    }
    
    return edges
  }

  private findTextRegions(edges: Uint8ClampedArray, width: number, height: number): Array<{x: number, y: number, width: number, height: number}> {
    const regions: Array<{x: number, y: number, width: number, height: number}> = []
    const visited = new Set<number>()
    
    // Find connected components
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        
        if (edges[idx] === 255 && !visited.has(idx)) {
          const region = this.floodFill(edges, x, y, width, height, visited)
          
          // Filter regions by size and aspect ratio (likely text)
          if (region.width > this.MIN_TEXT_BLOCK_SIZE && 
              region.height > this.MIN_TEXT_BLOCK_SIZE &&
              region.width / region.height > 0.5 && 
              region.width / region.height < 20) {
            regions.push(region)
          }
        }
      }
    }
    
    return regions
  }

  private floodFill(
    edges: Uint8ClampedArray, 
    startX: number, 
    startY: number, 
    width: number, 
    height: number,
    visited: Set<number>
  ): {x: number, y: number, width: number, height: number} {
    const queue = [[startX, startY]]
    let minX = startX, maxX = startX
    let minY = startY, maxY = startY
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!
      const idx = y * width + x
      
      if (visited.has(idx)) continue
      visited.add(idx)
      
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      
      // Check neighbors
      const neighbors = [
        [x + 1, y], [x - 1, y],
        [x, y + 1], [x, y - 1]
      ]
      
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx
          if (edges[nidx] === 255 && !visited.has(nidx)) {
            queue.push([nx, ny])
          }
        }
      }
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }
  }

  private analyzeTextRegion(
    region: {x: number, y: number, width: number, height: number},
    imageData: ImageData
  ): TextBlock | null {
    const { data, width } = imageData
    
    // Estimate font size based on region height
    const fontSize = this.estimateFontSize(region.height)
    
    // Calculate line height by analyzing horizontal projections
    const lineHeight = this.estimateLineHeight(region, data, width)
    
    // Calculate character density
    const characterDensity = this.calculateCharacterDensity(region, data, width)
    
    return {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      fontSize,
      lineHeight,
      characterDensity
    }
  }

  private estimateFontSize(blockHeight: number): number {
    // Rough estimation: typical line height is 1.2-1.5x font size
    // Block height likely contains multiple lines
    const estimatedLines = Math.max(1, Math.round(blockHeight / 20))
    return Math.round(blockHeight / estimatedLines / 1.3)
  }

  private estimateLineHeight(
    region: {x: number, y: number, width: number, height: number},
    data: Uint8ClampedArray,
    imageWidth: number
  ): number {
    // Horizontal projection to find text lines
    const projection = new Array(region.height).fill(0)
    
    for (let y = 0; y < region.height; y++) {
      for (let x = 0; x < region.width; x++) {
        const idx = ((region.y + y) * imageWidth + (region.x + x)) * 4
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        if (gray < 128) { // Dark pixel (potential text)
          projection[y]++
        }
      }
    }
    
    // Find gaps between lines
    const gaps: number[] = []
    let inGap = false
    let gapStart = 0
    
    for (let y = 0; y < projection.length; y++) {
      if (projection[y] < region.width * 0.1) { // Less than 10% filled
        if (!inGap) {
          inGap = true
          gapStart = y
        }
      } else {
        if (inGap) {
          gaps.push(y - gapStart)
          inGap = false
        }
      }
    }
    
    // Average gap size indicates line spacing
    if (gaps.length > 0) {
      const avgGap = gaps.reduce((a, b) => a + b) / gaps.length
      return avgGap + this.estimateFontSize(region.height)
    }
    
    return this.estimateFontSize(region.height) * 1.5
  }

  private calculateCharacterDensity(
    region: {x: number, y: number, width: number, height: number},
    data: Uint8ClampedArray,
    imageWidth: number
  ): number {
    let darkPixels = 0
    const totalPixels = region.width * region.height
    
    for (let y = 0; y < region.height; y++) {
      for (let x = 0; x < region.width; x++) {
        const idx = ((region.y + y) * imageWidth + (region.x + x)) * 4
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        if (gray < 128) {
          darkPixels++
        }
      }
    }
    
    return (darkPixels / totalPixels) * 100
  }

  private estimateFontMetrics(textBlocks: TextBlock[]): TypographyMetrics['fonts'] {
    if (textBlocks.length === 0) {
      return { families: [], sizes: [], weights: [] }
    }
    
    // Group by similar font sizes
    const sizes = textBlocks.map(block => block.fontSize)
    const uniqueSizes = [...new Set(sizes)].sort((a, b) => b - a)
    
    // Estimate weights based on character density
    const weights = textBlocks.map(block => {
      if (block.characterDensity > 20) return 700 // Bold
      if (block.characterDensity > 15) return 500 // Medium
      return 400 // Regular
    })
    const uniqueWeights = [...new Set(weights)].sort()
    
    // Without OCR, we can't determine actual font families
    // In production, we would use OCR to extract this information
    const families = ['Sans-serif'] // Placeholder
    
    return {
      families,
      sizes: uniqueSizes.slice(0, 5), // Top 5 sizes
      weights: uniqueWeights
    }
  }

  private analyzeHierarchy(textBlocks: TextBlock[]): TypographyMetrics['hierarchy'] {
    if (textBlocks.length === 0) {
      return { levels: 0, consistency: 0 }
    }
    
    // Group blocks by font size
    const sizeGroups = new Map<number, TextBlock[]>()
    textBlocks.forEach(block => {
      const size = Math.round(block.fontSize / 2) * 2 // Round to nearest even number
      if (!sizeGroups.has(size)) {
        sizeGroups.set(size, [])
      }
      sizeGroups.get(size)!.push(block)
    })
    
    const levels = sizeGroups.size
    
    // Calculate consistency based on clear size differences
    const sizes = Array.from(sizeGroups.keys()).sort((a, b) => b - a)
    let consistency = 100
    
    if (sizes.length > 1) {
      const ratios: number[] = []
      for (let i = 1; i < sizes.length; i++) {
        ratios.push(sizes[i - 1] / sizes[i])
      }
      
      // Good hierarchy has ratios between 1.2 and 2.0
      const goodRatios = ratios.filter(r => r >= 1.2 && r <= 2.0).length
      consistency = (goodRatios / ratios.length) * 100
    }
    
    return { levels: Math.min(levels, 6), consistency }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private calculateReadability(textBlocks: TextBlock[], _: ImageData): TypographyMetrics['readability'] {
    if (textBlocks.length === 0) {
      return {
        fleschKincaid: 0,
        lineHeight: 0,
        characterSpacing: 0,
        score: 0
      }
    }
    
    // Calculate average line height ratio
    const lineHeightRatios = textBlocks.map(block => block.lineHeight / block.fontSize)
    const avgLineHeightRatio = lineHeightRatios.reduce((a, b) => a + b) / lineHeightRatios.length
    
    // Optimal line height ratio is 1.4-1.6
    const lineHeightScore = this.scoreInRange(avgLineHeightRatio, 1.4, 1.6, 1.2, 2.0)
    
    // Estimate character spacing based on density
    const avgDensity = textBlocks.map(b => b.characterDensity).reduce((a, b) => a + b) / textBlocks.length
    const spacingScore = this.scoreInRange(avgDensity, 12, 18, 5, 30)
    
    // Without actual text content, we can't calculate true Flesch-Kincaid
    // Using visual complexity as a proxy
    const complexityScore = this.calculateVisualComplexity(textBlocks)
    const fleschKincaid = 100 - complexityScore // Inverse relationship
    
    const overallScore = (lineHeightScore + spacingScore + fleschKincaid) / 3
    
    return {
      fleschKincaid,
      lineHeight: avgLineHeightRatio,
      characterSpacing: 100 - avgDensity, // Inverse of density
      score: overallScore
    }
  }

  private analyzeConsistency(textBlocks: TextBlock[]): TypographyMetrics['consistency'] {
    if (textBlocks.length < 2) {
      return { fontPairing: 100, sizeRatio: 100 }
    }
    
    // Font pairing consistency (based on size groupings)
    const sizeGroups = new Map<number, number>()
    textBlocks.forEach(block => {
      const size = Math.round(block.fontSize / 2) * 2
      sizeGroups.set(size, (sizeGroups.get(size) || 0) + 1)
    })
    
    // Good typography typically uses 2-3 font sizes
    const fontPairing = this.scoreInRange(sizeGroups.size, 2, 3, 1, 6) 
    
    // Size ratio consistency
    const sizes = Array.from(sizeGroups.keys()).sort((a, b) => b - a)
    const ratios: number[] = []
    
    for (let i = 1; i < sizes.length; i++) {
      ratios.push(sizes[i - 1] / sizes[i])
    }
    
    // Check if ratios follow a pattern (e.g., golden ratio, major third)
    const sizeRatio = this.evaluateSizeRatioPattern(ratios)
    
    return { fontPairing, sizeRatio }
  }

  private scoreInRange(value: number, optMin: number, optMax: number, min: number, max: number): number {
    if (value >= optMin && value <= optMax) {
      return 100
    }
    
    if (value < optMin) {
      const distance = optMin - value
      const range = optMin - min
      return Math.max(0, 100 - (distance / range) * 100)
    }
    
    const distance = value - optMax
    const range = max - optMax
    return Math.max(0, 100 - (distance / range) * 100)
  }

  private calculateVisualComplexity(textBlocks: TextBlock[]): number {
    // More text blocks and varying sizes = higher complexity
    const blockCount = Math.min(textBlocks.length / 10, 1) * 50
    
    const sizes = textBlocks.map(b => b.fontSize)
    const sizeVariance = this.calculateVariance(sizes)
    const sizeComplexity = Math.min(sizeVariance / 10, 1) * 50
    
    return blockCount + sizeComplexity
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0
    
    const mean = values.reduce((a, b) => a + b) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    
    return Math.sqrt(variance)
  }

  private evaluateSizeRatioPattern(ratios: number[]): number {
    if (ratios.length === 0) return 100
    
    // Common typographic scales
    const scales = {
      goldenRatio: 1.618,
      majorThird: 1.25,
      perfectFourth: 1.333,
      augmentedFourth: 1.414,
      majorSecond: 1.125
    }
    
    let bestScore = 0
    
    for (const [, scale] of Object.entries(scales)) {
      const scaleScore = ratios.reduce((score, ratio) => {
        const diff = Math.abs(ratio - scale)
        return score + Math.max(0, 100 - diff * 100)
      }, 0) / ratios.length
      
      bestScore = Math.max(bestScore, scaleScore)
    }
    
    return bestScore
  }
}