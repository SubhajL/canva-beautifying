# CI/CD Pipeline Documentation

## Overview

This project uses GitHub Actions for continuous integration and deployment. The pipeline automatically runs tests, builds the application, and deploys to multiple environments.

## Pipeline Structure

### 1. Main CI/CD Pipeline (`ci-cd.yml`)

Triggers on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

Jobs:
- **Lint and Type Check**: Runs ESLint and TypeScript type checking
- **Test**: Runs all test suites
- **Build**: Builds the Next.js application
- **Deploy to Vercel (Preview)**: Creates preview deployments for PRs
- **Deploy to Vercel (Production)**: Deploys to production on main branch
- **Deploy to Railway**: Deploys all services to Railway
- **Notifications**: Sends success/failure notifications via Telegram

### 2. Code Quality (`code-quality.yml`)

Runs on pull requests to ensure code quality:
- ESLint with GitHub annotations
- Console log detection
- TODO/FIXME comment reporting
- Bundle size analysis
- Security scanning with Trivy
- Dependency checking

### 3. Environment Validation (`env-validation.yml`)

Validates environment variable configuration when `.env` files change.

### 4. Dependency Updates (`dependency-update.yml`)

Runs weekly to:
- Update npm dependencies
- Run security audits
- Create automated PRs with updates

### 5. Database Migrations (`database-migration.yml`)

Automatically runs database migrations when changes are detected in `supabase/migrations/`.

## Required GitHub Secrets

Configure these secrets in your repository settings:

### Vercel Deployment
- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

### Railway Deployment
- `RAILWAY_TOKEN`: Your Railway API token
- `RAILWAY_PROJECT_ID`: Your Railway project ID

### Notifications
- `TELEGRAM_CHAT_ID`: Telegram chat ID for notifications
- `TELEGRAM_BOT_TOKEN`: Telegram bot token

### Database
- `SUPABASE_ACCESS_TOKEN`: Supabase CLI access token
- `SUPABASE_STAGING_PROJECT_REF`: Staging project reference
- `SUPABASE_STAGING_DB_PASSWORD`: Staging database password
- `SUPABASE_PROD_PROJECT_REF`: Production project reference
- `SUPABASE_PROD_DB_PASSWORD`: Production database password

## Environment Configuration

### Development
- Uses `.env.local` for local development
- Connects to development database and services

### Staging
- Preview deployments on Vercel for PRs
- Uses staging environment variables
- Accessible at `pr-{number}.canva-beautify.vercel.app`

### Production
- Main deployments on push to `main` branch
- Vercel: `canva-beautify.vercel.app`
- Railway: `canva-beautify.railway.app`

## Testing the Pipeline Locally

Run the test script to validate your setup:

```bash
./.github/test-ci-cd.sh
```

This script will:
1. Check Node.js version
2. Install dependencies
3. Run linting
4. Run type checking
5. Run tests
6. Build the application
7. Check for security vulnerabilities
8. Validate environment variables
9. Check workflow syntax
10. List required GitHub secrets

## Deployment Process

### Feature Development
1. Create feature branch from `develop`
2. Push changes (triggers PR preview)
3. Review preview deployment
4. Merge to `develop` after approval

### Production Release
1. Create PR from `develop` to `main`
2. Review staging deployment
3. Merge to `main` (triggers production deployment)
4. Monitor deployment notifications

## Monitoring and Alerts

- Build failures trigger Telegram notifications
- Sentry monitors runtime errors
- GitHub Actions logs available for debugging
- Deployment URLs included in notifications

## Rollback Procedures

### Vercel
- Use Vercel dashboard to instantly rollback
- Or redeploy previous commit from GitHub

### Railway
- Use Railway dashboard to rollback
- Or trigger redeploy of previous version

### Database
- Migrations should include rollback scripts
- Use Supabase dashboard for manual interventions

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review TypeScript errors in logs

2. **Deployment Failures**
   - Verify all secrets are configured
   - Check environment variable naming
   - Review deployment logs

3. **Test Failures**
   - Run tests locally first
   - Check for environment-specific issues
   - Review test output in Actions logs

### Debug Commands

```bash
# Test build locally
npm run build

# Check for type errors
npx tsc --noEmit

# Run linting
npm run lint

# Test environment variables
node -e "console.log(process.env)"
```

## Best Practices

1. Always create PRs for code review
2. Wait for all checks to pass before merging
3. Monitor deployment notifications
4. Keep dependencies up to date
5. Review security alerts promptly
6. Test locally before pushing
7. Use meaningful commit messages
8. Tag releases for production deployments