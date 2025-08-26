# Claude Instance 07: Database & Migration Specialist

## Role Overview
You are responsible for all database schema changes, Redis data structure optimization, and ensuring data integrity during the transition to distributed systems. Your work ensures backward compatibility while enabling new architectural improvements.

## Core Responsibilities

### 1. Supabase Schema Updates

**Current Tables Requiring Updates:**

Create `supabase/migrations/20250126_distributed_state_support.sql`:

```sql
-- Add distributed state tracking tables
CREATE TABLE IF NOT EXISTS distributed_locks (
  lock_key VARCHAR(255) PRIMARY KEY,
  lock_holder VARCHAR(255) NOT NULL,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT expires_after_acquired CHECK (expires_at > acquired_at)
);

-- Index for lock expiration queries
CREATE INDEX idx_distributed_locks_expires_at ON distributed_locks(expires_at);

-- Add circuit breaker state table
CREATE TABLE IF NOT EXISTS circuit_breaker_states (
  service_name VARCHAR(100) PRIMARY KEY,
  state VARCHAR(20) NOT NULL CHECK (state IN ('closed', 'open', 'half-open')),
  failure_count INT DEFAULT 0,
  last_failure_time TIMESTAMP WITH TIME ZONE,
  last_success_time TIMESTAMP WITH TIME ZONE,
  last_state_change TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add cache metadata table for tracking
CREATE TABLE IF NOT EXISTS cache_metadata (
  cache_key VARCHAR(500) PRIMARY KEY,
  cache_type VARCHAR(50) NOT NULL CHECK (cache_type IN ('document', 'enhancement', 'similarity')),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INT DEFAULT 1,
  ttl_seconds INT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (created_at + (ttl_seconds || ' seconds')::INTERVAL) STORED
);

-- Index for cache cleanup
CREATE INDEX idx_cache_metadata_expires_at ON cache_metadata(expires_at);
CREATE INDEX idx_cache_metadata_user_id ON cache_metadata(user_id);

-- Add performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type VARCHAR(100) NOT NULL,
  metric_name VARCHAR(200) NOT NULL,
  metric_value DECIMAL(10, 4) NOT NULL,
  dimensions JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optimize for time-series queries
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Partitioned by month for performance
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC);
CREATE INDEX idx_performance_metrics_type_name ON performance_metrics(metric_type, metric_name);

-- Function to automatically partition performance_metrics
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  partition_name TEXT;
BEGIN
  start_date := DATE_TRUNC('month', CURRENT_DATE);
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'performance_metrics_' || TO_CHAR(start_date, 'YYYY_MM');
  
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I PARTITION OF performance_metrics
    FOR VALUES FROM (%L) TO (%L)
  ', partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Update ai_usage_tracking for cost optimization
ALTER TABLE ai_usage_tracking
ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fallback_model VARCHAR(50),
ADD COLUMN IF NOT EXISTS circuit_breaker_state VARCHAR(20);

-- Add indexes for new queries
CREATE INDEX idx_ai_usage_cache_hit ON ai_usage_tracking(cache_hit) WHERE cache_hit = TRUE;
CREATE INDEX idx_ai_usage_fallback ON ai_usage_tracking(fallback_model) WHERE fallback_model IS NOT NULL;
```

### 2. RLS Policy Updates

Create `supabase/migrations/20250126_rls_policies_update.sql`:

```sql
-- Circuit breaker states - only system can write, users can read their own
ALTER TABLE circuit_breaker_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage circuit breaker states"
ON circuit_breaker_states
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view circuit breaker states"
ON circuit_breaker_states
FOR SELECT
USING (true); -- Public read for status page

-- Cache metadata - users can only see their own cache entries
ALTER TABLE cache_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache metadata"
ON cache_metadata
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can manage cache metadata"
ON cache_metadata
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Performance metrics - append only, no updates
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert metrics"
ON performance_metrics
FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admins can view metrics"
ON performance_metrics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Distributed locks - only service role
ALTER TABLE distributed_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only system can manage locks"
ON distributed_locks
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');
```

### 3. Redis Data Structure Design

**Document your Redis key patterns:**

Create `docs/redis-schema.md`:

```markdown
# Redis Data Structure Schema

## Key Naming Convention
Pattern: `{namespace}:{type}:{identifier}:{sub-identifier}`

## Rate Limiting
- Key: `rl:{model}:{userId}:{window}`
- Type: Sorted Set
- TTL: Window duration
- Members: Timestamp of each request
- Score: Timestamp (for efficient cleanup)

Example:
```
rl:gemini-2.0-flash:user123:minute
Members: ["1706280001234", "1706280001567", ...]
```

## API Keys (Encrypted)
- Key: `api_key:{model}`
- Type: Hash
- TTL: None (persistent)
- Fields:
  - primary: encrypted primary key
  - fallback: encrypted fallback key
  - usage_count: current usage count
  - last_rotated: timestamp

## Circuit Breaker State
- Key: `cb:{service}:state`
- Type: Hash
- TTL: None (managed by application)
- Fields:
  - state: "closed" | "open" | "half-open"
  - failures: failure count
  - last_failure: timestamp
  - successes: success count in half-open

## Document Cache
- Key: `cache:doc:{contentHash}:{preferencesHash}`
- Type: String (compressed JSON)
- TTL: Variable based on complexity/tier

## Perceptual Hash Index
- Key: `phash:index`
- Type: Sorted Set
- TTL: None
- Members: Document IDs
- Score: Perceptual hash as number

## Enhancement Cache
- Key: `cache:enhance:{model}:{docHash}:{prefHash}`
- Type: String (compressed)
- TTL: Variable

## Request Coalescing
- Key: `coalesce:{operation}:{hash}`
- Type: String
- TTL: 60 seconds
- Value: Promise ID for deduplication

## Session State
- Key: `session:{userId}:{sessionId}`
- Type: Hash
- TTL: 24 hours (sliding)
- Fields:
  - socket_id: WebSocket ID
  - server_id: Server handling connection
  - connected_at: timestamp
  - last_activity: timestamp
```

### 4. Cache Invalidation Triggers

Create `supabase/migrations/20250126_cache_invalidation_triggers.sql`:

```sql
-- Function to publish cache invalidation events
CREATE OR REPLACE FUNCTION notify_cache_invalidation()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  payload := jsonb_build_object(
    'operation', TG_OP,
    'table', TG_TABLE_NAME,
    'id', COALESCE(NEW.id, OLD.id),
    'timestamp', NOW()
  );
  
  -- Add specific invalidation hints
  CASE TG_TABLE_NAME
    WHEN 'documents' THEN
      payload := payload || jsonb_build_object(
        'invalidate_patterns', ARRAY[
          'cache:doc:*:' || COALESCE(NEW.id, OLD.id) || ':*',
          'cache:enhance:*:' || COALESCE(NEW.id, OLD.id) || ':*'
        ]
      );
    WHEN 'users' THEN
      payload := payload || jsonb_build_object(
        'invalidate_patterns', ARRAY[
          'rl:*:' || COALESCE(NEW.id, OLD.id) || ':*',
          'session:' || COALESCE(NEW.id, OLD.id) || ':*'
        ]
      );
  END CASE;
  
  PERFORM pg_notify('cache_invalidation', payload::text);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to relevant tables
CREATE TRIGGER document_cache_invalidation
AFTER UPDATE OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION notify_cache_invalidation();

CREATE TRIGGER user_cache_invalidation
AFTER UPDATE ON users
FOR EACH ROW
WHEN (OLD.subscription_tier IS DISTINCT FROM NEW.subscription_tier)
EXECUTE FUNCTION notify_cache_invalidation();

-- Function to clean expired cache metadata
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache_metadata
  WHERE expires_at < NOW();
  
  -- Log cleanup stats
  INSERT INTO performance_metrics (metric_type, metric_name, metric_value, dimensions)
  VALUES (
    'cache',
    'cleanup_count',
    ROW_COUNT(),
    jsonb_build_object('timestamp', NOW())
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic cleanup
SELECT cron.schedule(
  'cleanup-cache-metadata',
  '*/15 * * * *', -- Every 15 minutes
  $$SELECT cleanup_expired_cache()$$
);
```

### 5. Data Migration Scripts

Create `supabase/migrations/20250126_migrate_existing_data.sql`:

```sql
-- Migrate existing rate limit data to new format
DO $$
DECLARE
  rate_limit_record RECORD;
BEGIN
  -- This is a one-time migration
  -- In production, this would migrate from old in-memory state
  
  -- Initialize circuit breaker states for known services
  INSERT INTO circuit_breaker_states (service_name, state)
  VALUES 
    ('gemini-2.0-flash', 'closed'),
    ('gpt-4o-mini', 'closed'),
    ('claude-3.5-sonnet', 'closed'),
    ('claude-4-sonnet', 'closed')
  ON CONFLICT (service_name) DO NOTHING;
  
  -- Create initial performance baselines
  INSERT INTO performance_metrics (metric_type, metric_name, metric_value, dimensions)
  SELECT 
    'baseline',
    'ai_response_time',
    CASE 
      WHEN model = 'gemini-2.0-flash' THEN 1.2
      WHEN model = 'gpt-4o-mini' THEN 0.8
      WHEN model = 'claude-3.5-sonnet' THEN 1.5
      WHEN model = 'claude-4-sonnet' THEN 2.0
    END,
    jsonb_build_object('model', model)
  FROM (
    SELECT DISTINCT model FROM ai_usage_tracking
  ) models;
END $$;

-- Add backward compatibility views
CREATE OR REPLACE VIEW v_active_rate_limits AS
SELECT 
  'rl:' || model || ':' || user_id || ':hour' as redis_key,
  COUNT(*) as request_count,
  MAX(created_at) as last_request,
  3600 - EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::INT as ttl_remaining
FROM ai_usage_tracking
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY model, user_id;

-- View for cache effectiveness
CREATE OR REPLACE VIEW v_cache_effectiveness AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
  COUNT(*) FILTER (WHERE cache_hit = false) as cache_misses,
  ROUND(
    COUNT(*) FILTER (WHERE cache_hit = true)::DECIMAL / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as hit_rate,
  SUM(CASE WHEN cache_hit = false THEN cost_usd ELSE 0 END) as cost_without_cache,
  SUM(cost_usd) as actual_cost,
  SUM(CASE WHEN cache_hit = false THEN cost_usd ELSE 0 END) - SUM(cost_usd) as savings
FROM ai_usage_tracking
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### 6. Database Performance Optimization

Create `supabase/migrations/20250126_performance_indexes.sql`:

```sql
-- Composite indexes for common queries
CREATE INDEX idx_ai_usage_user_model_time 
ON ai_usage_tracking(user_id, model, created_at DESC);

CREATE INDEX idx_documents_user_status_created 
ON documents(user_id, status, created_at DESC);

-- Partial indexes for specific queries
CREATE INDEX idx_documents_pending_enhancement 
ON documents(created_at) 
WHERE status = 'pending_enhancement';

CREATE INDEX idx_cache_metadata_active 
ON cache_metadata(document_id, cache_type) 
WHERE expires_at > NOW();

-- BRIN indexes for time-series data
CREATE INDEX idx_performance_metrics_timestamp_brin 
ON performance_metrics 
USING BRIN(timestamp) 
WITH (pages_per_range = 128);

-- Enable pg_stat_statements for query analysis
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries(
  threshold_ms INTEGER DEFAULT 100
)
RETURNS TABLE (
  query TEXT,
  calls BIGINT,
  mean_time DOUBLE PRECISION,
  total_time DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_stat_statements.query,
    pg_stat_statements.calls,
    pg_stat_statements.mean_exec_time,
    pg_stat_statements.total_exec_time
  FROM pg_stat_statements
  WHERE pg_stat_statements.mean_exec_time > threshold_ms
  ORDER BY pg_stat_statements.mean_exec_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;
```

### 7. Rollback Scripts

Create `supabase/migrations/20250126_rollback_distributed_state.sql`:

```sql
-- Rollback script (keep for safety)
-- Run only if needed to revert changes

-- Drop new tables
DROP TABLE IF EXISTS distributed_locks CASCADE;
DROP TABLE IF EXISTS circuit_breaker_states CASCADE;
DROP TABLE IF EXISTS cache_metadata CASCADE;
DROP TABLE IF EXISTS performance_metrics CASCADE;

-- Remove added columns
ALTER TABLE ai_usage_tracking
DROP COLUMN IF EXISTS cache_hit,
DROP COLUMN IF EXISTS fallback_model,
DROP COLUMN IF EXISTS circuit_breaker_state;

-- Drop functions
DROP FUNCTION IF EXISTS notify_cache_invalidation() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;
DROP FUNCTION IF EXISTS create_monthly_partition() CASCADE;
DROP FUNCTION IF EXISTS analyze_slow_queries(INTEGER) CASCADE;

-- Drop views
DROP VIEW IF EXISTS v_active_rate_limits CASCADE;
DROP VIEW IF EXISTS v_cache_effectiveness CASCADE;

-- Remove cron job
SELECT cron.unschedule('cleanup-cache-metadata');
```

## Migration Execution Strategy

### 1. Pre-Migration Checklist
```bash
# 1. Backup current database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Test migrations locally
supabase db reset --local
supabase migration up --local

# 3. Run migration tests
npm run test:migrations

# 4. Verify rollback works
supabase migration down --local
```

### 2. Migration Execution Order
1. Create new tables and indexes
2. Add columns to existing tables
3. Create functions and triggers
4. Insert initial data
5. Create views
6. Update RLS policies

### 3. Zero-Downtime Strategy
```sql
-- Use CREATE IF NOT EXISTS for all objects
-- Add columns with NULL allowed first
-- Populate data in background job
-- Add constraints after data migration
-- Switch application code to use new schema
-- Remove old columns in next release
```

## Coordination with Other Instances

### Instance 1 (State Management)
- Provide Redis key schema documentation
- Coordinate on Lua scripts for Redis
- Define TTL strategies together

### Instance 3 (Caching)
- Align on cache metadata tracking
- Coordinate on invalidation patterns
- Share perceptual hash storage design

### Instance 4 (Observability)
- Design metrics table partitioning
- Optimize for time-series queries
- Plan retention policies

### Instance 8 (DevOps)
- Coordinate on backup strategies
- Plan migration deployment
- Set up monitoring for new tables

## Daily Tasks

### Morning
1. Check migration status
2. Review slow query log
3. Monitor table sizes

### Continuous
1. Optimize new queries
2. Update migration scripts
3. Document schema changes

### End of Day
1. Backup any manual changes
2. Update migration documentation
3. Prepare rollback scripts

## Success Criteria

1. **Performance:**
- No queries slower than 100ms
- Efficient indexes for all access patterns
- Partitioning working for metrics

2. **Reliability:**
- All migrations reversible
- Zero data loss during migration
- RLS policies properly enforced

3. **Maintainability:**
- Clear documentation
- Automated migration tests
- Version control for all changes

Remember: Database changes are permanent. Test thoroughly!