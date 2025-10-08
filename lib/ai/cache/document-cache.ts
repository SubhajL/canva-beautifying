// Minimal document cache for tests
import type { DocumentType } from '../types'

type CachedDoc = { id: string; type: DocumentType }
const docs: CachedDoc[] = []

export class DocumentCache {
  async getSimilar(type: DocumentType, limit: number): Promise<CachedDoc[]> {
    return docs.filter(d => d.type === type).slice(0, limit)
  }

  async add(doc: CachedDoc): Promise<void> {
    docs.push(doc)
  }
}

