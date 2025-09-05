import { Worker, Job } from 'bullmq'
import { getQueueConnection, QUEUE_NAMES } from '../config'
import type { DocumentAnalysisJobData, JobResult, JobProgress } from '../types'
import { createClient } from '../../supabase/server'
import { downloadFile } from '../../r2/download'
import { documentCache, cacheKeyGenerator } from '../../cache/init'
import { perceptualHasher } from '../../cache/perceptual-hash'
import { withMetrics } from '../../cache/metrics'
import { DocumentAnalysis } from '../../ai/types'
import { DocumentComplexity } from '../../cache/cache-key-generator'

interface AnalysisContext {
  documentId: string
  userId: string
  fileUrl: string
  fileType: string
  subscriptionTier: string
  preferences?: {
    style?: 'modern' | 'classic' | 'playful' | 'professional'
    colorScheme?: 'vibrant' | 'muted' | 'monochrome'
    targetAudience?: 'children' | 'teens' | 'adults' | 'business'
  }
}

export class CachedDocumentAnalysisProcessor {
  async processJob(job: Job<DocumentAnalysisJobData>): Promise<JobResult> {
    const startTime = Date.now()
    const context: AnalysisContext = job.data
    
    try {
      // Step 1: Generate document hash
      const documentHash = await this.generateDocumentHash(context)
      
      // Step 2: Check cache with metrics tracking
      const cachedAnalysis = await withMetrics(
        () => documentCache.get(documentHash, context.preferences),
        (result) => result !== null,
        (result) => (result as any)?.similarityMatch === true
      )
      
      if (cachedAnalysis) {
        await job.updateProgress({
          stage: 'cached',
          progress: 100,
          message: 'Using cached analysis',
        } as JobProgress)
        
        await this.saveCachedResults(context, cachedAnalysis, startTime)
        
        return {
          success: true,
          data: {
            documentId: context.documentId,
            analysisResults: cachedAnalysis,
            cached: true,
            similarity: (cachedAnalysis as any).similarity
          },
          metadata: {
            processingTime: Date.now() - startTime
          }
        }
      }
      
      // Step 3: Perform full analysis
      const analysis = await this.performAnalysis(context, job)
      
      // Step 4: Calculate complexity and cache results
      const complexity = this.calculateComplexity(analysis)
      await documentCache.set(documentHash, analysis, context.preferences, complexity)
      
      await this.saveAnalysisResults(context, analysis, startTime)
      
      return {
        success: true,
        data: {
          documentId: context.documentId,
          analysisResults: analysis,
          cached: false
        },
        metadata: {
          processingTime: Date.now() - startTime
        }
      }
    } catch (error) {
      await this.handleError(context, error)
      throw error
    }
  }
  
  private async generateDocumentHash(context: AnalysisContext): Promise<string> {
    await cacheKeyGenerator.ensureInitialized()
    
    // Extract key from URL
    const key = context.fileUrl.split('/').pop() || context.fileUrl
    const fileBuffer = await downloadFile(key)
    
    if (context.fileType.startsWith('image/')) {
      // For images, generate perceptual hash
      const perceptualHash = await perceptualHasher.generateHash(fileBuffer)
      return `${perceptualHash}_${context.fileType.replace('/', '-')}`
    }
    
    // For other documents, use content hash
    const imageData = {
      data: new Uint8ClampedArray(fileBuffer),
      width: 1,
      height: fileBuffer.length
    } as ImageData
    
    return await cacheKeyGenerator.generateContentHash(imageData)
  }
  
  private async performAnalysis(
    context: AnalysisContext,
    job: Job<DocumentAnalysisJobData>
  ): Promise<DocumentAnalysis> {
    // Simulate analysis with progress updates
    const stages = [
      { progress: 30, message: 'Analyzing layout structure' },
      { progress: 50, message: 'Analyzing color palette' },
      { progress: 70, message: 'Analyzing typography' },
      { progress: 90, message: 'Calculating engagement metrics' }
    ]
    
    for (const stage of stages) {
      await job.updateProgress({
        stage: 'analyzing',
        progress: stage.progress,
        message: stage.message,
      } as JobProgress)
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Mock analysis result
    return {
      layout: {
        score: Math.floor(Math.random() * 30) + 70,
        issues: ['Inconsistent margins', 'Poor hierarchy'],
        suggestions: ['Increase heading size', 'Add visual breaks']
      },
      colors: {
        score: Math.floor(Math.random() * 30) + 70,
        palette: ['#1a73e8', '#34a853', '#fbbc04', '#ea4335'],
        issues: ['Low contrast in some areas'],
        suggestions: ['Increase text contrast']
      },
      typography: {
        score: Math.floor(Math.random() * 30) + 70,
        fonts: ['Roboto', 'Open Sans'],
        issues: ['Too many font sizes'],
        suggestions: ['Limit to 3 font sizes']
      },
      engagement: {
        score: Math.floor(Math.random() * 30) + 70,
        readability: 0.82,
        visualAppeal: 0.78,
        suggestions: ['Add visual interest', 'Break up text blocks']
      },
      overallScore: Math.floor(Math.random() * 20) + 75,
      priority: 'medium' as const
    }
  }
  
  private calculateComplexity(analysis: DocumentAnalysis): DocumentComplexity {
    const factors = {
      elementCount: (analysis.layout.issues.length + analysis.colors.palette.length) / 10,
      textDensity: analysis.typography.fonts.length / 5,
      colorComplexity: analysis.colors.palette.length / 10,
      layoutComplexity: (100 - analysis.layout.score) / 100
    }
    
    const avgComplexity = Object.values(factors).reduce((a, b) => a + b) / 4
    
    return {
      level: avgComplexity < 0.3 ? 'low' : avgComplexity < 0.6 ? 'medium' : 'high',
      factors
    }
  }
  
  private async saveCachedResults(
    context: AnalysisContext,
    analysis: DocumentAnalysis,
    startTime: number
  ): Promise<void> {
    const supabase = await createClient()
    
    await supabase.from('enhancements').update({
      analysis_data: analysis,
      status: 'completed',
      processing_time: Date.now() - startTime,
      model_used: 'cached',
    }).eq('id', context.documentId)
  }
  
  private async saveAnalysisResults(
    context: AnalysisContext,
    analysis: DocumentAnalysis,
    startTime: number
  ): Promise<void> {
    const supabase = await createClient()
    
    await supabase.from('enhancements').update({
      analysis_data: analysis,
      status: 'completed',
      processing_time: Date.now() - startTime,
    }).eq('id', context.documentId)
  }
  
  private async handleError(context: AnalysisContext, error: unknown): Promise<void> {
    const supabase = await createClient()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await supabase.from('enhancements').update({
      status: 'failed',
      error_message: errorMessage,
    }).eq('id', context.documentId)
    
    console.error('Document analysis error:', error)
  }
}

export const createCachedDocumentAnalysisWorker = () => {
  const processor = new CachedDocumentAnalysisProcessor()
  
  return new Worker<DocumentAnalysisJobData, JobResult>(
    QUEUE_NAMES.DOCUMENT_ANALYSIS,
    async (job) => processor.processJob(job),
    {
      connection: getQueueConnection(),
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 60000,
      },
    }
  )
}