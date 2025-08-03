# Task 21: Model Selection Logic - Setup Guide

This guide covers the manual setup required after implementing the model selection logic (Task 21).

## Database Setup

### 1. Run Database Migrations

The model selection logging requires new database tables. Run the following migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually run the migration
supabase migration up
```

This will create:
- `model_selection_logs` table for tracking model selection decisions
- `ai_usage_tracking` table for tracking AI usage and costs
- Associated indexes and RLS policies

### 2. Environment Variables

No new environment variables are required for Task 21. The existing AI model API keys are used:

```env
# AI Model API Keys (already in .env.example)
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional: Fallback API Keys
GEMINI_API_KEY_FALLBACK=
OPENAI_API_KEY_FALLBACK=
ANTHROPIC_API_KEY_FALLBACK=
```

## Testing the Implementation

### 1. Run Unit Tests

```bash
npm test lib/ai/__tests__/model-selector.test.ts
```

### 2. Run Manual Test Script

```bash
npm run tsx scripts/test-model-selection.ts
```

This will test various scenarios including:
- Different user tiers
- Document complexity levels
- Cost optimization
- A/B testing
- Performance tracking

### 3. Verify Database Tables

Check that the tables were created successfully:

```sql
-- In Supabase SQL Editor
SELECT * FROM information_schema.tables 
WHERE table_name IN ('model_selection_logs', 'ai_usage_tracking');
```

## A/B Testing Configuration

The A/B testing framework is initialized with two default tests:

1. **Cost Optimization for Basic Tier** (`cost-opt-basic-tier`)
   - Target: 50% of basic tier users
   - Tests aggressive cost optimization

2. **Quality-First for Premium** (`quality-first-premium`)
   - Target: 30% of premium tier users
   - Tests quality-biased model selection

To modify or add new tests, edit:
```typescript
// lib/ai/utils/ab-testing.ts
ABTestManager.addTest({
  id: 'your-test-id',
  name: 'Your Test Name',
  // ... configuration
})
```

## Monitoring and Analytics

### View Model Selection Logs

```sql
-- Recent model selections
SELECT 
  created_at,
  selected_model,
  user_tier,
  document_complexity,
  success,
  response_time,
  cost
FROM model_selection_logs
ORDER BY created_at DESC
LIMIT 100;

-- Model performance by tier
SELECT 
  user_tier,
  selected_model,
  COUNT(*) as requests,
  AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
  AVG(response_time) as avg_response_time,
  AVG(cost) as avg_cost
FROM model_selection_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_tier, selected_model;
```

### View AI Usage Statistics

```sql
-- User's usage stats (last 30 days)
SELECT * FROM get_user_ai_usage_stats('user-uuid-here', 30);

-- Total usage by model
SELECT 
  model,
  COUNT(*) as requests,
  SUM(tokens_used) as total_tokens,
  SUM(cost) as total_cost
FROM ai_usage_tracking
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY model
ORDER BY total_cost DESC;
```

## Integration with Existing Services

The model selection logic is automatically integrated into:

1. **AIService** (`lib/ai/ai-service.ts`)
   - Automatically selects models based on criteria
   - Tracks performance and logs selections
   - Handles fallbacks on failure

2. **Enhancement Pipeline** (when implemented)
   - Will use `ModelSelector.selectModel()` for each stage
   - Complexity determined by document analysis

3. **API Endpoints**
   - Model selection happens transparently
   - Selected model returned in response metadata

## Troubleshooting

### Models Not Being Selected Correctly

1. Check API keys are configured:
```typescript
// Verify in code
const config = aiService.validateConfiguration();
console.log(config);
```

2. Check user tier mapping:
```sql
SELECT id, email, subscription_tier FROM users WHERE id = 'user-id';
```

### Logging Not Working

1. Ensure migrations ran successfully
2. Check RLS policies allow inserts
3. Verify Supabase service role key is configured

### A/B Tests Not Running

1. Check test is active and within date range
2. Verify user matches target audience
3. Check user assignment with test ID

## Next Steps

With Task 21 complete, the model selection logic is ready for:

1. Integration with the enhancement pipeline (Task 22)
2. Production monitoring and optimization
3. A/B test result analysis
4. Cost optimization based on usage patterns