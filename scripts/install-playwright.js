#!/usr/bin/env node

/**
 * Install Playwright browsers
 * Run with: node scripts/install-playwright.js
 */

const { execSync } = require('child_process');

console.log('📦 Installing Playwright browsers...\n');

try {
  // Install browsers
  execSync('npx playwright install', { stdio: 'inherit' });
  
  // Install system dependencies (if on CI or Linux)
  if (process.env.CI || process.platform === 'linux') {
    console.log('\n📦 Installing system dependencies...\n');
    execSync('npx playwright install-deps', { stdio: 'inherit' });
  }
  
  console.log('\n✅ Playwright browsers installed successfully!');
  console.log('\n🎭 You can now run e2e tests with: npm run test:e2e\n');
} catch (error) {
  console.error('\n❌ Failed to install Playwright browsers:', error.message);
  process.exit(1);
}