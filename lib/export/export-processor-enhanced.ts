import { Job } from 'bullmq'
import { ExportService } from './export-service'
import { WebSocketService } from '@/lib/websocket/client'
import { createClient } from '@/lib/supabase/server'
import { ExportFormat } from './types'

interface ExportJobData {
  documentId: string
  userId: string
  format: ExportFormat
  options?: {
    quality?: number
    scale?: number
    preserveVectors?: boolean
    includeMetadata?: boolean
    backgroundColor?: string
  }
  notifyWebSocket?: boolean
  webhookUrl?: string
}

export class ExportProcessor {
  private exportService: ExportService
  private wsService: WebSocketService

  constructor() {
    this.exportService = new ExportService()
    this.wsService = new WebSocketService()
  }

  async process(job: Job<ExportJobData>): Promise<void> {
    const { documentId, userId, format, options, notifyWebSocket, webhookUrl } = job.data

    try {
      // Update job progress
      await job.updateProgress(10)
      
      // Get document details from database
      const documentData = await this.getDocumentData(documentId, userId)
      if (!documentData) {
        throw new Error('Document not found')
      }

      await job.updateProgress(20)

      // Prepare export request
      const exportRequest = {
        documentId,
        userId,
        options: {
          format,
          quality: options?.quality,
          scale: options?.scale,
          preserveVectors: options?.preserveVectors,
          includeMetadata: options?.includeMetadata,
          backgroundColor: options?.backgroundColor
        },
        enhancedUrl: documentData.enhancedUrl,
        originalUrl: documentData.originalUrl,
        metadata: documentData.metadata
      }

      // Notify via WebSocket if requested
      if (notifyWebSocket) {
        await this.wsService.emitToUser(userId, 'export:started', {
          documentId,
          format,
          jobId: job.id
        })
      }

      await job.updateProgress(30)

      // Perform the export
      const result = await this.exportService.exportDocument(exportRequest)

      await job.updateProgress(90)

      if (!result.success) {
        throw new Error(result.error || 'Export failed')
      }

      // Update database with export result
      await this.updateExportRecord(documentId, userId, result)

      await job.updateProgress(95)

      // Send webhook notification if configured
      if (webhookUrl && result.exportUrl) {
        await this.sendWebhook(webhookUrl, {
          event: 'export.completed',
          documentId,
          format,
          exportUrl: result.exportUrl,
          fileSize: result.fileSize,
          dimensions: result.dimensions,
          timestamp: new Date().toISOString()
        })
      }

      // Notify via WebSocket
      if (notifyWebSocket) {
        await this.wsService.emitToUser(userId, 'export:completed', {
          documentId,
          format,
          exportUrl: result.exportUrl,
          fileSize: result.fileSize,
          dimensions: result.dimensions,
          jobId: job.id
        })
      }

      await job.updateProgress(100)
      
      // Return the result
      await job.updateData({
        ...job.data,
        result: {
          exportUrl: result.exportUrl,
          fileSize: result.fileSize,
          dimensions: result.dimensions,
          processingTime: result.processingTime
        }
      })

    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : 'Export failed'
      
      // Notify via WebSocket
      if (notifyWebSocket) {
        await this.wsService.emitToUser(userId, 'export:failed', {
          documentId,
          format,
          error: errorMessage,
          jobId: job.id
        })
      }

      // Send webhook notification
      if (webhookUrl) {
        await this.sendWebhook(webhookUrl, {
          event: 'export.failed',
          documentId,
          format,
          error: errorMessage,
          timestamp: new Date().toISOString()
        })
      }

      throw error
    }
  }

  private async getDocumentData(documentId: string, userId: string) {
    const supabase = await createClient()
    
    const { data: document } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single()

    if (!document) return null

    return {
      enhancedUrl: document.enhanced_url,
      originalUrl: document.original_url,
      metadata: document.metadata || {}
    }
  }

  private async updateExportRecord(
    documentId: string, 
    userId: string, 
    result: {
      format?: string
      exportUrl?: string
      fileSize?: number
      dimensions?: {
        width: number
        height: number
      }
    }
  ) {
    const supabase = await createClient()

    // Update document with latest export info
    await supabase
      .from('documents')
      .update({
        last_exported_at: new Date().toISOString(),
        export_count: supabase.rpc('increment', { column: 'export_count' }),
        metadata: {
          lastExport: {
            format: result.format,
            url: result.exportUrl,
            fileSize: result.fileSize,
            dimensions: result.dimensions,
            exportedAt: new Date().toISOString()
          }
        }
      })
      .eq('id', documentId)
      .eq('user_id', userId)
  }

  private async sendWebhook(url: string, data: {
    event: string
    documentId: string
    format: string
    exportUrl?: string
    fileSize?: number
    dimensions?: {
      width: number
      height: number
    }
    error?: string
    timestamp: string
  }) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BeautifyAI-Event': data.event
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to send webhook:', error)
    }
  }
}