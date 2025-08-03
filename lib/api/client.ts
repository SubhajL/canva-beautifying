/**
 * BeautifyAI API Client SDK
 * 
 * Usage:
 * ```typescript
 * const client = new BeautifyAIClient({
 *   token: 'your-api-token',
 *   baseUrl: 'https://api.beautifyai.com/api/v1' // optional
 * })
 * 
 * const enhancement = await client.enhance(file, {
 *   enhancementSettings: {
 *     style: 'modern',
 *     targetAudience: 'professionals'
 *   }
 * })
 * ```
 */

import type { 
  EnhanceRequest, 
  EnhancementStatus,
  HistoryQuery 
} from './validation'
import type { ApiResponse } from './response'

export interface BeautifyAIConfig {
  token: string
  baseUrl?: string
  timeout?: number
  onProgress?: (progress: number, stage?: string) => void
}

export interface EnhancementResult {
  id: string
  documentId: string
  status: string
  progress: number
  queuePosition?: number
  estimatedWaitTime?: number
  createdAt: string
  links: {
    status: string
    cancel?: string
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export class BeautifyAIClient {
  private config: Required<BeautifyAIConfig>
  
  constructor(config: BeautifyAIConfig) {
    this.config = {
      baseUrl: 'https://api.beautifyai.com/api/v1',
      timeout: 30000,
      onProgress: () => {},
      ...config,
    }
  }
  
  /**
   * Create a new enhancement
   */
  async enhance(
    file: File | Blob,
    settings?: EnhanceRequest
  ): Promise<EnhancementResult> {
    const formData = new FormData()
    formData.append('file', file)
    
    if (settings) {
      formData.append('settings', JSON.stringify(settings))
    }
    
    const response = await this.request('/enhance', {
      method: 'POST',
      body: formData,
    })
    
    return response.data
  }
  
  /**
   * Get enhancement status
   */
  async getStatus(enhancementId: string): Promise<EnhancementStatus> {
    const response = await this.request(`/enhance/${enhancementId}`)
    return response.data
  }
  
  /**
   * Get enhancement history
   */
  async getHistory(query?: HistoryQuery): Promise<PaginatedResponse<EnhancementStatus>> {
    const params = new URLSearchParams()
    
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value))
        }
      })
    }
    
    const response = await this.request(`/enhance?${params}`)
    return response.data
  }
  
  /**
   * Cancel an enhancement
   */
  async cancel(enhancementId: string): Promise<{ message: string }> {
    const response = await this.request(`/enhance/${enhancementId}`, {
      method: 'DELETE',
    })
    return response.data
  }
  
  /**
   * Wait for enhancement to complete with polling
   */
  async waitForCompletion(
    enhancementId: string,
    options: {
      pollInterval?: number
      timeout?: number
    } = {}
  ): Promise<EnhancementStatus> {
    const { pollInterval = 2000, timeout = 600000 } = options
    const startTime = Date.now()
    
    while (true) {
      const status = await this.getStatus(enhancementId)
      
      // Update progress callback
      if (this.config.onProgress) {
        this.config.onProgress(status.progress || 0, status.currentStage)
      }
      
      // Check if completed
      if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
        return status
      }
      
      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error('Enhancement timeout')
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
  }
  
  /**
   * Enhance a document and wait for completion
   */
  async enhanceAndWait(
    file: File | Blob,
    settings?: EnhanceRequest,
    waitOptions?: {
      pollInterval?: number
      timeout?: number
    }
  ): Promise<EnhancementStatus> {
    const enhancement = await this.enhance(file, settings)
    return this.waitForCompletion(enhancement.id, waitOptions)
  }
  
  /**
   * Make an authenticated request
   */
  private async request<T = unknown>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${path}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          ...options.headers,
        },
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new BeautifyAIError(
          data.error?.message || 'Request failed',
          data.error?.code || 'UNKNOWN_ERROR',
          response.status,
          data.error?.details
        )
      }
      
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof BeautifyAIError) {
        throw error
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new BeautifyAIError('Request timeout', 'TIMEOUT', 0)
      }
      
      throw new BeautifyAIError(
        error instanceof Error ? error.message : 'Unknown error',
        'NETWORK_ERROR',
        0
      )
    }
  }
}

export class BeautifyAIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'BeautifyAIError'
  }
}

/**
 * Helper function to create a client from environment variables
 */
export function createClient(config?: Partial<BeautifyAIConfig>): BeautifyAIClient {
  const token = config?.token || process.env.BEAUTIFYAI_API_TOKEN || process.env.NEXT_PUBLIC_BEAUTIFYAI_API_TOKEN
  
  if (!token) {
    throw new Error('BeautifyAI API token is required')
  }
  
  return new BeautifyAIClient({
    token,
    baseUrl: config?.baseUrl || process.env.BEAUTIFYAI_API_URL || process.env.NEXT_PUBLIC_BEAUTIFYAI_API_URL,
    ...config,
  })
}