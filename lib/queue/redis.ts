import Redis from 'ioredis'

// Redis connection configuration
const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL

// In test environment, use test database
const isTest = process.env.NODE_ENV === 'test'

if (!redisUrl && !isTest) {
  throw new Error('Redis URL is not configured. Please set REDIS_URL or UPSTASH_REDIS_URL in your environment variables.')
}

// Parse Redis URL for Upstash compatibility
type RedisOptions = string | {
  host: string
  port: number
  password?: string
  tls?: {
    rejectUnauthorized: boolean
  }
  enableOfflineQueue?: boolean
  maxRetriesPerRequest?: number
}

let redisOptions: RedisOptions

if (process.env.UPSTASH_REDIS_URL) {
  // Upstash Redis requires special handling
  redisOptions = {
    host: process.env.UPSTASH_REDIS_URL.replace('redis://', '').split('@')[1].split(':')[0],
    port: parseInt(process.env.UPSTASH_REDIS_URL.split(':')[3]),
    password: process.env.UPSTASH_REDIS_TOKEN,
    tls: {
      rejectUnauthorized: false
    },
    enableOfflineQueue: false,
    maxRetriesPerRequest: 3,
  }
} else {
  // Regular Redis URL
  redisOptions = redisUrl
}

// Create Redis client
// In tests, allow override with real Redis instance
let redisInstance: Redis | null = null

if (isTest && process.env.USE_TEST_REDIS_INSTANCE === 'true') {
  // Tests will inject their own Redis instance
  redisInstance = null
} else {
  redisInstance = new Redis(redisOptions as any)
}

export const redis = redisInstance || new Redis(redisOptions as any)

// Allow tests to inject real Redis instance
export function setTestRedisInstance(instance: Redis) {
  if (isTest) {
    (redis as any) = instance
  }
}

// Error handling
redis.on('error', (error) => {
  console.error('Redis connection error:', error)
})

redis.on('connect', () => {
  console.log('Redis connected successfully')
})

// Helper functions for common Redis operations
export const redisHelpers = {
  // Get with JSON parsing
  async getJSON<T = unknown>(key: string): Promise<T | null> {
    const value = await redis.get(key)
    return value ? JSON.parse(value) : null
  },

  // Set with JSON stringification
  async setJSON<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const stringified = JSON.stringify(value)
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, stringified)
    } else {
      await redis.set(key, stringified)
    }
  },

  // Delete multiple keys by pattern
  async deletePattern(pattern: string): Promise<number> {
    const keys = await redis.keys(pattern)
    if (keys.length === 0) return 0
    return await redis.del(...keys)
  },

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    const result = await redis.exists(key)
    return result === 1
  },
}

// Export default Redis instance
export default redis