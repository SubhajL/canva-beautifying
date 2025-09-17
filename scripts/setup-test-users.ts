#!/usr/bin/env node

import { config } from 'dotenv';
import { resolve } from 'path';
import { TestUserManager } from '../e2e/utils/test-user-manager';
import * as fs from 'fs';

// Load test environment variables
const envPath = resolve(__dirname, '../.env.test');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('✓ Loaded .env.test');
} else {
  console.error('❌ .env.test file not found');
  process.exit(1);
}

async function setupTestUsers() {
  console.log('🚀 Setting up test users...\n');

  const userManager = new TestUserManager();
  const tiers: Array<'free' | 'pro' | 'premium'> = ['free', 'pro', 'premium'];
  const results: Array<{ tier: string; success: boolean; error?: any }> = [];

  for (const tier of tiers) {
    try {
      console.log(`Setting up ${tier} user...`);
      await userManager.ensureTestUserExists(tier);
      results.push({ tier, success: true });
    } catch (error) {
      console.error(`❌ Failed to setup ${tier} user:`, error);
      results.push({ tier, success: false, error });
    }
  }

  console.log('\n📊 Setup Summary:');
  console.log('─'.repeat(50));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log(`✅ Successfully set up ${successful.length} users:`);
    successful.forEach(r => console.log(`   - ${r.tier}`));
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed to set up ${failed.length} users:`);
    failed.forEach(r => {
      console.log(`   - ${r.tier}: ${r.error?.message || 'Unknown error'}`);
    });
  }

  console.log('─'.repeat(50));

  if (successful.length === tiers.length) {
    console.log('\n✅ All test users are ready!');
    console.log('You can now run tests with: npm test');
  } else {
    console.error('\n⚠️  Some users failed to set up. Tests may fail.');
    process.exit(1);
  }
}

setupTestUsers().then(() => {
  console.log('Test user setup complete');
  process.exit(0);
}).catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});