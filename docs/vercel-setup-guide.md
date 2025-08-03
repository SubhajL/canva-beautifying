# Vercel Setup Guide for BeautifyAI

## Why Vercel for BeautifyAI?

1. **Next.js Optimization**: Vercel created Next.js, so it's perfectly optimized
2. **Edge Functions**: Run AI processing closer to users globally
3. **Automatic Scaling**: Handles traffic spikes without configuration
4. **Preview Deployments**: Every PR gets its own URL
5. **Analytics**: Built-in Web Vitals monitoring

## Setup Steps

### Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Choose "Continue with GitHub" (recommended)
4. Authorize Vercel to access your GitHub

### Step 2: Import Your Project

1. Click "New Project"
2. Import your GitHub repository: `canva-beautifying`
3. Vercel will auto-detect Next.js

### Step 3: Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudflare R2
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=beautifyai-storage
R2_PUBLIC_URL=https://your-r2-public-url.com

# Redis (Use Upstash for Vercel)
REDIS_URL=your_redis_url

# AI Services
OPENAI_API_KEY=your_openai_key
GOOGLE_AI_API_KEY=your_google_ai_key
ANTHROPIC_API_KEY=your_anthropic_key
REPLICATE_API_TOKEN=your_replicate_token

# Email (if using)
RESEND_API_KEY=your_resend_key
```

### Step 4: Configure Domains

1. Go to Settings → Domains
2. Add your domain: `beautifyai.com`
3. Add staging subdomain: `staging.beautifyai.com`
4. Follow DNS configuration instructions

### Step 5: Get Deployment Tokens

For GitHub Actions integration:

1. Go to Account Settings → Tokens
2. Create a new token with name "GitHub Actions"
3. Copy the token

Get Project and Org IDs:
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# In your project directory
vercel link

# Get info
vercel project ls
# Note your Org ID and Project ID
```

### Step 6: Update GitHub Secrets

Add these to your GitHub repository secrets:

```bash
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=team_xxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxx
```

## Alternative Deployment Options

If you prefer not to use Vercel, here are alternatives:

### Option 1: AWS Amplify (AWS Alternative)
```yaml
# amplify.yml
version: 1.0
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

### Option 2: Netlify
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NEXT_PLUGIN_FORCE_RUNTIME = "true"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Option 3: Docker + Any Cloud
```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

### Option 4: Self-Hosted VPS
```bash
# On your VPS (Ubuntu/Debian)
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone and build
git clone https://github.com/yourusername/canva-beautifying.git
cd canva-beautifying
npm ci
npm run build

# Start with PM2
pm2 start npm --name "beautifyai" -- start
pm2 save
pm2 startup
```

## Recommended Architecture

For BeautifyAI, I recommend this setup:

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│    Vercel    │────▶│   Cloudflare    │
│  (Frontend+API) │     │  (Hosting)   │     │     (CDN)       │
└─────────────────┘     └──────────────┘     └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│    Supabase     │     │ Cloudflare R2│     │    Upstash      │
│   (Database)    │     │  (Storage)   │     │    (Redis)      │
└─────────────────┘     └──────────────┘     └─────────────────┘
```

## Costs Comparison

### Vercel (Recommended)
- **Hobby**: Free (perfect for testing)
- **Pro**: $20/month (for production)
- Includes: Hosting, CDN, SSL, Analytics

### AWS
- **EC2**: ~$20-50/month
- **RDS**: ~$15-30/month  
- **CloudFront**: ~$10-20/month
- **Total**: ~$45-100/month

### Self-Hosted VPS
- **DigitalOcean**: $12-24/month
- **Linode**: $10-20/month
- But requires more maintenance

## Quick Start with Vercel

1. **Sign up**: https://vercel.com/signup
2. **Import**: Click "Import Git Repository"
3. **Deploy**: Vercel handles everything else!

Your app will be live in 2 minutes! 🚀