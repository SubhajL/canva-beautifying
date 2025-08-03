#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking Environment Variables\n');

// Colors
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const reset = '\x1b[0m';

// Correct environment variables based on actual code
const envVarsUsed = {
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL': 'Required for Supabase connection',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'Required for Supabase auth',
  'SUPABASE_SERVICE_ROLE_KEY': 'Required for server-side Supabase',
  
  // Cloudflare R2 (NOT R2_*)
  'CLOUDFLARE_ACCOUNT_ID': 'Used in lib/r2/client.ts',
  'CLOUDFLARE_ACCESS_KEY_ID': 'Used in lib/r2/client.ts',
  'CLOUDFLARE_SECRET_ACCESS_KEY': 'Used in lib/r2/client.ts',
  'CLOUDFLARE_R2_BUCKET_NAME': 'Optional (defaults to beautifyai-storage)',
  
  // Redis (Upstash preferred)
  'UPSTASH_REDIS_URL': 'For cloud Redis (preferred)',
  'UPSTASH_REDIS_TOKEN': 'For cloud Redis auth',
  'REDIS_HOST': 'For local Redis (optional)',
  'REDIS_PORT': 'For local Redis (optional)',
  
  // AI APIs
  'OPENAI_API_KEY': 'For GPT-4 and DALL-E',
  'GEMINI_API_KEY': 'For Google Gemini (NOT GOOGLE_AI_API_KEY)',
  'ANTHROPIC_API_KEY': 'For Claude (optional)',
  'REPLICATE_API_TOKEN': 'For Stable Diffusion',
  
  // Optional
  'RESEND_API_KEY': 'For email sending (optional)',
  'NEXT_PUBLIC_SENTRY_DSN': 'For error tracking (optional)',
  'SENTRY_AUTH_TOKEN': 'For Sentry releases (optional)'
};

// Check .env.local file
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log(`${red}❌ .env.local file not found!${reset}`);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const envVars = {};

// Parse env file
envLines.forEach(line => {
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

console.log(`${blue}📋 Environment Variables Status:${reset}\n`);

// Check each required variable
Object.entries(envVarsUsed).forEach(([varName, description]) => {
  const value = envVars[varName];
  const isOptional = description.includes('optional') || description.includes('Optional');
  
  if (value && value !== '' && !value.startsWith('your_')) {
    console.log(`${green}✓${reset} ${varName}`);
    console.log(`  ${description}`);
  } else if (isOptional) {
    console.log(`${yellow}○${reset} ${varName} (optional)`);
    console.log(`  ${description}`);
  } else {
    console.log(`${red}✗${reset} ${varName}`);
    console.log(`  ${description}`);
  }
});

// Check for old/incorrect variable names
console.log(`\n${blue}⚠️  Checking for incorrect variable names:${reset}\n`);

const incorrectVars = {
  'R2_ACCOUNT_ID': 'Should be CLOUDFLARE_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID': 'Should be CLOUDFLARE_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY': 'Should be CLOUDFLARE_SECRET_ACCESS_KEY',
  'GOOGLE_AI_API_KEY': 'Should be GEMINI_API_KEY',
  'REDIS_URL': 'Should be UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN'
};

Object.entries(incorrectVars).forEach(([wrong, correct]) => {
  if (envVars[wrong]) {
    console.log(`${yellow}⚠${reset}  Found ${wrong}`);
    console.log(`   → ${correct}`);
  }
});

// Suggest fixes
console.log(`\n${blue}💡 Fix Suggestions:${reset}\n`);

if (envVars['R2_ACCOUNT_ID'] && !envVars['CLOUDFLARE_ACCOUNT_ID']) {
  console.log('Rename your R2 variables:');
  console.log(`${yellow}R2_ACCOUNT_ID${reset} → ${green}CLOUDFLARE_ACCOUNT_ID${reset}`);
  console.log(`${yellow}R2_ACCESS_KEY_ID${reset} → ${green}CLOUDFLARE_ACCESS_KEY_ID${reset}`);
  console.log(`${yellow}R2_SECRET_ACCESS_KEY${reset} → ${green}CLOUDFLARE_SECRET_ACCESS_KEY${reset}`);
}

if (envVars['GOOGLE_AI_API_KEY'] && !envVars['GEMINI_API_KEY']) {
  console.log(`\nRename: ${yellow}GOOGLE_AI_API_KEY${reset} → ${green}GEMINI_API_KEY${reset}`);
}

if (envVars['REDIS_URL'] && !envVars['UPSTASH_REDIS_URL']) {
  console.log('\nFor Redis, you have options:');
  console.log('1. Use Upstash (recommended for Vercel):');
  console.log(`   ${green}UPSTASH_REDIS_URL=redis://...${reset}`);
  console.log(`   ${green}UPSTASH_REDIS_TOKEN=your_token${reset}`);
  console.log('2. Or use local Redis (no env vars needed - uses localhost:6379)');
}

console.log('\n✨ Run this script again after making changes!');