import sharp from 'sharp'
import { BaseExporter } from './base-exporter'
import { ExportRequest, ExportResult, CanvaFormat } from '../types'
import { uploadFile } from '@/lib/r2'

export class CanvaExporter extends BaseExporter {
  constructor() {
    super('canva')
  }

  async export(request: ExportRequest): Promise<ExportResult> {
    try {
      const { result: canvaData, time } = await this.measureProcessingTime(async () => {
        // Download and process the enhanced image
        const imageBuffer = await this.downloadImage(request.enhancedUrl)
        const metadata = await sharp(imageBuffer).metadata()
        
        // Upload image to get a persistent URL
        const imageFileName = `canva-assets/${request.documentId}-main.png`
        const imageUrl = await uploadToR2(
          imageBuffer,
          `exports/${request.userId}/${imageFileName}`,
          'image/png'
        )
        
        // Create Canva-compatible JSON structure
        const canvaFormat: CanvaFormat = {
          version: '1.0',
          type: this.inferDocumentType(metadata, request),
          pages: [{
            id: 'page-1',
            elements: [
              {
                type: 'IMAGE',
                position: { x: 0, y: 0 },
                size: { 
                  width: metadata.width || 1920, 
                  height: metadata.height || 1080 
                },
                properties: {
                  src: imageUrl,
                  opacity: 1,
                  rotation: 0,
                  locked: false
                }
              }
            ],
            background: {
              type: 'solid',
              value: '#FFFFFF'
            }
          }],
          assets: [{
            id: 'main-image',
            type: 'image',
            url: imageUrl
          }]
        }
        
        // Add enhancement metadata as elements if available
        if (request.metadata?.enhancements) {
          this.addEnhancementElements(canvaFormat, request.metadata.enhancements as Record<string, unknown>)
        }
        
        // Convert to JSON string
        const jsonString = JSON.stringify(canvaFormat, null, 2)
        return Buffer.from(jsonString)
      })

      // Generate filename
      const fileName = this.generateExportFileName(request.documentId, 'canva').replace('.canva', '.json')
      
      // Upload the Canva JSON file
      const exportUrl = await uploadFile(
        canvaData,
        `exports/${request.userId}/${fileName}`,
        'application/json'
      )

      return {
        success: true,
        documentId: request.documentId,
        format: 'canva',
        exportUrl,
        fileSize: canvaData.length,
        processingTime: time
      }
    } catch (error) {
      return {
        success: false,
        documentId: request.documentId,
        format: 'canva',
        error: error instanceof Error ? error.message : 'Canva export failed',
        processingTime: 0
      }
    }
  }

  private inferDocumentType(
    metadata: sharp.Metadata, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _request: ExportRequest
  ): CanvaFormat['type'] {
    const aspectRatio = (metadata.width || 1) / (metadata.height || 1)
    
    // Infer based on aspect ratio
    if (Math.abs(aspectRatio - 1.778) < 0.1) { // 16:9
      return 'PRESENTATION'
    } else if (Math.abs(aspectRatio - 0.707) < 0.1) { // A4 portrait
      return 'DOCUMENT'
    }
    
    return 'GRAPHIC'
  }

  private addEnhancementElements(
    canvaFormat: CanvaFormat, 
    enhancements: Record<string, unknown>
  ): void {
    // Add text elements if text was enhanced
    if (enhancements.typography) {
      const typography = enhancements.typography as Record<string, unknown>
      if (typography.headings) {
        // Add text element placeholders
        canvaFormat.pages[0].elements.push({
          type: 'GROUP',
          position: { x: 50, y: 50 },
          size: { width: 500, height: 100 },
          properties: {
            name: 'Enhanced Typography',
            locked: false,
            visible: true
          }
        })
      }
    }
    
    // Add shape elements if layout was enhanced
    if (enhancements.decorativeElements) {
      const elements = enhancements.decorativeElements as Array<Record<string, unknown>>
      elements.forEach((element, index) => {
        canvaFormat.pages[0].elements.push({
          type: 'SHAPE',
          position: { 
            x: (element.position as { x: number }).x || 0, 
            y: (element.position as { y: number }).y || 0 
          },
          size: { 
            width: (element.size as { width: number }).width || 100, 
            height: (element.size as { height: number }).height || 100 
          },
          properties: {
            shapeType: element.type || 'rectangle',
            fill: (element.style as Record<string, unknown>)?.fill || '#000000',
            opacity: (element.style as Record<string, unknown>)?.opacity || 1,
            id: `decorative-${index}`
          }
        })
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validateOptions(_request: ExportRequest): boolean {
    // Canva export doesn't have specific options to validate
    return true
  }
}