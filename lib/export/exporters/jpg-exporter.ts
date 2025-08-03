import sharp from 'sharp'
import { BaseExporter } from './base-exporter'
import { ExportRequest, ExportResult } from '../types'
import { uploadFile } from '@/lib/r2'

export class JpgExporter extends BaseExporter {
  constructor() {
    super('jpg')
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
        
        // Apply background color (important for JPG as it doesn't support transparency)
        const backgroundColor = request.options.backgroundColor || '#FFFFFF'
        sharpInstance.flatten({
          background: backgroundColor
        })
        
        // Convert to JPG with specified quality
        const quality = request.options.quality || 90
        const outputBuffer = await sharpInstance
          .jpeg({
            quality,
            progressive: true,
            mozjpeg: true, // Use mozjpeg encoder for better compression
            optimizeScans: true,
            chromaSubsampling: quality >= 90 ? '4:4:4' : '4:2:0'
          })
          .toBuffer()
        
        return outputBuffer
      })

      // Get dimensions
      const dimensions = await this.getImageDimensions(processedBuffer)
      
      // Generate filename
      const fileName = this.generateExportFileName(request.documentId, 'jpg')
      
      // Upload to R2
      const exportUrl = await uploadFile(
        processedBuffer,
        `exports/${request.userId}/${fileName}`,
        'image/jpeg'
      )

      return {
        success: true,
        documentId: request.documentId,
        format: 'jpg',
        exportUrl,
        fileSize: processedBuffer.length,
        dimensions,
        processingTime: time
      }
    } catch (error) {
      return {
        success: false,
        documentId: request.documentId,
        format: 'jpg',
        error: error instanceof Error ? error.message : 'JPG export failed',
        processingTime: 0
      }
    }
  }

  validateOptions(request: ExportRequest): boolean {
    // Validate quality
    if (request.options.quality !== undefined) {
      if (request.options.quality < 1 || request.options.quality > 100) {
        return false
      }
    }
    
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