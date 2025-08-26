# Claude Instance 02: AI Service Resilience Specialist

## Role Overview
You are responsible for implementing resilience patterns in the AI service layer to ensure high availability and graceful degradation. Your focus is on circuit breakers, health monitoring, and intelligent fallback mechanisms for all AI providers.

## Core Responsibilities

### 1. Circuit Breaker Implementation

**Current State:**
- File: `lib/ai/ai-service.ts`
- Basic retry logic with exponential backoff
- No circuit breaker pattern
- Failures cascade to users

**Your Implementation:**

1. Create `lib/ai/circuit-breaker.ts`:
```typescript
export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures before opening
  resetTimeout: number          // Time before trying half-open
  monitoringWindow: number      // Time window for failure counting
  halfOpenRequests: number      // Requests to test in half-open state
  volumeThreshold: number       // Minimum requests before evaluation
}

export class CircuitBreaker<T> {
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failures: number = 0
  private lastFailureTime: number = 0
  private successCount: number = 0
  private requestCount: number = 0
  private stateChangeCallbacks: Set<StateChangeCallback> = new Set()
  
  constructor(
    private name: string,
    private config: CircuitBreakerConfig,
    private fallbackFunction?: () => Promise<T>
  ) {}
  
  async execute(operation: () => Promise<T>): Promise<T> {
    // Implementation details below
  }
}
```

2. State Management Logic:
```typescript
private canProceed(): boolean {
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
      return this.requestCount < this.config.halfOpenRequests
  }
}

private recordSuccess(): void {
  this.failures = 0
  this.successCount++
  
  if (this.state === 'half-open' && 
      this.successCount >= this.config.halfOpenRequests) {
    this.transitionTo('closed')
  }
}

private recordFailure(): void {
  this.failures++
  this.lastFailureTime = Date.now()
  
  if (this.failures >= this.config.failureThreshold) {
    this.transitionTo('open')
  }
}
```

3. Integration with AI Service:
```typescript
// In ai-service.ts
private circuitBreakers: Map<AIModel, CircuitBreaker<AIProviderResponse>>

async analyzeDocumentWithCircuitBreaker(
  model: AIModel,
  imageUrl: string,
  request: EnhancementRequest
): Promise<AIProviderResponse> {
  const breaker = this.getOrCreateBreaker(model)
  
  return breaker.execute(async () => {
    const provider = this.providers.get(model)
    return await provider.analyzeDocument(imageUrl, request)
  })
}
```

### 2. Provider Health Monitoring

Create `lib/ai/provider-health-monitor.ts`:

```typescript
export interface HealthCheckResult {
  provider: AIModel
  status: 'healthy' | 'degraded' | 'unhealthy'
  responseTime: number
  lastChecked: Date
  errorRate: number
  averageLatency: number
}

export class ProviderHealthMonitor {
  private healthChecks: Map<AIModel, HealthCheckResult> = new Map()
  private metricsWindow: Map<AIModel, MetricsWindow> = new Map()
  
  async startMonitoring(interval: number = 30000): Promise<void> {
    setInterval(() => this.runHealthChecks(), interval)
  }
  
  private async runHealthChecks(): Promise<void> {
    const providers = this.getActiveProviders()
    
    await Promise.all(
      providers.map(provider => this.checkProviderHealth(provider))
    )
  }
  
  private async checkProviderHealth(model: AIModel): Promise<void> {
    const testPrompt = this.getTestPrompt(model)
    const startTime = Date.now()
    
    try {
      const response = await this.executeHealthCheck(model, testPrompt)
      const responseTime = Date.now() - startTime
      
      this.updateHealthStatus(model, {
        status: this.calculateHealthStatus(responseTime, model),
        responseTime,
        lastChecked: new Date(),
        errorRate: this.calculateErrorRate(model),
        averageLatency: this.calculateAverageLatency(model)
      })
    } catch (error) {
      this.recordHealthCheckFailure(model, error)
    }
  }
}
```

### 3. Intelligent Fallback Strategies

Implement sophisticated fallback logic:

```typescript
export class FallbackStrategy {
  constructor(
    private modelSelector: ModelSelector,
    private healthMonitor: ProviderHealthMonitor
  ) {}
  
  async selectFallbackModel(
    failedModel: AIModel,
    userTier: UserTier,
    documentType: DocumentType,
    previousFailures: AIModel[]
  ): Promise<AIModel | null> {
    const candidates = this.getCandidateModels(userTier, failedModel)
    
    // Filter by health status
    const healthyModels = candidates.filter(model => {
      const health = this.healthMonitor.getHealth(model)
      return health?.status !== 'unhealthy' && 
             !previousFailures.includes(model)
    })
    
    if (healthyModels.length === 0) {
      return null // No fallback available
    }
    
    // Rank by performance and cost
    return this.rankModels(healthyModels, documentType)[0]
  }
  
  private rankModels(
    models: AIModel[], 
    documentType: DocumentType
  ): AIModel[] {
    return models.sort((a, b) => {
      const scoreA = this.calculateScore(a, documentType)
      const scoreB = this.calculateScore(b, documentType)
      return scoreB - scoreA
    })
  }
  
  private calculateScore(
    model: AIModel, 
    documentType: DocumentType
  ): number {
    const health = this.healthMonitor.getHealth(model)
    const performance = this.modelSelector.getPerformanceMetrics(model)
    
    // Weighted scoring
    const healthScore = health.status === 'healthy' ? 1.0 : 0.5
    const latencyScore = 1 - (health.averageLatency / 5000) // Normalize to 5s
    const successScore = 1 - health.errorRate
    const costScore = this.getCostScore(model)
    
    return (
      healthScore * 0.4 +
      latencyScore * 0.3 +
      successScore * 0.2 +
      costScore * 0.1
    )
  }
}
```

### 4. Graceful Degradation Implementation

Create degradation strategies when all providers fail:

```typescript
export class DegradationService {
  async provideBasicAnalysis(
    imageUrl: string,
    documentType: DocumentType
  ): Promise<DocumentAnalysis> {
    // Use local analysis engine as fallback
    const localEngine = new DocumentAnalysisEngine()
    const imageData = await this.fetchImage(imageUrl)
    
    const context: DocumentContext = {
      imageData,
      type: documentType,
      metadata: this.extractMetadata(imageData)
    }
    
    // Provide basic analysis without AI
    return await localEngine.generateCompleteAnalysis(context)
  }
  
  async provideCachedSuggestions(
    documentHash: string,
    preferences: UserPreferences
  ): Promise<Enhancement[] | null> {
    // Check for similar document enhancements
    const cache = new EnhancementCache()
    return await cache.getSimilar(documentHash, preferences)
  }
}
```

## Implementation Guidelines

### Circuit Breaker Configuration

1. **Model-Specific Settings:**
```typescript
const CIRCUIT_BREAKER_CONFIGS: Record<AIModel, CircuitBreakerConfig> = {
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
  }
}
```

2. **Failure Detection:**
- HTTP status codes 500+ = failure
- Timeouts > 30 seconds = failure
- Invalid responses = failure
- Rate limit errors = NOT counted as failure

### Health Check Implementation

1. **Test Prompts:**
```typescript
const HEALTH_CHECK_PROMPTS = {
  simple: "Respond with 'OK' if you can process this request",
  analysis: "Analyze this text: 'Test document for health check'",
  vision: "Describe what you would see in a blank white image"
}
```

2. **Health Metrics:**
- Response time < 2s = healthy
- Response time 2-5s = degraded  
- Response time > 5s = unhealthy
- Error rate > 10% = unhealthy
- Error rate 5-10% = degraded

### Testing Requirements

Create tests in `__tests__/ai/resilience/`:

1. **Circuit Breaker Tests:**
```typescript
describe('CircuitBreaker', () => {
  it('should open after threshold failures', async () => {
    const breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      resetTimeout: 1000
    })
    
    // Simulate failures
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingOperation)).rejects.toThrow()
    }
    
    // Circuit should be open
    await expect(breaker.execute(successOperation)).rejects.toThrow('Circuit breaker is open')
  })
  
  it('should transition to half-open after timeout', async () => {
    // Test half-open behavior
  })
})
```

2. **Health Monitor Tests:**
- Mock provider responses
- Test health status calculations
- Verify monitoring intervals
- Test metric aggregation

3. **Integration Tests:**
- Test failover scenarios
- Verify graceful degradation
- Test recovery patterns

### Coordination with Other Instances

1. **Instance 1 (State Management):**
- Store circuit breaker state in Redis
- Share health metrics via Redis pub/sub
- Coordinate on failure counting

2. **Instance 3 (Caching):**
- Use cache for fallback responses
- Share similarity matching logic
- Coordinate on cache warming

3. **Instance 4 (Observability):**
- Export circuit breaker metrics
- Add tracing for failure paths
- Monitor recovery times

4. **Instance 6 (Testing):**
- Create chaos engineering tests
- Simulate provider failures
- Test degradation scenarios

## Success Criteria

1. **Reliability:**
- 99.9% availability despite provider failures
- < 100ms overhead from circuit breaker
- Automatic recovery within 2 minutes
- Zero cascading failures

2. **Performance:**
- Health checks < 2 second response
- Fallback selection < 50ms
- Circuit state checks < 1ms
- Minimal memory overhead

3. **Observability:**
- Real-time circuit state visibility
- Health status dashboard
- Failure rate tracking
- Recovery time metrics

## Common Pitfalls to Avoid

1. **Don't:**
- Count user errors as failures
- Open circuit too aggressively
- Ignore gradual degradation
- Cache health check results too long

2. **Do:**
- Test with real failure scenarios
- Monitor circuit breaker effectiveness
- Adjust thresholds based on data
- Document failure scenarios

## Daily Workflow

1. **Morning:**
- Review overnight circuit breaker events
- Check provider health status
- Analyze failure patterns

2. **Development:**
- Implement features with tests
- Run failure injection tests
- Monitor local circuit behavior

3. **End of Day:**
- Update health check configurations
- Document new failure modes
- Sync with Instance 1 on state storage

## Advanced Patterns to Implement

1. **Adaptive Thresholds:**
```typescript
class AdaptiveCircuitBreaker extends CircuitBreaker {
  adjustThresholds(metrics: PerformanceMetrics): void {
    if (metrics.errorRate > 0.2) {
      this.config.failureThreshold = Math.max(2, this.config.failureThreshold - 1)
    } else if (metrics.errorRate < 0.05) {
      this.config.failureThreshold = Math.min(10, this.config.failureThreshold + 1)
    }
  }
}
```

2. **Bulkhead Pattern:**
```typescript
class BulkheadExecutor {
  private semaphore: Semaphore
  
  constructor(private maxConcurrent: number) {
    this.semaphore = new Semaphore(maxConcurrent)
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.semaphore.acquire()
    try {
      return await operation()
    } finally {
      this.semaphore.release()
    }
  }
}
```

Remember: Your resilience patterns are the safety net for the entire AI service. Make them robust!