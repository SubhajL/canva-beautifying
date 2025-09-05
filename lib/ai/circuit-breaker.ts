export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures before opening
  resetTimeout: number          // Time before trying half-open (ms)
  monitoringWindow: number      // Time window for failure counting (ms)
  halfOpenRequests: number      // Requests to test in half-open state
  volumeThreshold: number       // Minimum requests before evaluation
}

export interface CircuitBreakerMetrics {
  state: CircuitState
  failures: number
  successes: number
  requestsInWindow: number
  lastFailureTime: number | null
  lastStateChange: number
  errorRate: number
}

export type StateChangeCallback = (
  name: string,
  oldState: CircuitState,
  newState: CircuitState,
  metrics: CircuitBreakerMetrics
) => void

export class CircuitBreaker<T> {
  private state: CircuitState = 'closed'
  private failures: number = 0
  private lastFailureTime: number = 0
  private successCount: number = 0
  private requestCount: number = 0
  private halfOpenAttempts: number = 0
  private requestTimestamps: number[] = []
  private lastStateChangeTime: number = Date.now()
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set()
  
  constructor(
    private name: string,
    private config: CircuitBreakerConfig,
    private fallbackFunction?: () => Promise<T>
  ) {}
  
  async execute(operation: () => Promise<T>): Promise<T> {
    if (!this.canProceed()) {
      if (this.fallbackFunction) {
        return await this.fallbackFunction()
      }
      throw new Error(`Circuit breaker is ${this.state} for ${this.name}`)
    }
    
    const startTime = Date.now()
    this.recordRequest(startTime)
    
    try {
      const result = await operation()
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure(error)
      throw error
    }
  }
  
  private canProceed(): boolean {
    this.cleanupOldRequests()
    
    switch (this.state) {
      case 'closed':
        return true
        
      case 'open':
        if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
          this.transitionTo('half-open')
          return true
        }
        return false
        
      case 'half-open':
        return this.halfOpenAttempts < this.config.halfOpenRequests
    }
  }
  
  private recordRequest(timestamp: number): void {
    this.requestTimestamps.push(timestamp)
    this.requestCount++
    
    if (this.state === 'half-open') {
      this.halfOpenAttempts++
    }
  }
  
  private recordSuccess(): void {
    this.failures = 0
    this.successCount++
    
    if (this.state === 'half-open' && 
        this.halfOpenAttempts >= this.config.halfOpenRequests) {
      this.transitionTo('closed')
    }
  }
  
  private recordFailure(error: any): void {
    // Don't count rate limit errors as circuit breaker failures
    if (this.isRateLimitError(error)) {
      return
    }
    
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.state === 'half-open') {
      this.transitionTo('open')
    } else if (this.state === 'closed' && 
               this.shouldOpenCircuit()) {
      this.transitionTo('open')
    }
  }
  
  private shouldOpenCircuit(): boolean {
    // Need minimum volume of requests
    const recentRequests = this.getRecentRequestCount()
    if (recentRequests < this.config.volumeThreshold) {
      return false
    }
    
    // Check if we've exceeded failure threshold
    return this.failures >= this.config.failureThreshold
  }
  
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state
    this.state = newState
    this.lastStateChangeTime = Date.now()
    
    // Reset counters based on new state
    if (newState === 'closed') {
      this.failures = 0
      this.halfOpenAttempts = 0
    } else if (newState === 'half-open') {
      this.halfOpenAttempts = 0
    }
    
    // Notify callbacks
    const metrics = this.getMetrics()
    this.stateChangeCallbacks.forEach(callback => {
      callback(this.name, oldState, newState, metrics)
    })
  }
  
  private cleanupOldRequests(): void {
    const cutoff = Date.now() - this.config.monitoringWindow
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > cutoff)
  }
  
  private getRecentRequestCount(): number {
    this.cleanupOldRequests()
    return this.requestTimestamps.length
  }
  
  private isRateLimitError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('rate limit') || 
             message.includes('429') ||
             message.includes('too many requests')
    }
    return false
  }
  
  getMetrics(): CircuitBreakerMetrics {
    this.cleanupOldRequests()
    const recentRequests = this.requestTimestamps.length
    
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successCount,
      requestsInWindow: recentRequests,
      lastFailureTime: this.lastFailureTime || null,
      lastStateChange: this.lastStateChangeTime,
      errorRate: recentRequests > 0 ? this.failures / recentRequests : 0
    }
  }
  
  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.add(callback)
  }
  
  offStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.delete(callback)
  }
  
  reset(): void {
    this.state = 'closed'
    this.failures = 0
    this.successCount = 0
    this.requestCount = 0
    this.halfOpenAttempts = 0
    this.requestTimestamps = []
    this.lastFailureTime = 0
    this.lastStateChangeTime = Date.now()
  }
}

// Circuit breaker configurations for different AI models
export const CIRCUIT_BREAKER_CONFIGS: Record<string, CircuitBreakerConfig> = {
  'gemini-2.0-flash': {
    failureThreshold: 5,
    resetTimeout: 30000,      // 30 seconds
    monitoringWindow: 60000,  // 1 minute
    halfOpenRequests: 3,
    volumeThreshold: 10
  },
  'gpt-4o-mini': {
    failureThreshold: 3,
    resetTimeout: 60000,      // 1 minute
    monitoringWindow: 120000, // 2 minutes
    halfOpenRequests: 2,
    volumeThreshold: 5
  },
  'claude-3.5-sonnet': {
    failureThreshold: 3,
    resetTimeout: 45000,      // 45 seconds
    monitoringWindow: 90000,  // 1.5 minutes
    halfOpenRequests: 2,
    volumeThreshold: 5
  },
  'claude-4-sonnet': {
    failureThreshold: 3,
    resetTimeout: 45000,      // 45 seconds
    monitoringWindow: 90000,  // 1.5 minutes
    halfOpenRequests: 2,
    volumeThreshold: 5
  },
  // Default configuration for any unspecified model
  default: {
    failureThreshold: 3,
    resetTimeout: 60000,      // 1 minute
    monitoringWindow: 120000, // 2 minutes
    halfOpenRequests: 2,
    volumeThreshold: 5
  }
}

// Helper to get config for a specific model
export function getCircuitBreakerConfig(model: string): CircuitBreakerConfig {
  return CIRCUIT_BREAKER_CONFIGS[model] || CIRCUIT_BREAKER_CONFIGS.default
}