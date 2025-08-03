import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'

export interface DocumentExporterConfig {
  subscriptionTier: 'free' | 'basic' | 'pro' | 'premium'
  watermark: boolean
}

export class DocumentExporter {
  private config: DocumentExporterConfig

  constructor(config: DocumentExporterConfig) {
    this.config = config
  }

  async exportToPDF(
    documentBuffer: Buffer,
    _quality: 'standard' | 'high' | 'print'
  ): Promise<Buffer> {
    // If already PDF, return as is
    if (this.isPDF(documentBuffer)) {
      return documentBuffer
    }

    // Convert image to PDF
    const pdfDoc = await PDFDocument.create()
    const image = await pdfDoc.embedPng(documentBuffer)
    const page = pdfDoc.addPage([image.width, image.height])
    
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    })

    if (this.config.watermark) {
      // Add watermark for free tier
      const helveticaFont = await pdfDoc.embedFont('Helvetica')
      page.drawText('Enhanced with Canva Beautifying - Free Plan', {
        x: 50,
        y: 30,
        size: 12,
        font: helveticaFont,
        opacity: 0.5,
      })
    }

    return Buffer.from(await pdfDoc.save())
  }

  async exportToPNG(
    documentBuffer: Buffer,
    quality: 'standard' | 'high' | 'print'
  ): Promise<Buffer> {
    const qualitySettings = {
      standard: { quality: 85, dpi: 72 },
      high: { quality: 95, dpi: 150 },
      print: { quality: 100, dpi: 300 },
    }

    const settings = qualitySettings[quality]

    let imageBuffer = documentBuffer
    
    // Convert PDF to image if needed
    if (this.isPDF(documentBuffer)) {
      // In production, you'd use a proper PDF renderer
      // For now, create a placeholder
      imageBuffer = await this.createPlaceholderImage()
    }

    // Process image
    let pipeline = sharp(imageBuffer)
      .png({ quality: settings.quality })

    // Add DPI metadata
    pipeline = pipeline.withMetadata({
      density: settings.dpi
    })

    // Add watermark for free tier
    if (this.config.watermark) {
      const watermark = await this.createWatermark()
      pipeline = pipeline.composite([{
        input: watermark,
        gravity: 'southeast',
        blend: 'over'
      }])
    }

    return await pipeline.toBuffer()
  }

  async exportToCanva(
    documentBuffer: Buffer,
    enhancementStrategy: {
      colorEnhancements?: {
        backgroundColor?: string
        primaryColor?: string
        secondaryColor?: string
        accentColor?: string
      }
      typographyEnhancements?: {
        headingFont?: string
        bodyFont?: string
        fontSize?: number
        lineHeight?: number
      }
      layoutEnhancements?: {
        grid?: string
        spacing?: number
        alignment?: string
      }
    }
  ): Promise<Buffer> {
    // Create Canva-compatible JSON format
    const canvaDesign = {
      version: '1.0',
      type: 'canva_design',
      dimensions: {
        width: 1920,
        height: 1080,
        unit: 'px'
      },
      pages: [{
        elements: [],
        background: enhancementStrategy?.colorEnhancements?.backgroundColor || '#FFFFFF'
      }],
      fonts: enhancementStrategy?.typographyEnhancements || {},
      colors: enhancementStrategy?.colorEnhancements || {},
      metadata: {
        created: new Date().toISOString(),
        generator: 'Canva Beautifying',
        tier: this.config.subscriptionTier
      }
    }

    return Buffer.from(JSON.stringify(canvaDesign, null, 2))
  }

  async exportToPPTX(
    documentBuffer: Buffer,
    title: string
  ): Promise<Buffer> {
    // In production, you'd use a library like pptxgenjs
    // For now, return a placeholder
    const placeholder = {
      type: 'powerpoint',
      title,
      slides: 1,
      exportedAt: new Date().toISOString()
    }

    return Buffer.from(JSON.stringify(placeholder))
  }

  private isPDF(buffer: Buffer): boolean {
    return buffer.slice(0, 4).toString() === '%PDF'
  }

  private async createPlaceholderImage(): Promise<Buffer> {
    return await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 3,
        background: { r: 240, g: 240, b: 245 }
      }
    })
    .png()
    .toBuffer()
  }

  private async createWatermark(): Promise<Buffer> {
    const watermarkSvg = `
      <svg width="300" height="50">
        <text x="10" y="30" font-family="Arial" font-size="14" fill="#666" opacity="0.5">
          Enhanced with Canva Beautifying - Free Plan
        </text>
      </svg>
    `

    return await sharp(Buffer.from(watermarkSvg))
      .png()
      .toBuffer()
  }
}