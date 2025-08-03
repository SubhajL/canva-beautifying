import { Redis } from 'ioredis'
import { ConnectionOptions } from 'bullmq'

// Create Redis connection based on environment
const createRedisConnection = (): Redis => {
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    // Use Upstash Redis for production
    return new Redis(process.env.UPSTASH_REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: {
        rejectUnauthorized: false
      },
      password: process.env.UPSTASH_REDIS_TOKEN,
    })
  } else {
    // Use local Redis for development
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    })
  }
}

// Export connection configuration for BullMQ
export const getQueueConnection = (): ConnectionOptions => {
  if (process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    return {
      host: new URL(process.env.UPSTASH_REDIS_URL).hostname,
      port: parseInt(new URL(process.env.UPSTASH_REDIS_URL).port || '6379'),
      password: process.env.UPSTASH_REDIS_TOKEN,
      tls: {
        rejectUnauthorized: false
      }
    }
  } else {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    }
  }
}

// Create a shared Redis instance for the application
export const redis = createRedisConnection()

// Queue configuration constants
export const QUEUE_NAMES = {
  DOCUMENT_ANALYSIS: 'document-analysis',
  ENHANCEMENT: 'enhancement',
  EXPORT: 'export',
  EMAIL: 'email',
} as const

export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    age: 3600, // keep completed jobs for 1 hour
    count: 100, // keep last 100 completed jobs
  },
  removeOnFail: {
    age: 86400, // keep failed jobs for 24 hours
    count: 1000, // keep last 1000 failed jobs
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
}

// Priority levels for jobs
export const PRIORITY_LEVELS = {
  LOW: 10,
  NORMAL: 5,
  HIGH: 3,
  CRITICAL: 1,
} as const

// Job status types
export const JOB_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  PAUSED: 'paused',
} as const