# Testing Guide

## Overview

This project follows a three-tier testing strategy aligned with real service integration:

1. **Unit Tests (Jest)** - Fast, isolated component/function tests
2. **Integration Tests (Jest)** - Tests with real Docker services (Redis, PostgreSQL, R2-compatible storage)
3. **E2E Tests (Playwright)** - Full application flows with real services

## Philosophy

**We test against real services, not mocks.** This ensures our tests reflect production behavior and catch integration issues early.

### What We DON'T Mock

- Redis connections
- Database (Supabase/PostgreSQL) connections
- File storage (R2/S3) operations
- WebSocket connections
- External API calls (use test endpoints/sandbox when available)

### What We CAN Mock

- Time-based operations (Jest fake timers)
- Random number generation
- External services without test endpoints (last resort)

## Prerequisites

### Required Services

All tests require these services to be running:

#### 1. PostgreSQL/Supabase

```bash
# Option A: Local Supabase
supabase start

# Option B: Remote Supabase project (set in .env.local)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 2. Redis

```bash
# Option A: Local Docker
docker run -d -p 6379:6379 redis:7-alpine

# Option B: Upstash or remote Redis
REDIS_URL=redis://localhost:6379
# OR
UPSTASH_REDIS_URL=your_upstash_url
UPSTASH_REDIS_TOKEN=your_upstash_token
```

#### 3. Cloudflare R2 (or S3-compatible storage)

```bash
# Option A: Local MinIO (S3-compatible)
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"

# Then configure:
CLOUDFLARE_ACCOUNT_ID=test
CLOUDFLARE_ACCESS_KEY_ID=minioadmin
CLOUDFLARE_SECRET_ACCESS_KEY=minioadmin
CLOUDFLARE_R2_BUCKET_NAME=test-bucket
R2_ENDPOINT=http://127.0.0.1:9000
R2_REGION=us-east-1
R2_FORCE_PATH_STYLE=true

# Option B: Real Cloudflare R2
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_ACCESS_KEY_ID=your_access_key
CLOUDFLARE_SECRET_ACCESS_KEY=your_secret_key
CLOUDFLARE_R2_BUCKET_NAME=your_bucket
```

#### 4. AI Provider Keys (for enhancement tests)

```bash
# At least one is required:
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

### Environment Configuration

Copy and configure your test environment:

```bash
cp .env.example .env.local
# Edit .env.local with your service credentials
```

For E2E tests specifically, you may also need:

```bash
cp .env.local .env.test
# Edit .env.test for test-specific overrides
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- app/api/upload/__tests__/route.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Integration Tests

Integration tests require all services to be running:

```bash
# Ensure services are up first
docker ps  # Check Redis, MinIO if using Docker

# Run integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- lib/queue/__tests__/processor.integration.test.ts
```

### E2E Tests

E2E tests exercise the full application:

```bash
# Default: UI-only tests (no external service calls)
npm run test:e2e

# With real services (requires E2E_ENABLE_SERVICES=true)
E2E_ENABLE_SERVICES=true npm run test:e2e

# UI mode for debugging
E2E_ENABLE_SERVICES=true npm run test:e2e:ui

# Run specific project
npm run test:e2e:project:services  # Services-backed tests only
npm run test:e2e:project:ui        # UI-only tests

# Run focused tests
npm run test:e2e:export:focused    # Export flow only
npm run test:e2e:watchdog          # Watchdog smoke tests
```

### YOLO Mode (Per-Spec Dev Server)

For rapid iteration, YOLO mode starts/stops the dev server per spec:

```bash
# Default YOLO
npm run test:e2e:yolo

# With services
npm run test:e2e:yolo:services

# Focused on specific pattern
E2E_ENABLE_SERVICES=true npm run test:e2e:yolo:services:focused -- export

# Tune idle timeout
E2E_SUP_IDLE_MS=90000 npm run test:e2e:yolo
```

## Test Projects

Playwright runs multiple test projects:

### Core Projects

- **ui**: UI-only tests, no external service dependencies (default)
- **services**: Tests requiring real Supabase/Redis/R2 (tagged with `@services`)

### Additional Projects

- **free-tier**, **pro-tier**, **premium-tier**: Test different subscription levels
- **accessibility**: High-contrast, screen reader testing
- **mobile**: Mobile viewport testing
- **performance**: Performance profiling
- **websocket**: Real-time WebSocket testing
- **chromium**, **firefox**, **webkit**: Cross-browser testing

## Writing Tests

### Unit Test Example

```typescript
import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'

// Real implementation, shape behavior via mockResolvedValue
jest.mock('@/lib/supabase/server')
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('POST /api/upload', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user' } },
          error: null
        })
      }
    }
    mockCreateClient.mockResolvedValue(mockSupabase)
  })

  it('requires authentication', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null
    })

    const request = new Request('http://localhost:5000/api/upload', {
      method: 'POST'
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})
```

### E2E Test Example

```typescript
import { test, expect } from './fixtures/auth.fixture'
import TestHelpers from './utils/test-helpers'

test.describe('@services Document Enhancement Flow', () => {
  test('should upload and enhance document', async ({ page, authenticatedPage }) => {
    const helpers = new TestHelpers(page)

    // Upload document
    await page.goto('/dashboard')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('./test-fixtures/sample.png')

    // Wait for upload completion
    const uploadPromise = helpers.waitForApiResponse(/\/api\/upload/)
    const uploadResponse = await uploadPromise
    expect(uploadResponse.success).toBe(true)

    // Wait for enhancement
    const enhancementId = uploadResponse.enhancementId
    await helpers.pollApi(
      `/api/enhance/status/${enhancementId}`,
      (data) => data.status === 'completed',
      { maxAttempts: 30, interval: 2000 }
    )

    // Verify results page
    await expect(page).toHaveURL(/\/results\//)
  })
})
```

## Debugging Tests

### Unit Tests

```bash
# Run with verbose output
npm test -- --verbose

# Debug single test
node --inspect-brk node_modules/.bin/jest app/api/upload/__tests__/route.test.ts
```

### E2E Tests

```bash
# UI mode (visual debugging)
npm run test:e2e:ui

# Debug mode with traces
npm run test:e2e:trace:on

# View last report
npm run test:e2e:report
```

### Service Debugging

```bash
# Check service status
docker ps
redis-cli ping
curl $NEXT_PUBLIC_SUPABASE_URL/rest/v1/

# View logs
docker logs <container_id>
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432

      minio:
        image: minio/minio
        env:
          MINIO_ROOT_USER: minioadmin
          MINIO_ROOT_PASSWORD: minioadmin
        ports:
          - 9000:9000

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration
        env:
          REDIS_URL: redis://localhost:6379

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          E2E_ENABLE_SERVICES: 'true'
          REDIS_URL: redis://localhost:6379
```

## Troubleshooting

### "Services not available" error

- Check all required services are running: `docker ps`
- Verify environment variables in `.env.local`
- Test connectivity: `redis-cli ping`, `curl $NEXT_PUBLIC_SUPABASE_URL`

### "Authentication required" in tests

- Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check Supabase project is running and accessible
- Verify API keys haven't expired

### "Upload failed" in R2 tests

- Check R2/MinIO is accessible: `curl http://localhost:9000/minio/health/ready`
- Ensure bucket exists (MinIO: create via console at `http://localhost:9001`)
- Verify credentials: `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY`

### Tests timing out

- Increase timeouts in `playwright.config.ts`
- Check network connectivity to external services
- Review service logs for errors

### Flaky tests

- Tests should be deterministic with real services
- Check for race conditions (use proper `waitFor` helpers)
- Ensure test data isolation (unique user IDs, separate test buckets)

## Best Practices

1. **Test Data Isolation**: Each test should create its own data
2. **Cleanup**: Tests should clean up after themselves (users, files, DB records)
3. **Idempotency**: Tests should be runnable multiple times
4. **Parallelization**: Design tests to run in parallel safely
5. **Realistic Scenarios**: Test real user flows, not implementation details
6. **Error Cases**: Test error handling with real service failures

## Coverage Goals

- **Unit Tests**: 80% coverage minimum
- **Integration Tests**: All critical paths (upload, enhance, export)
- **E2E Tests**: Complete user journeys for each tier

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Supabase Testing](https://supabase.com/docs/guides/getting-started/local-development)
