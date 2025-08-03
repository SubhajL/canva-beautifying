#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Environment Variable Fix Tool\n');

const envPath = path.join(process.cwd(), '.env.local');
const backupPath = path.join(process.cwd(), '.env.local.backup');

// Variable mappings
const mappings = {
  'R2_ACCOUNT_ID': 'CLOUDFLARE_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID': 'CLOUDFLARE_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY': 'CLOUDFLARE_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME': 'CLOUDFLARE_R2_BUCKET_NAME',
  'GOOGLE_AI_API_KEY': 'GEMINI_API_KEY'
};

// Read current env file
if (!fs.existsSync(envPath)) {
  console.log('❌ .env.local not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
let newContent = envContent;
let changesMade = false;

// Check what needs to be fixed
console.log('Found the following variables to fix:\n');
Object.entries(mappings).forEach(([oldName, newName]) => {
  const regex = new RegExp(`^${oldName}=`, 'm');
  if (regex.test(envContent)) {
    console.log(`  ${oldName} → ${newName}`);
    changesMade = true;
  }
});

// Check for Redis URL
if (/^REDIS_URL=/m.test(envContent) && !/^UPSTASH_REDIS_URL=/m.test(envContent)) {
  console.log(`  REDIS_URL → Need to split into UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN`);
  changesMade = true;
}

if (!changesMade) {
  console.log('✅ No fixes needed! Your env vars look correct.');
  process.exit(0);
}

console.log('\n');

rl.question('Do you want to apply these fixes? (y/n): ', (answer) => {
  if (answer.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    rl.close();
    return;
  }

  // Create backup
  fs.copyFileSync(envPath, backupPath);
  console.log(`\n✅ Created backup: ${backupPath}`);

  // Apply mappings
  Object.entries(mappings).forEach(([oldName, newName]) => {
    const regex = new RegExp(`^${oldName}=`, 'gm');
    newContent = newContent.replace(regex, `${newName}=`);
  });

  // Handle Redis URL
  const redisMatch = envContent.match(/^REDIS_URL=(.+)$/m);
  if (redisMatch && !/^UPSTASH_REDIS_URL=/m.test(envContent)) {
    const redisUrl = redisMatch[1];
    
    // Parse Redis URL to extract token if it's an Upstash URL
    if (redisUrl.includes('upstash') || redisUrl.includes('redis://default:')) {
      try {
        const url = new URL(redisUrl);
        const token = url.password;
        
        // Replace REDIS_URL with Upstash variables
        newContent = newContent.replace(
          /^REDIS_URL=.+$/m,
          `# Upstash Redis Configuration\nUPSTASH_REDIS_URL=${redisUrl}\nUPSTASH_REDIS_TOKEN=${token || 'your_token_here'}`
        );
      } catch (e) {
        // If URL parsing fails, just comment it out
        newContent = newContent.replace(
          /^REDIS_URL=.+$/m,
          `# TODO: Convert to Upstash format\n# ${redisMatch[0]}\nUPSTASH_REDIS_URL=\nUPSTASH_REDIS_TOKEN=`
        );
      }
    } else {
      // For local Redis, just comment it out
      newContent = newContent.replace(
        /^REDIS_URL=.+$/m,
        `# Local Redis - no env vars needed, uses localhost:6379\n# ${redisMatch[0]}`
      );
    }
  }

  // Write updated content
  fs.writeFileSync(envPath, newContent);
  console.log('✅ Updated .env.local with correct variable names');
  
  console.log('\n📋 Summary of changes:');
  console.log('- Renamed R2_* variables to CLOUDFLARE_*');
  console.log('- Renamed GOOGLE_AI_API_KEY to GEMINI_API_KEY');
  console.log('- Updated Redis configuration');
  
  console.log('\n✨ Done! Now restart your dev server:');
  console.log('  npm run dev');
  
  rl.close();
});