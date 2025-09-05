import Redis from 'ioredis'
import { EventEmitter } from 'events'

interface RedisManagerOptions {
  url?: string
  maxRetries?: number
  retryDelay?: number
  enableFallback?: boolean
}

interface ConnectionStatus {
  connected: boolean
  connectionAttempts: number
  lastError?: Error
  fallbackMode: boolean
}

export class RedisManager extends EventEmitter {
  private redis: Redis | null = null
  private options: Required<RedisManagerOptions>
  private connectionStatus: ConnectionStatus = {
    connected: false,
    connectionAttempts: 0,
    fallbackMode: false
  }
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(options: RedisManagerOptions = {}) {
    super()
    this.options = {
      url: options.url || process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetries: options.maxRetries || 5,
      retryDelay: options.retryDelay || 1000,
      enableFallback: options.enableFallback ?? true
    }
  }

  async ensureRedisConnection(retries?: number): Promise<Redis | null> {
    const maxAttempts = retries ?? this.options.maxRetries
    
    if (this.redis && this.connectionStatus.connected) {
      return this.redis
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.connectionStatus.connectionAttempts = attempt
        
        this.redis = new Redis(this.options.url, {
          retryStrategy: (times) => {
            if (times > 3) return null
            return Math.min(times * 50, 2000)
          },
          enableOfflineQueue: false,
          lazyConnect: true
        })

        await this.redis.connect()
        
        this.connectionStatus.connected = true
        this.connectionStatus.fallbackMode = false
        this.emit('connected', { attempt, fallbackMode: false })
        
        this.setupEventHandlers()
        return this.redis
        
      } catch (error) {
        this.connectionStatus.lastError = error as Error
        this.emit('connectionError', { attempt, error, maxAttempts })
        
        if (attempt < maxAttempts) {
          const delay = this.options.retryDelay * Math.pow(1.5, attempt - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries exhausted
    if (this.options.enableFallback) {
      this.connectionStatus.fallbackMode = true
      this.emit('fallbackMode', { reason: 'Connection failed after retries' })
      return null // Caller should handle in-memory fallback
    }

    throw new Error(`Redis connection failed after ${maxAttempts} attempts: ${this.connectionStatus.lastError?.message}`)
  }

  private setupEventHandlers(): void {
    if (!this.redis) return

    this.redis.on('error', (error) => {
      console.error('[RedisManager] Connection error:', error)
      this.connectionStatus.connected = false
      this.connectionStatus.lastError = error
      this.emit('error', error)
      this.scheduleReconnect()
    })

    this.redis.on('close', () => {
      this.connectionStatus.connected = false
      this.emit('disconnected')
      this.scheduleReconnect()
    })

    this.redis.on('reconnecting', () => {
      this.emit('reconnecting')
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      try {
        await this.ensureRedisConnection()
      } catch (error) {
        console.error('[RedisManager] Reconnection failed:', error)
      }
    }, this.options.retryDelay)
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.redis) {
      await this.redis.quit()
      this.redis = null
    }

    this.connectionStatus.connected = false
    this.emit('disconnected')
  }

  getStatus(): ConnectionStatus {
    return { ...this.connectionStatus }
  }

  getClient(): Redis | null {
    return this.redis
  }

  isConnected(): boolean {
    return this.connectionStatus.connected && !this.connectionStatus.fallbackMode
  }

  isInFallbackMode(): boolean {
    return this.connectionStatus.fallbackMode
  }
}

export const redisManager = new RedisManager()