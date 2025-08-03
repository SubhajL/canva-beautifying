#!/bin/bash

# BeautifyAI - Stripe Setup Helper Script
# This script helps you set up Stripe for local development

echo "🎨 BeautifyAI - Stripe Setup Helper"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo -e "${RED}❌ Stripe CLI is not installed${NC}"
    echo ""
    echo "Please install Stripe CLI first:"
    echo ""
    echo "macOS:    brew install stripe/stripe-cli/stripe"
    echo "Windows:  scoop install stripe"
    echo "Linux:    Download from https://github.com/stripe/stripe-cli/releases"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Stripe CLI is installed${NC}"
echo ""

# Check if logged in to Stripe
if ! stripe config --list | grep -q "test_mode_api_key"; then
    echo -e "${YELLOW}📝 You need to login to Stripe CLI${NC}"
    echo "Running: stripe login"
    echo ""
    stripe login
    echo ""
fi

echo -e "${GREEN}✅ Logged in to Stripe${NC}"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${YELLOW}📝 Creating .env.local from .env.example${NC}"
    cp .env.example .env.local
    echo -e "${GREEN}✅ Created .env.local${NC}"
    echo ""
fi

# Function to update or add environment variable
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" .env.local; then
        # Key exists, update it
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${key}=.*|${key}=${value}|" .env.local
        else
            sed -i "s|^${key}=.*|${key}=${value}|" .env.local
        fi
    else
        # Key doesn't exist, add it
        echo "${key}=${value}" >> .env.local
    fi
}

# Instructions for manual steps
echo "📋 Manual Steps Required:"
echo "========================"
echo ""
echo "1. ${YELLOW}Get your API keys from Stripe Dashboard:${NC}"
echo "   - Go to https://dashboard.stripe.com/test/apikeys"
echo "   - Copy your test keys and update .env.local:"
echo "     - Publishable key (pk_test_...)"
echo "     - Secret key (sk_test_...)"
echo ""
echo "2. ${YELLOW}Create Products in Stripe Dashboard:${NC}"
echo "   - Go to https://dashboard.stripe.com/test/products"
echo "   - Create 3 products:"
echo "     • Basic Plan - \$9.99/month"
echo "     • Pro Plan - \$24.99/month"
echo "     • Premium Plan - \$49.99/month"
echo "   - Copy the Price IDs and update .env.local"
echo ""
echo "3. ${YELLOW}Start the webhook listener:${NC}"
echo ""
echo "   In a new terminal, run:"
echo "   ${GREEN}stripe listen --forward-to localhost:5000/api/stripe/webhook${NC}"
echo ""
echo "   Copy the webhook secret (whsec_...) and add to .env.local:"
echo "   STRIPE_WEBHOOK_SECRET=whsec_..."
echo ""
echo "4. ${YELLOW}Test the integration:${NC}"
echo "   - Visit http://localhost:5000/app/settings/billing"
echo "   - Try upgrading to a paid plan"
echo "   - Use test card: 4242 4242 4242 4242"
echo ""

# Offer to open relevant pages
echo "Would you like to open the Stripe Dashboard? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "Opening Stripe Dashboard..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://dashboard.stripe.com/test/apikeys"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "https://dashboard.stripe.com/test/apikeys"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        start "https://dashboard.stripe.com/test/apikeys"
    fi
fi

echo ""
echo -e "${GREEN}✅ Setup helper completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Update your .env.local with Stripe keys"
echo "2. Create products in Stripe Dashboard"
echo "3. Run: stripe listen --forward-to localhost:5000/api/stripe/webhook"
echo "4. Start your app: npm run dev"
echo ""
echo "For detailed instructions, see: docs/STRIPE_SETUP.md"