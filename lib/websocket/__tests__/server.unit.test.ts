import { WebSocketServer, getWebSocketServer, emitProgressUpdate } from '../server'
import { createClient } from '@/lib/supabase/server'
import type { EnhancementProgress, JobCompleted, JobFailed, Notification } from '../types'

// Mock Supabase
jest.mock('@/lib/supabase/server')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('WebSocketServer - Unit Tests', () => {
  let wsServer: WebSocketServer
  let mockSupabase: any
  let mockAuth: any
  let mockFrom: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup Supabase mocks
    mockAuth = {
      getUser: jest.fn()
    }
    
    mockFrom = jest.fn((table: string) => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { user_id: 'user-123' },
            error: null
          }))
        }))
      }))
    }))
    
    mockSupabase = {
      auth: mockAuth,
      from: mockFrom
    }
    
    mockCreateClient.mockReturnValue(mockSupabase as any)
    
    // Create new WebSocket server instance
    wsServer = new WebSocketServer()
  })

  describe('Initialization', () => {
    it('should create a new WebSocketServer instance', () => {
      expect(wsServer).toBeInstanceOf(WebSocketServer)
    })

    it('should have null io before initialization', () => {
      expect((wsServer as any).io).toBeNull()
    })
  })

  describe('Public Methods - Before Initialization', () => {
    it('should handle sendEnhancementProgress gracefully when not initialized', () => {
      const progress: EnhancementProgress = {
        documentId: 'doc-123',
        stage: 'analysis',
        progress: 50,
        message: 'Analyzing...'
      }
      
      // Should not throw
      expect(() => wsServer.sendEnhancementProgress('doc-123', progress)).not.toThrow()
    })

    it('should handle sendJobCompleted gracefully when not initialized', () => {
      const jobData: JobCompleted = {
        jobId: 'job-123',
        documentId: 'doc-123',
        type: 'enhancement',
        result: {
          success: true,
          enhancedUrl: 'https://example.com/enhanced.pdf'
        },
        processingTime: 1000,
        timestamp: new Date()
      }
      
      expect(() => wsServer.sendJobCompleted('doc-123', jobData)).not.toThrow()
    })

    it('should handle sendJobFailed gracefully when not initialized', () => {
      const jobData: JobFailed = {
        jobId: 'job-123',
        documentId: 'doc-123',
        type: 'enhancement',
        error: {
          message: 'Test error',
          code: 'TEST_ERROR',
          retryable: false
        },
        timestamp: new Date()
      }
      
      expect(() => wsServer.sendJobFailed('doc-123', jobData)).not.toThrow()
    })

    it('should handle sendQueuePosition gracefully when not initialized', () => {
      expect(() => wsServer.sendQueuePosition('doc-123', 5, 10)).not.toThrow()
    })

    it('should handle sendBatchUpdate gracefully when not initialized', () => {
      const update = {
        batchId: 'batch-123',
        totalDocuments: 5,
        completed: 2,
        failed: 0,
        inProgress: 1
      }
      
      expect(() => wsServer.sendBatchUpdate('batch-123', update)).not.toThrow()
    })

    it('should handle sendNotificationToUser gracefully when not initialized', () => {
      const notification: Notification = {
        id: 'notif-123',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        timestamp: new Date()
      }
      
      expect(() => wsServer.sendNotificationToUser('user-123', notification)).not.toThrow()
    })

    it('should handle sendNotificationToDocument gracefully when not initialized', () => {
      const notification: Notification = {
        id: 'notif-123',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        timestamp: new Date()
      }
      
      expect(() => wsServer.sendNotificationToDocument('doc-123', notification)).not.toThrow()
    })
  })

  describe('Monitoring Methods', () => {
    it('should return 0 for connected users count when not initialized', () => {
      expect(wsServer.getConnectedUsersCount()).toBe(0)
    })

    it('should return empty object for rooms info when not initialized', () => {
      expect(wsServer.getRoomsInfo()).toEqual({})
    })
  })

  describe('Graceful Shutdown', () => {
    it('should handle close gracefully when not initialized', async () => {
      await expect(wsServer.close()).resolves.not.toThrow()
    })
  })

  describe('Helper Methods', () => {
    it('should verify document access', async () => {
      mockFrom.mockImplementation((table: string) => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { user_id: 'user-123' },
              error: null
            }))
          }))
        }))
      }))
      
      const hasAccess = await (wsServer as any).verifyDocumentAccess('user-123', 'doc-123')
      expect(hasAccess).toBe(true)
      expect(mockFrom).toHaveBeenCalledWith('documents')
    })

    it('should deny document access for different user', async () => {
      mockFrom.mockImplementation((table: string) => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { user_id: 'other-user' },
              error: null
            }))
          }))
        }))
      }))
      
      const hasAccess = await (wsServer as any).verifyDocumentAccess('user-123', 'doc-123')
      expect(hasAccess).toBe(false)
    })

    it('should verify batch access (placeholder)', async () => {
      const hasAccess = await (wsServer as any).verifyBatchAccess('user-123', 'batch-123')
      expect(hasAccess).toBe(true)
    })
  })

  describe('Singleton Pattern', () => {
    it('should return same instance from getWebSocketServer', () => {
      const instance1 = getWebSocketServer()
      const instance2 = getWebSocketServer()
      expect(instance1).toBe(instance2)
    })

    it('should create new instance if not exists', () => {
      // Clear the module cache to reset singleton
      jest.resetModules()
      jest.mock('@/lib/supabase/server')
      const { getWebSocketServer: getFreshServer, WebSocketServer: FreshWebSocketServer } = require('../server')
      const instance = getFreshServer()
      expect(instance).toBeInstanceOf(FreshWebSocketServer)
    })
  })

  describe('Helper Function - emitProgressUpdate', () => {
    it('should call sendEnhancementProgress on the singleton instance', () => {
      const progress: EnhancementProgress = {
        documentId: 'doc-123',
        stage: 'generation',
        progress: 75,
        message: 'Generating enhancements...'
      }
      
      const server = getWebSocketServer()
      const sendSpy = jest.spyOn(server, 'sendEnhancementProgress')
      
      emitProgressUpdate('doc-123', progress)
      
      expect(sendSpy).toHaveBeenCalledWith('doc-123', progress)
    })
  })
})