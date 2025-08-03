import { ImprovementMetrics } from './types'
import { DocumentAnalysis } from '@/lib/ai/types'

export class EngagementPredictor {
  predictEngagement(
    beforeAnalysis: DocumentAnalysis,
    afterAnalysis: DocumentAnalysis,
    improvements: ImprovementMetrics
  ): {
    predictedScore: number
    improvementPercentage: number
    audienceImpact: {
      targetAudience: string
      engagementLikelihood: 'low' | 'medium' | 'high' | 'very high'
      keyImprovements: string[]
      expectedOutcomes: string[]
    }
  } {
    // Calculate predicted engagement score
    const baseEngagement = afterAnalysis.engagement.score
    const visualBoost = improvements.visualAppealGain * 0.3
    const readabilityBoost = improvements.readabilityGain * 0.25
    const layoutBoost = improvements.layoutImprovement * 0.2
    const colorBoost = improvements.colorHarmonyGain * 0.15
    const typographyBoost = improvements.typographyImprovement * 0.1
    
    const predictedScore = Math.min(100, 
      baseEngagement + visualBoost + readabilityBoost + layoutBoost + colorBoost + typographyBoost
    )
    
    const improvementPercentage = Math.round(
      ((predictedScore - beforeAnalysis.engagement.score) / beforeAnalysis.engagement.score) * 100
    )
    
    // Determine engagement likelihood
    const engagementLikelihood = this.calculateLikelihood(predictedScore, improvementPercentage)
    
    // Identify key improvements
    const keyImprovements = this.identifyKeyImprovements(improvements)
    
    // Predict outcomes
    const expectedOutcomes = this.predictOutcomes(
      predictedScore,
      improvementPercentage,
      afterAnalysis
    )
    
    // Determine target audience
    const targetAudience = this.identifyTargetAudience(afterAnalysis)
    
    return {
      predictedScore,
      improvementPercentage,
      audienceImpact: {
        targetAudience,
        engagementLikelihood,
        keyImprovements,
        expectedOutcomes
      }
    }
  }

  private calculateLikelihood(
    score: number,
    improvement: number
  ): 'low' | 'medium' | 'high' | 'very high' {
    if (score >= 85 || improvement >= 50) return 'very high'
    if (score >= 70 || improvement >= 30) return 'high'
    if (score >= 55 || improvement >= 15) return 'medium'
    return 'low'
  }

  private identifyKeyImprovements(improvements: ImprovementMetrics): string[] {
    const keyImprovements: string[] = []
    
    // Sort improvements by gain
    const gains = [
      { name: 'Visual Appeal', gain: improvements.visualAppealGain },
      { name: 'Readability', gain: improvements.readabilityGain },
      { name: 'Color Harmony', gain: improvements.colorHarmonyGain },
      { name: 'Layout Structure', gain: improvements.layoutImprovement },
      { name: 'Typography', gain: improvements.typographyImprovement }
    ].sort((a, b) => b.gain - a.gain)
    
    // Take top 3 improvements with significant gains
    gains
      .filter(g => g.gain > 5)
      .slice(0, 3)
      .forEach(g => {
        if (g.gain > 20) {
          keyImprovements.push(`Dramatic improvement in ${g.name.toLowerCase()} (+${g.gain} points)`)
        } else if (g.gain > 10) {
          keyImprovements.push(`Significant enhancement to ${g.name.toLowerCase()} (+${g.gain} points)`)
        } else {
          keyImprovements.push(`Improved ${g.name.toLowerCase()} (+${g.gain} points)`)
        }
      })
    
    // Add overall improvement if significant
    if (improvements.overallImprovement > 15) {
      keyImprovements.unshift(
        `Overall document quality increased by ${improvements.overallImprovement} points`
      )
    }
    
    return keyImprovements
  }

  private predictOutcomes(
    score: number,
    improvement: number,
    analysis: DocumentAnalysis
  ): string[] {
    const outcomes: string[] = []
    
    // Engagement outcomes
    if (score > 80) {
      outcomes.push('Viewers are likely to spend 2-3x more time engaging with the content')
    } else if (score > 65) {
      outcomes.push('Increased viewer attention and content retention')
    }
    
    // Visual appeal outcomes
    if (analysis.engagement.visualAppeal > 75) {
      outcomes.push('Strong first impression that captures audience interest immediately')
    }
    
    // Readability outcomes
    if (analysis.typography.readabilityScore > 80) {
      outcomes.push('Content is easily scannable and digestible for all reading levels')
    }
    
    // Call to action outcomes
    if (analysis.engagement.callToAction > 70) {
      outcomes.push('Clear action items that drive desired user behavior')
    }
    
    // Professional outcomes
    if (analysis.overallScore > 80) {
      outcomes.push('Professional appearance that builds trust and credibility')
    }
    
    // Improvement-based outcomes
    if (improvement > 40) {
      outcomes.push('Significant competitive advantage over similar unenhanced documents')
    } else if (improvement > 20) {
      outcomes.push('Noticeable improvement in audience engagement metrics')
    }
    
    return outcomes
  }

  private identifyTargetAudience(analysis: DocumentAnalysis): string {
    // Analyze document characteristics to determine likely audience
    const style = this.determineStyle(analysis)
    const complexity = this.assessComplexity(analysis)
    const formality = this.assessFormality(analysis)
    
    if (style === 'playful' && complexity === 'simple') {
      return 'Children and young learners (ages 6-12)'
    } else if (style === 'modern' && complexity === 'moderate') {
      return 'Students and young professionals (ages 16-35)'
    } else if (formality === 'high' && complexity === 'complex') {
      return 'Business professionals and executives'
    } else if (style === 'educational') {
      return 'Educators and academic audiences'
    } else {
      return 'General audience with diverse backgrounds'
    }
  }

  private determineStyle(analysis: DocumentAnalysis): string {
    // Analyze colors and layout to determine style
    const colorCount = analysis.colors.palette.length
    const brightness = this.calculateAverageBrightness(analysis.colors.palette)
    
    if (colorCount > 4 && brightness > 0.7) return 'playful'
    if (analysis.layout.score > 80) return 'modern'
    if (analysis.typography.score > 85) return 'educational'
    return 'professional'
  }

  private assessComplexity(analysis: DocumentAnalysis): 'simple' | 'moderate' | 'complex' {
    const layoutComplexity = analysis.layout.issues.length
    const contentDensity = 100 - analysis.engagement.visualAppeal // Inverse relationship
    
    if (layoutComplexity > 5 || contentDensity > 60) return 'complex'
    if (layoutComplexity > 2 || contentDensity > 40) return 'moderate'
    return 'simple'
  }

  private assessFormality(analysis: DocumentAnalysis): 'low' | 'medium' | 'high' {
    // Assess based on typography and color choices
    const hasFormalFonts = analysis.typography.issues.includes('Inconsistent font usage')
    const hasSubduedColors = this.calculateAverageSaturation(analysis.colors.palette) < 0.5
    
    if (hasFormalFonts && hasSubduedColors) return 'high'
    if (hasFormalFonts || hasSubduedColors) return 'medium'
    return 'low'
  }

  private calculateAverageBrightness(colors: string[]): number {
    // Simple brightness calculation
    const brightnesses = colors.map(color => {
      const hex = color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16) / 255
      const g = parseInt(hex.substr(2, 2), 16) / 255
      const b = parseInt(hex.substr(4, 2), 16) / 255
      return (r + g + b) / 3
    })
    
    return brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length
  }

  private calculateAverageSaturation(colors: string[]): number {
    // Simple saturation calculation
    const saturations = colors.map(color => {
      const hex = color.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16) / 255
      const g = parseInt(hex.substr(2, 2), 16) / 255
      const b = parseInt(hex.substr(4, 2), 16) / 255
      
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      
      if (max === 0) return 0
      return (max - min) / max
    })
    
    return saturations.reduce((a, b) => a + b, 0) / saturations.length
  }
}