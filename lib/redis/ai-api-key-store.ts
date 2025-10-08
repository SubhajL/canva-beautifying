// Minimal in-memory AI API key store for tests/local.
import type { AIModel } from '@/lib/ai/types'

type KeyStats = {
  hasKey: boolean
  hasFallback: boolean
  usageCount: number
  rotatedAt?: Date
}

type Entry = { primary?: string; fallback?: string; stats: KeyStats }

const store = new Map<AIModel, Entry>()

function ensure(model: AIModel): Entry {
  if (!store.has(model)) {
    store.set(model, {
      stats: { hasKey: false, hasFallback: false, usageCount: 0 }
    })
  }
  return store.get(model) as Entry
}

export function getAIApiKeyStore() {
  return {
    async initializeFromEnvironment(): Promise<void> {
      // Seed from environment if present to mirror prod behavior
      const seeds: Array<[AIModel, string | undefined]> = [
        ['gemini-2.0-flash', process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY],
        ['gpt-4o-mini', process.env.OPENAI_API_KEY],
        ['claude-3.5-sonnet', process.env.ANTHROPIC_API_KEY],
        ['claude-4-sonnet', process.env.ANTHROPIC_API_KEY],
      ]
      for (const [model, key] of seeds) {
        if (key) await this.setKey(model, key)
      }
    },

    async getKey(model: AIModel): Promise<string | null> {
      const e = ensure(model)
      return e.primary || null
    },

    async getFallbackKey(model: AIModel): Promise<string | null> {
      const e = ensure(model)
      return e.fallback || null
    },

    async setKey(
      model: AIModel,
      key: string,
      opts?: { isFallback?: boolean; provider?: 'openai' | 'google' | 'anthropic' }
    ): Promise<void> {
      const e = ensure(model)
      if (opts?.isFallback) {
        e.fallback = key
        e.stats.hasFallback = true
      } else {
        e.primary = key
        e.stats.hasKey = true
      }
      store.set(model, e)
    },

    async getKeyStats(model: AIModel): Promise<KeyStats> {
      const e = ensure(model)
      return { ...e.stats }
    },
  }
}

