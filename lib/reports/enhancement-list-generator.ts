import { EnhancementStrategy } from '@/lib/enhancement/types'
import { AppliedEnhancement } from './types'

export class EnhancementListGenerator {
  generateEnhancementList(
    strategies: EnhancementStrategy[],
    appliedStrategies: string[]
  ): {
    applied: AppliedEnhancement[]
    totalCount: number
    byCategory: Record<string, number>
  } {
    const applied: AppliedEnhancement[] = []
    const byCategory: Record<string, number> = {
      color: 0,
      typography: 0,
      layout: 0,
      background: 0,
      decorative: 0
    }

    // Process applied strategies
    strategies
      .filter(strategy => appliedStrategies.includes(strategy.id))
      .forEach(strategy => {
        const enhancements = this.extractEnhancements(strategy)
        applied.push(...enhancements)
        
        // Count by category
        enhancements.forEach(enhancement => {
          byCategory[enhancement.category] = (byCategory[enhancement.category] || 0) + 1
        })
      })

    return {
      applied,
      totalCount: applied.length,
      byCategory
    }
  }

  private extractEnhancements(strategy: EnhancementStrategy): AppliedEnhancement[] {
    const enhancements: AppliedEnhancement[] = []

    // Extract color enhancements
    if (strategy.changes.colors) {
      const colorChanges = strategy.changes.colors
      
      if (colorChanges.palette) {
        enhancements.push({
          id: `${strategy.id}-palette`,
          name: 'Color Palette Optimization',
          category: 'color',
          description: 'Updated color palette for better harmony and visual appeal',
          impact: strategy.priority as 'low' | 'medium' | 'high',
          beforeValue: { palette: 'Original colors' },
          afterValue: colorChanges.palette,
          visualExample: this.generateColorExample(colorChanges.palette)
        })
      }

      if (colorChanges.adjustments) {
        enhancements.push({
          id: `${strategy.id}-adjustments`,
          name: 'Color Adjustments',
          category: 'color',
          description: 'Fine-tuned color properties for optimal viewing',
          impact: 'medium',
          beforeValue: { contrast: 0, saturation: 0, brightness: 0 },
          afterValue: colorChanges.adjustments
        })
      }
    }

    // Extract typography enhancements
    if (strategy.changes.typography) {
      const typographyChanges = strategy.changes.typography
      
      if (typographyChanges.fonts) {
        enhancements.push({
          id: `${strategy.id}-fonts`,
          name: 'Font Selection',
          category: 'typography',
          description: 'Updated fonts for improved readability and style',
          impact: strategy.priority as 'low' | 'medium' | 'high',
          beforeValue: 'Default fonts',
          afterValue: typographyChanges.fonts
        })
      }

      if (typographyChanges.sizes) {
        enhancements.push({
          id: `${strategy.id}-sizes`,
          name: 'Font Size Optimization',
          category: 'typography',
          description: 'Adjusted font sizes for better hierarchy',
          impact: 'medium',
          beforeValue: 'Original sizes',
          afterValue: typographyChanges.sizes
        })
      }

      if (typographyChanges.improvements) {
        enhancements.push({
          id: `${strategy.id}-spacing`,
          name: 'Text Spacing Improvements',
          category: 'typography',
          description: 'Enhanced line height and letter spacing',
          impact: 'low',
          beforeValue: 'Default spacing',
          afterValue: typographyChanges.improvements
        })
      }
    }

    // Extract layout enhancements
    if (strategy.changes.layout) {
      const layoutChanges = strategy.changes.layout
      
      if (layoutChanges.grid) {
        enhancements.push({
          id: `${strategy.id}-grid`,
          name: 'Grid System Implementation',
          category: 'layout',
          description: 'Applied structured grid for better organization',
          impact: 'high',
          beforeValue: 'No grid system',
          afterValue: layoutChanges.grid
        })
      }

      if (layoutChanges.spacing) {
        enhancements.push({
          id: `${strategy.id}-layout-spacing`,
          name: 'Spacing Optimization',
          category: 'layout',
          description: 'Improved white space and element spacing',
          impact: 'medium',
          beforeValue: 'Inconsistent spacing',
          afterValue: layoutChanges.spacing
        })
      }
    }

    // Extract background enhancements
    if (strategy.changes.background) {
      const backgroundChanges = strategy.changes.background
      
      enhancements.push({
        id: `${strategy.id}-background`,
        name: this.getBackgroundName(backgroundChanges.type),
        category: 'background',
        description: strategy.description,
        impact: strategy.priority as 'low' | 'medium' | 'high',
        beforeValue: 'Plain background',
        afterValue: backgroundChanges
      })
    }

    // Extract decorative elements
    if (strategy.changes.decorativeElements) {
      const elements = strategy.changes.decorativeElements
      
      enhancements.push({
        id: `${strategy.id}-decorative`,
        name: 'Decorative Elements',
        category: 'decorative',
        description: `Added ${elements.length} decorative elements`,
        impact: 'low',
        beforeValue: 'No decorative elements',
        afterValue: {
          count: elements.length,
          types: [...new Set(elements.map(e => e.type))]
        }
      })
    }

    return enhancements
  }

  private generateColorExample(palette: {
    primary: string
    secondary: string[]
    accent: string
    background: string
    text: string
  }): { before: string; after: string } {
    // Generate simple SVG color swatches
    const beforeColors = ['#cccccc', '#999999', '#666666', '#333333']
    const afterColors = [palette.primary, ...palette.secondary.slice(0, 2), palette.accent]
    
    const generateSwatch = (colors: string[]): string => {
      const size = 40
      const gap = 5
      const width = (size + gap) * colors.length
      
      let svg = `<svg width="${width}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
      colors.forEach((color, i) => {
        svg += `<rect x="${i * (size + gap)}" y="0" width="${size}" height="${size}" fill="${color}" stroke="#e5e7eb"/>`
      })
      svg += '</svg>'
      
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    }
    
    return {
      before: generateSwatch(beforeColors),
      after: generateSwatch(afterColors)
    }
  }

  private getBackgroundName(type: string): string {
    const names: Record<string, string> = {
      solid: 'Solid Background Color',
      gradient: 'Gradient Background',
      pattern: 'Pattern Background',
      image: 'AI-Generated Background'
    }
    return names[type] || 'Background Enhancement'
  }

  formatEnhancementDescription(enhancement: AppliedEnhancement): string {
    let description = enhancement.description
    
    // Add specific details based on category
    switch (enhancement.category) {
      case 'color':
        if (enhancement.afterValue && typeof enhancement.afterValue === 'object') {
          const palette = enhancement.afterValue as any
          if (palette.primary) {
            description += ` Primary color: ${palette.primary}.`
          }
        }
        break
        
      case 'typography':
        if (enhancement.afterValue && typeof enhancement.afterValue === 'object') {
          const fonts = enhancement.afterValue as any
          if (fonts.heading) {
            description += ` Heading font: ${fonts.heading}.`
          }
        }
        break
        
      case 'layout':
        if (enhancement.afterValue && typeof enhancement.afterValue === 'object') {
          const grid = enhancement.afterValue as any
          if (grid.columns) {
            description += ` ${grid.columns}-column grid system.`
          }
        }
        break
    }
    
    return description
  }
}