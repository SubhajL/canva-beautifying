#!/bin/bash

# Quick deployment script for BeautifyAI

echo "🚀 Deploying to Vercel..."

# Build locally first to catch errors
echo "📦 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🌍 Deploying to Vercel..."
    
    if [ "$1" == "prod" ]; then
        echo "🚀 Deploying to PRODUCTION..."
        vercel --prod
    else
        echo "👁️  Deploying to PREVIEW..."
        vercel
    fi
    
    echo ""
    echo "✨ Deployment complete!"
    echo ""
    echo "💡 Tip: Use './deploy.sh prod' for production deployment"
else
    echo "❌ Build failed! Please fix errors before deploying."
    exit 1
fi