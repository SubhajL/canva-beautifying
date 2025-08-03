import { Queue, Job } from 'bullmq'
import { 
  documentAnalysisQueue, 
  enhancementQueue, 
  exportQueue, 
  emailQueue,
  documentAnalysisQueueEvents,
  enhancementQueueEvents,
  exportQueueEvents,
  emailQueueEvents
} from './queues'
import type { JobProgress, QueueMetrics } from './types'

// Get job by ID from any queue
export const getJobById = async (jobId: string): Promise<Job | null> => {
  // Try to find the job in each queue
  const queues = [documentAnalysisQueue, enhancementQueue, exportQueue, emailQueue]
  
  for (const queue of queues) {
    const job = await queue.getJob(jobId)
    if (job) {
      return job
    }
  }
  
  return null
}

// Get job progress
export const getJobProgress = async (jobId: string): Promise<JobProgress | null> => {
  const job = await getJobById(jobId)
  if (!job) {
    return null
  }
  
  const progress = await job.progress
  return progress as JobProgress
}

// Subscribe to job progress updates
export const subscribeToJobProgress = (
  jobId: string,
  callback: (progress: JobProgress) => void
): (() => void) => {
  const listeners: Array<() => void> = []
  
  // Subscribe to all queue events
  const queueEvents = [
    documentAnalysisQueueEvents,
    enhancementQueueEvents,
    exportQueueEvents,
    emailQueueEvents
  ]
  
  queueEvents.forEach(events => {
    const listener = (data: { jobId: string; data: unknown }) => {
      if (data.jobId === jobId) {
        callback(data.data as JobProgress)
      }
    }
    
    events.on('progress', listener)
    listeners.push(() => events.off('progress', listener))
  })
  
  // Return cleanup function
  return () => {
    listeners.forEach(cleanup => cleanup())
  }
}

// Get queue metrics
export const getQueueMetrics = async (queue: Queue): Promise<QueueMetrics> => {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    completedCount,
    failedCount
  ] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
    queue.getJobCountByTypes('completed'),
    queue.getJobCountByTypes('failed')
  ])
  
  // Calculate rates (simplified - in production, you'd track over time)
  const total = completedCount + failedCount
  const failureRate = total > 0 ? (failedCount / total) * 100 : 0
  
  // Get average processing time from recent completed jobs
  const completedJobs = await queue.getJobs(['completed'], 0, 10)
  let totalProcessingTime = 0
  let processedJobCount = 0
  
  for (const job of completedJobs) {
    if (job.finishedOn && job.processedOn) {
      totalProcessingTime += job.finishedOn - job.processedOn
      processedJobCount++
    }
  }
  
  const avgProcessingTime = processedJobCount > 0 
    ? totalProcessingTime / processedJobCount 
    : 0
  
  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    completedRate: 0, // Would need time-series data to calculate
    failureRate,
    avgProcessingTime
  }
}

// Get all queue metrics
export const getAllQueueMetrics = async (): Promise<Record<string, QueueMetrics>> => {
  const [analysis, enhancement, exportMetrics, email] = await Promise.all([
    getQueueMetrics(documentAnalysisQueue),
    getQueueMetrics(enhancementQueue),
    getQueueMetrics(exportQueue),
    getQueueMetrics(emailQueue),
  ])
  
  return {
    documentAnalysis: analysis,
    enhancement,
    export: exportMetrics,
    email,
  }
}

// Get job history for a user
export const getUserJobHistory = async (
  userId: string,
  limit = 20
): Promise<Job[]> => {
  const allJobs: Job[] = []
  const queues = [documentAnalysisQueue, enhancementQueue, exportQueue]
  
  for (const queue of queues) {
    const jobs = await queue.getJobs(['completed', 'failed'], 0, limit * 2)
    
    // Filter jobs by userId
    const userJobs = jobs.filter(job => job.data.userId === userId)
    allJobs.push(...userJobs)
  }
  
  // Sort by timestamp and limit
  return allJobs
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit)
}

// Cancel a job
export const cancelJob = async (jobId: string): Promise<boolean> => {
  const job = await getJobById(jobId)
  if (!job) {
    return false
  }
  
  await job.remove()
  return true
}

// Retry a failed job
export const retryFailedJob = async (jobId: string): Promise<Job | null> => {
  const job = await getJobById(jobId)
  if (!job || (await job.getState()) !== 'failed') {
    return null
  }
  
  await job.retry()
  return job
}

// Clean old jobs from queues
export const cleanOldJobs = async (olderThanDays = 7): Promise<void> => {
  const queues = [documentAnalysisQueue, enhancementQueue, exportQueue, emailQueue]
  const olderThanMs = olderThanDays * 24 * 60 * 60 * 1000
  const gracePeriod = 1000 // 1 second grace period
  
  for (const queue of queues) {
    await queue.clean(gracePeriod, 1000, 'completed')
    await queue.clean(olderThanMs, 1000, 'failed')
  }
}

// Pause processing for a specific document
export const pauseDocumentProcessing = async (documentId: string): Promise<void> => {
  // Find and pause related jobs
  const queues = [documentAnalysisQueue, enhancementQueue, exportQueue]
  
  for (const queue of queues) {
    const jobs = await queue.getJobs(['waiting', 'delayed'])
    
    for (const job of jobs) {
      if (job.data.documentId === documentId) {
        await job.remove()
      }
    }
  }
}

// Get processing pipeline status for a document
export const getDocumentPipelineStatus = async (documentId: string) => {
  const statuses = {
    analysis: null as string | null,
    enhancement: null as string | null,
    export: null as string | null,
  }
  
  // Check analysis queue
  const analysisJobs = await documentAnalysisQueue.getJobs()
  for (const job of analysisJobs) {
    if (job.data.documentId === documentId) {
      statuses.analysis = await job.getState()
      break
    }
  }
  
  // Check enhancement queue
  const enhancementJobs = await enhancementQueue.getJobs()
  for (const job of enhancementJobs) {
    if (job.data.documentId === documentId) {
      statuses.enhancement = await job.getState()
      break
    }
  }
  
  // Check export queue
  const exportJobs = await exportQueue.getJobs()
  for (const job of exportJobs) {
    if (job.data.documentId === documentId) {
      statuses.export = await job.getState()
      break
    }
  }
  
  return statuses
}