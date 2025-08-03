# Canva Beautifying - Soft Launch Setup Guide

## Pre-Launch Status

**Project Completion: 80%** (32/40 tasks completed)
**Soft Launch Ready: YES** ✅

## Required Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase (Authentication & Database)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Cloudflare R2 (File Storage)
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_ENDPOINT=your_r2_endpoint
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=your_r2_public_url

# AI Model API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key_for_gemini

# Redis (Queue System)
REDIS_URL=redis://localhost:6379

# Stripe (Payments)
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com

# WebSocket Server
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:5001

# Sentry (Error Tracking)
SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token

# Application
NEXT_PUBLIC_APP_URL=http://localhost:5000
NODE_ENV=production
```

## Infrastructure Setup Steps

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Run the database migrations:
   ```bash
   # The migrations are already in the codebase
   # They will auto-apply when you connect your Supabase project
   ```
3. Enable Row Level Security (RLS) - should be auto-enabled by migrations
4. Set up OAuth providers in Supabase Authentication:
   - Enable Google OAuth
   - Enable Microsoft OAuth
   - Configure redirect URLs

### 2. Storage Setup (Cloudflare R2)

1. Create a Cloudflare account and enable R2
2. Create a new R2 bucket
3. Configure CORS policy for your bucket:
   ```json
   {
     "AllowedOrigins": ["https://yourdomain.com"],
     "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }
   ```
4. Create R2 API credentials
5. Set up custom domain for public access (optional)

### 3. Redis Setup

For local development:
```bash
# Install Redis
brew install redis  # macOS
# or
sudo apt-get install redis-server  # Ubuntu

# Start Redis
redis-server
```

For production:
- Use Redis Cloud, AWS ElastiCache, or similar
- Ensure Redis persistence is enabled

### 4. Payment Setup (Stripe)

1. Create Stripe account
2. Set up products and prices:
   - Free Plan: $0/month
   - Basic Plan: $9.99/month
   - Pro Plan: $24.99/month
   - Premium Plan: $49.99/month
3. Create webhook endpoint for: `/api/webhooks/stripe`
4. Configure webhook to send these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

### 5. Email Setup (Resend)

1. Create Resend account
2. Verify your domain
3. Create API key with send permissions
4. Update `EMAIL_FROM` with verified sender

### 6. AI Models Setup

1. **OpenAI**: Create API key with GPT-4 access
2. **Anthropic**: Create API key with Claude access
3. **Google AI**: Create API key with Gemini access

### 7. Local Development Setup

```bash
# Install dependencies
npm install

# Run database migrations (auto-runs with Supabase connection)
npm run db:migrate

# Test all integrations
npm run test:r2
npm run test:supabase
npm run test:ai

# Start all services
npm run dev          # Main app (port 3000)
npm run workers:dev  # Queue workers
npm run websocket:dev # WebSocket server (port 3001)
```

## Production Deployment

### Recommended Architecture

1. **Main App**: Deploy to Vercel/Netlify
2. **Workers**: Deploy as separate process (Railway/Render)
3. **WebSocket**: Deploy as separate service (Railway/Render)
4. **Redis**: Use managed service (Redis Cloud/Upstash)
5. **Database**: Already on Supabase

### Deployment Steps

1. **Deploy Main App to Vercel:**
   ```bash
   vercel --prod
   ```
   Configure environment variables in Vercel dashboard

2. **Deploy Workers (e.g., Railway):**
   - Create new service
   - Set start command: `npm run workers`
   - Add all environment variables
   - Ensure Redis connection

3. **Deploy WebSocket Server:**
   - Create new service
   - Set start command: `npm run websocket`
   - Configure public URL
   - Update `NEXT_PUBLIC_WEBSOCKET_URL`

4. **Post-Deployment:**
   - Update OAuth redirect URLs
   - Configure Stripe webhook URL
   - Test payment flow
   - Monitor error tracking

## Pre-Launch Checklist

- [ ] All environment variables configured
- [ ] Database migrations completed
- [ ] OAuth providers configured
- [ ] R2 bucket created and accessible
- [ ] Redis instance running
- [ ] Stripe products/prices created
- [ ] Webhook endpoints configured
- [ ] Email domain verified
- [ ] AI API keys have sufficient credits
- [ ] Workers deployed and running
- [ ] WebSocket server accessible
- [ ] Error tracking configured
- [ ] Test user journey end-to-end

## Monitoring & Maintenance

1. **Queue Health**: Monitor BullMQ dashboard
2. **Error Tracking**: Check Sentry for issues
3. **AI Usage**: Monitor API usage and costs
4. **Storage**: Track R2 bandwidth and storage
5. **Database**: Monitor Supabase metrics

## Known Limitations (Not Critical for Launch)

1. No analytics integration (Plausible planned)
2. No automated CI/CD pipeline
3. No performance monitoring (APM)
4. Single language support (English only)
5. No referral system
6. No social sharing features

These can be added post-launch based on user feedback.