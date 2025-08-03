#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 BeautifyAI Local Setup Tester\n');

// Colors
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

let passed = 0;
let failed = 0;
let warnings = 0;

function check(name, condition, warning = false) {
  if (condition) {
    console.log(`${green}✓${reset} ${name}`);
    passed++;
  } else if (warning) {
    console.log(`${yellow}⚠${reset} ${name}`);
    warnings++;
  } else {
    console.log(`${red}✗${reset} ${name}`);
    failed++;
  }
}

function checkCommand(command, name) {
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 1. Check Node.js version
console.log('📋 Checking Prerequisites...\n');
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
check('Node.js 20+', majorVersion >= 20);

// 2. Check npm
check('npm installed', checkCommand('npm --version', 'npm'));

// 3. Check environment file
const envPath = path.join(process.cwd(), '.env.local');
check('.env.local exists', fs.existsSync(envPath));

// 4. Check required environment variables
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'REDIS_URL',
    'OPENAI_API_KEY',
    'GOOGLE_AI_API_KEY',
    'REPLICATE_API_TOKEN'
  ];

  console.log('\n📋 Checking Environment Variables...\n');
  requiredVars.forEach(varName => {
    const hasVar = envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=your_`);
    check(`${varName} configured`, hasVar, !hasVar);
  });
}

// 5. Check dependencies
console.log('\n📋 Checking Dependencies...\n');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
check('Next.js installed', packageJson.dependencies['next']);
check('Supabase installed', packageJson.dependencies['@supabase/supabase-js']);
check('BullMQ installed', packageJson.dependencies['bullmq']);
check('Socket.io installed', packageJson.dependencies['socket.io']);

// 6. Check project structure
console.log('\n📋 Checking Project Structure...\n');
const requiredDirs = [
  'app',
  'components',
  'lib',
  'public',
  'scripts',
  '.next'
];

requiredDirs.forEach(dir => {
  check(`${dir}/ directory exists`, fs.existsSync(dir), dir === '.next');
});

// 7. Check if services are running
console.log('\n📋 Checking Running Services...\n');
check('Port 3000 available', !checkCommand('lsof -i :3000', 'Next.js'), true);
check('Port 3001 available', !checkCommand('lsof -i :3001', 'WebSocket'), true);

// 8. Check Redis connection
console.log('\n📋 Checking External Services...\n');
try {
  if (process.env.REDIS_URL || (fs.existsSync(envPath) && fs.readFileSync(envPath, 'utf8').includes('REDIS_URL='))) {
    check('Redis configuration found', true);
  } else {
    check('Redis configuration found', false, true);
  }
} catch {
  check('Redis configuration found', false, true);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('\n📊 Test Summary:\n');
console.log(`${green}Passed:${reset} ${passed}`);
console.log(`${yellow}Warnings:${reset} ${warnings}`);
console.log(`${red}Failed:${reset} ${failed}`);

if (failed === 0) {
  console.log(`\n${green}✅ Your local setup is ready for testing!${reset}`);
  console.log('\n🚀 Next steps:');
  console.log('1. Start dev server: npm run dev');
  console.log('2. Start workers: npm run workers:dev');
  console.log('3. Start WebSocket: npm run websocket:dev');
  console.log('4. Open http://localhost:3000');
} else {
  console.log(`\n${red}❌ Please fix the issues above before testing.${reset}`);
}

console.log('\n' + '='.repeat(50) + '\n');