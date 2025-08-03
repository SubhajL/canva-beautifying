#!/usr/bin/env tsx
/**
 * Test Redis/Upstash connection
 * Run: npx tsx scripts/test-redis.ts
 */

import { config } from 'dotenv'
import { Redis } from 'ioredis'
import { Queue } from 'bullmq'
import { getQueueConnection } from '../lib/queue/config'

// Load environment variables
config({ path: '.env.local' })

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...\n')

  try {
    // Test 1: Direct Redis connection
    console.log('1️⃣ Testing direct Redis connection...')
    let redis: Redis

    if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
      console.log('   Using Upstash Redis')
      redis = new Redis(process.env.UPSTASH_REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        tls: {
          rejectUnauthorized: false
        },
        password: process.env.UPSTASH_REDIS_TOKEN,
      })
    } else {
      console.log('   Using local Redis')
      redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null,
      })
    }

    // Test basic operations
    await redis.set('test:key', 'Hello Redis!')
    const value = await redis.get('test:key')
    console.log('   ✅ Redis connected! Test value:', value)
    await redis.del('test:key')
    await redis.quit()

    // Test 2: BullMQ Queue connection
    console.log('\n2️⃣ Testing BullMQ queue connection...')
    const connection = getQueueConnection()
    const testQueue = new Queue('test-queue', { connection })
    
    // Add a test job
    const job = await testQueue.add('test-job', { message: 'Hello BullMQ!' })
    console.log('   ✅ Queue connected! Test job ID:', job.id)
    
    // Clean up
    await testQueue.obliterate({ force: true })
    await testQueue.close()

    console.log('\n✅ All Redis tests passed!')
    console.log('\nRedis is properly configured and ready for use.')

  } catch (error) {
    console.error('\n❌ Redis connection failed!')
    console.error('Error:', error instanceof Error ? error.message : error)
    
    console.log('\n📋 Troubleshooting:')
    if (process.env.UPSTASH_REDIS_URL) {
      console.log('1. Check your Upstash credentials are correct')
      console.log('2. Ensure your Upstash database is active')
      console.log('3. Verify TLS is enabled in Upstash settings')
    } else {
      console.log('1. Ensure Redis is installed: brew install redis')
      console.log('2. Start Redis: brew services start redis')
      console.log('3. Check Redis is running: redis-cli ping')
    }
    
    process.exit(1)
  }
}

// Run the test
testRedisConnection()