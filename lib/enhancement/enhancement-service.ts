import { createClient } from '@/lib/supabase/server'
import { EnhancementPipeline } from './enhancement-pipeline'
import { EnhancementRequest, EnhancementResult } from './types'
import { DocumentAnalysis } from '@/lib/ai/types'

export class EnhancementService {
  private pipeline: EnhancementPipeline

  constructor() {
    this.pipeline = new EnhancementPipeline()
  }

  async enhanceDocument(
    documentId: string,
    userId: string,
    preferences?: EnhancementRequest['preferences']
  ): Promise<EnhancementResult> {
    const supabase = await createClient()
    
    try {
      // Get document details
      const { data: enhancement, error } = await supabase
        .from('enhancements')
        .select('*')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single()
      
      if (error || !enhancement) {
        throw new Error('Document not found')
      }

      // Check if already enhanced
      if (enhancement.status === 'completed' && enhancement.enhanced_url) {
        return this.getExistingResult(enhancement)
      }

      // Update status to processing
      await supabase
        .from('enhancements')
        .update({ 
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', documentId)

      // Create enhancement request
      const request: EnhancementRequest = {
        documentId,
        userId,
        analysisData: enhancement.analysis_data as DocumentAnalysis,
        preferences,
        targetAudience: {
          ageGroup: enhancement.metadata?.ageGroup || 'general'
        }
      }

      // Process enhancement
      const result = await this.pipeline.enhance(request)

      // Store results
      await this.storeEnhancementResult(documentId, result)

      return result
    } catch (error) {
      // Update status to failed
      await supabase
        .from('enhancements')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Enhancement failed'
        })
        .eq('id', documentId)

      throw error
    }
  }

  private async storeEnhancementResult(
    documentId: string,
    result: EnhancementResult
  ): Promise<void> {
    const supabase = await createClient()
    
    const updateData: Record<string, unknown> = {
      status: result.success ? 'completed' : 'failed',
      completed_at: new Date().toISOString()
    }

    if (result.success) {
      updateData.enhanced_url = result.enhancedUrl
      updateData.enhancement_data = {
        strategies: result.strategies.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          impact: s.impact,
          changes: Object.keys(s.changes)
        })),
        appliedStrategies: result.appliedStrategies,
        qualityScore: result.qualityScore,
        metadata: result.metadata
      }
    } else {
      updateData.error_message = result.error
    }

    await supabase
      .from('enhancements')
      .update(updateData)
      .eq('id', documentId)
  }

  private getExistingResult(enhancement: {
    id: string
    enhanced_url: string
    enhancement_data?: {
      strategies?: Array<{
        id: string
        name: string
        description: string
        impact: string
        changes: string[]
      }>
      appliedStrategies?: string[]
      qualityScore?: {
        before: number
        after: number
        improvement: number
      }
      metadata?: {
        processingTime?: number
        enhancementCount?: number
        timestamp?: string | Date
      }
    }
    completed_at: string
  }): EnhancementResult {
    const data = enhancement.enhancement_data || {}
    
    return {
      success: true,
      documentId: enhancement.id,
      strategies: data.strategies?.map(s => ({
        ...s,
        changes: {} // Convert array back to object as needed by EnhancementStrategy
      })) || [],
      appliedStrategies: data.appliedStrategies || [],
      enhancedUrl: enhancement.enhanced_url,
      qualityScore: data.qualityScore || {
        before: 0,
        after: 0,
        improvement: 0
      },
      metadata: data.metadata ? {
        processingTime: data.metadata.processingTime || 0,
        enhancementCount: data.metadata.enhancementCount || 0,
        timestamp: data.metadata.timestamp 
          ? new Date(data.metadata.timestamp) 
          : new Date(enhancement.completed_at)
      } : {
        processingTime: 0,
        enhancementCount: 0,
        timestamp: new Date(enhancement.completed_at)
      }
    }
  }

  async getEnhancementStatus(documentId: string, userId: string): Promise<{
    status: string
    progress?: number
    result?: EnhancementResult
  }> {
    const supabase = await createClient()
    
    const { data: enhancement } = await supabase
      .from('enhancements')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single()
    
    if (!enhancement) {
      throw new Error('Enhancement not found')
    }

    const response: { status: string; progress?: number; result?: EnhancementResult } = {
      status: enhancement.status
    }

    if (enhancement.status === 'processing') {
      // Estimate progress based on time elapsed
      const startTime = new Date(enhancement.started_at).getTime()
      const elapsed = Date.now() - startTime
      const estimatedTime = 30000 // 30 seconds estimated
      response.progress = Math.min(95, (elapsed / estimatedTime) * 100)
    } else if (enhancement.status === 'completed') {
      response.result = this.getExistingResult(enhancement)
    }

    return response
  }

  async listUserEnhancements(userId: string): Promise<Array<{
    id: string
    originalUrl: string
    enhancedUrl?: string
    status: string
    createdAt: Date
    completedAt?: Date
  }>> {
    const supabase = await createClient()
    
    const { data: enhancements } = await supabase
      .from('enhancements')
      .select('id, original_url, enhanced_url, status, created_at, completed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    return (enhancements || []).map(e => ({
      id: e.id,
      originalUrl: e.original_url,
      enhancedUrl: e.enhanced_url,
      status: e.status,
      createdAt: new Date(e.created_at),
      completedAt: e.completed_at ? new Date(e.completed_at) : undefined
    }))
  }
}