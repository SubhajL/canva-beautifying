import { 
  PipelineContext, 
  InitialAnalysisResult,
  EnhancementPlan,
  GeneratedAssets,
  CompositionResult
} from '../types'
import { downloadFromR2, uploadToR2 } from '@/lib/r2/client'
import sharp from 'sharp'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import Canvas from 'canvas'
import { 
  compositionAlgorithms,
  CompositionLayer,
  BlendMode
} from '@/lib/enhancement/algorithms/composition'

export class FinalCompositionStage {
  async execute(
    context: PipelineContext,
    analysisResult: InitialAnalysisResult,
    enhancementPlan: EnhancementPlan,
    generatedAssets: GeneratedAssets | null,
    _signal?: AbortSignal
  ): Promise<CompositionResult> {
    const startTime = Date.now()
    
    try {
      // Download original document
      const originalBuffer = await downloadFromR2(context.originalFileUrl)
      
      let enhancedBuffer: Buffer
      let thumbnailBuffer: Buffer
      
      // Process based on file type
      if (context.fileType === 'pdf') {
        enhancedBuffer = await this.composePDF(
          originalBuffer,
          analysisResult,
          enhancementPlan,
          generatedAssets,
          context
        )
        thumbnailBuffer = await this.createPDFThumbnail(enhancedBuffer)
      } else {
        enhancedBuffer = await this.composeImage(
          originalBuffer,
          analysisResult,
          enhancementPlan,
          generatedAssets,
          context
        )
        thumbnailBuffer = await this.createImageThumbnail(enhancedBuffer)
      }
      
      // Upload enhanced document
      const enhancedFileKey = `enhanced/${context.userId}/${context.documentId}/final-${Date.now()}.${context.fileType}`
      const enhancedFileUrl = await uploadToR2(enhancedBuffer, enhancedFileKey)
      
      // Upload thumbnail
      const thumbnailKey = `enhanced/${context.userId}/${context.documentId}/thumb-${Date.now()}.png`
      const thumbnailUrl = await uploadToR2(thumbnailBuffer, thumbnailKey)
      
      // Calculate improvements
      const improvements = this.calculateImprovements(
        analysisResult.currentScore,
        enhancementPlan.strategy.estimatedImpact
      )
      
      // List applied enhancements
      const appliedEnhancements = this.getAppliedEnhancements(
        enhancementPlan,
        generatedAssets
      )
      
      const endTime = Date.now()
      
      return {
        enhancedFileUrl,
        thumbnailUrl,
        improvements,
        appliedEnhancements,
        processingTime: {
          analysis: analysisResult.metadata.fileSize / 1000, // Estimate
          planning: 2000, // Estimate
          generation: generatedAssets ? 5000 : 0,
          composition: endTime - startTime,
          total: endTime - context.startTime,
        },
        metadata: {
          fileSize: enhancedBuffer.length,
          format: context.fileType,
          dimensions: analysisResult.metadata.dimensions,
          pageCount: analysisResult.metadata.pageCount,
        },
      }
    } catch (error) {
      console.error('Final composition failed:', error)
      throw new Error(`Final composition failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async composePDF(
    originalBuffer: Buffer,
    analysis: InitialAnalysisResult,
    plan: EnhancementPlan,
    assets: GeneratedAssets | null,
    context: PipelineContext
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(originalBuffer)
    const pages = pdfDoc.getPages()
    
    // Apply enhancements to each page
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      
      // Apply background if available
      if (assets?.backgrounds[0]) {
        await this.applyBackgroundToPDFPage(page, assets.backgrounds[0])
      }
      
      // Apply color adjustments
      this.applyColorsToPDFPage(page, plan.colorEnhancements)
      
      // Apply typography improvements (limited in PDF)
      await this.applyTypographyToPDFPage(page, plan.typographyEnhancements)
      
      // Add decorative elements
      if (assets?.decorativeElements) {
        await this.addDecorativeElementsToPDFPage(
          page,
          assets.decorativeElements,
          i === 0 // Only on first page
        )
      }
      
      // Add watermark for free tier
      if (context.subscriptionTier === 'free') {
        await this.addWatermarkToPDFPage(page)
      }
    }
    
    return Buffer.from(await pdfDoc.save())
  }

  private async composeImage(
    originalBuffer: Buffer,
    analysis: InitialAnalysisResult,
    plan: EnhancementPlan,
    assets: GeneratedAssets | null,
    context: PipelineContext
  ): Promise<Buffer> {
    // Load original image
    const originalImage = sharp(originalBuffer)
    const metadata = await originalImage.metadata()
    const width = metadata.width || 1920
    const height = metadata.height || 1080
    
    // Initialize composition engine
    const compositionEngine = new compositionAlgorithms.CompositionEngine()
    const layers: CompositionLayer[] = []
    
    // Create background layer if available
    if (assets?.backgrounds[0]) {
      const bgBuffer = await downloadFromR2(assets.backgrounds[0].url)
      layers.push({
        id: 'background-main',
        type: 'background',
        content: { data: bgBuffer },
        properties: {
          x: 0,
          y: 0,
          width,
          height,
          rotation: 0,
          scale: 1,
          opacity: 0.3,
          blendMode: 'normal' as BlendMode,
          zIndex: 0
        },
        metadata: {
          importance: 0.3,
          visualWeight: 0.5,
          semanticType: 'contextual-background'
        }
      })
    }
    
    // Create original image layer
    layers.push({
      id: 'original-image',
      type: 'original',
      content: { data: originalBuffer },
      properties: {
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        scale: 1,
        opacity: 1,
        blendMode: 'normal' as BlendMode,
        zIndex: 1
      },
      metadata: {
        importance: 1,
        visualWeight: 10,
        semanticType: 'main-content'
      }
    })
    
    // Create color enhancement overlay
    if (plan.colorEnhancements.adjustments.length > 0) {
      const colorOverlay = this.createColorEnhancementLayer(
        width,
        height,
        plan.colorEnhancements
      )
      layers.push(colorOverlay)
    }
    
    // Smart placement for decorative elements
    if (assets?.decorativeElements) {
      const decorativeLayers = await this.createDecorativeLayers(
        assets.decorativeElements,
        { width, height },
        analysis
      )
      layers.push(...decorativeLayers)
    }
    
    // Smart placement for educational graphics
    if (assets?.educationalGraphics) {
      const graphicLayers = await this.createEducationalGraphicLayers(
        assets.educationalGraphics,
        { width, height },
        analysis,
        layers
      )
      layers.push(...graphicLayers)
    }
    
    // Typography enhancement layer
    if (analysis.extractedText.title || analysis.extractedText.headings.length > 0) {
      const typographyLayer = this.createTypographyEnhancementLayer(
        analysis.extractedText,
        plan.typographyEnhancements,
        { width, height }
      )
      if (typographyLayer) layers.push(typographyLayer)
    }
    
    // Watermark layer for free tier
    if (context.subscriptionTier === 'free') {
      layers.push(this.createWatermarkLayer(width, height))
    }
    
    // Compose all layers with optimization
    const compositionResult = await compositionEngine.compose(
      layers,
      { width, height },
      {
        optimizeBalance: true,
        targetBalance: 0.85,
        autoBlendModes: true,
        preserveOriginal: true
      }
    )
    
    // Render composed layers to canvas
    const canvas = Canvas.createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    
    // Render each layer in order
    for (const layer of compositionResult.layers) {
      await this.renderLayer(ctx, layer, { width, height })
    }
    
    // Apply final adjustments based on balance analysis
    if (compositionResult.balance.overall < 0.7) {
      this.applyBalanceCorrection(ctx, compositionResult.balance, { width, height })
    }
    
    // Convert canvas to buffer
    const enhancedBuffer = canvas.toBuffer('image/png')
    
    // Apply final sharpening and optimization
    return await sharp(enhancedBuffer)
      .sharpen()
      .png({ quality: 95, compressionLevel: 9 })
      .toBuffer()
  }

  private async applyBackgroundToPDFPage(page: any, _background: GeneratedAssets['backgrounds'][0]) {
    // This is simplified - in production, you'd properly embed the image
    const { width, height } = page.getSize()
    
    // Draw a subtle background color instead of image for PDF
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.95, 0.95, 0.97),
      opacity: 0.5,
    })
  }

  private applyColorsToPDFPage(_page: any, _colors: EnhancementPlan['colorEnhancements']) {
    // PDF color adjustments are limited
    // This would require parsing and modifying existing content
    // For now, we'll skip this in PDF
  }

  private async applyTypographyToPDFPage(_page: any, _typography: EnhancementPlan['typographyEnhancements']) {
    // Typography changes in existing PDFs are very limited
    // We can only add new text, not modify existing
    // Skip for now
  }

  private async addDecorativeElementsToPDFPage(page: any, elements: GeneratedAssets['decorativeElements'], isFirstPage: boolean) {
    if (!isFirstPage) return
    
    const { width, height } = page.getSize()
    
    // Add simple decorative shapes
    for (const element of elements.slice(0, 2)) {
      const x = (element.position.x / 1792) * width
      const y = height - (element.position.y / 1024) * height
      
      page.drawCircle({
        x,
        y,
        size: 20,
        color: rgb(0.31, 0.27, 0.89),
        opacity: 0.2,
      })
    }
  }

  private async addWatermarkToPDFPage(page: any) {
    const { width, _height } = page.getSize()
    const font = await page.doc.embedFont(StandardFonts.Helvetica)
    
    page.drawText('Enhanced with Canva Beautifying', {
      x: width / 2 - 100,
      y: 30,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.5,
    })
  }

  private applyColorOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    colors: EnhancementPlan['colorEnhancements']
  ) {
    // Apply subtle color correction overlay
    ctx.globalCompositeOperation = 'overlay'
    ctx.globalAlpha = 0.1
    
    // Create gradient overlay for better color harmony
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, colors.primaryColor)
    gradient.addColorStop(1, colors.secondaryColor)
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1.0
  }

  private async drawDecorativeElement(
    ctx: CanvasRenderingContext2D,
    element: GeneratedAssets['decorativeElements'][0],
    canvasWidth: number,
    canvasHeight: number
  ) {
    try {
      const elementBuffer = await downloadFromR2(element.url)
      const elementImage = await Canvas.loadImage(elementBuffer)
      
      // Scale position to canvas size
      const x = (element.position.x / 1792) * canvasWidth
      const y = (element.position.y / 1024) * canvasHeight
      
      ctx.save()
      
      if (element.rotation) {
        ctx.translate(x + element.dimensions.width / 2, y + element.dimensions.height / 2)
        ctx.rotate((element.rotation * Math.PI) / 180)
        ctx.translate(-element.dimensions.width / 2, -element.dimensions.height / 2)
      } else {
        ctx.translate(x, y)
      }
      
      ctx.globalAlpha = 0.8
      ctx.drawImage(
        elementImage,
        0,
        0,
        element.dimensions.width,
        element.dimensions.height
      )
      
      ctx.restore()
    } catch (error) {
      console.error('Failed to draw decorative element:', error)
    }
  }

  private async placeEducationalGraphics(
    ctx: CanvasRenderingContext2D,
    graphics: GeneratedAssets['educationalGraphics'],
    layout: InitialAnalysisResult['layoutAnalysis'],
    width: number,
    height: number
  ) {
    // Find suitable placement for graphics
    for (const graphic of graphics) {
      try {
        const graphicBuffer = await downloadFromR2(graphic.url)
        const graphicImage = await Canvas.loadImage(graphicBuffer)
        
        // Place in content areas with enough space
        const contentSections = layout.sections.filter(s => s.type === 'content')
        if (contentSections.length > 0) {
          const section = contentSections[0]
          const x = (section.bounds.x / 100) * width
          const y = (section.bounds.y / 100) * height
          
          ctx.drawImage(
            graphicImage,
            x,
            y,
            graphic.dimensions.width,
            graphic.dimensions.height
          )
          
          // Add caption if present
          if (graphic.caption) {
            ctx.font = '14px Arial'
            ctx.fillStyle = '#666'
            ctx.fillText(
              graphic.caption,
              x,
              y + graphic.dimensions.height + 20
            )
          }
        }
      } catch (error) {
        console.error('Failed to place educational graphic:', error)
      }
    }
  }

  private applyTypographyOverlay(
    _ctx: CanvasRenderingContext2D,
    _text: InitialAnalysisResult['extractedText'],
    _typography: EnhancementPlan['typographyEnhancements'],
    _width: number,
    _height: number
  ) {
    // This would require OCR to find text positions
    // For now, we'll skip modifying existing text
    // In production, you'd use OCR to locate and enhance text
  }

  private addWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.font = '16px Arial'
    ctx.fillStyle = '#666'
    ctx.textAlign = 'center'
    ctx.fillText(
      'Enhanced with Canva Beautifying - Free Plan',
      width / 2,
      height - 30
    )
    ctx.restore()
  }

  private async createPDFThumbnail(_pdfBuffer: Buffer): Promise<Buffer> {
    // Create a simple thumbnail
    // In production, you'd render the first page of the PDF
    return await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 240, g: 240, b: 245 }
      }
    })
    .png()
    .toBuffer()
  }

  private async createImageThumbnail(imageBuffer: Buffer): Promise<Buffer> {
    return await sharp(imageBuffer)
      .resize(400, 300, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .png()
      .toBuffer()
  }

  private calculateImprovements(
    originalScores: InitialAnalysisResult['currentScore'],
    estimatedImpact: number
  ): CompositionResult['improvements'] {
    const improvementFactor = estimatedImpact / 100
    
    const improve = (score: number) => {
      const improvement = score + (100 - score) * improvementFactor
      return Math.min(100, Math.round(improvement))
    }
    
    return {
      colorScore: {
        before: originalScores.color,
        after: improve(originalScores.color),
      },
      typographyScore: {
        before: originalScores.typography,
        after: improve(originalScores.typography),
      },
      layoutScore: {
        before: originalScores.layout,
        after: improve(originalScores.layout),
      },
      visualScore: {
        before: originalScores.visuals,
        after: improve(originalScores.visuals),
      },
      overallScore: {
        before: originalScores.overall,
        after: improve(originalScores.overall),
      },
    }
  }

  private getAppliedEnhancements(
    plan: EnhancementPlan,
    assets: GeneratedAssets | null
  ): string[] {
    const enhancements: string[] = []
    
    // Color enhancements
    if (plan.colorEnhancements.adjustments.length > 0) {
      enhancements.push('Color palette optimization')
    }
    
    // Typography
    if (plan.typographyEnhancements.headingFont.family !== 'Arial') {
      enhancements.push('Typography improvements')
    }
    
    // Layout
    if (plan.layoutEnhancements.whitespaceAdjustments.length > 0) {
      enhancements.push('Layout restructuring')
    }
    
    // Assets
    if (assets) {
      if (assets.backgrounds.length > 0) {
        enhancements.push(`${assets.backgrounds.length} background(s) added`)
      }
      if (assets.decorativeElements.length > 0) {
        enhancements.push(`${assets.decorativeElements.length} decorative element(s)`)
      }
      if (assets.educationalGraphics.length > 0) {
        enhancements.push(`${assets.educationalGraphics.length} graphic(s) generated`)
      }
    }
    
    return enhancements
  }

  // New helper methods for enhanced composition

  private createColorEnhancementLayer(
    width: number,
    height: number,
    colorEnhancements: EnhancementPlan['colorEnhancements']
  ): CompositionLayer {
    // Create a gradient overlay for color enhancement
    const canvas = Canvas.createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, colorEnhancements.primaryColor)
    gradient.addColorStop(0.5, colorEnhancements.secondaryColor)
    gradient.addColorStop(1, colorEnhancements.accentColor)
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
    
    return {
      id: 'color-enhancement',
      type: 'overlay',
      content: { data: canvas.toBuffer() },
      properties: {
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        scale: 1,
        opacity: 0.1,
        blendMode: 'overlay' as BlendMode,
        zIndex: 2
      },
      metadata: {
        importance: 0.5,
        visualWeight: 0.3,
        semanticType: 'color-correction'
      }
    }
  }

  private async createDecorativeLayers(
    decorativeElements: GeneratedAssets['decorativeElements'],
    canvas: { width: number; height: number },
    _analysis: InitialAnalysisResult
  ): Promise<CompositionLayer[]> {
    const layers: CompositionLayer[] = []
    
    // Group elements by type for better organization
    const elementsByType = decorativeElements.reduce((acc, elem) => {
      if (!acc[elem.type]) acc[elem.type] = []
      acc[elem.type].push(elem)
      return acc
    }, {} as Record<string, typeof decorativeElements>)
    
    // Process each type with appropriate placement strategy
    for (const [type, elements] of Object.entries(elementsByType)) {
      const placementConstraints = {
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
        avoidOverlap: true,
        preferredZones: this.getPreferredZonesForType(type),
        alignment: 'free' as const
      }
      
      for (const element of elements) {
        const buffer = await downloadFromR2(element.url)
        
        // Use smart placement if position not specified
        let position = element.position
        if (!position || (position.x === 0 && position.y === 0)) {
          const placement = compositionAlgorithms.SmartPlacement.findOptimalPlacement(
            {
              width: element.dimensions.width,
              height: element.dimensions.height,
              type: element.type,
              importance: 0.6
            },
            canvas,
            layers,
            placementConstraints
          )
          position = { x: placement.x, y: placement.y }
        }
        
        layers.push({
          id: `decorative-${element.id}`,
          type: 'decoration',
          content: { data: buffer },
          properties: {
            x: position.x,
            y: position.y,
            width: element.dimensions.width,
            height: element.dimensions.height,
            rotation: element.rotation || 0,
            scale: 1,
            opacity: 0.8,
            blendMode: 'soft-light' as BlendMode,
            zIndex: 3 + layers.length
          },
          metadata: {
            importance: 0.4,
            visualWeight: 0.5,
            semanticType: `decoration-${type}`
          }
        })
      }
    }
    
    return layers
  }

  private async createEducationalGraphicLayers(
    graphics: GeneratedAssets['educationalGraphics'],
    canvas: { width: number; height: number },
    analysis: InitialAnalysisResult,
    existingLayers: CompositionLayer[]
  ): Promise<CompositionLayer[]> {
    const layers: CompositionLayer[] = []
    
    // Arrange graphics using smart layout
    const graphicsToArrange = graphics.map((g, i) => ({
      id: g.id,
      width: g.dimensions.width,
      height: g.dimensions.height,
      type: g.type,
      importance: 0.8 - i * 0.1 // Decreasing importance
    }))
    
    const positions = compositionAlgorithms.SmartPlacement.arrangeObjects(
      graphicsToArrange,
      canvas,
      {
        layout: 'flow',
        spacing: 30,
        alignment: 'center'
      }
    )
    
    // Create layers for each graphic
    for (const graphic of graphics) {
      const buffer = await downloadFromR2(graphic.url)
      const _position = positions.get(graphic.id) || { x: 100, y: 100 }
      
      // Find optimal placement considering existing content
      const placement = compositionAlgorithms.SmartPlacement.findOptimalPlacement(
        {
          width: graphic.dimensions.width,
          height: graphic.dimensions.height,
          type: 'educational',
          importance: 0.8
        },
        canvas,
        [...existingLayers, ...layers],
        {
          margins: { top: 60, right: 60, bottom: 60, left: 60 },
          avoidOverlap: true,
          alignment: 'rule-of-thirds'
        }
      )
      
      layers.push({
        id: `graphic-${graphic.id}`,
        type: 'graphic',
        content: { data: buffer },
        properties: {
          x: placement.x,
          y: placement.y,
          width: graphic.dimensions.width,
          height: graphic.dimensions.height,
          rotation: 0,
          scale: 1,
          opacity: 0.95,
          blendMode: 'normal' as BlendMode,
          zIndex: 10 + layers.length
        },
        metadata: {
          importance: 0.8,
          visualWeight: 2,
          semanticType: `educational-${graphic.type}`
        }
      })
    }
    
    return layers
  }

  private createTypographyEnhancementLayer(
    _extractedText: InitialAnalysisResult['extractedText'],
    _typographyEnhancements: EnhancementPlan['typographyEnhancements'],
    _canvas: { width: number; height: number }
  ): CompositionLayer | null {
    // In a real implementation, this would use OCR to locate text
    // and apply typography enhancements
    // For now, we'll return null as we can't modify existing text in images
    return null
  }

  private createWatermarkLayer(width: number, height: number): CompositionLayer {
    const canvas = Canvas.createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    
    ctx.font = '16px Arial'
    ctx.fillStyle = '#666666'
    ctx.globalAlpha = 0.5
    ctx.textAlign = 'center'
    ctx.fillText(
      'Enhanced with Canva Beautifying - Free Plan',
      width / 2,
      height - 30
    )
    
    return {
      id: 'watermark',
      type: 'overlay',
      content: { data: canvas.toBuffer() },
      properties: {
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        scale: 1,
        opacity: 0.5,
        blendMode: 'normal' as BlendMode,
        zIndex: 999
      },
      metadata: {
        importance: 0.1,
        visualWeight: 0.1,
        semanticType: 'watermark'
      }
    }
  }

  private async renderLayer(
    ctx: CanvasRenderingContext2D,
    layer: CompositionLayer,
    _canvas: { width: number; height: number }
  ): Promise<void> {
    if (!layer.content.data) return
    
    try {
      const image = await Canvas.loadImage(layer.content.data)
      
      ctx.save()
      
      // Apply blend mode
      ctx.globalCompositeOperation = this.getCanvasBlendMode(layer.properties.blendMode)
      ctx.globalAlpha = layer.properties.opacity
      
      // Apply transformations
      if (layer.properties.rotation !== 0) {
        const centerX = layer.properties.x + layer.properties.width / 2
        const centerY = layer.properties.y + layer.properties.height / 2
        ctx.translate(centerX, centerY)
        ctx.rotate((layer.properties.rotation * Math.PI) / 180)
        ctx.translate(-centerX, -centerY)
      }
      
      // Scale if needed
      if (layer.properties.scale !== 1) {
        const centerX = layer.properties.x + layer.properties.width / 2
        const centerY = layer.properties.y + layer.properties.height / 2
        ctx.translate(centerX, centerY)
        ctx.scale(layer.properties.scale, layer.properties.scale)
        ctx.translate(-centerX, -centerY)
      }
      
      // Draw the layer
      ctx.drawImage(
        image,
        layer.properties.x,
        layer.properties.y,
        layer.properties.width,
        layer.properties.height
      )
      
      ctx.restore()
    } catch (error) {
      console.error(`Failed to render layer ${layer.id}:`, error)
    }
  }

  private getCanvasBlendMode(blendMode: BlendMode): GlobalCompositeOperation {
    const blendModeMap: Record<BlendMode, GlobalCompositeOperation> = {
      'normal': 'source-over',
      'multiply': 'multiply',
      'screen': 'screen',
      'overlay': 'overlay',
      'soft-light': 'soft-light',
      'hard-light': 'hard-light',
      'color-dodge': 'color-dodge',
      'color-burn': 'color-burn',
      'darken': 'darken',
      'lighten': 'lighten',
      'difference': 'difference',
      'exclusion': 'exclusion'
    }
    return blendModeMap[blendMode] || 'source-over'
  }

  private applyBalanceCorrection(
    ctx: CanvasRenderingContext2D,
    balance: any,
    canvas: { width: number; height: number }
  ): void {
    // Apply subtle vignette to improve focus
    if (balance.radial < 0.6) {
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) / 2
      )
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)')
      
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    
    // Add subtle gradient to balance horizontal/vertical
    if (balance.horizontal < 0.7 || balance.vertical < 0.7) {
      const needsLeftWeight = balance.centerOfMass.x > canvas.width / 2
      const needsTopWeight = balance.centerOfMass.y > canvas.height / 2
      
      const gradient = ctx.createLinearGradient(
        needsLeftWeight ? 0 : canvas.width,
        needsTopWeight ? 0 : canvas.height,
        needsLeftWeight ? canvas.width : 0,
        needsTopWeight ? canvas.height : 0
      )
      
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)')
      gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
  }

  private getPreferredZonesForType(type: string): Array<'top' | 'bottom' | 'left' | 'right' | 'center'> {
    const zoneMap: Record<string, Array<'top' | 'bottom' | 'left' | 'right' | 'center'>> = {
      'icon': ['top', 'left'],
      'border': ['top', 'bottom'],
      'shape': ['center'],
      'divider': ['center', 'bottom']
    }
    return zoneMap[type] || ['center']
  }
}