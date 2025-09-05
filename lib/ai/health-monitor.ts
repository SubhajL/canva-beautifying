import { EventEmitter } from 'events'
import { AIService } from './ai-service'
import { performance } from 'perf_hooks'

export interface HealthMetrics {
  provider: string
  healthy: boolean
  latency: number
  errorRate: number
  lastCheck: Date
  consecutiveFailures: number
}

export interface HealthMonitorConfig {
  aiService: AIService
  checkInterval: number
  timeout: number
  healthThreshold: number
  events: EventEmitter
}

export interface SystemStatus {
  healthy: boolean
  availableProviders: string[]
  degradedProviders: string[]
  failedProviders: string[]
}

export interface HealthTrend {
  dataPoints: Array<{ timestamp: number; health: number }>
  trend: 'improving' | 'stable' | 'degrading'
  providerTrends: Record<string, 'improving' | 'stable' | 'degrading'>
}

export class AIHealthMonitor {
  private config: HealthMonitorConfig
  private healthMetrics: Map<string, HealthMetrics> = new Map()
  private healthHistory: Map<string, Array<{ timestamp: number; health: number }>> = new Map()
  private checkTimer?: NodeJS.Timeout
  private providerWeights: Map<string, number> = new Map()
  
  constructor(config: HealthMonitorConfig) {
    this.config = config
    this.initializeProviders()
  }
  
  private initializeProviders(): void {
    const providers = ['gemini', 'openai', 'claude']
    providers.forEach(provider => {
      this.healthMetrics.set(provider, {
        provider,
        healthy: true,
        latency: 0,
        errorRate: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0
      })
      this.providerWeights.set(provider, 1 / providers.length)
      this.healthHistory.set(provider, [])
    })
  }
  
  async checkProviderHealth(provider: string): Promise<HealthMetrics> {
    const startTime = performance.now()
    const healthy = true
    const errorRate = 0
    
    try {
      // Simulate health check with simple request
      const testPromise = this.config.aiService.analyzeDocument({
        imageUrl: 'https://health-check.example.com/test.png',
        documentType: 'worksheet',
        userId: 'health-check',
        tier: 'pro'
      })
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
      })
      
      await Promise.race([testPromise, timeoutPromise])
      
      const latency = performance.now() - startTime
      
      // Update metrics
      const currentMetrics = this.healthMetrics.get(provider) || this.createDefaultMetrics(provider)
      
      currentMetrics.latency = latency
      currentMetrics.healthy = latency < 2000 // Unhealthy if > 2s
      currentMetrics.errorRate = 0
      currentMetrics.consecutiveFailures = 0
      currentMetrics.lastCheck = new Date()
      
      this.healthMetrics.set(provider, currentMetrics)
      this.recordHealthHistory(provider, 1.0)
      
      return currentMetrics
    } catch (error) {
      const latency = performance.now() - startTime
      const currentMetrics = this.healthMetrics.get(provider) || this.createDefaultMetrics(provider)
      
      currentMetrics.latency = latency
      currentMetrics.healthy = false
      currentMetrics.errorRate = 1
      currentMetrics.consecutiveFailures++
      currentMetrics.lastCheck = new Date()
      
      this.healthMetrics.set(provider, currentMetrics)
      this.recordHealthHistory(provider, 0.0)
      
      return currentMetrics
    }
  }
  
  private createDefaultMetrics(provider: string): HealthMetrics {
    return {
      provider,
      healthy: true,
      latency: 0,
      errorRate: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0
    }
  }
  
  private recordHealthHistory(provider: string, healthScore: number): void {
    const history = this.healthHistory.get(provider) || []
    history.push({ timestamp: Date.now(), health: healthScore })
    
    // Keep only last hour of data
    const oneHourAgo = Date.now() - 3600000
    const filtered = history.filter(h => h.timestamp > oneHourAgo)
    
    this.healthHistory.set(provider, filtered)
  }
  
  start(): void {
    this.checkTimer = setInterval(async () => {
      await this.updateAllProviderHealth()
    }, this.config.checkInterval)
    
    // Initial check
    this.updateAllProviderHealth()
  }
  
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = undefined
    }
  }
  
  async updateAllProviderHealth(): Promise<void> {
    const providers = ['gemini', 'openai', 'claude']
    
    const healthChecks = await Promise.allSettled(
      providers.map(provider => this.checkProviderHealth(provider))
    )
    
    // Update weights based on health
    this.updateProviderWeights()
    
    // Emit health status
    healthChecks.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.config.events.emit('health-check', result.value)
        
        // Check for sustained failures
        if (result.value.consecutiveFailures >= 3) {
          this.config.events.emit('health-alert', {
            severity: 'critical',
            provider: providers[index],
            message: `Provider ${providers[index]} has failed ${result.value.consecutiveFailures} times consecutively`
          })
        }
      }
    })
    
    // Emit traffic weight updates
    const weights: Record<string, number> = {}
    this.providerWeights.forEach((weight, provider) => {
      weights[provider] = weight
    })
    this.config.events.emit('traffic-weight-update', weights)
  }
  
  private updateProviderWeights(): void {
    const providers = ['gemini', 'openai', 'claude']
    let totalHealthScore = 0
    const healthScores: Map<string, number> = new Map()
    
    // Calculate health scores
    providers.forEach(provider => {
      const metrics = this.healthMetrics.get(provider)
      if (metrics) {
        const score = metrics.healthy ? (1 - metrics.errorRate) * (1 - Math.min(metrics.latency / 5000, 1)) : 0.05
        healthScores.set(provider, score)
        totalHealthScore += score
      }
    })
    
    // Normalize weights
    if (totalHealthScore > 0) {
      providers.forEach(provider => {
        const score = healthScores.get(provider) || 0
        this.providerWeights.set(provider, score / totalHealthScore)
      })
    } else {
      // All unhealthy - equal weights
      providers.forEach(provider => {
        this.providerWeights.set(provider, 1 / providers.length)
      })
    }
  }
  
  async getProviderWeights(): Promise<Record<string, number>> {
    const weights: Record<string, number> = {}
    this.providerWeights.forEach((weight, provider) => {
      weights[provider] = weight
    })
    return weights
  }
  
  getSystemStatus(): SystemStatus {
    const availableProviders: string[] = []
    const degradedProviders: string[] = []
    const failedProviders: string[] = []
    
    this.healthMetrics.forEach((metrics, provider) => {
      if (metrics.healthy && metrics.errorRate < 0.1) {
        availableProviders.push(provider)
      } else if (metrics.healthy || metrics.errorRate < 0.5) {
        degradedProviders.push(provider)
      } else {
        failedProviders.push(provider)
      }
    })
    
    return {
      healthy: availableProviders.length > 0,
      availableProviders,
      degradedProviders,
      failedProviders
    }
  }
  
  getSystemHealthScore(): number {
    let totalScore = 0
    let providerCount = 0
    
    this.healthMetrics.forEach(metrics => {
      const score = metrics.healthy ? 
        (1 - metrics.errorRate) * (1 - Math.min(metrics.latency / 5000, 1)) : 0
      totalScore += score
      providerCount++
    })
    
    return providerCount > 0 ? totalScore / providerCount : 0
  }
  
  getHealthTrends(period: '1h' | '24h' | '7d' = '1h'): HealthTrend {
    const periodMs = period === '1h' ? 3600000 : period === '24h' ? 86400000 : 604800000
    const cutoff = Date.now() - periodMs
    
    const aggregatedData: Array<{ timestamp: number; health: number }> = []
    const providerTrends: Record<string, 'improving' | 'stable' | 'degrading'> = {}
    
    this.healthHistory.forEach((history, provider) => {
      const recentHistory = history.filter(h => h.timestamp > cutoff)
      
      if (recentHistory.length >= 2) {
        const trend = this.calculateTrend(recentHistory)
        providerTrends[provider] = trend
      } else {
        providerTrends[provider] = 'stable'
      }
      
      // Add to aggregated data
      recentHistory.forEach(point => {
        const existing = aggregatedData.find(p => Math.abs(p.timestamp - point.timestamp) < 60000)
        if (existing) {
          existing.health = (existing.health + point.health) / 2
        } else {
          aggregatedData.push({ ...point })
        }
      })
    })
    
    // Sort by timestamp
    aggregatedData.sort((a, b) => a.timestamp - b.timestamp)
    
    // Calculate overall trend
    const overallTrend = this.calculateTrend(aggregatedData)
    
    return {
      dataPoints: aggregatedData,
      trend: overallTrend,
      providerTrends
    }
  }
  
  private calculateTrend(dataPoints: Array<{ timestamp: number; health: number }>): 'improving' | 'stable' | 'degrading' {
    if (dataPoints.length < 2) return 'stable'
    
    // Simple linear regression
    const n = dataPoints.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    
    dataPoints.forEach((point, i) => {
      sumX += i
      sumY += point.health
      sumXY += i * point.health
      sumX2 += i * i
    })
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    
    if (slope > 0.01) return 'improving'
    if (slope < -0.01) return 'degrading'
    return 'stable'
  }
}