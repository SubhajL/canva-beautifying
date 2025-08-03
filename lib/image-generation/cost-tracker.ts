import { createClient } from '@/lib/supabase/server'

export interface UsageRecord {
  userId: string
  model: 'stable-diffusion-xl' | 'dall-e-3'
  cost: number
  prompt: string
  size: string
  timestamp: Date
  success: boolean
}

export class CostTracker {
  private pendingRecords: UsageRecord[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private readonly flushThreshold = 10 // Flush after 10 records
  private readonly flushIntervalMs = 60000 // Flush every minute

  constructor() {
    this.startPeriodicFlush()
  }

  async trackUsage(record: UsageRecord): Promise<void> {
    this.pendingRecords.push(record)
    
    // Flush if threshold reached
    if (this.pendingRecords.length >= this.flushThreshold) {
      await this.flush()
    }
  }

  async getUserUsage(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<{
    totalCost: number
    imageCount: number
    modelBreakdown: Record<string, { count: number; cost: number }>
    dailyUsage: Array<{ date: string; cost: number; count: number }>
  }> {
    const supabase = await createClient()
    
    let query = supabase
      .from('ai_usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('feature', 'image_generation')
    
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString())
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString())
    }
    
    const { data: usage } = await query
    
    if (!usage || usage.length === 0) {
      return {
        totalCost: 0,
        imageCount: 0,
        modelBreakdown: {},
        dailyUsage: []
      }
    }
    
    // Calculate metrics
    let totalCost = 0
    const modelBreakdown: Record<string, { count: number; cost: number }> = {}
    const dailyMap = new Map<string, { cost: number; count: number }>()
    
    for (const record of usage) {
      const cost = record.cost || 0
      totalCost += cost
      
      // Model breakdown
      const model = record.model_used
      if (!modelBreakdown[model]) {
        modelBreakdown[model] = { count: 0, cost: 0 }
      }
      modelBreakdown[model].count++
      modelBreakdown[model].cost += cost
      
      // Daily usage
      const date = new Date(record.created_at).toISOString().split('T')[0]
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { cost: 0, count: 0 })
      }
      const daily = dailyMap.get(date)!
      daily.cost += cost
      daily.count++
    }
    
    // Convert daily map to array
    const dailyUsage = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date))
    
    return {
      totalCost,
      imageCount: usage.length,
      modelBreakdown,
      dailyUsage
    }
  }

  async getUserCredits(userId: string): Promise<{
    remaining: number
    used: number
    limit: number
  }> {
    const supabase = await createClient()
    
    // Get user's subscription tier
    const { data: user } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single()
    
    const tier = user?.subscription_tier || 'free'
    
    // Define credit limits by tier
    const creditLimits: Record<string, number> = {
      free: 5.00,     // $5 worth of generations
      basic: 25.00,   // $25 worth
      pro: 100.00,    // $100 worth
      premium: -1     // Unlimited
    }
    
    const limit = creditLimits[tier] || 5.00
    
    // Get current month usage
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    
    const usage = await this.getUserUsage(userId, startOfMonth)
    const used = usage.totalCost
    
    return {
      remaining: limit === -1 ? Infinity : Math.max(0, limit - used),
      used,
      limit: limit === -1 ? Infinity : limit
    }
  }

  private async flush(): Promise<void> {
    if (this.pendingRecords.length === 0) return
    
    const recordsToFlush = [...this.pendingRecords]
    this.pendingRecords = []
    
    try {
      const supabase = await createClient()
      
      const aiUsageRecords = recordsToFlush.map(record => ({
        user_id: record.userId,
        feature: 'image_generation',
        model_used: record.model,
        prompt: record.prompt,
        response: {
          size: record.size,
          success: record.success
        },
        tokens_used: 0, // Not applicable for image generation
        cost: record.cost,
        created_at: record.timestamp.toISOString()
      }))
      
      await supabase
        .from('ai_usage_tracking')
        .insert(aiUsageRecords)
      
    } catch (error) {
      console.error('Failed to flush usage records:', error)
      // Re-add failed records to pending
      this.pendingRecords.unshift(...recordsToFlush)
    }
  }

  private startPeriodicFlush() {
    this.flushInterval = setInterval(() => {
      this.flush().catch(console.error)
    }, this.flushIntervalMs)
  }

  async shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    await this.flush()
  }

  async getModelCostComparison(): Promise<{
    models: Array<{
      name: string
      avgCostPerImage: number
      totalImages: number
      totalCost: number
    }>
  }> {
    const supabase = await createClient()
    
    const { data: usage } = await supabase
      .from('ai_usage_tracking')
      .select('model_used, cost')
      .eq('feature', 'image_generation')
    
    if (!usage || usage.length === 0) {
      return { models: [] }
    }
    
    const modelStats = new Map<string, { count: number; totalCost: number }>()
    
    for (const record of usage) {
      const model = record.model_used
      if (!modelStats.has(model)) {
        modelStats.set(model, { count: 0, totalCost: 0 })
      }
      const stats = modelStats.get(model)!
      stats.count++
      stats.totalCost += record.cost || 0
    }
    
    const models = Array.from(modelStats.entries()).map(([name, stats]) => ({
      name,
      avgCostPerImage: stats.totalCost / stats.count,
      totalImages: stats.count,
      totalCost: stats.totalCost
    }))
    
    return { models }
  }
}