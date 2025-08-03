import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testRedis() {
  console.log('Testing Upstash Redis connection...\n');
  
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  
  if (!url || !token) {
    console.error('❌ Missing UPSTASH_REDIS_URL or UPSTASH_REDIS_TOKEN in .env.local');
    process.exit(1);
  }
  
  console.log(`📍 URL: ${url}`);
  console.log(`🔑 Token: ${token.substring(0, 20)}...`);
  
  try {
    const redis = new Redis(url, {
      password: token,
      tls: {},
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000)
    });
    
    // Test basic operations
    await redis.ping();
    console.log('✅ Connected successfully!');
    
    await redis.set('test:key', 'Hello BeautifyAI');
    const value = await redis.get('test:key');
    console.log(`✅ Read test value: ${value}`);
    
    await redis.del('test:key');
    console.log('✅ Cleanup complete');
    
    await redis.quit();
    console.log('\n🎉 Redis is working correctly!');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Verify your Upstash database exists at console.upstash.com');
    console.log('2. Check that URL starts with https://');
    console.log('3. Ensure the token is the REST token (not Redis protocol token)');
    process.exit(1);
  }
}

testRedis();