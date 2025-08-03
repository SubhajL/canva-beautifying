/**
 * Advanced Composition Algorithms
 * Implements layer management, blend modes, smart placement, and visual balance
 */

import chroma from 'chroma-js'

// Types for composition
export interface CompositionLayer {
  id: string
  type: 'background' | 'original' | 'overlay' | 'decoration' | 'text' | 'graphic' | 'effect'
  content: {
    url?: string
    data?: Buffer
    element?: any
  }
  properties: {
    x: number
    y: number
    width: number
    height: number
    rotation: number
    scale: number
    opacity: number
    blendMode: BlendMode
    zIndex: number
  }
  metadata?: {
    importance: number
    visualWeight: number
    semanticType?: string
  }
}

export type BlendMode = 
  | 'normal' 
  | 'multiply' 
  | 'screen' 
  | 'overlay' 
  | 'soft-light' 
  | 'hard-light'
  | 'color-dodge' 
  | 'color-burn' 
  | 'darken' 
  | 'lighten' 
  | 'difference' 
  | 'exclusion'

export interface CompositionGrid {
  columns: number
  rows: number
  gutters: number
  margins: {
    top: number
    right: number
    bottom: number
    left: number
  }
  cells: GridCell[]
}

export interface GridCell {
  row: number
  col: number
  rowSpan: number
  colSpan: number
  occupied: boolean
  weight: number
  content?: string // Layer ID
}

export interface VisualBalance {
  horizontal: number
  vertical: number
  radial: number
  overall: number
  centerOfMass: { x: number; y: number }
  suggestions: string[]
}

export interface PlacementCandidate {
  x: number
  y: number
  score: number
  reasoning: string
}

/**
 * Layer Management System
 */
export class LayerManager {
  private layers: Map<string, CompositionLayer> = new Map()
  private layerOrder: string[] = []
  
  /**
   * Add a new layer
   */
  addLayer(layer: CompositionLayer): void {
    this.layers.set(layer.id, layer)
    this.insertInOrder(layer)
  }
  
  /**
   * Remove a layer
   */
  removeLayer(id: string): void {
    this.layers.delete(id)
    this.layerOrder = this.layerOrder.filter(layerId => layerId !== id)
  }
  
  /**
   * Reorder layers
   */
  reorderLayers(newOrder: string[]): void {
    // Validate all layer IDs exist
    const valid = newOrder.every(id => this.layers.has(id))
    if (!valid) {
      throw new Error('Invalid layer IDs in new order')
    }
    this.layerOrder = newOrder
    this.updateZIndices()
  }
  
  /**
   * Get layers in rendering order
   */
  getRenderOrder(): CompositionLayer[] {
    return this.layerOrder.map(id => this.layers.get(id)!).filter(Boolean)
  }
  
  /**
   * Merge layers
   */
  mergeLayers(ids: string[], newId: string): CompositionLayer {
    const layersToMerge = ids.map(id => this.layers.get(id)).filter(Boolean) as CompositionLayer[]
    if (layersToMerge.length < 2) {
      throw new Error('Need at least 2 layers to merge')
    }
    
    // Calculate merged bounds
    const bounds = this.calculateMergedBounds(layersToMerge)
    
    // Create merged layer
    const mergedLayer: CompositionLayer = {
      id: newId,
      type: 'overlay',
      content: {
        // In real implementation, this would render layers to a single buffer
        data: Buffer.from('merged')
      },
      properties: {
        ...bounds,
        rotation: 0,
        scale: 1,
        opacity: 1,
        blendMode: 'normal',
        zIndex: Math.max(...layersToMerge.map(l => l.properties.zIndex))
      },
      metadata: {
        importance: Math.max(...layersToMerge.map(l => l.metadata?.importance || 0)),
        visualWeight: layersToMerge.reduce((sum, l) => sum + (l.metadata?.visualWeight || 0), 0)
      }
    }
    
    // Remove old layers and add merged
    ids.forEach(id => this.removeLayer(id))
    this.addLayer(mergedLayer)
    
    return mergedLayer
  }
  
  /**
   * Group layers
   */
  groupLayers(ids: string[], groupId: string): void {
    const layers = ids.map(id => this.layers.get(id)).filter(Boolean) as CompositionLayer[]
    
    // Create group metadata
    layers.forEach(layer => {
      if (!layer.metadata) layer.metadata = { importance: 0.5, visualWeight: 1 }
      layer.metadata.semanticType = `group-${groupId}`
    })
  }
  
  private insertInOrder(layer: CompositionLayer): void {
    // Find insertion point based on zIndex
    const insertIndex = this.layerOrder.findIndex(id => {
      const existingLayer = this.layers.get(id)
      return existingLayer && existingLayer.properties.zIndex > layer.properties.zIndex
    })
    
    if (insertIndex === -1) {
      this.layerOrder.push(layer.id)
    } else {
      this.layerOrder.splice(insertIndex, 0, layer.id)
    }
  }
  
  private updateZIndices(): void {
    this.layerOrder.forEach((id, index) => {
      const layer = this.layers.get(id)
      if (layer) {
        layer.properties.zIndex = index
      }
    })
  }
  
  private calculateMergedBounds(layers: CompositionLayer[]): {
    x: number
    y: number
    width: number
    height: number
  } {
    const xs = layers.flatMap(l => [l.properties.x, l.properties.x + l.properties.width])
    const ys = layers.flatMap(l => [l.properties.y, l.properties.y + l.properties.height])
    
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }
}

/**
 * Blend Mode System
 */
export class BlendModeEngine {
  /**
   * Apply blend mode between two colors
   */
  static blend(
    base: string,
    overlay: string,
    mode: BlendMode,
    opacity: number = 1
  ): string {
    const baseColor = chroma(base)
    const overlayColor = chroma(overlay)
    
    let result: chroma.Color
    
    switch (mode) {
      case 'multiply':
        result = this.multiply(baseColor, overlayColor)
        break
      case 'screen':
        result = this.screen(baseColor, overlayColor)
        break
      case 'overlay':
        result = this.overlay(baseColor, overlayColor)
        break
      case 'soft-light':
        result = this.softLight(baseColor, overlayColor)
        break
      case 'hard-light':
        result = this.hardLight(baseColor, overlayColor)
        break
      case 'color-dodge':
        result = this.colorDodge(baseColor, overlayColor)
        break
      case 'color-burn':
        result = this.colorBurn(baseColor, overlayColor)
        break
      case 'darken':
        result = chroma.blend(base, overlay, 'darken')
        break
      case 'lighten':
        result = chroma.blend(base, overlay, 'lighten')
        break
      case 'difference':
        result = this.difference(baseColor, overlayColor)
        break
      case 'exclusion':
        result = this.exclusion(baseColor, overlayColor)
        break
      case 'normal':
      default:
        result = overlayColor
    }
    
    // Apply opacity
    if (opacity < 1) {
      result = chroma.mix(baseColor, result, opacity)
    }
    
    return result.hex()
  }
  
  /**
   * Suggest blend mode based on content
   */
  static suggestBlendMode(
    layerType: CompositionLayer['type'],
    baseColor: string,
    overlayColor: string
  ): {
    mode: BlendMode
    opacity: number
    reasoning: string
  } {
    const baseLum = chroma(baseColor).luminance()
    const overlayLum = chroma(overlayColor).luminance()
    
    switch (layerType) {
      case 'background':
        return {
          mode: 'normal',
          opacity: 0.3,
          reasoning: 'Subtle background presence'
        }
        
      case 'overlay':
        if (baseLum > 0.5 && overlayLum > 0.5) {
          return {
            mode: 'multiply',
            opacity: 0.2,
            reasoning: 'Darken light areas for contrast'
          }
        } else if (baseLum < 0.5 && overlayLum < 0.5) {
          return {
            mode: 'screen',
            opacity: 0.2,
            reasoning: 'Lighten dark areas for visibility'
          }
        } else {
          return {
            mode: 'overlay',
            opacity: 0.15,
            reasoning: 'Balanced enhancement'
          }
        }
        
      case 'decoration':
        return {
          mode: 'soft-light',
          opacity: 0.6,
          reasoning: 'Decorative elements blend naturally'
        }
        
      case 'text':
        return {
          mode: 'normal',
          opacity: 1,
          reasoning: 'Text must remain readable'
        }
        
      case 'effect':
        return {
          mode: 'overlay',
          opacity: 0.3,
          reasoning: 'Effects enhance without overwhelming'
        }
        
      default:
        return {
          mode: 'normal',
          opacity: 1,
          reasoning: 'Default blending'
        }
    }
  }
  
  // Blend mode implementations
  private static multiply(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    return chroma([
      (rgb1[0] * rgb2[0]) / 255,
      (rgb1[1] * rgb2[1]) / 255,
      (rgb1[2] * rgb2[2]) / 255
    ])
  }
  
  private static screen(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    return chroma([
      255 - ((255 - rgb1[0]) * (255 - rgb2[0])) / 255,
      255 - ((255 - rgb1[1]) * (255 - rgb2[1])) / 255,
      255 - ((255 - rgb1[2]) * (255 - rgb2[2])) / 255
    ])
  }
  
  private static overlay(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    
    const overlayChannel = (b: number, o: number) => {
      return b < 128
        ? (2 * b * o) / 255
        : 255 - (2 * (255 - b) * (255 - o)) / 255
    }
    
    return chroma([
      overlayChannel(rgb1[0], rgb2[0]),
      overlayChannel(rgb1[1], rgb2[1]),
      overlayChannel(rgb1[2], rgb2[2])
    ])
  }
  
  private static softLight(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    
    const softLightChannel = (b: number, o: number) => {
      if (o < 128) {
        return b - (255 - 2 * o) * b * (255 - b) / (255 * 255)
      } else {
        const d = b < 64 ? 
          ((16 * b - 12 * 255) * b + 4 * 255 * 255) / 255 : 
          Math.sqrt(b * 255)
        return b + (2 * o - 255) * (d - b) / 255
      }
    }
    
    return chroma([
      softLightChannel(rgb1[0], rgb2[0]),
      softLightChannel(rgb1[1], rgb2[1]),
      softLightChannel(rgb1[2], rgb2[2])
    ])
  }
  
  private static hardLight(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    // Hard light is overlay with base and overlay swapped
    return this.overlay(overlay, base)
  }
  
  private static colorDodge(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    
    const dodgeChannel = (b: number, o: number) => {
      return o === 255 ? 255 : Math.min(255, (b * 255) / (255 - o))
    }
    
    return chroma([
      dodgeChannel(rgb1[0], rgb2[0]),
      dodgeChannel(rgb1[1], rgb2[1]),
      dodgeChannel(rgb1[2], rgb2[2])
    ])
  }
  
  private static colorBurn(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    
    const burnChannel = (b: number, o: number) => {
      return o === 0 ? 0 : Math.max(0, 255 - ((255 - b) * 255) / o)
    }
    
    return chroma([
      burnChannel(rgb1[0], rgb2[0]),
      burnChannel(rgb1[1], rgb2[1]),
      burnChannel(rgb1[2], rgb2[2])
    ])
  }
  
  private static difference(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    
    return chroma([
      Math.abs(rgb1[0] - rgb2[0]),
      Math.abs(rgb1[1] - rgb2[1]),
      Math.abs(rgb1[2] - rgb2[2])
    ])
  }
  
  private static exclusion(base: chroma.Color, overlay: chroma.Color): chroma.Color {
    const rgb1 = base.rgb()
    const rgb2 = overlay.rgb()
    
    return chroma([
      rgb1[0] + rgb2[0] - (2 * rgb1[0] * rgb2[0]) / 255,
      rgb1[1] + rgb2[1] - (2 * rgb1[1] * rgb2[1]) / 255,
      rgb1[2] + rgb2[2] - (2 * rgb1[2] * rgb2[2]) / 255
    ])
  }
}

/**
 * Smart Object Placement System
 */
export class SmartPlacement {
  /**
   * Find optimal placement for an object
   */
  static findOptimalPlacement(
    object: {
      width: number
      height: number
      type: string
      importance: number
    },
    canvas: {
      width: number
      height: number
    },
    existingLayers: CompositionLayer[],
    constraints?: {
      margins?: { top: number; right: number; bottom: number; left: number }
      avoidOverlap?: boolean
      preferredZones?: Array<'top' | 'bottom' | 'left' | 'right' | 'center'>
      alignment?: 'grid' | 'golden' | 'rule-of-thirds' | 'free'
    }
  ): PlacementCandidate {
    const margins = constraints?.margins || { top: 20, right: 20, bottom: 20, left: 20 }
    const candidates: PlacementCandidate[] = []
    
    // Generate placement candidates based on alignment
    switch (constraints?.alignment) {
      case 'grid':
        candidates.push(...this.generateGridPlacements(object, canvas, margins))
        break
      case 'golden':
        candidates.push(...this.generateGoldenPlacements(object, canvas, margins))
        break
      case 'rule-of-thirds':
        candidates.push(...this.generateRuleOfThirdsPlacements(object, canvas, margins))
        break
      default:
        candidates.push(...this.generateFreePlacements(object, canvas, margins))
    }
    
    // Score each candidate
    const scoredCandidates = candidates.map(candidate => {
      let score = candidate.score
      
      // Check overlap if needed
      if (constraints?.avoidOverlap) {
        const overlapPenalty = this.calculateOverlapPenalty(
          { ...candidate, ...object },
          existingLayers
        )
        score -= overlapPenalty
      }
      
      // Apply zone preferences
      if (constraints?.preferredZones) {
        const zoneBonus = this.calculateZoneBonus(
          candidate,
          object,
          canvas,
          constraints.preferredZones
        )
        score += zoneBonus
      }
      
      // Consider visual balance
      const balanceScore = this.calculateBalanceScore(
        { ...candidate, ...object },
        existingLayers,
        canvas
      )
      score += balanceScore * 0.3
      
      return { ...candidate, score }
    })
    
    // Return best candidate
    return scoredCandidates.sort((a, b) => b.score - a.score)[0]
  }
  
  /**
   * Arrange multiple objects
   */
  static arrangeObjects(
    objects: Array<{
      id: string
      width: number
      height: number
      type: string
      importance: number
    }>,
    canvas: {
      width: number
      height: number
    },
    options?: {
      layout?: 'masonry' | 'grid' | 'flow' | 'radial'
      spacing?: number
      alignment?: 'left' | 'center' | 'right' | 'justify'
    }
  ): Map<string, { x: number; y: number }> {
    const layout = options?.layout || 'flow'
    const spacing = options?.spacing || 20
    const positions = new Map<string, { x: number; y: number }>()
    
    // Sort by importance
    const sortedObjects = [...objects].sort((a, b) => b.importance - a.importance)
    
    switch (layout) {
      case 'masonry':
        return this.masonryLayout(sortedObjects, canvas, spacing)
      case 'grid':
        return this.gridLayout(sortedObjects, canvas, spacing)
      case 'flow':
        return this.flowLayout(sortedObjects, canvas, spacing, options?.alignment)
      case 'radial':
        return this.radialLayout(sortedObjects, canvas)
      default:
        return positions
    }
  }
  
  private static generateGridPlacements(
    object: { width: number; height: number },
    canvas: { width: number; height: number },
    margins: { top: number; right: number; bottom: number; left: number }
  ): PlacementCandidate[] {
    const candidates: PlacementCandidate[] = []
    const cols = 12
    const rows = 8
    
    const cellWidth = (canvas.width - margins.left - margins.right) / cols
    const cellHeight = (canvas.height - margins.top - margins.bottom) / rows
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = margins.left + col * cellWidth
        const y = margins.top + row * cellHeight
        
        // Check if object fits
        if (x + object.width <= canvas.width - margins.right &&
            y + object.height <= canvas.height - margins.bottom) {
          candidates.push({
            x,
            y,
            score: 0.8 - (Math.abs(col - cols/2) + Math.abs(row - rows/2)) * 0.05,
            reasoning: `Grid position (${col}, ${row})`
          })
        }
      }
    }
    
    return candidates
  }
  
  private static generateGoldenPlacements(
    object: { width: number; height: number },
    canvas: { width: number; height: number },
    margins: { top: number; right: number; bottom: number; left: number }
  ): PlacementCandidate[] {
    const phi = 1.618033988749895
    const candidates: PlacementCandidate[] = []
    
    // Golden ratio points
    const goldenPoints = [
      { x: canvas.width / phi, y: canvas.height / phi },
      { x: canvas.width - canvas.width / phi, y: canvas.height / phi },
      { x: canvas.width / phi, y: canvas.height - canvas.height / phi },
      { x: canvas.width - canvas.width / phi, y: canvas.height - canvas.height / phi }
    ]
    
    goldenPoints.forEach((point, index) => {
      // Center object on golden point
      const x = point.x - object.width / 2
      const y = point.y - object.height / 2
      
      if (x >= margins.left && x + object.width <= canvas.width - margins.right &&
          y >= margins.top && y + object.height <= canvas.height - margins.bottom) {
        candidates.push({
          x,
          y,
          score: 0.95,
          reasoning: `Golden ratio point ${index + 1}`
        })
      }
    })
    
    return candidates
  }
  
  private static generateRuleOfThirdsPlacements(
    object: { width: number; height: number },
    canvas: { width: number; height: number },
    margins: { top: number; right: number; bottom: number; left: number }
  ): PlacementCandidate[] {
    const candidates: PlacementCandidate[] = []
    
    // Rule of thirds intersection points
    const thirdPoints = []
    for (let i = 1; i <= 2; i++) {
      for (let j = 1; j <= 2; j++) {
        thirdPoints.push({
          x: (canvas.width / 3) * i,
          y: (canvas.height / 3) * j
        })
      }
    }
    
    thirdPoints.forEach((point, index) => {
      const x = point.x - object.width / 2
      const y = point.y - object.height / 2
      
      if (x >= margins.left && x + object.width <= canvas.width - margins.right &&
          y >= margins.top && y + object.height <= canvas.height - margins.bottom) {
        candidates.push({
          x,
          y,
          score: 0.9,
          reasoning: `Rule of thirds intersection ${index + 1}`
        })
      }
    })
    
    return candidates
  }
  
  private static generateFreePlacements(
    object: { width: number; height: number },
    canvas: { width: number; height: number },
    margins: { top: number; right: number; bottom: number; left: number }
  ): PlacementCandidate[] {
    const candidates: PlacementCandidate[] = []
    const step = 50
    
    for (let x = margins.left; x <= canvas.width - margins.right - object.width; x += step) {
      for (let y = margins.top; y <= canvas.height - margins.bottom - object.height; y += step) {
        // Score based on distance from center
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const objCenterX = x + object.width / 2
        const objCenterY = y + object.height / 2
        
        const distance = Math.sqrt(
          Math.pow(objCenterX - centerX, 2) + 
          Math.pow(objCenterY - centerY, 2)
        )
        const maxDistance = Math.sqrt(
          Math.pow(canvas.width / 2, 2) + 
          Math.pow(canvas.height / 2, 2)
        )
        
        candidates.push({
          x,
          y,
          score: 0.7 * (1 - distance / maxDistance),
          reasoning: 'Free placement'
        })
      }
    }
    
    return candidates
  }
  
  private static calculateOverlapPenalty(
    object: { x: number; y: number; width: number; height: number },
    layers: CompositionLayer[]
  ): number {
    let penalty = 0
    
    for (const layer of layers) {
      const overlap = this.calculateOverlapArea(object, layer.properties)
      if (overlap > 0) {
        const overlapRatio = overlap / (object.width * object.height)
        penalty += overlapRatio * 50 // Heavy penalty for overlap
      }
    }
    
    return penalty
  }
  
  private static calculateOverlapArea(
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number }
  ): number {
    const xOverlap = Math.max(0, Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - Math.max(rect1.x, rect2.x))
    const yOverlap = Math.max(0, Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - Math.max(rect1.y, rect2.y))
    return xOverlap * yOverlap
  }
  
  private static calculateZoneBonus(
    position: { x: number; y: number },
    object: { width: number; height: number },
    canvas: { width: number; height: number },
    preferredZones: Array<'top' | 'bottom' | 'left' | 'right' | 'center'>
  ): number {
    let bonus = 0
    const objCenterX = position.x + object.width / 2
    const objCenterY = position.y + object.height / 2
    
    for (const zone of preferredZones) {
      switch (zone) {
        case 'top':
          if (objCenterY < canvas.height / 3) bonus += 10
          break
        case 'bottom':
          if (objCenterY > 2 * canvas.height / 3) bonus += 10
          break
        case 'left':
          if (objCenterX < canvas.width / 3) bonus += 10
          break
        case 'right':
          if (objCenterX > 2 * canvas.width / 3) bonus += 10
          break
        case 'center':
          const centerDist = Math.sqrt(
            Math.pow(objCenterX - canvas.width / 2, 2) +
            Math.pow(objCenterY - canvas.height / 2, 2)
          )
          bonus += 10 * (1 - centerDist / (canvas.width / 2))
          break
      }
    }
    
    return bonus
  }
  
  private static calculateBalanceScore(
    object: { x: number; y: number; width: number; height: number },
    layers: CompositionLayer[],
    canvas: { width: number; height: number }
  ): number {
    // Calculate current center of mass
    let totalWeight = 0
    let weightedX = 0
    let weightedY = 0
    
    for (const layer of layers) {
      const weight = layer.metadata?.visualWeight || 1
      const centerX = layer.properties.x + layer.properties.width / 2
      const centerY = layer.properties.y + layer.properties.height / 2
      
      weightedX += centerX * weight
      weightedY += centerY * weight
      totalWeight += weight
    }
    
    // Add the new object
    const objWeight = 1
    const objCenterX = object.x + object.width / 2
    const objCenterY = object.y + object.height / 2
    
    weightedX += objCenterX * objWeight
    weightedY += objCenterY * objWeight
    totalWeight += objWeight
    
    // Calculate new center of mass
    const newCenterX = weightedX / totalWeight
    const newCenterY = weightedY / totalWeight
    
    // Score based on how close to canvas center
    const canvasCenterX = canvas.width / 2
    const canvasCenterY = canvas.height / 2
    
    const distance = Math.sqrt(
      Math.pow(newCenterX - canvasCenterX, 2) +
      Math.pow(newCenterY - canvasCenterY, 2)
    )
    
    const maxDistance = Math.sqrt(
      Math.pow(canvas.width / 2, 2) +
      Math.pow(canvas.height / 2, 2)
    )
    
    return 10 * (1 - distance / maxDistance)
  }
  
  private static masonryLayout(
    objects: Array<{ id: string; width: number; height: number }>,
    canvas: { width: number; height: number },
    spacing: number
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    const columns: number[] = []
    const columnWidth = Math.floor((canvas.width - spacing) / 3) // 3 columns
    
    // Initialize columns
    for (let i = 0; i < 3; i++) {
      columns[i] = spacing
    }
    
    for (const obj of objects) {
      // Find shortest column
      let shortestCol = 0
      let minHeight = columns[0]
      
      for (let i = 1; i < columns.length; i++) {
        if (columns[i] < minHeight) {
          minHeight = columns[i]
          shortestCol = i
        }
      }
      
      // Place object
      const x = spacing + shortestCol * (columnWidth + spacing)
      const y = columns[shortestCol]
      
      positions.set(obj.id, { x, y })
      
      // Update column height
      columns[shortestCol] += obj.height + spacing
    }
    
    return positions
  }
  
  private static gridLayout(
    objects: Array<{ id: string; width: number; height: number }>,
    canvas: { width: number; height: number },
    spacing: number
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    const cols = Math.ceil(Math.sqrt(objects.length))
    const cellWidth = (canvas.width - spacing * (cols + 1)) / cols
    const cellHeight = cellWidth // Square cells
    
    objects.forEach((obj, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      
      const x = spacing + col * (cellWidth + spacing)
      const y = spacing + row * (cellHeight + spacing)
      
      positions.set(obj.id, { x, y })
    })
    
    return positions
  }
  
  private static flowLayout(
    objects: Array<{ id: string; width: number; height: number }>,
    canvas: { width: number; height: number },
    spacing: number,
    alignment?: 'left' | 'center' | 'right' | 'justify'
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    let currentX = spacing
    let currentY = spacing
    let rowHeight = 0
    
    for (const obj of objects) {
      // Check if object fits in current row
      if (currentX + obj.width + spacing > canvas.width) {
        // Move to next row
        currentX = spacing
        currentY += rowHeight + spacing
        rowHeight = 0
      }
      
      positions.set(obj.id, { x: currentX, y: currentY })
      
      currentX += obj.width + spacing
      rowHeight = Math.max(rowHeight, obj.height)
    }
    
    // Apply alignment
    if (alignment && alignment !== 'left') {
      // Group by rows
      const rows: Array<Array<{ id: string; x: number; width: number }>> = []
      let currentRow: Array<{ id: string; x: number; width: number }> = []
      let lastY = -1
      
      for (const [id, pos] of positions) {
        const obj = objects.find(o => o.id === id)!
        if (lastY !== -1 && pos.y !== lastY) {
          rows.push(currentRow)
          currentRow = []
        }
        currentRow.push({ id, x: pos.x, width: obj.width })
        lastY = pos.y
      }
      if (currentRow.length > 0) rows.push(currentRow)
      
      // Adjust positions based on alignment
      for (const row of rows) {
        const rowWidth = row[row.length - 1].x + row[row.length - 1].width - row[0].x
        const availableWidth = canvas.width - 2 * spacing
        
        let offset = 0
        switch (alignment) {
          case 'center':
            offset = (availableWidth - rowWidth) / 2
            break
          case 'right':
            offset = availableWidth - rowWidth
            break
          case 'justify':
            if (row.length > 1) {
              const totalGaps = row.length - 1
              const currentGaps = spacing * totalGaps
              const additionalSpace = availableWidth - rowWidth - currentGaps
              const extraSpacePerGap = additionalSpace / totalGaps
              
              for (let i = 1; i < row.length; i++) {
                const _prevItem = row[i - 1]
                const currentItem = row[i]
                const adjustment = i * extraSpacePerGap
                const pos = positions.get(currentItem.id)!
                positions.set(currentItem.id, { ...pos, x: pos.x + adjustment })
              }
              continue
            }
            break
        }
        
        // Apply offset
        for (const item of row) {
          const pos = positions.get(item.id)!
          positions.set(item.id, { ...pos, x: pos.x + offset })
        }
      }
    }
    
    return positions
  }
  
  private static radialLayout(
    objects: Array<{ id: string; width: number; height: number }>,
    canvas: { width: number; height: number }
  ): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = Math.min(canvas.width, canvas.height) * 0.3
    
    objects.forEach((obj, index) => {
      const angle = (index / objects.length) * Math.PI * 2
      const x = centerX + Math.cos(angle) * radius - obj.width / 2
      const y = centerY + Math.sin(angle) * radius - obj.height / 2
      
      positions.set(obj.id, { x, y })
    })
    
    return positions
  }
}

/**
 * Visual Balance Optimization System
 */
export class VisualBalanceOptimizer {
  /**
   * Analyze visual balance of composition
   */
  static analyzeBalance(
    layers: CompositionLayer[],
    canvas: { width: number; height: number }
  ): VisualBalance {
    // Calculate visual weights and positions
    const elements = layers.map(layer => ({
      x: layer.properties.x + layer.properties.width / 2,
      y: layer.properties.y + layer.properties.height / 2,
      weight: this.calculateVisualWeight(layer)
    }))
    
    // Calculate center of mass
    const centerOfMass = this.calculateCenterOfMass(elements)
    
    // Calculate balance scores
    const horizontal = this.calculateHorizontalBalance(elements, canvas, centerOfMass)
    const vertical = this.calculateVerticalBalance(elements, canvas, centerOfMass)
    const radial = this.calculateRadialBalance(elements, canvas, centerOfMass)
    
    // Overall balance
    const overall = (horizontal + vertical + radial) / 3
    
    // Generate suggestions
    const suggestions = this.generateBalanceSuggestions(
      { horizontal, vertical, radial, overall, centerOfMass, suggestions: [] },
      layers,
      canvas
    )
    
    return {
      horizontal,
      vertical,
      radial,
      overall,
      centerOfMass,
      suggestions
    }
  }
  
  /**
   * Optimize balance by suggesting layer adjustments
   */
  static optimizeBalance(
    layers: CompositionLayer[],
    canvas: { width: number; height: number },
    targetBalance: number = 0.8
  ): Array<{
    layerId: string
    adjustment: {
      x?: number
      y?: number
      scale?: number
      opacity?: number
    }
    improvement: number
  }> {
    const currentBalance = this.analyzeBalance(layers, canvas)
    const adjustments: Array<any> = []
    
    if (currentBalance.overall >= targetBalance) {
      return adjustments // Already balanced
    }
    
    // Try different adjustments
    for (const layer of layers) {
      // Skip important layers
      if (layer.metadata?.importance && layer.metadata.importance > 0.8) {
        continue
      }
      
      // Test position adjustments
      const positionTests = [
        { x: -20, y: 0 },
        { x: 20, y: 0 },
        { x: 0, y: -20 },
        { x: 0, y: 20 },
        { x: -20, y: -20 },
        { x: 20, y: 20 }
      ]
      
      for (const test of positionTests) {
        const testLayers = layers.map(l => 
          l.id === layer.id 
            ? {
                ...l,
                properties: {
                  ...l.properties,
                  x: l.properties.x + test.x,
                  y: l.properties.y + test.y
                }
              }
            : l
        )
        
        const newBalance = this.analyzeBalance(testLayers, canvas)
        const improvement = newBalance.overall - currentBalance.overall
        
        if (improvement > 0.05) {
          adjustments.push({
            layerId: layer.id,
            adjustment: test,
            improvement
          })
        }
      }
      
      // Test scale adjustments
      const scaleTests = [0.9, 1.1]
      for (const scale of scaleTests) {
        const testLayers = layers.map(l => 
          l.id === layer.id 
            ? {
                ...l,
                properties: {
                  ...l.properties,
                  scale: l.properties.scale * scale,
                  width: l.properties.width * scale,
                  height: l.properties.height * scale
                }
              }
            : l
        )
        
        const newBalance = this.analyzeBalance(testLayers, canvas)
        const improvement = newBalance.overall - currentBalance.overall
        
        if (improvement > 0.05) {
          adjustments.push({
            layerId: layer.id,
            adjustment: { scale },
            improvement
          })
        }
      }
    }
    
    // Sort by improvement and return top suggestions
    return adjustments
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 5)
  }
  
  private static calculateVisualWeight(layer: CompositionLayer): number {
    let weight = 1
    
    // Size contributes to weight
    const area = layer.properties.width * layer.properties.height
    weight *= Math.sqrt(area) / 100
    
    // Opacity affects weight
    weight *= layer.properties.opacity
    
    // Type affects weight
    const typeWeights = {
      'text': 1.5,
      'graphic': 1.3,
      'decoration': 0.8,
      'background': 0.3,
      'effect': 0.5,
      'original': 1,
      'overlay': 0.7
    }
    weight *= typeWeights[layer.type] || 1
    
    // Use metadata if available
    if (layer.metadata?.visualWeight) {
      weight = layer.metadata.visualWeight
    }
    
    return weight
  }
  
  private static calculateCenterOfMass(
    elements: Array<{ x: number; y: number; weight: number }>
  ): { x: number; y: number } {
    if (elements.length === 0) return { x: 0, y: 0 }
    
    let totalWeight = 0
    let weightedX = 0
    let weightedY = 0
    
    for (const elem of elements) {
      weightedX += elem.x * elem.weight
      weightedY += elem.y * elem.weight
      totalWeight += elem.weight
    }
    
    return {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight
    }
  }
  
  private static calculateHorizontalBalance(
    elements: Array<{ x: number; y: number; weight: number }>,
    canvas: { width: number; height: number },
    centerOfMass: { x: number; y: number }
  ): number {
    const centerX = canvas.width / 2
    const deviation = Math.abs(centerOfMass.x - centerX) / (canvas.width / 2)
    return Math.max(0, 1 - deviation)
  }
  
  private static calculateVerticalBalance(
    elements: Array<{ x: number; y: number; weight: number }>,
    canvas: { width: number; height: number },
    centerOfMass: { x: number; y: number }
  ): number {
    const centerY = canvas.height / 2
    const deviation = Math.abs(centerOfMass.y - centerY) / (canvas.height / 2)
    return Math.max(0, 1 - deviation)
  }
  
  private static calculateRadialBalance(
    elements: Array<{ x: number; y: number; weight: number }>,
    canvas: { width: number; height: number },
    centerOfMass: { x: number; y: number }
  ): number {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    // Calculate distance from center
    const distance = Math.sqrt(
      Math.pow(centerOfMass.x - centerX, 2) +
      Math.pow(centerOfMass.y - centerY, 2)
    )
    
    const maxDistance = Math.sqrt(
      Math.pow(canvas.width / 2, 2) +
      Math.pow(canvas.height / 2, 2)
    )
    
    return Math.max(0, 1 - distance / maxDistance)
  }
  
  private static generateBalanceSuggestions(
    balance: VisualBalance,
    layers: CompositionLayer[],
    canvas: { width: number; height: number }
  ): string[] {
    const suggestions: string[] = []
    
    if (balance.horizontal < 0.7) {
      const direction = balance.centerOfMass.x < canvas.width / 2 ? 'right' : 'left'
      suggestions.push(`Add visual weight to the ${direction} side for better horizontal balance`)
    }
    
    if (balance.vertical < 0.7) {
      const direction = balance.centerOfMass.y < canvas.height / 2 ? 'bottom' : 'top'
      suggestions.push(`Add visual weight to the ${direction} for better vertical balance`)
    }
    
    if (balance.radial < 0.7) {
      suggestions.push('Consider moving elements closer to the center for better radial balance')
    }
    
    // Check for clustering
    const clusters = this.detectClusters(layers)
    if (clusters.length > 0) {
      suggestions.push('Elements are clustered - consider spreading them out more evenly')
    }
    
    // Check for empty quadrants
    const emptyQuadrants = this.detectEmptyQuadrants(layers, canvas)
    if (emptyQuadrants.length > 0) {
      suggestions.push(`Consider adding elements to the ${emptyQuadrants.join(', ')} quadrant(s)`)
    }
    
    return suggestions
  }
  
  private static detectClusters(layers: CompositionLayer[]): Array<CompositionLayer[]> {
    const clusters: Array<CompositionLayer[]> = []
    const threshold = 50 // Distance threshold for clustering
    
    const processed = new Set<string>()
    
    for (const layer of layers) {
      if (processed.has(layer.id)) continue
      
      const cluster = [layer]
      processed.add(layer.id)
      
      // Find nearby layers
      for (const other of layers) {
        if (processed.has(other.id)) continue
        
        const distance = Math.sqrt(
          Math.pow(layer.properties.x - other.properties.x, 2) +
          Math.pow(layer.properties.y - other.properties.y, 2)
        )
        
        if (distance < threshold) {
          cluster.push(other)
          processed.add(other.id)
        }
      }
      
      if (cluster.length > 2) {
        clusters.push(cluster)
      }
    }
    
    return clusters
  }
  
  private static detectEmptyQuadrants(
    layers: CompositionLayer[],
    canvas: { width: number; height: number }
  ): string[] {
    const quadrants = {
      'top-left': false,
      'top-right': false,
      'bottom-left': false,
      'bottom-right': false
    }
    
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    
    for (const layer of layers) {
      const layerCenterX = layer.properties.x + layer.properties.width / 2
      const layerCenterY = layer.properties.y + layer.properties.height / 2
      
      if (layerCenterX < centerX && layerCenterY < centerY) {
        quadrants['top-left'] = true
      } else if (layerCenterX >= centerX && layerCenterY < centerY) {
        quadrants['top-right'] = true
      } else if (layerCenterX < centerX && layerCenterY >= centerY) {
        quadrants['bottom-left'] = true
      } else {
        quadrants['bottom-right'] = true
      }
    }
    
    return Object.entries(quadrants)
      .filter(([_, hasContent]) => !hasContent)
      .map(([quadrant]) => quadrant)
  }
}

/**
 * Composition Engine - Main orchestrator
 */
export class CompositionEngine {
  private layerManager: LayerManager
  
  constructor() {
    this.layerManager = new LayerManager()
  }
  
  /**
   * Compose all layers into final result
   */
  async compose(
    layers: CompositionLayer[],
    canvas: { width: number; height: number },
    options?: {
      optimizeBalance?: boolean
      targetBalance?: number
      autoBlendModes?: boolean
      preserveOriginal?: boolean
    }
  ): Promise<{
    layers: CompositionLayer[]
    balance: VisualBalance
    metadata: {
      totalLayers: number
      blendModesUsed: BlendMode[]
      optimizationsApplied: string[]
    }
  }> {
    // Add layers to manager
    layers.forEach(layer => this.layerManager.addLayer(layer))
    
    // Apply auto blend modes if enabled
    if (options?.autoBlendModes) {
      this.applyAutoBlendModes()
    }
    
    // Optimize balance if enabled
    const optimizationsApplied: string[] = []
    if (options?.optimizeBalance) {
      const adjustments = VisualBalanceOptimizer.optimizeBalance(
        this.layerManager.getRenderOrder(),
        canvas,
        options.targetBalance
      )
      
      // Apply adjustments
      for (const adjustment of adjustments) {
        const layer = this.layerManager.getRenderOrder().find(l => l.id === adjustment.layerId)
        if (layer) {
          if (adjustment.adjustment.x !== undefined) {
            layer.properties.x += adjustment.adjustment.x
          }
          if (adjustment.adjustment.y !== undefined) {
            layer.properties.y += adjustment.adjustment.y
          }
          if (adjustment.adjustment.scale !== undefined) {
            layer.properties.scale *= adjustment.adjustment.scale
            layer.properties.width *= adjustment.adjustment.scale
            layer.properties.height *= adjustment.adjustment.scale
          }
          optimizationsApplied.push(`Adjusted ${layer.id} for balance`)
        }
      }
    }
    
    // Get final layer order
    const finalLayers = this.layerManager.getRenderOrder()
    
    // Analyze final balance
    const balance = VisualBalanceOptimizer.analyzeBalance(finalLayers, canvas)
    
    // Collect blend modes used
    const blendModesUsed = [...new Set(finalLayers.map(l => l.properties.blendMode))]
    
    return {
      layers: finalLayers,
      balance,
      metadata: {
        totalLayers: finalLayers.length,
        blendModesUsed,
        optimizationsApplied
      }
    }
  }
  
  private applyAutoBlendModes(): void {
    const layers = this.layerManager.getRenderOrder()
    
    for (let i = 1; i < layers.length; i++) {
      const layer = layers[i]
      const _baseLayer = layers[i - 1]
      
      // Skip if blend mode already set
      if (layer.properties.blendMode !== 'normal') continue
      
      // Get representative colors (simplified)
      const baseColor = '#ffffff' // Would extract from actual content
      const overlayColor = '#000000' // Would extract from actual content
      
      const suggestion = BlendModeEngine.suggestBlendMode(
        layer.type,
        baseColor,
        overlayColor
      )
      
      layer.properties.blendMode = suggestion.mode
      layer.properties.opacity = suggestion.opacity
    }
  }
}

/**
 * Export convenience functions
 */
export const compositionAlgorithms = {
  LayerManager,
  BlendModeEngine,
  SmartPlacement,
  VisualBalanceOptimizer,
  CompositionEngine
}