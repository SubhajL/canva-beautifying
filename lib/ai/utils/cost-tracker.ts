import { AIModel, CostTracking } from '../types'
import { createClient } from '@/lib/supabase/client'

export class CostTracker {
  private pendingCosts: CostTracking[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private supabase = createClient()

  constructor() {
    // Flush costs to database every 30 seconds
    this.startAutoFlush()
  }

  async trackUsage(
    model: AIModel,
    userId: string,
    documentId: string,
    tokens: number,
    cost: number
  ): Promise<void> {
    const tracking: CostTracking = {
      model,
      timestamp: new Date(),
      tokens,
      cost,
      userId,
      documentId
    }

    this.pendingCosts.push(tracking)

    // Flush immediately if we have too many pending
    if (this.pendingCosts.length >= 100) {
      await this.flush()
    }
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(async () => {
      if (this.pendingCosts.length > 0) {
        await this.flush()
      }
    }, 30000) // 30 seconds
  }

  async flush(): Promise<void> {
    if (this.pendingCosts.length === 0) return

    const costsToFlush = [...this.pendingCosts]
    this.pendingCosts = []

    try {
      // Insert cost tracking records
      const { error } = await this.supabase
        .from('ai_usage_tracking')
        .insert(
          costsToFlush.map(cost => ({
            model: cost.model,
            user_id: cost.userId,
            document_id: cost.documentId,
            tokens_used: cost.tokens,
            cost: cost.cost,
            created_at: cost.timestamp.toISOString()
          }))
        )

      if (error) {
        console.error('Failed to flush cost tracking:', error)
        // Re-add failed costs back to pending
        this.pendingCosts.unshift(...costsToFlush)
      }
    } catch (error) {
      console.error('Error flushing cost tracking:', error)
      // Re-add failed costs back to pending
      this.pendingCosts.unshift(...costsToFlush)
    }
  }

  async getUserUsage(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCost: number
    totalTokens: number
    byModel: Record<AIModel, { cost: number; tokens: number; count: number }>
  }> {
    let query = this.supabase
      .from('ai_usage_tracking')
      .select('*')
      .eq('user_id', userId)

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to get user usage:', error)
      return {
        totalCost: 0,
        totalTokens: 0,
        byModel: {} as Record<AIModel, { cost: number; tokens: number; count: number }>
      }
    }

    let totalCost = 0
    let totalTokens = 0
    const byModel: Record<string, { cost: number; tokens: number; count: number }> = {}

    for (const record of data || []) {
      totalCost += record.cost
      totalTokens += record.tokens_used

      if (!byModel[record.model]) {
        byModel[record.model] = { cost: 0, tokens: 0, count: 0 }
      }
      byModel[record.model].cost += record.cost
      byModel[record.model].tokens += record.tokens_used
      byModel[record.model].count += 1
    }

    return {
      totalCost,
      totalTokens,
      byModel
    }
  }

  async getDocumentCost(documentId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('ai_usage_tracking')
      .select('cost')
      .eq('document_id', documentId)

    if (error) {
      console.error('Failed to get document cost:', error)
      return 0
    }

    return data?.reduce((sum, record) => sum + record.cost, 0) || 0
  }

  // Get cost statistics for reporting
  async getCostStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number
    totalDocuments: number
    averageCostPerDocument: number
    modelBreakdown: Record<AIModel, {
      cost: number
      percentage: number
      documentsProcessed: number
    }>
  }> {
    const { data, error } = await this.supabase
      .from('ai_usage_tracking')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (error) {
      console.error('Failed to get cost statistics:', error)
      return {
        totalCost: 0,
        totalDocuments: 0,
        averageCostPerDocument: 0,
        modelBreakdown: {} as Record<AIModel, { cost: number; percentage: number; documentsProcessed: number }>
      }
    }

    const uniqueDocuments = new Set<string>()
    const modelStats: Record<string, {
      cost: number
      documents: Set<string>
    }> = {}

    let totalCost = 0

    for (const record of data || []) {
      totalCost += record.cost
      uniqueDocuments.add(record.document_id)

      if (!modelStats[record.model]) {
        modelStats[record.model] = {
          cost: 0,
          documents: new Set()
        }
      }
      modelStats[record.model].cost += record.cost
      modelStats[record.model].documents.add(record.document_id)
    }

    const totalDocuments = uniqueDocuments.size
    const modelBreakdown: Record<string, {
      cost: number
      percentage: number
      documentsProcessed: number
    }> = {}

    for (const [model, stats] of Object.entries(modelStats)) {
      modelBreakdown[model] = {
        cost: stats.cost,
        percentage: (stats.cost / totalCost) * 100,
        documentsProcessed: stats.documents.size
      }
    }

    return {
      totalCost,
      totalDocuments,
      averageCostPerDocument: totalDocuments > 0 ? totalCost / totalDocuments : 0,
      modelBreakdown
    }
  }

  // Clean up on shutdown
  async destroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flush()
  }
}

// Singleton instance
export const costTracker = new CostTracker()