import { io, Socket } from 'socket.io-client'
import { createWebSocketHandlers } from '../store/middleware/websocket-middleware'
import { useDashboardStore } from '../store/dashboard-store'
import type { 
  ClientToServerEvents, 
  ServerToClientEvents 
} from './socket-events'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

class DashboardSocket {
  private socket: TypedSocket | null = null
  private handlers: ReturnType<typeof createWebSocketHandlers> | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private maxReconnectDelay = 30000 // 30 seconds
  private baseReconnectDelay = 1000 // 1 second

  constructor() {
    // Initialize socket on first use
  }

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket
    }

    const store = useDashboardStore.getState()
    store.setConnecting(true)

    // Create socket connection
    this.socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:5001', {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
      reconnectionAttempts: Infinity
    }) as TypedSocket

    // Create and attach handlers
    this.handlers = createWebSocketHandlers(useDashboardStore)
    this.attachHandlers()

    return this.socket
  }

  private attachHandlers() {
    if (!this.socket || !this.handlers) return

    // Connection events
    this.socket.on('connect', this.handlers.connect)
    this.socket.on('disconnect', this.handlers.disconnect)
    this.socket.on('connect_error', this.handlers.connect_error)

    // Document events
    this.socket.on('document:update', this.handlers['document:update'])
    this.socket.on('document:created', this.handlers['document:created'])
    this.socket.on('document:deleted', this.handlers['document:deleted'])

    // Enhancement events
    this.socket.on('enhancement:progress', this.handlers['enhancement:progress'])
    this.socket.on('enhancement:complete', this.handlers['enhancement:complete'])
    this.socket.on('enhancement:failed', this.handlers['enhancement:failed'])

    // User events
    this.socket.on('user:update', this.handlers['user:update'])
    this.socket.on('user:usage', this.handlers['user:usage'])

    // Optimistic update events
    this.socket.on('optimistic:confirm', this.handlers['optimistic:confirm'])
    this.socket.on('optimistic:reject', this.handlers['optimistic:reject'])

    // Custom reconnection handling
    this.socket.io.on('reconnect', (attempt) => {
      console.log(`Reconnected after ${attempt} attempts`)
      this.syncStateAfterReconnect()
    })
  }

  private syncStateAfterReconnect() {
    const store = useDashboardStore.getState()
    
    // Re-subscribe to all channels
    const subscriptions = Array.from(store.socketState.subscriptions)
    subscriptions.forEach(channel => {
      this.subscribe(channel)
    })

    // Request latest state for active documents
    store.documents.forEach(doc => {
      if (doc.status === 'processing') {
        this.socket?.emit('enhancement:subscribe', doc.id)
      }
    })

    // Subscribe to dashboard updates
    this.socket?.emit('dashboard:subscribe')
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.handlers = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  subscribe(channel: string) {
    const store = useDashboardStore.getState()
    
    if (this.socket?.connected) {
      // Subscribe based on channel type
      if (channel.startsWith('document:')) {
        const documentId = channel.split(':')[1]
        this.socket.emit('document:subscribe', documentId)
      } else if (channel.startsWith('enhancement:')) {
        const documentId = channel.split(':')[1]
        this.socket.emit('enhancement:subscribe', documentId)
      } else if (channel === 'dashboard') {
        this.socket.emit('dashboard:subscribe')
      }
    }

    store.addSubscription(channel)
  }

  unsubscribe(channel: string) {
    const store = useDashboardStore.getState()
    
    if (this.socket?.connected) {
      // Unsubscribe based on channel type
      if (channel.startsWith('document:')) {
        const documentId = channel.split(':')[1]
        this.socket.emit('document:unsubscribe', documentId)
      } else if (channel.startsWith('enhancement:')) {
        const documentId = channel.split(':')[1]
        this.socket.emit('enhancement:unsubscribe', documentId)
      } else if (channel === 'dashboard') {
        this.socket.emit('dashboard:unsubscribe')
      }
    }

    store.removeSubscription(channel)
  }

  // Enhancement operations
  startEnhancement(documentId: string, settings: any) {
    if (this.socket?.connected) {
      this.socket.emit('enhancement:start', { documentId, settings })
    }
  }

  cancelEnhancement(documentId: string) {
    if (this.socket?.connected) {
      this.socket.emit('enhancement:cancel', documentId)
    }
  }

  // User operations
  updatePreferences(preferences: any) {
    if (this.socket?.connected) {
      this.socket.emit('user:preferences', preferences)
    }
  }

  getSocket(): TypedSocket | null {
    return this.socket
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }
}

// Export singleton instance
export const dashboardSocket = new DashboardSocket()

// Export convenience functions
export const connectDashboardSocket = (token: string) => dashboardSocket.connect(token)
export const disconnectDashboardSocket = () => dashboardSocket.disconnect()
export const subscribeToDashboard = (channel: string) => dashboardSocket.subscribe(channel)
export const unsubscribeFromDashboard = (channel: string) => dashboardSocket.unsubscribe(channel)