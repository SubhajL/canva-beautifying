import { 
  PipelineContext, 
  InitialAnalysisResult,
  EnhancementPlan,
  ColorAdjustment,
  FontSelection,
  PlannedSection,
  BackgroundRequirement,
  DecorativeRequirement,
  GraphicRequirement,
  WhitespaceAdjustment,
  DesignIssue,
  LayoutSection
} from '../types'
import { AIService } from '@/lib/ai/ai-service'
import chroma from 'chroma-js'

// Document type detection
type DocumentType = 'educational' | 'presentation' | 'marketing' | 'business' | 'creative' | 'technical' | 'general'

// Style mapping based on document type and user preferences
interface StyleProfile {
  colors: {
    mood: 'vibrant' | 'professional' | 'playful' | 'elegant' | 'technical'
    temperature: 'warm' | 'cool' | 'neutral'
    saturation: 'high' | 'medium' | 'low'
  }
  typography: {
    personality: 'modern' | 'classic' | 'friendly' | 'serious' | 'creative'
    formality: 'formal' | 'semi-formal' | 'casual'
  }
  layout: {
    density: 'spacious' | 'balanced' | 'compact'
    structure: 'grid' | 'asymmetric' | 'organic'
  }
  visuals: {
    style: 'minimalist' | 'decorative' | 'illustrative' | 'photographic'
    quantity: 'minimal' | 'moderate' | 'rich'
  }
}

// Enhancement scoring factors
interface EnhancementScores {
  colorImpact: number
  typographyImpact: number
  layoutImpact: number
  visualImpact: number
  overallPotential: number
}

export class EnhancementPlanningStage {
  private aiService: AIService
  private documentTypeProfiles: Record<DocumentType, Partial<StyleProfile>>

  constructor() {
    this.aiService = new AIService()
    
    // Initialize document type style profiles
    this.documentTypeProfiles = {
      educational: {
        colors: { mood: 'playful', temperature: 'warm', saturation: 'medium' },
        typography: { personality: 'friendly', formality: 'semi-formal' },
        layout: { density: 'spacious', structure: 'grid' },
        visuals: { style: 'illustrative', quantity: 'moderate' }
      },
      presentation: {
        colors: { mood: 'professional', temperature: 'neutral', saturation: 'medium' },
        typography: { personality: 'modern', formality: 'formal' },
        layout: { density: 'balanced', structure: 'grid' },
        visuals: { style: 'minimalist', quantity: 'moderate' }
      },
      marketing: {
        colors: { mood: 'vibrant', temperature: 'warm', saturation: 'high' },
        typography: { personality: 'modern', formality: 'semi-formal' },
        layout: { density: 'balanced', structure: 'asymmetric' },
        visuals: { style: 'photographic', quantity: 'rich' }
      },
      business: {
        colors: { mood: 'professional', temperature: 'cool', saturation: 'low' },
        typography: { personality: 'classic', formality: 'formal' },
        layout: { density: 'balanced', structure: 'grid' },
        visuals: { style: 'minimalist', quantity: 'minimal' }
      },
      creative: {
        colors: { mood: 'vibrant', temperature: 'warm', saturation: 'high' },
        typography: { personality: 'creative', formality: 'casual' },
        layout: { density: 'spacious', structure: 'organic' },
        visuals: { style: 'illustrative', quantity: 'rich' }
      },
      technical: {
        colors: { mood: 'technical', temperature: 'cool', saturation: 'low' },
        typography: { personality: 'modern', formality: 'formal' },
        layout: { density: 'compact', structure: 'grid' },
        visuals: { style: 'minimalist', quantity: 'minimal' }
      },
      general: {
        colors: { mood: 'professional', temperature: 'neutral', saturation: 'medium' },
        typography: { personality: 'modern', formality: 'semi-formal' },
        layout: { density: 'balanced', structure: 'grid' },
        visuals: { style: 'minimalist', quantity: 'moderate' }
      }
    }
  }

  async execute(
    context: PipelineContext,
    analysisResult: InitialAnalysisResult,
    signal?: AbortSignal
  ): Promise<EnhancementPlan> {
    try {
      // Detect document type and get style profile
      const documentType = this.detectDocumentType(analysisResult)
      const styleProfile = this.generateStyleProfile(documentType, context, analysisResult)
      
      // Calculate enhancement potential scores
      const enhancementScores = this.calculateEnhancementScores(analysisResult)
      
      // Generate AI-powered enhancement strategy
      const strategy = await this.generateEnhancementStrategy(
        context,
        analysisResult,
        documentType,
        styleProfile,
        enhancementScores,
        signal
      )
      
      // Plan enhancements in priority order
      const enhancementPromises = strategy.priority.map(async (priority) => {
        switch (priority) {
          case 'color':
            return {
              type: 'color',
              result: await this.planColorEnhancements(
                context,
                analysisResult,
                strategy,
                styleProfile,
                signal
              )
            }
          case 'typography':
            return {
              type: 'typography',
              result: await this.planTypographyEnhancements(
                context,
                analysisResult,
                strategy,
                styleProfile,
                documentType,
                signal
              )
            }
          case 'layout':
            return {
              type: 'layout',
              result: await this.planLayoutEnhancements(
                context,
                analysisResult,
                strategy,
                styleProfile,
                signal
              )
            }
          case 'visuals':
            return {
              type: 'visuals',
              result: await this.determineAssetRequirements(
                context,
                analysisResult,
                strategy,
                styleProfile,
                documentType,
                signal
              )
            }
          default:
            return null
        }
      })
      
      const results = await Promise.all(enhancementPromises)
      
      // Extract results
      let colorEnhancements = {} as EnhancementPlan['colorEnhancements']
      let typographyEnhancements = {} as EnhancementPlan['typographyEnhancements']
      let layoutEnhancements = {} as EnhancementPlan['layoutEnhancements']
      let assetRequirements = {} as EnhancementPlan['assetRequirements']
      
      results.forEach(result => {
        if (!result) return
        switch (result.type) {
          case 'color':
            colorEnhancements = result.result as EnhancementPlan['colorEnhancements']
            break
          case 'typography':
            typographyEnhancements = result.result as EnhancementPlan['typographyEnhancements']
            break
          case 'layout':
            layoutEnhancements = result.result as EnhancementPlan['layoutEnhancements']
            break
          case 'visuals':
            assetRequirements = result.result as EnhancementPlan['assetRequirements']
            break
        }
      })
      
      return {
        strategy,
        colorEnhancements,
        typographyEnhancements,
        layoutEnhancements,
        assetRequirements,
      }
    } catch (error) {
      console.error('Enhancement planning failed:', error)
      throw new Error(`Enhancement planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private detectDocumentType(analysis: InitialAnalysisResult): DocumentType {
    const { extractedText, layoutAnalysis, metadata } = analysis
    const detailedAnalysis = (metadata as any).detailedAnalysis
    
    // Keywords for different document types
    const keywords = {
      educational: ['lesson', 'worksheet', 'exercise', 'quiz', 'test', 'homework', 'student', 'teacher', 'learn', 'practice', 'answer', 'question'],
      presentation: ['slide', 'agenda', 'overview', 'summary', 'conclusion', 'objectives', 'goals'],
      marketing: ['sale', 'offer', 'discount', 'buy', 'shop', 'deal', 'promotion', 'new', 'exclusive', 'limited'],
      business: ['report', 'analysis', 'strategy', 'financial', 'quarterly', 'revenue', 'growth', 'metrics'],
      creative: ['design', 'art', 'creative', 'inspiration', 'portfolio', 'showcase', 'gallery'],
      technical: ['technical', 'specification', 'documentation', 'api', 'code', 'implementation', 'architecture']
    }
    
    // Count keyword matches
    const scores: Record<DocumentType, number> = {
      educational: 0,
      presentation: 0,
      marketing: 0,
      business: 0,
      creative: 0,
      technical: 0,
      general: 0
    }
    
    // Analyze text content
    const allText = [
      extractedText.title || '',
      ...extractedText.headings,
      ...extractedText.bodyText
    ].join(' ').toLowerCase()
    
    Object.entries(keywords).forEach(([type, words]) => {
      words.forEach(word => {
        if (allText.includes(word)) {
          scores[type as DocumentType] += 1
        }
      })
    })
    
    // Analyze structure
    if (metadata.pageCount && metadata.pageCount > 5) {
      scores.presentation += 3
    }
    
    if (layoutAnalysis.structure === 'grid' && extractedText.bodyText.length < 5) {
      scores.educational += 2
    }
    
    if (metadata.hasImages && metadata.imageCount > 3) {
      scores.marketing += 2
      scores.creative += 2
    }
    
    // Analyze visual style if available
    if (detailedAnalysis?.engagement) {
      const engagement = detailedAnalysis.engagement
      if (engagement.professionalScore > 85) {
        scores.business += 3
      }
      if (engagement.emotionalImpact.creativity > 70) {
        scores.creative += 3
      }
    }
    
    // Find the highest scoring type
    let maxScore = 0
    let detectedType: DocumentType = 'general'
    
    Object.entries(scores).forEach(([type, score]) => {
      if (score > maxScore) {
        maxScore = score
        detectedType = type as DocumentType
      }
    })
    
    // Default to general if no clear match
    if (maxScore < 2) {
      detectedType = 'general'
    }
    
    return detectedType
  }

  private generateStyleProfile(
    documentType: DocumentType,
    context: PipelineContext,
    analysis: InitialAnalysisResult
  ): StyleProfile {
    // Start with document type defaults
    const baseProfile = this.documentTypeProfiles[documentType] || this.documentTypeProfiles.general
    
    // Override with user preferences if provided
    const userStyle = context.settings?.targetStyle
    const userColorScheme = context.settings?.colorScheme
    
    const profile: StyleProfile = {
      colors: { ...baseProfile.colors! },
      typography: { ...baseProfile.typography! },
      layout: { ...baseProfile.layout! },
      visuals: { ...baseProfile.visuals! }
    }
    
    // Apply user style preferences
    if (userStyle) {
      switch (userStyle) {
        case 'modern':
          profile.colors.mood = 'vibrant'
          profile.typography.personality = 'modern'
          profile.layout.structure = 'asymmetric'
          break
        case 'classic':
          profile.colors.mood = 'elegant'
          profile.typography.personality = 'classic'
          profile.layout.structure = 'grid'
          break
        case 'playful':
          profile.colors.mood = 'playful'
          profile.typography.personality = 'friendly'
          profile.visuals.style = 'illustrative'
          break
        case 'professional':
          profile.colors.mood = 'professional'
          profile.typography.personality = 'serious'
          profile.layout.density = 'balanced'
          break
      }
    }
    
    // Apply user color scheme preferences
    if (userColorScheme) {
      switch (userColorScheme) {
        case 'vibrant':
          profile.colors.saturation = 'high'
          break
        case 'pastel':
          profile.colors.saturation = 'low'
          profile.colors.mood = 'playful'
          break
        case 'monochrome':
          profile.colors.saturation = 'low'
          profile.colors.temperature = 'neutral'
          break
      }
    }
    
    // Adjust based on current document state
    const detailedAnalysis = (analysis.metadata as any).detailedAnalysis
    if (detailedAnalysis?.enhancedLayout) {
      // If document already has good spacing, maintain it
      if (detailedAnalysis.enhancedLayout.whitespace > 30) {
        profile.layout.density = 'spacious'
      }
    }
    
    return profile
  }

  private calculateEnhancementScores(analysis: InitialAnalysisResult): EnhancementScores {
    const detailedAnalysis = (analysis.metadata as any).detailedAnalysis || {}
    
    // Calculate improvement potential for each area
    const colorImpact = this.calculateColorImpact(analysis, detailedAnalysis)
    const typographyImpact = this.calculateTypographyImpact(analysis, detailedAnalysis)
    const layoutImpact = this.calculateLayoutImpact(analysis, detailedAnalysis)
    const visualImpact = this.calculateVisualImpact(analysis, detailedAnalysis)
    
    // Overall potential is weighted average
    const overallPotential = (
      colorImpact * 0.25 +
      typographyImpact * 0.25 +
      layoutImpact * 0.3 +
      visualImpact * 0.2
    )
    
    return {
      colorImpact,
      typographyImpact,
      layoutImpact,
      visualImpact,
      overallPotential
    }
  }

  private calculateColorImpact(analysis: InitialAnalysisResult, detailedAnalysis: any): number {
    let impact = 100 - analysis.currentScore.color
    
    // Boost impact if specific issues exist
    if (detailedAnalysis?.color) {
      const colorAnalysis = detailedAnalysis.color
      if (colorAnalysis.harmony === 'chaotic') impact += 20
      if (colorAnalysis.contrast.issues.length > 0) impact += 15
      if (colorAnalysis.saturationLevel === 'muted' && analysis.currentScore.visuals < 60) impact += 10
    }
    
    // Check for color-related design issues
    const colorIssues = analysis.designIssues.filter(i => i.type === 'color' || i.type === 'contrast')
    impact += colorIssues.filter(i => i.severity === 'high').length * 10
    impact += colorIssues.filter(i => i.severity === 'medium').length * 5
    
    return Math.min(100, Math.max(0, impact))
  }

  private calculateTypographyImpact(analysis: InitialAnalysisResult, detailedAnalysis: any): number {
    let impact = 100 - analysis.currentScore.typography
    
    if (detailedAnalysis?.typography) {
      const typography = detailedAnalysis.typography
      if (typography.fontCount > 3) impact += 15
      if (typography.readabilityScore < 70) impact += 20
      if (typography.consistency < 70) impact += 15
      if (typography.hierarchy.clarity < 70) impact += 10
    }
    
    const typographyIssues = analysis.designIssues.filter(i => i.type === 'typography')
    impact += typographyIssues.filter(i => i.severity === 'high').length * 10
    impact += typographyIssues.filter(i => i.severity === 'medium').length * 5
    
    return Math.min(100, Math.max(0, impact))
  }

  private calculateLayoutImpact(analysis: InitialAnalysisResult, detailedAnalysis: any): number {
    let impact = 100 - analysis.currentScore.layout
    
    if (detailedAnalysis?.enhancedLayout) {
      const layout = detailedAnalysis.enhancedLayout
      if (layout.alignmentScore < 70) impact += 15
      if (layout.balanceScore < 70) impact += 15
      if (layout.margins.consistency < 70) impact += 10
      if (!layout.gridAnalysis.hasGrid && layout.structure !== 'freeform') impact += 10
    }
    
    // Whitespace issues
    if (analysis.layoutAnalysis.whitespace < 15 || analysis.layoutAnalysis.whitespace > 50) {
      impact += 15
    }
    
    const layoutIssues = analysis.designIssues.filter(i => 
      i.type === 'layout' || i.type === 'spacing' || i.type === 'alignment'
    )
    impact += layoutIssues.filter(i => i.severity === 'high').length * 10
    impact += layoutIssues.filter(i => i.severity === 'medium').length * 5
    
    return Math.min(100, Math.max(0, impact))
  }

  private calculateVisualImpact(analysis: InitialAnalysisResult, detailedAnalysis: any): number {
    let impact = 100 - analysis.currentScore.visuals
    
    // No images in document = high potential for visual enhancement
    if (!analysis.metadata.hasImages) {
      impact += 30
    }
    
    if (detailedAnalysis?.engagement) {
      const engagement = detailedAnalysis.engagement
      if (engagement.visualAppeal < 70) impact += 20
      if (engagement.predictedEngagement < 70) impact += 15
    }
    
    if (detailedAnalysis?.visualHierarchy) {
      const hierarchy = detailedAnalysis.visualHierarchy
      if (hierarchy.flowScore < 70) impact += 10
      if (hierarchy.scanPath === 'chaotic') impact += 15
    }
    
    return Math.min(100, Math.max(0, impact))
  }

  private async generateEnhancementStrategy(
    context: PipelineContext,
    analysis: InitialAnalysisResult,
    documentType: DocumentType,
    styleProfile: StyleProfile,
    enhancementScores: EnhancementScores,
    signal?: AbortSignal
  ): Promise<EnhancementPlan['strategy']> {
    // Determine approach based on scores and tier
    const approach = this.determineApproach(enhancementScores, context.subscriptionTier)
    
    // Determine priority based on impact scores
    const priority = this.determinePriority(enhancementScores, context.subscriptionTier)
    
    // Use AI to refine and validate strategy
    const prompt = `Refine this enhancement strategy for a ${documentType} document:

Document Analysis:
- Current Overall Score: ${analysis.currentScore.overall}/100
- Color Score: ${analysis.currentScore.color}/100 (Impact potential: ${enhancementScores.colorImpact}%)
- Typography Score: ${analysis.currentScore.typography}/100 (Impact potential: ${enhancementScores.typographyImpact}%)
- Layout Score: ${analysis.currentScore.layout}/100 (Impact potential: ${enhancementScores.layoutImpact}%)
- Visual Score: ${analysis.currentScore.visuals}/100 (Impact potential: ${enhancementScores.visualImpact}%)

Style Profile:
- Color Mood: ${styleProfile.colors.mood}
- Typography Personality: ${styleProfile.typography.personality}
- Layout Structure: ${styleProfile.layout.structure}
- Visual Style: ${styleProfile.visuals.style}

Initial Strategy:
- Approach: ${approach}
- Priority: ${priority.join(' → ')}
- User Tier: ${context.subscriptionTier}

Main Issues to Address:
${analysis.designIssues.slice(0, 5).map(i => `- ${i.type}: ${i.description} (${i.severity})`).join('\\n')}

Validate and refine this strategy. Consider:
1. Is the approach appropriate for the document type and issues?
2. Is the priority order optimal for maximum impact?
3. What's the realistic impact score we can achieve?

Return as JSON with approach, priority array, and estimatedImpact.`

    const response = await this.aiService.generate(
      prompt,
      { 
        model: context.subscriptionTier === 'premium' ? 'gpt-4o' : 'gpt-4o-mini',
        maxTokens: 400,
        temperature: 0.6,
        subscriptionTier: context.subscriptionTier
      },
      signal
    )
    
    const refinedStrategy = this.parseJSONResponse(response.content)
    
    return {
      approach: refinedStrategy.approach || approach,
      priority: Array.isArray(refinedStrategy.priority) ? refinedStrategy.priority : priority,
      estimatedImpact: Math.min(100, Math.max(0, refinedStrategy.estimatedImpact || enhancementScores.overallPotential))
    }
  }

  private determineApproach(
    scores: EnhancementScores,
    tier: string
  ): 'subtle' | 'moderate' | 'dramatic' {
    // Free tier is always subtle
    if (tier === 'free') return 'subtle'
    
    // Based on overall potential
    if (scores.overallPotential > 70) return 'dramatic'
    if (scores.overallPotential > 40) return 'moderate'
    return 'subtle'
  }

  private determinePriority(
    scores: EnhancementScores,
    tier: string
  ): ('color' | 'typography' | 'layout' | 'visuals')[] {
    // Create priority items with scores
    const priorities = [
      { type: 'color' as const, score: scores.colorImpact },
      { type: 'typography' as const, score: scores.typographyImpact },
      { type: 'layout' as const, score: scores.layoutImpact },
      { type: 'visuals' as const, score: scores.visualImpact }
    ]
    
    // Sort by impact score
    priorities.sort((a, b) => b.score - a.score)
    
    // Apply tier restrictions
    if (tier === 'free') {
      // Free tier only gets color and typography
      return priorities
        .filter(p => p.type === 'color' || p.type === 'typography')
        .map(p => p.type)
    }
    
    if (tier === 'basic') {
      // Basic tier doesn't get complex visuals
      return priorities
        .filter(p => p.type !== 'visuals' || p.score > 80)
        .map(p => p.type)
    }
    
    // Pro and Premium get all
    return priorities.map(p => p.type)
  }


  private async planColorEnhancements(
    context: PipelineContext,
    analysis: InitialAnalysisResult,
    strategy: EnhancementPlan['strategy'],
    styleProfile: StyleProfile,
    signal?: AbortSignal
  ): Promise<EnhancementPlan['colorEnhancements']> {
    const detailedAnalysis = (analysis.metadata as any).detailedAnalysis
    const colorAnalysis = detailedAnalysis?.color
    
    // Generate base palette based on style profile
    const basePalette = this.generateColorPalette(styleProfile, colorAnalysis)
    
    const prompt = `Create an enhanced color scheme for this document:

Current Color Analysis:
- Dominant Colors: ${colorAnalysis?.dominantColors?.slice(0, 3).join(', ') || 'Unknown'}
- Color Harmony: ${colorAnalysis?.harmony || 'Unknown'}
- Contrast Score: ${colorAnalysis?.contrast?.overall || 'Unknown'}/100
- Temperature: ${colorAnalysis?.colorTemperature || 'neutral'}
- Saturation: ${colorAnalysis?.saturationLevel || 'moderate'}

Design Issues:
${analysis.designIssues.filter(i => i.type === 'color' || i.type === 'contrast').map(i => `- ${i.description} (${i.severity})`).join('\n')}

Style Requirements:
- Mood: ${styleProfile.colors.mood}
- Temperature: ${styleProfile.colors.temperature}
- Saturation: ${styleProfile.colors.saturation}
- Approach: ${strategy.approach}

Base Palette Suggestion:
- Primary: ${basePalette.primary}
- Secondary: ${basePalette.secondary}
- Accent: ${basePalette.accent}
- Background: ${basePalette.background}
- Text: ${basePalette.text}

Refine this palette to:
1. Fix all contrast issues (WCAG AA minimum)
2. Create proper visual hierarchy
3. Match the style mood perfectly
4. Ensure color harmony
5. Consider color blindness accessibility

Include specific adjustments needed for existing colors in the document.

Return as JSON with hex colors and adjustment array.`

    const response = await this.aiService.generate(
      prompt,
      { 
        model: 'gpt-4o-mini',
        maxTokens: 600,
        temperature: 0.7,
        subscriptionTier: context.subscriptionTier
      },
      signal
    )
    
    const colors = this.parseJSONResponse(response.content)
    
    // Validate and ensure contrast compliance
    const enhancedPalette = this.validateColorPalette(colors, basePalette)
    
    // Generate comprehensive color adjustments
    const adjustments = this.generateColorAdjustments(
      colorAnalysis,
      enhancedPalette,
      analysis.designIssues,
      colors.adjustments
    )
    
    return {
      primaryColor: enhancedPalette.primary,
      secondaryColor: enhancedPalette.secondary,
      accentColor: enhancedPalette.accent,
      backgroundColor: enhancedPalette.background,
      textColor: enhancedPalette.text,
      adjustments,
    }
  }

  private generateColorPalette(styleProfile: StyleProfile, _currentColors: any) {
    const palettes = {
      vibrant: {
        warm: { primary: '#FF6B6B', secondary: '#4ECDC4', accent: '#FFE66D', background: '#FFFFFF', text: '#2D3436' },
        cool: { primary: '#4ECDC4', secondary: '#45B7D1', accent: '#96CEB4', background: '#FFFFFF', text: '#2C3E50' },
        neutral: { primary: '#6C5CE7', secondary: '#A29BFE', accent: '#FDCB6E', background: '#FFFFFF', text: '#2D3436' }
      },
      professional: {
        warm: { primary: '#E17055', secondary: '#FAB1A0', accent: '#74B9FF', background: '#FAFAFA', text: '#2D3436' },
        cool: { primary: '#0984E3', secondary: '#74B9FF', accent: '#A29BFE', background: '#F8F9FA', text: '#2C3E50' },
        neutral: { primary: '#2D3436', secondary: '#636E72', accent: '#0984E3', background: '#FFFFFF', text: '#2D3436' }
      },
      playful: {
        warm: { primary: '#FF7979', secondary: '#F9CA24', accent: '#6AB04C', background: '#FFF5F5', text: '#2C3E50' },
        cool: { primary: '#686DE0', secondary: '#4834D4', accent: '#22A6B3', background: '#F0F3FF', text: '#130F40' },
        neutral: { primary: '#BE2EDD', secondary: '#6C5CE7', accent: '#0984E3', background: '#FFEEFF', text: '#2D3436' }
      },
      elegant: {
        warm: { primary: '#B8926A', secondary: '#D4AF37', accent: '#8B7355', background: '#FAF8F6', text: '#2C2416' },
        cool: { primary: '#4A5568', secondary: '#718096', accent: '#2D3748', background: '#F7FAFC', text: '#1A202C' },
        neutral: { primary: '#2D3436', secondary: '#636E72', accent: '#B2BEC3', background: '#FAFAFA', text: '#2D3436' }
      },
      technical: {
        warm: { primary: '#FF6B6B', secondary: '#4ECDC4', accent: '#FFE66D', background: '#1E1E1E', text: '#E0E0E0' },
        cool: { primary: '#00D2D3', secondary: '#01A3A4', accent: '#00B894', background: '#0F0F0F', text: '#F0F0F0' },
        neutral: { primary: '#4A90E2', secondary: '#50E3C2', accent: '#F5A623', background: '#FFFFFF', text: '#333333' }
      }
    }
    
    const mood = styleProfile.colors.mood
    const temp = styleProfile.colors.temperature
    
    // Get appropriate palette
    const moodPalettes = palettes[mood] || palettes.professional
    const selectedPalette = moodPalettes[temp] || moodPalettes.neutral
    
    // Adjust saturation
    if (styleProfile.colors.saturation === 'low') {
      // Desaturate colors
      return {
        primary: this.adjustSaturation(selectedPalette.primary, 0.5),
        secondary: this.adjustSaturation(selectedPalette.secondary, 0.5),
        accent: this.adjustSaturation(selectedPalette.accent, 0.6),
        background: selectedPalette.background,
        text: selectedPalette.text
      }
    } else if (styleProfile.colors.saturation === 'high') {
      // Increase saturation
      return {
        primary: this.adjustSaturation(selectedPalette.primary, 1.3),
        secondary: this.adjustSaturation(selectedPalette.secondary, 1.2),
        accent: this.adjustSaturation(selectedPalette.accent, 1.4),
        background: selectedPalette.background,
        text: selectedPalette.text
      }
    }
    
    return selectedPalette
  }

  private adjustSaturation(color: string, factor: number): string {
    try {
      return chroma(color).saturate(factor - 1).hex()
    } catch {
      return color
    }
  }

  private validateColorPalette(aiColors: any, basePalette: any) {
    const validateColor = (color: string, fallback: string) => {
      if (!color || !color.match(/^#[0-9A-Fa-f]{6}$/)) {
        return fallback
      }
      return color
    }
    
    const palette = {
      primary: validateColor(aiColors.primaryColor, basePalette.primary),
      secondary: validateColor(aiColors.secondaryColor, basePalette.secondary),
      accent: validateColor(aiColors.accentColor, basePalette.accent),
      background: validateColor(aiColors.backgroundColor, basePalette.background),
      text: validateColor(aiColors.textColor, basePalette.text)
    }
    
    // Ensure contrast compliance
    const bgColor = chroma(palette.background)
    const textColor = chroma(palette.text)
    const contrast = chroma.contrast(bgColor, textColor)
    
    // If contrast is too low, adjust text color
    if (contrast < 4.5) {
      const isLightBg = bgColor.luminance() > 0.5
      palette.text = isLightBg ? '#1A202C' : '#F7FAFC'
    }
    
    return palette
  }

  private generateColorAdjustments(
    currentColors: any,
    newPalette: any,
    issues: DesignIssue[],
    aiAdjustments: any[]
  ): ColorAdjustment[] {
    const adjustments: ColorAdjustment[] = []
    
    // Add contrast fixes
    const contrastIssues = issues.filter(i => i.type === 'contrast')
    if (contrastIssues.length > 0) {
      adjustments.push({
        target: 'text',
        from: currentColors?.palette?.text || '#000000',
        to: newPalette.text,
        reason: 'Improve text contrast for better readability'
      })
    }
    
    // Add harmony fixes
    if (currentColors?.harmony === 'chaotic') {
      adjustments.push({
        target: 'accent',
        from: currentColors?.palette?.accent || '#FF0000',
        to: newPalette.accent,
        reason: 'Create harmonious color relationships'
      })
    }
    
    // Add AI-suggested adjustments
    if (Array.isArray(aiAdjustments)) {
      aiAdjustments.forEach(adj => {
        if (adj.target && adj.to) {
          adjustments.push({
            target: adj.target,
            from: adj.from || '#000000',
            to: adj.to,
            reason: adj.reason || 'Enhance visual appeal'
          })
        }
      })
    }
    
    // Remove duplicates
    const uniqueAdjustments = adjustments.filter((adj, index, self) =>
      index === self.findIndex(a => a.target === adj.target && a.to === adj.to)
    )
    
    return uniqueAdjustments
  }

  private async planTypographyEnhancements(
    context: PipelineContext,
    analysis: InitialAnalysisResult,
    strategy: EnhancementPlan['strategy'],
    styleProfile: StyleProfile,
    documentType: DocumentType,
    signal?: AbortSignal
  ): Promise<EnhancementPlan['typographyEnhancements']> {
    const detailedAnalysis = (analysis.metadata as any).detailedAnalysis
    const typographyAnalysis = detailedAnalysis?.typography
    
    // Get font recommendations based on style
    const fontRecs = this.getTypographyRecommendations(styleProfile, documentType)
    
    const prompt = `Create a typography system for this ${documentType} document:

Current Typography Analysis:
- Font Count: ${typographyAnalysis?.fontCount || 'Unknown'}
- Size Variations: ${typographyAnalysis?.sizeVariations || 'Unknown'}
- Readability Score: ${typographyAnalysis?.readabilityScore || 'Unknown'}/100
- Consistency: ${typographyAnalysis?.consistency || 'Unknown'}/100
- Hierarchy Clarity: ${typographyAnalysis?.hierarchy?.clarity || 'Unknown'}/100

Content Structure:
- Title: ${analysis.extractedText.title ? 'Present' : 'Missing'}
- Headings: ${analysis.extractedText.headings.length} found
- Body paragraphs: ${analysis.extractedText.bodyText.length}
- Captions: ${analysis.extractedText.captions.length}

Style Requirements:
- Personality: ${styleProfile.typography.personality}
- Formality: ${styleProfile.typography.formality}
- Approach: ${strategy.approach}

Recommended Font Pairings:
${fontRecs.map(rec => `- ${rec.heading} + ${rec.body} (${rec.style})`).join('\n')}

Design a complete typography system:
1. Select fonts that match the personality and ensure excellent readability
2. Create a clear size hierarchy with proper ratios (consider modular scale)
3. Set appropriate line heights for different text types
4. Add letter spacing if needed for headlines
5. Ensure the system works well at different screen sizes

Return as JSON with headingFont, bodyFont, sizes, lineHeight, and letterSpacing.`

    const response = await this.aiService.generate(
      prompt,
      { 
        model: 'gpt-4o-mini',
        maxTokens: 500,
        temperature: 0.6,
        subscriptionTier: context.subscriptionTier
      },
      signal
    )
    
    const typography = this.parseJSONResponse(response.content)
    
    // Apply modular scale for size hierarchy
    const sizes = this.generateModularScale(
      typography.sizes?.body || 16,
      strategy.approach
    )
    
    const headingFont: FontSelection = {
      family: typography.headingFont?.family || fontRecs[0].heading,
      weight: typography.headingFont?.weight || 700,
      style: 'normal',
      fallback: typography.headingFont?.fallback || ['Helvetica Neue', 'Arial', 'sans-serif'],
    }
    
    const bodyFont: FontSelection = {
      family: typography.bodyFont?.family || fontRecs[0].body,
      weight: typography.bodyFont?.weight || 400,
      style: 'normal',
      fallback: typography.bodyFont?.fallback || ['Helvetica', 'Arial', 'sans-serif'],
    }
    
    // Calculate optimal line heights
    const lineHeight = this.calculateLineHeight(sizes.body, documentType)
    
    return {
      headingFont,
      bodyFont,
      sizes: {
        h1: typography.sizes?.h1 || sizes.h1,
        h2: typography.sizes?.h2 || sizes.h2,
        h3: typography.sizes?.h3 || sizes.h3,
        body: typography.sizes?.body || sizes.body,
        caption: typography.sizes?.caption || sizes.caption,
      },
      lineHeight: typography.lineHeight || lineHeight,
      letterSpacing: typography.letterSpacing || (styleProfile.typography.personality === 'modern' ? 0.02 : 0),
    }
  }

  private getTypographyRecommendations(styleProfile: StyleProfile, _documentType: DocumentType) {
    const recommendations = {
      modern: [
        { heading: 'Inter', body: 'Inter', style: 'clean and versatile' },
        { heading: 'Montserrat', body: 'Open Sans', style: 'contemporary' },
        { heading: 'Poppins', body: 'Roboto', style: 'geometric modern' }
      ],
      classic: [
        { heading: 'Playfair Display', body: 'Lora', style: 'elegant serif' },
        { heading: 'Merriweather', body: 'Source Sans Pro', style: 'traditional' },
        { heading: 'Georgia', body: 'Helvetica', style: 'timeless' }
      ],
      friendly: [
        { heading: 'Fredoka', body: 'Nunito', style: 'approachable' },
        { heading: 'Quicksand', body: 'Lato', style: 'soft and friendly' },
        { heading: 'Comfortaa', body: 'Open Sans', style: 'rounded' }
      ],
      serious: [
        { heading: 'Roboto Slab', body: 'Roboto', style: 'professional' },
        { heading: 'IBM Plex Sans', body: 'IBM Plex Sans', style: 'corporate' },
        { heading: 'Source Serif Pro', body: 'Source Sans Pro', style: 'authoritative' }
      ],
      creative: [
        { heading: 'Bebas Neue', body: 'Montserrat', style: 'bold and impactful' },
        { heading: 'Righteous', body: 'Karla', style: 'unique' },
        { heading: 'Space Grotesk', body: 'Inter', style: 'futuristic' }
      ]
    }
    
    const personality = styleProfile.typography.personality
    return recommendations[personality] || recommendations.modern
  }

  private generateModularScale(baseSize: number, approach: string) {
    // Use different scales based on approach
    const scales = {
      subtle: 1.125,    // Minor second
      moderate: 1.25,   // Major third
      dramatic: 1.333   // Perfect fourth
    }
    
    const scale = scales[approach] || 1.25
    
    return {
      h1: Math.round(baseSize * Math.pow(scale, 3)),
      h2: Math.round(baseSize * Math.pow(scale, 2)),
      h3: Math.round(baseSize * Math.pow(scale, 1)),
      body: baseSize,
      caption: Math.round(baseSize / scale)
    }
  }

  private calculateLineHeight(bodySize: number, documentType: DocumentType): number {
    // Different document types need different line heights
    const baseLineHeight = {
      educational: 1.7,    // More space for easier reading
      presentation: 1.5,   // Balanced for slides
      marketing: 1.6,      // Good for scanning
      business: 1.5,       // Professional standard
      creative: 1.4,       // Tighter for visual impact
      technical: 1.6,      // Good for documentation
      general: 1.5
    }
    
    // Adjust based on font size
    const sizeAdjustment = bodySize < 14 ? 0.1 : bodySize > 18 ? -0.1 : 0
    
    return baseLineHeight[documentType] + sizeAdjustment
  }

  private async planLayoutEnhancements(
    context: PipelineContext,
    analysis: InitialAnalysisResult,
    strategy: EnhancementPlan['strategy'],
    styleProfile: StyleProfile,
    signal?: AbortSignal
  ): Promise<EnhancementPlan['layoutEnhancements']> {
    const detailedAnalysis = (analysis.metadata as any).detailedAnalysis
    const enhancedLayout = detailedAnalysis?.enhancedLayout
    
    // Calculate grid specifications based on style
    const gridSpecs = this.calculateGridSpecifications(styleProfile, analysis)
    
    const prompt = `Design an enhanced layout system for this document:

Current Layout Analysis:
- Structure: ${analysis.layoutAnalysis.structure}
- Sections: ${analysis.layoutAnalysis.sections.map(s => `${s.type}(${s.bounds.width}x${s.bounds.height})`).join(', ')}
- Whitespace: ${analysis.layoutAnalysis.whitespace}%
- Alignment Score: ${enhancedLayout?.alignmentScore || 'Unknown'}/100
- Balance Score: ${enhancedLayout?.balanceScore || 'Unknown'}/100
- Current Margins: T:${enhancedLayout?.margins?.top || '?'} R:${enhancedLayout?.margins?.right || '?'} B:${enhancedLayout?.margins?.bottom || '?'} L:${enhancedLayout?.margins?.left || '?'}

Layout Issues:
${analysis.designIssues.filter(i => i.type === 'layout' || i.type === 'spacing' || i.type === 'alignment').map(i => `- ${i.description} (${i.severity})`).join('\n')}

Style Requirements:
- Density: ${styleProfile.layout.density}
- Structure: ${styleProfile.layout.structure}
- Approach: ${strategy.approach}

Recommended Grid: ${gridSpecs.columns} columns, ${gridSpecs.gutter}px gutters, ${gridSpecs.margin}px margins

Create an improved layout that:
1. Fixes alignment and balance issues
2. Optimizes whitespace distribution
3. Improves visual flow and hierarchy
4. Maintains content readability
5. Follows the style density preference

For each section, suggest specific modifications like repositioning, resizing, or restructuring.

Return as JSON with grid specs, section modifications, and whitespace adjustments.`

    const response = await this.aiService.generate(
      prompt,
      { 
        model: 'gpt-4o-mini',
        maxTokens: 600,
        temperature: 0.6,
        subscriptionTier: context.subscriptionTier
      },
      signal
    )
    
    const layout = this.parseJSONResponse(response.content)
    
    // Process sections with intelligent modifications
    const sections = this.planSectionModifications(
      analysis.layoutAnalysis.sections,
      layout.sections,
      styleProfile,
      gridSpecs
    )
    
    // Generate whitespace adjustments
    const whitespaceAdjustments = this.generateWhitespaceAdjustments(
      analysis,
      enhancedLayout,
      styleProfile,
      layout.whitespaceAdjustments
    )
    
    return {
      grid: {
        columns: layout.grid?.columns || gridSpecs.columns,
        gutter: layout.grid?.gutter || gridSpecs.gutter,
        margin: layout.grid?.margin || gridSpecs.margin,
      },
      sections,
      whitespaceAdjustments,
    }
  }

  private calculateGridSpecifications(styleProfile: StyleProfile, analysis: InitialAnalysisResult) {
    const gridPresets = {
      spacious: { columns: 12, gutter: 32, margin: 64 },
      balanced: { columns: 12, gutter: 24, margin: 48 },
      compact: { columns: 16, gutter: 16, margin: 32 }
    }
    
    const baseGrid = gridPresets[styleProfile.layout.density]
    
    // Adjust for document dimensions
    const { width } = analysis.metadata.dimensions
    if (width < 768) {
      // Mobile/small documents
      return {
        columns: 4,
        gutter: Math.round(baseGrid.gutter * 0.75),
        margin: Math.round(baseGrid.margin * 0.75)
      }
    } else if (width < 1200) {
      // Tablet/medium documents
      return {
        columns: 8,
        gutter: baseGrid.gutter,
        margin: Math.round(baseGrid.margin * 0.875)
      }
    }
    
    return baseGrid
  }

  private planSectionModifications(
    currentSections: LayoutSection[],
    aiSuggestions: any[],
    styleProfile: StyleProfile,
    gridSpecs: any
  ): PlannedSection[] {
    const plannedSections: PlannedSection[] = []
    
    currentSections.forEach((section, index) => {
      const suggestion = aiSuggestions?.find(s => s.id === section.id) || aiSuggestions?.[index]
      
      const modifications: string[] = []
      let newBounds = { ...section.bounds }
      
      // Apply grid alignment
      if (styleProfile.layout.structure === 'grid') {
        const colWidth = 100 / gridSpecs.columns
        newBounds.x = Math.round(newBounds.x / colWidth) * colWidth
        newBounds.width = Math.round(newBounds.width / colWidth) * colWidth
        modifications.push('Align to grid system')
      }
      
      // Apply AI suggestions
      if (suggestion) {
        if (suggestion.newBounds) {
          newBounds = suggestion.newBounds
        }
        if (suggestion.modifications) {
          modifications.push(...suggestion.modifications)
        }
      }
      
      // Add density-based modifications
      if (styleProfile.layout.density === 'spacious' && section.type === 'content') {
        modifications.push('Increase padding and margins')
      } else if (styleProfile.layout.density === 'compact') {
        modifications.push('Optimize space usage')
      }
      
      plannedSections.push({
        id: section.id,
        type: section.type,
        newBounds,
        modifications
      })
    })
    
    return plannedSections
  }

  private generateWhitespaceAdjustments(
    analysis: InitialAnalysisResult,
    enhancedLayout: any,
    styleProfile: StyleProfile,
    aiSuggestions: any[]
  ): WhitespaceAdjustment[] {
    const adjustments: WhitespaceAdjustment[] = []
    
    // Base adjustments from style profile
    const densityMultipliers = {
      spacious: 1.5,
      balanced: 1.0,
      compact: 0.75
    }
    
    const multiplier = densityMultipliers[styleProfile.layout.density]
    
    // Margin adjustments
    const _currentMargins = enhancedLayout?.margins || { top: 40, right: 40, bottom: 40, left: 40 }
    adjustments.push({
      area: 'margins',
      value: Math.round(48 * multiplier),
      unit: 'px'
    })
    
    // Padding adjustments based on issues
    if (analysis.layoutAnalysis.whitespace < 20) {
      adjustments.push({
        area: 'padding',
        value: Math.round(24 * multiplier),
        unit: 'px'
      })
    }
    
    // Spacing adjustments
    if (enhancedLayout?.spacing?.consistency < 70) {
      adjustments.push({
        area: 'spacing',
        value: Math.round(16 * multiplier),
        unit: 'px'
      })
    }
    
    // Add AI suggestions
    if (Array.isArray(aiSuggestions)) {
      aiSuggestions.forEach(adj => {
        if (adj.area && adj.value) {
          adjustments.push({
            area: adj.area,
            value: adj.value,
            unit: adj.unit || 'px'
          })
        }
      })
    }
    
    return adjustments
  }

  private async determineAssetRequirements(
    context: PipelineContext,
    analysis: InitialAnalysisResult,
    strategy: EnhancementPlan['strategy'],
    styleProfile: StyleProfile,
    documentType: DocumentType,
    signal?: AbortSignal
  ): Promise<EnhancementPlan['assetRequirements']> {
    // Skip assets for free tier
    if (context.subscriptionTier === 'free') {
      return {
        backgrounds: [],
        decorativeElements: [],
        educationalGraphics: [],
      }
    }
    
    const detailedAnalysis = (analysis.metadata as any).detailedAnalysis
    const visualScore = analysis.currentScore.visuals
    
    // Calculate asset needs based on analysis
    const assetNeeds = this.calculateAssetNeeds(analysis, detailedAnalysis, styleProfile)
    
    const prompt = `Design visual assets for this ${documentType} document:

Current Visual State:
- Visual Score: ${visualScore}/100
- Existing Images: ${analysis.metadata.hasImages ? `${analysis.metadata.imageCount} images` : 'None'}
- Visual Appeal: ${detailedAnalysis?.engagement?.visualAppeal || 'Unknown'}/100
- Predicted Engagement: ${detailedAnalysis?.engagement?.predictedEngagement || 'Unknown'}/100

Style Requirements:
- Visual Style: ${styleProfile.visuals.style}
- Visual Quantity: ${styleProfile.visuals.quantity}
- Color Mood: ${styleProfile.colors.mood}
- Enhancement Approach: ${strategy.approach}

Asset Needs Assessment:
- Background Enhancement: ${assetNeeds.backgroundNeed}% needed
- Decorative Elements: ${assetNeeds.decorativeNeed}% needed
- Educational Graphics: ${assetNeeds.graphicsNeed}% needed

User Tier: ${context.subscriptionTier}
Tier Limits:
- Basic: 1 background, 3 decorative elements, 0 graphics
- Pro: 2 backgrounds, 8 decorative elements, 2 graphics
- Premium: 5 backgrounds, 20 decorative elements, 5 graphics

Recommend specific assets that would:
1. Match the document type and style
2. Significantly improve visual appeal
3. Enhance user engagement
4. Support the content without overwhelming it

For each asset, specify:
- Type and style
- Purpose and placement
- Visual characteristics
- How it enhances the document

Return as JSON with backgrounds, decorativeElements, and educationalGraphics arrays.`

    const response = await this.aiService.generate(
      prompt,
      { 
        model: context.subscriptionTier === 'premium' ? 'gpt-4o' : 'gpt-4o-mini',
        maxTokens: 600,
        temperature: 0.8,
        subscriptionTier: context.subscriptionTier
      },
      signal
    )
    
    const assets = this.parseJSONResponse(response.content)
    
    // Process and validate asset requirements
    const processedAssets = this.processAssetRequirements(
      assets,
      context.subscriptionTier,
      styleProfile,
      assetNeeds
    )
    
    return processedAssets
  }

  private calculateAssetNeeds(analysis: InitialAnalysisResult, detailedAnalysis: any, styleProfile: StyleProfile) {
    let backgroundNeed = 0
    let decorativeNeed = 0
    let graphicsNeed = 0
    
    // Calculate background need
    if (!analysis.metadata.hasImages) {
      backgroundNeed += 40
    }
    if (analysis.currentScore.visuals < 60) {
      backgroundNeed += 30
    }
    if (styleProfile.visuals.style !== 'minimalist') {
      backgroundNeed += 20
    }
    if (detailedAnalysis?.engagement?.visualAppeal < 70) {
      backgroundNeed += 10
    }
    
    // Calculate decorative need
    if (analysis.layoutAnalysis.whitespace > 40) {
      decorativeNeed += 30 // Too much empty space
    }
    if (styleProfile.visuals.quantity !== 'minimal') {
      decorativeNeed += 30
    }
    if (detailedAnalysis?.visualHierarchy?.emphasisBalance < 70) {
      decorativeNeed += 20
    }
    if (analysis.currentScore.visuals < 50) {
      decorativeNeed += 20
    }
    
    // Calculate graphics need
    const isEducational = analysis.extractedText.bodyText.some(text => 
      text.toLowerCase().includes('learn') || 
      text.toLowerCase().includes('understand') ||
      text.toLowerCase().includes('example')
    )
    
    if (isEducational) {
      graphicsNeed += 40
    }
    if (styleProfile.visuals.style === 'illustrative') {
      graphicsNeed += 30
    }
    if (analysis.extractedText.bodyText.length > 10 && !analysis.metadata.hasImages) {
      graphicsNeed += 30 // Long text without visuals
    }
    
    return {
      backgroundNeed: Math.min(100, backgroundNeed),
      decorativeNeed: Math.min(100, decorativeNeed),
      graphicsNeed: Math.min(100, graphicsNeed)
    }
  }

  private processAssetRequirements(
    assets: any,
    tier: string,
    styleProfile: StyleProfile,
    assetNeeds: any
  ): EnhancementPlan['assetRequirements'] {
    // Define tier limits
    const tierLimits = {
      basic: { backgrounds: 1, decorative: 3, graphics: 0 },
      pro: { backgrounds: 2, decorative: 8, graphics: 2 },
      premium: { backgrounds: 5, decorative: 20, graphics: 5 },
    }
    
    const limits = tierLimits[tier as keyof typeof tierLimits] || tierLimits.basic
    
    // Process backgrounds
    const backgrounds: BackgroundRequirement[] = this.generateBackgroundRequirements(
      assets.backgrounds || [],
      limits.backgrounds,
      styleProfile,
      assetNeeds.backgroundNeed
    )
    
    // Process decorative elements
    const decorativeElements: DecorativeRequirement[] = this.generateDecorativeRequirements(
      assets.decorativeElements || [],
      limits.decorative,
      styleProfile,
      assetNeeds.decorativeNeed
    )
    
    // Process educational graphics
    const educationalGraphics: GraphicRequirement[] = this.generateGraphicRequirements(
      assets.educationalGraphics || [],
      limits.graphics,
      styleProfile,
      assetNeeds.graphicsNeed
    )
    
    return {
      backgrounds,
      decorativeElements,
      educationalGraphics
    }
  }

  private generateBackgroundRequirements(
    suggestions: any[],
    limit: number,
    styleProfile: StyleProfile,
    need: number
  ): BackgroundRequirement[] {
    const backgrounds: BackgroundRequirement[] = []
    
    // Always add at least one background if need is high
    if (need > 50 || suggestions.length > 0) {
      const defaultBackground = this.getDefaultBackground(styleProfile)
      backgrounds.push(defaultBackground)
    }
    
    // Add AI suggestions
    suggestions.slice(0, limit - 1).forEach(bg => {
      backgrounds.push({
        style: bg.style || 'gradient',
        theme: bg.theme || styleProfile.colors.mood,
        colors: bg.colors || this.getBackgroundColors(styleProfile),
        opacity: bg.opacity || (styleProfile.visuals.style === 'minimalist' ? 0.05 : 0.15)
      })
    })
    
    return backgrounds.slice(0, limit)
  }

  private generateDecorativeRequirements(
    suggestions: any[],
    limit: number,
    styleProfile: StyleProfile,
    need: number
  ): DecorativeRequirement[] {
    const elements: DecorativeRequirement[] = []
    
    // Add style-appropriate defaults if needed
    if (need > 30) {
      const defaults = this.getDefaultDecorativeElements(styleProfile)
      elements.push(...defaults)
    }
    
    // Add AI suggestions
    suggestions.forEach(el => {
      elements.push({
        type: el.type || 'shape',
        style: el.style || styleProfile.visuals.style,
        quantity: Math.min(el.quantity || 1, styleProfile.visuals.quantity === 'rich' ? 5 : 3),
        placement: el.placement || 'strategic'
      })
    })
    
    return elements.slice(0, limit)
  }

  private generateGraphicRequirements(
    suggestions: any[],
    limit: number,
    styleProfile: StyleProfile,
    _need: number
  ): GraphicRequirement[] {
    if (limit === 0) return []
    
    const graphics: GraphicRequirement[] = []
    
    suggestions.slice(0, limit).forEach(gr => {
      graphics.push({
        type: gr.type || 'illustration',
        style: gr.style || styleProfile.visuals.style,
        dimensions: gr.dimensions || { width: 400, height: 300 },
        data: gr.data
      })
    })
    
    return graphics
  }

  private getDefaultBackground(styleProfile: StyleProfile): BackgroundRequirement {
    const styleBackgrounds = {
      minimalist: { style: 'gradient' as const, theme: 'subtle', colors: ['#FAFAFA', '#F5F5F5'], opacity: 0.05 },
      decorative: { style: 'pattern' as const, theme: 'geometric', colors: ['#E0E0E0', '#F0F0F0'], opacity: 0.1 },
      illustrative: { style: 'gradient' as const, theme: 'colorful', colors: ['#FFE5E5', '#E5F3FF'], opacity: 0.15 },
      photographic: { style: 'image' as const, theme: 'abstract', colors: ['#000000', '#FFFFFF'], opacity: 0.1 }
    }
    
    return styleBackgrounds[styleProfile.visuals.style] || styleBackgrounds.minimalist
  }

  private getBackgroundColors(styleProfile: StyleProfile): string[] {
    const tempColors = {
      warm: ['#FFF5E6', '#FFE0CC'],
      cool: ['#E6F3FF', '#CCE7FF'],
      neutral: ['#F5F5F5', '#EBEBEB']
    }
    
    return tempColors[styleProfile.colors.temperature] || tempColors.neutral
  }

  private getDefaultDecorativeElements(styleProfile: StyleProfile): DecorativeRequirement[] {
    const elements: DecorativeRequirement[] = []
    
    if (styleProfile.visuals.style === 'minimalist') {
      elements.push({
        type: 'shape',
        style: 'geometric',
        quantity: 2,
        placement: 'corners'
      })
    } else if (styleProfile.visuals.style === 'decorative') {
      elements.push(
        {
          type: 'border',
          style: 'ornamental',
          quantity: 1,
          placement: 'edges'
        },
        {
          type: 'shape',
          style: 'organic',
          quantity: 3,
          placement: 'random'
        }
      )
    } else if (styleProfile.visuals.style === 'illustrative') {
      elements.push({
        type: 'icon',
        style: 'flat',
        quantity: 4,
        placement: 'grid'
      })
    }
    
    return elements
  }

  private inferDocumentType(analysis: InitialAnalysisResult): string {
    const { extractedText, layoutAnalysis, metadata } = analysis
    
    // Check for educational content
    const educationalKeywords = ['lesson', 'worksheet', 'exercise', 'quiz', 'test', 'homework']
    const hasEducationalContent = extractedText.bodyText.some(text => 
      educationalKeywords.some(keyword => text.toLowerCase().includes(keyword))
    )
    
    if (hasEducationalContent) return 'educational'
    
    // Check for presentation
    if (metadata.pageCount && metadata.pageCount > 5 && layoutAnalysis.structure === 'single-column') {
      return 'presentation'
    }
    
    // Check for marketing
    if (extractedText.headings.length > 3 && metadata.hasImages) {
      return 'marketing'
    }
    
    // Default to document
    return 'document'
  }

  private parseJSONResponse(response: string): any {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }
      
      // Try direct parse
      return JSON.parse(response)
    } catch (error) {
      console.error('Failed to parse JSON response:', error)
      return {}
    }
  }
}