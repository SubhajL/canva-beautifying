// WebSocket event types and payloads

export interface ServerToClientEvents {
  // Progress updates
  'enhancement:progress': (data: EnhancementProgress) => void
  'analysis:progress': (data: AnalysisProgress) => void
  'export:progress': (data: ExportProgress) => void
  
  // Status updates
  'job:started': (data: JobStarted) => void
  'job:completed': (data: JobCompleted) => void
  'job:failed': (data: JobFailed) => void
  
  // Queue updates
  'queue:position': (data: QueuePosition) => void
  
  // Batch processing
  'batch:update': (data: BatchUpdate) => void
  
  // System notifications
  'notification': (data: Notification) => void
  
  // Connection status
  'connection:ready': () => void
  'connection:error': (error: string) => void
}

export interface ClientToServerEvents {
  // Subscribe to updates
  'subscribe:document': (documentId: string) => void
  'unsubscribe:document': (documentId: string) => void
  
  // Subscribe to batch
  'subscribe:batch': (batchId: string) => void
  'unsubscribe:batch': (batchId: string) => void
  
  // Subscribe to user's all documents
  'subscribe:user': (userId: string) => void
  'unsubscribe:user': (userId: string) => void
  
  // Connection management
  'ping': () => void
}

export interface InterServerEvents {
  // For scaling across multiple servers
  'broadcast:progress': (room: string, data: any) => void
}

export interface SocketData {
  userId: string
  subscriptionTier: string
  sessionId: string
}

// Progress event payloads
export interface EnhancementProgress {
  documentId: string
  stage: 'analysis' | 'planning' | 'generation' | 'composition'
  progress: number // 0-100
  message: string
  details?: {
    currentStep?: string
    totalSteps?: number
    estimatedTimeRemaining?: number
  }
}

export interface AnalysisProgress {
  documentId: string
  progress: number
  stage: string
  findings?: {
    colorIssues?: number
    layoutIssues?: number
    typographyIssues?: number
  }
}

export interface ExportProgress {
  documentId: string
  exportId: string
  progress: number
  format: string
  stage: 'preparing' | 'converting' | 'uploading' | 'complete'
}

// Job status payloads
export interface JobStarted {
  jobId: string
  documentId: string
  type: 'analysis' | 'enhancement' | 'export'
  timestamp: Date
}

export interface JobCompleted {
  jobId: string
  documentId: string
  type: 'analysis' | 'enhancement' | 'export'
  result: {
    success: boolean
    enhancedUrl?: string
    thumbnailUrl?: string
    improvements?: {
      before: number
      after: number
    }
  }
  processingTime: number
  timestamp: Date
}

export interface JobFailed {
  jobId: string
  documentId: string
  type: 'analysis' | 'enhancement' | 'export'
  error: {
    message: string
    code?: string
    retryable: boolean
  }
  timestamp: Date
}

// Queue status
export interface QueuePosition {
  documentId: string
  position: number
  estimatedWaitTime: number // seconds
  queueLength: number
}

// Batch processing
export interface BatchUpdate {
  batchId: string
  totalDocuments: number
  completed: number
  failed: number
  inProgress: number
  documents: Array<{
    documentId: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    progress?: number
  }>
}

// Notifications
export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  documentId?: string
  actionUrl?: string
  timestamp: Date
}