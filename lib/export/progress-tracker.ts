import { ExportProgress, ExportFormat } from './types'
import { EventEmitter } from 'events'

export class ExportProgressTracker extends EventEmitter {
  private progressMap: Map<string, ExportProgress> = new Map()
  private documentProgressMap: Map<string, string> = new Map() // documentId -> progressId

  startExport(documentId: string, format: ExportFormat): string {
    const progressId = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const progress: ExportProgress = {
      documentId,
      status: 'processing',
      progress: 0,
      format,
      startedAt: new Date()
    }
    
    this.progressMap.set(progressId, progress)
    this.documentProgressMap.set(documentId, progressId)
    
    // Emit event
    this.emit('export:started', { documentId, progressId, format })
    
    return progressId
  }

  updateProgress(progressId: string, percentage: number): void {
    const progress = this.progressMap.get(progressId)
    if (!progress || progress.status !== 'processing') return
    
    progress.progress = Math.min(100, Math.max(0, percentage))
    
    // Emit event
    this.emit('export:progress', { 
      documentId: progress.documentId, 
      progressId, 
      percentage: progress.progress 
    })
  }

  completeExport(progressId: string, exportUrl?: string): void {
    const progress = this.progressMap.get(progressId)
    if (!progress) return
    
    progress.status = 'completed'
    progress.progress = 100
    progress.completedAt = new Date()
    progress.exportUrl = exportUrl
    
    // Emit event
    this.emit('export:completed', { 
      documentId: progress.documentId, 
      progressId, 
      exportUrl,
      duration: progress.completedAt.getTime() - progress.startedAt.getTime()
    })
    
    // Clean up after 5 minutes
    setTimeout(() => {
      this.progressMap.delete(progressId)
      this.documentProgressMap.delete(progress.documentId)
    }, 5 * 60 * 1000)
  }

  failExport(progressId: string, error?: string): void {
    const progress = this.progressMap.get(progressId)
    if (!progress) return
    
    progress.status = 'failed'
    progress.error = error
    progress.completedAt = new Date()
    
    // Emit event
    this.emit('export:failed', { 
      documentId: progress.documentId, 
      progressId, 
      error 
    })
    
    // Clean up after 5 minutes
    setTimeout(() => {
      this.progressMap.delete(progressId)
      this.documentProgressMap.delete(progress.documentId)
    }, 5 * 60 * 1000)
  }

  getProgress(documentId: string): ExportProgress | undefined {
    const progressId = this.documentProgressMap.get(documentId)
    if (!progressId) return undefined
    
    return this.progressMap.get(progressId)
  }

  getProgressById(progressId: string): ExportProgress | undefined {
    return this.progressMap.get(progressId)
  }

  getAllProgress(): ExportProgress[] {
    return Array.from(this.progressMap.values())
  }

  getActiveExports(): ExportProgress[] {
    return Array.from(this.progressMap.values()).filter(
      p => p.status === 'processing'
    )
  }

  cancelExport(documentId: string): boolean {
    const progressId = this.documentProgressMap.get(documentId)
    if (!progressId) return false
    
    const progress = this.progressMap.get(progressId)
    if (!progress || progress.status !== 'processing') return false
    
    progress.status = 'failed'
    progress.error = 'Export cancelled by user'
    progress.completedAt = new Date()
    
    // Emit event
    this.emit('export:cancelled', { 
      documentId: progress.documentId, 
      progressId 
    })
    
    return true
  }

  // Simulate progress updates for long-running exports
  simulateProgress(progressId: string, duration: number = 30000): void {
    const steps = 20
    const interval = duration / steps
    let currentStep = 0
    
    const timer = setInterval(() => {
      currentStep++
      const percentage = (currentStep / steps) * 90 // Leave 10% for finalization
      
      this.updateProgress(progressId, percentage)
      
      if (currentStep >= steps) {
        clearInterval(timer)
      }
    }, interval)
  }
}