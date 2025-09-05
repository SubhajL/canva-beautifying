import { Server as HTTPServer } from 'http'
import { Server } from 'socket.io'
import { createClient } from '@/lib/supabase/server'
import { sessionStore } from '@/lib/redis/session-store'
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  EnhancementProgress,
  JobCompleted,
  JobFailed,
  Notification
} from './types'

export class WebSocketServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null
  
  constructor() {
    // Don't initialize here, do it in initialize()
  }

  initialize(httpServer: HTTPServer) {
    const options: any = {
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    }
    
    // Fix for test environment
    if (process.env.NODE_ENV === 'test') {
      options.transports = ['polling']
      // Disable WebSocket engine in tests to avoid constructor error
      delete options.wsEngine
    }
    
    this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, options)
    
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token
        if (!token) {
          return next(new Error('Authentication required'))
        }

        // Verify the token with Supabase
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser(token)
        
        if (error || !user) {
          return next(new Error('Invalid authentication'))
        }

        // Get user details
        const { data: userData } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('id', user.id)
          .single()

        // Store user data in socket
        socket.data = {
          userId: user.id,
          subscriptionTier: userData?.subscription_tier || 'free',
          sessionId: socket.id,
        }

        next()
      } catch (_error) {
        next(new Error('Authentication failed'))
      }
    })

    // Connection handler
    this.io.on('connection', async (socket) => {
      const { userId, subscriptionTier, sessionId } = socket.data
      console.log(`User ${userId} connected with session ${sessionId}`)
      
      // Track session in Redis
      try {
        await sessionStore.addSession(userId, sessionId, {
          userAgent: socket.handshake.headers['user-agent'],
          ipAddress: socket.handshake.address,
          metadata: {
            subscriptionTier,
            transport: socket.conn.transport.name,
            protocol: socket.conn.protocol,
          }
        })
      } catch (error) {
        console.error('Failed to track session:', error)
      }
      
      // Send ready signal
      socket.emit('connection:ready')

      // Handle subscriptions
      socket.on('subscribe:document', async (documentId) => {
        // Verify user has access to this document
        const hasAccess = await this.verifyDocumentAccess(userId, documentId)
        if (hasAccess) {
          socket.join(`document:${documentId}`)
          console.log(`User ${userId} subscribed to document ${documentId}`)
        }
      })

      socket.on('unsubscribe:document', (documentId) => {
        socket.leave(`document:${documentId}`)
      })

      socket.on('subscribe:batch', async (batchId) => {
        // Verify user has access to this batch
        const hasAccess = await this.verifyBatchAccess(userId, batchId)
        if (hasAccess) {
          socket.join(`batch:${batchId}`)
        }
      })

      socket.on('unsubscribe:batch', (batchId) => {
        socket.leave(`batch:${batchId}`)
      })

      socket.on('subscribe:user', (userId) => {
        // Users can only subscribe to their own updates
        if (userId === socket.data.userId) {
          socket.join(`user:${userId}`)
        }
      })

      socket.on('unsubscribe:user', (userId) => {
        if (userId === socket.data.userId) {
          socket.leave(`user:${userId}`)
        }
      })

      // Handle ping for connection keep-alive
      socket.on('ping', async () => {
        // Update session activity
        try {
          await sessionStore.touchSession(sessionId)
        } catch (error) {
          console.error('Failed to update session activity:', error)
        }
        
        socket.emit('notification', {
          id: `ping-${Date.now()}`,
          type: 'info',
          title: 'Connection Active',
          message: 'Your connection is active',
          timestamp: new Date(),
        })
      })

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        console.log(`User ${userId} disconnected: ${reason}`)
        
        // Remove session from Redis
        try {
          await sessionStore.removeSession(userId, sessionId)
        } catch (error) {
          console.error('Failed to remove session:', error)
        }
      })

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${userId}:`, error)
        socket.emit('connection:error', error.message)
      })
    })
  }

  // Public methods for emitting events from other parts of the application

  sendEnhancementProgress(documentId: string, progress: EnhancementProgress) {
    if (!this.io) return
    this.io.to(`document:${documentId}`).emit('enhancement:progress', progress)
  }

  sendJobCompleted(documentId: string, data: JobCompleted) {
    if (!this.io) return
    this.io.to(`document:${documentId}`).emit('job:completed', data)
    
    // Also notify the user
    this.sendNotificationToDocument(documentId, {
      id: `complete-${Date.now()}`,
      type: 'success',
      title: 'Enhancement Complete!',
      message: 'Your document has been enhanced successfully.',
      documentId,
      actionUrl: `/app/documents/${documentId}`,
      timestamp: new Date(),
    })
  }

  sendJobFailed(documentId: string, data: JobFailed) {
    if (!this.io) return
    this.io.to(`document:${documentId}`).emit('job:failed', data)
    
    // Also notify the user
    this.sendNotificationToDocument(documentId, {
      id: `error-${Date.now()}`,
      type: 'error',
      title: 'Enhancement Failed',
      message: data.error.message,
      documentId,
      timestamp: new Date(),
    })
  }

  sendQueuePosition(documentId: string, position: number, queueLength: number) {
    if (!this.io) return
    const estimatedWaitTime = position * 30 // 30 seconds per document estimate
    
    this.io.to(`document:${documentId}`).emit('queue:position', {
      documentId,
      position,
      estimatedWaitTime,
      queueLength,
    })
  }

  sendBatchUpdate(batchId: string, update: any) {
    if (!this.io) return
    this.io.to(`batch:${batchId}`).emit('batch:update', update)
  }

  sendNotificationToUser(userId: string, notification: Notification) {
    if (!this.io) return
    this.io.to(`user:${userId}`).emit('notification', notification)
  }

  sendNotificationToDocument(documentId: string, notification: Notification) {
    if (!this.io) return
    this.io.to(`document:${documentId}`).emit('notification', notification)
  }

  // Helper methods

  private async verifyDocumentAccess(userId: string, documentId: string): Promise<boolean> {
    const supabase = await createClient()
    const { data } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', documentId)
      .single()
    
    return data?.user_id === userId
  }

  private async verifyBatchAccess(_userId: string, _batchId: string): Promise<boolean> {
    // Implement batch access verification
    // For now, assume users can only access their own batches
    return true
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    if (!this.io) return 0
    return this.io.engine.clientsCount
  }

  // Get rooms info for monitoring
  getRoomsInfo() {
    if (!this.io) return {}
    const rooms = this.io.sockets.adapter.rooms
    const info: Record<string, number> = {}
    
    rooms.forEach((sockets, room) => {
      if (!room.startsWith('socket:')) {
        info[room] = sockets.size
      }
    })
    
    return info
  }

  // Session management methods
  
  async getActiveSessions(userId: string) {
    return await sessionStore.getActiveSessions(userId)
  }
  
  async getAllSessionCounts() {
    return await sessionStore.getSessionCounts()
  }
  
  async broadcastToUserSessions(userId: string, event: string, data: any) {
    if (!this.io) return
    
    // Get all active sessions for the user
    const sessions = await sessionStore.getActiveSessions(userId)
    
    // Broadcast to all user's sessions across all servers
    for (const session of sessions) {
      // If session is on this server, emit directly
      const socket = this.io.sockets.sockets.get(session.sessionId)
      if (socket) {
        socket.emit(event as any, data)
      } else if (session.serverId !== process.env.SERVER_ID) {
        // Session is on another server, use inter-server events
        this.io.serverSideEmit('broadcast:progress', `user:${userId}`, { event, data })
      }
    }
  }
  
  // Graceful shutdown
  async close() {
    // Stop session cleanup
    sessionStore.stopCleanup()
    
    if (this.io) {
      await this.io.close()
    }
  }
}

// Singleton instance
let wsServer: WebSocketServer | null = null

export function getWebSocketServer(): WebSocketServer {
  if (!wsServer) {
    wsServer = new WebSocketServer()
  }
  return wsServer
}

// Helper function to emit events from queue processors
export function emitProgressUpdate(documentId: string, progress: EnhancementProgress) {
  const server = getWebSocketServer()
  server.sendEnhancementProgress(documentId, progress)
}