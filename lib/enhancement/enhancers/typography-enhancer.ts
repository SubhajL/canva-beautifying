import { BaseEnhancer } from '../base-enhancer'
import { DocumentAnalysis } from '@/lib/ai/types'
import { EnhancementStrategy, EnhancementPreferences, TypographyEnhancement } from '../types'

export class TypographyEnhancer extends BaseEnhancer {
  private readonly fontPairings = [
    { heading: 'Playfair Display', body: 'Source Sans Pro', style: 'classic' },
    { heading: 'Montserrat', body: 'Open Sans', style: 'modern' },
    { heading: 'Roboto Slab', body: 'Roboto', style: 'professional' },
    { heading: 'Fredoka One', body: 'Nunito', style: 'playful' },
    { heading: 'Inter', body: 'Inter', style: 'minimalist' }
  ]

  private readonly scaleRatios = {
    minorSecond: 1.067,
    majorSecond: 1.125,
    minorThird: 1.2,
    majorThird: 1.25,
    perfectFourth: 1.333,
    augmentedFourth: 1.414,
    perfectFifth: 1.5,
    goldenRatio: 1.618
  }

  constructor() {
    super('Typography Enhancement', 'Improves font selection, hierarchy, and readability', 'high')
  }

  async analyze(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy[]> {
    const strategies: EnhancementStrategy[] = []
    const typographyScore = analysis.typography.score

    // Generate typography enhancement strategies
    if (typographyScore < 85) {
      const typographyStrategy = await this.generateTypographyStrategy(analysis, preferences)
      strategies.push(typographyStrategy)
    }

    // Add readability-focused strategy if needed
    if (analysis.engagement.readability < 70) {
      const readabilityStrategy = await this.generateReadabilityStrategy(analysis)
      strategies.push(readabilityStrategy)
    }

    return strategies
  }

  private async generateTypographyStrategy(
    analysis: DocumentAnalysis,
    preferences?: EnhancementPreferences
  ): Promise<EnhancementStrategy> {
    const style = preferences?.style || 'modern'
    const fontPairing = this.selectFontPairing(style)
    const baseSize = this.calculateOptimalBaseSize(analysis)
    const scale = this.selectTypeScale(analysis)

    const enhancement: TypographyEnhancement = {
      fonts: {
        heading: fontPairing.heading,
        body: fontPairing.body,
        accent: fontPairing.accent
      },
      sizes: {
        base: baseSize,
        scale: scale.ratio,
        headings: this.generateHeadingSizes(baseSize, scale.ratio)
      },
      improvements: {
        lineHeight: this.calculateOptimalLineHeight(baseSize),
        letterSpacing: this.calculateOptimalLetterSpacing(fontPairing.body),
        paragraphSpacing: this.calculateOptimalParagraphSpacing(baseSize)
      }
    }

    return {
      id: this.generateStrategyId(),
      name: 'Optimize Typography System',
      description: `Apply ${style} typography with ${fontPairing.heading} headings and ${fontPairing.body} body text`,
      priority: 'high',
      impact: this.scoreToImpact(analysis.typography.score),
      changes: {
        typography: enhancement
      }
    }
  }

  private async generateReadabilityStrategy(
    analysis: DocumentAnalysis
  ): Promise<EnhancementStrategy> {
    const currentFonts = analysis.typography.fonts
    const readableFonts = this.selectReadableFonts(currentFonts)
    const largerBaseSize = Math.max(16, this.calculateOptimalBaseSize(analysis) + 2)

    const enhancement: TypographyEnhancement = {
      fonts: readableFonts,
      sizes: {
        base: largerBaseSize,
        scale: this.scaleRatios.majorThird,
        headings: this.generateHeadingSizes(largerBaseSize, this.scaleRatios.majorThird)
      },
      improvements: {
        lineHeight: 1.6, // Optimal for readability
        letterSpacing: 0.02, // Slight positive spacing
        paragraphSpacing: 1.5 // More space between paragraphs
      }
    }

    return {
      id: this.generateStrategyId(),
      name: 'Enhance Readability',
      description: 'Improve text readability with larger sizes and better spacing',
      priority: 'high',
      impact: 85,
      changes: {
        typography: enhancement
      }
    }
  }

  private selectFontPairing(
    style: EnhancementPreferences['style']
  ): { heading: string; body: string; accent?: string } {
    // Filter pairings by style
    const stylePairings = this.fontPairings.filter(p => 
      style === 'modern' || p.style === style
    )

    // Default to first matching pairing
    const selected = stylePairings[0] || this.fontPairings[0]

    // Add accent font for creative styles
    if (style === 'playful' || style === 'creative') {
      return {
        ...selected,
        accent: 'Pacifico'
      }
    }

    return selected
  }

  private calculateOptimalBaseSize(analysis: DocumentAnalysis): number {
    // Start with standard base size
    let baseSize = 16

    // Adjust based on document type and content
    if (analysis.typography.issues.includes('Text too small')) {
      baseSize = 18
    } else if (analysis.typography.issues.includes('Inconsistent sizes')) {
      // Find median of current sizes
      const currentFonts = analysis.typography.fonts
      if (currentFonts.length > 0) {
        baseSize = 16 // Default to 16px for consistency
      }
    }

    return baseSize
  }

  private selectTypeScale(analysis: DocumentAnalysis): { name: string; ratio: number } {
    const hierarchyLevels = analysis.typography.issues.includes('Poor hierarchy') ? 5 : 3

    // Select scale based on hierarchy needs
    if (hierarchyLevels >= 5) {
      return { name: 'perfectFifth', ratio: this.scaleRatios.perfectFifth }
    } else if (hierarchyLevels >= 4) {
      return { name: 'majorThird', ratio: this.scaleRatios.majorThird }
    } else {
      return { name: 'minorThird', ratio: this.scaleRatios.minorThird }
    }
  }

  private generateHeadingSizes(baseSize: number, scale: number): number[] {
    const sizes: number[] = []
    let currentSize = baseSize

    // Generate 6 heading levels
    for (let i = 0; i < 6; i++) {
      currentSize = currentSize * scale
      sizes.unshift(Math.round(currentSize)) // Add to beginning for h1-h6 order
    }

    return sizes
  }

  private calculateOptimalLineHeight(baseSize: number): number {
    // Golden ratio for line height based on font size
    if (baseSize <= 14) return 1.7
    if (baseSize <= 16) return 1.6
    if (baseSize <= 18) return 1.5
    return 1.4
  }

  private calculateOptimalLetterSpacing(fontFamily: string): number {
    // Adjust letter spacing based on font characteristics
    const tightFonts = ['Inter', 'Helvetica', 'Arial']
    const looseFonts = ['Georgia', 'Times New Roman', 'Playfair Display']

    if (tightFonts.includes(fontFamily)) return 0.01
    if (looseFonts.includes(fontFamily)) return -0.01
    return 0 // Default
  }

  private calculateOptimalParagraphSpacing(baseSize: number): number {
    // Paragraph spacing as multiple of base size
    return baseSize * 0.75 / baseSize // Returns ratio
  }

  private selectReadableFonts(currentFonts: string[]): {
    heading: string
    body: string
    accent?: string
  } {
    // Select fonts optimized for readability
    const readablePairings = [
      { heading: 'Georgia', body: 'Verdana' },
      { heading: 'Merriweather', body: 'Source Sans Pro' },
      { heading: 'Lato', body: 'Lato' }
    ]

    // Try to maintain some style consistency
    const hasSerif = currentFonts.some(f => 
      ['Georgia', 'Times', 'Playfair', 'Merriweather'].some(serif => f.includes(serif))
    )

    return hasSerif ? readablePairings[1] : readablePairings[2]
  }
}