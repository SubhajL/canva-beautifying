import { AIModel } from '../types'

interface APIKeyConfig {
  primary: string
  fallback?: string
  rotationEnabled?: boolean
  lastRotated?: Date
  usageCount?: number
  maxUsageBeforeRotation?: number
}

export class APIKeyManager {
  private keys: Map<AIModel, APIKeyConfig> = new Map()
  
  constructor() {
    this.loadKeysFromEnvironment()
  }

  private loadKeysFromEnvironment(): void {
    // Load Gemini keys
    const geminiKey = process.env.GEMINI_API_KEY
    const geminiFallbackKey = process.env.GEMINI_API_KEY_FALLBACK
    if (geminiKey) {
      this.keys.set('gemini-2.0-flash', {
        primary: geminiKey,
        fallback: geminiFallbackKey,
        rotationEnabled: !!geminiFallbackKey,
        usageCount: 0
      })
    }

    // Load OpenAI keys
    const openaiKey = process.env.OPENAI_API_KEY
    const openaiFallbackKey = process.env.OPENAI_API_KEY_FALLBACK
    if (openaiKey) {
      this.keys.set('gpt-4o-mini', {
        primary: openaiKey,
        fallback: openaiFallbackKey,
        rotationEnabled: !!openaiFallbackKey,
        usageCount: 0
      })
    }

    // Load Claude keys
    const claudeKey = process.env.ANTHROPIC_API_KEY
    const claudeFallbackKey = process.env.ANTHROPIC_API_KEY_FALLBACK
    if (claudeKey) {
      // Use same keys for both Claude models
      const claudeConfig = {
        primary: claudeKey,
        fallback: claudeFallbackKey,
        rotationEnabled: !!claudeFallbackKey,
        usageCount: 0
      }
      this.keys.set('claude-3.5-sonnet', claudeConfig)
      this.keys.set('claude-4-sonnet', claudeConfig)
    }
  }

  getApiKey(model: AIModel): string | null {
    const config = this.keys.get(model)
    if (!config) {
      console.error(`No API key configured for model: ${model}`)
      return null
    }

    // Increment usage count
    if (config.usageCount !== undefined) {
      config.usageCount++
    }

    // Check if rotation is needed
    if (config.rotationEnabled && config.maxUsageBeforeRotation) {
      if (config.usageCount && config.usageCount >= config.maxUsageBeforeRotation) {
        this.rotateKey(model)
      }
    }

    return config.primary
  }

  rotateKey(model: AIModel): boolean {
    const config = this.keys.get(model)
    if (!config || !config.fallback) {
      console.error(`Cannot rotate key for ${model}: No fallback key available`)
      return false
    }

    // Swap primary and fallback
    const temp = config.primary
    config.primary = config.fallback
    config.fallback = temp
    config.lastRotated = new Date()
    config.usageCount = 0

    console.log(`Rotated API key for ${model}`)
    return true
  }

  setApiKey(model: AIModel, key: string, isFallback: boolean = false): void {
    const config = this.keys.get(model) || {
      primary: '',
      rotationEnabled: false,
      usageCount: 0
    }

    if (isFallback) {
      config.fallback = key
      config.rotationEnabled = true
    } else {
      config.primary = key
    }

    this.keys.set(model, config)
  }

  validateKeys(): { valid: boolean; missing: AIModel[] } {
    const missing: AIModel[] = []
    const requiredModels: AIModel[] = [
      'gemini-2.0-flash',
      'gpt-4o-mini', 
      'claude-3.5-sonnet'
    ]

    for (const model of requiredModels) {
      const config = this.keys.get(model)
      if (!config || !config.primary) {
        missing.push(model)
      }
    }

    return {
      valid: missing.length === 0,
      missing
    }
  }

  getKeyStatus(): Record<AIModel, {
    hasKey: boolean
    hasFallback: boolean
    usageCount: number
    lastRotated?: Date
  }> {
    const status: Record<AIModel, {
      hasKey: boolean
      hasFallback: boolean
      usageCount: number
      lastRotated?: Date
    }> = {} as Record<AIModel, {
      hasKey: boolean
      hasFallback: boolean
      usageCount: number
      lastRotated?: Date
    }>
    
    const allModels: AIModel[] = [
      'gemini-2.0-flash',
      'gpt-4o-mini',
      'claude-3.5-sonnet',
      'claude-4-sonnet'
    ]

    for (const model of allModels) {
      const config = this.keys.get(model)
      status[model] = {
        hasKey: !!config?.primary,
        hasFallback: !!config?.fallback,
        usageCount: config?.usageCount || 0,
        lastRotated: config?.lastRotated
      }
    }

    return status
  }

  // Mask API key for logging
  static maskApiKey(key: string): string {
    if (!key || key.length < 8) return '***'
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
  }
}

// Singleton instance
export const apiKeyManager = new APIKeyManager()