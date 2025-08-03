import { AIModel, UserTier } from '../types'
import { createClient } from '@/lib/supabase/client'

interface SelectionLogEntry {
  id?: string
  timestamp: Date
  userId: string
  documentId: string
  selectedModel: AIModel
  userTier: UserTier
  documentType: 'worksheet' | 'presentation' | 'marketing'
  documentComplexity: 'low' | 'medium' | 'high'
  processingPriority: 'speed' | 'quality' | 'balanced'
  selectionReason: string
  alternativeModels: AIModel[]
  experimentGroup?: string // For A/B testing
  success: boolean
  responseTime?: number
  tokensUsed?: number
  cost?: number
  error?: string
}

export class ModelSelectionLogger {
  private static batchedLogs: SelectionLogEntry[] = []
  private static batchSize = 10
  private static flushInterval = 30000 // 30 seconds

  static {
    // Set up periodic flushing
    setInterval(() => {
      this.flush().catch(console.error)
    }, this.flushInterval)
  }

  static async logSelection(entry: Omit<SelectionLogEntry, 'id' | 'timestamp'>): Promise<void> {
    const logEntry: SelectionLogEntry = {
      ...entry,
      timestamp: new Date()
    }

    this.batchedLogs.push(logEntry)

    if (this.batchedLogs.length >= this.batchSize) {
      await this.flush()
    }
  }

  static async flush(): Promise<void> {
    if (this.batchedLogs.length === 0) return

    const logsToFlush = [...this.batchedLogs]
    this.batchedLogs = []

    try {
      // In production, this would insert into a dedicated logging table
      const supabase = createClient()
      const { error } = await supabase
        .from('model_selection_logs')
        .insert(
          logsToFlush.map(log => ({
            user_id: log.userId,
            document_id: log.documentId,
            selected_model: log.selectedModel,
            user_tier: log.userTier,
            document_type: log.documentType,
            document_complexity: log.documentComplexity,
            processing_priority: log.processingPriority,
            selection_reason: log.selectionReason,
            alternative_models: log.alternativeModels,
            experiment_group: log.experimentGroup,
            success: log.success,
            response_time: log.responseTime,
            tokens_used: log.tokensUsed,
            cost: log.cost,
            error: log.error,
            created_at: log.timestamp.toISOString()
          }))
        )

      if (error) {
        console.error('Failed to log model selection:', error)
        // Re-add logs to batch for retry
        this.batchedLogs.unshift(...logsToFlush)
      }
    } catch (error) {
      console.error('Error flushing model selection logs:', error)
      // Re-add logs to batch for retry
      this.batchedLogs.unshift(...logsToFlush)
    }
  }

  static async getSelectionHistory(
    userId: string,
    limit = 100
  ): Promise<SelectionLogEntry[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('model_selection_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching selection history:', error)
      return []
    }

    return data.map(row => ({
      id: row.id,
      timestamp: new Date(row.created_at),
      userId: row.user_id,
      documentId: row.document_id,
      selectedModel: row.selected_model,
      userTier: row.user_tier,
      documentType: row.document_type,
      documentComplexity: row.document_complexity,
      processingPriority: row.processing_priority,
      selectionReason: row.selection_reason,
      alternativeModels: row.alternative_models || [],
      experimentGroup: row.experiment_group,
      success: row.success,
      responseTime: row.response_time,
      tokensUsed: row.tokens_used,
      cost: row.cost,
      error: row.error
    }))
  }

  static async getModelPerformanceStats(
    model: AIModel,
    days = 7
  ): Promise<{
    totalRequests: number
    successRate: number
    averageResponseTime: number
    averageCost: number
    userTierBreakdown: Record<UserTier, number>
  }> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('model_selection_logs')
      .select('*')
      .eq('selected_model', model)
      .gte('created_at', startDate.toISOString())

    if (error || !data) {
      console.error('Error fetching model performance stats:', error)
      return {
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0,
        averageCost: 0,
        userTierBreakdown: {} as Record<UserTier, number>
      }
    }

    const totalRequests = data.length
    const successfulRequests = data.filter(r => r.success).length
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0

    const avgResponseTime = data
      .filter(r => r.response_time)
      .reduce((sum, r) => sum + r.response_time, 0) / (data.filter(r => r.response_time).length || 1)

    const avgCost = data
      .filter(r => r.cost)
      .reduce((sum, r) => sum + r.cost, 0) / (data.filter(r => r.cost).length || 1)

    const tierBreakdown = data.reduce((acc, r) => {
      acc[r.user_tier as UserTier] = (acc[r.user_tier as UserTier] || 0) + 1
      return acc
    }, {} as Record<UserTier, number>)

    return {
      totalRequests,
      successRate,
      averageResponseTime: avgResponseTime,
      averageCost: avgCost,
      userTierBreakdown: tierBreakdown
    }
  }
}