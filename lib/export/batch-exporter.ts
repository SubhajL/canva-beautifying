import archiver from 'archiver'
import { BatchExportOptions, ExportProgress } from './types'
import { uploadFile } from '@/lib/r2'

export class BatchExporter {
  private exportService: any // Will be injected to avoid circular dependency
  private progressTrackers: Map<string, ExportProgress> = new Map()

  constructor(exportService?: any) {
    this.exportService = exportService
  }

  setExportService(exportService: any) {
    this.exportService = exportService
  }

  async exportBatch(
    userId: string,
    options: BatchExportOptions,
    onProgress?: (documentId: string, progress: ExportProgress) => void
  ): Promise<string> {
    const batchId = `batch-${Date.now()}`
    const results: Array<{ documentId: string; url?: string; error?: string }> = []

    // Initialize progress for all documents
    for (const documentId of options.documentIds) {
      const progress: ExportProgress = {
        documentId,
        status: 'pending',
        progress: 0,
        format: options.format,
        startedAt: new Date()
      }
      this.progressTrackers.set(documentId, progress)
      onProgress?.(documentId, progress)
    }

    // Process documents in parallel (with concurrency limit)
    const concurrencyLimit = 3
    const chunks = this.chunkArray(options.documentIds, concurrencyLimit)

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (documentId) => {
          try {
            // Update progress to processing
            this.updateProgress(documentId, 'processing', 10, onProgress)

            // Get document details (mock for now)
            const enhancedUrl = await this.getEnhancedUrl(documentId, userId)
            
            // Update progress
            this.updateProgress(documentId, 'processing', 50, onProgress)

            // Export the document
            const result = await this.exportService.exportDocument({
              documentId,
              userId,
              options: {
                format: options.format,
                quality: options.quality,
                scale: options.scale,
                preserveVectors: options.preserveVectors,
                includeMetadata: options.includeMetadata,
                backgroundColor: options.backgroundColor
              },
              enhancedUrl
            })

            if (result.success) {
              this.updateProgress(documentId, 'completed', 100, onProgress, result.exportUrl)
              return { documentId, url: result.exportUrl }
            } else {
              this.updateProgress(documentId, 'failed', 100, onProgress, undefined, result.error)
              return { documentId, error: result.error }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Export failed'
            this.updateProgress(documentId, 'failed', 100, onProgress, undefined, errorMessage)
            return { documentId, error: errorMessage }
          }
        })
      )

      results.push(...chunkResults)
    }

    // Create ZIP archive if multiple files
    if (options.documentIds.length > 1) {
      return this.createZipArchive(userId, results, options.zipFileName || `batch-${batchId}.zip`)
    } else if (results[0]?.url) {
      return results[0].url
    } else {
      throw new Error(results[0]?.error || 'Export failed')
    }
  }

  private async createZipArchive(
    userId: string,
    results: Array<{ documentId: string; url?: string; error?: string }>,
    zipFileName: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 }
      })

      const chunks: Buffer[] = []
      
      archive.on('data', (chunk) => {
        chunks.push(chunk)
      })

      archive.on('end', async () => {
        const buffer = Buffer.concat(chunks)
        
        // Upload ZIP to R2
        const zipUrl = await uploadFile(
          buffer,
          `exports/${userId}/${zipFileName}`,
          'application/zip'
        )
        
        resolve(zipUrl)
      })

      archive.on('error', reject)

      // Add successfully exported files to archive
      results.forEach((result) => {
        if (result.url) {
          // In production, download the file and add to archive
          // For now, add a placeholder
          archive.append(`Document ${result.documentId} exported successfully`, {
            name: `${result.documentId}.txt`
          })
        }
      })

      archive.finalize()
    })
  }

  private updateProgress(
    documentId: string,
    status: ExportProgress['status'],
    progress: number,
    onProgress?: (documentId: string, progress: ExportProgress) => void,
    exportUrl?: string,
    error?: string
  ): void {
    const tracker = this.progressTrackers.get(documentId)
    if (!tracker) return

    tracker.status = status
    tracker.progress = progress
    
    if (status === 'completed') {
      tracker.completedAt = new Date()
      tracker.exportUrl = exportUrl
    }
    
    if (error) {
      tracker.error = error
    }

    onProgress?.(documentId, tracker)
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private async getEnhancedUrl(documentId: string, userId: string): Promise<string> {
    // In production, fetch from database
    // For now, return a mock URL
    return `https://r2.example.com/enhanced/${userId}/${documentId}.png`
  }

  getProgress(documentId: string): ExportProgress | undefined {
    return this.progressTrackers.get(documentId)
  }

  getAllProgress(): Map<string, ExportProgress> {
    return new Map(this.progressTrackers)
  }
}