import { DocumentContext, LayoutMetrics } from '../types'

export class LayoutAnalyzer {
  private readonly GRID_THRESHOLD = 0.8
  private readonly ALIGNMENT_THRESHOLD = 0.9
  
  async analyze(context: DocumentContext): Promise<LayoutMetrics> {
    const { imageData } = context
    
    if (!imageData) {
      throw new Error('Image data is required for layout analysis')
    }

    const whitespace = this.calculateWhitespace(imageData)
    const alignment = this.detectAlignment(imageData)
    const hierarchy = this.analyzeHierarchy(imageData)
    const grid = this.detectGrid(imageData)
    const margins = this.measureMargins(imageData)

    return {
      whitespace,
      alignment,
      hierarchy,
      grid,
      margins
    }
  }

  private calculateWhitespace(imageData: ImageData): number {
    const { data, width, height } = imageData
    let whitePixels = 0
    const totalPixels = width * height
    
    // Define white/light color threshold
    const whiteThreshold = 240
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      
      // Check if pixel is white/light
      if (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) {
        whitePixels++
      }
    }
    
    return (whitePixels / totalPixels) * 100
  }

  private detectAlignment(imageData: ImageData): LayoutMetrics['alignment'] {
    const { width, height } = imageData
    const contentBlocks = this.findContentBlocks(imageData)
    
    // Analyze horizontal alignment
    const horizontalCenters = contentBlocks.map(block => block.x + block.width / 2)
    const horizontalAlignment = this.determineAlignment(horizontalCenters, width)
    
    // Analyze vertical alignment  
    const verticalCenters = contentBlocks.map(block => block.y + block.height / 2)
    const verticalAlignment = this.determineVerticalAlignment(verticalCenters, height)
    
    // Calculate consistency
    const consistency = this.calculateAlignmentConsistency(contentBlocks)
    
    return {
      horizontal: horizontalAlignment,
      vertical: verticalAlignment,
      consistency
    }
  }

  private analyzeHierarchy(imageData: ImageData): LayoutMetrics['hierarchy'] {
    const contentBlocks = this.findContentBlocks(imageData)
    const blockSizes = contentBlocks.map(block => block.width * block.height)
    
    // Sort blocks by size to identify hierarchy levels
    const sortedSizes = [...blockSizes].sort((a, b) => b - a)
    const uniqueSizes = [...new Set(sortedSizes)]
    
    // Detect distinct size levels
    const levels = this.detectHierarchyLevels(uniqueSizes)
    
    // Calculate clarity based on size differences
    const clarity = this.calculateHierarchyClarity(uniqueSizes)
    
    return {
      levels,
      clarity
    }
  }

  private detectGrid(imageData: ImageData): LayoutMetrics['grid'] {
    const contentBlocks = this.findContentBlocks(imageData)
    
    if (contentBlocks.length < 4) {
      return { detected: false, consistency: 0 }
    }
    
    // Check for regular spacing patterns
    const horizontalSpacing = this.analyzeSpacing(
      contentBlocks.map(b => b.x).sort((a, b) => a - b)
    )
    const verticalSpacing = this.analyzeSpacing(
      contentBlocks.map(b => b.y).sort((a, b) => a - b)
    )
    
    const gridScore = (horizontalSpacing.consistency + verticalSpacing.consistency) / 2
    
    return {
      detected: gridScore > this.GRID_THRESHOLD,
      consistency: gridScore * 100
    }
  }

  private measureMargins(imageData: ImageData): LayoutMetrics['margins'] {
    const { width, height } = imageData
    const contentBounds = this.findContentBounds(imageData)
    
    const margins = {
      top: contentBounds.minY,
      right: width - contentBounds.maxX,
      bottom: height - contentBounds.maxY,
      left: contentBounds.minX,
      consistency: 0
    }
    
    // Calculate consistency
    const marginValues = [margins.top, margins.right, margins.bottom, margins.left]
    const avgMargin = marginValues.reduce((a, b) => a + b, 0) / 4
    const variance = marginValues.reduce((sum, m) => sum + Math.pow(m - avgMargin, 2), 0) / 4
    const stdDev = Math.sqrt(variance)
    
    margins.consistency = Math.max(0, 100 - (stdDev / avgMargin) * 100)
    
    return margins
  }

  private findContentBlocks(imageData: ImageData): Array<{x: number, y: number, width: number, height: number}> {
    // Simplified content block detection
    // In production, this would use more sophisticated computer vision techniques
    const blocks: Array<{x: number, y: number, width: number, height: number}> = []
    const { data, width, height } = imageData
    const visited = new Set<string>()
    
    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        const key = `${x},${y}`
        if (visited.has(key)) continue
        
        if (this.isContentPixel(data, x, y, width)) {
          const block = this.expandBlock(imageData, x, y, visited)
          if (block.width > 20 && block.height > 20) {
            blocks.push(block)
          }
        }
      }
    }
    
    return blocks
  }

  private isContentPixel(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
    const idx = (y * width + x) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    
    // Non-white pixel threshold
    return r < 240 || g < 240 || b < 240
  }

  private expandBlock(
    imageData: ImageData, 
    startX: number, 
    startY: number, 
    visited: Set<string>
  ): {x: number, y: number, width: number, height: number} {
    const { data, width, height } = imageData
    let minX = startX, maxX = startX
    let minY = startY, maxY = startY
    
    const queue = [[startX, startY]]
    visited.add(`${startX},${startY}`)
    
    while (queue.length > 0) {
      const [x, y] = queue.shift()!
      
      // Check neighbors
      const neighbors = [
        [x + 1, y], [x - 1, y],
        [x, y + 1], [x, y - 1]
      ]
      
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        
        const key = `${nx},${ny}`
        if (visited.has(key)) continue
        
        if (this.isContentPixel(data, nx, ny, width)) {
          visited.add(key)
          queue.push([nx, ny])
          
          minX = Math.min(minX, nx)
          maxX = Math.max(maxX, nx)
          minY = Math.min(minY, ny)
          maxY = Math.max(maxY, ny)
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

  private findContentBounds(imageData: ImageData): {minX: number, minY: number, maxX: number, maxY: number} {
    const { data, width, height } = imageData
    let minX = width, minY = height
    let maxX = 0, maxY = 0
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (this.isContentPixel(data, x, y, width)) {
          minX = Math.min(minX, x)
          maxX = Math.max(maxX, x)
          minY = Math.min(minY, y)
          maxY = Math.max(maxY, y)
        }
      }
    }
    
    return { minX, minY, maxX, maxY }
  }

  private determineAlignment(centers: number[], totalWidth: number): 'left' | 'center' | 'right' | 'mixed' {
    if (centers.length === 0) return 'center'
    
    const leftThreshold = totalWidth * 0.33
    const rightThreshold = totalWidth * 0.67
    
    const alignments = centers.map(c => {
      if (c < leftThreshold) return 'left'
      if (c > rightThreshold) return 'right'
      return 'center'
    })
    
    const counts = {
      left: alignments.filter(a => a === 'left').length,
      center: alignments.filter(a => a === 'center').length,
      right: alignments.filter(a => a === 'right').length
    }
    
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    
    if (dominant[1] / centers.length > this.ALIGNMENT_THRESHOLD) {
      return dominant[0] as 'left' | 'center' | 'right'
    }
    
    return 'mixed'
  }

  private determineVerticalAlignment(centers: number[], totalHeight: number): 'top' | 'middle' | 'bottom' | 'mixed' {
    if (centers.length === 0) return 'middle'
    
    const topThreshold = totalHeight * 0.33
    const bottomThreshold = totalHeight * 0.67
    
    const alignments = centers.map(c => {
      if (c < topThreshold) return 'top'
      if (c > bottomThreshold) return 'bottom'
      return 'middle'
    })
    
    const counts = {
      top: alignments.filter(a => a === 'top').length,
      middle: alignments.filter(a => a === 'middle').length,
      bottom: alignments.filter(a => a === 'bottom').length
    }
    
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    
    if (dominant[1] / centers.length > this.ALIGNMENT_THRESHOLD) {
      return dominant[0] as 'top' | 'middle' | 'bottom'
    }
    
    return 'mixed'
  }

  private calculateAlignmentConsistency(blocks: Array<{x: number, y: number, width: number, height: number}>): number {
    if (blocks.length < 2) return 100
    
    // Check edge alignments
    const leftEdges = blocks.map(b => b.x)
    const rightEdges = blocks.map(b => b.x + b.width)
    const topEdges = blocks.map(b => b.y)
    const bottomEdges = blocks.map(b => b.y + b.height)
    
    const leftConsistency = this.calculateEdgeConsistency(leftEdges)
    const rightConsistency = this.calculateEdgeConsistency(rightEdges)
    const topConsistency = this.calculateEdgeConsistency(topEdges)
    const bottomConsistency = this.calculateEdgeConsistency(bottomEdges)
    
    return (leftConsistency + rightConsistency + topConsistency + bottomConsistency) / 4
  }

  private calculateEdgeConsistency(edges: number[]): number {
    if (edges.length < 2) return 100
    
    // Group similar edge positions
    const threshold = 5 // pixels
    const groups: number[][] = []
    
    edges.sort((a, b) => a - b).forEach(edge => {
      const group = groups.find(g => Math.abs(g[0] - edge) < threshold)
      if (group) {
        group.push(edge)
      } else {
        groups.push([edge])
      }
    })
    
    // Calculate consistency based on grouping
    const largestGroup = Math.max(...groups.map(g => g.length))
    return (largestGroup / edges.length) * 100
  }

  private analyzeSpacing(positions: number[]): {consistency: number} {
    if (positions.length < 2) return { consistency: 0 }
    
    const spacings: number[] = []
    for (let i = 1; i < positions.length; i++) {
      spacings.push(positions[i] - positions[i - 1])
    }
    
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length
    const variance = spacings.reduce((sum, s) => sum + Math.pow(s - avgSpacing, 2), 0) / spacings.length
    const stdDev = Math.sqrt(variance)
    
    const consistency = Math.max(0, 1 - (stdDev / avgSpacing))
    return { consistency }
  }

  private detectHierarchyLevels(sizes: number[]): number {
    if (sizes.length === 0) return 0
    if (sizes.length === 1) return 1
    
    // Use k-means-like approach to find distinct size groups
    const threshold = 0.3 // 30% difference threshold
    let levels = 1
    
    for (let i = 1; i < sizes.length; i++) {
      const ratio = sizes[i] / sizes[i - 1]
      if (ratio < 1 - threshold) {
        levels++
      }
    }
    
    return Math.min(levels, 5) // Cap at 5 levels
  }

  private calculateHierarchyClarity(sizes: number[]): number {
    if (sizes.length < 2) return 100
    
    // Calculate ratios between consecutive sizes
    const ratios: number[] = []
    for (let i = 1; i < sizes.length; i++) {
      ratios.push(sizes[i - 1] / sizes[i])
    }
    
    // Good hierarchy has clear size differences (ratios > 1.5)
    const clearRatios = ratios.filter(r => r > 1.5).length
    const clarity = (clearRatios / ratios.length) * 100
    
    return clarity
  }
}