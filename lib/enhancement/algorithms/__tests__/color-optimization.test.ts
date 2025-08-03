import chroma from 'chroma-js'
import { ColorOptimization, ColorPalette } from '../color-optimization'

describe('ColorOptimization', () => {
  describe('generateComplementary', () => {
    it('generates basic complementary color', () => {
      const baseColor = '#FF0000' // Red
      const colors = ColorOptimization.generateComplementary(baseColor)
      
      expect(colors).toHaveLength(2)
      expect(colors[0]).toBe('#FF0000')
      
      // Complementary of red should be cyan-ish
      const complement = chroma(colors[1])
      const hue = complement.hsl()[0]
      expect(hue).toBeCloseTo(180, 0) // Cyan hue
    })

    it('generates complementary with variations', () => {
      const baseColor = '#3366CC' // Blue
      const colors = ColorOptimization.generateComplementary(baseColor, {
        variations: 1
      })
      
      expect(colors).toHaveLength(4)
      expect(colors[0]).toBe('#3366CC')
      
      // Check that variations include lighter versions
      const baseLuminance = chroma(colors[0]).luminance()
      const lighterBase = chroma(colors[2]).luminance()
      expect(lighterBase).toBeGreaterThan(baseLuminance)
    })

    it('generates complementary with multiple variations', () => {
      const baseColor = '#00AA00' // Green
      const colors = ColorOptimization.generateComplementary(baseColor, {
        variations: 2
      })
      
      expect(colors).toHaveLength(6)
      
      // Should have original, complement, 2 lighter, 2 darker
      const luminances = colors.map(c => chroma(c).luminance())
      const sorted = [...luminances].sort((a, b) => a - b)
      expect(sorted).toHaveLength(6)
    })

    it('preserves luminance when requested', () => {
      const baseColor = '#808080' // Gray
      const colors = ColorOptimization.generateComplementary(baseColor, {
        preserveLuminance: true
      })
      
      const baseLuminance = chroma(colors[0]).luminance()
      const complementLuminance = chroma(colors[1]).luminance()
      
      expect(complementLuminance).toBeCloseTo(baseLuminance, 1)
    })

    it('handles edge case hues correctly', () => {
      const baseColor = '#FF00FF' // Magenta (hue ~300)
      const colors = ColorOptimization.generateComplementary(baseColor)
      
      const complement = chroma(colors[1])
      const hue = complement.hsl()[0]
      
      // Complement should wrap around correctly
      expect(hue).toBeCloseTo(120, 1) // Green hue
    })
  })

  describe('generateSplitComplementary', () => {
    it('generates split-complementary scheme', () => {
      const baseColor = '#FF0000' // Red
      const colors = ColorOptimization.generateSplitComplementary(baseColor)
      
      expect(colors).toHaveLength(3)
      expect(colors[0]).toBe('#FF0000')
      
      // Split complements should be on either side of cyan
      const hue1 = chroma(colors[1]).hsl()[0]
      const hue2 = chroma(colors[2]).hsl()[0]
      
      expect(hue1).toBeCloseTo(150, 0) // Blue-green
      expect(hue2).toBeCloseTo(210, 0) // Blue
    })

    it('maintains saturation across split complements', () => {
      const baseColor = '#CC3366' // Saturated pink
      const colors = ColorOptimization.generateSplitComplementary(baseColor)
      
      const saturations = colors.map(c => chroma(c).hsl()[1])
      
      // Split complements should have 80% of base saturation
      expect(saturations[1]).toBeCloseTo(saturations[0] * 0.8, 1)
      expect(saturations[2]).toBeCloseTo(saturations[0] * 0.8, 1)
    })
  })

  describe('generateTriadic', () => {
    it('generates triadic color scheme', () => {
      const baseColor = '#FF0000' // Red
      const colors = ColorOptimization.generateTriadic(baseColor)
      
      expect(colors).toHaveLength(3)
      
      const hues = colors.map(c => chroma(c).hsl()[0])
      
      // Triadic colors should be 120 degrees apart
      expect(hues[1]).toBeCloseTo((hues[0] + 120) % 360, 1)
      expect(hues[2]).toBeCloseTo((hues[0] + 240) % 360, 1)
    })

    it('maintains saturation in triadic', () => {
      const baseColor = '#FF0000'
      const colors = ColorOptimization.generateTriadic(baseColor)
      
      // All triadic colors should have same saturation
      const saturations = colors.map(c => chroma(c).hsl()[1])
      expect(saturations[1]).toBeCloseTo(saturations[0], 1)
      expect(saturations[2]).toBeCloseTo(saturations[0], 1)
    })
  })

  describe('generateAnalogous', () => {
    it('generates analogous color scheme', () => {
      const baseColor = '#0080FF' // Blue
      const colors = ColorOptimization.generateAnalogous(baseColor)
      
      expect(colors).toHaveLength(3)
      
      const hues = colors.map(c => chroma(c).hsl()[0])
      
      // Analogous colors should be within 30-60 degrees
      const diff1 = Math.abs(hues[1] - hues[0])
      const diff2 = Math.abs(hues[2] - hues[0])
      
      expect(diff1).toBeLessThanOrEqual(60)
      expect(diff2).toBeLessThanOrEqual(60)
    })

    it('generates extended analogous scheme', () => {
      const baseColor = '#00AA00' // Green
      const colors = ColorOptimization.generateAnalogous(baseColor, 5)
      
      expect(colors).toHaveLength(5)
      
      // Check that colors are evenly spaced at 30 degrees
      const hues = colors.map(c => chroma(c).hsl()[0])
      for (let i = 1; i < hues.length; i++) {
        const diff = Math.abs(hues[i] - hues[i-1])
        expect(diff).toBeCloseTo(30, 1)
      }
    })
  })

  describe('fixContrast', () => {
    it('fixes contrast between two colors', () => {
      const color1 = '#666666' // Gray
      const color2 = '#FFFFFF' // White
      
      const result = ColorOptimization.fixContrast(color1, color2)
      
      expect(result.ratio).toBeGreaterThanOrEqual(4.5) // WCAG AA
      expect(result.foreground).toBeDefined()
      expect(result.background).toBeDefined()
    })

    it('adjusts colors for poor contrast', () => {
      const color1 = '#EEEEEE' // Very light gray
      const color2 = '#FFFFFF' // White
      
      const result = ColorOptimization.fixContrast(color1, color2)
      
      expect(result.ratio).toBeGreaterThanOrEqual(4.5)
      // Foreground should be darker than original
      expect(chroma(result.foreground).luminance()).toBeLessThan(chroma(color1).luminance())
    })

    it('preserves original colors when contrast is good', () => {
      const color1 = '#000000' // Black
      const color2 = '#FFFFFF' // White
      
      const result = ColorOptimization.fixContrast(color1, color2)
      
      expect(result.ratio).toBeGreaterThanOrEqual(7) // WCAG AAA
      expect(result.foreground).toBe('#000000')
      expect(result.background).toBe('#ffffff')
    })
  })

  describe('harmonizePalette', () => {
    it('harmonizes a set of colors', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00']
      const harmonized = ColorOptimization.harmonizePalette(colors)
      
      expect(harmonized).toHaveLength(4)
      
      // Harmonized colors should be more cohesive
      // Check that they all have valid hex values
      harmonized.forEach(color => {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i)
      })
    })

    it('harmonizes with specific method', () => {
      const colors = ['#FF0000', '#FF6600', '#FFCC00'] // Red to yellow gradient
      const harmonized = ColorOptimization.harmonizePalette(colors, {
        method: 'saturation'
      })
      
      // Check that colors are harmonized
      expect(harmonized).toHaveLength(3)
      
      // All colors should be valid
      harmonized.forEach(color => {
        expect(chroma.valid(color)).toBe(true)
      })
    })
  })

  describe('ensureAccessibility', () => {
    it('ensures accessible colors', () => {
      const palette: ColorPalette = {
        primary: '#666666',
        secondary: '#0066CC',
        accent: '#FF6600',
        neutral: ['#F5F5F5', '#E0E0E0', '#757575', '#424242', '#212121'],
        semantic: {
          success: '#4CAF50',
          warning: '#FF9800',
          error: '#F44336',
          info: '#2196F3'
        }
      }
      
      const result = ColorOptimization.ensureAccessibility(palette)
      
      expect(result.palette).toBeDefined()
      expect(result.report.wcagCompliant).toBeDefined()
      expect(result.report.colorBlindSafe).toBeDefined()
      expect(result.report.issues).toBeInstanceOf(Array)
      expect(result.report.suggestions).toBeInstanceOf(Array)
    })

    it('ensures accessibility with AAA standard', () => {
      const palette: ColorPalette = {
        primary: '#999999',
        secondary: '#0066CC',
        accent: '#FF6600',
        neutral: ['#F5F5F5', '#E0E0E0', '#757575', '#424242', '#212121'],
        semantic: {
          success: '#4CAF50',
          warning: '#FF9800',
          error: '#F44336',
          info: '#2196F3'
        }
      }
      
      const result = ColorOptimization.ensureAccessibility(palette, {
        wcagLevel: 'AAA'
      })
      
      expect(result.palette).toBeDefined()
      expect(result.report).toBeDefined()
      
      // Check that primary color was adjusted if needed
      const primaryContrast = chroma.contrast(result.palette.primary, '#FFFFFF')
      expect(primaryContrast).toBeGreaterThanOrEqual(7) // AAA standard
    })
  })

  describe('generateAccessibleVariations', () => {
    it('generates accessible variations', () => {
      const baseColor = '#666666'
      const variations = ColorOptimization.generateAccessibleVariations(baseColor)
      
      expect(variations.length).toBeGreaterThan(0)
      expect(variations.length).toBeLessThanOrEqual(5) // Default count
      
      // All variations should be valid colors
      variations.forEach(color => {
        expect(chroma.valid(color)).toBe(true)
      })
      
      // Check luminance spread
      const luminances = variations.map(c => chroma(c).luminance())
      expect(Math.min(...luminances)).toBeGreaterThanOrEqual(0.09) // Slightly lower threshold
      expect(Math.max(...luminances)).toBeLessThanOrEqual(0.9)
    })

    it('generates variations with neutrals', () => {
      const baseColor = '#3366CC'
      const variations = ColorOptimization.generateAccessibleVariations(baseColor, 3, {
        includeNeutrals: true
      })
      
      expect(variations.length).toBeGreaterThan(3) // 3 variations + 2 neutrals
      
      // Check that neutrals were added
      const saturations = variations.map(c => chroma(c).hsl()[1])
      const neutrals = saturations.filter(s => s < 0.2) // Low saturation = neutral
      expect(neutrals.length).toBeGreaterThanOrEqual(2)
    })
  })
})