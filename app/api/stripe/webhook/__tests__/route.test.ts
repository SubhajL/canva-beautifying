import { POST } from '../route'
import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe/config'
import { syncSubscriptionStatus } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

// Mock NextRequest globally
const mockNextRequest = jest.fn().mockImplementation((url, options = {}) => {
  const request = {
    url,
    method: options.method || 'GET',
    headers: new Map(Object.entries(options.headers || {})),
    json: async () => JSON.parse(options.body || '{}'),
    text: async () => options.body || '',
    formData: async () => options.body
  }
  return request
})

// @ts-ignore
global.NextRequest = mockNextRequest

// Mock dependencies
jest.mock('@/lib/stripe/config', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn()
    },
    subscriptions: {
      retrieve: jest.fn()
    }
  },
  STRIPE_WEBHOOK_SECRET: 'whsec_test123'
}))
jest.mock('@/lib/stripe/client')
jest.mock('@/lib/supabase/server')
jest.mock('next/headers')

const mockStripe = stripe as jest.Mocked<typeof stripe>
const mockSyncSubscriptionStatus = syncSubscriptionStatus as jest.MockedFunction<typeof syncSubscriptionStatus>
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockHeaders = headers as jest.MockedFunction<typeof headers>

describe('POST /api/stripe/webhook', () => {
  let mockSupabase: any
  let mockWebhookSecret: string

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup Supabase mock
    mockSupabase = {
      from: jest.fn(() => ({
        update: jest.fn(() => ({
          eq: jest.fn()
        }))
      }))
    }
    
    mockCreateClient.mockResolvedValue(mockSupabase)
    
    // Setup webhook secret
    mockWebhookSecret = 'whsec_test123'
  })

  describe('Signature validation', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue(null)
      } as any)

      const request = mockNextRequest('http://localhost:5000/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No signature')
    })

    it('returns 400 when signature verification fails', async () => {
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('invalid_signature')
      } as any)

      mockStripe.webhooks = {
        constructEvent: jest.fn().mockImplementation(() => {
          throw new Error('Invalid signature')
        })
      } as any

      const request = mockNextRequest('http://localhost:5000/api/stripe/webhook', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })
  })

  describe('Event handling', () => {
    const createValidRequest = (eventData: any) => {
      const body = JSON.stringify(eventData)
      
      mockHeaders.mockResolvedValue({
        get: jest.fn().mockReturnValue('valid_signature')
      } as any)

      mockStripe.webhooks = {
        constructEvent: jest.fn().mockReturnValue(eventData)
      } as any

      return mockNextRequest('http://localhost:5000/api/stripe/webhook', {
        method: 'POST',
        body
      })
    }

    describe('customer.subscription.created', () => {
      it('syncs subscription status', async () => {
        const event = {
          id: 'evt_test123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_123',
              status: 'active',
              metadata: {
                supabase_user_id: 'user-123'
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSyncSubscriptionStatus).toHaveBeenCalledWith('sub_123')
      })
    })

    describe('customer.subscription.updated', () => {
      it('syncs subscription status', async () => {
        const event = {
          id: 'evt_test123',
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub_123',
              status: 'active',
              metadata: {
                supabase_user_id: 'user-123'
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSyncSubscriptionStatus).toHaveBeenCalledWith('sub_123')
      })
    })

    describe('customer.subscription.deleted', () => {
      it('updates user to free tier', async () => {
        const updateMock = jest.fn().mockReturnValue({
          eq: jest.fn()
        })
        
        mockSupabase.from.mockReturnValue({
          update: updateMock
        })

        const event = {
          id: 'evt_test123',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_123',
              metadata: {
                supabase_user_id: 'user-123'
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSupabase.from).toHaveBeenCalledWith('users')
        expect(updateMock).toHaveBeenCalledWith({
          subscription_tier: 'free',
          subscription_status: 'cancelled',
          stripe_subscription_id: null
        })
      })

      it('skips update when userId is missing', async () => {
        const event = {
          id: 'evt_test123',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_123',
              metadata: {}
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSupabase.from).not.toHaveBeenCalled()
      })
    })

    describe('invoice.payment_succeeded', () => {
      it('syncs subscription status', async () => {
        const event = {
          id: 'evt_test123',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_123',
              lines: {
                data: [{
                  subscription: 'sub_123'
                }]
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSyncSubscriptionStatus).toHaveBeenCalledWith('sub_123')
      })

      it('handles invoice without subscription', async () => {
        const event = {
          id: 'evt_test123',
          type: 'invoice.payment_succeeded',
          data: {
            object: {
              id: 'in_123',
              lines: {
                data: [{
                  subscription: null
                }]
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSyncSubscriptionStatus).not.toHaveBeenCalled()
      })
    })

    describe('invoice.payment_failed', () => {
      it('updates subscription status to past_due', async () => {
        const updateMock = jest.fn().mockReturnValue({
          eq: jest.fn()
        })
        
        mockSupabase.from.mockReturnValue({
          update: updateMock
        })

        mockStripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_123',
          metadata: {
            supabase_user_id: 'user-123'
          }
        } as any)

        const event = {
          id: 'evt_test123',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_123',
              lines: {
                data: [{
                  subscription: 'sub_123'
                }]
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123')
        expect(mockSupabase.from).toHaveBeenCalledWith('users')
        expect(updateMock).toHaveBeenCalledWith({
          subscription_status: 'past_due'
        })
      })

      it('handles missing subscription metadata', async () => {
        mockStripe.subscriptions.retrieve.mockResolvedValue({
          id: 'sub_123',
          metadata: {}
        } as any)

        const event = {
          id: 'evt_test123',
          type: 'invoice.payment_failed',
          data: {
            object: {
              id: 'in_123',
              lines: {
                data: [{
                  subscription: 'sub_123'
                }]
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSupabase.from).not.toHaveBeenCalled()
      })
    })

    describe('checkout.session.completed', () => {
      it('syncs subscription for subscription mode', async () => {
        const event = {
          id: 'evt_test123',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              mode: 'subscription',
              subscription: 'sub_123'
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSyncSubscriptionStatus).toHaveBeenCalledWith('sub_123')
      })

      it('skips sync for payment mode', async () => {
        const event = {
          id: 'evt_test123',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_123',
              mode: 'payment',
              payment_intent: 'pi_123'
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(mockSyncSubscriptionStatus).not.toHaveBeenCalled()
      })
    })

    describe('Unhandled events', () => {
      it('logs and returns success for unhandled events', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
        
        const event = {
          id: 'evt_test123',
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123'
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.received).toBe(true)
        expect(consoleSpy).toHaveBeenCalledWith('Unhandled event type: payment_intent.succeeded')
        
        consoleSpy.mockRestore()
      })
    })

    describe('Error handling', () => {
      it('returns 500 when handler throws error', async () => {
        mockSyncSubscriptionStatus.mockRejectedValue(new Error('Sync failed'))

        const event = {
          id: 'evt_test123',
          type: 'customer.subscription.created',
          data: {
            object: {
              id: 'sub_123'
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Webhook handler failed')
      })

      it('handles database errors gracefully', async () => {
        mockSupabase.from.mockImplementation(() => {
          throw new Error('Database connection failed')
        })

        const event = {
          id: 'evt_test123',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              id: 'sub_123',
              metadata: {
                supabase_user_id: 'user-123'
              }
            }
          }
        }

        const request = createValidRequest(event)
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Webhook handler failed')
      })
    })
  })
})