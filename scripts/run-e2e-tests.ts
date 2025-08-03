#!/usr/bin/env tsx

/**
 * Run Playwright E2E tests with proper setup
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
config({ path: path.join(__dirname, '..', '.env.local') });

console.log('🎭 Playwright E2E Test Runner\n');

// Check if required environment variables are set
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(key => console.error(`   - ${key}`));
  console.error('\nPlease set these in your .env.local file.\n');
  process.exit(1);
}

// Check if dev server is running
async function isDevServerRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:3000');
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Check if dev server is running
  const devServerRunning = await isDevServerRunning();
  
  if (!devServerRunning) {
    console.log('📦 Development server is not running.');
    console.log('   The tests will start it automatically.\n');
  }
  
  // Prepare test command
  let testCommand = 'npx playwright test';
  
  // Add any passed arguments
  if (args.length > 0) {
    testCommand += ' ' + args.join(' ');
  }
  
  console.log('🚀 Running tests...\n');
  console.log(`   Command: ${testCommand}\n`);
  
  try {
    // Run tests
    execSync(testCommand, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        // Ensure we're not in CI mode for local testing
        CI: '',
      }
    });
    
    console.log('\n✅ Tests completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Tests failed.\n');
    
    // Provide helpful tips
    console.log('💡 Troubleshooting tips:');
    console.log('   1. Make sure all required services are running');
    console.log('   2. Check that your .env.local file has all required variables');
    console.log('   3. Try running a specific test: npm run test:e2e e2e/01-auth.spec.ts');
    console.log('   4. Run in UI mode for debugging: npx playwright test --ui');
    console.log('   5. Check the test report: npx playwright show-report\n');
    
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);