import { io, Socket } from 'socket.io-client'
import { createClient } from '@/lib/supabase/client'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
} from './types'

export type WebSocketClient = Socket<ServerToClientEvents, ClientToServerEvents>

class SocketManager {
  private socket: WebSocketClient | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map()
  private subscribedDocuments: Set<string> = new Set()
  private subscribedBatches: Set<string> = new Set()

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return
    }

    // Get auth token
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      throw new Error('No authentication session')
    }

    // Create socket connection
    this.socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:5001', {
      auth: {
        token: session.access_token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    if (!this.socket) return

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      
      // Re-subscribe to documents and batches
      this.subscribedDocuments.forEach(docId => {
        this.socket?.emit('subscribe:document', docId)
      })
      this.subscribedBatches.forEach(batchId => {
        this.socket?.emit('subscribe:batch', batchId)
      })
      
      this.emit('connected', null)
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      this.emit('disconnected', reason)
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.reconnectAttempts++
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('connection_failed', error.message)
      }
    })

    // Ready signal
    this.socket.on('connection:ready', () => {
      this.emit('ready', null)
    })

    this.socket.on('connection:error', (error) => {
      this.emit('error', error)
    })

    // Progress events
    this.socket.on('enhancement:progress', (data) => {
      this.emit(`enhancement:progress:${data.documentId}`, data)
      this.emit('enhancement:progress', data)
    })

    this.socket.on('analysis:progress', (data) => {
      this.emit(`analysis:progress:${data.documentId}`, data)
      this.emit('analysis:progress', data)
    })

    this.socket.on('export:progress', (data) => {
      this.emit(`export:progress:${data.documentId}`, data)
      this.emit('export:progress', data)
    })

    // Job events
    this.socket.on('job:started', (data) => {
      this.emit(`job:started:${data.documentId}`, data)
      this.emit('job:started', data)
    })

    this.socket.on('job:completed', (data) => {
      this.emit(`job:completed:${data.documentId}`, data)
      this.emit('job:completed', data)
    })

    this.socket.on('job:failed', (data) => {
      this.emit(`job:failed:${data.documentId}`, data)
      this.emit('job:failed', data)
    })

    // Queue events
    this.socket.on('queue:position', (data) => {
      this.emit(`queue:position:${data.documentId}`, data)
      this.emit('queue:position', data)
    })

    // Batch events
    this.socket.on('batch:update', (data) => {
      this.emit(`batch:update:${data.batchId}`, data)
      this.emit('batch:update', data)
    })

    // Notifications
    this.socket.on('notification', (data) => {
      this.emit('notification', data)
      if (data.documentId) {
        this.emit(`notification:${data.documentId}`, data)
      }
    })
  }

  // Subscribe to document updates
  subscribeToDocument(documentId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected')
      return
    }

    this.socket.emit('subscribe:document', documentId)
    this.subscribedDocuments.add(documentId)
  }

  unsubscribeFromDocument(documentId: string) {
    if (!this.socket?.connected) return

    this.socket.emit('unsubscribe:document', documentId)
    this.subscribedDocuments.delete(documentId)
  }

  // Subscribe to batch updates
  subscribeToBatch(batchId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected')
      return
    }

    this.socket.emit('subscribe:batch', batchId)
    this.subscribedBatches.add(batchId)
  }

  unsubscribeFromBatch(batchId: string) {
    if (!this.socket?.connected) return

    this.socket.emit('unsubscribe:batch', batchId)
    this.subscribedBatches.delete(batchId)
  }

  // Subscribe to user updates
  subscribeToUser(userId: string) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected')
      return
    }

    this.socket.emit('subscribe:user', userId)
  }

  unsubscribeFromUser(userId: string) {
    if (!this.socket?.connected) return

    this.socket.emit('unsubscribe:user', userId)
  }

  // Event emitter methods
  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }

  // Send ping
  ping() {
    this.socket?.emit('ping')
  }

  // Disconnect
  disconnect() {
    this.subscribedDocuments.clear()
    this.subscribedBatches.clear()
    this.socket?.disconnect()
    this.socket = null
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Get socket instance (for advanced usage)
  getSocket(): WebSocketClient | null {
    return this.socket
  }
}

// Singleton instance
let socketManager: SocketManager | null = null

export function getSocketManager(): SocketManager {
  if (!socketManager) {
    socketManager = new SocketManager()
  }
  return socketManager
}

// React hook for using WebSocket
export function useWebSocket() {
  const manager = getSocketManager()
  
  return {
    connect: () => manager.connect(),
    disconnect: () => manager.disconnect(),
    isConnected: () => manager.isConnected(),
    subscribeToDocument: (docId: string) => manager.subscribeToDocument(docId),
    unsubscribeFromDocument: (docId: string) => manager.unsubscribeFromDocument(docId),
    subscribeToBatch: (batchId: string) => manager.subscribeToBatch(batchId),
    unsubscribeFromBatch: (batchId: string) => manager.unsubscribeFromBatch(batchId),
    on: (event: string, callback: (...args: unknown[]) => void) => manager.on(event, callback),
    off: (event: string, callback: (...args: unknown[]) => void) => manager.off(event, callback),
    ping: () => manager.ping(),
  }
}