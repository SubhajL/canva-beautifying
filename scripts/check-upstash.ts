import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

console.log('Checking Upstash configuration...\n');

const url = process.env.UPSTASH_REDIS_URL;
const token = process.env.UPSTASH_REDIS_TOKEN;

console.log('UPSTASH_REDIS_URL:', url);
console.log('UPSTASH_REDIS_TOKEN:', token ? `${token.substring(0, 20)}...` : 'NOT SET');

if (url?.startsWith('https://')) {
  console.log('\n⚠️  WARNING: You have a REST URL, but the app needs a Redis protocol URL');
  console.log('\nTo fix this:');
  console.log('1. Go to console.upstash.com');
  console.log('2. Click on your database');
  console.log('3. In the "Connect" section, find the Redis URL (not REST URL)');
  console.log('4. It should look like: redis://default:PASSWORD@HOST:PORT');
  console.log('5. Update UPSTASH_REDIS_URL in .env.local with this Redis URL');
  
  // Extract potential Redis URL format
  const host = url.replace('https://', '').replace('.upstash.io', '');
  const port = host.split('-').pop();
  console.log(`\nYour Redis URL might be: redis://default:${token?.substring(0, 20)}...@${host}.upstash.io:${port}`);
} else if (url?.startsWith('redis://')) {
  console.log('\n✅ URL format looks correct for Redis protocol');
} else {
  console.log('\n❌ No valid Upstash URL found');
}