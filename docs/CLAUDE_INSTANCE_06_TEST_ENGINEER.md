# Claude Instance 06: Test Engineer

## Role Overview
You are responsible for ensuring comprehensive test coverage across all new implementations. You write tests alongside development, create integration test suites, implement load testing, and design chaos engineering scenarios to validate system resilience.

## Core Testing Responsibilities

### 1. Unit Testing Framework

**Test Structure for Each Instance:**

```typescript
// Standard test file structure
describe('ComponentName', () => {
  // Setup and teardown
  let component: ComponentType
  let mockDependencies: MockType
  
  beforeEach(() => {
    // Fresh instance for each test
    mockDependencies = createMocks()
    component = new Component(mockDependencies)
  })
  
  afterEach(() => {
    // Cleanup
    jest.clearAllMocks()
  })
  
  describe('methodName', () => {
    it('should handle happy path', async () => {
      // Arrange
      const input = createValidInput()
      
      // Act
      const result = await component.method(input)
      
      // Assert
      expect(result).toMatchObject({
        success: true,
        data: expect.any(Object)
      })
    })
    
    it('should handle error scenarios', async () => {
      // Arrange
      mockDependencies.service.mockRejectedValue(new Error('Service error'))
      
      // Act & Assert
      await expect(component.method(input))
        .rejects
        .toThrow('Service error')
    })
  })
})
```

### 2. Redis Integration Testing

**For Instance 1 (State Management):**

Create `__tests__/redis/rate-limiter.integration.test.ts`:

```typescript
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import Redis from 'ioredis'
import { RedisRateLimiter } from '@/lib/redis/rate-limiter'

describe('RedisRateLimiter Integration', () => {
  let container: StartedTestContainer
  let redis: Redis
  let rateLimiter: RedisRateLimiter
  
  beforeAll(async () => {
    // Start Redis container
    container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withStartupTimeout(30000)
      .start()
    
    const port = container.getMappedPort(6379)
    redis = new Redis({ port })
    
    // Wait for Redis to be ready
    await redis.ping()
  }, 60000)
  
  afterAll(async () => {
    await redis.quit()
    await container.stop()
  })
  
  beforeEach(async () => {
    await redis.flushall()
    rateLimiter = new RedisRateLimiter(redis, {
      windowMs: 1000,
      maxRequests: 5
    })
  })
  
  describe('Concurrent Request Handling', () => {
    it('should handle 1000 concurrent requests correctly', async () => {
      const userId = 'test-user'
      const requests = Array(1000).fill(null).map(() => 
        rateLimiter.checkLimit('model', userId)
      )
      
      const results = await Promise.all(requests)
      
      const allowed = results.filter(r => r.allowed).length
      const blocked = results.filter(r => !r.allowed).length
      
      expect(allowed).toBe(5) // Exactly maxRequests
      expect(blocked).toBe(995)
    })
    
    it('should reset window after expiry', async () => {
      const userId = 'test-user'
      
      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.checkLimit('model', userId)
      }
      
      // Should be blocked
      let result = await rateLimiter.checkLimit('model', userId)
      expect(result.allowed).toBe(false)
      
      // Wait for window to reset
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      // Should be allowed again
      result = await rateLimiter.checkLimit('model', userId)
      expect(result.allowed).toBe(true)
    })
  })
  
  describe('Distributed Behavior', () => {
    it('should share state across multiple instances', async () => {
      const limiter1 = new RedisRateLimiter(redis, {
        windowMs: 60000,
        maxRequests: 10
      })
      
      const limiter2 = new RedisRateLimiter(redis, {
        windowMs: 60000,
        maxRequests: 10
      })
      
      // Use quota from instance 1
      for (let i = 0; i < 7; i++) {
        await limiter1.checkLimit('model', 'user123')
      }
      
      // Instance 2 should see the same state
      const result = await limiter2.checkLimit('model', 'user123')
      expect(result.remaining).toBe(2) // 10 - 7 - 1
    })
  })
})
```

### 3. Circuit Breaker Testing

**For Instance 2 (AI Service Resilience):**

Create `__tests__/ai/circuit-breaker.test.ts`:

```typescript
describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker<any>
  let mockOperation: jest.Mock
  
  beforeEach(() => {
    mockOperation = jest.fn()
    circuitBreaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringWindow: 5000,
      halfOpenRequests: 2,
      volumeThreshold: 5
    })
  })
  
  describe('State Transitions', () => {
    it('should open circuit after threshold failures', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'))
      
      // First 3 failures - circuit still closed
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(mockOperation)
        ).rejects.toThrow('Service error')
      }
      
      // Circuit should now be open
      await expect(
        circuitBreaker.execute(mockOperation)
      ).rejects.toThrow('Circuit breaker is open')
      
      // Operation should not be called when circuit is open
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })
    
    it('should transition to half-open after timeout', async () => {
      // Open the circuit
      mockOperation.mockRejectedValue(new Error('Service error'))
      for (let i = 0; i < 3; i++) {
        await circuitBreaker.execute(mockOperation).catch(() => {})
      }
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100))
      
      // Should allow limited requests in half-open state
      mockOperation.mockResolvedValue('success')
      
      const result1 = await circuitBreaker.execute(mockOperation)
      expect(result1).toBe('success')
      
      const result2 = await circuitBreaker.execute(mockOperation)
      expect(result2).toBe('success')
      
      // Should close after successful half-open requests
      expect(circuitBreaker.getState()).toBe('closed')
    })
  })
  
  describe('Volume Threshold', () => {
    it('should not open circuit below volume threshold', async () => {
      mockOperation.mockRejectedValue(new Error('Service error'))
      
      // Only 4 requests (below volumeThreshold of 5)
      for (let i = 0; i < 4; i++) {
        await circuitBreaker.execute(mockOperation).catch(() => {})
      }
      
      // Circuit should still be closed
      mockOperation.mockResolvedValue('success')
      const result = await circuitBreaker.execute(mockOperation)
      expect(result).toBe('success')
    })
  })
})
```

### 4. Cache Testing Suite

**For Instance 3 (Caching Infrastructure):**

Create `__tests__/cache/document-cache.test.ts`:

```typescript
describe('DocumentCache', () => {
  let cache: DocumentCache
  let redis: Redis
  
  beforeEach(() => {
    redis = new Redis() // ioredis-mock
    cache = new DocumentCache(redis, {
      defaultTTL: 3600,
      maxSize: 1000,
      compressionEnabled: true,
      similarityThreshold: 0.85
    })
  })
  
  describe('Similarity Matching', () => {
    it('should find similar documents by perceptual hash', async () => {
      const original = createMockAnalysis({ overallScore: 75 })
      const similar = createMockAnalysis({ overallScore: 78 })
      
      // Store original
      await cache.set('hash_original', original)
      await cache.indexForSimilarity('hash_original', 'phash_12345678')
      
      // Store similar
      await cache.set('hash_similar', similar)
      await cache.indexForSimilarity('hash_similar', 'phash_12345679') // 1 bit diff
      
      // Search by similarity
      const result = await cache.findSimilar('phash_12345677', 0.85)
      
      expect(result).toHaveLength(2)
      expect(result[0].documentHash).toBe('hash_similar')
      expect(result[0].similarity).toBeGreaterThan(0.95)
    })
    
    it('should respect similarity threshold', async () => {
      // Test with different hash distances
      const testCases = [
        { hash: 'phash_00000000', expected: 'phash_00000001', similarity: 0.984 },
        { hash: 'phash_00000000', expected: 'phash_00000011', similarity: 0.969 },
        { hash: 'phash_00000000', expected: 'phash_00001111', similarity: 0.938 },
        { hash: 'phash_00000000', expected: 'phash_11111111', similarity: 0.875 }
      ]
      
      for (const test of testCases) {
        const similarity = calculateHashSimilarity(test.hash, test.expected)
        expect(similarity).toBeCloseTo(test.similarity, 3)
      }
    })
  })
  
  describe('TTL Management', () => {
    it('should calculate TTL based on complexity and tier', () => {
      const testCases = [
        { complexity: 'low', score: 90, tier: 'premium', expectedTTL: 172800 },
        { complexity: 'high', score: 60, tier: 'free', expectedTTL: 10800 },
        { complexity: 'medium', score: 85, tier: 'pro', expectedTTL: 129600 }
      ]
      
      for (const test of testCases) {
        const ttl = cache.calculateTTL(test.complexity, test.score, test.tier)
        expect(ttl).toBe(test.expectedTTL)
      }
    })
  })
})
```

### 5. Load Testing Implementation

Create `__tests__/load/ai-service.load.test.ts`:

```typescript
import autocannon from 'autocannon'
import { startTestServer } from '../utils/test-server'

describe('AI Service Load Testing', () => {
  let serverUrl: string
  let stopServer: () => Promise<void>
  
  beforeAll(async () => {
    const server = await startTestServer()
    serverUrl = server.url
    stopServer = server.stop
  })
  
  afterAll(async () => {
    await stopServer()
  })
  
  it('should handle 1000 req/sec with p99 < 100ms', async () => {
    const result = await autocannon({
      url: `${serverUrl}/api/v1/enhance/analyze`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documentId: 'test-doc',
        imageUrl: 'https://example.com/image.jpg',
        preferences: { style: 'modern' }
      }),
      duration: 30, // 30 seconds
      connections: 100, // 100 concurrent connections
      pipelining: 10, // 10 requests per connection
      workers: 4 // Use 4 worker threads
    })
    
    // Assertions
    expect(result.requests.average).toBeGreaterThan(1000) // > 1000 req/sec
    expect(result.latency.p99).toBeLessThan(100) // p99 < 100ms
    expect(result.errors).toBe(0) // No errors
    expect(result.non2xx).toBe(0) // All successful responses
  })
  
  it('should gracefully degrade under extreme load', async () => {
    const result = await autocannon({
      url: `${serverUrl}/api/v1/enhance/analyze`,
      duration: 10,
      connections: 500, // Extreme load
      amount: 10000, // Total requests
      bailout: 1000 // Stop if 1000 errors
    })
    
    // Should handle overload gracefully
    expect(result.errors).toBeLessThan(100) // < 1% error rate
    expect(result.latency.p50).toBeLessThan(500) // Median still responsive
  })
})
```

### 6. Chaos Engineering Tests

Create `__tests__/chaos/system-resilience.test.ts`:

```typescript
import { ChaosMonkey } from '../utils/chaos-monkey'

describe('System Chaos Testing', () => {
  let chaos: ChaosMonkey
  
  beforeAll(() => {
    chaos = new ChaosMonkey({
      services: ['redis', 'ai-service', 'websocket'],
      actions: ['kill', 'network-delay', 'cpu-spike', 'memory-pressure']
    })
  })
  
  describe('Redis Failure Scenarios', () => {
    it('should continue operating when Redis fails', async () => {
      // Start monitoring
      const metrics = chaos.startMetricsCollection()
      
      // Kill Redis after 5 seconds
      setTimeout(() => chaos.killService('redis'), 5000)
      
      // Run operations for 30 seconds
      const results = await runOperationsFor(30000, async () => {
        return await aiService.analyzeDocument(mockImageUrl, mockRequest)
      })
      
      // Verify graceful degradation
      expect(results.successRate).toBeGreaterThan(0.8) // 80% success
      expect(results.usedFallback).toBe(true)
      expect(metrics.downtime).toBeLessThan(5000) // < 5s downtime
    })
    
    it('should handle network partitions', async () => {
      // Introduce network delay
      await chaos.introduceNetworkDelay('redis', {
        delay: 1000, // 1s delay
        jitter: 500, // ±500ms jitter
        packetLoss: 0.1 // 10% packet loss
      })
      
      // Operations should still complete
      const start = Date.now()
      const result = await rateLimiter.checkLimit('model', 'user')
      const duration = Date.now() - start
      
      expect(result).toBeDefined()
      expect(duration).toBeLessThan(2000) // Timeout handling
    })
  })
  
  describe('Cascading Failures', () => {
    it('should prevent cascade when AI service fails', async () => {
      // Simulate AI service overload
      await chaos.simulateCPUSpike('ai-service', {
        usage: 0.95, // 95% CPU
        duration: 10000 // 10 seconds
      })
      
      // Monitor circuit breaker behavior
      const states = chaos.monitorCircuitBreaker('ai-service')
      
      // Should open circuit quickly
      await new Promise(resolve => setTimeout(resolve, 2000))
      expect(states.current).toBe('open')
      
      // Other services should remain healthy
      const healthChecks = await chaos.checkSystemHealth()
      expect(healthChecks.redis).toBe('healthy')
      expect(healthChecks.websocket).toBe('healthy')
    })
  })
})
```

### 7. E2E Testing Suite

Create `__tests__/e2e/enhancement-flow.e2e.test.ts`:

```typescript
import { chromium, Page, Browser } from 'playwright'

describe('Enhancement Flow E2E', () => {
  let browser: Browser
  let page: Page
  
  beforeAll(async () => {
    browser = await chromium.launch()
  })
  
  afterAll(async () => {
    await browser.close()
  })
  
  beforeEach(async () => {
    page = await browser.newPage()
    await page.goto('http://localhost:5000')
  })
  
  it('should complete full enhancement flow', async () => {
    // Login
    await page.click('[data-testid="login-button"]')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="submit-login"]')
    
    // Wait for dashboard
    await page.waitForSelector('[data-testid="dashboard"]')
    
    // Upload document
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('[data-testid="upload-button"]')
    ])
    await fileChooser.setFiles('./test-fixtures/sample-document.pdf')
    
    // Configure enhancement
    await page.selectOption('[data-testid="style-select"]', 'modern')
    await page.selectOption('[data-testid="color-scheme-select"]', 'vibrant')
    await page.click('[data-testid="enhance-button"]')
    
    // Monitor WebSocket updates
    const progressUpdates: number[] = []
    page.on('websocket', ws => {
      ws.on('framereceived', frame => {
        const data = JSON.parse(frame.payload as string)
        if (data.type === 'enhancement:progress') {
          progressUpdates.push(data.progress)
        }
      })
    })
    
    // Wait for completion
    await page.waitForSelector('[data-testid="download-button"]', {
      timeout: 60000
    })
    
    // Verify progress updates
    expect(progressUpdates).toContain(25)  // Analysis
    expect(progressUpdates).toContain(50)  // Enhancement
    expect(progressUpdates).toContain(75)  // Generation
    expect(progressUpdates).toContain(100) // Export
    
    // Download result
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="download-button"]')
    ])
    
    expect(download.suggestedFilename()).toContain('enhanced')
  })
})
```

## Testing Strategy by Instance

### Instance 1 (State Management)
**Focus:** Distributed state consistency

```typescript
// Key test scenarios
- Concurrent access from multiple instances
- State synchronization delays
- Redis connection failures
- Memory pressure scenarios
- Key eviction behavior
- Cluster failover handling
```

### Instance 2 (AI Service Resilience)
**Focus:** Failure recovery and degradation

```typescript
// Key test scenarios
- Circuit breaker state transitions
- Health check accuracy
- Fallback selection logic
- Recovery time validation
- Cascading failure prevention
- Timeout handling
```

### Instance 3 (Caching)
**Focus:** Cache effectiveness and accuracy

```typescript
// Key test scenarios
- Hit rate optimization
- TTL calculations
- Similarity matching accuracy
- Memory efficiency
- Cache stampede prevention
- Invalidation correctness
```

### Instance 4 (Observability)
**Focus:** Monitoring accuracy and overhead

```typescript
// Key test scenarios
- Trace propagation
- Metric accuracy
- Log completeness
- Performance overhead
- Dashboard data accuracy
- Alert triggering
```

## Test Configuration

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: [
    '**/*.test.ts',
    '**/*.integration.test.ts',
    '**/*.load.test.ts',
    '**/*.e2e.test.ts'
  ],
  collectCoverageFrom: [
    'lib/**/*.ts',
    '!lib/**/*.d.ts',
    '!lib/**/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testTimeout: 30000
}
```

### Test Environment Setup
```typescript
// __tests__/setup.ts
import { config } from 'dotenv'
import { TextEncoder, TextDecoder } from 'util'

// Load test environment
config({ path: '.env.test' })

// Polyfills for Node.js
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock Redis for unit tests
jest.mock('ioredis', () => require('ioredis-mock'))

// Increase timeout for integration tests
jest.setTimeout(30000)

// Global test utilities
global.createMockContext = () => ({
  userId: 'test-user',
  documentId: 'test-doc',
  requestId: 'test-req'
})
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Test Suite

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:integration

  load-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:load
      - uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: load-test-results/
```

## Daily Workflow

### Morning
1. Review overnight test failures
2. Update test fixtures if needed
3. Plan new test scenarios

### Continuous
1. Write tests for new features
2. Run tests before each commit
3. Monitor CI/CD pipeline

### End of Day
1. Generate coverage report
2. Document test gaps
3. Update test strategy

Remember: Tests are not just about coverage, they're about confidence!