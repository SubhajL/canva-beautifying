import { DocumentAnalysis } from '@/lib/ai/types'
import { createClient } from '@/lib/supabase/server'
import { DocumentAnalysisEngine } from './engine'
import { SupabaseAnalysisCache } from './cache'
import { DocumentContext } from './types'

export class AnalysisService {
  private engine: DocumentAnalysisEngine
  private cache: SupabaseAnalysisCache

  constructor() {
    this.engine = new DocumentAnalysisEngine()
    this.cache = new SupabaseAnalysisCache()
  }

  async analyzeDocument(
    documentId: string,
    imageData: ImageData,
    documentType: 'worksheet' | 'presentation' | 'marketing',
    userPreferences?: DocumentContext['userPreferences']
  ): Promise<DocumentAnalysis> {
    // Check cache first
    const cached = await this.cache.get(documentId)
    if (cached) {
      return cached
    }

    // Prepare context
    const context: DocumentContext = {
      imageData,
      metadata: {
        width: imageData.width,
        height: imageData.height,
        format: 'image/png', // Will be determined from actual file
        size: imageData.data.length
      },
      type: documentType,
      userPreferences
    }

    // Run analysis
    const analysis = await this.engine.generateCompleteAnalysis(context)

    // Store in cache
    await this.cache.set(documentId, analysis)

    // Store in database
    await this.storeAnalysis(documentId, analysis)

    return analysis
  }

  async storeAnalysis(documentId: string, analysis: DocumentAnalysis): Promise<void> {
    const supabase = await createClient()
    
    // Find or create enhancement record
    const { data: enhancement, error: fetchError } = await supabase
      .from('enhancements')
      .select('id')
      .eq('document_id', documentId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // Not found is ok
      console.error('Error fetching enhancement:', fetchError)
      throw new Error('Failed to fetch enhancement record')
    }

    if (enhancement) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('enhancements')
        .update({
          analysis_data: analysis,
          status: 'analyzed',
          updated_at: new Date().toISOString()
        })
        .eq('id', enhancement.id)

      if (updateError) {
        console.error('Error updating analysis:', updateError)
        throw new Error('Failed to update analysis')
      }
    } else {
      // Create new record
      const { error: insertError } = await supabase
        .from('enhancements')
        .insert({
          document_id: documentId,
          analysis_data: analysis,
          status: 'analyzed'
        })

      if (insertError) {
        console.error('Error inserting analysis:', insertError)
        throw new Error('Failed to store analysis')
      }
    }
  }

  async getAnalysis(documentId: string): Promise<DocumentAnalysis | null> {
    return this.cache.get(documentId)
  }

  async invalidateCache(documentId: string): Promise<void> {
    await this.cache.invalidate(documentId)
  }
}