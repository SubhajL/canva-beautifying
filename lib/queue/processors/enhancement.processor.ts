import { Worker, Job } from 'bullmq'
import { getQueueConnection, QUEUE_NAMES } from '../config'
import type { EnhancementJobData, JobResult, JobProgress } from '../types'
import { createClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2/client'
import { EnhancementEngine } from '@/lib/enhancement/enhancement-engine'
import { addExportJob } from '../queues'
import { pipelineTracer, activateJobTraceContext } from '@/lib/observability/enhancement-pipeline'
import { recordPipelineEvent } from '@/lib/observability/tracing'

export const createEnhancementWorker = () => {
  const worker = new Worker<EnhancementJobData, JobResult>(
    QUEUE_NAMES.ENHANCEMENT,
    async (job: Job<EnhancementJobData>) => {
      const startTime = Date.now()
      const { 
        documentId, 
        enhancementId,
        userId, 
        analysisResults, 
        enhancementSettings, 
        subscriptionTier 
      } = job.data

      // Extract and activate trace context from job data
      activateJobTraceContext(job.data)

      // Track this job in the pipeline if enhancement ID exists
      if (enhancementId && pipelineTracer.isActive(enhancementId)) {
        pipelineTracer.trackQueueJob(job, QUEUE_NAMES.ENHANCEMENT)
      }

      try {
        // Update progress: Starting
        await job.updateProgress({
          stage: 'initializing',
          progress: 5,
          message: 'Initializing enhancement engine',
        } as JobProgress)

        // Initialize enhancement engine
        const engine = new EnhancementEngine({
          subscriptionTier,
          aiModel: enhancementSettings.aiModel,
        })

        // Load original document
        const supabase = await createClient()
        const { data: document, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single()

        if (docError || !document) {
          throw new Error('Document not found')
        }

        // Generate enhancement strategy with tracing
        await job.updateProgress({
          stage: 'strategy',
          progress: 15,
          message: 'Generating enhancement strategy',
        } as JobProgress)
        
        const strategy = await pipelineTracer.trackStage(
          enhancementId || documentId,
          'analysis' as any,
          async () => {
            recordPipelineEvent('strategy.generation.started', {
              model: enhancementSettings.aiModel,
              settings: enhancementSettings,
            })
            
            const result = await engine.generateStrategy(analysisResults, enhancementSettings)
            
            recordPipelineEvent('strategy.generation.completed', {
              strategyType: result.type,
              improvements: Object.keys(result),
            })
            
            return result
          },
          {
            analysisResults: JSON.stringify(analysisResults),
          }
        )

        // Apply color enhancements
        await job.updateProgress({
          stage: 'colors',
          progress: 25,
          message: 'Optimizing color palette',
        } as JobProgress)
        
        const colorEnhancements = await engine.enhanceColors(
          document.file_url,
          strategy.colorStrategy
        )

        // Apply typography enhancements
        await job.updateProgress({
          stage: 'typography',
          progress: 40,
          message: 'Improving typography',
        } as JobProgress)
        
        const typographyEnhancements = await engine.enhanceTypography(
          document.file_url,
          strategy.typographyStrategy
        )

        // Apply layout enhancements
        await job.updateProgress({
          stage: 'layout',
          progress: 55,
          message: 'Restructuring layout',
        } as JobProgress)
        
        const layoutEnhancements = await engine.enhanceLayout(
          document.file_url,
          strategy.layoutStrategy
        )

        // Generate backgrounds if needed
        await job.updateProgress({
          stage: 'backgrounds',
          progress: 70,
          message: 'Generating backgrounds',
        } as JobProgress)
        
        const backgroundEnhancements = await engine.generateBackgrounds(
          strategy.backgroundStrategy
        )

        // Add decorative elements
        await job.updateProgress({
          stage: 'decorations',
          progress: 80,
          message: 'Adding decorative elements',
        } as JobProgress)
        
        const decorativeEnhancements = await engine.addDecorativeElements(
          strategy.decorativeStrategy
        )

        // Combine all enhancements
        await job.updateProgress({
          stage: 'combining',
          progress: 85,
          message: 'Combining enhancements',
        } as JobProgress)
        
        const enhancedDocument = await engine.combineEnhancements({
          original: document.file_url,
          colors: colorEnhancements,
          typography: typographyEnhancements,
          layout: layoutEnhancements,
          backgrounds: backgroundEnhancements,
          decorations: decorativeEnhancements,
        })

        // Upload enhanced document
        await job.updateProgress({
          stage: 'uploading',
          progress: 90,
          message: 'Saving enhanced document',
        } as JobProgress)
        
        const enhancedFileKey = `enhanced/${userId}/${documentId}/${Date.now()}.${document.file_type}`
        const enhancedFileUrl = await uploadToR2(enhancedDocument.buffer, enhancedFileKey)

        // Save enhancement record
        const { data: enhancement, error: enhanceError } = await supabase
          .from('enhancements')
          .insert({
            document_id: documentId,
            user_id: userId,
            enhanced_file_url: enhancedFileUrl,
            enhancement_settings: enhancementSettings,
            enhancement_strategy: strategy,
            quality_improvement: enhancedDocument.qualityImprovement,
            processing_time: Date.now() - startTime,
            ai_tokens_used: engine.getTokensUsed(),
          })
          .select()
          .single()

        if (enhanceError) {
          throw new Error(`Failed to save enhancement: ${enhanceError.message}`)
        }

        // Update document status
        await supabase
          .from('documents')
          .update({ 
            status: 'enhanced',
            enhanced_at: new Date().toISOString(),
          })
          .eq('id', documentId)

        // Automatically queue export job
        await job.updateProgress({
          stage: 'queueing-export',
          progress: 95,
          message: 'Preparing for export',
        } as JobProgress)
        
        await addExportJob({
          documentId,
          userId,
          enhancementId: enhancement.id,
          exportFormat: 'png', // Default format
          subscriptionTier,
        })

        // Complete
        await job.updateProgress({
          stage: 'completed',
          progress: 100,
          message: 'Enhancement completed successfully',
        } as JobProgress)

        // Complete pipeline tracing
        if (enhancementId && pipelineTracer.isActive(enhancementId)) {
          pipelineTracer.completePipeline(enhancementId, 'success', {
            enhancedFileUrl,
            qualityImprovement: enhancedDocument.qualityImprovement,
            aiTokensUsed: engine.getTokensUsed(),
          })
        }

        return {
          success: true,
          data: {
            documentId,
            enhancementId: enhancement.id,
            enhancedFileUrl,
            qualityImprovement: enhancedDocument.qualityImprovement,
          },
          metadata: {
            processingTime: Date.now() - startTime,
            aiTokensUsed: engine.getTokensUsed(),
            traceId: pipelineTracer.getTraceId(enhancementId || documentId),
          },
        }
      } catch (error) {
        console.error('Enhancement error:', error)
        
        // Update document status to failed
        const supabase = await createClient()
        await supabase
          .from('documents')
          .update({ 
            status: 'enhancement_failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', documentId)

        // Complete pipeline tracing with error
        if (enhancementId && pipelineTracer.isActive(enhancementId)) {
          pipelineTracer.completePipeline(enhancementId, 'error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
          })
        }

        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Enhancement failed',
            code: 'ENHANCEMENT_ERROR',
            details: error,
          },
          metadata: {
            processingTime: Date.now() - startTime,
            traceId: pipelineTracer.getTraceId(enhancementId || documentId),
          },
        }
      }
    },
    {
      connection: getQueueConnection(),
      concurrency: 3, // Process up to 3 enhancement jobs concurrently
      limiter: {
        max: 5,
        duration: 60000, // Max 5 jobs per minute (resource intensive)
      },
    }
  )

  // Error handling
  worker.on('failed', (job, err) => {
    console.error(`Enhancement job ${job?.id} failed:`, err)
  })

  worker.on('completed', (job) => {
    console.log(`Enhancement job ${job.id} completed`)
  })

  return worker
}