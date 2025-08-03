import { createServer, Server as HTTPServer } from 'http'
import { Server, Socket as ServerSocket } from 'socket.io'
import { io as ioc, Socket as ClientSocket } from 'socket.io-client'
import { WebSocketServer, getWebSocketServer, emitProgressUpdate } from '../server'
import { createClient } from '@/lib/supabase/server'
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
  EnhancementProgress,
  JobCompleted,
  JobFailed,
  Notification
} from '../types'

// Mock Supabase
jest.mock('@/lib/supabase/server')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Mock ws engine for Socket.io
jest.mock('engine.io', () => {
  const originalModule = jest.requireActual('engine.io')
  return {
    ...originalModule,
    Server: class MockEngineServer extends originalModule.Server {
      constructor(opts: any = {}) {
        // Provide a default wsEngine if not specified
        super({
          ...opts,
          wsEngine: opts.wsEngine || require('ws').Server
        })
      }
    }
  }
})

describe('WebSocketServer', () => {
  let httpServer: HTTPServer
  let wsServer: WebSocketServer
  let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>
  let serverSocket: ServerSocket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>
  let mockSupabase: any
  let mockAuth: any
  let mockFrom: any
  
  const TEST_PORT = 3333
  const TEST_USER_ID = 'user-123'
  const TEST_TOKEN = 'valid-token'

  beforeAll((done) => {
    httpServer = createServer()
    httpServer.listen(TEST_PORT, done)
  })

  afterAll((done) => {
    httpServer.close(done)
  })

  beforeEach((done) => {
    // Reset singleton instance
    const serverModule = require('../server')
    if (serverModule.wsServer) {
      serverModule.wsServer = null
    }
    
    // Setup Supabase mocks
    mockAuth = {
      getUser: jest.fn()
    }
    
    mockFrom = jest.fn((table: string) => {
      if (table === 'users') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { subscription_tier: 'pro' },
                error: null
              }))
            }))
          }))
        }
      } else if (table === 'documents') {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { user_id: TEST_USER_ID },
                error: null
              }))
            }))
          }))
        }
      }
      return {}
    })
    
    mockSupabase = {
      auth: mockAuth,
      from: mockFrom
    }
    
    mockCreateClient.mockReturnValue(mockSupabase as any)
    
    // Create WebSocket server
    wsServer = new WebSocketServer()
    wsServer.initialize(httpServer)
    
    // Wait for server to be ready
    setTimeout(done, 100)
  })

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect()
    }
    
    // Clean up server
    if (wsServer) {
      await wsServer.close()
    }
    
    // Clear any lingering state
    jest.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          // No token
        }
      })

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication required')
        done()
      })
    })

    it('should reject connection with invalid token', (done) => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token')
      })

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          token: 'invalid-token'
        }
      })

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toBe('Invalid authentication')
        done()
      })
    })

    it('should accept connection with valid token', (done) => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          token: TEST_TOKEN
        }
      })

      clientSocket.on('connection:ready', () => {
        expect(clientSocket.connected).toBe(true)
        done()
      })
    })
  })

  describe('Document Subscriptions', () => {
    beforeEach((done) => {
      // Setup authenticated connection
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          token: TEST_TOKEN
        }
      })

      clientSocket.on('connection:ready', done)
    })

    it('should allow user to subscribe to their own document', (done) => {
      const documentId = 'doc-123'
      
      // User owns the document
      mockFrom.mockImplementation((table: string) => {
        if (table === 'documents') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { user_id: TEST_USER_ID },
                  error: null
                }))
              }))
            }))
          }
        }
        return {}
      })

      clientSocket.emit('subscribe:document', documentId)
      
      // Test that user receives updates for this document
      const testProgress: EnhancementProgress = {
        documentId,
        stage: 'analysis',
        progress: 50,
        message: 'Analyzing document...'
      }

      setTimeout(() => {
        clientSocket.on('enhancement:progress', (progress) => {
          expect(progress).toEqual(testProgress)
          done()
        })

        wsServer.sendEnhancementProgress(documentId, testProgress)
      }, 100)
    })

    it('should not allow user to subscribe to document they do not own', (done) => {
      const documentId = 'doc-456'
      
      // User does not own the document
      mockFrom.mockImplementation((table: string) => {
        if (table === 'documents') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({
                  data: { user_id: 'other-user' },
                  error: null
                }))
              }))
            }))
          }
        }
        return {}
      })

      clientSocket.emit('subscribe:document', documentId)
      
      // Test that user does NOT receive updates for this document
      const testProgress: EnhancementProgress = {
        documentId,
        stage: 'analysis',
        progress: 50,
        message: 'Analyzing document...'
      }

      let receivedProgress = false
      clientSocket.on('enhancement:progress', () => {
        receivedProgress = true
      })

      setTimeout(() => {
        wsServer.sendEnhancementProgress(documentId, testProgress)
        
        setTimeout(() => {
          expect(receivedProgress).toBe(false)
          done()
        }, 100)
      }, 100)
    })

    it('should handle unsubscribe from document', (done) => {
      const documentId = 'doc-123'
      
      clientSocket.emit('subscribe:document', documentId)
      
      setTimeout(() => {
        clientSocket.emit('unsubscribe:document', documentId)
        
        // Test that user no longer receives updates
        let receivedProgress = false
        clientSocket.on('enhancement:progress', () => {
          receivedProgress = true
        })

        const testProgress: EnhancementProgress = {
          documentId,
          stage: 'analysis',
          progress: 50,
          message: 'Analyzing document...'
        }

        wsServer.sendEnhancementProgress(documentId, testProgress)
        
        setTimeout(() => {
          expect(receivedProgress).toBe(false)
          done()
        }, 100)
      }, 100)
    })
  })

  describe('User Subscriptions', () => {
    beforeEach((done) => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          token: TEST_TOKEN
        }
      })

      clientSocket.on('connection:ready', done)
    })

    it('should allow user to subscribe to their own updates', (done) => {
      clientSocket.emit('subscribe:user', TEST_USER_ID)
      
      const notification: Notification = {
        id: 'notif-123',
        type: 'success',
        title: 'Test Notification',
        message: 'This is a test',
        timestamp: new Date()
      }

      clientSocket.on('notification', (received) => {
        expect(received).toEqual(notification)
        done()
      })

      setTimeout(() => {
        wsServer.sendNotificationToUser(TEST_USER_ID, notification)
      }, 100)
    })

    it('should not allow user to subscribe to other users', (done) => {
      const otherUserId = 'other-user-123'
      clientSocket.emit('subscribe:user', otherUserId)
      
      const notification: Notification = {
        id: 'notif-123',
        type: 'success',
        title: 'Test Notification',
        message: 'This is a test',
        timestamp: new Date()
      }

      let receivedNotification = false
      clientSocket.on('notification', () => {
        receivedNotification = true
      })

      setTimeout(() => {
        wsServer.sendNotificationToUser(otherUserId, notification)
        
        setTimeout(() => {
          expect(receivedNotification).toBe(false)
          done()
        }, 100)
      }, 100)
    })
  })

  describe('Progress Updates', () => {
    beforeEach((done) => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          token: TEST_TOKEN
        }
      })

      clientSocket.on('connection:ready', done)
    })

    it('should send enhancement progress updates', (done) => {
      const documentId = 'doc-123'
      clientSocket.emit('subscribe:document', documentId)
      
      const progress: EnhancementProgress = {
        documentId,
        stage: 'generation',
        progress: 75,
        message: 'Generating enhancements...',
        details: {
          currentStep: 'colors',
          totalSteps: 4,
          estimatedTimeRemaining: 30
        }
      }

      clientSocket.on('enhancement:progress', (received) => {
        expect(received).toEqual(progress)
        done()
      })

      setTimeout(() => {
        wsServer.sendEnhancementProgress(documentId, progress)
      }, 100)
    })

    it('should send job completed updates with notification', (done) => {
      const documentId = 'doc-123'
      clientSocket.emit('subscribe:document', documentId)
      
      const jobData: JobCompleted = {
        jobId: 'job-123',
        documentId,
        type: 'enhancement',
        result: {
          success: true,
          enhancedUrl: 'https://example.com/enhanced.pdf',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          improvements: {
            before: 65,
            after: 92
          }
        },
        processingTime: 45000,
        timestamp: new Date()
      }

      let receivedJob = false
      let receivedNotification = false

      clientSocket.on('job:completed', (received) => {
        expect(received).toEqual(jobData)
        receivedJob = true
        checkDone()
      })

      clientSocket.on('notification', (notification) => {
        expect(notification.type).toBe('success')
        expect(notification.title).toBe('Enhancement Complete!')
        expect(notification.documentId).toBe(documentId)
        receivedNotification = true
        checkDone()
      })

      const checkDone = () => {
        if (receivedJob && receivedNotification) {
          done()
        }
      }

      setTimeout(() => {
        wsServer.sendJobCompleted(documentId, jobData)
      }, 100)
    })

    it('should send job failed updates with notification', (done) => {
      const documentId = 'doc-123'
      clientSocket.emit('subscribe:document', documentId)
      
      const jobData: JobFailed = {
        jobId: 'job-123',
        documentId,
        type: 'enhancement',
        error: {
          message: 'AI service unavailable',
          code: 'AI_ERROR',
          retryable: true
        },
        timestamp: new Date()
      }

      let receivedJob = false
      let receivedNotification = false

      clientSocket.on('job:failed', (received) => {
        expect(received).toEqual(jobData)
        receivedJob = true
        checkDone()
      })

      clientSocket.on('notification', (notification) => {
        expect(notification.type).toBe('error')
        expect(notification.title).toBe('Enhancement Failed')
        expect(notification.message).toBe('AI service unavailable')
        receivedNotification = true
        checkDone()
      })

      const checkDone = () => {
        if (receivedJob && receivedNotification) {
          done()
        }
      }

      setTimeout(() => {
        wsServer.sendJobFailed(documentId, jobData)
      }, 100)
    })

    it('should send queue position updates', (done) => {
      const documentId = 'doc-123'
      clientSocket.emit('subscribe:document', documentId)
      
      clientSocket.on('queue:position', (position) => {
        expect(position).toEqual({
          documentId,
          position: 5,
          estimatedWaitTime: 150,
          queueLength: 10
        })
        done()
      })

      setTimeout(() => {
        wsServer.sendQueuePosition(documentId, 5, 10)
      }, 100)
    })
  })

  describe('Batch Updates', () => {
    beforeEach((done) => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          token: TEST_TOKEN
        }
      })

      clientSocket.on('connection:ready', done)
    })

    it('should send batch updates to subscribed users', (done) => {
      const batchId = 'batch-123'
      clientSocket.emit('subscribe:batch', batchId)
      
      const batchUpdate = {
        batchId,
        totalDocuments: 5,
        completed: 2,
        failed: 1,
        inProgress: 1,
        documents: [
          { documentId: 'doc-1', status: 'completed' as const, progress: 100 },
          { documentId: 'doc-2', status: 'completed' as const, progress: 100 },
          { documentId: 'doc-3', status: 'failed' as const },
          { documentId: 'doc-4', status: 'processing' as const, progress: 45 },
          { documentId: 'doc-5', status: 'pending' as const }
        ]
      }

      clientSocket.on('batch:update', (received) => {
        expect(received).toEqual(batchUpdate)
        done()
      })

      setTimeout(() => {
        wsServer.sendBatchUpdate(batchId, batchUpdate)
      }, 100)
    })
  })

  describe('Connection Management', () => {
    beforeEach((done) => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: TEST_USER_ID } },
        error: null
      })

      clientSocket = ioc(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        auth: {
          token: TEST_TOKEN
        }
      })

      clientSocket.on('connection:ready', done)
    })

    it('should handle ping messages', (done) => {
      clientSocket.on('notification', (notification) => {
        expect(notification.type).toBe('info')
        expect(notification.title).toBe('Connection Active')
        done()
      })

      clientSocket.emit('ping')
    })

    it('should handle disconnection gracefully', (done) => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      clientSocket.on('disconnect', () => {
        setTimeout(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining(`User ${TEST_USER_ID} disconnected`)
          )
          consoleSpy.mockRestore()
          done()
        }, 100)
      })

      clientSocket.disconnect()
    })

    it('should handle socket errors', (done) => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      clientSocket.on('connection:error', (error) => {
        expect(error).toBe('Test error')
        consoleSpy.mockRestore()
        done()
      })

      // Simulate error by accessing server socket
      const serverIo = (wsServer as any).io as Server
      serverIo.on('connection', (socket) => {
        socket.emit('error', new Error('Test error'))
      })

      // Reconnect to trigger error
      clientSocket.disconnect()
      clientSocket.connect()
    })
  })

  describe('Monitoring Methods', () => {
    it('should return connected users count', () => {
      const count = wsServer.getConnectedUsersCount()
      expect(typeof count).toBe('number')
      expect(count).toBeGreaterThanOrEqual(0)
    })

    it('should return rooms info', () => {
      const info = wsServer.getRoomsInfo()
      expect(typeof info).toBe('object')
    })
  })

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      // Test singleton without initializing
      const instance1 = getWebSocketServer()
      const instance2 = getWebSocketServer()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Helper Functions', () => {
    it('should emit progress updates through helper', () => {
      const documentId = 'doc-789'
      const progress: EnhancementProgress = {
        documentId,
        stage: 'composition',
        progress: 90,
        message: 'Finalizing...'
      }

      // Spy on the server method
      const sendSpy = jest.spyOn(wsServer, 'sendEnhancementProgress')
      
      emitProgressUpdate(documentId, progress)
      
      expect(sendSpy).toHaveBeenCalledWith(documentId, progress)
    })
  })
})