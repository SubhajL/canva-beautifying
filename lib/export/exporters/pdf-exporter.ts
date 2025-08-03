import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib'
import sharp from 'sharp'
import { BaseExporter } from './base-exporter'
import { ExportRequest, ExportResult } from '../types'
import { uploadFile } from '@/lib/r2'

export class PdfExporter extends BaseExporter {
  constructor() {
    super('pdf')
  }

  async export(request: ExportRequest): Promise<ExportResult> {
    try {
      const { result: pdfBuffer, time } = await this.measureProcessingTime(async () => {
        // Create a new PDF document
        const pdfDoc = await PDFDocument.create()
        
        // Add metadata
        pdfDoc.setTitle(`Enhanced Document - ${request.documentId}`)
        pdfDoc.setAuthor('BeautifyAI')
        pdfDoc.setCreator('BeautifyAI Document Enhancement Platform')
        pdfDoc.setProducer('BeautifyAI PDF Exporter')
        pdfDoc.setCreationDate(new Date())
        pdfDoc.setModificationDate(new Date())
        
        if (request.options.includeMetadata && request.metadata) {
          pdfDoc.setSubject(JSON.stringify(request.metadata))
        }

        // Download the enhanced image
        const imageBuffer = await this.downloadImage(request.enhancedUrl)
        
        // Get image dimensions
        const metadata = await sharp(imageBuffer).metadata()
        const imageWidth = metadata.width || 1920
        const imageHeight = metadata.height || 1080
        
        // Create page with appropriate size
        const page = pdfDoc.addPage([imageWidth, imageHeight])
        
        // Embed the image
        let embeddedImage
        if (metadata.format === 'png') {
          embeddedImage = await pdfDoc.embedPng(imageBuffer)
        } else {
          // Convert to PNG first for better quality
          const pngBuffer = await sharp(imageBuffer).png().toBuffer()
          embeddedImage = await pdfDoc.embedPng(pngBuffer)
        }
        
        // Draw the image on the page
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: imageWidth,
          height: imageHeight
        })
        
        // Add vector elements if preserveVectors is enabled
        if (request.options.preserveVectors) {
          await this.addVectorElements(page, request)
        }
        
        // Save the PDF
        const pdfBytes = await pdfDoc.save({
          useObjectStreams: false // Better compatibility
        })
        
        return Buffer.from(pdfBytes)
      })

      // Generate filename
      const fileName = this.generateExportFileName(request.documentId, 'pdf')
      
      // Upload to R2
      const exportUrl = await uploadFile(
        pdfBuffer,
        `exports/${request.userId}/${fileName}`,
        'application/pdf'
      )

      return {
        success: true,
        documentId: request.documentId,
        format: 'pdf',
        exportUrl,
        fileSize: pdfBuffer.length,
        processingTime: time
      }
    } catch (error) {
      return {
        success: false,
        documentId: request.documentId,
        format: 'pdf',
        error: error instanceof Error ? error.message : 'PDF export failed',
        processingTime: 0
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async addVectorElements(page: PDFPage, _request: ExportRequest): Promise<void> {
    // In a real implementation, this would extract and add vector elements
    // from the enhancement data (text, shapes, etc.) for true scalability
    
    // For now, add a simple watermark as an example
    if (_request.metadata?.watermark) {
      const helveticaFont = await page.doc.embedFont(StandardFonts.Helvetica)
      const { width } = page.getSize()
      
      page.drawText('Enhanced by BeautifyAI', {
        x: width - 150,
        y: 20,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.5
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  validateOptions(_request: ExportRequest): boolean {
    // PDF export options are generally permissive
    return true
  }
}