import { io, Socket } from 'socket.io-client'
import { EventEmitter } from 'events'
import fetch from 'node-fetch'

export interface HealthStatus {
  healthy: boolean
  timestamp: Date
  latency?: number
  error?: string
  services: {
    websocket: boolean
    redis: boolean
  }
}

interface HealthCheckOptions {
  url: string
  interval?: number
  timeout?: number
  retries?: number
}

export class WebSocketHealthChecker extends EventEmitter {
  private socket: Socket | null = null
  private options: Required<HealthCheckOptions>
  private monitoringInterval: NodeJS.Timeout | null = null
  private lastHealthStatus: HealthStatus = {
    healthy: false,
    timestamp: new Date(),
    services: {
      websocket: false,
      redis: false
    }
  }

  constructor(options: HealthCheckOptions) {
    super()
    this.options = {
      url: options.url,
      interval: options.interval || 30000, // 30 seconds
      timeout: options.timeout || 5000,
      retries: options.retries || 3
    }
  }

  async checkWebSocketHealth(): Promise<HealthStatus> {
    const startTime = Date.now()
    
    for (let attempt = 1; attempt <= this.options.retries; attempt++) {
      try {
        const status = await this.performHealthCheck()
        status.latency = Date.now() - startTime
        this.lastHealthStatus = status
        this.emit('healthCheck', status)
        return status
      } catch (error) {
        if (attempt === this.options.retries) {
          const failureStatus: HealthStatus = {
            healthy: false,
            timestamp: new Date(),
            latency: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            services: {
              websocket: false,
              redis: false
            }
          }
          this.lastHealthStatus = failureStatus
          this.emit('healthCheckFailed', failureStatus)
          return failureStatus
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return this.lastHealthStatus
  }

  private async performHealthCheck(): Promise<HealthStatus> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.disconnect()
          this.socket = null
        }
        reject(new Error('Health check timeout'))
      }, this.options.timeout)

      this.socket = io(this.options.url, {
        transports: ['websocket'],
        reconnection: false,
        timeout: this.options.timeout
      })

      this.socket.on('connect', () => {
        // Send health check request
        this.socket!.emit('health:check', {}, (response: any) => {
          clearTimeout(timeout)
          
          const status: HealthStatus = {
            healthy: response?.status === 'ok',
            timestamp: new Date(),
            services: {
              websocket: response?.status === 'ok',
              redis: response?.redis === 'connected'
            }
          }

          if (this.socket) {
            this.socket.disconnect()
            this.socket = null
          }

          resolve(status)
        })
      })

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout)
        if (this.socket) {
          this.socket.disconnect()
          this.socket = null
        }
        reject(error)
      })
    })
  }

  async monitorServiceHealth(interval?: number): Promise<void> {
    const checkInterval = interval || this.options.interval
    
    // Perform initial check
    await this.checkWebSocketHealth()
    
    // Stop existing monitoring if any
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      const status = await this.checkWebSocketHealth()
      
      if (!status.healthy) {
        this.emit('unhealthy', status)
      } else if (!this.lastHealthStatus.healthy && status.healthy) {
        // Service recovered
        this.emit('recovered', status)
      }
    }, checkInterval)

    this.emit('monitoringStarted', { interval: checkInterval })
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
      this.emit('monitoringStopped')
    }

    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getLastStatus(): HealthStatus {
    return { ...this.lastHealthStatus }
  }
}

// HTTP-based health checker for testing and alternative implementation
export class HttpWebSocketHealthChecker extends EventEmitter {
  private url: string
  private checkInterval: number
  private timeout: number
  private intervalId: NodeJS.Timeout | null = null
  
  constructor(url: string, options?: { checkInterval?: number; timeout?: number }) {
    super()
    this.url = url
    this.checkInterval = options?.checkInterval || 30000
    this.timeout = options?.timeout || 5000
  }
  
  async checkWebSocketHealth(): Promise<{ healthy: boolean; error?: string; details?: any }> {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.timeout)
      })
      
      // Create the fetch promise
      const fetchPromise = fetch(`${this.url}/health`).then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const data = await response.json()
        
        if (!data.healthy) {
          // Include data in error for malformed responses
          const error = new Error('WebSocket server reported unhealthy')
          ;(error as any).details = data
          throw error
        }
        
        return data
      })
      
      // Race between fetch and timeout
      const data = await Promise.race([fetchPromise, timeoutPromise])
      
      try {
        this.emit('healthy', data)
      } catch (error) {
        // Ignore event listener errors
      }
      
      return {
        healthy: true,
        details: data
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Health check timeout') {
          return {
            healthy: false,
            error: 'Health check timeout'
          }
        }
        
        try {
          this.emit('unhealthy', { error: error.message })
        } catch (emitError) {
          // Ignore event listener errors
        }
        
        return {
          healthy: false,
          error: error.message,
          details: (error as any).details
        }
      }
      
      return {
        healthy: false,
        error: 'Unknown error during health check'
      }
    }
  }
  
  start(): void {
    this.stop() // Clear any existing interval
    this.intervalId = setInterval(async () => {
      await this.checkWebSocketHealth()
    }, this.checkInterval)
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }
}

// Original socket.io-based health checker constructor overload for backward compatibility
export { WebSocketHealthChecker as SocketIOWebSocketHealthChecker }

// Factory function to create appropriate health checker
export function createWebSocketHealthChecker(
  urlOrOptions: string | HealthCheckOptions, 
  httpOptions?: { checkInterval?: number; timeout?: number }
): WebSocketHealthChecker | HttpWebSocketHealthChecker {
  if (typeof urlOrOptions === 'string' && httpOptions) {
    // HTTP-based health checker (used in tests)
    return new HttpWebSocketHealthChecker(urlOrOptions, httpOptions)
  } else if (typeof urlOrOptions === 'object') {
    // Socket.io-based health checker
    return new WebSocketHealthChecker(urlOrOptions)
  }
  
  throw new Error('Invalid arguments for createWebSocketHealthChecker')
}

// Singleton instance for the application
let healthChecker: WebSocketHealthChecker | null = null

export function getHealthChecker(url?: string): WebSocketHealthChecker {
  if (!healthChecker && url) {
    healthChecker = new WebSocketHealthChecker({ url })
  } else if (!healthChecker) {
    throw new Error('Health checker not initialized. Provide URL on first call.')
  }
  return healthChecker
}