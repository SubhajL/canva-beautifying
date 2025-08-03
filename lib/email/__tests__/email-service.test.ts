import { render } from '@react-email/render'
import { EmailService } from '../email-service'
import { resend, FROM_EMAIL, REPLY_TO_EMAIL } from '../resend'
import { createClient } from '@/lib/supabase/client'

// Mock dependencies
jest.mock('@react-email/render')
jest.mock('../resend', () => ({
  resend: null,
  FROM_EMAIL: 'noreply@beautifyai.com',
  REPLY_TO_EMAIL: 'support@beautifyai.com'
}))
jest.mock('@/lib/supabase/client')

const mockRender = render as jest.MockedFunction<typeof render>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('EmailService', () => {
  let mockSupabase: any
  let mockResend: any
  let mockFromReturn: any
  let mockInsert: jest.Mock
  let mockSelect: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create stable mocks
    mockInsert = jest.fn(() => Promise.resolve({ data: null, error: null }))
    mockSelect = jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    }))
    
    mockFromReturn = {
      select: mockSelect,
      insert: mockInsert
    }
    
    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn(() => mockFromReturn)
    }
    
    mockCreateClient.mockReturnValue(mockSupabase as any)
    
    // Setup Resend mock
    mockResend = {
      emails: {
        send: jest.fn()
      }
    }
    
    // Mock resend in the module
    require('../resend').resend = mockResend
    
    // Mock render function
    mockRender.mockResolvedValue('<html>Test Email</html>')
  })

  describe('sendEnhancementCompletedEmail', () => {
    const emailData = {
      userName: 'John Doe',
      userEmail: 'john@example.com',
      documentName: 'Test Document',
      enhancementUrl: 'https://example.com/enhanced/doc123',
      originalPreviewUrl: 'https://example.com/original/doc123',
      enhancedPreviewUrl: 'https://example.com/enhanced/doc123',
      processingTime: 30,
      improvementScore: 85
    }

    it('sends email successfully when preferences allow', async () => {
      // Override the select mock for this test
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { enhancement_completed: true },
            error: null
          }))
        }))
      })

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' }
      })

      const result = await EmailService.sendEnhancementCompletedEmail('user-123', emailData)

      expect(result.success).toBe(true)
      expect(result.id).toBe('email-123')
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'noreply@beautifyai.com',
        to: 'john@example.com',
        subject: 'Your enhanced document "Test Document" is ready!',
        html: '<html>Test Email</html>',
        replyTo: 'support@beautifyai.com',
        tags: [
          { name: 'type', value: 'enhancement-completed' },
          { name: 'user_id', value: 'user-123' }
        ]
      })

      // Check email log was created
      expect(mockSupabase.from).toHaveBeenCalledWith('email_logs')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        email_type: 'enhancement-completed',
        recipient: 'john@example.com',
        success: true,
        message_id: 'email-123',
        error: undefined,
        sent_at: expect.any(String)
      })
    })

    it('skips email when preferences disallow', async () => {
      // Override the select mock for this test
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { enhancement_completed: false },
            error: null
          }))
        }))
      })

      const result = await EmailService.sendEnhancementCompletedEmail('user-123', emailData)

      expect(result.success).toBe(true)
      expect(result.id).toBe('')
      expect(mockResend.emails.send).not.toHaveBeenCalled()
      expect(mockSupabase.from().insert).not.toHaveBeenCalled()
    })

    it('sends email when preferences not found (defaults to true)', async () => {
      // Override the select mock for this test
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: null,
            error: new Error('Not found')
          }))
        }))
      })

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' }
      })

      const result = await EmailService.sendEnhancementCompletedEmail('user-123', emailData)

      expect(result.success).toBe(true)
      expect(mockResend.emails.send).toHaveBeenCalled()
    })

    it('handles email sending errors', async () => {
      // Override the select mock for this test
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { enhancement_completed: true },
            error: null
          }))
        }))
      })

      mockResend.emails.send.mockRejectedValue(new Error('SMTP connection failed'))

      const result = await EmailService.sendEnhancementCompletedEmail('user-123', emailData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('SMTP connection failed')
      
      // Check error was logged
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        email_type: 'enhancement-completed',
        recipient: 'john@example.com',
        success: false,
        message_id: undefined,
        error: 'SMTP connection failed',
        sent_at: expect.any(String)
      })
    })

    it('handles development mode (no resend configured)', async () => {
      // Temporarily set resend to null in the module
      require('../resend').resend = null
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const result = await EmailService.sendEnhancementCompletedEmail('user-123', emailData)

      expect(result.success).toBe(true)
      expect(result.id).toMatch(/^dev-/)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Email service not configured. Would send enhancement completed email to:',
        'john@example.com'
      )
      
      consoleSpy.mockRestore()
      // Restore resend mock for other tests
      require('../resend').resend = mockResend
    })
  })

  describe('sendWelcomeEmail', () => {
    const emailData = {
      userName: 'Jane Doe',
      userEmail: 'jane@example.com',
      userTier: 'pro' as const,
      monthlyCredits: 100
    }

    it('sends welcome email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'welcome-123' }
      })

      const result = await EmailService.sendWelcomeEmail('user-456', emailData)

      expect(result.success).toBe(true)
      expect(result.id).toBe('welcome-123')
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'noreply@beautifyai.com',
        to: 'jane@example.com',
        subject: 'Welcome to BeautifyAI! 🎨',
        html: '<html>Test Email</html>',
        replyTo: 'support@beautifyai.com',
        tags: [
          { name: 'type', value: 'welcome' },
          { name: 'user_id', value: 'user-456' },
          { name: 'tier', value: 'pro' }
        ]
      })
    })

    it('logs email delivery', async () => {
      mockResend.emails.send.mockResolvedValue({
        id: 'welcome-123'
      })

      await EmailService.sendWelcomeEmail('user-456', emailData)

      expect(mockSupabase.from).toHaveBeenCalledWith('email_logs')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-456',
        email_type: 'welcome',
        recipient: 'jane@example.com',
        success: true,
        message_id: 'welcome-123',
        sent_at: expect.any(String)
      })
    })
  })

  describe('sendPasswordResetEmail', () => {
    const emailData = {
      userName: 'Bob Smith',
      userEmail: 'bob@example.com',
      resetUrl: 'https://beautifyai.com/reset-password?token=abc123',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0'
    }

    it('sends password reset email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'reset-123' }
      })

      const result = await EmailService.sendPasswordResetEmail(emailData)

      expect(result.success).toBe(true)
      expect(result.id).toBe('reset-123')
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'noreply@beautifyai.com',
        to: 'bob@example.com',
        subject: 'Reset your BeautifyAI password',
        html: '<html>Test Email</html>',
        replyTo: 'support@beautifyai.com',
        tags: [
          { name: 'type', value: 'password-reset' }
        ]
      })
    })

    it('logs email without userId', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'reset-123' }
      })

      await EmailService.sendPasswordResetEmail(emailData)

      expect(mockSupabase.from).toHaveBeenCalledWith('email_logs')
      expect(mockInsert).toHaveBeenCalledWith({
        email_type: 'password-reset',
        recipient: 'bob@example.com',
        success: true,
        message_id: 'reset-123',
        sent_at: expect.any(String)
      })
    })
  })

  describe('sendSubscriptionCreatedEmail', () => {
    const emailData = {
      userName: 'Alice Johnson',
      userEmail: 'alice@example.com',
      planName: 'Premium' as const,
      monthlyCredits: 500,
      amount: 29.99,
      billingCycle: 'monthly' as const,
      nextBillingDate: new Date('2024-02-01'),
      invoiceUrl: 'https://stripe.com/invoice/123'
    }

    it('sends subscription email when preferences allow', async () => {
      // Override the select mock for this test
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { system_notifications: true },
            error: null
          }))
        }))
      })

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'sub-123' }
      })

      const result = await EmailService.sendSubscriptionCreatedEmail('user-789', emailData)

      expect(result.success).toBe(true)
      expect(result.id).toBe('sub-123')
      
      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'noreply@beautifyai.com',
        to: 'alice@example.com',
        subject: 'Welcome to BeautifyAI Premium!',
        html: '<html>Test Email</html>',
        replyTo: 'support@beautifyai.com',
        tags: [
          { name: 'type', value: 'subscription-created' },
          { name: 'user_id', value: 'user-789' },
          { name: 'plan', value: 'Premium' }
        ]
      })
    })

    it('skips email when system notifications disabled', async () => {
      // Override the select mock for this test
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { system_notifications: false },
            error: null
          }))
        }))
      })

      const result = await EmailService.sendSubscriptionCreatedEmail('user-789', emailData)

      expect(result.success).toBe(true)
      expect(result.id).toBe('')
      expect(mockResend.emails.send).not.toHaveBeenCalled()
    })
  })

  describe('sendBulkEmail', () => {
    const recipients = [
      { id: '1', email: 'user1@example.com', name: 'User 1' },
      { id: '2', email: 'user2@example.com', name: 'User 2' },
      { id: '3', email: 'user3@example.com', name: 'User 3' }
    ]

    const getEmailData = async (recipient: any) => ({
      userName: recipient.name,
      documentName: 'Bulk Document',
      enhancementUrl: `https://example.com/enhanced/${recipient.id}`,
      processingTime: 25,
      improvementScore: 90
    })

    it('sends bulk emails successfully', async () => {
      // Mock all emails as successfully sent
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'bulk-email' }
      })

      // Mock preferences to allow all emails
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { enhancement_completed: true },
            error: null
          }))
        }))
      })

      const result = await EmailService.sendBulkEmail(
        recipients,
        'enhancement-completed',
        getEmailData
      )

      expect(result.sent).toBe(3)
      expect(result.failed).toBe(0)
      expect(mockResend.emails.send).toHaveBeenCalledTimes(3)
    })

    it('handles mixed success and failure', async () => {
      // First email succeeds, second fails, third succeeds
      mockResend.emails.send
        .mockResolvedValueOnce({ data: { id: 'email-1' } })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ data: { id: 'email-3' } })

      // Mock preferences to allow all emails
      mockSelect.mockReturnValue({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { enhancement_completed: true },
            error: null
          }))
        }))
      })

      const result = await EmailService.sendBulkEmail(
        recipients,
        'enhancement-completed',
        getEmailData
      )

      expect(result.sent).toBe(2)
      expect(result.failed).toBe(1)
    })

    it('processes in batches with delay', async () => {
      const manyRecipients = Array.from({ length: 25 }, (_, i) => ({
        id: `${i}`,
        email: `user${i}@example.com`,
        name: `User ${i}`
      }))

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'bulk-email' }
      })

      const selectMock = mockSupabase.from().select
      selectMock().eq().single.mockResolvedValue({
        data: { enhancement_completed: true },
        error: null
      })

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

      await EmailService.sendBulkEmail(
        manyRecipients,
        'enhancement-completed',
        getEmailData
      )

      // Should have delays between batches (25 recipients = 3 batches with size 10)
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2)
      
      setTimeoutSpy.mockRestore()
    })

    it('throws error for unsupported email types', async () => {
      await expect(
        EmailService.sendBulkEmail(
          recipients,
          'weekly-digest' as any,
          getEmailData
        )
      ).resolves.toMatchObject({
        sent: 0,
        failed: 3
      })
    })
  })
})