import { Worker, Job } from 'bullmq'
import { getQueueConnection, QUEUE_NAMES } from '../config'
import type { DocumentAnalysisJobData, JobResult, JobProgress } from '../types'
import { createClient } from '@/lib/supabase/server'
import { downloadFromR2 } from '@/lib/r2/client'
import { DocumentAnalyzer } from '@/lib/analysis/document-analyzer'

export const createDocumentAnalysisWorker = () => {
  const worker = new Worker<DocumentAnalysisJobData, JobResult>(
    QUEUE_NAMES.DOCUMENT_ANALYSIS,
    async (job: Job<DocumentAnalysisJobData>) => {
      const startTime = Date.now()
      const { documentId, userId, fileUrl, fileType, subscriptionTier } = job.data

      try {
        // Update progress: Starting
        await job.updateProgress({
          stage: 'downloading',
          progress: 10,
          message: 'Downloading document from storage',
        } as JobProgress)

        // Download file from R2
        const fileBuffer = await downloadFromR2(fileUrl)
        
        // Update progress: File downloaded
        await job.updateProgress({
          stage: 'analyzing',
          progress: 30,
          message: 'Analyzing document structure',
        } as JobProgress)

        // Initialize document analyzer
        const analyzer = new DocumentAnalyzer(subscriptionTier)
        
        // Analyze colors
        await job.updateProgress({
          stage: 'analyzing',
          progress: 40,
          message: 'Analyzing color palette',
        } as JobProgress)
        const colorAnalysis = await analyzer.analyzeColors(fileBuffer, fileType)
        
        // Analyze typography
        await job.updateProgress({
          stage: 'analyzing',
          progress: 50,
          message: 'Analyzing typography',
        } as JobProgress)
        const typographyAnalysis = await analyzer.analyzeTypography(fileBuffer, fileType)
        
        // Analyze layout
        await job.updateProgress({
          stage: 'analyzing',
          progress: 60,
          message: 'Analyzing layout structure',
        } as JobProgress)
        const layoutAnalysis = await analyzer.analyzeLayout(fileBuffer, fileType)
        
        // Analyze content
        await job.updateProgress({
          stage: 'analyzing',
          progress: 70,
          message: 'Analyzing content quality',
        } as JobProgress)
        const contentAnalysis = await analyzer.analyzeContent(fileBuffer, fileType)
        
        // Calculate overall quality score
        await job.updateProgress({
          stage: 'analyzing',
          progress: 80,
          message: 'Calculating quality score',
        } as JobProgress)
        const qualityScore = analyzer.calculateQualityScore({
          colors: colorAnalysis,
          typography: typographyAnalysis,
          layout: layoutAnalysis,
          content: contentAnalysis,
        })

        // Save analysis results to database
        await job.updateProgress({
          stage: 'saving',
          progress: 90,
          message: 'Saving analysis results',
        } as JobProgress)
        
        const supabase = createClient()
        const { error: dbError } = await supabase
          .from('document_analyses')
          .insert({
            document_id: documentId,
            user_id: userId,
            color_analysis: colorAnalysis,
            typography_analysis: typographyAnalysis,
            layout_analysis: layoutAnalysis,
            content_analysis: contentAnalysis,
            quality_score: qualityScore,
            processing_time: Date.now() - startTime,
          })

        if (dbError) {
          throw new Error(`Failed to save analysis: ${dbError.message}`)
        }

        // Update document status
        await supabase
          .from('documents')
          .update({ 
            status: 'analyzed',
            analyzed_at: new Date().toISOString(),
          })
          .eq('id', documentId)

        // Complete
        await job.updateProgress({
          stage: 'completed',
          progress: 100,
          message: 'Analysis completed successfully',
        } as JobProgress)

        return {
          success: true,
          data: {
            documentId,
            analysisResults: {
              colors: colorAnalysis,
              typography: typographyAnalysis,
              layout: layoutAnalysis,
              content: contentAnalysis,
              quality: qualityScore,
            },
          },
          metadata: {
            processingTime: Date.now() - startTime,
          },
        }
      } catch (error) {
        console.error('Document analysis error:', error)
        
        // Update document status to failed
        const supabase = createClient()
        await supabase
          .from('documents')
          .update({ 
            status: 'analysis_failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', documentId)

        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Document analysis failed',
            code: 'ANALYSIS_ERROR',
            details: error,
          },
          metadata: {
            processingTime: Date.now() - startTime,
          },
        }
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 5, // Process up to 5 jobs concurrently
      limiter: {
        max: 10,
        duration: 60000, // Max 10 jobs per minute
      },
    }
  )

  // Error handling
  worker.on('failed', (job, err) => {
    console.error(`Document analysis job ${job?.id} failed:`, err)
  })

  worker.on('completed', (job) => {
    console.log(`Document analysis job ${job.id} completed`)
  })

  return worker
}