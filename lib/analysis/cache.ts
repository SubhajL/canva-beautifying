import { DocumentAnalysis } from '@/lib/ai/types'
import { AnalysisCache } from './types'
import { createClient } from '@/lib/supabase/client'

export class SupabaseAnalysisCache implements AnalysisCache {
  private memoryCache: Map<string, { analysis: DocumentAnalysis; timestamp: number }>
  private readonly CACHE_DURATION = 60 * 60 * 1000 // 1 hour

  constructor() {
    this.memoryCache = new Map()
  }

  async get(documentId: string): Promise<DocumentAnalysis | null> {
    // Check memory cache first
    const cached = this.memoryCache.get(documentId)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.analysis
    }

    // Check database cache
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('enhancements')
        .select('analysis_data')
        .eq('document_id', documentId)
        .single()

      if (error || !data?.analysis_data) {
        return null
      }

      const analysis = data.analysis_data as DocumentAnalysis
      
      // Update memory cache
      this.memoryCache.set(documentId, {
        analysis,
        timestamp: Date.now()
      })

      return analysis
    } catch (error) {
      console.error('Error fetching cached analysis:', error)
      return null
    }
  }

  async set(documentId: string, analysis: DocumentAnalysis): Promise<void> {
    // Update memory cache
    this.memoryCache.set(documentId, {
      analysis,
      timestamp: Date.now()
    })

    // Update database cache
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('enhancements')
        .update({ 
          analysis_data: analysis,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId)

      if (error) {
        console.error('Error caching analysis:', error)
      }
    } catch (error) {
      console.error('Error caching analysis:', error)
    }
  }

  async invalidate(documentId: string): Promise<void> {
    // Remove from memory cache
    this.memoryCache.delete(documentId)

    // Clear database cache
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('enhancements')
        .update({ 
          analysis_data: null,
          updated_at: new Date().toISOString()
        })
        .eq('document_id', documentId)

      if (error) {
        console.error('Error invalidating cache:', error)
      }
    } catch (error) {
      console.error('Error invalidating cache:', error)
    }
  }

  // Clean up old entries from memory cache
  private cleanupMemoryCache(): void {
    const now = Date.now()
    for (const [key, value] of this.memoryCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.memoryCache.delete(key)
      }
    }
  }
}