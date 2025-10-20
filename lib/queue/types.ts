// Job data types for each queue

/**
 * W3C Trace Context for distributed tracing across queue boundaries.
 * Allows trace propagation from API requests through async job processing.
 */
export interface TraceContext {
  /** W3C traceparent header (version-traceId-spanId-flags) */
  traceparent: string
  /** Optional W3C tracestate header for vendor-specific data */
  tracestate?: string
}

export interface DocumentAnalysisJobData {
  documentId: string
  userId: string
  fileUrl: string
  fileName: string
  fileType: string
  subscriptionTier: "free" | "basic" | "pro" | "premium"
  priority?: number
  traceContext?: TraceContext
}

export interface EnhancementJobData {
  documentId: string
  userId: string
  analysisResults: {
    colors: Record<string, unknown>
    typography: Record<string, unknown>
    layout: Record<string, unknown>
    content: Record<string, unknown>
    quality: Record<string, unknown>
  }
  enhancementSettings: {
    targetStyle?: string
    colorPreferences?: string[]
    layoutPreferences?: string
    aiModel?: string
  }
  subscriptionTier: "free" | "basic" | "pro" | "premium"
  priority?: number
  traceContext?: TraceContext
}

export interface ExportJobData {
  documentId: string
  userId: string
  enhancementId: string
  exportFormat: "png" | "pdf" | "canva" | "pptx"
  exportSettings?: {
    quality?: "standard" | "high" | "print"
    includeReport?: boolean
    watermark?: boolean
  }
  subscriptionTier: "free" | "basic" | "pro" | "premium"
  priority?: number
  traceContext?: TraceContext
}

export interface EmailJobData {
  to: string
  subject: string
  template:
    | "enhancement-complete"
    | "export-ready"
    | "error-notification"
    | "welcome"
  data: Record<string, unknown>
  priority?: number
}

// Job result types
export interface JobResult<T = unknown> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
    details?: unknown
  }
  metadata?: {
    processingTime: number
    aiTokensUsed?: number
    storageUsed?: number
  }
}

// Progress update type
export interface JobProgress {
  stage: string
  progress: number // 0-100
  message?: string
  details?: Record<string, unknown>
}

// Queue metrics type
export interface QueueMetrics {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: number
  completedRate: number // jobs per minute
  failureRate: number // percentage
  avgProcessingTime: number // milliseconds
}
