import { Queue, QueueEvents } from 'bullmq'
import { getQueueConnection, QUEUE_NAMES, DEFAULT_JOB_OPTIONS, PRIORITY_LEVELS } from './config'
import type {
  DocumentAnalysisJobData,
  EnhancementJobData,
  ExportJobData,
  EmailJobData,
  JobProgress
} from './types'

// Create queue instances
export const documentAnalysisQueue = new Queue<DocumentAnalysisJobData>(
  QUEUE_NAMES.DOCUMENT_ANALYSIS,
  {
    connection: getQueueConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
)

export const enhancementQueue = new Queue<EnhancementJobData>(
  QUEUE_NAMES.ENHANCEMENT,
  {
    connection: getQueueConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
)

export const exportQueue = new Queue<ExportJobData>(
  QUEUE_NAMES.EXPORT,
  {
    connection: getQueueConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
)

export const emailQueue = new Queue<EmailJobData>(
  QUEUE_NAMES.EMAIL,
  {
    connection: getQueueConnection(),
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      removeOnComplete: {
        age: 300, // keep email jobs for 5 minutes only
        count: 50,
      },
    },
  }
)

// Create queue event listeners for monitoring
export const documentAnalysisQueueEvents = new QueueEvents(QUEUE_NAMES.DOCUMENT_ANALYSIS, {
  connection: getQueueConnection(),
})

export const enhancementQueueEvents = new QueueEvents(QUEUE_NAMES.ENHANCEMENT, {
  connection: getQueueConnection(),
})

export const exportQueueEvents = new QueueEvents(QUEUE_NAMES.EXPORT, {
  connection: getQueueConnection(),
})

export const emailQueueEvents = new QueueEvents(QUEUE_NAMES.EMAIL, {
  connection: getQueueConnection(),
})

// Helper function to add jobs with priority based on subscription tier
export const getPriorityByTier = (tier: string): number => {
  switch (tier) {
    case 'premium':
      return PRIORITY_LEVELS.CRITICAL
    case 'pro':
      return PRIORITY_LEVELS.HIGH
    case 'basic':
      return PRIORITY_LEVELS.NORMAL
    default:
      return PRIORITY_LEVELS.LOW
  }
}

// Helper functions to add jobs to queues
export const addDocumentAnalysisJob = async (data: DocumentAnalysisJobData) => {
  const priority = data.priority ?? getPriorityByTier(data.subscriptionTier)
  
  return await documentAnalysisQueue.add(
    `analyze-${data.documentId}`,
    data,
    {
      priority,
      removeOnComplete: true,
      removeOnFail: false,
    }
  )
}

export const addEnhancementJob = async (data: EnhancementJobData) => {
  const priority = data.priority ?? getPriorityByTier(data.subscriptionTier)
  
  return await enhancementQueue.add(
    `enhance-${data.documentId}`,
    data,
    {
      priority,
      removeOnComplete: true,
      removeOnFail: false,
    }
  )
}

export const addExportJob = async (data: ExportJobData) => {
  const priority = data.priority ?? getPriorityByTier(data.subscriptionTier)
  
  return await exportQueue.add(
    `export-${data.documentId}`,
    data,
    {
      priority,
      removeOnComplete: true,
      removeOnFail: false,
    }
  )
}

export const addEmailJob = async (data: EmailJobData) => {
  const priority = data.priority ?? PRIORITY_LEVELS.NORMAL
  
  return await emailQueue.add(
    `email-${data.template}`,
    data,
    {
      priority,
      attempts: 5, // More attempts for email
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 seconds
      },
    }
  )
}

// Helper function to update job progress
export const updateJobProgress = async (
  queue: Queue,
  jobId: string,
  progress: JobProgress
) => {
  const job = await queue.getJob(jobId)
  if (job) {
    await job.updateProgress(progress)
  }
}