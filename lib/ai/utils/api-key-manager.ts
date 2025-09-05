import { getAIApiKeyStore } from '@/lib/redis/ai-api-key-store'
import type { AIModel } from '../types'

/**
 * API Key Manager for AI services
 * Now uses Redis for distributed key storage and rotation
 */
export class APIKeyManager {
  private keyStore = getAIApiKeyStore()
  private initialized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      await this.keyStore.initializeFromEnvironment()
      this.initialized = true
    } catch (error) {
      console.error('[APIKeyManager] Failed to initialize from environment:', error)
    }
  }

  /**
   * Get API key for a model (synchronous for backward compatibility)
   * Uses environment variables directly
   */
  getApiKey(model: AIModel): string | null {
    // For now, use environment directly to maintain sync behavior
    // TODO: Update AI service to use async getApiKeyAsync
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
   * Get API key for a model (async version using Redis)
   * @preferred Use this instead of getApiKey
   */
  async getApiKeyAsync(model: AIModel): Promise<string | null> {
    await this.initialize()
    
    try {
      const key = await this.keyStore.getKey(model)
      
      if (!key) {
        console.error(`No API key configured for model: ${model}`)
      }
      
      return key
    } catch (error) {
      console.error(`Failed to get API key for ${model}:`, error)
      return null
    }
  }

  /**
   * Set API key for a model
   */
  async setApiKey(model: AIModel, key: string, isFallback: boolean = false): Promise<void> {
    await this.initialize()
    
    const provider = this.getProvider(model)
    await this.keyStore.setKey(model, key, { isFallback, provider })
  }

  /**
   * Rotate API keys (swap primary and fallback)
   */
  async rotateKey(model: AIModel): Promise<boolean> {
    const primaryKey = await this.keyStore.getKey(model)
    const fallbackKey = await this.keyStore.getFallbackKey(model)
    
    if (!primaryKey || !fallbackKey) {
      console.error(`Cannot rotate key for ${model}: Missing primary or fallback key`)
      return false
    }
    
    // Swap keys
    await this.keyStore.setKey(model, fallbackKey)
    await this.keyStore.setKey(model, primaryKey, { isFallback: true })
    
    console.log(`[APIKeyManager] Rotated API key for ${model}`)
    return true
  }

  /**
   * Validate that required keys are present
   */
  async validateKeys(): Promise<{ valid: boolean; missing: AIModel[] }> {
    await this.initialize()
    
    const missing: AIModel[] = []
    const requiredModels: AIModel[] = [
      'gemini-2.0-flash',
      'gpt-4o-mini', 
      'claude-3.5-sonnet'
    ]

    for (const model of requiredModels) {
      const stats = await this.keyStore.getKeyStats(model)
      if (!stats || !stats.hasKey) {
        missing.push(model)
      }
    }

    return {
      valid: missing.length === 0,
      missing
    }
  }

  /**
   * Get key status for all models
   */
  async getKeyStatus(): Promise<Record<AIModel, {
    hasKey: boolean
    hasFallback: boolean
    usageCount: number
    lastRotated?: Date
  }>> {
    await this.initialize()
    
    const allModels: AIModel[] = [
      'gemini-2.0-flash',
      'gpt-4o-mini',
      'claude-3.5-sonnet',
      'claude-4-sonnet'
    ]

    const status = {} as Record<AIModel, {
      hasKey: boolean
      hasFallback: boolean
      usageCount: number
      lastRotated?: Date
    }>

    for (const model of allModels) {
      const stats = await this.keyStore.getKeyStats(model)
      
      if (stats) {
        status[model] = {
          hasKey: stats.hasKey,
          hasFallback: stats.hasFallback,
          usageCount: stats.usageCount,
          lastRotated: stats.rotatedAt || undefined
        }
      } else {
        status[model] = {
          hasKey: false,
          hasFallback: false,
          usageCount: 0
        }
      }
    }

    return status
  }

  /**
   * Get provider name for a model
   */
  private getProvider(model: AIModel): 'openai' | 'google' | 'anthropic' {
    if (model.includes('gemini')) return 'google'
    if (model.includes('gpt')) return 'openai'
    return 'anthropic'
  }

  /**
   * Mask API key for logging
   */
  static maskApiKey(key: string): string {
    if (!key || key.length < 8) return '***'
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
  }
}

// Export singleton instance
export const apiKeyManager = new APIKeyManager()