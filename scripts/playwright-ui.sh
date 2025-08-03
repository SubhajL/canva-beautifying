#!/bin/bash

# Script to run Playwright UI with proper environment setup
echo "🎭 Starting Playwright UI Mode..."

# Set UI mode environment variable
export PWTEST_UI_MODE=true

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
  echo "📋 Loading environment from .env.local"
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Check if dev server is running
echo "🔍 Checking if dev server is running..."
if curl -s http://localhost:3000 > /dev/null; then
  echo "✅ Dev server is running"
else
  echo "⚠️  Dev server not detected at http://localhost:3000"
  echo "    Please run 'npm run dev' in another terminal"
fi

# Run Playwright UI with special config
echo "🚀 Launching Playwright UI..."
npx playwright test --ui --config=playwright.ui.config.ts