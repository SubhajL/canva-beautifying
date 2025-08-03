#!/bin/bash

# GitHub Secrets Setup Script
# This script helps you set up the required secrets for GitHub Actions

echo "🔐 GitHub Secrets Setup for BeautifyAI CI/CD"
echo "==========================================="
echo ""
echo "This script will guide you through setting up the required secrets."
echo "You'll need to have the GitHub CLI installed and authenticated."
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ You're not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 Repository: $REPO"
echo ""

# Function to set secret
set_secret() {
    local name=$1
    local prompt=$2
    local is_optional=${3:-false}
    
    echo -n "$prompt"
    if [ "$is_optional" = true ]; then
        echo -n " (optional - press Enter to skip): "
    else
        echo -n ": "
    fi
    
    read -s value
    echo ""
    
    if [ ! -z "$value" ]; then
        echo "$value" | gh secret set "$name" -R "$REPO"
        echo "✅ Set $name"
    elif [ "$is_optional" = false ]; then
        echo "❌ $name is required!"
        exit 1
    else
        echo "⏩ Skipped $name"
    fi
}

echo "🔑 Setting up required secrets..."
echo ""

# Supabase secrets
echo "### Supabase Configuration ###"
set_secret "NEXT_PUBLIC_SUPABASE_URL" "Enter Supabase Project URL"
set_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Enter Supabase Anon/Public Key"
set_secret "SUPABASE_SERVICE_ROLE_KEY" "Enter Supabase Service Role Key"

# Staging Supabase
echo ""
echo "### Staging Environment ###"
set_secret "STAGING_SUPABASE_URL" "Enter Staging Supabase URL" true
set_secret "STAGING_SUPABASE_ANON_KEY" "Enter Staging Supabase Anon Key" true
set_secret "STAGING_SUPABASE_SERVICE_KEY" "Enter Staging Supabase Service Key" true
set_secret "STAGING_REDIS_URL" "Enter Staging Redis URL" true

# Production Supabase
echo ""
echo "### Production Environment ###"
set_secret "PROD_SUPABASE_URL" "Enter Production Supabase URL" true
set_secret "PROD_SUPABASE_ANON_KEY" "Enter Production Supabase Anon Key" true

# Cloudflare R2
echo ""
echo "### Cloudflare R2 Storage ###"
set_secret "R2_ACCOUNT_ID" "Enter R2 Account ID"
set_secret "R2_ACCESS_KEY_ID" "Enter R2 Access Key ID"
set_secret "R2_SECRET_ACCESS_KEY" "Enter R2 Secret Access Key"

# AI Services
echo ""
echo "### AI Service API Keys ###"
set_secret "OPENAI_API_KEY" "Enter OpenAI API Key"
set_secret "GOOGLE_AI_API_KEY" "Enter Google AI API Key"
set_secret "ANTHROPIC_API_KEY" "Enter Anthropic API Key" true
set_secret "REPLICATE_API_TOKEN" "Enter Replicate API Token"

# Deployment
echo ""
echo "### Deployment Configuration ###"
set_secret "VERCEL_TOKEN" "Enter Vercel Token" true
set_secret "VERCEL_ORG_ID" "Enter Vercel Organization ID" true
set_secret "VERCEL_PROJECT_ID" "Enter Vercel Project ID" true

# Monitoring
echo ""
echo "### Monitoring & Analytics ###"
set_secret "SENTRY_DSN" "Enter Sentry DSN" true
set_secret "SENTRY_AUTH_TOKEN" "Enter Sentry Auth Token" true

# Optional services
echo ""
echo "### Optional Services ###"
set_secret "SLACK_WEBHOOK" "Enter Slack Webhook URL" true
set_secret "CODECOV_TOKEN" "Enter Codecov Token" true
set_secret "SNYK_TOKEN" "Enter Snyk Token" true

echo ""
echo "✅ GitHub Secrets setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Create staging and production environments in GitHub Settings"
echo "2. Configure branch protection rules for main branch"
echo "3. Push code to trigger the CI/CD pipeline"
echo ""
echo "🔗 Useful links:"
echo "- Environments: https://github.com/$REPO/settings/environments"
echo "- Branch Protection: https://github.com/$REPO/settings/branches"
echo "- Actions: https://github.com/$REPO/actions"