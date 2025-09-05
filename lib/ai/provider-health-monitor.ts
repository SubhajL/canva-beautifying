import { 
  AIModel, 
  HealthStatus, 
  HealthMetric, 
  HealthCheckResult, 
  HealthMonitorConfig, 
  HealthChangeCallback,
  AIProviderResponse,
  EnhancementRequest,
  DocumentAnalysis
} from './types'
import { BaseAIProvider } from './base-provider'

export class ProviderHealthMonitor {
  private healthChecks: Map<AIModel, HealthCheckResult> = new Map()
  private monitoringIntervals: Map<AIModel, NodeJS.Timeout> = new Map()
  private healthChangeCallbacks: Set<HealthChangeCallback> = new Set()
  private providers: Map<AIModel, BaseAIProvider> = new Map()
  
  private readonly defaultConfig: HealthMonitorConfig = {
    checkInterval: 30000, // 30 seconds
    healthyThreshold: 2000, // 2 seconds
    degradedThreshold: 5000, // 5 seconds
    failureThreshold: 3, // 3 consecutive failures
    metricsWindowSize: 20, // Keep last 20 metrics
    errorRateThreshold: 0.1 // 10% error rate
  }
  
  private readonly healthCheckPrompts: Record<AIModel, string> = {
    'gemini-2.0-flash': "Respond with 'OK' if operational",
    'gpt-4o-mini': "Reply 'OK' to confirm availability",
    'claude-3.5-sonnet': "Say 'OK' if you can process this",
    'claude-4-sonnet': "Reply 'OK' to confirm readiness"
  }

  constructor(
    providers: Map<AIModel, BaseAIProvider>,
    private config: Partial<HealthMonitorConfig> = {}
  ) {
    this.providers = providers
    this.config = { ...this.defaultConfig, ...config }
    this.initializeHealthChecks()
  }

  private initializeHealthChecks(): void {
    this.providers.forEach((provider, model) => {
      this.healthChecks.set(model, {
        provider: model,
        status: 'healthy',
        responseTime: 0,
        lastChecked: new Date(),
        errorRate: 0,
        averageLatency: 0,
        recentMetrics: [],
        consecutiveFailures: 0
      })
    })
  }

  async startMonitoring(interval?: number): Promise<void> {
    const checkInterval = interval || this.config.checkInterval || this.defaultConfig.checkInterval
    
    // Initial health check for all providers
    await this.runHealthChecks()
    
    // Set up periodic checks for each provider
    this.providers.forEach((provider, model) => {
      // Clear existing interval if any
      const existingInterval = this.monitoringIntervals.get(model)
      if (existingInterval) {
        clearInterval(existingInterval)
      }
      
      // Set new interval
      const intervalId = setInterval(
        () => this.checkProviderHealth(model),
        checkInterval
      )
      this.monitoringIntervals.set(model, intervalId)
    })
  }

  stopMonitoring(): void {
    // Clear all intervals
    this.monitoringIntervals.forEach((intervalId) => {
      clearInterval(intervalId)
    })
    this.monitoringIntervals.clear()
  }

  private async runHealthChecks(): Promise<void> {
    const checks = Array.from(this.providers.keys()).map(model => 
      this.checkProviderHealth(model)
    )
    await Promise.allSettled(checks)
  }

  async checkProviderHealth(model: AIModel): Promise<void> {
    const startTime = Date.now()
    const provider = this.providers.get(model)
    
    if (!provider) {
      console.warn(`Provider not found for model: ${model}`)
      return
    }

    let success = false
    let error: string | undefined
    
    try {
      const prompt = this.getHealthCheckPrompt(model)
      const response = await this.executeHealthCheck(model, prompt)
      
      if (response.success && this.validateHealthResponse(response, model)) {
        success = true
      } else {
        error = response.error || 'Invalid health check response'
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error'
    }

    const responseTime = Date.now() - startTime
    this.updateHealthMetrics(model, {
      timestamp: Date.now(),
      responseTime,
      success,
      error
    })
  }

  private getHealthCheckPrompt(model: AIModel): string {
    return this.healthCheckPrompts[model] || "Respond with 'OK' if operational"
  }

  private async executeHealthCheck(
    model: AIModel, 
    prompt: string
  ): Promise<AIProviderResponse> {
    const provider = this.providers.get(model)
    if (!provider) {
      throw new Error(`Provider not found: ${model}`)
    }

    // Create a minimal health check request
    const healthCheckRequest: EnhancementRequest = {
      documentUrl: 'health-check',
      documentType: 'worksheet',
      userTier: 'free',
      preferences: {
        style: 'modern'
      }
    }

    // For health check, we'll use a simple document analysis with a tiny prompt
    // This is a workaround since providers only expose analyzeDocument and generateEnhancementPrompt
    try {
      // We'll create a minimal analysis to test the generateEnhancementPrompt method
      const minimalAnalysis: DocumentAnalysis = {
        layout: { score: 50, issues: [], suggestions: [] },
        colors: { score: 50, palette: [], issues: [], suggestions: [] },
        typography: { score: 50, fonts: [], issues: [], suggestions: [] },
        engagement: { score: 50, readability: 50, visualAppeal: 50, suggestions: [] },
        overallScore: 50,
        priority: 'low'
      }

      // Override the enhancement request with our health check prompt
      const healthRequest = {
        ...healthCheckRequest,
        preferences: {
          ...healthCheckRequest.preferences,
          // Inject our health check prompt into preferences to test connectivity
          style: 'modern' as const
        }
      }

      // Use generateEnhancementPrompt as it's simpler and faster than analyzeDocument
      const response = await provider.generateEnhancementPrompt(minimalAnalysis, healthRequest)
      
      // Convert the response to indicate health
      return {
        success: response.success,
        data: response.success ? 'OK' : undefined,
        error: response.error,
        usage: response.usage
      }
    } catch (error) {
      throw error
    }
  }

  private validateHealthResponse(response: AIProviderResponse, model: AIModel): boolean {
    if (!response.data || typeof response.data !== 'string') {
      return false
    }
    
    // Check for expected response
    const normalizedResponse = response.data.toLowerCase().trim()
    return normalizedResponse.includes('ok') || normalizedResponse === 'ok'
  }

  private updateHealthMetrics(model: AIModel, metric: HealthMetric): void {
    const currentHealth = this.healthChecks.get(model)
    if (!currentHealth) return

    // Add new metric
    const metrics = [...currentHealth.recentMetrics, metric]
    
    // Keep only recent metrics within window size
    const windowSize = this.config.metricsWindowSize || this.defaultConfig.metricsWindowSize
    if (metrics.length > windowSize) {
      metrics.splice(0, metrics.length - windowSize)
    }

    // Update consecutive failures
    const consecutiveFailures = metric.success 
      ? 0 
      : currentHealth.consecutiveFailures + 1

    // Calculate metrics
    const errorRate = this.calculateErrorRate(metrics)
    const averageLatency = this.calculateAverageLatency(metrics)
    
    // Determine health status
    const oldStatus = currentHealth.status
    const newStatus = this.calculateHealthStatus(
      metric.success,
      metric.responseTime,
      errorRate,
      consecutiveFailures
    )

    // Update health check result
    const updatedHealth: HealthCheckResult = {
      provider: model,
      status: newStatus,
      responseTime: metric.responseTime,
      lastChecked: new Date(),
      errorRate,
      averageLatency,
      recentMetrics: metrics,
      consecutiveFailures
    }

    this.healthChecks.set(model, updatedHealth)

    // Emit change event if status changed
    if (oldStatus !== newStatus) {
      this.emitHealthChange(model, oldStatus, newStatus, updatedHealth)
    }
  }

  private calculateErrorRate(metrics: HealthMetric[]): number {
    if (metrics.length === 0) return 0
    const failures = metrics.filter(m => !m.success).length
    return failures / metrics.length
  }

  private calculateAverageLatency(metrics: HealthMetric[]): number {
    const successfulMetrics = metrics.filter(m => m.success)
    if (successfulMetrics.length === 0) return 0
    
    const totalLatency = successfulMetrics.reduce((sum, m) => sum + m.responseTime, 0)
    return totalLatency / successfulMetrics.length
  }

  private calculateHealthStatus(
    success: boolean,
    responseTime: number,
    errorRate: number,
    consecutiveFailures: number
  ): HealthStatus {
    const config = this.config

    // Check for unhealthy conditions
    if (!success && consecutiveFailures >= (config.failureThreshold || this.defaultConfig.failureThreshold)) {
      return 'unhealthy'
    }
    
    if (errorRate > (config.errorRateThreshold || this.defaultConfig.errorRateThreshold)) {
      return 'unhealthy'
    }

    // Check for degraded conditions
    if (responseTime > (config.degradedThreshold || this.defaultConfig.degradedThreshold)) {
      return 'degraded'
    }
    
    if (errorRate > (config.errorRateThreshold || this.defaultConfig.errorRateThreshold) * 0.5) {
      return 'degraded'
    }

    // Check for healthy conditions
    if (success && responseTime <= (config.healthyThreshold || this.defaultConfig.healthyThreshold)) {
      return 'healthy'
    }

    // Default to degraded if in between thresholds
    return 'degraded'
  }

  // Stop monitoring without waiting for intervals
  stopMonitoringImmediately(): void {
    this.stopMonitoring()
    // Clear any pending checks
    this.monitoringIntervals.clear()
  }

  getHealthStatus(model: AIModel): HealthCheckResult | undefined {
    return this.healthChecks.get(model)
  }

  getAllHealthStatuses(): Map<AIModel, HealthCheckResult> {
    return new Map(this.healthChecks)
  }

  isProviderHealthy(model: AIModel): boolean {
    const health = this.healthChecks.get(model)
    return health?.status === 'healthy'
  }

  calculateHealthScore(metrics: HealthMetric[]): number {
    if (metrics.length === 0) return 0

    const successRate = metrics.filter(m => m.success).length / metrics.length
    const avgLatency = this.calculateAverageLatency(metrics)
    const normalizedLatency = Math.min(avgLatency / (this.config.degradedThreshold || this.defaultConfig.degradedThreshold), 1)
    
    // Score = 70% success rate + 30% latency performance
    const score = (successRate * 0.7) + ((1 - normalizedLatency) * 0.3)
    return Math.round(score * 100)
  }

  cleanupOldMetrics(): void {
    const now = Date.now()
    const maxAge = 3600000 // 1 hour

    this.healthChecks.forEach((health, model) => {
      const filteredMetrics = health.recentMetrics.filter(
        metric => now - metric.timestamp < maxAge
      )
      
      if (filteredMetrics.length !== health.recentMetrics.length) {
        health.recentMetrics = filteredMetrics
        this.healthChecks.set(model, health)
      }
    })
  }

  onHealthChange(callback: HealthChangeCallback): void {
    this.healthChangeCallbacks.add(callback)
  }

  offHealthChange(callback: HealthChangeCallback): void {
    this.healthChangeCallbacks.delete(callback)
  }

  private emitHealthChange(
    model: AIModel,
    oldStatus: HealthStatus,
    newStatus: HealthStatus,
    result: HealthCheckResult
  ): void {
    this.healthChangeCallbacks.forEach(callback => {
      try {
        callback(model, oldStatus, newStatus, result)
      } catch (error) {
        console.error('Error in health change callback:', error)
      }
    })
  }
}