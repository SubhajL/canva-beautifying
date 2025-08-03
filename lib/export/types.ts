export type ExportFormat = 'png' | 'jpg' | 'pdf' | 'canva'

export interface ExportOptions {
  format: ExportFormat
  quality?: number // 0-100 for JPG
  scale?: number // Scale factor for PNG/JPG
  preserveVectors?: boolean // For PDF
  includeMetadata?: boolean
  backgroundColor?: string
}

export interface BatchExportOptions extends ExportOptions {
  documentIds: string[]
  zipFileName?: string
}

export interface ExportRequest {
  documentId: string
  userId: string
  options: ExportOptions
  enhancedUrl: string
  originalUrl?: string
  metadata?: Record<string, unknown>
}

export interface ExportProgress {
  documentId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number // 0-100
  format: ExportFormat
  startedAt: Date
  completedAt?: Date
  error?: string
  exportUrl?: string
}

export interface ExportResult {
  success: boolean
  documentId: string
  format: ExportFormat
  exportUrl?: string
  fileSize?: number
  dimensions?: {
    width: number
    height: number
  }
  error?: string
  processingTime: number
}

export interface CanvaFormat {
  version: string
  type: 'GRAPHIC' | 'PRESENTATION' | 'DOCUMENT'
  pages: Array<{
    id: string
    elements: Array<{
      type: 'TEXT' | 'IMAGE' | 'SHAPE' | 'GROUP'
      position: { x: number; y: number }
      size: { width: number; height: number }
      properties: Record<string, unknown>
    }>
    background: {
      type: 'solid' | 'gradient' | 'image'
      value: string | Record<string, unknown>
    }
  }>
  assets: Array<{
    id: string
    type: 'image' | 'font'
    url: string
  }>
}

export interface ExportHistory {
  id: string
  userId: string
  documentId: string
  format: ExportFormat
  exportedAt: Date
  fileSize: number
  downloadCount: number
  expiresAt?: Date
  exportUrl: string
  metadata?: {
    quality?: number
    scale?: number
    dimensions?: { width: number; height: number }
  }
}

export interface ExportNotification {
  type: 'export_started' | 'export_completed' | 'export_failed' | 'batch_completed'
  userId: string
  documentId?: string
  batchId?: string
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}