#!/bin/bash

# Vercel Setup Script for BeautifyAI
# This script will help you set up Vercel deployment

echo "🚀 Vercel Setup for BeautifyAI"
echo "==============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install Node.js first."
    exit 1
fi

# Step 1: Install Vercel CLI
print_info "Step 1: Installing Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    npm install -g vercel
    print_success "Vercel CLI installed successfully!"
else
    print_success "Vercel CLI is already installed!"
fi

# Step 2: Create .env.production file
print_info "Step 2: Creating production environment file..."
cat > .env.production << 'EOF'
# Production Environment Variables
# These will be overridden by Vercel environment variables

# App
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://beautifyai.vercel.app

# Supabase (will be set in Vercel dashboard)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=beautifyai-storage
R2_PUBLIC_URL=

# Redis (Upstash)
REDIS_URL=

# AI Services
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
ANTHROPIC_API_KEY=
REPLICATE_API_TOKEN=

# Email (Resend)
RESEND_API_KEY=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
EOF

print_success "Created .env.production file!"

# Step 3: Create Vercel ignore file
print_info "Step 3: Creating .vercelignore file..."
cat > .vercelignore << 'EOF'
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output
test-output/
__tests__/
*.test.ts
*.test.tsx
*.spec.ts
*.spec.tsx

# Local env files
.env*.local
.env.development

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
.DS_Store
*.pem
.vscode/
.idea/

# Documentation
docs/
*.md
!README.md

# Scripts (except build scripts)
scripts/test-*.ts
scripts/test-*.js
scripts/setup-*.sh

# Development files
.eslintcache
.prettierignore
jest.config.js
jest.setup.js
__mocks__/
EOF

print_success "Created .vercelignore file!"

# Step 4: Update package.json for Vercel
print_info "Step 4: Checking package.json..."
if grep -q '"build": "next build"' package.json; then
    print_success "Build script is correctly configured!"
else
    print_warning "Please ensure your package.json has: \"build\": \"next build\""
fi

# Step 5: Create API directory structure if needed
print_info "Step 5: Checking API routes..."
if [ -d "app/api" ]; then
    print_success "API routes directory exists!"
else
    print_warning "No API routes found. Creating directory..."
    mkdir -p app/api
fi

# Step 6: Instructions for manual steps
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
print_info "Next Steps - Manual Configuration Required:"
echo ""
echo "1. ${YELLOW}Login to Vercel:${NC}"
echo "   Run: ${GREEN}vercel login${NC}"
echo ""
echo "2. ${YELLOW}Deploy to Vercel:${NC}"
echo "   Run: ${GREEN}vercel${NC}"
echo "   - Choose: ${BLUE}Set up and deploy${NC}"
echo "   - Select scope: ${BLUE}Your personal account${NC}"
echo "   - Link to existing project? ${BLUE}No${NC}"
echo "   - Project name: ${BLUE}canva-beautifying${NC} (or beautifyai)"
echo "   - Directory: ${BLUE}./${NC} (current directory)"
echo "   - Settings: ${BLUE}Accept defaults${NC}"
echo ""
echo "3. ${YELLOW}Configure Environment Variables:${NC}"
echo "   After deployment, go to: ${BLUE}https://vercel.com/dashboard${NC}"
echo "   - Select your project"
echo "   - Go to Settings → Environment Variables"
echo "   - Add all variables from .env.local"
echo ""
echo "4. ${YELLOW}Configure Custom Domain (Optional):${NC}"
echo "   - Go to Settings → Domains"
echo "   - Add: ${BLUE}beautifyai.com${NC}"
echo "   - Follow DNS configuration"
echo ""
echo "5. ${YELLOW}Connect to GitHub:${NC}"
echo "   - Go to Settings → Git"
echo "   - Connect your GitHub repository"
echo "   - Enable automatic deployments"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Step 7: Create environment variables list
print_info "Creating environment variables checklist..."
cat > vercel-env-vars.txt << 'EOF'
# Vercel Environment Variables Checklist
# Copy these to Vercel Dashboard → Settings → Environment Variables

## Required Variables:

### Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

### Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=beautifyai-storage
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

### Redis (Upstash - Vercel Integration)
REDIS_URL=redis://default:password@host:port

### AI Services
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
REPLICATE_API_TOKEN=r8_...

### Optional Services
RESEND_API_KEY=re_...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

## Environment-Specific URLs:
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app (or custom domain)
EOF

print_success "Created vercel-env-vars.txt with environment variables checklist!"

# Step 8: Create deployment helper
print_info "Creating deployment helper script..."
cat > deploy.sh << 'EOF'
#!/bin/bash

# Quick deployment script

echo "🚀 Deploying to Vercel..."

# Build locally first to catch errors
echo "📦 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🌍 Deploying to Vercel..."
    
    if [ "$1" == "prod" ]; then
        vercel --prod
    else
        vercel
    fi
else
    echo "❌ Build failed! Please fix errors before deploying."
    exit 1
fi
EOF

chmod +x deploy.sh
print_success "Created deploy.sh helper script!"

# Step 9: Final instructions
echo ""
print_success "Vercel setup preparation complete!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🎯 ${GREEN}Quick Start Commands:${NC}"
echo ""
echo "1. ${YELLOW}First-time setup:${NC}"
echo "   ${GREEN}vercel login${NC}"
echo "   ${GREEN}vercel${NC}"
echo ""
echo "2. ${YELLOW}Future deployments:${NC}"
echo "   ${GREEN}./deploy.sh${NC}      # Deploy to preview"
echo "   ${GREEN}./deploy.sh prod${NC} # Deploy to production"
echo ""
echo "3. ${YELLOW}Check deployment:${NC}"
echo "   ${GREEN}vercel ls${NC}        # List deployments"
echo "   ${GREEN}vercel inspect${NC}   # Inspect current deployment"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📚 ${BLUE}Documentation:${NC}"
echo "   - Vercel Docs: https://vercel.com/docs"
echo "   - Next.js on Vercel: https://vercel.com/docs/frameworks/nextjs"
echo "   - Environment Variables: https://vercel.com/docs/environment-variables"
echo ""

# Create a quick reference card
cat > VERCEL_QUICK_REFERENCE.md << 'EOF'
# Vercel Quick Reference

## Common Commands

```bash
# Login/Logout
vercel login
vercel logout

# Deployment
vercel              # Deploy to preview
vercel --prod      # Deploy to production
vercel ls          # List all deployments
vercel inspect     # Inspect current deployment
vercel rm [url]    # Remove a deployment

# Environment Variables
vercel env ls      # List all env vars
vercel env add     # Add new env var
vercel env rm      # Remove env var
vercel env pull    # Download env vars to .env.local

# Domains
vercel domains ls  # List domains
vercel domains add # Add custom domain

# Logs
vercel logs        # View function logs
vercel logs --follow # Tail logs
```

## Project Structure for Vercel

```
canva-beautifying/
├── app/              # Next.js 13+ app directory
│   ├── api/         # API routes (become serverless functions)
│   └── (routes)/    # Page routes
├── public/          # Static assets (served from CDN)
├── lib/             # Shared code
├── components/      # React components
├── .env.local       # Local environment variables
├── .env.production  # Production defaults
├── vercel.json      # Vercel configuration
└── package.json     # Dependencies and scripts
```

## Deployment Workflow

1. **Development**: Work locally with `npm run dev`
2. **Preview**: Push to feature branch → Auto deploy to preview URL
3. **Production**: Merge to main → Auto deploy to production

## Troubleshooting

- **Build fails**: Check `vercel logs`
- **Environment variables**: Ensure all are set in Vercel dashboard
- **Custom domain**: Check DNS propagation (can take up to 48h)
- **Function timeout**: Increase in vercel.json (max 60s on Pro)
EOF

print_success "Created VERCEL_QUICK_REFERENCE.md!"

echo ""
echo "✨ ${GREEN}Setup complete! Now run:${NC} ${YELLOW}vercel login${NC} ${GREEN}to get started${NC}"
echo ""