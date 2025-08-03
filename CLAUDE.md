# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (http://localhost:5000)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test:r2      # Test Cloudflare R2 storage integration
npm run test:supabase # Test Supabase database connection
npm run test:ai      # Test AI model integrations
npm run workers      # Start BullMQ worker processes
npm run workers:dev  # Start workers with hot reload
npm run websocket    # Start WebSocket server
npm run websocket:dev # Start WebSocket server with hot reload
```

## Architecture Overview

This is an AI-powered document enhancement platform that analyzes and improves visual documents (worksheets, presentations, marketing materials) using multiple AI models.

### Core Services Architecture

1. **Web Service (Next.js 14)**: Handles UI, authentication, and API gateway
2. **AI Service Layer**: Orchestrates multiple AI models with intelligent selection
3. **Queue System**: BullMQ/Redis for async processing
4. **Storage**: Cloudflare R2 for files, Supabase for data

### Key Architectural Patterns

#### Multi-Model AI Strategy
The AI integration uses a sophisticated abstraction layer:
- `BaseAIProvider` abstract class defines the interface
- Model-specific providers inherit and implement (Gemini, OpenAI, Claude)
- `AIService` orchestrates model selection with automatic fallbacks
- `ModelSelector` routes based on user tier, document complexity, and failures

Model selection by tier:
- Free: Gemini 2.0 Flash only
- Basic: Gemini + GPT-4o Mini  
- Pro: All models with intelligent selection
- Premium: Ensemble approach

#### File Storage Pattern
```
R2 Bucket Structure:
original/{userId}/{documentId}    # User uploads
enhanced/{userId}/{documentId}    # Processed files
temp/{jobId}/                     # Processing workspace
assets/{enhancementId}/           # Generated assets
```

#### Database Design
- Custom PostgreSQL types for type safety (subscription_tier_enum, etc.)
- Row Level Security (RLS) for user data isolation
- Trigger-based user creation from Supabase auth
- AI usage tracking table for cost management

#### Authentication Flow
- Supabase handles auth with Google/Microsoft OAuth
- Middleware protects app routes (/(app)/*)
- Auth context provides hooks for components
- Automatic user record creation on first sign-in

#### Real-time Updates (WebSocket)
- Socket.io server runs on port 5001 (configurable)
- Authentication via Supabase JWT tokens
- Room-based updates for document progress
- Automatic reconnection with exponential backoff
- Progress tracking for enhancement pipeline stages

#### API Architecture (v1)
- RESTful endpoints under `/api/v1/enhance`
- Bearer token authentication (Supabase JWT)
- Rate limiting: 100 req/min globally, per-tier limits for enhancements
- Standardized response format with metadata
- Webhook support for async status updates
- CORS enabled for cross-origin requests

### Non-Obvious Implementation Details

1. **API Key Management**: The `apiKeyManager` supports primary/fallback keys with automatic rotation
2. **Rate Limiting**: Per-user, per-model limits with time-window tracking in memory
3. **Cost Tracking**: All AI usage is tracked to `ai_usage_tracking` table with periodic flushing
4. **Model Fallbacks**: Failed requests automatically retry with alternative models
5. **Enhancement Pipeline**: Upload → Queue → Analyze → Enhance → Export (each step is decoupled)
6. **WebSocket Security**: Socket.io authenticates via Supabase JWT in handshake auth
7. **Queue Progress**: BullMQ job events are automatically forwarded to WebSocket rooms
8. **Service Architecture**: Workers and WebSocket server run as separate processes for scalability
9. **API Rate Limiting**: Implemented at edge middleware level with per-IP and per-user limits
10. **API Response Format**: Standardized JSON responses with success/error states and metadata

### Current Implementation Status

**Completed:**
- Project setup (Next.js, Tailwind, Shadcn/ui)
- Database schema and migrations
- R2 storage integration
- Complete AI model framework
- Basic upload interface
- Landing page
- User authentication flows (Supabase with Google/Microsoft OAuth)
- Queue system setup (BullMQ with Redis)
- Enhancement pipeline (4-stage process)
- WebSocket integration (Socket.io for real-time updates)
- RESTful API v1 endpoints with authentication and rate limiting

**In Progress:**
- Document analysis engine
- Enhancement generation
- Export functionality

**Not Started:**
- Payment integration
- Subscription management
- Usage tracking and limits

### Important Context

The project follows a phased approach defined in the PRD:
- Phase 1 (MVP): Basic enhancement capability
- Phase 2: Batch processing and optimizations
- Phase 3: Advanced AI features
- Phase 4: Enterprise features

Development is tracked using TaskMaster AI with 40 defined tasks. Current focus is completing Phase 1 infrastructure before moving to the enhancement engine.