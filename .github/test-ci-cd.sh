#!/bin/bash

# Test CI/CD Pipeline Script
# This script helps test the CI/CD pipeline locally before pushing

set -e

echo "🔍 Testing CI/CD Pipeline Components..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

echo ""
echo "1️⃣  Checking Node.js version..."
node_version=$(node -v)
if [[ $node_version == v18* ]]; then
    print_status 0 "Node.js version: $node_version"
else
    print_status 1 "Node.js version $node_version is not v18.x"
fi

echo ""
echo "2️⃣  Installing dependencies..."
npm ci
print_status $? "Dependencies installed"

echo ""
echo "3️⃣  Running ESLint..."
npm run lint
print_status $? "ESLint passed"

echo ""
echo "4️⃣  Running TypeScript type check..."
npx tsc --noEmit
print_status $? "TypeScript type check passed"

echo ""
echo "5️⃣  Running tests..."
npm test -- --passWithNoTests
print_status $? "Tests passed"

echo ""
echo "6️⃣  Building application..."
npm run build
print_status $? "Build successful"

echo ""
echo "7️⃣  Checking for security vulnerabilities..."
npm audit --production || true
echo -e "${YELLOW}⚠️  Review any security warnings above${NC}"

echo ""
echo "8️⃣  Checking environment variables..."
required_vars=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_KEY"
    "CLOUDFLARE_ACCOUNT_ID"
    "R2_BUCKET_NAME"
    "REDIS_URL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
    print_status 0 "All required environment variables are set"
else
    echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
    printf '%s\n' "${missing_vars[@]}"
fi

echo ""
echo "9️⃣  Checking GitHub Actions workflows..."
for workflow in .github/workflows/*.yml; do
    if [ -f "$workflow" ]; then
        echo -n "Validating $(basename $workflow)... "
        # Basic YAML validation
        if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
            echo -e "${GREEN}✅${NC}"
        else
            echo -e "${RED}❌ Invalid YAML${NC}"
        fi
    fi
done

echo ""
echo "🔟  Checking GitHub secrets configuration..."
echo -e "${YELLOW}ℹ️  Make sure the following secrets are configured in your GitHub repository:${NC}"
echo "   - VERCEL_TOKEN"
echo "   - VERCEL_ORG_ID"
echo "   - VERCEL_PROJECT_ID"
echo "   - RAILWAY_TOKEN"
echo "   - RAILWAY_PROJECT_ID"
echo "   - TELEGRAM_CHAT_ID"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - SUPABASE_ACCESS_TOKEN"
echo "   - SUPABASE_STAGING_PROJECT_REF"
echo "   - SUPABASE_STAGING_DB_PASSWORD"
echo "   - SUPABASE_PROD_PROJECT_REF"
echo "   - SUPABASE_PROD_DB_PASSWORD"

echo ""
echo -e "${GREEN}✨ CI/CD pipeline test complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure the required GitHub secrets listed above"
echo "2. Create a new branch: git checkout -b test-ci-cd"
echo "3. Make a small change and commit"
echo "4. Push the branch and create a pull request"
echo "5. Verify that all GitHub Actions workflows run successfully"
echo ""