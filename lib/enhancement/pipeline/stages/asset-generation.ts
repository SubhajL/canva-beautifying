import { 
  PipelineContext, 
  EnhancementPlan,
  GeneratedAssets,
  GeneratedBackground,
  GeneratedElement,
  GeneratedGraphic,
  BackgroundRequirement,
  DecorativeRequirement,
  GraphicRequirement,
  InitialAnalysisResult
} from '../types'
import { ImageGenerationService } from '@/lib/image-generation/image-generation-service'
import { uploadFile } from '@/lib/r2'
import sharp from 'sharp'
import { assetGeneration } from '@/lib/enhancement/algorithms/asset-generation'

export class AssetGenerationStage {
  private imageService: ImageGenerationService
  private analysisResult?: InitialAnalysisResult

  constructor() {
    this.imageService = new ImageGenerationService()
  }

  async execute(
    context: PipelineContext,
    plan: EnhancementPlan,
    signal?: AbortSignal,
    analysisResult?: InitialAnalysisResult
  ): Promise<GeneratedAssets> {
    // Store analysis result for use in generation methods
    this.analysisResult = analysisResult
    try {
      const generatedAssets: GeneratedAssets = {
        backgrounds: [],
        decorativeElements: [],
        educationalGraphics: [],
        totalAssets: 0,
        storageUsed: 0,
      }
      
      // Generate backgrounds
      if (plan.assetRequirements.backgrounds.length > 0) {
        generatedAssets.backgrounds = await this.generateBackgrounds(
          context,
          plan.assetRequirements.backgrounds,
          plan.colorEnhancements,
          signal
        )
      }
      
      // Generate decorative elements
      if (plan.assetRequirements.decorativeElements.length > 0) {
        generatedAssets.decorativeElements = await this.generateDecorativeElements(
          context,
          plan.assetRequirements.decorativeElements,
          plan.colorEnhancements,
          signal
        )
      }
      
      // Generate educational graphics
      if (plan.assetRequirements.educationalGraphics.length > 0) {
        generatedAssets.educationalGraphics = await this.generateEducationalGraphics(
          context,
          plan.assetRequirements.educationalGraphics,
          plan.colorEnhancements,
          signal
        )
      }
      
      // Generate age-appropriate enhancements
      if (this.analysisResult && context.subscriptionTier !== 'free') {
        const ageEnhancements = await this.generateAgeAppropriateEnhancements(
          context,
          plan,
          signal
        )
        
        // Merge age-appropriate elements with existing assets
        if (ageEnhancements.backgrounds.length > 0) {
          generatedAssets.backgrounds.push(...ageEnhancements.backgrounds)
        }
        if (ageEnhancements.decorativeElements.length > 0) {
          generatedAssets.decorativeElements.push(...ageEnhancements.decorativeElements)
        }
      }
      
      // Calculate totals
      generatedAssets.totalAssets = 
        generatedAssets.backgrounds.length +
        generatedAssets.decorativeElements.length +
        generatedAssets.educationalGraphics.length
      
      generatedAssets.storageUsed = 
        [...generatedAssets.backgrounds, ...generatedAssets.decorativeElements, ...generatedAssets.educationalGraphics]
          .reduce((total, asset: any) => total + (asset.fileSize || 0), 0)
      
      return generatedAssets
    } catch (error) {
      console.error('Asset generation failed:', error)
      throw new Error(`Asset generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async generateBackgrounds(
    context: PipelineContext,
    requirements: BackgroundRequirement[],
    colorPalette: EnhancementPlan['colorEnhancements'],
    _signal?: AbortSignal
  ): Promise<GeneratedBackground[]> {
    const backgrounds: GeneratedBackground[] = []
    
    for (const requirement of requirements) {
      try {
        let backgroundBuffer: Buffer
        let type: GeneratedBackground['type'] = requirement.style as any
        let metadata: any = {}
        
        // Use enhanced asset generation if analysis is available
        if (this.analysisResult) {
          const documentType = this.analysisResult.documentType || 'general'
          // Convert colorPalette to expected format
          const convertedPalette = {
            primary: colorPalette.primaryColor,
            secondary: colorPalette.secondaryColor,
            accent: colorPalette.accentColor,
            background: colorPalette.backgroundColor,
            text: colorPalette.textColor || '#000000'
          }
          const result = assetGeneration.generateBackground(
            requirement,
            documentType,
            this.analysisResult,
            convertedPalette
          )
          
          backgroundBuffer = await sharp(Buffer.from(result.svg))
            .png()
            .toBuffer()
          
          metadata = result.metadata
          type = requirement.style as any
        } else {
          // Fallback to basic generation
          switch (requirement.style) {
            case 'gradient':
              backgroundBuffer = await this.createGradientBackground(
                requirement,
                colorPalette
              )
              break
              
            case 'pattern':
              backgroundBuffer = await this.createPatternBackground(
                requirement,
                colorPalette
              )
              break
              
            case 'image':
              // Generate using AI for premium users only
              if (context.subscriptionTier === 'premium') {
                const result = await this.imageService.generateBackground({
                  theme: requirement.theme || 'modern',
                  style: requirement.style,
                  colors: requirement.colors,
                  mood: 'professional',
                  size: '1792x1024',
                  quality: 'standard',
                  userTier: context.subscriptionTier,
                  userId: context.userId
                })
                backgroundBuffer = await this.downloadAndProcessImage(result.url)
              } else {
                // Fallback to pattern for non-premium
                backgroundBuffer = await this.createPatternBackground(
                  requirement,
                  colorPalette
                )
                type = 'pattern'
              }
              break
              
            default:
              backgroundBuffer = await this.createSolidBackground(
                requirement,
                colorPalette
              )
              type = 'solid'
          }
        }
        
        // Upload to storage
        const fileKey = `assets/${context.userId}/${context.documentId}/bg-${Date.now()}.png`
        const url = await uploadFile(backgroundBuffer, fileKey)
        
        backgrounds.push({
          id: `bg-${backgrounds.length + 1}`,
          url,
          type,
          dimensions: { width: 1792, height: 1024 },
          fileSize: backgroundBuffer.length,
          metadata // Add metadata from enhanced generation
        })
      } catch (error) {
        console.error('Failed to generate background:', error)
        // Continue with other backgrounds
      }
    }
    
    return backgrounds
  }

  private async generateDecorativeElements(
    context: PipelineContext,
    requirements: DecorativeRequirement[],
    colorPalette: EnhancementPlan['colorEnhancements'],
    _signal?: AbortSignal
  ): Promise<GeneratedElement[]> {
    const elements: GeneratedElement[] = []
    
    for (const requirement of requirements) {
      try {
        // Generate multiple elements based on quantity
        for (let i = 0; i < requirement.quantity; i++) {
          let elementBuffer: Buffer
          let metadata: any = {}
          
          // Use enhanced asset generation if analysis is available
          if (this.analysisResult) {
            const subject = this.detectSubject()
            const documentType = this.analysisResult.documentType || 'general'
            const result = assetGeneration.generateDecoration(
              requirement,
              subject,
              documentType,
              colorPalette
            )
            
            elementBuffer = await sharp(Buffer.from(result.svg))
              .png()
              .toBuffer()
            
            metadata = result.metadata
          } else {
            // Fallback to basic generation
            switch (requirement.type) {
              case 'icon':
                elementBuffer = await this.createIconElement(
                  requirement,
                  colorPalette
                )
                break
                
              case 'shape':
                elementBuffer = await this.createShapeElement(
                  requirement,
                  colorPalette
                )
                break
                
              case 'border':
                elementBuffer = await this.createBorderElement(
                  requirement,
                  colorPalette
                )
                break
                
              case 'divider':
                elementBuffer = await this.createDividerElement(
                  requirement,
                  colorPalette
                )
                break
                
              default:
                continue
            }
          }
          
          // Calculate position based on placement strategy
          const position = this.calculateElementPosition(
            requirement.placement,
            i,
            requirement.quantity
          )
          
          // Upload to storage
          const fileKey = `assets/${context.userId}/${context.documentId}/elem-${Date.now()}-${i}.png`
          const url = await uploadFile(elementBuffer, fileKey)
          
          elements.push({
            id: `elem-${elements.length + 1}`,
            url,
            type: requirement.type,
            position,
            dimensions: { width: 100, height: 100 },
            rotation: requirement.placement === 'random' ? Math.random() * 360 : 0,
            metadata // Add metadata from enhanced generation
          })
        }
      } catch (error) {
        console.error('Failed to generate decorative element:', error)
        // Continue with other elements
      }
    }
    
    return elements
  }

  private async generateEducationalGraphics(
    context: PipelineContext,
    requirements: GraphicRequirement[],
    colorPalette: EnhancementPlan['colorEnhancements'],
    _signal?: AbortSignal
  ): Promise<GeneratedGraphic[]> {
    const graphics: GeneratedGraphic[] = []
    
    // Only generate for pro and premium tiers
    if (context.subscriptionTier !== 'pro' && context.subscriptionTier !== 'premium') {
      return graphics
    }
    
    for (const requirement of requirements) {
      try {
        let graphicBuffer: Buffer
        let metadata: any = {}
        
        // Use enhanced asset generation if analysis is available
        if (this.analysisResult) {
          const subject = this.detectSubject()
          const ageGroup = this.detectAgeGroup()
          const result = assetGeneration.generateEducationalGraphic(
            requirement,
            subject,
            ageGroup,
            colorPalette
          )
          
          graphicBuffer = await sharp(Buffer.from(result.svg))
            .resize(requirement.dimensions.width, requirement.dimensions.height, {
              fit: 'contain',
              background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png()
            .toBuffer()
          
          metadata = result.metadata
        } else {
          // Fallback to AI generation
          const prompt = this.createGraphicPrompt(requirement, colorPalette)
          
          const result = await this.imageService.generateImage({
            prompt,
            model: context.subscriptionTier === 'premium' ? 'dall-e-3' : 'stable-diffusion-xl',
            size: '1024x1024',
            quality: 'standard',
            style: requirement.style || 'educational',
            userTier: context.subscriptionTier,
            userId: context.userId
          })
          
          graphicBuffer = await this.downloadAndProcessImage(
            result.url,
            requirement.dimensions
          )
        }
        
        // Upload to storage
        const fileKey = `assets/${context.userId}/${context.documentId}/graphic-${Date.now()}.png`
        const url = await uploadFile(graphicBuffer, fileKey)
        
        graphics.push({
          id: `graphic-${graphics.length + 1}`,
          url,
          type: requirement.type,
          caption: this.generateCaption(requirement),
          dimensions: requirement.dimensions,
          embedData: requirement.data,
          metadata // Add metadata from enhanced generation
        })
      } catch (error) {
        console.error('Failed to generate educational graphic:', error)
        // Continue with other graphics
      }
    }
    
    return graphics
  }

  // Helper methods for creating various assets

  private async createGradientBackground(
    requirement: BackgroundRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): Promise<Buffer> {
    const colors = requirement.colors.length >= 2 
      ? requirement.colors 
      : [colorPalette.primaryColor, colorPalette.secondaryColor]
    
    // Create SVG gradient
    const svg = `
      <svg width="1792" height="1024" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:${requirement.opacity}" />
            <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:${requirement.opacity}" />
          </linearGradient>
        </defs>
        <rect width="1792" height="1024" fill="url(#grad1)" />
      </svg>
    `
    
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer()
  }

  private async createPatternBackground(
    requirement: BackgroundRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): Promise<Buffer> {
    const color = requirement.colors[0] || colorPalette.accentColor
    
    // Create a simple dot pattern
    const svg = `
      <svg width="1792" height="1024" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="3" fill="${color}" opacity="${requirement.opacity}" />
          </pattern>
        </defs>
        <rect width="1792" height="1024" fill="url(#dots)" />
      </svg>
    `
    
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer()
  }

  private async createSolidBackground(
    requirement: BackgroundRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): Promise<Buffer> {
    const color = requirement.colors[0] || colorPalette.backgroundColor
    
    return await sharp({
      create: {
        width: 1792,
        height: 1024,
        channels: 4,
        background: { ...this.hexToRgb(color), alpha: requirement.opacity }
      }
    })
    .png()
    .toBuffer()
  }

  private async createIconElement(
    requirement: DecorativeRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): Promise<Buffer> {
    // Create a simple star icon
    const svg = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 15 L61 39 L87 39 L68 56 L79 81 L50 65 L21 81 L32 56 L13 39 L39 39 Z" 
              fill="${colorPalette.accentColor}" />
      </svg>
    `
    
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer()
  }

  private async createShapeElement(
    requirement: DecorativeRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): Promise<Buffer> {
    // Create a simple circle shape
    const svg = `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="${colorPalette.primaryColor}" opacity="0.2" />
      </svg>
    `
    
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer()
  }

  private async createBorderElement(
    requirement: DecorativeRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): Promise<Buffer> {
    // Create a decorative border element
    const svg = `
      <svg width="200" height="10" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="2" y="4" fill="${colorPalette.primaryColor}" />
        <circle cx="100" cy="5" r="5" fill="${colorPalette.accentColor}" />
      </svg>
    `
    
    return await sharp(Buffer.from(svg))
      .resize(200, 10)
      .png()
      .toBuffer()
  }

  private async createDividerElement(
    requirement: DecorativeRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): Promise<Buffer> {
    // Create a simple divider line
    const svg = `
      <svg width="300" height="2" xmlns="http://www.w3.org/2000/svg">
        <rect width="300" height="2" fill="${colorPalette.primaryColor}" opacity="0.3" />
      </svg>
    `
    
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer()
  }

  private calculateElementPosition(
    placement: DecorativeRequirement['placement'],
    index: number,
    total: number
  ): { x: number; y: number } {
    switch (placement) {
      case 'corners':
        const corners = [
          { x: 50, y: 50 },
          { x: 1742, y: 50 },
          { x: 50, y: 974 },
          { x: 1742, y: 974 },
        ]
        return corners[index % 4]
        
      case 'edges':
        const edgePositions = total === 1 
          ? [{ x: 896, y: 50 }]
          : Array.from({ length: total }, (_, i) => ({
              x: 100 + (1592 / (total - 1)) * i,
              y: i % 2 === 0 ? 50 : 974,
            }))
        return edgePositions[index]
        
      case 'grid':
        const cols = Math.ceil(Math.sqrt(total))
        const col = index % cols
        const row = Math.floor(index / cols)
        return {
          x: 100 + (1592 / cols) * col,
          y: 100 + (824 / Math.ceil(total / cols)) * row,
        }
        
      case 'random':
      default:
        return {
          x: 100 + Math.random() * 1592,
          y: 100 + Math.random() * 824,
        }
    }
  }

  private createBackgroundPrompt(requirement: BackgroundRequirement): string {
    return `Create a ${requirement.theme} background image with subtle ${requirement.style} elements. 
    Use a color palette based on ${requirement.colors.join(', ')}. 
    The image should be abstract, professional, and suitable as a document background.
    No text or specific objects, just aesthetic patterns or textures.`
  }

  private createGraphicPrompt(
    requirement: GraphicRequirement,
    colorPalette: EnhancementPlan['colorEnhancements']
  ): string {
    const colorInfo = `Use these colors: primary ${colorPalette.primaryColor}, accent ${colorPalette.accentColor}`
    
    switch (requirement.type) {
      case 'chart':
        return `Create a modern, clean ${requirement.style} chart visualization. ${colorInfo}. Simple and professional design.`
        
      case 'diagram':
        return `Create a ${requirement.style} diagram illustration. ${colorInfo}. Clear, minimalist design with simple shapes.`
        
      case 'infographic':
        return `Create a ${requirement.style} infographic element. ${colorInfo}. Clean, modern design with icons and simple graphics.`
        
      case 'illustration':
      default:
        return `Create a ${requirement.style} illustration. ${colorInfo}. Professional, minimalist style suitable for documents.`
    }
  }

  private generateCaption(requirement: GraphicRequirement): string {
    switch (requirement.type) {
      case 'chart':
        return 'Data visualization'
      case 'diagram':
        return 'Process diagram'
      case 'infographic':
        return 'Key information'
      default:
        return 'Illustration'
    }
  }

  private async downloadAndProcessImage(
    url: string,
    dimensions?: { width: number; height: number }
  ): Promise<Buffer> {
    const response = await fetch(url)
    const buffer = Buffer.from(await response.arrayBuffer())
    
    if (dimensions) {
      return await sharp(buffer)
        .resize(dimensions.width, dimensions.height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toBuffer()
    }
    
    return buffer
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 }
  }

  // Helper methods for enhanced generation

  private detectSubject(): string {
    if (!this.analysisResult) return 'language'
    
    const keywords = this.analysisResult.contentAnalysis?.keywords || []
    const subjects: Record<string, string[]> = {
      'math': ['math', 'equation', 'calculate', 'algebra', 'geometry', 'number', 'formula'],
      'science': ['science', 'experiment', 'hypothesis', 'biology', 'chemistry', 'physics'],
      'language': ['read', 'write', 'grammar', 'vocabulary', 'literature', 'essay'],
      'history': ['history', 'date', 'event', 'civilization', 'past', 'timeline'],
      'art': ['art', 'draw', 'paint', 'create', 'design', 'color', 'creative']
    }
    
    // Simple keyword matching
    for (const [subject, subjectKeywords] of Object.entries(subjects)) {
      if (keywords.some(keyword => 
        subjectKeywords.some(sk => keyword.toLowerCase().includes(sk))
      )) {
        return subject
      }
    }
    
    return 'language' // Default
  }

  private detectAgeGroup(): string {
    if (!this.analysisResult) return 'elementary'
    
    const readability = this.analysisResult.contentAnalysis?.readabilityScore || 50
    const visualComplexity = this.analysisResult.visualHierarchy?.complexityScore || 0.5
    
    if (readability < 30 && visualComplexity < 0.3) return 'preschool'
    if (readability < 50 && visualComplexity < 0.5) return 'elementary'
    if (readability < 70 && visualComplexity < 0.7) return 'middle-school'
    if (readability < 85 && visualComplexity < 0.85) return 'high-school'
    return 'adult'
  }

  private async generateAgeAppropriateEnhancements(
    context: PipelineContext,
    plan: EnhancementPlan,
    _signal?: AbortSignal
  ): Promise<{
    backgrounds: GeneratedBackground[]
    decorativeElements: GeneratedElement[]
  }> {
    const ageGroup = this.detectAgeGroup()
    const subject = this.detectSubject()
    const backgrounds: GeneratedBackground[] = []
    const decorativeElements: GeneratedElement[] = []
    
    try {
      // Generate age-appropriate background if needed
      if (plan.assetRequirements.backgrounds.length < 2) {
        // Convert colorPalette to expected format
        const convertedPalette = {
          primary: plan.colorEnhancements.primaryColor,
          secondary: plan.colorEnhancements.secondaryColor,
          accent: plan.colorEnhancements.accentColor,
          background: plan.colorEnhancements.backgroundColor,
          text: plan.colorEnhancements.textColor || '#000000'
        }
        const bgResult = assetGeneration.generateAgeAppropriateElement(
          'background',
          ageGroup,
          convertedPalette,
          {
            subject,
            educational: this.analysisResult?.documentType === 'educational'
          }
        )
        
        const bgBuffer = await sharp(Buffer.from(bgResult.svg))
          .png()
          .toBuffer()
        
        const fileKey = `assets/${context.userId}/${context.documentId}/age-bg-${Date.now()}.png`
        const url = await uploadFile(bgBuffer, fileKey)
        
        backgrounds.push({
          id: `age-bg-1`,
          url,
          type: 'pattern',
          dimensions: { width: 1792, height: 1024 },
          fileSize: bgBuffer.length,
          metadata: bgResult.metadata
        })
      }
      
      // Generate age-appropriate decorations
      const decorationCount = ageGroup === 'preschool' ? 4 : 
                            ageGroup === 'elementary' ? 3 : 
                            ageGroup === 'middle-school' ? 2 : 1
      
      for (let i = 0; i < decorationCount; i++) {
        const decorResult = assetGeneration.generateAgeAppropriateElement(
          'decoration',
          ageGroup,
          plan.colorEnhancements,
          { subject }
        )
        
        const decorBuffer = await sharp(Buffer.from(decorResult.svg))
          .png()
          .toBuffer()
        
        const fileKey = `assets/${context.userId}/${context.documentId}/age-decor-${Date.now()}-${i}.png`
        const url = await uploadFile(decorBuffer, fileKey)
        
        const position = this.calculateElementPosition(
          i < 2 ? 'corners' : 'random',
          i,
          decorationCount
        )
        
        decorativeElements.push({
          id: `age-decor-${i + 1}`,
          url,
          type: 'shape',
          position,
          dimensions: { width: 100, height: 100 },
          rotation: 0,
          metadata: decorResult.metadata
        })
      }
    } catch (error) {
      console.error('Failed to generate age-appropriate enhancements:', error)
    }
    
    return { backgrounds, decorativeElements }
  }
}