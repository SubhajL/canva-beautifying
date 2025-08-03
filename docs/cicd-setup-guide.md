# CI/CD Setup Guide for BeautifyAI

## What is CI/CD?

### Continuous Integration (CI)
**Continuous Integration** is the practice of automatically testing and validating code changes whenever developers push to the repository. It ensures that new code integrates well with existing code.

**Key Benefits:**
- Catch bugs early before they reach production
- Ensure code quality standards are met
- Prevent "it works on my machine" problems
- Reduce integration conflicts

### Continuous Deployment/Delivery (CD)
**Continuous Deployment** automatically deploys code to production after passing all tests. **Continuous Delivery** prepares code for deployment but requires manual approval.

**Key Benefits:**
- Faster time to market
- Reduced deployment risks
- Consistent deployment process
- Easy rollbacks if issues occur

## CI/CD Pipeline Architecture for BeautifyAI

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   GitHub    │────▶│  CI Pipeline │────▶│   Build &   │────▶│   Deploy     │
│   Push      │     │   Trigger    │     │   Test      │     │   Staging    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                                                │                      │
                                                ▼                      ▼
                                         ┌─────────────┐     ┌──────────────┐
                                         │   Quality   │     │   Deploy     │
                                         │   Gates     │────▶│  Production  │
                                         └─────────────┘     └──────────────┘
```

## Implementation Plan

### Phase 1: Basic CI Pipeline
1. **Code Quality Checks**
   - ESLint for code standards
   - TypeScript compilation
   - Prettier formatting

2. **Automated Testing**
   - Unit tests
   - Integration tests
   - API endpoint tests

3. **Security Scanning**
   - Dependency vulnerability checks
   - Secret scanning
   - SAST (Static Application Security Testing)

### Phase 2: Build Pipeline
1. **Next.js Build**
   - Production build optimization
   - Bundle size analysis
   - Build time monitoring

2. **Docker Containerization**
   - Multi-stage builds
   - Image optimization
   - Security scanning

### Phase 3: Deployment Pipeline
1. **Staging Deployment**
   - Automatic deployment to staging
   - Smoke tests
   - Performance tests

2. **Production Deployment**
   - Manual approval gate
   - Blue-green deployment
   - Automatic rollback capability

## GitHub Actions Configuration

### 1. Basic CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20.x'

jobs:
  lint:
    name: Code Quality Checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint
      
      - name: Check TypeScript
        run: npx tsc --noEmit
      
      - name: Check formatting
        run: npx prettier --check .

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      REDIS_URL: redis://localhost:6379
      
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  security:
    name: Security Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy security scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
      
      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}

  build:
    name: Build Application
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Next.js app
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-files
          path: |
            .next/
            public/
            package.json
            package-lock.json
```

### 2. Deployment Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy Pipeline

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
          NODE_ENV: production
      
      - name: Deploy to Vercel Staging
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          alias-domains: staging.beautifyai.com
      
      - name: Run E2E tests on staging
        run: npm run test:e2e
        env:
          TEST_URL: https://staging.beautifyai.com
      
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: deploy-staging
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.PROD_SUPABASE_ANON_KEY }}
          NODE_ENV: production
      
      - name: Deploy to Vercel Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          alias-domains: beautifyai.com,www.beautifyai.com
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          draft: false
          prerelease: false
      
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed - v${{ github.run_number }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

### 3. Pull Request Workflow

```yaml
# .github/workflows/pr.yml
name: Pull Request Checks

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  pr-checks:
    name: PR Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Check PR size
        uses: actions/github-script@v6
        with:
          script: |
            const { data: pullRequest } = await github.rest.pulls.get({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number,
            });
            
            if (pullRequest.additions + pullRequest.deletions > 500) {
              core.warning('Large PR detected. Consider breaking it into smaller PRs.');
            }
      
      - name: Run affected tests
        run: npm run test:affected
      
      - name: Build preview
        run: npm run build
      
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '✅ All checks passed! Preview will be available at: https://pr-${{ github.event.pull_request.number }}.beautifyai.vercel.app'
            })
```

## Setting Up Secrets in GitHub

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add the following secrets:

### Required Secrets:
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Staging Environment
STAGING_SUPABASE_URL
STAGING_SUPABASE_ANON_KEY

# Production Environment  
PROD_SUPABASE_URL
PROD_SUPABASE_ANON_KEY

# Cloudflare R2
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY

# AI Services
OPENAI_API_KEY
GOOGLE_AI_API_KEY
ANTHROPIC_API_KEY
REPLICATE_API_TOKEN

# Deployment
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Monitoring
SENTRY_DSN
SENTRY_AUTH_TOKEN

# Notifications
SLACK_WEBHOOK
```

## Environment Configuration

### 1. Create GitHub Environments

1. Go to Settings → Environments
2. Create two environments:
   - `staging` - For staging deployments
   - `production` - For production deployments

3. For production environment, add:
   - Required reviewers (team members who must approve)
   - Wait timer (e.g., 5 minutes)
   - Deployment branch rules (only from main)

### 2. Branch Protection Rules

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews (2 approvals)
   - Require status checks to pass
   - Require branches to be up to date
   - Include administrators
   - Require code owner reviews

## Testing Strategy

### 1. Unit Tests
```typescript
// __tests__/export-service.test.ts
import { ExportService } from '@/lib/export/export-service'

describe('ExportService', () => {
  it('should export PNG with correct dimensions', async () => {
    const service = new ExportService()
    const result = await service.exportDocument({
      documentId: 'test-123',
      userId: 'user-456',
      options: { format: 'png', scale: 2 }
    })
    
    expect(result.success).toBe(true)
    expect(result.dimensions?.width).toBe(3840) // 1920 * 2
  })
})
```

### 2. Integration Tests
```typescript
// __tests__/api/export.test.ts
import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/v1/export/route'

describe('/api/v1/export', () => {
  it('should require authentication', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: { documentId: '123' }
    })
    
    await handler(req, res)
    expect(res._getStatusCode()).toBe(401)
  })
})
```

### 3. E2E Tests
```typescript
// e2e/export-flow.spec.ts
import { test, expect } from '@playwright/test'

test('complete export flow', async ({ page }) => {
  await page.goto('/dashboard')
  await page.click('[data-testid="document-123"]')
  await page.click('button:has-text("Export")')
  await page.selectOption('select[name="format"]', 'pdf')
  await page.click('button:has-text("Download")')
  
  const download = await page.waitForEvent('download')
  expect(download.suggestedFilename()).toContain('.pdf')
})
```

## Monitoring & Alerts

### 1. Build Status Badge
Add to your README.md:
```markdown
![CI Pipeline](https://github.com/yourusername/canva-beautifying/workflows/CI%20Pipeline/badge.svg)
![Deploy Status](https://github.com/yourusername/canva-beautifying/workflows/Deploy%20Pipeline/badge.svg)
```

### 2. Slack Notifications
Configure webhooks for:
- Build failures
- Deployment status
- Security vulnerabilities
- Performance regressions

### 3. Deployment Dashboard
Create a status page showing:
- Current version in each environment
- Recent deployments
- System health metrics
- Incident history

## Best Practices

### 1. Commit Messages
Use conventional commits:
```
feat: add PDF export functionality
fix: resolve memory leak in image processing
docs: update CI/CD documentation
chore: upgrade dependencies
```

### 2. Version Control
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Tag releases properly
- Maintain a CHANGELOG.md

### 3. Rollback Strategy
- Keep previous deployment artifacts
- Use feature flags for gradual rollouts
- Have database migration rollback scripts
- Monitor error rates after deployment

### 4. Cost Optimization
- Use GitHub's free tier (2000 minutes/month)
- Cache dependencies between runs
- Use matrix builds efficiently
- Clean up old artifacts

## Next Steps

1. **Immediate Actions:**
   - Create `.github/workflows` directory
   - Add the CI workflow file
   - Configure repository secrets
   - Enable branch protection

2. **Testing Phase:**
   - Run workflow on a test branch
   - Verify all checks pass
   - Test deployment to staging

3. **Production Ready:**
   - Add production environment
   - Configure approval requirements
   - Set up monitoring alerts
   - Document runbooks

## Troubleshooting

### Common Issues:

1. **Build Failures**
   - Check Node version compatibility
   - Verify all environment variables are set
   - Ensure dependencies are locked (package-lock.json)

2. **Test Failures**
   - Check for timing issues in async tests
   - Verify test database is properly seeded
   - Look for environment-specific code

3. **Deployment Issues**
   - Verify deployment tokens are valid
   - Check build output size limits
   - Ensure proper environment variables

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment Guide](https://vercel.com/docs/concepts/deployments/overview)
- [Next.js CI/CD Best Practices](https://nextjs.org/docs/deployment)
- [Testing Library Documentation](https://testing-library.com/)