import { DocumentAnalysis } from '@/lib/ai/types'
import { 
  AnalysisEngine as IAnalysisEngine, 
  DocumentContext,
  LayoutMetrics,
  ColorMetrics,
  TypographyMetrics,
  AgeAppropriateness,
  SubjectMatter,
  EngagementMetrics
} from './types'

import { LayoutAnalyzer } from './analyzers/layout'
import { ColorAnalyzer } from './analyzers/color'
import { TypographyAnalyzer } from './analyzers/typography'
import { AgeAppropriatenessAnalyzer } from './analyzers/age-appropriateness'
import { SubjectMatterAnalyzer } from './analyzers/subject-matter'
import { EngagementAnalyzer } from './analyzers/engagement'

export class DocumentAnalysisEngine implements IAnalysisEngine {
  private layoutAnalyzer: LayoutAnalyzer
  private colorAnalyzer: ColorAnalyzer
  private typographyAnalyzer: TypographyAnalyzer
  private ageAnalyzer: AgeAppropriatenessAnalyzer
  private subjectAnalyzer: SubjectMatterAnalyzer
  private engagementAnalyzer: EngagementAnalyzer

  constructor() {
    this.layoutAnalyzer = new LayoutAnalyzer()
    this.colorAnalyzer = new ColorAnalyzer()
    this.typographyAnalyzer = new TypographyAnalyzer()
    this.ageAnalyzer = new AgeAppropriatenessAnalyzer()
    this.subjectAnalyzer = new SubjectMatterAnalyzer()
    this.engagementAnalyzer = new EngagementAnalyzer()
  }

  async analyzeLayout(context: DocumentContext): Promise<LayoutMetrics> {
    return this.layoutAnalyzer.analyze(context)
  }

  async analyzeColors(context: DocumentContext): Promise<ColorMetrics> {
    return this.colorAnalyzer.analyze(context)
  }

  async analyzeTypography(context: DocumentContext): Promise<TypographyMetrics> {
    return this.typographyAnalyzer.analyze(context)
  }

  async analyzeAgeAppropriateness(context: DocumentContext): Promise<AgeAppropriateness> {
    return this.ageAnalyzer.analyze(context)
  }

  async identifySubjectMatter(context: DocumentContext): Promise<SubjectMatter> {
    return this.subjectAnalyzer.analyze(context)
  }

  async calculateEngagement(context: DocumentContext): Promise<EngagementMetrics> {
    return this.engagementAnalyzer.analyze(context)
  }

  async generateCompleteAnalysis(context: DocumentContext): Promise<DocumentAnalysis> {
    // Run all analyses in parallel for performance
    const [
      layoutMetrics,
      colorMetrics,
      typographyMetrics,
      ageAppropriateness,
      _subjectMatter,
      engagementMetrics
    ] = await Promise.all([
      this.analyzeLayout(context),
      this.analyzeColors(context),
      this.analyzeTypography(context),
      this.analyzeAgeAppropriateness(context),
      this.identifySubjectMatter(context),
      this.calculateEngagement(context)
    ])

    // Convert to DocumentAnalysis format
    const analysis = this.buildDocumentAnalysis(
      layoutMetrics,
      colorMetrics,
      typographyMetrics,
      engagementMetrics,
      ageAppropriateness
    )

    return analysis
  }

  private buildDocumentAnalysis(
    layout: LayoutMetrics,
    color: ColorMetrics,
    typography: TypographyMetrics,
    engagement: EngagementMetrics,
    age: AgeAppropriateness
  ): DocumentAnalysis {
    // Calculate layout score and generate issues/suggestions
    const layoutScore = this.calculateLayoutScore(layout)
    const layoutIssues = this.identifyLayoutIssues(layout)
    const layoutSuggestions = this.generateLayoutSuggestions(layout)

    // Calculate color score and generate issues/suggestions
    const colorScore = this.calculateColorScore(color)
    const colorIssues = this.identifyColorIssues(color)
    const colorSuggestions = this.generateColorSuggestions(color)

    // Calculate typography score and generate issues/suggestions
    const typographyScore = this.calculateTypographyScore(typography)
    const typographyIssues = this.identifyTypographyIssues(typography)
    const typographySuggestions = this.generateTypographySuggestions(typography)

    // Calculate engagement score
    const engagementScore = engagement.flowScore
    const engagementSuggestions = this.generateEngagementSuggestions(engagement, age)

    // Calculate overall score
    const overallScore = (layoutScore + colorScore + typographyScore + engagementScore) / 4

    // Determine priority based on scores
    const priority = this.determinePriority(overallScore)

    return {
      layout: {
        score: layoutScore,
        issues: layoutIssues,
        suggestions: layoutSuggestions
      },
      colors: {
        score: colorScore,
        palette: [...color.palette.primary, ...color.palette.secondary],
        issues: colorIssues,
        suggestions: colorSuggestions
      },
      typography: {
        score: typographyScore,
        fonts: typography.fonts.families,
        issues: typographyIssues,
        suggestions: typographySuggestions
      },
      engagement: {
        score: engagementScore,
        readability: typography.readability.score,
        visualAppeal: engagement.visualComplexity,
        suggestions: engagementSuggestions
      },
      overallScore,
      priority
    }
  }

  private calculateLayoutScore(layout: LayoutMetrics): number {
    const weights = {
      whitespace: 0.2,
      alignment: 0.25,
      hierarchy: 0.25,
      grid: 0.15,
      margins: 0.15
    }

    const whitespaceScore = this.scoreWhitespace(layout.whitespace)
    const alignmentScore = layout.alignment.consistency
    const hierarchyScore = layout.hierarchy.clarity
    const gridScore = layout.grid.detected ? layout.grid.consistency : 50
    const marginScore = layout.margins.consistency

    return Math.round(
      whitespaceScore * weights.whitespace +
      alignmentScore * weights.alignment +
      hierarchyScore * weights.hierarchy +
      gridScore * weights.grid +
      marginScore * weights.margins
    )
  }

  private calculateColorScore(color: ColorMetrics): number {
    const weights = {
      harmony: 0.35,
      contrast: 0.35,
      accessibility: 0.3
    }

    const harmonyScore = color.harmony.score
    const contrastScore = color.contrast.score
    const accessibilityScore = color.accessibility.colorBlindSafe ? 100 : 50

    return Math.round(
      harmonyScore * weights.harmony +
      contrastScore * weights.contrast +
      accessibilityScore * weights.accessibility
    )
  }

  private calculateTypographyScore(typography: TypographyMetrics): number {
    const weights = {
      hierarchy: 0.3,
      readability: 0.4,
      consistency: 0.3
    }

    const hierarchyScore = typography.hierarchy.consistency
    const readabilityScore = typography.readability.score
    const consistencyScore = (typography.consistency.fontPairing + typography.consistency.sizeRatio) / 2

    return Math.round(
      hierarchyScore * weights.hierarchy +
      readabilityScore * weights.readability +
      consistencyScore * weights.consistency
    )
  }

  private scoreWhitespace(percentage: number): number {
    // Optimal whitespace is 30-50%
    if (percentage >= 30 && percentage <= 50) return 100
    if (percentage < 30) return Math.max(0, percentage * 3.33)
    return Math.max(0, 100 - (percentage - 50) * 2)
  }

  private identifyLayoutIssues(layout: LayoutMetrics): string[] {
    const issues: string[] = []

    if (layout.whitespace < 20) issues.push('Insufficient whitespace')
    if (layout.whitespace > 70) issues.push('Excessive whitespace')
    if (layout.alignment.consistency < 70) issues.push('Inconsistent alignment')
    if (layout.hierarchy.levels < 2) issues.push('Weak visual hierarchy')
    if (layout.margins.consistency < 70) issues.push('Inconsistent margins')

    return issues
  }

  private identifyColorIssues(color: ColorMetrics): string[] {
    const issues: string[] = []

    if (!color.contrast.wcagAA) issues.push('Poor color contrast')
    if (color.harmony.score < 50) issues.push('Inharmonious color palette')
    if (!color.accessibility.colorBlindSafe) {
      issues.push(...color.accessibility.issues)
    }

    return issues
  }

  private identifyTypographyIssues(typography: TypographyMetrics): string[] {
    const issues: string[] = []

    if (typography.fonts.families.length > 3) issues.push('Too many font families')
    if (typography.hierarchy.levels < 2) issues.push('Insufficient text hierarchy')
    if (typography.readability.score < 60) issues.push('Poor readability')
    if (typography.consistency.fontPairing < 70) issues.push('Inconsistent font pairing')

    return issues
  }

  private generateLayoutSuggestions(layout: LayoutMetrics): string[] {
    const suggestions: string[] = []

    if (layout.whitespace < 20) {
      suggestions.push('Increase spacing between elements')
      suggestions.push('Reduce content density')
    }
    if (layout.alignment.consistency < 70) {
      suggestions.push('Align elements to a consistent grid')
      suggestions.push('Use consistent edge alignment')
    }
    if (layout.hierarchy.levels < 2) {
      suggestions.push('Create clear size distinctions between heading levels')
      suggestions.push('Use spacing to group related content')
    }

    return suggestions
  }

  private generateColorSuggestions(color: ColorMetrics): string[] {
    const suggestions: string[] = []

    if (!color.contrast.wcagAA) {
      suggestions.push('Increase contrast between text and background')
      suggestions.push('Use darker text on light backgrounds')
    }
    if (color.harmony.score < 50) {
      suggestions.push(`Consider a ${this.suggestColorScheme(color.harmony.type)} color scheme`)
      suggestions.push('Limit the color palette to 3-5 main colors')
    }
    if (!color.accessibility.colorBlindSafe) {
      suggestions.push('Avoid relying solely on color to convey information')
      suggestions.push('Add patterns or icons for better accessibility')
    }

    return suggestions
  }

  private generateTypographySuggestions(typography: TypographyMetrics): string[] {
    const suggestions: string[] = []

    if (typography.fonts.families.length > 3) {
      suggestions.push('Limit to 2-3 font families maximum')
      suggestions.push('Use font weights for variation instead of new fonts')
    }
    if (typography.readability.score < 60) {
      suggestions.push('Increase line height for better readability')
      suggestions.push('Use larger font sizes for body text')
    }
    if (typography.hierarchy.levels < 2) {
      suggestions.push('Create distinct heading sizes')
      suggestions.push('Use consistent size ratios (1.25x or 1.5x)')
    }

    return suggestions
  }

  private generateEngagementSuggestions(
    engagement: EngagementMetrics,
    age: AgeAppropriateness
  ): string[] {
    const suggestions: string[] = []

    if (engagement.visualComplexity < 30) {
      suggestions.push('Add visual interest with graphics or patterns')
    }
    if (engagement.visualComplexity > 80) {
      suggestions.push('Simplify the design to improve focus')
    }
    if (engagement.attentionAnchors < 3) {
      suggestions.push('Add focal points to guide attention')
    }
    if (engagement.flowScore < 60) {
      suggestions.push('Improve visual flow with better alignment')
    }

    // Age-specific suggestions
    if (age.detectedAge === 'children') {
      suggestions.push('Use more vibrant colors and playful elements')
    } else if (age.detectedAge === 'adults') {
      suggestions.push('Maintain professional appearance with clean design')
    }

    return suggestions
  }

  private suggestColorScheme(currentType: string): string {
    const schemes = ['monochromatic', 'analogous', 'complementary', 'triadic']
    return schemes.find(s => s !== currentType) || 'complementary'
  }

  private determinePriority(
    overall: number
  ): 'low' | 'medium' | 'high' {
    if (overall >= 80) return 'low'
    if (overall >= 60) return 'medium'
    return 'high'
  }
}