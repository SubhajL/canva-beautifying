# Playwright UI Issue - Node.js v23 Compatibility

## Problem
The Playwright UI is not showing tests when using Node.js v23.11.0. This appears to be a compatibility issue between Playwright 1.53.1 and the very new Node.js version.

## Root Causes Found

1. **Node.js v23 Compatibility**: You're using Node.js v23.11.0, which is very new and may have compatibility issues with Playwright 1.53.1
2. **Multiple Stuck Processes**: There were multiple Playwright processes stuck in the background
3. **Global Setup Issues**: The globalSetup was using `process.exit()` which could terminate the UI

## Solutions

### Option 1: Use Node Version Manager (Recommended)
Install nvm and use Node.js v20 LTS:

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Use Node.js v20 LTS
nvm install 20
nvm use 20

# Run Playwright UI
npm run test:e2e:ui
```

### Option 2: Use Direct Command with Environment
```bash
# Kill any stuck processes first
pkill -f playwright

# Run with environment variables
PWTEST_UI_MODE=true NODE_OPTIONS="--no-deprecation" npx playwright test --ui
```

### Option 3: Update Playwright
Update to the latest Playwright version that may have better Node.js v23 support:

```bash
npm install -D @playwright/test@latest
npx playwright install
```

## Alternative: Use Playwright CLI Instead of UI

If the UI continues to have issues, you can still run tests effectively:

```bash
# List all tests
npx playwright test --list

# Run specific test file
npx playwright test e2e/01-auth.spec.ts

# Run with headed browser (see the browser)
npx playwright test e2e/01-auth.spec.ts --headed

# Run specific test by name
npx playwright test -g "should display landing page"

# Generate HTML report
npx playwright test --reporter=html
npx playwright show-report
```

## What We Fixed

1. Replaced `process.exit()` with error throwing in globalSetup
2. Added UI mode detection to skip service checks
3. Created a dedicated launch script with proper environment setup
4. Made Supabase service optional if URL not set

## Current Status

The fixes have been applied, but Node.js v23 appears to have compatibility issues with Playwright UI. Using Node.js v20 LTS is the recommended solution for now.