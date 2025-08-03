import { ExportRequest, ExportResult, ExportFormat } from '../types'

export abstract class BaseExporter {
  protected format: ExportFormat

  constructor(format: ExportFormat) {
    this.format = format
  }

  abstract export(request: ExportRequest): Promise<ExportResult>
  
  abstract validateOptions(request: ExportRequest): boolean

  protected async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  protected generateExportFileName(
    documentId: string, 
    format: ExportFormat,
    timestamp: boolean = true
  ): string {
    const date = timestamp ? `-${Date.now()}` : ''
    return `enhanced-${documentId}${date}.${format}`
  }

  protected async uploadToR2(
    buffer: Buffer,
    fileName: string,
    contentType: string
  ): Promise<string> {
    // This would use the R2 storage service to upload
    // For now, return a mock URL
    const mockUrl = `https://r2.example.com/exports/${fileName}`
    console.log(`Would upload ${buffer.length} bytes as ${fileName} with type ${contentType}`)
    return mockUrl
  }

  protected getContentType(format: ExportFormat): string {
    const contentTypes: Record<ExportFormat, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      pdf: 'application/pdf',
      canva: 'application/json'
    }
    return contentTypes[format]
  }

  protected async measureProcessingTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; time: number }> {
    const start = Date.now()
    const result = await operation()
    const time = Date.now() - start
    return { result, time }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async getImageDimensions(_buffer: Buffer): Promise<{ width: number; height: number }> {
    // In production, use sharp or similar to get actual dimensions
    // For now, return mock dimensions
    return { width: 1920, height: 1080 }
  }
}