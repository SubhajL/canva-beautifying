/**
 * Layout restructuring algorithms
 */

// Types for layout
export interface GridSystem {
  columns: number
  rows?: number
  gap: number
  margin: number
  breakpoints?: {
    mobile: number
    tablet: number
    desktop: number
  }
}

export interface LayoutElement {
  id: string
  type: 'text' | 'image' | 'container' | 'header' | 'footer' | 'sidebar'
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  zIndex?: number
  alignment?: 'left' | 'center' | 'right' | 'justify'
}

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal' | 'center' | 'margin'
  position: number
  elements: string[] // Element IDs aligned to this guide
}

export interface SpacingRule {
  type: 'margin' | 'padding' | 'gap'
  value: number
  unit: 'px' | 'rem' | '%'
  target: 'all' | 'horizontal' | 'vertical' | 'top' | 'right' | 'bottom' | 'left'
}

export interface VisualFlow {
  pattern: 'F' | 'Z' | 'linear' | 'circular' | 'hierarchical'
  entryPoint: string // Element ID
  exitPoint: string // Element ID
  path: string[] // Ordered element IDs
  strength: number // 0-100
}

export interface LayoutAnalysis {
  alignment: {
    score: number
    issues: string[]
    guides: AlignmentGuide[]
  }
  spacing: {
    score: number
    consistency: number
    rules: SpacingRule[]
  }
  balance: {
    horizontal: number
    vertical: number
    visual: number
  }
  flow: VisualFlow
}

/**
 * Layout Restructuring Class
 */
export class LayoutRestructuring {
  /**
   * Apply grid system to layout
   */
  static applyGridSystem(
    elements: LayoutElement[],
    containerBounds: { width: number; height: number },
    options?: {
      columns?: number
      rows?: number
      gap?: number
      margin?: number
      alignToGrid?: boolean
      preserveRelations?: boolean
    }
  ): {
    grid: GridSystem
    elements: LayoutElement[]
    changes: string[]
  } {
    const columns = options?.columns || 12
    const gap = options?.gap || 24
    const margin = options?.margin || 48
    const alignToGrid = options?.alignToGrid !== false
    
    // Calculate grid metrics
    const contentWidth = containerBounds.width - (margin * 2)
    const columnWidth = (contentWidth - (gap * (columns - 1))) / columns
    
    const grid: GridSystem = {
      columns,
      gap,
      margin,
      breakpoints: {
        mobile: 4,
        tablet: 8,
        desktop: columns
      }
    }
    
    const changes: string[] = []
    const newElements = [...elements]
    
    if (alignToGrid) {
      // Align elements to grid
      newElements.forEach(element => {
        const originalX = element.bounds.x
        const originalWidth = element.bounds.width
        
        // Calculate grid position
        const relativeX = originalX - margin
        const startColumn = Math.round(relativeX / (columnWidth + gap))
        const endColumn = Math.round((relativeX + originalWidth) / (columnWidth + gap))
        const columnSpan = Math.max(1, endColumn - startColumn)
        
        // New position and size
        const newX = margin + (startColumn * (columnWidth + gap))
        const newWidth = (columnSpan * columnWidth) + ((columnSpan - 1) * gap)
        
        if (Math.abs(newX - originalX) > 1 || Math.abs(newWidth - originalWidth) > 1) {
          element.bounds.x = newX
          element.bounds.width = newWidth
          changes.push(`Aligned ${element.id} to ${columnSpan}-column grid`)
        }
      })
    }
    
    // Preserve relationships if requested
    if (options?.preserveRelations) {
      this.preserveElementRelationships(newElements, elements)
    }
    
    return { grid, elements: newElements, changes }
  }

  /**
   * Correct alignment issues
   */
  static correctAlignment(
    elements: LayoutElement[],
    options?: {
      threshold?: number // Pixels to consider "aligned"
      guides?: 'auto' | 'manual'
      includeOptical?: boolean // Optical alignment adjustments
    }
  ): {
    elements: LayoutElement[]
    guides: AlignmentGuide[]
    corrections: string[]
  } {
    const threshold = options?.threshold || 5
    const corrections: string[] = []
    const newElements = [...elements]
    
    // Detect alignment guides
    const guides = this.detectAlignmentGuides(elements, threshold)
    
    // Apply corrections
    guides.forEach(guide => {
      if (guide.elements.length < 2) return
      
      // Calculate target position (average or mode)
      const positions = guide.elements.map(id => {
        const el = newElements.find(e => e.id === id)
        if (!el) return 0
        
        switch (guide.type) {
          case 'vertical':
            return el.bounds.x
          case 'horizontal':
            return el.bounds.y
          case 'center':
            // For center alignment, we need to determine orientation based on element distribution
            const horizontalSpread = Math.max(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.x : 0
            })) - Math.min(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.x : 0
            }))
            const verticalSpread = Math.max(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.y : 0
            })) - Math.min(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.y : 0
            }))
            
            // If elements are more spread horizontally, we're aligning vertical centers
            return horizontalSpread > verticalSpread
              ? el.bounds.y + el.bounds.height / 2
              : el.bounds.x + el.bounds.width / 2
          default:
            return 0
        }
      })
      
      const targetPosition = this.calculateMode(positions, threshold)
      
      // Apply alignment
      guide.elements.forEach(id => {
        const element = newElements.find(e => e.id === id)
        if (!element) return
        
        const oldPos = guide.type === 'vertical' ? element.bounds.x : element.bounds.y
        
        switch (guide.type) {
          case 'vertical':
            element.bounds.x = targetPosition
            break
          case 'horizontal':
            element.bounds.y = targetPosition
            break
          case 'center':
            // Determine orientation based on element distribution
            const horizontalSpread = Math.max(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.x : 0
            })) - Math.min(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.x : 0
            }))
            const verticalSpread = Math.max(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.y : 0
            })) - Math.min(...guide.elements.map(id => {
              const elem = newElements.find(e => e.id === id)
              return elem ? elem.bounds.y : 0
            }))
            
            if (horizontalSpread > verticalSpread) {
              // Aligning vertical centers
              element.bounds.y = targetPosition - element.bounds.height / 2
            } else {
              // Aligning horizontal centers
              element.bounds.x = targetPosition - element.bounds.width / 2
            }
            break
        }
        
        if (Math.abs(oldPos - targetPosition) > 0.1) {
          corrections.push(`Aligned ${element.id} to ${guide.type} guide at ${targetPosition}`)
        }
      })
    })
    
    // Optical alignment adjustments
    if (options?.includeOptical) {
      this.applyOpticalAlignment(newElements, corrections)
    }
    
    return { elements: newElements, guides, corrections }
  }

  /**
   * Optimize spacing between elements
   */
  static optimizeSpacing(
    elements: LayoutElement[],
    options?: {
      method?: 'equal' | 'proportional' | 'rhythmic'
      minSpacing?: number
      maxSpacing?: number
      preserveGroups?: boolean
    }
  ): {
    elements: LayoutElement[]
    rules: SpacingRule[]
    changes: string[]
  } {
    const method = options?.method || 'proportional'
    const minSpacing = options?.minSpacing || 16
    const maxSpacing = options?.maxSpacing || 64
    const changes: string[] = []
    const newElements = [...elements]
    
    // Group elements by proximity
    const groups = this.groupElementsByProximity(elements, maxSpacing * 2)
    
    // Apply spacing within groups
    groups.forEach(group => {
      if (group.length < 2) return
      
      // Sort by position
      const sortedVertically = [...group].sort((a, b) => a.bounds.y - b.bounds.y)
      const sortedHorizontally = [...group].sort((a, b) => a.bounds.x - b.bounds.x)
      
      // Apply vertical spacing
      this.applySpacingMethod(sortedVertically, 'vertical', method, minSpacing, maxSpacing, changes)
      
      // Apply horizontal spacing if elements are in a row
      if (this.areElementsInRow(group)) {
        this.applySpacingMethod(sortedHorizontally, 'horizontal', method, minSpacing, maxSpacing, changes)
      }
    })
    
    // Generate spacing rules
    const rules = this.generateSpacingRules(newElements, groups)
    
    return { elements: newElements, rules, changes }
  }

  /**
   * Improve visual flow
   */
  static improveVisualFlow(
    elements: LayoutElement[],
    options?: {
      targetPattern?: 'F' | 'Z' | 'linear'
      emphasizeHierarchy?: boolean
      optimizeReadingPath?: boolean
    }
  ): {
    elements: LayoutElement[]
    flow: VisualFlow
    improvements: string[]
  } {
    const targetPattern = options?.targetPattern || 'F'
    const improvements: string[] = []
    const newElements = [...elements]
    
    // Analyze current flow
    const _currentFlow = this.analyzeVisualFlow(elements)
    
    // Reorder elements for target pattern
    switch (targetPattern) {
      case 'F':
        this.arrangeForFPattern(newElements, improvements)
        break
      case 'Z':
        this.arrangeForZPattern(newElements, improvements)
        break
      case 'linear':
        this.arrangeForLinearFlow(newElements, improvements)
        break
    }
    
    // Emphasize hierarchy if requested
    if (options?.emphasizeHierarchy) {
      this.emphasizeHierarchy(newElements, improvements)
    }
    
    // Optimize reading path
    if (options?.optimizeReadingPath) {
      this.optimizeReadingPath(newElements, improvements)
    }
    
    // Re-analyze flow
    const newFlow = this.analyzeVisualFlow(newElements)
    
    return { elements: newElements, flow: newFlow, improvements }
  }

  /**
   * Analyze complete layout
   */
  static analyzeLayout(elements: LayoutElement[]): LayoutAnalysis {
    // Analyze alignment
    const alignmentGuides = this.detectAlignmentGuides(elements, 5)
    const alignmentScore = this.calculateAlignmentScore(elements, alignmentGuides)
    const alignmentIssues = this.detectAlignmentIssues(elements, alignmentGuides)
    
    // Analyze spacing
    const spacingRules = this.generateSpacingRules(elements, [elements])
    const spacingScore = this.calculateSpacingScore(elements)
    const spacingConsistency = this.calculateSpacingConsistency(elements)
    
    // Analyze balance
    const balance = this.calculateBalance(elements)
    
    // Analyze flow
    const flow = this.analyzeVisualFlow(elements)
    
    return {
      alignment: {
        score: alignmentScore,
        issues: alignmentIssues,
        guides: alignmentGuides
      },
      spacing: {
        score: spacingScore,
        consistency: spacingConsistency,
        rules: spacingRules
      },
      balance,
      flow
    }
  }

  // Helper methods

  private static preserveElementRelationships(
    newElements: LayoutElement[],
    originalElements: LayoutElement[]
  ): void {
    // Maintain relative positions between elements
    originalElements.forEach((original, i) => {
      if (i === 0) return
      
      const prev = originalElements[i - 1]
      const newEl = newElements.find(e => e.id === original.id)
      const newPrev = newElements.find(e => e.id === prev.id)
      
      if (newEl && newPrev) {
        const originalGap = original.bounds.x - (prev.bounds.x + prev.bounds.width)
        const newGap = newEl.bounds.x - (newPrev.bounds.x + newPrev.bounds.width)
        
        if (Math.abs(originalGap) < 100 && Math.abs(newGap - originalGap) > 10) {
          newEl.bounds.x = newPrev.bounds.x + newPrev.bounds.width + originalGap
        }
      }
    })
  }

  private static detectAlignmentGuides(
    elements: LayoutElement[],
    threshold: number
  ): AlignmentGuide[] {
    const guides: AlignmentGuide[] = []
    
    // Detect vertical alignment
    const xPositions = new Map<number, string[]>()
    elements.forEach(el => {
      const x = Math.round(el.bounds.x)
      const nearbyX = Array.from(xPositions.keys()).find(pos => Math.abs(pos - x) <= threshold)
      
      if (nearbyX !== undefined) {
        xPositions.get(nearbyX)!.push(el.id)
      } else {
        xPositions.set(x, [el.id])
      }
    })
    
    // Create guides from positions with multiple elements
    xPositions.forEach((elements, position) => {
      if (elements.length > 1) {
        guides.push({
          type: 'vertical',
          position,
          elements
        })
      }
    })
    
    // Detect horizontal alignment
    const yPositions = new Map<number, string[]>()
    elements.forEach(el => {
      const y = Math.round(el.bounds.y)
      const nearbyY = Array.from(yPositions.keys()).find(pos => Math.abs(pos - y) <= threshold)
      
      if (nearbyY !== undefined) {
        yPositions.get(nearbyY)!.push(el.id)
      } else {
        yPositions.set(y, [el.id])
      }
    })
    
    yPositions.forEach((elements, position) => {
      if (elements.length > 1) {
        guides.push({
          type: 'horizontal',
          position,
          elements
        })
      }
    })
    
    return guides
  }

  private static calculateMode(values: number[], threshold: number): number {
    // Group similar values
    const groups: number[][] = []
    
    values.forEach(val => {
      const group = groups.find(g => Math.abs(g[0] - val) <= threshold)
      if (group) {
        group.push(val)
      } else {
        groups.push([val])
      }
    })
    
    // Find largest group and return average
    const largestGroup = groups.reduce((a, b) => a.length > b.length ? a : b, [])
    return largestGroup.reduce((a, b) => a + b, 0) / largestGroup.length
  }

  private static applyOpticalAlignment(elements: LayoutElement[], corrections: string[]): void {
    // Adjust for optical center (slightly above mathematical center)
    elements.forEach(el => {
      if (el.type === 'text' && el.bounds.height > 100) {
        const adjustment = el.bounds.height * 0.02 // 2% upward shift
        el.bounds.y -= adjustment
        corrections.push(`Applied optical alignment to ${el.id}`)
      }
    })
  }

  private static groupElementsByProximity(
    elements: LayoutElement[],
    maxDistance: number
  ): LayoutElement[][] {
    const groups: LayoutElement[][] = []
    const assigned = new Set<string>()
    
    elements.forEach(el => {
      if (assigned.has(el.id)) return
      
      const group = [el]
      assigned.add(el.id)
      
      // Find nearby elements
      elements.forEach(other => {
        if (assigned.has(other.id)) return
        
        const distance = this.calculateDistance(el, other)
        if (distance <= maxDistance) {
          group.push(other)
          assigned.add(other.id)
        }
      })
      
      groups.push(group)
    })
    
    return groups
  }

  private static calculateDistance(el1: LayoutElement, el2: LayoutElement): number {
    const center1 = {
      x: el1.bounds.x + el1.bounds.width / 2,
      y: el1.bounds.y + el1.bounds.height / 2
    }
    const center2 = {
      x: el2.bounds.x + el2.bounds.width / 2,
      y: el2.bounds.y + el2.bounds.height / 2
    }
    
    return Math.sqrt(
      Math.pow(center2.x - center1.x, 2) +
      Math.pow(center2.y - center1.y, 2)
    )
  }

  private static areElementsInRow(elements: LayoutElement[]): boolean {
    if (elements.length < 2) return false
    
    const yPositions = elements.map(el => el.bounds.y)
    const avgY = yPositions.reduce((a, b) => a + b, 0) / yPositions.length
    const maxDeviation = Math.max(...yPositions.map(y => Math.abs(y - avgY)))
    
    return maxDeviation < 20 // Within 20px is considered same row
  }

  private static applySpacingMethod(
    elements: LayoutElement[],
    direction: 'horizontal' | 'vertical',
    method: string,
    minSpacing: number,
    maxSpacing: number,
    changes: string[]
  ): void {
    if (elements.length < 2) return
    
    switch (method) {
      case 'equal':
        this.applyEqualSpacing(elements, direction, minSpacing, changes)
        break
      case 'proportional':
        this.applyProportionalSpacing(elements, direction, minSpacing, maxSpacing, changes)
        break
      case 'rhythmic':
        this.applyRhythmicSpacing(elements, direction, minSpacing, changes)
        break
    }
  }

  private static applyEqualSpacing(
    elements: LayoutElement[],
    direction: 'horizontal' | 'vertical',
    spacing: number,
    changes: string[]
  ): void {
    for (let i = 1; i < elements.length; i++) {
      const prev = elements[i - 1]
      const current = elements[i]
      
      if (direction === 'vertical') {
        const newY = prev.bounds.y + prev.bounds.height + spacing
        if (Math.abs(current.bounds.y - newY) > 1) {
          current.bounds.y = newY
          changes.push(`Applied ${spacing}px vertical spacing to ${current.id}`)
        }
      } else {
        const newX = prev.bounds.x + prev.bounds.width + spacing
        if (Math.abs(current.bounds.x - newX) > 1) {
          current.bounds.x = newX
          changes.push(`Applied ${spacing}px horizontal spacing to ${current.id}`)
        }
      }
    }
  }

  private static applyProportionalSpacing(
    elements: LayoutElement[],
    direction: 'horizontal' | 'vertical',
    minSpacing: number,
    maxSpacing: number,
    changes: string[]
  ): void {
    // Calculate proportional spacing based on element sizes
    for (let i = 1; i < elements.length; i++) {
      const prev = elements[i - 1]
      const current = elements[i]
      
      const avgSize = direction === 'vertical'
        ? (prev.bounds.height + current.bounds.height) / 2
        : (prev.bounds.width + current.bounds.width) / 2
      
      const spacing = Math.max(minSpacing, Math.min(maxSpacing, avgSize * 0.2))
      
      if (direction === 'vertical') {
        current.bounds.y = prev.bounds.y + prev.bounds.height + spacing
      } else {
        current.bounds.x = prev.bounds.x + prev.bounds.width + spacing
      }
      
      changes.push(`Applied proportional spacing (${Math.round(spacing)}px) to ${current.id}`)
    }
  }

  private static applyRhythmicSpacing(
    elements: LayoutElement[],
    direction: 'horizontal' | 'vertical',
    baseSpacing: number,
    changes: string[]
  ): void {
    // Use a rhythmic pattern like 1x, 2x, 1x, 3x
    const rhythm = [1, 2, 1, 3]
    
    for (let i = 1; i < elements.length; i++) {
      const prev = elements[i - 1]
      const current = elements[i]
      const multiplier = rhythm[(i - 1) % rhythm.length]
      const spacing = baseSpacing * multiplier
      
      if (direction === 'vertical') {
        current.bounds.y = prev.bounds.y + prev.bounds.height + spacing
      } else {
        current.bounds.x = prev.bounds.x + prev.bounds.width + spacing
      }
      
      changes.push(`Applied rhythmic spacing (${multiplier}x = ${spacing}px) to ${current.id}`)
    }
  }

  private static generateSpacingRules(
    elements: LayoutElement[],
    groups: LayoutElement[][]
  ): SpacingRule[] {
    const rules: SpacingRule[] = []
    
    // Calculate common spacings
    const verticalSpacings: number[] = []
    const horizontalSpacings: number[] = []
    
    groups.forEach(group => {
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1]
        const current = group[i]
        
        const vSpace = current.bounds.y - (prev.bounds.y + prev.bounds.height)
        const hSpace = current.bounds.x - (prev.bounds.x + prev.bounds.width)
        
        if (vSpace > 0 && vSpace < 200) verticalSpacings.push(vSpace)
        if (hSpace > 0 && hSpace < 200) horizontalSpacings.push(hSpace)
      }
    })
    
    // Find common values
    const commonVertical = this.findCommonValue(verticalSpacings)
    const commonHorizontal = this.findCommonValue(horizontalSpacings)
    
    if (commonVertical) {
      rules.push({
        type: 'gap',
        value: commonVertical,
        unit: 'px',
        target: 'vertical'
      })
    }
    
    if (commonHorizontal) {
      rules.push({
        type: 'gap',
        value: commonHorizontal,
        unit: 'px',
        target: 'horizontal'
      })
    }
    
    return rules
  }

  private static findCommonValue(values: number[]): number | null {
    if (values.length === 0) return null
    
    const rounded = values.map(v => Math.round(v / 4) * 4) // Round to nearest 4px
    const counts = new Map<number, number>()
    
    rounded.forEach(val => {
      counts.set(val, (counts.get(val) || 0) + 1)
    })
    
    let maxCount = 0
    let commonValue = 0
    
    counts.forEach((count, value) => {
      if (count > maxCount) {
        maxCount = count
        commonValue = value
      }
    })
    
    return maxCount > values.length * 0.3 ? commonValue : null
  }

  private static calculateAlignmentScore(
    elements: LayoutElement[],
    guides: AlignmentGuide[]
  ): number {
    let score = 50 // Base score
    
    // Bonus for elements on guides
    const alignedElements = new Set<string>()
    guides.forEach(guide => {
      guide.elements.forEach(id => alignedElements.add(id))
    })
    
    const alignmentRatio = alignedElements.size / elements.length
    score += alignmentRatio * 30
    
    // Bonus for guide quality
    const avgElementsPerGuide = guides.reduce((sum, g) => sum + g.elements.length, 0) / (guides.length || 1)
    if (avgElementsPerGuide > 2) score += 10
    if (avgElementsPerGuide > 3) score += 10
    
    return Math.min(100, score)
  }

  private static detectAlignmentIssues(
    elements: LayoutElement[],
    guides: AlignmentGuide[]
  ): string[] {
    const issues: string[] = []
    
    // Find elements not on any guide
    const alignedElements = new Set<string>()
    guides.forEach(guide => {
      guide.elements.forEach(id => alignedElements.add(id))
    })
    
    const unaligned = elements.filter(el => !alignedElements.has(el.id))
    if (unaligned.length > elements.length * 0.3) {
      issues.push(`${unaligned.length} elements are not aligned to any guide`)
    }
    
    // Check for near-misses
    elements.forEach(el => {
      if (alignedElements.has(el.id)) return
      
      const nearMisses = guides.filter(guide => {
        const distance = guide.type === 'vertical'
          ? Math.abs(el.bounds.x - guide.position)
          : Math.abs(el.bounds.y - guide.position)
        
        return distance > 5 && distance < 20
      })
      
      if (nearMisses.length > 0) {
        issues.push(`${el.id} is slightly misaligned (off by ${Math.round(nearMisses[0].position)}px)`)
      }
    })
    
    return issues
  }

  private static calculateSpacingScore(elements: LayoutElement[]): number {
    // Calculate based on consistency and appropriateness of spacing
    let score = 70 // Base score
    
    const spacings: number[] = []
    
    // Calculate all spacings
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const spacing = this.calculateMinSpacing(elements[i], elements[j])
        if (spacing < 200) spacings.push(spacing)
      }
    }
    
    if (spacings.length === 0) return score
    
    // Check for consistency
    const stdDev = this.calculateStandardDeviation(spacings)
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length
    
    if (stdDev / avgSpacing < 0.3) score += 20 // Consistent spacing
    else if (stdDev / avgSpacing > 0.6) score -= 10 // Inconsistent spacing
    
    // Check for appropriate values
    if (avgSpacing >= 16 && avgSpacing <= 48) score += 10
    
    return Math.min(100, Math.max(0, score))
  }

  private static calculateMinSpacing(el1: LayoutElement, el2: LayoutElement): number {
    const xSpacing = Math.max(
      el2.bounds.x - (el1.bounds.x + el1.bounds.width),
      el1.bounds.x - (el2.bounds.x + el2.bounds.width)
    )
    
    const ySpacing = Math.max(
      el2.bounds.y - (el1.bounds.y + el1.bounds.height),
      el1.bounds.y - (el2.bounds.y + el2.bounds.height)
    )
    
    return Math.max(xSpacing, ySpacing)
  }

  private static calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2))
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
    return Math.sqrt(avgSquaredDiff)
  }

  private static calculateSpacingConsistency(elements: LayoutElement[]): number {
    // Group similar spacings and calculate consistency
    const spacings: number[] = []
    
    for (let i = 0; i < elements.length - 1; i++) {
      const current = elements[i]
      const next = elements[i + 1]
      
      const vSpace = next.bounds.y - (current.bounds.y + current.bounds.height)
      if (vSpace > 0 && vSpace < 200) spacings.push(vSpace)
    }
    
    if (spacings.length < 2) return 100
    
    // Round to nearest 4px and count occurrences
    const rounded = spacings.map(s => Math.round(s / 4) * 4)
    const counts = new Map<number, number>()
    
    rounded.forEach(s => {
      counts.set(s, (counts.get(s) || 0) + 1)
    })
    
    // Calculate consistency score
    const maxCount = Math.max(...counts.values())
    const consistency = (maxCount / spacings.length) * 100
    
    return Math.round(consistency)
  }

  private static calculateBalance(elements: LayoutElement[]): {
    horizontal: number
    vertical: number
    visual: number
  } {
    if (elements.length === 0) {
      return { horizontal: 50, vertical: 50, visual: 50 }
    }
    
    // Find bounds
    const bounds = this.calculateBounds(elements)
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    
    // Calculate visual weight distribution
    let leftWeight = 0, rightWeight = 0
    let topWeight = 0, bottomWeight = 0
    
    elements.forEach(el => {
      const area = el.bounds.width * el.bounds.height
      const elCenterX = el.bounds.x + el.bounds.width / 2
      const elCenterY = el.bounds.y + el.bounds.height / 2
      
      if (elCenterX < centerX) leftWeight += area
      else rightWeight += area
      
      if (elCenterY < centerY) topWeight += area
      else bottomWeight += area
    })
    
    // Calculate balance scores (0-100, where 50 is perfect balance)
    const horizontalBalance = 50 + (50 * (1 - Math.abs(leftWeight - rightWeight) / (leftWeight + rightWeight)))
    const verticalBalance = 50 + (50 * (1 - Math.abs(topWeight - bottomWeight) / (topWeight + bottomWeight)))
    const visualBalance = (horizontalBalance + verticalBalance) / 2
    
    return {
      horizontal: Math.round(horizontalBalance),
      vertical: Math.round(verticalBalance),
      visual: Math.round(visualBalance)
    }
  }

  private static calculateBounds(elements: LayoutElement[]): {
    x: number
    y: number
    width: number
    height: number
  } {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }
    
    let minX = Infinity, minY = Infinity
    let maxX = -Infinity, maxY = -Infinity
    
    elements.forEach(el => {
      minX = Math.min(minX, el.bounds.x)
      minY = Math.min(minY, el.bounds.y)
      maxX = Math.max(maxX, el.bounds.x + el.bounds.width)
      maxY = Math.max(maxY, el.bounds.y + el.bounds.height)
    })
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  private static analyzeVisualFlow(elements: LayoutElement[]): VisualFlow {
    if (elements.length === 0) {
      return {
        pattern: 'linear',
        entryPoint: '',
        exitPoint: '',
        path: [],
        strength: 0
      }
    }
    
    // Sort elements by visual prominence and position
    const sorted = [...elements].sort((a, b) => {
      // Prioritize by position (top-left to bottom-right)
      const scoreA = a.bounds.y * 2 + a.bounds.x
      const scoreB = b.bounds.y * 2 + b.bounds.x
      return scoreA - scoreB
    })
    
    // Detect pattern
    const pattern = this.detectFlowPattern(sorted)
    
    return {
      pattern,
      entryPoint: sorted[0].id,
      exitPoint: sorted[sorted.length - 1].id,
      path: sorted.map(el => el.id),
      strength: this.calculateFlowStrength(sorted, pattern)
    }
  }

  private static detectFlowPattern(elements: LayoutElement[]): VisualFlow['pattern'] {
    if (elements.length < 3) return 'linear'
    
    // Check for F-pattern (left-heavy with horizontal scanning)
    const leftElements = elements.filter(el => el.bounds.x < 200).length
    const rightElements = elements.filter(el => el.bounds.x > 400).length
    
    if (leftElements > rightElements * 1.5) return 'F'
    
    // Check for Z-pattern (diagonal flow)
    const topLeft = elements.find(el => el.bounds.x < 200 && el.bounds.y < 200)
    const topRight = elements.find(el => el.bounds.x > 400 && el.bounds.y < 200)
    const bottomLeft = elements.find(el => el.bounds.x < 200 && el.bounds.y > 400)
    const bottomRight = elements.find(el => el.bounds.x > 400 && el.bounds.y > 400)
    
    if (topLeft && topRight && bottomLeft && bottomRight) return 'Z'
    
    return 'linear'
  }

  private static calculateFlowStrength(
    elements: LayoutElement[],
    pattern: VisualFlow['pattern']
  ): number {
    // Calculate how well elements follow the detected pattern
    let score = 50
    
    switch (pattern) {
      case 'F':
        // Check if elements follow F-pattern
        const firstThird = elements.slice(0, Math.floor(elements.length / 3))
        const topElements = firstThird.filter(el => el.bounds.y < 300).length
        if (topElements > firstThird.length * 0.7) score += 30
        break
      
      case 'Z':
        // Check diagonal progression
        for (let i = 1; i < elements.length; i++) {
          const prev = elements[i - 1]
          const current = elements[i]
          if (current.bounds.x > prev.bounds.x || current.bounds.y > prev.bounds.y) {
            score += 5
          }
        }
        break
      
      case 'linear':
        // Check vertical progression
        for (let i = 1; i < elements.length; i++) {
          if (elements[i].bounds.y > elements[i - 1].bounds.y) {
            score += 10
          }
        }
        break
    }
    
    return Math.min(100, score)
  }

  private static arrangeForFPattern(elements: LayoutElement[], improvements: string[]): void {
    // Arrange important elements in F-pattern positions
    const important = elements.filter(el => el.type === 'header' || el.type === 'text')
    
    if (important.length >= 3) {
      // Top horizontal line
      important[0].bounds.x = 50
      important[0].bounds.y = 50
      
      important[1].bounds.x = 400
      important[1].bounds.y = 50
      
      // Left vertical line
      important[2].bounds.x = 50
      important[2].bounds.y = 200
      
      improvements.push('Arranged key elements in F-pattern layout')
    }
  }

  private static arrangeForZPattern(elements: LayoutElement[], improvements: string[]): void {
    // Arrange elements in Z-pattern
    if (elements.length >= 4) {
      const corners = elements.slice(0, 4)
      
      // Top-left
      corners[0].bounds.x = 50
      corners[0].bounds.y = 50
      
      // Top-right
      corners[1].bounds.x = 600
      corners[1].bounds.y = 50
      
      // Bottom-left
      corners[2].bounds.x = 50
      corners[2].bounds.y = 400
      
      // Bottom-right
      corners[3].bounds.x = 600
      corners[3].bounds.y = 400
      
      improvements.push('Arranged elements in Z-pattern layout')
    }
  }

  private static arrangeForLinearFlow(elements: LayoutElement[], improvements: string[]): void {
    // Arrange elements in vertical linear flow
    let currentY = 50
    
    elements.forEach(el => {
      el.bounds.x = 50 // Align to left
      el.bounds.y = currentY
      currentY += el.bounds.height + 30 // Add spacing
    })
    
    improvements.push('Arranged elements in linear vertical flow')
  }

  private static emphasizeHierarchy(elements: LayoutElement[], improvements: string[]): void {
    // Adjust sizes to emphasize hierarchy
    const headers = elements.filter(el => el.type === 'header')
    const _body = elements.filter(el => el.type === 'text')
    
    headers.forEach(header => {
      header.bounds.width *= 1.2
      header.bounds.height *= 1.2
    })
    
    if (headers.length > 0) {
      improvements.push('Emphasized headers by increasing size')
    }
  }

  private static optimizeReadingPath(elements: LayoutElement[], improvements: string[]): void {
    // Ensure text elements follow natural reading order
    const textElements = elements.filter(el => el.type === 'text' || el.type === 'header')
    
    textElements.sort((a, b) => {
      // Sort by row, then by column
      const rowDiff = a.bounds.y - b.bounds.y
      if (Math.abs(rowDiff) > 20) return rowDiff
      return a.bounds.x - b.bounds.x
    })
    
    // Update z-index to match reading order
    textElements.forEach((el, index) => {
      el.zIndex = index + 1
    })
    
    improvements.push('Optimized reading path with proper z-index ordering')
  }
}

/**
 * Export helper functions
 */
export const layoutRestructuring = {
  applyGrid: LayoutRestructuring.applyGridSystem,
  correctAlignment: LayoutRestructuring.correctAlignment,
  optimizeSpacing: LayoutRestructuring.optimizeSpacing,
  improveFlow: LayoutRestructuring.improveVisualFlow,
  analyze: LayoutRestructuring.analyzeLayout
}