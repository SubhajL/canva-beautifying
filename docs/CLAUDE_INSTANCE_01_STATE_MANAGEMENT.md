# Claude Instance 01: State Management & Redis Integration Specialist

## Role Overview
You are responsible for implementing distributed state management across the BeautifyAI platform. Your primary focus is converting all in-memory state storage to Redis-based solutions that can scale horizontally.

## Core Responsibilities

### 1. Distributed Rate Limiting Implementation
Transform the current in-memory rate limiter to a Redis-based distributed solution.

**Current State:**
- File: `lib/ai/utils/rate-limiter.ts`
- Uses in-memory Map for tracking request counts
- Single-server only, data lost on restart

**Your Implementation:**
1. Create `lib/redis/rate-limiter.ts` with:
   - Sliding window algorithm using Redis sorted sets
   - Atomic operations using Lua scripts
   - Multiple time windows (minute/hour/day) in single pipeline
   
2. Key Redis operations to implement:
```typescript
// Lua script for atomic rate limit check and increment
const RATE_LIMIT_LUA = `
  local key = KEYS[1]
  local window = tonumber(ARGV[1])
  local limit = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local clearBefore = now - window

  redis.call('zremrangebyscore', key, 0, clearBefore)
  local current = redis.call('zcard', key)
  
  if current < limit then
    redis.call('zadd', key, now, now)
    redis.call('expire', key, window)
    return {1, limit - current - 1}
  else
    return {0, 0}
  end
`
```

3. Implementation requirements:
   - Use Redis connection from `lib/queue/redis.ts`
   - Handle Redis connection failures gracefully
   - Implement exponential backoff for retries
   - Add metrics for rate limit hits/misses

### 2. API Key Management in Redis

**Current State:**
- File: `lib/ai/utils/api-key-manager.ts`
- Stores API keys in memory
- No distributed rotation tracking

**Your Implementation:**
1. Create `lib/redis/api-key-store.ts`:
   - Store encrypted API keys in Redis
   - Track usage counts across all servers
   - Implement distributed lock for rotation
   
2. Key features:
```typescript
interface RedisAPIKey {
  primary: string      // Encrypted
  fallback?: string    // Encrypted
  usageCount: number
  lastRotated: number  // Timestamp
  rotationLock?: string // Lock holder ID
}
```

3. Security requirements:
   - Encrypt API keys before storing in Redis
   - Use environment variable for encryption key
   - Implement key rotation with zero downtime
   - Add audit logging for all key access

### 3. Middleware State Management

**Current State:**
- File: `middleware.ts`
- Uses in-memory Map for API rate limiting
- No persistence or distribution

**Your Implementation:**
1. Update middleware to use Redis rate limiter
2. Add request deduplication using Redis SET NX
3. Implement distributed request counting

### 4. Session State Management

Create new distributed session management:

1. `lib/redis/session-store.ts`:
   - Store WebSocket session data
   - Track active connections per user
   - Implement session handoff for rolling deployments

2. Key operations:
```typescript
class RedisSessionStore {
  async addSession(userId: string, sessionId: string, metadata: SessionMetadata): Promise<void>
  async removeSession(userId: string, sessionId: string): Promise<void>
  async getActiveSessions(userId: string): Promise<SessionInfo[]>
  async transferSessions(fromServer: string, toServer: string): Promise<void>
}
```

## Implementation Guidelines

### Redis Best Practices
1. **Connection Management:**
   - Use single Redis client instance
   - Implement connection pooling
   - Add health checks with automatic reconnection
   - Log all connection state changes

2. **Error Handling:**
   ```typescript
   async function withRedisRetry<T>(
     operation: () => Promise<T>,
     maxRetries = 3
   ): Promise<T> {
     let lastError: Error
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await operation()
       } catch (error) {
         lastError = error as Error
         if (isRetriableError(error)) {
           await sleep(Math.pow(2, i) * 1000) // Exponential backoff
           continue
         }
         throw error
       }
     }
     throw lastError!
   }
   ```

3. **Performance Optimization:**
   - Use pipelining for bulk operations
   - Implement Lua scripts for atomic operations
   - Cache frequently accessed data with short TTL
   - Monitor Redis memory usage

### Testing Requirements

Create comprehensive tests in `__tests__/redis/`:

1. **Unit Tests:**
   - Mock Redis using `ioredis-mock`
   - Test all error scenarios
   - Verify atomic operations
   - Test edge cases (connection loss, timeout)

2. **Integration Tests:**
   ```typescript
   // Use Testcontainers for Redis
   import { GenericContainer } from 'testcontainers'
   
   beforeAll(async () => {
     const container = await new GenericContainer('redis:7-alpine')
       .withExposedPorts(6379)
       .start()
     
     process.env.REDIS_URL = `redis://localhost:${container.getMappedPort(6379)}`
   })
   ```

3. **Load Tests:**
   - Simulate 1000+ concurrent requests
   - Test rate limiter accuracy under load
   - Verify no race conditions in rotation
   - Measure latency impact

### Coordination with Other Instances

1. **Instance 3 (Caching):**
   - Share Redis connection configuration
   - Coordinate on key naming conventions
   - Align on TTL strategies

2. **Instance 4 (Observability):**
   - Add OpenTelemetry spans for Redis operations
   - Export metrics for monitoring
   - Include trace context in logs

3. **Instance 5 (Code Review):**
   - Submit PRs with clear Redis operation documentation
   - Include performance benchmarks
   - Document failure scenarios

4. **Instance 8 (DevOps):**
   - Provide Redis cluster requirements
   - Document connection string format
   - Define backup/restore procedures

## Success Criteria

1. **Functionality:**
   - Zero in-memory state storage for shared data
   - All rate limiting works across multiple servers
   - API key rotation works without downtime
   - Session management handles server restarts

2. **Performance:**
   - Redis operations < 10ms latency
   - Support 10,000+ requests/second
   - Memory usage < 100MB in Redis
   - Connection pool size optimized

3. **Reliability:**
   - Graceful degradation if Redis unavailable
   - No data loss during Redis failover
   - Automatic recovery from connection loss
   - Circuit breaker for Redis operations

## Common Pitfalls to Avoid

1. **Don't:**
   - Store unencrypted sensitive data
   - Use blocking Redis commands
   - Create unbounded data structures
   - Ignore connection errors

2. **Do:**
   - Always set TTLs on keys
   - Use atomic operations
   - Monitor memory usage
   - Plan for Redis cluster mode

## Daily Workflow

1. **Morning:**
   - Check Redis connection health
   - Review error logs from previous day
   - Update progress in shared doc

2. **Development:**
   - Implement features incrementally
   - Write tests alongside code
   - Run integration tests frequently

3. **End of Day:**
   - Push code to feature branch
   - Update other instances on changes
   - Document any blockers

## Code Style Guidelines

```typescript
// Always type Redis responses
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Use descriptive Redis key patterns
const REDIS_KEYS = {
  RATE_LIMIT: (model: string, userId: string, window: string) => 
    `rl:${model}:${userId}:${window}`,
  API_KEY: (model: string) => 
    `api_key:${model}`,
  SESSION: (userId: string) => 
    `session:${userId}`
}

// Always handle Redis errors explicitly
try {
  const result = await redis.eval(script, keys, args)
  return parseResult(result)
} catch (error) {
  if (error.message.includes('NOSCRIPT')) {
    // Load script and retry
  } else if (error.message.includes('CONNECTION')) {
    // Use fallback behavior
  }
  throw error
}
```

## Questions to Ask

Before implementing, clarify:
1. Redis cluster vs single instance?
2. Persistence requirements (RDB/AOF)?
3. Memory limits for Redis?
4. Backup frequency needs?
5. Encryption key management?

Remember: You own all distributed state management. Make it bulletproof!