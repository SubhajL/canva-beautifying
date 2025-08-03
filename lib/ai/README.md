# AI Model Integration Framework

This module provides a unified interface for integrating multiple AI vision models for document analysis and enhancement.

## Features

- **Multi-Model Support**: Integrates with Gemini 2.0 Flash, GPT-4o Mini, Claude 3.5 Sonnet, and Claude 4 Sonnet
- **Intelligent Model Selection**: Automatically selects the best model based on user tier, document complexity, and processing priority
- **Rate Limiting**: Built-in rate limiting to prevent API abuse and manage costs
- **API Key Management**: Secure API key storage with rotation support
- **Cost Tracking**: Detailed cost tracking and usage analytics
- **Fallback Mechanisms**: Automatic fallback to alternative models on failure
- **Type Safety**: Full TypeScript support with comprehensive types

## Configuration

### Environment Variables

```bash
# Gemini API Keys
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_KEY_FALLBACK=your-fallback-gemini-key # Optional

# OpenAI API Keys
OPENAI_API_KEY=your-openai-api-key
OPENAI_API_KEY_FALLBACK=your-fallback-openai-key # Optional

# Anthropic API Keys
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_API_KEY_FALLBACK=your-fallback-anthropic-key # Optional
```

## Usage

### Basic Document Analysis

```typescript
import { aiService } from '@/lib/ai'

const result = await aiService.analyzeDocument(
  'https://example.com/document.jpg',
  {
    documentUrl: 'https://example.com/document.jpg',
    documentType: 'worksheet',
    userTier: 'pro',
    preferences: {
      style: 'modern',
      colorScheme: 'vibrant',
      targetAudience: 'children'
    }
  },
  'user-123'
)

console.log('Analysis:', result.analysis)
console.log('Suggestions:', result.suggestedEnhancements)
```

### Manual Model Selection

```typescript
import { ModelSelector } from '@/lib/ai'

const model = ModelSelector.selectModel({
  userTier: 'premium',
  documentComplexity: 'high',
  processingPriority: 'quality',
  previousFailures: ['gemini-2.0-flash'] // Exclude failed models
})
```

### Cost Tracking

```typescript
import { costTracker } from '@/lib/ai'

// Get user usage
const usage = await costTracker.getUserUsage(
  'user-123',
  new Date('2024-01-01'),
  new Date('2024-01-31')
)

console.log('Total cost:', usage.totalCost)
console.log('By model:', usage.byModel)
```

### Rate Limit Checking

```typescript
import { rateLimiter } from '@/lib/ai'

const check = await rateLimiter.checkLimit('gpt-4o-mini', 'user-123')
if (!check.allowed) {
  console.log(`Rate limited. Retry after ${check.retryAfter} seconds`)
}
```

## Model Tiers and Capabilities

### Free Tier
- **Models**: Gemini 2.0 Flash
- **Use Case**: Basic document analysis
- **Speed**: Fast
- **Quality**: Good

### Basic Tier
- **Models**: Gemini 2.0 Flash, GPT-4o Mini
- **Use Case**: Enhanced analysis with fallback
- **Speed**: Fast to Medium
- **Quality**: Good to Very Good

### Pro Tier
- **Models**: GPT-4o Mini, Claude 3.5 Sonnet, Gemini 2.0 Flash
- **Use Case**: Professional document enhancement
- **Speed**: Medium
- **Quality**: Very Good to Excellent

### Premium Tier
- **Models**: Claude 4 Sonnet, Claude 3.5 Sonnet, GPT-4o Mini, Gemini 2.0 Flash
- **Use Case**: Highest quality analysis and enhancement
- **Speed**: Medium to Slow
- **Quality**: Excellent

## Testing

Run the test script to verify your configuration:

```bash
# Set test image URL (optional)
export TEST_IMAGE_URL="https://example.com/test-document.jpg"

# Run test
npm run test:ai
```

## Architecture

```
lib/ai/
├── index.ts              # Main exports
├── types.ts              # TypeScript type definitions
├── ai-service.ts         # Main service orchestrator
├── base-provider.ts      # Abstract base class for providers
├── model-selector.ts     # Intelligent model selection logic
├── providers/
│   ├── gemini.ts        # Google Gemini integration
│   ├── openai.ts        # OpenAI GPT integration
│   └── claude.ts        # Anthropic Claude integration
└── utils/
    ├── rate-limiter.ts   # Rate limiting implementation
    ├── api-key-manager.ts # API key management
    └── cost-tracker.ts   # Usage and cost tracking
```

## Error Handling

The framework includes comprehensive error handling:

- **Automatic Retries**: Failed requests are retried with exponential backoff
- **Model Fallback**: Automatically falls back to alternative models on failure
- **Rate Limit Handling**: Gracefully handles rate limit errors
- **API Key Rotation**: Supports automatic API key rotation on quota exhaustion

## Cost Optimization

- **Smart Model Selection**: Chooses the most cost-effective model for the task
- **Token Estimation**: Estimates token usage before making requests
- **Usage Tracking**: Detailed tracking helps identify cost optimization opportunities
- **Batch Processing**: Support for efficient batch document processing

## Security

- **API Key Security**: Keys are never exposed in client-side code
- **User Isolation**: Rate limits and costs are tracked per user
- **Audit Trail**: All API usage is logged for security auditing