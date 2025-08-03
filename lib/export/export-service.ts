import { createClient } from '@/lib/supabase/server'
import { PngExporter } from './exporters/png-exporter'
import { JpgExporter } from './exporters/jpg-exporter'
import { PdfExporter } from './exporters/pdf-exporter'
import { CanvaExporter } from './exporters/canva-exporter'
import { BaseExporter } from './exporters/base-exporter'
import { BatchExporter } from './batch-exporter'
import { ExportProgressTracker } from './progress-tracker'
import { 
  ExportRequest, 
  ExportResult, 
  ExportFormat, 
  ExportHistory,
  BatchExportOptions,
  ExportProgress 
} from './types'

export class ExportService {
  private exporters: Map<ExportFormat, BaseExporter>
  private batchExporter: BatchExporter
  private progressTracker: ExportProgressTracker

  constructor() {
    this.exporters = new Map([
      ['png', new PngExporter()],
      ['jpg', new JpgExporter()],
      ['pdf', new PdfExporter()],
      ['canva', new CanvaExporter()]
    ])
    
    this.batchExporter = new BatchExporter()
    this.batchExporter.setExportService(this) // Inject the service to avoid circular dependency
    this.progressTracker = new ExportProgressTracker()
  }

  async exportDocument(request: ExportRequest): Promise<ExportResult> {
    // Validate request
    const exporter = this.exporters.get(request.options.format)
    if (!exporter) {
      return {
        success: false,
        documentId: request.documentId,
        format: request.options.format,
        error: `Unsupported export format: ${request.options.format}`,
        processingTime: 0
      }
    }

    if (!exporter.validateOptions(request)) {
      // Provide specific error for scale validation
      if (request.options.scale && (request.options.scale < 0.1 || request.options.scale > 4)) {
        return {
          success: false,
          documentId: request.documentId,
          format: request.options.format,
          error: 'Invalid scale parameter. Scale must be between 0.1 and 4',
          processingTime: 0
        }
      }
      return {
        success: false,
        documentId: request.documentId,
        format: request.options.format,
        error: 'Invalid export options',
        processingTime: 0
      }
    }

    // Start progress tracking
    const progressId = this.progressTracker.startExport(
      request.documentId,
      request.options.format
    )

    try {
      // Export the document
      const result = await exporter.export(request)
      
      // Update progress
      if (result.success) {
        this.progressTracker.completeExport(progressId, result.exportUrl)
      } else {
        this.progressTracker.failExport(progressId, result.error)
      }
      
      // Store export history
      if (result.success && result.exportUrl) {
        await this.storeExportHistory(request, result)
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed'
      this.progressTracker.failExport(progressId, errorMessage)
      
      return {
        success: false,
        documentId: request.documentId,
        format: request.options.format,
        error: errorMessage,
        processingTime: 0
      }
    }
  }

  async exportBatch(
    userId: string,
    options: BatchExportOptions,
    onProgress?: (documentId: string, progress: ExportProgress) => void
  ): Promise<string> {
    return this.batchExporter.exportBatch(userId, options, onProgress)
  }

  async detectOriginalFormat(documentUrl: string): Promise<ExportFormat> {
    // Detect format based on URL or file extension
    const extension = documentUrl.split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'png':
        return 'png'
      case 'jpg':
      case 'jpeg':
        return 'jpg'
      case 'pdf':
        return 'pdf'
      default:
        return 'png' // Default to PNG
    }
  }

  getProgress(documentId: string): ExportProgress | undefined {
    return this.progressTracker.getProgress(documentId)
  }

  getAllProgress(): ExportProgress[] {
    return this.progressTracker.getAllProgress()
  }

  private async storeExportHistory(
    request: ExportRequest,
    result: ExportResult
  ): Promise<void> {
    try {
      const supabase = await createClient()
      
      await supabase.from('export_history').insert({
        user_id: request.userId,
        document_id: request.documentId,
        format: request.options.format,
        export_url: result.exportUrl,
        file_size: result.fileSize || 0,
        metadata: {
          quality: request.options.quality,
          scale: request.options.scale,
          dimensions: result.dimensions,
          processingTime: result.processingTime
        },
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })
    } catch (error) {
      console.error('Failed to store export history:', error)
    }
  }

  async getUserExportHistory(
    userId: string,
    limit: number = 50
  ): Promise<ExportHistory[]> {
    const supabase = await createClient()
    
    const { data: exports } = await supabase
      .from('export_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    return (exports || []).map(e => ({
      id: e.id,
      userId: e.user_id,
      documentId: e.document_id,
      format: e.format,
      exportedAt: new Date(e.created_at),
      fileSize: e.file_size,
      downloadCount: e.download_count || 0,
      expiresAt: e.expires_at ? new Date(e.expires_at) : undefined,
      exportUrl: e.export_url,
      metadata: e.metadata
    }))
  }

  async incrementDownloadCount(exportId: string): Promise<void> {
    const supabase = await createClient()
    
    await supabase.rpc('increment_export_download_count', {
      export_id: exportId
    })
  }

  async cleanupExpiredExports(): Promise<void> {
    const supabase = await createClient()
    
    // Get expired exports
    const { data: expiredExports } = await supabase
      .from('export_history')
      .select('id, export_url')
      .lt('expires_at', new Date().toISOString())
      .limit(100)
    
    if (!expiredExports || expiredExports.length === 0) return
    
    // Delete files from R2 and records from database
    for (const exportRecord of expiredExports) {
      try {
        // In production, delete from R2
        console.log(`Would delete file: ${exportRecord.export_url}`)
        
        // Delete record
        await supabase
          .from('export_history')
          .delete()
          .eq('id', exportRecord.id)
      } catch (error) {
        console.error(`Failed to cleanup export ${exportRecord.id}:`, error)
      }
    }
  }
}