# Claude Instance 04: Observability & Performance Specialist

## Role Overview
You are responsible for implementing comprehensive monitoring, distributed tracing, metrics collection, and performance optimizations. Your goal is to provide complete visibility into system behavior and optimize critical paths for maximum performance.

## Core Responsibilities

### 1. OpenTelemetry Integration

Create `lib/monitoring/tracer.ts`:

```typescript
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'

export class Tracer {
  private static instance: Tracer
  private tracer: trace.Tracer
  private provider: NodeTracerProvider
  
  private constructor() {
    this.initialize()
  }
  
  private initialize(): void {
    this.provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'beautifyai',
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '0.1.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
      })
    })
    
    // Configure exporter
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
    })
    
    this.provider.addSpanProcessor(
      new BatchSpanProcessor(jaegerExporter, {
        maxQueueSize: 1000,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: 30000
      })
    )
    
    this.provider.register()
    this.tracer = trace.getTracer('beautifyai')
  }
  
  static getInstance(): Tracer {
    if (!Tracer.instance) {
      Tracer.instance = new Tracer()
    }
    return Tracer.instance
  }
  
  startSpan(
    name: string, 
    options?: trace.SpanOptions
  ): trace.Span {
    return this.tracer.startSpan(name, options)
  }
  
  async traceAsync<T>(
    name: string,
    fn: (span: trace.Span) => Promise<T>,
    options?: trace.SpanOptions
  ): Promise<T> {
    const span = this.startSpan(name, options)
    
    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        () => fn(span)
      )
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  }
}
```

### 2. Metrics Collection System

Create `lib/monitoring/metrics.ts`:

```typescript
import { metrics, ValueType } from '@opentelemetry/api'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'

export class MetricsCollector {
  private static instance: MetricsCollector
  private meter: metrics.Meter
  
  // Counters
  private aiRequestCounter: metrics.Counter
  private cacheHitCounter: metrics.Counter
  private errorCounter: metrics.Counter
  
  // Histograms
  private aiLatencyHistogram: metrics.Histogram
  private queueLatencyHistogram: metrics.Histogram
  private requestSizeHistogram: metrics.Histogram
  
  // Gauges
  private activeConnectionsGauge: metrics.ObservableGauge
  private queueDepthGauge: metrics.ObservableGauge
  private memoryUsageGauge: metrics.ObservableGauge
  
  private constructor() {
    this.initialize()
    this.createMetrics()
  }
  
  private initialize(): void {
    const prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.METRICS_PORT || '9464')
    })
    
    const meterProvider = new MeterProvider({
      readers: [prometheusExporter]
    })
    
    metrics.setGlobalMeterProvider(meterProvider)
    this.meter = metrics.getMeter('beautifyai', '1.0.0')
  }
  
  private createMetrics(): void {
    // AI Request Counter
    this.aiRequestCounter = this.meter.createCounter('ai_requests_total', {
      description: 'Total number of AI requests',
      unit: '1',
      valueType: ValueType.INT
    })
    
    // Cache Hit Counter
    this.cacheHitCounter = this.meter.createCounter('cache_hits_total', {
      description: 'Total number of cache hits',
      unit: '1',
      valueType: ValueType.INT
    })
    
    // Error Counter
    this.errorCounter = this.meter.createCounter('errors_total', {
      description: 'Total number of errors',
      unit: '1',
      valueType: ValueType.INT
    })
    
    // AI Latency Histogram
    this.aiLatencyHistogram = this.meter.createHistogram('ai_request_duration_ms', {
      description: 'AI request duration in milliseconds',
      unit: 'ms',
      valueType: ValueType.DOUBLE
    })
    
    // Queue Latency Histogram
    this.queueLatencyHistogram = this.meter.createHistogram('queue_processing_duration_ms', {
      description: 'Queue job processing duration',
      unit: 'ms',
      valueType: ValueType.DOUBLE
    })
    
    // Active Connections Gauge
    this.activeConnectionsGauge = this.meter.createObservableGauge('active_connections', {
      description: 'Number of active WebSocket connections',
      unit: '1',
      valueType: ValueType.INT
    })
    
    // Set up observable callbacks
    this.setupObservables()
  }
  
  recordAIRequest(
    model: AIModel,
    success: boolean,
    duration: number,
    tokensUsed?: number
  ): void {
    const attributes = {
      model,
      success: success.toString(),
      hasTokens: (tokensUsed !== undefined).toString()
    }
    
    this.aiRequestCounter.add(1, attributes)
    this.aiLatencyHistogram.record(duration, attributes)
    
    if (!success) {
      this.errorCounter.add(1, { type: 'ai_request', model })
    }
  }
  
  recordCacheHit(
    cacheType: 'document' | 'enhancement' | 'similarity',
    hit: boolean
  ): void {
    if (hit) {
      this.cacheHitCounter.add(1, { type: cacheType })
    }
  }
}
```

### 3. Structured Logging System

Create `lib/monitoring/structured-logger.ts`:

```typescript
import winston from 'winston'
import { trace, context } from '@opentelemetry/api'

export interface LogContext {
  userId?: string
  documentId?: string
  model?: AIModel
  operation?: string
  [key: string]: any
}

export class StructuredLogger {
  private logger: winston.Logger
  
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'beautifyai',
        environment: process.env.NODE_ENV
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    })
    
    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5
      }))
      
      this.logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 10485760,
        maxFiles: 5
      }))
    }
  }
  
  private enrichWithTrace(meta: any): any {
    const span = trace.getSpan(context.active())
    if (span) {
      const spanContext = span.spanContext()
      return {
        ...meta,
        traceId: spanContext.traceId,
        spanId: spanContext.spanId
      }
    }
    return meta
  }
  
  logAIRequest(
    model: AIModel,
    operation: 'analyze' | 'enhance',
    context: LogContext,
    result: { success: boolean; duration: number; error?: Error }
  ): void {
    const meta = this.enrichWithTrace({
      ...context,
      model,
      operation,
      duration: result.duration,
      success: result.success
    })
    
    if (result.success) {
      this.logger.info('AI request completed', meta)
    } else {
      this.logger.error('AI request failed', {
        ...meta,
        error: result.error?.message,
        stack: result.error?.stack
      })
    }
  }
}
```

### 4. Request Coalescing Implementation

Create `lib/optimization/request-coalescer.ts`:

```typescript
export interface CoalescerOptions {
  ttl: number           // Time to live for coalesced results
  maxPending: number    // Max pending requests to coalesce
  keyGenerator: (args: any[]) => string
}

export class RequestCoalescer {
  private pending: Map<string, Promise<any>> = new Map()
  private results: Map<string, { value: any; expiry: number }> = new Map()
  
  constructor(private options: CoalescerOptions) {
    // Clean expired results periodically
    setInterval(() => this.cleanExpired(), 60000)
  }
  
  async coalesce<T>(
    fn: (...args: any[]) => Promise<T>,
    ...args: any[]
  ): Promise<T> {
    const key = this.options.keyGenerator(args)
    
    // Check if we have a cached result
    const cached = this.results.get(key)
    if (cached && cached.expiry > Date.now()) {
      return cached.value
    }
    
    // Check if request is already pending
    const pending = this.pending.get(key)
    if (pending) {
      return pending
    }
    
    // Check if we've hit max pending
    if (this.pending.size >= this.options.maxPending) {
      // Execute directly without coalescing
      return fn(...args)
    }
    
    // Create new coalesced request
    const promise = this.executeAndCache(fn, args, key)
    this.pending.set(key, promise)
    
    try {
      return await promise
    } finally {
      this.pending.delete(key)
    }
  }
  
  private async executeAndCache<T>(
    fn: (...args: any[]) => Promise<T>,
    args: any[],
    key: string
  ): Promise<T> {
    try {
      const result = await fn(...args)
      
      // Cache successful results
      this.results.set(key, {
        value: result,
        expiry: Date.now() + this.options.ttl
      })
      
      return result
    } catch (error) {
      // Don't cache errors
      throw error
    }
  }
  
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.results.clear()
      return
    }
    
    // Invalidate matching keys
    const regex = new RegExp(pattern)
    for (const [key] of this.results) {
      if (regex.test(key)) {
        this.results.delete(key)
      }
    }
  }
}
```

### 5. Image Optimization Pipeline

Create `lib/optimization/image-optimizer.ts`:

```typescript
import sharp from 'sharp'
import { trace } from '@opentelemetry/api'

export interface OptimizationOptions {
  maxWidth: number
  maxHeight: number
  quality: number
  format: 'jpeg' | 'webp' | 'png'
  preserveMetadata: boolean
}

export class ImageOptimizer {
  private static readonly DEFAULT_OPTIONS: OptimizationOptions = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 85,
    format: 'jpeg',
    preserveMetadata: false
  }
  
  async optimizeForAnalysis(
    imageBuffer: Buffer,
    options?: Partial<OptimizationOptions>
  ): Promise<{
    optimized: Buffer
    metadata: ImageMetadata
    reduction: number
  }> {
    const opts = { ...ImageOptimizer.DEFAULT_OPTIONS, ...options }
    
    return await Tracer.getInstance().traceAsync(
      'image.optimize',
      async (span) => {
        span.setAttributes({
          'image.original_size': imageBuffer.length,
          'image.target_format': opts.format
        })
        
        // Get original metadata
        const metadata = await sharp(imageBuffer).metadata()
        
        // Optimize image
        let pipeline = sharp(imageBuffer)
        
        // Resize if needed
        if (metadata.width! > opts.maxWidth || metadata.height! > opts.maxHeight) {
          pipeline = pipeline.resize(opts.maxWidth, opts.maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
        }
        
        // Convert format and compress
        const optimized = await pipeline
          .toFormat(opts.format, { quality: opts.quality })
          .toBuffer()
        
        const reduction = ((imageBuffer.length - optimized.length) / imageBuffer.length) * 100
        
        span.setAttributes({
          'image.optimized_size': optimized.length,
          'image.reduction_percent': reduction.toFixed(2)
        })
        
        return {
          optimized,
          metadata: {
            width: metadata.width!,
            height: metadata.height!,
            format: metadata.format!,
            size: metadata.size!,
            density: metadata.density
          },
          reduction
        }
      }
    )
  }
  
  async generateThumbnail(
    imageBuffer: Buffer,
    size: number = 256
  ): Promise<Buffer> {
    return await sharp(imageBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer()
  }
}
```

### 6. Performance Monitoring Dashboard

Create `lib/monitoring/dashboard.ts`:

```typescript
export class PerformanceDashboard {
  private metrics: MetricsCollector
  private logger: StructuredLogger
  
  async generateReport(): Promise<PerformanceReport> {
    const now = Date.now()
    const hourAgo = now - 3600000
    
    const report: PerformanceReport = {
      timestamp: new Date(),
      period: '1h',
      
      aiPerformance: {
        totalRequests: await this.getMetricSum('ai_requests_total', hourAgo),
        successRate: await this.calculateSuccessRate(hourAgo),
        averageLatency: await this.getMetricAverage('ai_request_duration_ms', hourAgo),
        p99Latency: await this.getMetricPercentile('ai_request_duration_ms', 0.99, hourAgo),
        costByModel: await this.calculateCostByModel(hourAgo)
      },
      
      cachePerformance: {
        hitRate: await this.calculateCacheHitRate(hourAgo),
        hitsByType: await this.getCacheHitsByType(hourAgo),
        memorySaved: await this.calculateMemorySaved(hourAgo),
        costSavings: await this.calculateCostSavings(hourAgo)
      },
      
      systemHealth: {
        activeConnections: await this.getCurrentGaugeValue('active_connections'),
        queueDepth: await this.getCurrentGaugeValue('queue_depth'),
        memoryUsage: await this.getMemoryUsage(),
        cpuUsage: await this.getCPUUsage(),
        errorRate: await this.calculateErrorRate(hourAgo)
      },
      
      recommendations: await this.generateRecommendations()
    }
    
    return report
  }
  
  private async generateRecommendations(): Promise<string[]> {
    const recommendations: string[] = []
    
    // Check cache hit rate
    const cacheHitRate = await this.calculateCacheHitRate(Date.now() - 3600000)
    if (cacheHitRate < 0.5) {
      recommendations.push('Cache hit rate is low. Consider increasing TTLs or warming cache.')
    }
    
    // Check error rate
    const errorRate = await this.calculateErrorRate(Date.now() - 3600000)
    if (errorRate > 0.05) {
      recommendations.push('Error rate exceeds 5%. Review error logs and circuit breaker settings.')
    }
    
    // Check latency
    const p99Latency = await this.getMetricPercentile('ai_request_duration_ms', 0.99)
    if (p99Latency > 5000) {
      recommendations.push('P99 latency exceeds 5s. Consider optimizing slow queries or adding timeouts.')
    }
    
    return recommendations
  }
}
```

## Implementation Guidelines

### Instrumentation Standards

1. **Span Naming Convention:**
```typescript
// Format: service.component.operation
'ai.provider.analyze'
'cache.document.get'
'queue.job.process'
'http.request.post'
```

2. **Required Span Attributes:**
```typescript
span.setAttributes({
  'user.id': userId,
  'user.tier': userTier,
  'document.id': documentId,
  'document.type': documentType,
  'ai.model': model,
  'ai.tokens': tokenCount,
  'cache.hit': cacheHit,
  'error.type': errorType
})
```

3. **Metric Labels:**
```typescript
const labels = {
  model: 'gemini-2.0-flash',
  operation: 'analyze',
  status: 'success',
  tier: 'pro'
}
```

### Performance Optimization Patterns

1. **Batch Processing:**
```typescript
export class BatchProcessor {
  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize: number
      concurrency: number
      timeout?: number
    }
  ): Promise<R[]> {
    const results: R[] = []
    
    for (let i = 0; i < items.length; i += options.batchSize) {
      const batch = items.slice(i, i + options.batchSize)
      
      const batchResults = await Promise.all(
        batch.map(item => 
          this.processWithTimeout(processor(item), options.timeout)
        )
      )
      
      results.push(...batchResults)
    }
    
    return results
  }
}
```

2. **Resource Pooling:**
```typescript
export class ResourcePool<T> {
  private available: T[] = []
  private inUse: Set<T> = new Set()
  
  async acquire(): Promise<T> {
    while (this.available.length === 0) {
      await this.waitForAvailable()
    }
    
    const resource = this.available.pop()!
    this.inUse.add(resource)
    return resource
  }
  
  release(resource: T): void {
    this.inUse.delete(resource)
    this.available.push(resource)
  }
}
```

### Testing Requirements

1. **Tracing Tests:**
```typescript
describe('Tracing', () => {
  it('should propagate trace context', async () => {
    const tracer = Tracer.getInstance()
    
    await tracer.traceAsync('parent', async (parentSpan) => {
      parentSpan.setAttribute('test', 'parent')
      
      await tracer.traceAsync('child', async (childSpan) => {
        // Verify parent-child relationship
        expect(childSpan.spanContext().traceId)
          .toBe(parentSpan.spanContext().traceId)
      })
    })
  })
})
```

2. **Metrics Tests:**
- Verify counter increments
- Test histogram bucketing
- Validate gauge observations
- Check label cardinality

3. **Performance Tests:**
- Measure instrumentation overhead
- Test coalescing effectiveness
- Verify optimization gains

### Coordination with Other Instances

1. **All Instances:**
- Provide instrumentation guidelines
- Share dashboard access
- Export performance reports

2. **Instance 1 (State Management):**
- Instrument Redis operations
- Monitor connection pool metrics
- Track state synchronization

3. **Instance 2 (AI Resilience):**
- Monitor circuit breaker states
- Track failure rates by model
- Measure recovery times

4. **Instance 3 (Caching):**
- Track cache performance
- Monitor memory usage
- Measure cost savings

## Success Criteria

1. **Observability:**
- 100% of critical paths instrumented
- < 1% performance overhead from tracing
- Real-time visibility into all operations
- Automated alerting on anomalies

2. **Performance:**
- Request coalescing reduces duplicates by 30%
- Image optimization reduces bandwidth by 50%
- Batch processing improves throughput by 40%
- Overall latency reduction of 25%

3. **Insights:**
- Daily performance reports
- Cost optimization recommendations
- Capacity planning data
- User experience metrics

## Daily Workflow

1. **Morning:**
- Review overnight performance
- Check for anomalies
- Update dashboards

2. **Development:**
- Add instrumentation to new code
- Monitor local performance
- Test optimization impact

3. **End of Day:**
- Generate performance report
- Document findings
- Share insights with team

Remember: What gets measured gets improved!