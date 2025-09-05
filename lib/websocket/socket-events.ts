/**
 * WebSocket event type definitions for the dashboard
 */

// Client to Server events
export interface ClientToServerEvents {
  // Document events
  'document:subscribe': (documentId: string) => void
  'document:unsubscribe': (documentId: string) => void
  'document:created': (data: { documentId: string; document: any }) => void
  'document:updated': (data: { documentId: string; updates: any }) => void
  'document:deleted': (data: { documentId: string }) => void
  
  // Enhancement events
  'enhancement:subscribe': (documentId: string) => void
  'enhancement:unsubscribe': (documentId: string) => void
  'enhancement:start': (data: { documentId: string; settings: any }) => void
  'enhancement:cancel': (documentId: string) => void
  
  // User events
  'user:preferences': (preferences: any) => void
  
  // Dashboard events
  'dashboard:subscribe': () => void
  'dashboard:unsubscribe': () => void
}

// Server to Client events
export interface ServerToClientEvents {
  // Connection events
  'connect': () => void
  'disconnect': () => void
  'connect_error': (error: Error) => void
  'reconnect': (attemptNumber: number) => void
  
  // Document events
  'document:update': (data: {
    documentId: string
    updates: {
      title?: string
      description?: string
      status?: 'uploaded' | 'processing' | 'enhanced' | 'failed'
      enhancementId?: string
      updatedAt: string
    }
  }) => void
  
  'document:created': (data: {
    document: {
      id: string
      title: string
      description?: string
      fileUrl: string
      thumbnailUrl?: string
      mimeType: string
      size: number
      status: 'uploaded' | 'processing' | 'enhanced' | 'failed'
      createdAt: string
      updatedAt: string
      userId: string
    }
  }) => void
  
  'document:deleted': (data: {
    documentId: string
  }) => void
  
  // Enhancement events
  'enhancement:progress': (data: {
    documentId: string
    progress: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    message?: string
  }) => void
  
  'enhancement:complete': (data: {
    documentId: string
    result: {
      enhancedFileUrl: string
      improvements: string[]
      metadata: Record<string, unknown>
    }
  }) => void
  
  'enhancement:failed': (data: {
    documentId: string
    error: string
  }) => void
  
  'enhancement:started': (data: {
    documentId: string
    enhancementId: string
    model: string
  }) => void
  
  // User events
  'user:update': (data: {
    email?: string
    name?: string
    avatarUrl?: string
    subscription?: {
      tier: 'free' | 'basic' | 'pro' | 'premium'
      status: 'active' | 'cancelled' | 'past_due'
      currentPeriodEnd?: string
    }
  }) => void
  
  'user:usage': (data: {
    documentsProcessed?: number
    documentsLimit?: number
    storageUsed?: number
    storageLimit?: number
  }) => void
  
  // Optimistic update events
  'optimistic:confirm': (data: {
    updateId: string
  }) => void
  
  'optimistic:reject': (data: {
    updateId: string
    reason?: string
  }) => void
  
  // Error events
  'error': (data: {
    code: string
    message: string
    details?: any
  }) => void
}

// Inter-server events (for scaling)
export interface InterServerEvents {
  ping: () => void
}

// Socket data (attached to socket instance)
export interface SocketData {
  userId: string
  email: string
  subscriptions: Set<string>
}