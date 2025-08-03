import { Job } from 'bullmq'
import { getWebSocketServer } from './server'
import type { JobProgress } from '@/lib/queue/types'

// Helper to emit progress from queue jobs
export function emitJobProgress(job: Job, progress: JobProgress) {
  const wsServer = getWebSocketServer()
  const { documentId } = job.data as { documentId: string }
  
  // Map queue progress to WebSocket events
  switch (job.queueName) {
    case 'document-analysis':
      wsServer.sendEnhancementProgress(documentId, {
        documentId,
        stage: 'analysis',
        progress: progress.progress,
        message: progress.message || progress.stage,
        details: progress.details,
      })
      break
      
    case 'enhancement':
      const stage = mapEnhancementStage(progress.stage)
      wsServer.sendEnhancementProgress(documentId, {
        documentId,
        stage,
        progress: progress.progress,
        message: progress.message || progress.stage,
        details: progress.details,
      })
      break
      
    case 'export':
      // Export progress is handled separately
      break
  }
}

// Emit job started event
export function emitJobStarted(job: Job) {
  const wsServer = getWebSocketServer()
  const { documentId, _userId } = job.data as { documentId: string; userId: string }
  
  const _jobType = mapQueueToJobType(job.queueName)
  
  wsServer.sendEnhancementProgress(documentId, {
    documentId,
    stage: 'analysis',
    progress: 0,
    message: 'Processing started',
  })
}

// Emit job completed event
export function emitJobCompleted(job: Job, result: any) {
  const wsServer = getWebSocketServer()
  const { documentId } = job.data as { documentId: string }
  
  const jobType = mapQueueToJobType(job.queueName)
  
  wsServer.sendJobCompleted(documentId, {
    jobId: job.id!,
    documentId,
    type: jobType,
    result: {
      success: result.success,
      enhancedUrl: result.data?.enhancedFileUrl,
      thumbnailUrl: result.data?.thumbnailUrl,
      improvements: result.data?.qualityImprovement ? {
        before: 50, // Would come from actual data
        after: 50 + result.data.qualityImprovement,
      } : undefined,
    },
    processingTime: result.metadata?.processingTime || 0,
    timestamp: new Date(),
  })
}

// Emit job failed event
export function emitJobFailed(job: Job, error: Error) {
  const wsServer = getWebSocketServer()
  const { documentId } = job.data as { documentId: string }
  
  const jobType = mapQueueToJobType(job.queueName)
  
  wsServer.sendJobFailed(documentId, {
    jobId: job.id!,
    documentId,
    type: jobType,
    error: {
      message: error.message,
      code: (error as any).code,
      retryable: job.attemptsMade < job.opts.attempts!,
    },
    timestamp: new Date(),
  })
}

// Emit queue position updates
export async function emitQueuePosition(job: Job) {
  const wsServer = getWebSocketServer()
  const { documentId } = job.data as { documentId: string }
  
  // Get queue position
  const waitingJobs = await job.queue.getWaitingCount()
  const position = await getJobPosition(job)
  
  if (position > 0) {
    wsServer.sendQueuePosition(documentId, position, waitingJobs)
  }
}

// Helper functions

function mapEnhancementStage(stage: string): 'analysis' | 'planning' | 'generation' | 'composition' {
  const stageMap: Record<string, 'analysis' | 'planning' | 'generation' | 'composition'> = {
    'initializing': 'planning',
    'strategy': 'planning',
    'colors': 'generation',
    'typography': 'generation',
    'layout': 'generation',
    'backgrounds': 'generation',
    'decorations': 'generation',
    'combining': 'composition',
    'uploading': 'composition',
    'queueing-export': 'composition',
    'completed': 'composition',
  }
  
  return stageMap[stage] || 'planning'
}

function mapQueueToJobType(queueName: string): 'analysis' | 'enhancement' | 'export' {
  switch (queueName) {
    case 'document-analysis':
      return 'analysis'
    case 'enhancement':
      return 'enhancement'
    case 'export':
      return 'export'
    default:
      return 'enhancement'
  }
}

async function getJobPosition(job: Job): Promise<number> {
  try {
    const waitingJobs = await job.queue.getJobs(['waiting'])
    const jobIndex = waitingJobs.findIndex(j => j.id === job.id)
    return jobIndex + 1
  } catch {
    return 0
  }
}

// Middleware to add WebSocket progress to jobs
export function withWebSocketProgress<T extends { documentId: string }>(
  processor: (job: Job<T>) => Promise<any>
) {
  return async (job: Job<T>) => {
    // Emit job started
    emitJobStarted(job)
    
    // Emit initial queue position
    await emitQueuePosition(job)
    
    // Override job.updateProgress to emit WebSocket events
    const originalUpdateProgress = job.updateProgress.bind(job)
    job.updateProgress = async (progress: JobProgress) => {
      await originalUpdateProgress(progress)
      emitJobProgress(job, progress)
    }
    
    try {
      const result = await processor(job)
      emitJobCompleted(job, result)
      return result
    } catch (error) {
      emitJobFailed(job, error as Error)
      throw error
    }
  }
}