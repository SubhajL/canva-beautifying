# Testing Quick Reference

## 🚀 Most Common Commands

```bash
# Run all unit tests
npm test

# Run E2E tests with UI (recommended)
npx playwright test --ui

# Run specific E2E test
npx playwright test e2e/01-auth.spec.ts

# Test a specific service
npm run test:supabase
npm run test:r2
npm run test:ai
```

## 📋 Complete Test Suite

### Before First Run
```bash
# Install Playwright browsers (one time)
node scripts/install-playwright.js

# Copy environment template
cp .env.example .env.local
# Then fill in your credentials
```

### Development Workflow
```bash
# 1. Start services
npm run dev          # Terminal 1
npm run websocket    # Terminal 2 (if needed)
npm run workers      # Terminal 3 (if needed)

# 2. Run tests during development
npm run test:watch   # Unit tests in watch mode

# 3. Run E2E test for current feature
npx playwright test --ui e2e/02-document-upload.spec.ts
```

### Pre-Commit Checklist
```bash
# 1. Lint and type check
npm run lint
npm run build

# 2. Run unit tests
npm test

# 3. Run E2E tests for changed features
npx playwright test e2e/01-auth.spec.ts  # If you changed auth
```

### Full Validation (Before Deploy)
```bash
# 1. Test all services
npm run test:supabase
npm run test:r2
npm run test:ai
npm run test:emails

# 2. Run all unit tests with coverage
npm run test:coverage

# 3. Run all E2E tests
npm run test:e2e

# 4. View test report
npx playwright show-report
```

## 🔍 Debugging Tests

### Debug E2E Tests
```bash
# Visual debugging
npx playwright test --debug

# See browser while running
npx playwright test --headed

# Slow motion to see each step
npx playwright test --headed --slowmo=1000

# Record video of test
npx playwright test --video=on
```

### Debug Unit Tests
```bash
# Run single test file
npm test -- __tests__/export-service.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should export"

# Debug in VS Code
# Add breakpoint and run "Jest: Debug" from command palette
```

## 📊 Test Types by Speed

1. **Fastest** (< 1s each)
   - Unit tests: `npm test`
   - Single integration: `npm run test:emails`

2. **Fast** (1-10s each)
   - Service tests: `npm run test:supabase`
   - Single E2E test: `npx playwright test e2e/01-auth.spec.ts`

3. **Slow** (10-60s each)
   - Full E2E suite: `npm run test:e2e`
   - AI service tests: `npm run test:ai`
   - Enhancement flow: `e2e/03-enhancement-process.spec.ts`

## 🎯 What to Test When

### Changed Authentication
```bash
npm test -- auth
npx playwright test e2e/01-auth.spec.ts
```

### Changed File Upload
```bash
npm test -- upload
npm run test:r2
npx playwright test e2e/02-document-upload.spec.ts
```

### Changed Enhancement Logic
```bash
npm test -- enhance
npm run test:ai
npx playwright test e2e/03-enhancement-process.spec.ts
```

### Changed UI Components
```bash
npm test -- components
npx playwright test --ui  # Visual check
```

### Changed API Endpoints
```bash
npm test -- api
npm run test:integration
npx tsx scripts/e2e-test.ts  # Full API test
```

## ⚡ Performance Tips

1. **Run in parallel:**
   ```bash
   npx playwright test --workers=4
   ```

2. **Run only changed tests:**
   ```bash
   npx playwright test --grep="@smoke"  # Tag tests with @smoke
   ```

3. **Skip slow tests during development:**
   ```bash
   npx playwright test --grep-invert="@slow"
   ```

4. **Use focused tests:**
   ```typescript
   test.only('this test only', async () => {
     // Temporarily run only this test
   });
   ```

## 🔧 Environment Variables

### Minimal for Unit Tests
```env
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### Required for E2E Tests
```env
# Add to above:
NEXT_PUBLIC_APP_URL=http://localhost:5000
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Required for Service Tests
```env
# Add service-specific keys:
R2_ENDPOINT=xxx
OPENAI_API_KEY=xxx
RESEND_API_KEY=xxx
# etc.
```

## 📈 Coverage Goals

- **Green:** > 80% coverage ✅
- **Yellow:** 60-80% coverage ⚠️
- **Red:** < 60% coverage ❌

Check coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## 🆘 Quick Fixes

**"Cannot find module"**
```bash
npm install
```

**"Browser not found"**
```bash
npx playwright install
```

**"Port 3000 already in use"**
```bash
lsof -ti:3000 | xargs kill -9
```

**"Test timeout"**
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
  // test code
});
```

**"Element not found"**
```typescript
// Wait longer
await page.waitForSelector('.element', { timeout: 30000 });

// Or check if it exists first
if (await page.locator('.element').isVisible()) {
  await page.click('.element');
}
```