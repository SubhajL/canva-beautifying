// Minimal enhancement cache for tests

type EnhancementRecord = {
  analysis?: unknown
  suggestions?: any[]
}

const data = new Map<string, EnhancementRecord>()

export class EnhancementCache {
  async get(id: string): Promise<EnhancementRecord | null> {
    return data.get(id) || null
  }

  async set(id: string, record: EnhancementRecord): Promise<void> {
    data.set(id, record)
  }
}

