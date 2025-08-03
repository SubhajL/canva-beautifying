import sharp from 'sharp'
import { BaseExporter } from './base-exporter'
import { ExportRequest, ExportResult } from '../types'
import { uploadFile } from '@/lib/r2'

export class PngExporter extends BaseExporter {
  constructor() {
    super('png')
  }

  async export(request: ExportRequest): Promise<ExportResult> {
    try {
      const { result: processedBuffer, time } = await this.measureProcessingTime(async () => {
        // Download the enhanced image
        const imageBuffer = await this.downloadImage(request.enhancedUrl)
        
        // Process with sharp
        const sharpInstance = sharp(imageBuffer)
        
        // Apply scale if specified
        if (request.options.scale && request.options.scale !== 1) {
          const metadata = await sharpInstance.metadata()
          const newWidth = Math.round((metadata.width || 1920) * request.options.scale)
          const newHeight = Math.round((metadata.height || 1080) * request.options.scale)
          
          sharpInstance.resize(newWidth, newHeight, {
            fit: 'contain',
            kernel: sharp.kernel.lanczos3
          })
        }
        
        // Apply background color if specified
        if (request.options.backgroundColor) {
          sharpInstance.flatten({
            background: request.options.backgroundColor
          })
        }
        
        // Convert to PNG with optimization
        const outputBuffer = await sharpInstance
          .png({
            compressionLevel: 9,
            adaptiveFiltering: true,
            progressive: true
          })
          .toBuffer()
        
        return outputBuffer
      })

      // Get dimensions
      const dimensions = await this.getImageDimensions(processedBuffer)
      
      // Generate filename
      const fileName = this.generateExportFileName(request.documentId, 'png')
      
      // Upload to R2
      const exportUrl = await uploadFile(
        processedBuffer,
        `exports/${request.userId}/${fileName}`,
        'image/png'
      )

      return {
        success: true,
        documentId: request.documentId,
        format: 'png',
        exportUrl,
        fileSize: processedBuffer.length,
        dimensions,
        processingTime: time
      }
    } catch (error) {
      return {
        success: false,
        documentId: request.documentId,
        format: 'png',
        error: error instanceof Error ? error.message : 'PNG export failed',
        processingTime: 0
      }
    }
  }

  validateOptions(request: ExportRequest): boolean {
    // Validate scale
    if (request.options.scale) {
      if (request.options.scale < 0.1 || request.options.scale > 4) {
        return false
      }
    }
    
    // Validate background color
    if (request.options.backgroundColor) {
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
      if (!colorRegex.test(request.options.backgroundColor)) {
        return false
      }
    }
    
    return true
  }

  protected async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
    const metadata = await sharp(buffer).metadata()
    return {
      width: metadata.width || 0,
      height: metadata.height || 0
    }
  }
}