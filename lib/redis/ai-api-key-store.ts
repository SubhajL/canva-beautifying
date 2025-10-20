import { redis as defaultRedis } from '../queue/redis'
import type { AIModel } from '../ai/types'
import type Redis from 'ioredis'
import crypto from 'crypto'

export interface KeyStats {
  hasKey: boolean
  hasFallback: boolean
  usageCount: number
  provider?: 'openai' | 'google' | 'anthropic'
  rotatedAt: Date
}

export interface SetKeyOptions {
  isFallback?: boolean
  provider?: 'openai' | 'google' | 'anthropic'
}

/**
 * Redis-based encrypted API key store for AI services
 * Provides secure storage with automatic rotation and usage tracking
 */
export class AIApiKeyStore {
  private static readonly KEY_PREFIX = 'ai:keys:'
  private static readonly ROTATION_THRESHOLD = 100000
  private static readonly DEFAULT_TTL = 86400 * 30 // 30 days
  
  private encryptionKey: Buffer
  private redis: Redis

  constructor(encryptionSecret?: string, redisInstance?: Redis) {
    this.redis = redisInstance || defaultRedis
    
    const secret = encryptionSecret || process.env.AI_KEY_ENCRYPTION_SECRET
    
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('AI_KEY_ENCRYPTION_SECRET must be provided in production')
      }
      // Use a default key for development/testing
      this.encryptionKey = Buffer.from('dev-key-32-chars-long-for-testing-', 'utf8')
    } else {
      if (secret.length < 32) {
        throw new Error('AI_KEY_ENCRYPTION_SECRET must be at least 32 characters')
      }
      this.encryptionKey = Buffer.from(secret.slice(0, 32), 'utf8')
    }
  }

  /**
   * Encrypt an API key using AES-256-CBC
   */
  private encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return `${iv.toString('hex')}:${encrypted}`
  }

  /**
   * Decrypt an API key using AES-256-CBC
   */
  private decrypt(ciphertext: string): string {
    const [ivHex, encrypted] = ciphertext.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
  /**
   * Set an API key for a model
   */
  async setKey(model: AIModel, key: string, options: SetKeyOptions = {}): Promise<void> {
    const redisKey = `${AIApiKeyStore.KEY_PREFIX}${model}`
    const encryptedKey = this.encrypt(key)
    const now = new Date().toISOString()
    
    const field = options.isFallback ? 'fallback' : 'primary'
    
    const multi = this.redis.multi()
    multi.hset(redisKey, field, encryptedKey)
    multi.hset(redisKey, 'rotatedAt', now)
    
    if (options.provider) {
      multi.hset(redisKey, 'provider', options.provider)
    }
    
    if (!options.isFallback) {
      // Reset usage count when setting new primary key
      multi.hset(redisKey, 'usageCount', 0)
    }
    
    multi.expire(redisKey, AIApiKeyStore.DEFAULT_TTL)
    await multi.exec()
  }

  /**
   * Get the primary API key for a model
   */
  async getKey(model: AIModel): Promise<string | null> {
    try {
      const redisKey = `${AIApiKeyStore.KEY_PREFIX}${model}`
      const data = await this.redis.hgetall(redisKey)
      
      if (!data.primary) {
        return this.getEnvironmentKey(model)
      }

      // Check if rotation is needed
      const usageCount = parseInt(data.usageCount || '0')
      if (usageCount >= AIApiKeyStore.ROTATION_THRESHOLD && data.fallback) {
        await this.rotateKeys(model)
        // Get the newly rotated key
        const rotatedData = await this.redis.hgetall(redisKey)
        const decryptedKey = this.decrypt(rotatedData.primary)
        
        // Increment usage count
        await this.redis.hincrby(redisKey, 'usageCount', 1)
        return decryptedKey
      }

      // Increment usage count
      await this.redis.hincrby(redisKey, 'usageCount', 1)
      
      return this.decrypt(data.primary)
    } catch (error) {
      console.error(`[AIApiKeyStore] Error getting key for ${model}:`, error)
      return this.getEnvironmentKey(model)
    }
  }

  /**
   * Get the fallback API key for a model
   */
  async getFallbackKey(model: AIModel): Promise<string | null> {
    try {
      const redisKey = `${AIApiKeyStore.KEY_PREFIX}${model}`
      const data = await this.redis.hgetall(redisKey)
      
      if (!data.fallback) {
        return this.getEnvironmentFallbackKey(model)
      }
      
      return this.decrypt(data.fallback)
    } catch (error) {
      console.error(`[AIApiKeyStore] Error getting fallback key for ${model}:`, error)
      return this.getEnvironmentFallbackKey(model)
    }
  }

  /**
   * Get environment-based API key as fallback
   */
  private getEnvironmentKey(model: AIModel): string | null {
    switch (model) {
      case 'gemini-2.0-flash':
        return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null
      case 'gpt-4o-mini':
        return process.env.OPENAI_API_KEY || null
      case 'claude-3.5-sonnet':
      case 'claude-4-sonnet':
        return process.env.ANTHROPIC_API_KEY || null
      default:
        return null
    }
  }

  /**
   * Get environment-based fallback API key
   */
  private getEnvironmentFallbackKey(model: AIModel): string | null {
    switch (model) {
      case 'gemini-2.0-flash':
        return process.env.GOOGLE_API_KEY_FALLBACK || null
      case 'gpt-4o-mini':
        return process.env.OPENAI_API_KEY_FALLBACK || null
      case 'claude-3.5-sonnet':
      case 'claude-4-sonnet':
        return process.env.ANTHROPIC_API_KEY_FALLBACK || null
      default:
        return null
    }
  }

  /**
   * Rotate primary and fallback keys
   */
  private async rotateKeys(model: AIModel): Promise<void> {
    const redisKey = `${AIApiKeyStore.KEY_PREFIX}${model}`
    const data = await this.redis.hgetall(redisKey)
    
    if (!data.primary || !data.fallback) {
      throw new Error(`Cannot rotate keys for ${model}: missing primary or fallback key`)
    }

    // Swap keys atomically
    const multi = this.redis.multi()
    multi.hset(redisKey, 'primary', data.fallback)
    multi.hset(redisKey, 'fallback', data.primary)
    multi.hset(redisKey, 'usageCount', 1) // Reset count after rotation
    multi.hset(redisKey, 'rotatedAt', new Date().toISOString())
    await multi.exec()

    console.log(`[AIApiKeyStore] Rotated keys for ${model}`)
  }

  /**
   * Get usage statistics for a model
   */
  async getKeyStats(model: AIModel): Promise<KeyStats | null> {
    try {
      const redisKey = `${AIApiKeyStore.KEY_PREFIX}${model}`
      const data = await this.redis.hgetall(redisKey)
      
      if (!data.primary && !this.getEnvironmentKey(model)) {
        return null
      }

      return {
        hasKey: !!(data.primary || this.getEnvironmentKey(model)),
        hasFallback: !!(data.fallback || this.getEnvironmentFallbackKey(model)),
        usageCount: parseInt(data.usageCount || '0'),
        provider: data.provider as 'openai' | 'google' | 'anthropic' || undefined,
        rotatedAt: data.rotatedAt ? new Date(data.rotatedAt) : new Date()
      }
    } catch (error) {
      console.error(`[AIApiKeyStore] Error getting stats for ${model}:`, error)
      return null
    }
  }

  /**
   * Initialize keys from environment variables
   * Only sets keys that don't already exist in Redis
   */
  async initializeFromEnvironment(): Promise<void> {
    const models: Array<{
      model: AIModel
      provider: 'openai' | 'google' | 'anthropic'
      envVar: string
      fallbackEnvVar?: string
    }> = [
      {
        model: 'gemini-2.0-flash',
        provider: 'google',
        envVar: 'GOOGLE_API_KEY',
        fallbackEnvVar: 'GOOGLE_API_KEY_FALLBACK'
      },
      {
        model: 'gpt-4o-mini',
        provider: 'openai',
        envVar: 'OPENAI_API_KEY',
        fallbackEnvVar: 'OPENAI_API_KEY_FALLBACK'
      },
      {
        model: 'claude-3.5-sonnet',
        provider: 'anthropic',
        envVar: 'ANTHROPIC_API_KEY',
        fallbackEnvVar: 'ANTHROPIC_API_KEY_FALLBACK'
      },
      {
        model: 'claude-4-sonnet',
        provider: 'anthropic',
        envVar: 'ANTHROPIC_API_KEY',
        fallbackEnvVar: 'ANTHROPIC_API_KEY_FALLBACK'
      }
    ]

    for (const { model, provider, envVar, fallbackEnvVar } of models) {
      const redisKey = `${AIApiKeyStore.KEY_PREFIX}${model}`
      const existingData = await this.redis.hgetall(redisKey)
      
      // Only set from environment if not already in Redis
      if (!existingData.primary && process.env[envVar]) {
        await this.setKey(model, process.env[envVar]!, { provider })
      }
      
      if (!existingData.fallback && fallbackEnvVar && process.env[fallbackEnvVar]) {
        await this.setKey(model, process.env[fallbackEnvVar]!, { 
          provider, 
          isFallback: true 
        })
      }
    }
  }

  /**
   * Clear all stored keys
   */
  async clearAllKeys(): Promise<number> {
    const pattern = `${AIApiKeyStore.KEY_PREFIX}*`
    const keys = await this.redis.keys(pattern)
    
    if (keys.length === 0) return 0
    
    return await this.redis.del(...keys)
  }
}

// Export factory function to get singleton instance
let instance: AIApiKeyStore | null = null

export function getAIApiKeyStore(encryptionSecret?: string, redisInstance?: Redis): AIApiKeyStore {
  if (!instance) {
    instance = new AIApiKeyStore(encryptionSecret, redisInstance)
  }
  return instance
}

// Export the class for direct instantiation if needed
export { AIApiKeyStore }