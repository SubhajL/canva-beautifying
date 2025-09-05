import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/auth/middleware'
import { withRateLimit } from '@/lib/api/middleware/rate-limit'
import { withValidation } from '@/lib/api/middleware/validation'
import { createAPIResponse, apiErrors } from '@/lib/api/response'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { documentRoute } from '@/lib/api/openapi/decorators'
import { routeRegistry } from '@/lib/api/openapi/registry'

const statsQuerySchema = z.object({
  webhookId: z.string().uuid().optional(),
  period: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

const summaryStatsSchema = z.object({
  totalDeliveries: z.number(),
  successfulDeliveries: z.number(),
  failedDeliveries: z.number(),
  pendingDeliveries: z.number(),
  averageResponseTime: z.number(),
  successRate: z.number()
})

const webhookStatsSchema = z.object({
  webhookId: z.string(),
  url: z.string(),
  totalDeliveries: z.number(),
  successfulDeliveries: z.number(),
  failedDeliveries: z.number(),
  successRate: z.number(),
  averageResponseTime: z.number()
})

const eventTypeStatsSchema = z.object({
  eventType: z.string(),
  totalDeliveries: z.number(),
  successfulDeliveries: z.number(),
  failedDeliveries: z.number(),
  successRate: z.number()
})

const timeSeriesDataSchema = z.object({
  timestamp: z.string(),
  deliveries: z.number(),
  successful: z.number(),
  failed: z.number()
})

const statsResponseSchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']),
  dateRange: z.object({
    start: z.string(),
    end: z.string()
  }),
  summary: summaryStatsSchema,
  byWebhook: z.array(webhookStatsSchema),
  byEventType: z.array(eventTypeStatsSchema),
  timeSeries: z.array(timeSeriesDataSchema),
  errorBreakdown: z.record(z.number())
})

// GET /api/v1/webhooks/stats - Get webhook delivery statistics
const getWebhookStatsHandler = async (request: NextRequest, context: any) => {
  try {
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams.entries())
    const validated = statsQuerySchema.parse(query)
    
    const supabase = await createClient()
    
    // Calculate date range
    const endDate = validated.endDate ? new Date(validated.endDate) : new Date()
    const startDate = validated.startDate ? new Date(validated.startDate) : 
      calculateStartDate(endDate, validated.period)
    
    // Build base query
    let baseQuery = supabase
      .from('webhook_delivery_logs')
      .select('*, webhook_configs!inner(*)')
      .eq('webhook_configs.user_id', context.user!.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
    
    if (validated.webhookId) {
      baseQuery = baseQuery.eq('webhook_id', validated.webhookId)
    }
    
    const { data: logs, error } = await baseQuery
    
    if (error) {
      console.error('Failed to fetch webhook stats:', error)
      throw apiErrors.INTERNAL_ERROR
    }
    
    // Calculate statistics
    const stats = calculateWebhookStats(logs || [], validated.period)
    
    return createAPIResponse({
      data: {
        period: validated.period,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        summary: stats.summary,
        byWebhook: stats.byWebhook,
        byEventType: stats.byEventType,
        timeSeries: stats.timeSeries,
        errorBreakdown: stats.errorBreakdown
      }
    })
  } catch (error) {
    console.error('Failed to get webhook stats:', error)
    throw apiErrors.INTERNAL_ERROR
  }
}

export const GET = withAuth(
  withRateLimit({ maxRequests: 100 })(
    withValidation({
      schema: statsQuerySchema,
      source: 'query'
    })(
      documentRoute(
        getWebhookStatsHandler,
        {
          method: 'GET',
          path: '/api/v1/webhooks/stats',
          operationId: 'getWebhookStats',
          summary: 'Get webhook delivery statistics',
          description: 'Retrieves aggregated statistics for webhook deliveries across all webhooks or for a specific webhook',
          tags: ['Webhooks'],
          parameters: [
            {
              name: 'webhookId',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'uuid' },
              description: 'Filter statistics for a specific webhook'
            },
            {
              name: 'period',
              in: 'query',
              required: false,
              schema: { 
                type: 'string',
                enum: ['hour', 'day', 'week', 'month'],
                default: 'day'
              },
              description: 'Time period for aggregation'
            },
            {
              name: 'startDate',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'date-time' },
              description: 'Start date for the statistics range'
            },
            {
              name: 'endDate',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'date-time' },
              description: 'End date for the statistics range'
            }
          ]
        },
        undefined,
        {
          200: {
            description: 'Webhook delivery statistics',
            schema: statsResponseSchema
          },
          401: {
            description: 'Unauthorized'
          },
          429: {
            description: 'Rate limit exceeded'
          },
          500: {
            description: 'Internal server error'
          }
        }
      )
    )
  )
)

function calculateStartDate(endDate: Date, period: string): Date {
  const startDate = new Date(endDate)
  
  switch (period) {
    case 'hour':
      startDate.setHours(startDate.getHours() - 1)
      break
    case 'day':
      startDate.setDate(startDate.getDate() - 1)
      break
    case 'week':
      startDate.setDate(startDate.getDate() - 7)
      break
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1)
      break
  }
  
  return startDate
}

function calculateWebhookStats(logs: any[], period: string) {
  const summary = {
    totalDeliveries: logs.length,
    successfulDeliveries: 0,
    failedDeliveries: 0,
    pendingDeliveries: 0,
    averageResponseTime: 0,
    successRate: 0
  }
  
  const byWebhook: Record<string, {
    webhookId: string
    url: string
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
    successRate: number
    averageResponseTime: number
  }> = {}
  
  const byEventType: Record<string, {
    eventType: string
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
    successRate: number
  }> = {}
  
  const timeSeries: Record<string, {
    timestamp: string
    deliveries: number
    successful: number
    failed: number
  }> = {}
  
  const errorBreakdown: Record<string, number> = {}
  
  let totalResponseTime = 0
  let responseTimeCount = 0
  
  // Process logs
  logs.forEach(log => {
    const webhookId = log.webhook_id
    const eventType = log.event_type
    const isSuccess = log.delivered_at !== null
    const isFailed = log.error !== null && !log.next_retry_at
    const isPending = !isSuccess && !isFailed
    
    // Update summary
    if (isSuccess) {
      summary.successfulDeliveries++
      
      // Calculate response time if available
      if (log.delivered_at && log.created_at) {
        const responseTime = new Date(log.delivered_at).getTime() - 
                           new Date(log.created_at).getTime()
        totalResponseTime += responseTime
        responseTimeCount++
      }
    } else if (isFailed) {
      summary.failedDeliveries++
      
      // Track error types
      const errorCode = log.error || 'Unknown error'
      errorBreakdown[errorCode] = (errorBreakdown[errorCode] || 0) + 1
    } else if (isPending) {
      summary.pendingDeliveries++
    }
    
    // Update by webhook
    if (!byWebhook[webhookId]) {
      byWebhook[webhookId] = {
        webhookId,
        url: log.webhook_configs.url,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0,
        averageResponseTime: 0
      }
    }
    
    byWebhook[webhookId].totalDeliveries++
    if (isSuccess) byWebhook[webhookId].successfulDeliveries++
    if (isFailed) byWebhook[webhookId].failedDeliveries++
    
    // Update by event type
    if (!byEventType[eventType]) {
      byEventType[eventType] = {
        eventType,
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        successRate: 0
      }
    }
    
    byEventType[eventType].totalDeliveries++
    if (isSuccess) byEventType[eventType].successfulDeliveries++
    if (isFailed) byEventType[eventType].failedDeliveries++
    
    // Update time series
    const timeKey = getTimeSeriesKey(new Date(log.created_at), period)
    if (!timeSeries[timeKey]) {
      timeSeries[timeKey] = {
        timestamp: timeKey,
        deliveries: 0,
        successful: 0,
        failed: 0
      }
    }
    
    timeSeries[timeKey].deliveries++
    if (isSuccess) timeSeries[timeKey].successful++
    if (isFailed) timeSeries[timeKey].failed++
  })
  
  // Calculate final stats
  summary.averageResponseTime = responseTimeCount > 0 ? 
    Math.round(totalResponseTime / responseTimeCount) : 0
  summary.successRate = summary.totalDeliveries > 0 ? 
    Math.round((summary.successfulDeliveries / summary.totalDeliveries) * 100) : 0
  
  // Calculate rates for byWebhook
  Object.values(byWebhook).forEach(webhook => {
    webhook.successRate = webhook.totalDeliveries > 0 ?
      Math.round((webhook.successfulDeliveries / webhook.totalDeliveries) * 100) : 0
  })
  
  // Calculate rates for byEventType
  Object.values(byEventType).forEach(event => {
    event.successRate = event.totalDeliveries > 0 ?
      Math.round((event.successfulDeliveries / event.totalDeliveries) * 100) : 0
  })
  
  return {
    summary,
    byWebhook: Object.values(byWebhook),
    byEventType: Object.values(byEventType),
    timeSeries: Object.values(timeSeries).sort((a, b) => 
      a.timestamp.localeCompare(b.timestamp)
    ),
    errorBreakdown
  }
}

function getTimeSeriesKey(date: Date, period: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  
  switch (period) {
    case 'hour':
      const minute = String(Math.floor(date.getMinutes() / 10) * 10).padStart(2, '0')
      return `${year}-${month}-${day}T${hour}:${minute}`
    case 'day':
      return `${year}-${month}-${day}T${hour}:00`
    case 'week':
    case 'month':
      return `${year}-${month}-${day}`
    default:
      return `${year}-${month}-${day}T${hour}:00`
  }
}

// Register routes
routeRegistry.registerRoute('/api/v1/webhooks/stats', 'GET')