import { Worker, Job } from 'bullmq'
import { getQueueConnection, QUEUE_NAMES } from '../config'
import type { EnhancementJobData, JobResult, JobProgress } from '../types'
import { createClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2/client'
import { EnhancementEngine } from '@/lib/enhancement/enhancement-engine'
import { addExportJob } from '../queues'
import { webhookManager } from '@/lib/api/webhooks/manager'
import { webhookEvents } from '@/lib/api/webhook'

export const createEnhancementWorker = () => {
  const worker = new Worker<EnhancementJobData, JobResult>(
    QUEUE_NAMES.ENHANCEMENT,
    async (job: Job<EnhancementJobData>) => {
      const startTime = Date.now()
      const { 
        documentId, 
        userId, 
        analysisResults, 
        enhancementSettings, 
        subscriptionTier 
      } = job.data

      try {
        // Trigger webhook: enhancement.started
        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.started',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 0,
            timestamp: new Date().toISOString()
          }
        )

        // Update progress: Starting
        await job.updateProgress({
          stage: 'initializing',
          progress: 5,
          message: 'Initializing enhancement engine',
        } as JobProgress)

        // Trigger webhook: enhancement.progress
        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 5,
            stage: 'initializing',
            message: 'Initializing enhancement engine',
            timestamp: new Date().toISOString()
          }
        )

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

        // Generate enhancement strategy
        await job.updateProgress({
          stage: 'strategy',
          progress: 15,
          message: 'Generating enhancement strategy',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 15,
            stage: 'strategy',
            message: 'Generating enhancement strategy',
            timestamp: new Date().toISOString()
          }
        )
        
        const strategy = await engine.generateStrategy(analysisResults, enhancementSettings)

        // Apply color enhancements
        await job.updateProgress({
          stage: 'colors',
          progress: 25,
          message: 'Optimizing color palette',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 25,
            stage: 'colors',
            message: 'Optimizing color palette',
            timestamp: new Date().toISOString()
          }
        )
        
        const colorEnhancements = await engine.enhanceColors(
          document.original_url,
          strategy.colorStrategy
        )

        // Apply typography enhancements
        await job.updateProgress({
          stage: 'typography',
          progress: 40,
          message: 'Improving typography',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 40,
            stage: 'typography',
            message: 'Improving typography',
            timestamp: new Date().toISOString()
          }
        )
        
        const typographyEnhancements = await engine.enhanceTypography(
          document.original_url,
          strategy.typographyStrategy
        )

        // Apply layout enhancements
        await job.updateProgress({
          stage: 'layout',
          progress: 55,
          message: 'Restructuring layout',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 55,
            stage: 'layout',
            message: 'Restructuring layout',
            timestamp: new Date().toISOString()
          }
        )
        
        const layoutEnhancements = await engine.enhanceLayout(
          document.original_url,
          strategy.layoutStrategy
        )

        // Generate backgrounds if needed
        await job.updateProgress({
          stage: 'backgrounds',
          progress: 70,
          message: 'Generating backgrounds',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 70,
            stage: 'backgrounds',
            message: 'Generating backgrounds',
            timestamp: new Date().toISOString()
          }
        )
        
        const backgroundEnhancements = await engine.generateBackgrounds(
          strategy.backgroundStrategy
        )

        // Add decorative elements
        await job.updateProgress({
          stage: 'decorations',
          progress: 80,
          message: 'Adding decorative elements',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 80,
            stage: 'decorations',
            message: 'Adding decorative elements',
            timestamp: new Date().toISOString()
          }
        )
        
        const decorativeEnhancements = await engine.addDecorativeElements(
          strategy.decorativeStrategy
        )

        // Combine all enhancements
        await job.updateProgress({
          stage: 'combining',
          progress: 85,
          message: 'Combining enhancements',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 85,
            stage: 'combining',
            message: 'Combining enhancements',
            timestamp: new Date().toISOString()
          }
        )
        
        const enhancedDocument = await engine.combineEnhancements({
          original: document.original_url,
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

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 90,
            stage: 'uploading',
            message: 'Saving enhanced document',
            timestamp: new Date().toISOString()
          }
        )
        
        const enhancedFileKey = `enhanced/${userId}/${documentId}/${Date.now()}.${document.type.split('/')[1]}`
        const enhancedFileUrl = await uploadToR2(enhancedDocument.buffer, enhancedFileKey)

        // Generate thumbnail
        const thumbnailKey = `thumbnails/${userId}/${documentId}/${Date.now()}.png`
        const thumbnailUrl = await uploadToR2(enhancedDocument.thumbnail, thumbnailKey)

        // Save enhancement record
        const { data: enhancement, error: enhanceError } = await supabase
          .from('enhancements')
          .update({
            status: 'completed',
            progress: 100,
            enhanced_url: enhancedFileUrl,
            thumbnail_url: thumbnailUrl,
            improvements: {
              before: analysisResults.quality.overallScore,
              after: enhancedDocument.qualityImprovement.overallScore
            },
            enhancements_applied: Object.keys(strategy),
            processing_time: Date.now() - startTime,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id!)
          .select()
          .single()

        if (enhanceError) {
          throw new Error(`Failed to save enhancement: ${enhanceError.message}`)
        }

        // Update document status
        await supabase
          .from('documents')
          .update({ 
            status: 'completed',
            enhanced_at: new Date().toISOString(),
          })
          .eq('id', documentId)

        // Automatically queue export job
        await job.updateProgress({
          stage: 'queueing-export',
          progress: 95,
          message: 'Preparing for export',
        } as JobProgress)

        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.progress',
          {
            enhancementId: job.id!,
            documentId,
            status: 'processing',
            progress: 95,
            stage: 'queueing-export',
            message: 'Preparing for export',
            timestamp: new Date().toISOString()
          }
        )
        
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

        const processingTime = Date.now() - startTime

        // Trigger webhook: enhancement.completed
        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.completed',
          {
            enhancementId: job.id!,
            documentId,
            status: 'completed',
            progress: 100,
            result: {
              enhancedFileUrl,
              thumbnailUrl,
              improvements: {
                before: analysisResults.quality.overallScore,
                after: enhancedDocument.qualityImprovement.overallScore
              },
              enhancementsApplied: Object.keys(strategy),
              processingTime,
              metadata: {
                aiTokensUsed: engine.getTokensUsed(),
                subscriptionTier
              }
            },
            timestamp: new Date().toISOString()
          }
        )

        return {
          success: true,
          data: {
            documentId,
            enhancementId: enhancement.id,
            enhancedFileUrl,
            thumbnailUrl,
            qualityImprovement: enhancedDocument.qualityImprovement,
          },
          metadata: {
            processingTime,
            aiTokensUsed: engine.getTokensUsed(),
          },
        }
      } catch (error) {
        console.error('Enhancement error:', error)
        
        // Update document status to failed
        const supabase = await createClient()
        await supabase
          .from('documents')
          .update({ 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', documentId)

        await supabase
          .from('enhancements')
          .update({
            status: 'failed',
            error: {
              code: 'ENHANCEMENT_ERROR',
              message: error instanceof Error ? error.message : 'Enhancement failed',
              details: error instanceof Error ? error.stack : undefined
            }
          })
          .eq('id', job.id!)

        // Trigger webhook: enhancement.failed
        await webhookManager.triggerWebhooks(
          userId,
          'enhancement.failed',
          {
            enhancementId: job.id!,
            documentId,
            status: 'failed',
            error: {
              code: 'ENHANCEMENT_ERROR',
              message: error instanceof Error ? error.message : 'Enhancement failed',
              details: {
                processingTime: Date.now() - startTime,
                stage: (job.progress as JobProgress)?.stage || 'unknown'
              }
            },
            timestamp: new Date().toISOString()
          }
        )

        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Enhancement failed',
            code: 'ENHANCEMENT_ERROR',
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
      concurrency: 3,
      limiter: {
        max: 5,
        duration: 60000,
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