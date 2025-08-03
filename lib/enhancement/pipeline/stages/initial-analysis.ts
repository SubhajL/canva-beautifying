import { 
  PipelineContext, 
  InitialAnalysisResult,
  LayoutSection,
  DesignIssue 
} from '../types'
import { downloadFromR2 } from '@/lib/r2/client'
import { AIService } from '@/lib/ai/ai-service'
import { extractTextFromPDF, extractTextFromImage } from '@/lib/utils/document-utils'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import chroma from 'chroma-js'

// Color harmony types
type ColorHarmony = 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'tetradic' | 'split-complementary' | 'chaotic'

// Typography metrics
interface TypographyMetrics {
  fontCount: number
  sizeVariations: number
  readabilityScore: number
  consistency: number
  hierarchy: {
    levels: number
    clarity: number
  }
}

// Visual hierarchy analysis
interface VisualHierarchy {
  levels: HierarchyLevel[]
  flowScore: number
  emphasisBalance: number
  scanPath: 'F-pattern' | 'Z-pattern' | 'circular' | 'chaotic'
}

interface HierarchyLevel {
  importance: number
  elements: string[]
  visualWeight: number
}

// Enhanced layout analysis
type BaseLayoutAnalysis = InitialAnalysisResult['layoutAnalysis'];
interface EnhancedLayoutAnalysis extends BaseLayoutAnalysis {
  margins: {
    top: number
    right: number
    bottom: number
    left: number
    consistency: number
  }
  spacing: {
    lineHeight: number
    paragraphSpacing: number
    elementSpacing: number
    consistency: number
  }
  gridAnalysis: {
    hasGrid: boolean
    columns?: number
    gutters?: number
    baseline?: number
  }
  alignmentScore: number
  balanceScore: number
}

// Color analysis results
interface ColorAnalysis {
  dominantColors: string[]
  palette: {
    primary: string
    secondary: string
    accent: string
    neutrals: string[]
  }
  harmony: ColorHarmony
  contrast: {
    textBackground: number
    overall: number
    issues: Array<{
      foreground: string
      background: string
      ratio: number
      passes: {
        AA: boolean
        AAA: boolean
      }
    }>
  }
  colorTemperature: 'warm' | 'cool' | 'neutral'
  saturationLevel: 'muted' | 'moderate' | 'vibrant'
}

// Engagement metrics
interface EngagementMetrics {
  visualAppeal: number
  readability: number
  professionalScore: number
  emotionalImpact: {
    energy: number
    trust: number
    creativity: number
  }
  predictedEngagement: number
}

export class InitialAnalysisStage {
  private aiService: AIService

  constructor() {
    this.aiService = new AIService()
  }

  async execute(
    context: PipelineContext,
    signal?: AbortSignal
  ): Promise<InitialAnalysisResult> {
    try {
      // Download the document
      const fileBuffer = await downloadFromR2(context.originalFileUrl)
      
      // Convert to image for analysis
      let imageBuffer = fileBuffer
      if (context.fileType === 'pdf') {
        imageBuffer = await this.convertPDFPageToImage(fileBuffer)
      }
      
      // Run all analyses in parallel for performance
      const [extractedText, enhancedLayout, colorAnalysis, typographyMetrics, visualHierarchy, engagementMetrics] = await Promise.all([
        this.extractText(fileBuffer, context.fileType),
        this.analyzeEnhancedLayout(imageBuffer, context.fileType, signal),
        this.analyzeColors(imageBuffer, signal),
        this.analyzeTypography(imageBuffer, signal),
        this.analyzeVisualHierarchy(imageBuffer, signal),
        this.calculateEngagementScore(imageBuffer, signal)
      ])
      
      // Convert enhanced layout to standard format
      const layoutAnalysis: InitialAnalysisResult['layoutAnalysis'] = {
        structure: enhancedLayout.structure,
        sections: enhancedLayout.sections,
        whitespace: enhancedLayout.whitespace,
        alignment: enhancedLayout.alignment
      }
      
      // Identify design issues based on all analyses
      const designIssues = await this.identifyDesignIssues(
        fileBuffer,
        enhancedLayout,
        colorAnalysis,
        typographyMetrics,
        visualHierarchy,
        context.fileType,
        signal
      )
      
      // Calculate comprehensive design score
      const currentScore = this.calculateComprehensiveScore(
        enhancedLayout,
        colorAnalysis,
        typographyMetrics,
        visualHierarchy,
        engagementMetrics,
        designIssues
      )
      
      // Get document metadata
      const metadata = await this.getDocumentMetadata(fileBuffer, context.fileType)
      
      // Store detailed analysis results in metadata for later stages
      const enhancedMetadata = {
        ...metadata,
        detailedAnalysis: {
          color: colorAnalysis,
          typography: typographyMetrics,
          visualHierarchy,
          engagement: engagementMetrics,
          enhancedLayout
        }
      }
      
      return {
        extractedText,
        layoutAnalysis,
        designIssues,
        currentScore,
        metadata: enhancedMetadata as any,
      }
    } catch (error) {
      console.error('Initial analysis failed:', error)
      throw new Error(`Initial analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async extractText(
    fileBuffer: Buffer,
    fileType: string
  ): Promise<InitialAnalysisResult['extractedText']> {
    let rawText: string
    
    if (fileType === 'pdf') {
      rawText = await extractTextFromPDF(fileBuffer)
    } else {
      rawText = await extractTextFromImage(fileBuffer)
    }
    
    // Parse and categorize text
    const lines = rawText.split('\n').filter(line => line.trim())
    const headings: string[] = []
    const bodyText: string[] = []
    const captions: string[] = []
    let title: string | undefined
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Simple heuristics for text categorization
      if (i === 0 && line.length < 100) {
        title = line
      } else if (line.length < 50 && line.match(/^[A-Z]/)) {
        headings.push(line)
      } else if (line.length < 30) {
        captions.push(line)
      } else {
        bodyText.push(line)
      }
    }
    
    return {
      title,
      headings,
      bodyText,
      captions,
    }
  }

  private async analyzeEnhancedLayout(
    imageBuffer: Buffer,
    _fileType: string,
    _signal?: AbortSignal
  ): Promise<EnhancedLayoutAnalysis> {
    // Get image metadata for pixel calculations
    const imageMetadata = await sharp(imageBuffer).metadata()
    const { width: _width = 0, height: _height = 0 } = imageMetadata
    // width and height could be used for pixel calculations if needed
    
    // Use vision model for comprehensive layout analysis
    const visionPrompt = `Perform a comprehensive layout analysis of this document. Analyze:
    
    1. STRUCTURE & SECTIONS:
       - Overall layout structure (single-column, multi-column, grid, or freeform)
       - Identify all sections with precise bounds (header, content, sidebar, footer, images, text blocks)
       - Z-index/layering of elements
    
    2. MARGINS & SPACING:
       - Document margins (top, right, bottom, left) in pixels
       - Line height and paragraph spacing
       - Spacing between different elements
       - Consistency of spacing throughout
    
    3. ALIGNMENT & GRID:
       - Text alignment patterns (left, center, right, justified)
       - Check if elements align to an invisible grid
       - Number of columns if grid-based
       - Gutter widths between columns
       - Baseline grid detection
    
    4. WHITESPACE ANALYSIS:
       - Calculate percentage of whitespace
       - Identify areas of dense content vs breathing room
       - Balance of positive and negative space
    
    5. VISUAL BALANCE:
       - Left-right balance score (0-100)
       - Top-bottom balance score (0-100)
       - Overall composition balance
    
    Return as JSON with this exact structure:
    {
      "structure": "single-column|multi-column|grid|freeform",
      "sections": [
        {
          "type": "header|content|sidebar|footer|image|text",
          "bounds": {"x": 0, "y": 0, "width": 100, "height": 100},
          "content": "brief description"
        }
      ],
      "margins": {
        "top": 50,
        "right": 50,
        "bottom": 50,
        "left": 50,
        "unit": "pixels"
      },
      "spacing": {
        "lineHeight": 1.5,
        "paragraphSpacing": 20,
        "elementSpacing": 30,
        "consistencyScore": 85
      },
      "grid": {
        "hasGrid": true,
        "columns": 12,
        "gutters": 20,
        "baseline": 8
      },
      "alignment": {
        "primary": "left|center|right|justified|mixed",
        "score": 90,
        "issues": ["description of any misalignments"]
      },
      "whitespace": {
        "percentage": 35,
        "distribution": "even|top-heavy|bottom-heavy|uneven"
      },
      "balance": {
        "horizontal": 85,
        "vertical": 90,
        "overall": 87
      }
    }`
    
    const response = await this.aiService.analyzeImage(
      imageBuffer,
      visionPrompt,
      { 
        model: 'gemini-2.0-flash-exp',
        subscriptionTier: 'pro' 
      },
      signal
    )
    
    const analysis = this.parseJSONResponse(response.analysis)
    
    // Process sections
    const sections: LayoutSection[] = (analysis.sections || []).map((section: any, index: number) => ({
      id: `section-${index}`,
      type: section.type || 'content',
      bounds: section.bounds || { x: 0, y: 0, width: 100, height: 100 },
      zIndex: index,
    }))
    
    // Calculate margin consistency
    const margins = analysis.margins || { top: 50, right: 50, bottom: 50, left: 50 }
    const marginValues = [margins.top, margins.right, margins.bottom, margins.left]
    const avgMargin = marginValues.reduce((a, b) => a + b) / 4
    const marginConsistency = 100 - (marginValues.reduce((acc, val) => acc + Math.abs(val - avgMargin), 0) / avgMargin)
    
    // Compile enhanced layout analysis
    return {
      structure: analysis.structure || 'single-column',
      sections,
      whitespace: analysis.whitespace?.percentage || 20,
      alignment: analysis.alignment?.primary || 'left',
      margins: {
        ...margins,
        consistency: Math.max(0, Math.min(100, marginConsistency))
      },
      spacing: {
        lineHeight: analysis.spacing?.lineHeight || 1.5,
        paragraphSpacing: analysis.spacing?.paragraphSpacing || 20,
        elementSpacing: analysis.spacing?.elementSpacing || 30,
        consistency: analysis.spacing?.consistencyScore || 75
      },
      gridAnalysis: {
        hasGrid: analysis.grid?.hasGrid || false,
        columns: analysis.grid?.columns,
        gutters: analysis.grid?.gutters,
        baseline: analysis.grid?.baseline
      },
      alignmentScore: analysis.alignment?.score || 75,
      balanceScore: analysis.balance?.overall || 75
    }
  }

  private async analyzeColors(
    imageBuffer: Buffer,
    signal?: AbortSignal
  ): Promise<ColorAnalysis> {
    // Extract dominant colors using sharp
    const { dominant } = await sharp(imageBuffer)
      .stats()
    
    // Use AI vision model for comprehensive color analysis
    const visionPrompt = `Analyze the color usage in this document comprehensively:
    
    1. COLOR EXTRACTION:
       - Identify the 5-7 most dominant colors (provide hex codes)
       - Categorize colors into: primary, secondary, accent, and neutral colors
       - Identify background colors vs foreground colors
    
    2. COLOR HARMONY:
       - Determine the color harmony type: monochromatic, analogous, complementary, triadic, tetradic, split-complementary, or chaotic
       - Explain why this harmony type applies
       - Rate the harmony effectiveness (0-100)
    
    3. CONTRAST ANALYSIS:
       - Check text-to-background contrast ratios
       - Identify any contrast issues (provide specific color pairs)
       - Check WCAG AA and AAA compliance
       - Overall contrast score (0-100)
    
    4. COLOR PROPERTIES:
       - Color temperature: warm, cool, or neutral
       - Saturation level: muted, moderate, or vibrant
       - Color distribution balance
       - Emotional impact of color choices
    
    Return as JSON:
    {
      "dominantColors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
      "palette": {
        "primary": "#hex",
        "secondary": "#hex",
        "accent": "#hex",
        "neutrals": ["#hex1", "#hex2"],
        "background": "#hex",
        "text": "#hex"
      },
      "harmony": {
        "type": "complementary",
        "effectiveness": 85,
        "explanation": "Uses opposite colors on the color wheel"
      },
      "contrast": {
        "overallScore": 90,
        "issues": [
          {
            "foreground": "#hex1",
            "background": "#hex2",
            "ratio": 3.5,
            "passesAA": false,
            "passesAAA": false,
            "location": "header text"
          }
        ]
      },
      "properties": {
        "temperature": "warm",
        "saturation": "moderate",
        "balance": 80,
        "emotion": {
          "primary": "professional",
          "secondary": "trustworthy"
        }
      }
    }`
    
    const response = await this.aiService.analyzeImage(
      imageBuffer,
      visionPrompt,
      { 
        model: 'gemini-2.0-flash-exp',
        subscriptionTier: 'pro' 
      },
      signal
    )
    
    const analysis = this.parseJSONResponse(response.analysis)
    
    // Calculate color harmony based on color theory
    const harmony = this.analyzeColorHarmony(analysis.dominantColors || [])
    
    // Process contrast issues
    const contrastIssues = (analysis.contrast?.issues || []).map((issue: any) => ({
      foreground: issue.foreground || '#000000',
      background: issue.background || '#FFFFFF',
      ratio: issue.ratio || 1,
      passes: {
        AA: issue.passesAA || false,
        AAA: issue.passesAAA || false
      }
    }))
    
    return {
      dominantColors: analysis.dominantColors || [`rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`],
      palette: {
        primary: analysis.palette?.primary || `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`,
        secondary: analysis.palette?.secondary || '#6B7280',
        accent: analysis.palette?.accent || '#3B82F6',
        neutrals: analysis.palette?.neutrals || ['#F3F4F6', '#E5E7EB', '#9CA3AF']
      },
      harmony: harmony || analysis.harmony?.type || 'monochromatic',
      contrast: {
        textBackground: analysis.contrast?.overallScore || 85,
        overall: analysis.contrast?.overallScore || 85,
        issues: contrastIssues
      },
      colorTemperature: analysis.properties?.temperature || 'neutral',
      saturationLevel: analysis.properties?.saturation || 'moderate'
    }
  }

  private analyzeColorHarmony(colors: string[]): ColorHarmony {
    if (colors.length < 2) return 'monochromatic'
    
    try {
      // Convert colors to HSL for analysis
      const hslColors = colors.map(c => {
        const color = chroma(c)
        return {
          h: color.get('hsl.h'),
          s: color.get('hsl.s'),
          l: color.get('hsl.l')
        }
      })
      
      // Check for monochromatic (same hue, different saturation/lightness)
      const hues = hslColors.map(c => c.h)
      const uniqueHues = [...new Set(hues.map(h => Math.round(h / 10) * 10))]
      
      if (uniqueHues.length === 1) return 'monochromatic'
      
      // Check for analogous (adjacent hues, within 60 degrees)
      const hueDifferences = []
      for (let i = 0; i < hues.length - 1; i++) {
        for (let j = i + 1; j < hues.length; j++) {
          hueDifferences.push(Math.abs(hues[i] - hues[j]))
        }
      }
      
      const maxDiff = Math.max(...hueDifferences)
      if (maxDiff <= 60) return 'analogous'
      
      // Check for complementary (opposite hues, around 180 degrees)
      if (hueDifferences.some(d => d >= 150 && d <= 210)) return 'complementary'
      
      // Check for triadic (120 degrees apart)
      if (hueDifferences.some(d => d >= 100 && d <= 140)) return 'triadic'
      
      // Check for split-complementary
      if (uniqueHues.length === 3 && hueDifferences.some(d => d >= 150)) return 'split-complementary'
      
      // Check for tetradic (square)
      if (uniqueHues.length === 4) return 'tetradic'
      
      return 'chaotic'
    } catch (error) {
      console.error('Color harmony analysis error:', error)
      return 'chaotic'
    }
  }

  private async analyzeTypography(
    imageBuffer: Buffer,
    signal?: AbortSignal
  ): Promise<TypographyMetrics> {
    const visionPrompt = `Analyze the typography in this document comprehensively:
    
    1. FONT ANALYSIS:
       - Count distinct font families used
       - Identify font types (serif, sans-serif, script, display)
       - Font pairing effectiveness (0-100)
       - Consistency of font usage
    
    2. SIZE HIERARCHY:
       - Number of different font sizes
       - Size ratios between hierarchy levels
       - Identify heading sizes (H1, H2, H3, etc.)
       - Body text size and readability
    
    3. READABILITY METRICS:
       - Line length (characters per line)
       - Line height (leading) appropriateness
       - Paragraph spacing
       - Text density score
       - Estimated reading ease (0-100)
    
    4. TYPOGRAPHY ISSUES:
       - Too many fonts (more than 3)
       - Poor size hierarchy
       - Inadequate line spacing
       - Text too small or too large
       - Poor font combinations
    
    5. VISUAL HIERARCHY:
       - Number of hierarchy levels
       - Clarity of hierarchy (0-100)
       - Use of weight, size, and style for emphasis
    
    Return as JSON:
    {
      "fonts": {
        "count": 2,
        "families": ["Arial", "Georgia"],
        "types": ["sans-serif", "serif"],
        "pairingScore": 85
      },
      "sizes": {
        "count": 5,
        "h1": 32,
        "h2": 24,
        "h3": 20,
        "body": 16,
        "caption": 14,
        "ratios": [1.33, 1.25, 1.25, 1.14]
      },
      "readability": {
        "lineLength": 65,
        "lineHeight": 1.5,
        "paragraphSpacing": 1.2,
        "density": "moderate",
        "score": 82
      },
      "hierarchy": {
        "levels": 4,
        "clarity": 88,
        "techniques": ["size", "weight", "color"]
      },
      "issues": [
        {"type": "font-count", "severity": "low", "description": "Minor issue"}
      ]
    }`
    
    const response = await this.aiService.analyzeImage(
      imageBuffer,
      visionPrompt,
      { 
        model: 'gemini-2.0-flash-exp',
        subscriptionTier: 'pro' 
      },
      signal
    )
    
    const analysis = this.parseJSONResponse(response.analysis)
    
    // Calculate readability score based on multiple factors
    const readabilityScore = this.calculateReadabilityScore(analysis)
    
    // Calculate typography consistency
    const consistency = this.calculateTypographyConsistency(analysis)
    
    return {
      fontCount: analysis.fonts?.count || 1,
      sizeVariations: analysis.sizes?.count || 3,
      readabilityScore: readabilityScore,
      consistency: consistency,
      hierarchy: {
        levels: analysis.hierarchy?.levels || 3,
        clarity: analysis.hierarchy?.clarity || 75
      }
    }
  }

  private calculateReadabilityScore(analysis: any): number {
    let score = 100
    
    // Penalize for too many fonts
    if (analysis.fonts?.count > 3) score -= 15
    if (analysis.fonts?.count > 4) score -= 10
    
    // Check line length (optimal: 50-75 characters)
    const lineLength = analysis.readability?.lineLength || 65
    if (lineLength < 45 || lineLength > 90) score -= 20
    else if (lineLength < 50 || lineLength > 75) score -= 10
    
    // Check line height (optimal: 1.4-1.8)
    const lineHeight = analysis.readability?.lineHeight || 1.5
    if (lineHeight < 1.2 || lineHeight > 2.0) score -= 15
    else if (lineHeight < 1.4 || lineHeight > 1.8) score -= 5
    
    // Add font pairing score influence
    const pairingScore = analysis.fonts?.pairingScore || 80
    score = (score * 0.7) + (pairingScore * 0.3)
    
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  private calculateTypographyConsistency(analysis: any): number {
    let score = 100
    
    // Check size ratios consistency
    const ratios = analysis.sizes?.ratios || []
    if (ratios.length > 0) {
      const avgRatio = ratios.reduce((a: number, b: number) => a + b) / ratios.length
      const variance = ratios.reduce((acc: number, r: number) => acc + Math.abs(r - avgRatio), 0) / ratios.length
      score -= variance * 50 // Penalize inconsistent ratios
    }
    
    // Penalize too many size variations
    const sizeCount = analysis.sizes?.count || 3
    if (sizeCount > 6) score -= 20
    else if (sizeCount > 5) score -= 10
    
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  private async analyzeVisualHierarchy(
    imageBuffer: Buffer,
    signal?: AbortSignal
  ): Promise<VisualHierarchy> {
    const visionPrompt = `Analyze the visual hierarchy and information flow in this document:
    
    1. HIERARCHY LEVELS:
       - Identify distinct importance levels (primary, secondary, tertiary, etc.)
       - List elements at each level
       - Visual weight of each level (0-100)
    
    2. VISUAL FLOW:
       - Determine the scanning pattern (F-pattern, Z-pattern, circular, or chaotic)
       - Entry points and exit points
       - Natural reading flow score (0-100)
    
    3. EMPHASIS TECHNIQUES:
       - Size differences
       - Color contrast
       - Whitespace usage
       - Typography weight
       - Positioning
    
    4. BALANCE & EMPHASIS:
       - Balance between different hierarchy levels
       - Appropriate emphasis distribution
       - Visual weight distribution
    
    Return as JSON:
    {
      "levels": [
        {
          "importance": 100,
          "elements": ["Main headline", "Hero image"],
          "visualWeight": 85,
          "techniques": ["large size", "bold weight", "high contrast"]
        },
        {
          "importance": 70,
          "elements": ["Subheadings", "Key points"],
          "visualWeight": 60,
          "techniques": ["medium size", "color accent"]
        },
        {
          "importance": 40,
          "elements": ["Body text", "Supporting content"],
          "visualWeight": 40,
          "techniques": ["standard size", "regular weight"]
        }
      ],
      "flow": {
        "pattern": "F-pattern",
        "score": 85,
        "entryPoint": "top-left headline",
        "exitPoint": "bottom-right CTA"
      },
      "emphasis": {
        "balance": 82,
        "distribution": "well-balanced",
        "techniques": ["size", "color", "spacing", "weight"]
      }
    }`
    
    const response = await this.aiService.analyzeImage(
      imageBuffer,
      visionPrompt,
      { 
        model: 'gemini-2.0-flash-exp',
        subscriptionTier: 'pro' 
      },
      signal
    )
    
    const analysis = this.parseJSONResponse(response.analysis)
    
    // Process hierarchy levels
    const levels: HierarchyLevel[] = (analysis.levels || []).map((level: any) => ({
      importance: level.importance || 50,
      elements: level.elements || [],
      visualWeight: level.visualWeight || 50
    }))
    
    // Determine scan path
    const scanPath = this.determineScanPath(analysis.flow?.pattern)
    
    return {
      levels: levels.length > 0 ? levels : [
        { importance: 100, elements: ['Primary content'], visualWeight: 80 },
        { importance: 50, elements: ['Secondary content'], visualWeight: 50 }
      ],
      flowScore: analysis.flow?.score || 70,
      emphasisBalance: analysis.emphasis?.balance || 75,
      scanPath: scanPath
    }
  }

  private determineScanPath(pattern: string): VisualHierarchy['scanPath'] {
    const normalizedPattern = (pattern || '').toLowerCase()
    if (normalizedPattern.includes('f-pattern') || normalizedPattern.includes('f pattern')) return 'F-pattern'
    if (normalizedPattern.includes('z-pattern') || normalizedPattern.includes('z pattern')) return 'Z-pattern'
    if (normalizedPattern.includes('circular')) return 'circular'
    return 'chaotic'
  }

  private async calculateEngagementScore(
    imageBuffer: Buffer,
    signal?: AbortSignal
  ): Promise<EngagementMetrics> {
    const visionPrompt = `Analyze this document for engagement and visual appeal metrics:
    
    1. VISUAL APPEAL (0-100):
       - Overall aesthetic quality
       - Professional appearance
       - Modern vs dated design
       - Visual interest level
    
    2. READABILITY (0-100):
       - Text clarity
       - Information organization
       - Cognitive load
       - Scanability
    
    3. PROFESSIONAL SCORE (0-100):
       - Appropriate for business/educational use
       - Consistency and polish
       - Trust-building design elements
    
    4. EMOTIONAL IMPACT:
       - Energy level (0-100): Dynamic vs static
       - Trust level (0-100): Reliable vs questionable
       - Creativity (0-100): Innovative vs conventional
    
    5. PREDICTED ENGAGEMENT (0-100):
       - Likelihood to capture attention
       - Likelihood to hold interest
       - Likelihood to drive action
    
    Return as JSON:
    {
      "visualAppeal": 75,
      "readability": 82,
      "professionalScore": 88,
      "emotionalImpact": {
        "energy": 65,
        "trust": 85,
        "creativity": 55
      },
      "predictedEngagement": 78,
      "strengths": ["Clear hierarchy", "Good contrast"],
      "weaknesses": ["Dated colors", "Dense text blocks"]
    }`
    
    const response = await this.aiService.analyzeImage(
      imageBuffer,
      visionPrompt,
      { 
        model: 'gemini-2.0-flash-exp',
        subscriptionTier: 'pro' 
      },
      signal
    )
    
    const analysis = this.parseJSONResponse(response.analysis)
    
    return {
      visualAppeal: analysis.visualAppeal || 70,
      readability: analysis.readability || 75,
      professionalScore: analysis.professionalScore || 80,
      emotionalImpact: {
        energy: analysis.emotionalImpact?.energy || 60,
        trust: analysis.emotionalImpact?.trust || 75,
        creativity: analysis.emotionalImpact?.creativity || 50
      },
      predictedEngagement: analysis.predictedEngagement || 70
    }
  }

  private async identifyDesignIssues(
    fileBuffer: Buffer,
    enhancedLayout: EnhancedLayoutAnalysis,
    colorAnalysis: ColorAnalysis,
    typographyMetrics: TypographyMetrics,
    visualHierarchy: VisualHierarchy,
    _fileType: string,
    _signal?: AbortSignal
  ): Promise<DesignIssue[]> {
    const issues: DesignIssue[] = []
    
    // Analyze layout issues
    if (enhancedLayout.alignmentScore < 70) {
      issues.push({
        type: 'alignment',
        severity: enhancedLayout.alignmentScore < 50 ? 'high' : 'medium',
        description: 'Elements are not properly aligned to a consistent grid'
      })
    }
    
    if (enhancedLayout.balanceScore < 70) {
      issues.push({
        type: 'layout',
        severity: enhancedLayout.balanceScore < 50 ? 'high' : 'medium',
        description: 'Document layout lacks visual balance'
      })
    }
    
    if (enhancedLayout.margins.consistency < 70) {
      issues.push({
        type: 'spacing',
        severity: 'medium',
        description: 'Inconsistent margins throughout the document'
      })
    }
    
    if (enhancedLayout.spacing.consistency < 70) {
      issues.push({
        type: 'spacing',
        severity: enhancedLayout.spacing.consistency < 50 ? 'high' : 'medium',
        description: 'Inconsistent spacing between elements'
      })
    }
    
    // Analyze color issues
    if (colorAnalysis.harmony === 'chaotic') {
      issues.push({
        type: 'color',
        severity: 'high',
        description: 'Color palette lacks harmony and cohesion'
      })
    }
    
    // Add contrast issues
    colorAnalysis.contrast.issues.forEach(issue => {
      if (!issue.passes.AA) {
        issues.push({
          type: 'contrast',
          severity: !issue.passes.AA && issue.ratio < 3 ? 'high' : 'medium',
          description: `Poor contrast ratio (${issue.ratio.toFixed(1)}:1) between foreground and background colors`
        })
      }
    })
    
    // Analyze typography issues
    if (typographyMetrics.fontCount > 3) {
      issues.push({
        type: 'typography',
        severity: typographyMetrics.fontCount > 4 ? 'high' : 'medium',
        description: `Too many font families used (${typographyMetrics.fontCount}). Recommended maximum is 3.`
      })
    }
    
    if (typographyMetrics.readabilityScore < 70) {
      issues.push({
        type: 'typography',
        severity: typographyMetrics.readabilityScore < 50 ? 'high' : 'medium',
        description: 'Typography choices negatively impact readability'
      })
    }
    
    if (typographyMetrics.consistency < 70) {
      issues.push({
        type: 'typography',
        severity: 'medium',
        description: 'Inconsistent typography sizing and spacing'
      })
    }
    
    // Analyze visual hierarchy issues
    if (visualHierarchy.flowScore < 70) {
      issues.push({
        type: 'layout',
        severity: visualHierarchy.flowScore < 50 ? 'high' : 'medium',
        description: 'Document lacks clear visual flow and reading path'
      })
    }
    
    if (visualHierarchy.scanPath === 'chaotic') {
      issues.push({
        type: 'layout',
        severity: 'high',
        description: 'No clear scanning pattern - information is presented chaotically'
      })
    }
    
    if (typographyMetrics.hierarchy.clarity < 70) {
      issues.push({
        type: 'typography',
        severity: 'medium',
        description: 'Visual hierarchy is unclear - headings and body text lack sufficient differentiation'
      })
    }
    
    // Check whitespace issues
    if (enhancedLayout.whitespace < 15) {
      issues.push({
        type: 'spacing',
        severity: 'high',
        description: 'Document is too dense - insufficient whitespace for visual breathing room'
      })
    } else if (enhancedLayout.whitespace > 50) {
      issues.push({
        type: 'spacing',
        severity: 'medium',
        description: 'Excessive whitespace - document feels empty or unfinished'
      })
    }
    
    return issues
  }

  private calculateComprehensiveScore(
    enhancedLayout: EnhancedLayoutAnalysis,
    colorAnalysis: ColorAnalysis,
    typographyMetrics: TypographyMetrics,
    visualHierarchy: VisualHierarchy,
    engagementMetrics: EngagementMetrics,
    designIssues: DesignIssue[]
  ): InitialAnalysisResult['currentScore'] {
    // Calculate color score based on harmony, contrast, and issues
    let colorScore = 85 // Base score
    
    // Adjust for color harmony
    if (colorAnalysis.harmony === 'chaotic') colorScore -= 25
    else if (['complementary', 'analogous', 'triadic'].includes(colorAnalysis.harmony)) colorScore += 5
    
    // Adjust for contrast
    colorScore = (colorScore * 0.6) + (colorAnalysis.contrast.overall * 0.4)
    
    // Calculate typography score
    let typographyScore = (typographyMetrics.readabilityScore * 0.5) + 
                         (typographyMetrics.consistency * 0.3) +
                         (typographyMetrics.hierarchy.clarity * 0.2)
    
    // Calculate layout score
    let layoutScore = (enhancedLayout.alignmentScore * 0.3) +
                     (enhancedLayout.balanceScore * 0.3) +
                     (visualHierarchy.flowScore * 0.2) +
                     (enhancedLayout.spacing.consistency * 0.2)
    
    // Adjust for whitespace
    if (enhancedLayout.whitespace >= 20 && enhancedLayout.whitespace <= 40) {
      layoutScore = Math.min(100, layoutScore + 5)
    }
    
    // Calculate visual score based on engagement metrics and hierarchy
    let visualScore = (engagementMetrics.visualAppeal * 0.4) +
                     (visualHierarchy.emphasisBalance * 0.3) +
                     (engagementMetrics.professionalScore * 0.3)
    
    // Apply penalties based on issues
    const issuePenalties = {
      color: 0,
      typography: 0,
      layout: 0,
      visual: 0
    }
    
    for (const issue of designIssues) {
      const penalty = issue.severity === 'high' ? 15 : issue.severity === 'medium' ? 8 : 3
      
      switch (issue.type) {
        case 'color':
        case 'contrast':
          issuePenalties.color += penalty
          break
        case 'typography':
          issuePenalties.typography += penalty
          break
        case 'layout':
        case 'spacing':
        case 'alignment':
          issuePenalties.layout += penalty
          issuePenalties.visual += penalty * 0.5 // Layout issues also affect visual score
          break
      }
    }
    
    // Apply penalties with maximum reduction of 40 points per category
    colorScore = Math.max(20, colorScore - Math.min(40, issuePenalties.color))
    typographyScore = Math.max(20, typographyScore - Math.min(40, issuePenalties.typography))
    layoutScore = Math.max(20, layoutScore - Math.min(40, issuePenalties.layout))
    visualScore = Math.max(20, visualScore - Math.min(40, issuePenalties.visual))
    
    // Calculate overall score with weighted average
    const overall = Math.round(
      (colorScore * 0.2) +
      (typographyScore * 0.25) +
      (layoutScore * 0.3) +
      (visualScore * 0.25)
    )
    
    return {
      overall: Math.max(0, Math.min(100, overall)),
      color: Math.max(0, Math.min(100, Math.round(colorScore))),
      typography: Math.max(0, Math.min(100, Math.round(typographyScore))),
      layout: Math.max(0, Math.min(100, Math.round(layoutScore))),
      visuals: Math.max(0, Math.min(100, Math.round(visualScore)))
    }
  }

  private async getDocumentMetadata(
    fileBuffer: Buffer,
    fileType: string
  ): Promise<InitialAnalysisResult['metadata']> {
    const metadata: InitialAnalysisResult['metadata'] = {
      fileSize: fileBuffer.length,
      dimensions: { width: 0, height: 0 },
      hasImages: false,
      imageCount: 0,
    }
    
    if (fileType === 'pdf') {
      const pdfDoc = await PDFDocument.load(fileBuffer)
      const pageCount = pdfDoc.getPageCount()
      const firstPage = pdfDoc.getPage(0)
      
      metadata.pageCount = pageCount
      metadata.dimensions = {
        width: firstPage.getWidth(),
        height: firstPage.getHeight(),
      }
      
      // Check for images (simplified)
      metadata.hasImages = fileBuffer.toString('binary').includes('/Image')
    } else {
      // Image file
      const imageMetadata = await sharp(fileBuffer).metadata()
      metadata.dimensions = {
        width: imageMetadata.width || 0,
        height: imageMetadata.height || 0,
      }
      metadata.hasImages = true
      metadata.imageCount = 1
    }
    
    return metadata
  }

  private async convertPDFPageToImage(pdfBuffer: Buffer): Promise<Buffer> {
    // In production, you'd use a proper PDF to image converter
    // For now, we'll create a placeholder
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const firstPage = pdfDoc.getPage(0)
    
    // Create a white image with PDF dimensions
    const width = Math.round(firstPage.getWidth())
    const height = Math.round(firstPage.getHeight())
    
    return await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .png()
    .toBuffer()
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