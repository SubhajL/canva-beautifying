# Observability Module

Comprehensive monitoring, logging, and metrics collection for the BeautifyAI platform.

## Features

- **Structured Logging** - Pino-based logging with request context tracking
- **Metrics Collection** - Prometheus-compatible metrics for all services
- **Performance Monitoring** - Track AI operations, queue jobs, and API performance
- **Security Event Tracking** - Monitor and alert on security-related events
- **Distributed Tracing** - Request context propagation across services
- **Resource Monitoring** - Track memory, CPU, and system resources

## Quick Start

### Basic Logging

```typescript
import { logger } from '@/lib/observability';

// Simple logging
logger.info('User logged in', { userId: 'user-123' });
logger.error('Failed to process document', { err: error });

// With request context
logger.withContext({ requestId: 'req-123', userId: 'user-456' }, () => {
  logger.info('Processing request');
  // All logs within this context will include requestId and userId
});
```

### AI Operation Monitoring

```typescript
import { monitorAIOperation } from '@/lib/observability';

const result = await monitorAIOperation(
  {
    operation: 'analyzeDocument',
    model: 'gpt-4',
    provider: 'openai',
    userId: 'user-123',
  },
  async () => {
    // Your AI operation
    const response = await openai.chat.completions.create({...});
    return {
      ...response,
      tokensUsed: response.usage?.total_tokens,
      cost: calculateCost(response.usage),
    };
  }
);
```

### Queue Monitoring

```typescript
import { createMonitoredQueue, createMonitoredWorker } from '@/lib/observability/integrations/queue-monitoring';

// Create monitored queue
const queue = createMonitoredQueue('enhancement-queue', {
  connection: redisConnection,
});

// Create monitored worker
const worker = createMonitoredWorker(
  'enhancement-worker',
  async (job) => {
    // Process job with automatic monitoring
    return processEnhancement(job.data);
  }
);
```

### HTTP Request Logging

```typescript
// In middleware.ts
import { withLogging } from '@/lib/observability';

export function middleware(request: NextRequest) {
  return withLogging(request);
}

// In API routes
import { withApiLogging } from '@/lib/observability';

export const GET = withApiLogging(async (req) => {
  // Your API logic - automatically tracked
  return NextResponse.json({ data });
});
```

## Structured Logging Methods

### HTTP Requests
```typescript
logger.logHttpRequest(req, res, responseTime);
```

### Database Queries
```typescript
logger.logDatabaseQuery(query, params, duration, error?);
```

### AI Operations
```typescript
logger.logAIOperation(operation, model, input, output, {
  duration,
  tokensUsed,
  cost,
  error?,
});
```

### Queue Jobs
```typescript
logger.logQueueJob(queue, jobId, action, metadata?);
```

### Security Events
```typescript
logger.logSecurityEvent('unauthorized_access', 'high', {
  userId,
  resource,
  ip,
});
```

### Performance Metrics
```typescript
logger.logPerformanceMetric('api.response_time', 150, 'ms', {
  endpoint: '/api/enhance',
  method: 'POST',
});
```

## Metrics

Access metrics at `/api/metrics` (requires authentication).

### Available Metrics

- **HTTP Metrics**
  - `http_requests_total` - Total HTTP requests
  - `http_request_duration_seconds` - Request duration histogram

- **AI Metrics**
  - `ai_operations_total` - Total AI operations
  - `ai_operation_duration_seconds` - AI operation duration
  - `ai_tokens_used_total` - Total tokens consumed
  - `ai_operation_cost_dollars` - Total cost of AI operations
  - `ai_model_fallbacks_total` - Model fallback counts

- **Queue Metrics**
  - `queue_jobs_total` - Total queue jobs by status
  - `queue_job_duration_seconds` - Job processing duration
  - `queue_depth` - Current queue depth by status

- **System Metrics**
  - `system_memory_usage_bytes` - Memory usage
  - `system_cpu_usage_percent` - CPU usage

## Configuration

### Environment Variables

```env
# Logging
LOG_LEVEL=info                  # trace, debug, info, warn, error, fatal
NODE_ENV=production            # Affects log formatting

# Metrics
ENABLE_METRICS_ENDPOINT=true   # Enable /api/metrics endpoint
METRICS_AUTH_TOKEN=secret      # Bearer token for metrics auth

# Sentry (Error Tracking)
NEXT_PUBLIC_SENTRY_DSN=...     # Sentry DSN
SENTRY_ENABLED=true            # Enable Sentry in dev
```

### Security

The logger automatically redacts sensitive fields:
- Headers: `authorization`, `cookie`, `set-cookie`
- Fields: `password`, `apiKey`, `token`, `jwt`, `creditCard`

## Integration Examples

### Enhancement Pipeline Monitoring

```typescript
import { monitorPipelineStage } from '@/lib/observability/integrations/enhancement-pipeline-monitoring';

const monitoredStage = monitorPipelineStage({
  name: 'analysis',
  execute: async (context) => {
    // Stage logic with automatic monitoring
  },
});
```

### AI Provider Monitoring

```typescript
import { MonitoredAIProvider } from '@/lib/observability/integrations/ai-service-integration';

const provider = new MonitoredAIProvider(
  originalProvider,
  'openai'
);

// All operations are automatically monitored
const result = await provider.analyzeDocument(imageData);
```

## Development

### Testing

The module includes comprehensive tests:

```bash
npm test lib/observability/logger.test.ts
```

### Adding New Log Types

1. Define the log entry interface in `logger.ts`
2. Add the structured logging method
3. Update exports in `index.ts`
4. Add tests

### Adding New Metrics

1. Define the metric in `metrics.ts`
2. Add recording logic where needed
3. Document the metric

## Best Practices

1. **Use Structured Logging** - Prefer structured methods over plain text
2. **Include Context** - Always include relevant IDs (user, request, document)
3. **Log at Appropriate Levels** - Use debug for details, info for events, warn for issues, error for failures
4. **Monitor Performance** - Track duration of expensive operations
5. **Handle Errors Gracefully** - Log errors with full context
6. **Secure Sensitive Data** - Never log passwords, tokens, or PII

## Troubleshooting

### High Memory Usage
Check for memory leaks in logging:
```typescript
logger.child({ /* large object */ }); // Avoid large objects in child loggers
```

### Missing Logs
Verify LOG_LEVEL environment variable:
```typescript
console.log('Current log level:', process.env.LOG_LEVEL);
```

### Metrics Not Updating
Check the metrics endpoint:
```bash
curl -H "Authorization: Bearer $METRICS_AUTH_TOKEN" http://localhost:5000/api/metrics
```