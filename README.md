# BeautifyAI - AI-Powered Document Enhancement Platform

BeautifyAI is an AI-powered platform that automatically enhances and beautifies educational worksheets and business documents. Using advanced vision AI models, the platform analyzes design flaws and applies intelligent enhancements to create visually appealing, pedagogically sound, and professional-looking documents.

## 🚀 Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **UI**: Tailwind CSS + Shadcn/ui
- **State Management**: Zustand + React Query (TanStack Query)
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL via Supabase
- **File Storage**: Cloudflare R2
- **AI Models**: 
  - Vision: Gemini 2.0 Flash, GPT-4.1 Mini, Claude 3.5/4 Sonnet
  - Image Generation: Stable Diffusion XL, DALL-E 3
- **Queue System**: BullMQ with Redis
- **Real-time**: Socket.io
- **Payment**: Stripe

## 🛠️ Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/canva-beautifying.git
cd canva-beautifying
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) to see the application.

## 📝 Project Structure

```
canva-beautifying/
├── app/                    # Next.js app directory
├── components/            # React components
│   └── ui/               # Shadcn/ui components
├── lib/                   # Utility functions
├── public/                # Static assets
├── .taskmaster/          # TaskMaster project files
│   ├── docs/            # Documentation (PRD)
│   └── tasks/           # Task definitions
└── ...
```

## 🎯 Features

- **Document Upload**: Drag-and-drop support for PNG, JPG, and PDF
- **AI Analysis**: Automatic detection of design issues
- **Smart Enhancement**: AI-powered improvements to layout, colors, and typography
- **Multiple Export Formats**: PNG, JPG, PDF, and Canva-compatible
- **Batch Processing**: Handle up to 10 documents at once
- **Real-time Progress**: Live updates during enhancement
- **Subscription Tiers**: Free, Basic, Pro, and Premium plans

## 🔧 Development

### Testing

We follow a **real services** testing philosophy - tests exercise actual infrastructure, not mocks.

#### Quick Start

```bash
# Unit tests (mocked dependencies, fast)
npm test

# Skip WebSocket tests (require running server)
JEST_SKIP_WEBSOCKET_TESTS=true npm test

# Integration tests (real services required)
npm run test:integration

# E2E tests - UI only (no external services)
npm run test:e2e

# E2E tests - with real services
E2E_ENABLE_SERVICES=true npm run test:e2e
```

#### Test Types

1. **Unit Tests** (`npm test`)
   - Fast, isolated tests with mocked external dependencies
   - Use Jest with jsdom environment
   - Skip WebSocket tests if server isn't running: `JEST_SKIP_WEBSOCKET_TESTS=true npm test`

2. **Integration Tests** (`npm run test:integration`)
   - Real database, Redis, and R2 storage
   - Requires all services running locally or remotely
   - Tests end-to-end API flows with actual infrastructure

3. **E2E Tests** (`npm run test:e2e`)
   - **UI Project** (`@ui` tag): No external services, UI behavior only
   - **Services Project** (`@services` tag): Full stack with real Supabase, Redis, R2, AI

#### Required Environment Variables

For **integration and service-backed E2E tests**:

```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Storage (Cloudflare R2 or local MinIO)
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name

# For local MinIO testing:
# R2_ENDPOINT=http://127.0.0.1:9000
# R2_REGION=us-east-1
# R2_FORCE_PATH_STYLE=true

# Redis
REDIS_URL=redis://localhost:6379
# OR
UPSTASH_REDIS_URL=your_upstash_url
UPSTASH_REDIS_TOKEN=your_upstash_token

# AI Providers (at least one required for enhancement tests)
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:5000
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:5001
```

#### Local Service Setup

**Option 1: Supabase CLI** (recommended)
```bash
supabase start
# Provides local PostgreSQL, Auth, and Storage
```

**Option 2: Docker Compose**
```bash
# Start Redis and MinIO
docker-compose up -d redis minio

# MinIO console: http://localhost:9001
# Default credentials: minioadmin/minioadmin
```

See [TESTING.md](./TESTING.md) for complete setup instructions and troubleshooting.


### Building for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## 📄 License

This project is licensed under the MIT License.
## E2E Projects and Gating

We run two Playwright projects to keep PRs fast and service E2E explicit:

- `ui` (default): UI-only specs. Never requires external services. Filters out specs tagged with `@services`.
- `services`: Only specs tagged with `@services`. Requires real Supabase/Redis/R2 and `E2E_ENABLE_SERVICES=true`.

Base URL defaults to `http://localhost:7072` (UI worktree). Adjust via `NEXT_PUBLIC_APP_URL` if needed.

### Commands

- UI-only: `npm run test:e2e:project:ui`
- Services E2E: `npm run test:e2e:project:services`
- Focused export flow: `npm run test:e2e:export:focused`
- Smoke export test: `npm run test:e2e:export:smoke`
- Watchdog check: `npm run test:e2e:watchdog`
- Open report: `npm run test:e2e:report`
- Debug (always-on artifacts): `npm run test:e2e:trace:on`
- Debug UI mode (always-on): `npm run test:e2e:trace:on:ui`
 - YOLO supervisor (per-spec, idle-kill): `npm run test:e2e:yolo`
   - With services: `npm run test:e2e:yolo:services`
   - Tunables: `E2E_SUP_IDLE_MS=90000 npm run test:e2e:yolo` or pass `--idle=90000` and `--project=services`

### Service Readiness

Global setup performs readiness checks only when `E2E_ENABLE_SERVICES=true`. UI-only runs skip checks.

Required env for services:

- App: `NEXT_PUBLIC_APP_URL`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Redis: `REDIS_URL` (or Upstash equivalent)
- R2: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`

### Watchdog & Safe Waits

To avoid silent hangs, every Playwright test attaches a lightweight network heartbeat (requests/responses and console warnings). Critical waits should use safe utilities that bail out quickly and capture diagnostics:

- `attachNetworkHeartbeat(page, { label })`: Network logs with 5xx warnings.
- `captureDiagnostics(page, label)`: Screenshot + minimal DOM dump into `test-results/diagnostics`.
- `withBailout`, `waitForSelectorSafe`, `waitForResponseSafe`: Short, diagnostic waits.

The default fixtures (`e2e/fixtures/base.fixture.ts` and `e2e/fixtures/auth.fixture.ts`) attach the heartbeat automatically.
