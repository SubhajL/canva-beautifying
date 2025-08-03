# Testing Guide for Canva Beautifying

This guide covers all testing scripts, their purposes, and how to run them effectively.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Unit Tests (Jest)](#unit-tests-jest)
3. [Integration Tests](#integration-tests)
4. [E2E Tests (Playwright)](#e2e-tests-playwright)
5. [Service-Specific Tests](#service-specific-tests)
6. [Test Coverage](#test-coverage)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# R2 Storage (Required for storage tests)
R2_ENDPOINT=your_r2_endpoint
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=your_r2_public_url

# Redis (Required for queue tests)
REDIS_URL=redis://localhost:6379

# AI Services (Required for AI tests)
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Email (Required for email tests)
RESEND_API_KEY=your_resend_key

# Stripe (Required for payment tests)
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# WebSocket (Optional)
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:5001
```

### Install Dependencies

```bash
# Install all dependencies
npm install

# Install Playwright browsers (for E2E tests)
node scripts/install-playwright.js
# or
npx playwright install
```

## Unit Tests (Jest)

### 1. Run All Unit Tests

```bash
npm test
```

**What it tests:**
- Individual functions and components
- Business logic in isolation
- React component rendering
- Utility functions

**Example output:**
```
PASS  __tests__/export-service.test.ts
  ExportService
    exportDocument
      ✓ should export PNG with default options (45ms)
      ✓ should export JPG with quality setting (23ms)
      ✓ should export PDF with custom settings (67ms)
```

### 2. Run Tests in Watch Mode

```bash
npm run test:watch
```

**Purpose:** Automatically re-runs tests when files change during development.

**Best for:** TDD (Test-Driven Development) workflow.

### 3. Run Tests with Coverage

```bash
npm run test:coverage
```

**What it does:**
- Runs all tests
- Generates a coverage report
- Shows percentage of code covered by tests
- Creates an HTML report in `coverage/lcov-report/index.html`

**Example output:**
```
---------------------------|---------|----------|---------|---------|
File                       | % Stmts | % Branch | % Funcs | % Lines |
---------------------------|---------|----------|---------|---------|
All files                  |   78.43 |    65.22 |   81.25 |   78.43 |
 lib/export                |   85.71 |    75.00 |   90.00 |   85.71 |
  export-service.ts        |   85.71 |    75.00 |   90.00 |   85.71 |
---------------------------|---------|----------|---------|---------|
```

### 4. Run Integration Tests Only

```bash
npm run test:integration
```

**What it tests:**
- Multiple components working together
- Service interactions
- Database operations with test database

**File pattern:** `**/*.integration.test.ts`

### 5. Run Production Tests

```bash
npm run test:production
```

**What it tests:**
- Production-specific configurations
- Performance benchmarks
- Production API endpoints

**File pattern:** `**/*.prod.test.ts`

## Integration Tests

These are standalone scripts that test specific services:

### 1. Test Supabase Connection

```bash
npm run test:supabase
```

**What it tests:**
- Database connection
- Authentication flow
- Row Level Security (RLS) policies
- Database functions
- User creation and permissions

**Expected output:**
```
🔧 Testing Supabase Connection...

✅ Connected to Supabase
✅ Database connection verified
✅ Auth service is accessible
✅ RLS policies are working correctly
✅ Database functions are accessible

✨ All Supabase tests passed!
```

**Common issues:**
- Wrong Supabase URL or keys
- RLS policies blocking access
- Database migrations not run

### 2. Test R2 Storage

```bash
npm run test:r2
```

**What it tests:**
- R2 bucket connection
- File upload capabilities
- File retrieval
- Signed URL generation
- File deletion
- Public URL access

**Expected output:**
```
🔧 Testing R2 Storage...

✅ Connected to R2
✅ Test upload successful
✅ File retrieval working
✅ Signed URLs generating correctly
✅ File deletion successful
✅ Public URL accessible

✨ All R2 tests passed!
```

**Common issues:**
- Incorrect R2 credentials
- CORS configuration issues
- Bucket permissions

### 3. Test AI Services

```bash
npm run test:ai
```

**What it tests:**
- OpenAI GPT-4 connection
- Anthropic Claude connection
- Google Gemini connection
- Vision capabilities
- Text generation
- Token counting
- Error handling and fallbacks

**Expected output:**
```
🔧 Testing AI Services...

Testing OpenAI...
✅ OpenAI GPT-4o-mini working
✅ OpenAI GPT-4o working
✅ OpenAI Vision API working

Testing Anthropic...
✅ Claude 3.5 Sonnet working
✅ Claude Vision working

Testing Google Gemini...
✅ Gemini 2.0 Flash working
✅ Gemini Vision working

✨ All AI services operational!
```

**Common issues:**
- Invalid API keys
- Rate limits exceeded
- Model not available in region

### 4. Test Image Generation

```bash
npm run test:image-generation
```

**What it tests:**
- Image generation pipeline
- Canvas operations
- SVG rendering
- PNG/JPG export
- Image optimization

**Basic version:**
```bash
npm run test:images
```

**Enhanced version with more tests:**
```bash
npm run test:image-generation
```

### 5. Test Email Service

```bash
npm run test:emails
```

**What it tests:**
- Email template rendering
- Resend API connection
- Email sending (test mode)
- Template variables
- HTML/Text content generation

**Expected output:**
```
🔧 Testing Email Service...

✅ Email templates rendering correctly
✅ Resend API connected
✅ Test email would be sent to: test@example.com
✅ Beta notification system working

✨ Email tests passed!
```

### 6. Test Export Service

```bash
npm run test:export
```

**What it tests:**
- Document export pipeline
- Format conversions (PNG, JPG, PDF)
- File compression
- Metadata preservation
- Export API endpoints

## E2E Tests (Playwright)

### Setup for E2E Tests

```bash
# Install Playwright browsers (first time only)
node scripts/install-playwright.js
```

### 1. Run All E2E Tests

```bash
npm run test:e2e
```

**What it tests:**
- Complete user flows
- Real browser interactions
- API integrations
- UI responsiveness
- Cross-browser compatibility

**Test Suites:**
1. **Authentication** (`01-auth.spec.ts`)
   - User signup
   - User login
   - Password reset
   - OAuth flows
   - Session management

2. **Document Upload** (`02-document-upload.spec.ts`)
   - File upload
   - Drag and drop
   - File validation
   - Progress tracking
   - Error handling

3. **Enhancement Process** (`03-enhancement-process.spec.ts`)
   - Style selection
   - Enhancement options
   - Processing progress
   - Real-time updates
   - Completion handling

4. **Results & Export** (`04-results-export.spec.ts`)
   - View results
   - Before/after comparison
   - Download options
   - Export formats
   - Sharing features

5. **User Dashboard** (`05-user-dashboard.spec.ts`)
   - Enhancement history
   - Usage statistics
   - Search and filter
   - Pagination
   - Quick actions

### 2. Run E2E Tests with UI

```bash
npx playwright test --ui
```

**Benefits:**
- Visual test execution
- Step-by-step debugging
- Time-travel debugging
- Network inspection
- Console logs

### 3. Run Specific Test File

```bash
# Run only authentication tests
npx playwright test e2e/01-auth.spec.ts

# Run only upload tests
npx playwright test e2e/02-document-upload.spec.ts
```

### 4. Run Tests in Specific Browser

```bash
# Chrome only
npx playwright test --project=chromium

# Firefox only
npx playwright test --project=firefox

# Safari only
npx playwright test --project=webkit

# Mobile Chrome
npx playwright test --project="Mobile Chrome"
```

### 5. Run E2E Tests in Debug Mode

```bash
npx playwright test --debug
```

**Features:**
- Pause at each step
- Inspect page state
- Modify test on the fly

### 6. Run E2E Tests Against Staging

```bash
STAGING_URL=https://staging.canvabeautifying.com npm run test:e2e:staging
```

### 7. Generate E2E Test Report

```bash
# After running tests
npx playwright show-report
```

**Report includes:**
- Test results summary
- Screenshots on failure
- Videos of failed tests
- Network logs
- Console logs

### 8. Run E2E Tests in Headed Mode

```bash
npx playwright test --headed
```

**Purpose:** See the browser while tests run (useful for debugging).

### 9. Run Tests with Specific Configuration

```bash
# Slow motion (see each action)
npx playwright test --headed --slowmo=1000

# With video recording
npx playwright test --video=on

# With screenshots
npx playwright test --screenshot=on
```

## Service-Specific Tests

### Complete System Test

```bash
# Run the comprehensive e2e test script
npx tsx scripts/e2e-test.ts
```

**What it tests:**
- All infrastructure connections
- Complete user journey
- Service integrations
- Performance metrics

**Note:** Requires all services to be running and configured.

## Test Coverage

### Generate Full Coverage Report

```bash
# Run all tests with coverage
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Goals

- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

## Troubleshooting

### Common Issues and Solutions

#### 1. Playwright Tests Failing

**Issue:** "Browser not found"
```bash
# Solution: Install browsers
npx playwright install
```

**Issue:** "Timeout waiting for selector"
```bash
# Solution: Increase timeout in test
await page.waitForSelector('selector', { timeout: 30000 });
```

**Issue:** "Connection refused"
```bash
# Solution: Ensure dev server is running
npm run dev  # In another terminal
```

#### 2. Service Tests Failing

**Issue:** "Cannot connect to Supabase"
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL

# Verify .env.local exists
ls -la .env.local
```

**Issue:** "R2 access denied"
```bash
# Check R2 credentials and bucket permissions
# Ensure CORS is configured for your domain
```

#### 3. AI Tests Failing

**Issue:** "Rate limit exceeded"
```bash
# Wait and retry, or use different API key
# Check your API usage dashboard
```

#### 4. Running Tests in CI/CD

```bash
# Set CI environment variable
CI=true npm test

# Run E2E tests in CI mode
CI=true npm run test:e2e
```

### Debug Mode for Any Test

```bash
# Add DEBUG environment variable
DEBUG=* npm test

# Specific debug namespace
DEBUG=app:* npm test
```

### Test Database Setup

For integration tests, use a separate test database:

```bash
# Set test database URL
DATABASE_URL=postgresql://user:pass@localhost:5432/canva_test npm test
```

## Best Practices

1. **Run tests before committing:**
   ```bash
   npm test && npm run lint
   ```

2. **Use watch mode during development:**
   ```bash
   npm run test:watch
   ```

3. **Run E2E tests before deployment:**
   ```bash
   npm run test:e2e
   ```

4. **Test specific features after changes:**
   ```bash
   # After changing auth
   npx playwright test e2e/01-auth.spec.ts
   ```

5. **Keep tests fast:**
   - Mock external services in unit tests
   - Use test data factories
   - Clean up after tests

## Writing New Tests

### Unit Test Example

```typescript
// __tests__/new-feature.test.ts
import { newFeature } from '@/lib/new-feature';

describe('NewFeature', () => {
  it('should do something', () => {
    const result = newFeature('input');
    expect(result).toBe('expected output');
  });
});
```

### E2E Test Example

```typescript
// e2e/new-feature.spec.ts
import { test, expect } from '@playwright/test';

test('new feature works', async ({ page }) => {
  await page.goto('/new-feature');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

## Summary

- **Quick check:** `npm test`
- **Full validation:** `npm test && npm run test:e2e`
- **Before deployment:** Run all service tests + E2E tests
- **During development:** Use watch mode and specific test files

For more help, check the test files themselves - they include detailed comments and examples.