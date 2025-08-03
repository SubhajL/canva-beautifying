import { Worker, Job } from 'bullmq'
import { getQueueConnection, QUEUE_NAMES } from '../config'
import type { ExportJobData, JobResult, JobProgress } from '../types'
import { createClient } from '@/lib/supabase/server'
import { downloadFromR2, uploadToR2 } from '@/lib/r2/client'
import { DocumentExporter } from '@/lib/export/document-exporter'
import { addEmailJob } from '../queues'

export const createExportWorker = () => {
  const worker = new Worker<ExportJobData, JobResult>(
    QUEUE_NAMES.EXPORT,
    async (job: Job<ExportJobData>) => {
      const startTime = Date.now()
      const { 
        documentId, 
        userId, 
        enhancementId,
        exportFormat, 
        exportSettings,
        subscriptionTier 
      } = job.data

      try {
        // Update progress: Starting
        await job.updateProgress({
          stage: 'initializing',
          progress: 10,
          message: 'Initializing export process',
        } as JobProgress)

        // Get enhancement details
        const supabase = createClient()
        const { data: enhancement, error: enhanceError } = await supabase
          .from('enhancements')
          .select('*, documents(*)')
          .eq('id', enhancementId)
          .single()

        if (enhanceError || !enhancement) {
          throw new Error('Enhancement not found')
        }

        // Download enhanced file
        await job.updateProgress({
          stage: 'downloading',
          progress: 20,
          message: 'Loading enhanced document',
        } as JobProgress)
        
        const enhancedFileBuffer = await downloadFromR2(enhancement.enhanced_file_url)

        // Initialize exporter
        const exporter = new DocumentExporter({
          subscriptionTier,
          watermark: subscriptionTier === 'free',
        })

        // Export based on format
        let exportedFile: Buffer
        let mimeType: string
        let fileExtension: string

        await job.updateProgress({
          stage: 'exporting',
          progress: 50,
          message: `Exporting as ${exportFormat.toUpperCase()}`,
        } as JobProgress)

        switch (exportFormat) {
          case 'pdf':
            exportedFile = await exporter.exportToPDF(
              enhancedFileBuffer,
              exportSettings?.quality || 'standard'
            )
            mimeType = 'application/pdf'
            fileExtension = 'pdf'
            break

          case 'png':
            exportedFile = await exporter.exportToPNG(
              enhancedFileBuffer,
              exportSettings?.quality || 'standard'
            )
            mimeType = 'image/png'
            fileExtension = 'png'
            break

          case 'canva':
            exportedFile = await exporter.exportToCanva(
              enhancedFileBuffer,
              enhancement.enhancement_strategy
            )
            mimeType = 'application/json'
            fileExtension = 'canva'
            break

          case 'pptx':
            exportedFile = await exporter.exportToPPTX(
              enhancedFileBuffer,
              enhancement.documents.title || 'Untitled'
            )
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            fileExtension = 'pptx'
            break

          default:
            throw new Error(`Unsupported export format: ${exportFormat}`)
        }

        // Generate report if requested
        if (exportSettings?.includeReport) {
          await job.updateProgress({
            stage: 'report',
            progress: 70,
            message: 'Generating enhancement report',
          } as JobProgress)
          
          // Report generation would be handled here
        }

        // Upload exported file
        await job.updateProgress({
          stage: 'uploading',
          progress: 80,
          message: 'Saving exported file',
        } as JobProgress)
        
        const exportFileKey = `exports/${userId}/${documentId}/${Date.now()}.${fileExtension}`
        const exportFileUrl = await uploadToR2(exportedFile, exportFileKey)

        // Save export record
        const { data: exportRecord, error: exportError } = await supabase
          .from('exports')
          .insert({
            enhancement_id: enhancementId,
            user_id: userId,
            export_format: exportFormat,
            export_file_url: exportFileUrl,
            export_settings: exportSettings,
            file_size: exportedFile.length,
            processing_time: Date.now() - startTime,
          })
          .select()
          .single()

        if (exportError) {
          throw new Error(`Failed to save export: ${exportError.message}`)
        }

        // Update document status
        await supabase
          .from('documents')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', documentId)

        // Queue email notification
        await job.updateProgress({
          stage: 'notifying',
          progress: 90,
          message: 'Sending notification',
        } as JobProgress)
        
        const { data: user } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', userId)
          .single()

        if (user?.email) {
          await addEmailJob({
            to: user.email,
            subject: 'Your enhanced document is ready!',
            template: 'export-ready',
            data: {
              userName: user.name || 'there',
              documentTitle: enhancement.documents.title,
              exportFormat: exportFormat.toUpperCase(),
              downloadUrl: exportFileUrl,
            },
          })
        }

        // Complete
        await job.updateProgress({
          stage: 'completed',
          progress: 100,
          message: 'Export completed successfully',
        } as JobProgress)

        return {
          success: true,
          data: {
            exportId: exportRecord.id,
            exportFileUrl,
            fileSize: exportedFile.length,
            mimeType,
          },
          metadata: {
            processingTime: Date.now() - startTime,
          },
        }
      } catch (error) {
        console.error('Export error:', error)
        
        // Update document status to failed
        const supabase = createClient()
        await supabase
          .from('documents')
          .update({ 
            status: 'export_failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', documentId)

        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : 'Export failed',
            code: 'EXPORT_ERROR',
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
      concurrency: 5, // Process up to 5 export jobs concurrently
      limiter: {
        max: 20,
        duration: 60000, // Max 20 jobs per minute
      },
    }
  )

  // Error handling
  worker.on('failed', (job, err) => {
    console.error(`Export job ${job?.id} failed:`, err)
  })

  worker.on('completed', (job) => {
    console.log(`Export job ${job.id} completed`)
  })

  return worker
}