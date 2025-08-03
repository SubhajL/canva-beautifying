import { Queue, QueueEvents, Job, JobsOptions } from 'bullmq'
import redis from './redis'

// Queue names
export const QUEUE_NAMES = {
  ENHANCEMENT: 'enhancement',
  EXPORT: 'export',
  EMAIL: 'email',
  ANALYTICS: 'analytics',
  BATCH_PROCESSING: 'batch-processing',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]

// Default job options
const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    count: 100,
    age: 24 * 3600, // 24 hours
  },
  removeOnFail: {
    count: 50,
    age: 7 * 24 * 3600, // 7 days
  },
}

// Queue instances cache
const queues = new Map<QueueName, Queue>()

// Get or create queue instance
export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: redis,
      defaultJobOptions,
    })
    queues.set(name, queue)
  }
  return queues.get(name)!
}

// Queue events for monitoring
export function getQueueEvents(name: QueueName): QueueEvents {
  return new QueueEvents(name, {
    connection: redis,
  })
}

// Enhancement queue types
export interface EnhancementJobData {
  documentId: string
  userId: string
  fileName: string
  fileUrl: string
  mimeType: string
  options: {
    style?: string
    colorScheme?: string
    layoutPreference?: string
    targetAudience?: string
  }
}

export interface EnhancementJobResult {
  enhancedUrl: string
  thumbnailUrl?: string
  analysis: {
    documentType?: string
    colorAnalysis?: {
      dominantColors?: string[]
      colorScheme?: string
      contrast?: number
    }
    layoutAnalysis?: {
      structure?: string
      elements?: Array<{
        type: string
        position?: { x: number; y: number }
        size?: { width: number; height: number }
      }>
    }
    contentAnalysis?: {
      readabilityScore?: number
      textDensity?: number
      visualBalance?: number
    }
  }
  metadata: {
    processingTime: number
    modelsUsed: string[]
  }
}

// Export queue types
export interface ExportJobData {
  documentId: string
  userId: string
  format: 'pdf' | 'png' | 'jpeg' | 'zip'
  options?: {
    quality?: number
    includeOriginal?: boolean
    includeMetadata?: boolean
  }
}

export interface ExportJobResult {
  downloadUrl: string
  expiresAt: Date
}

// Email queue types
export interface EmailJobData {
  to: string | string[]
  subject: string
  template: string
  data: Record<string, unknown>
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

// Batch processing types
export interface BatchJobData {
  batchId: string
  userId: string
  documents: Array<{
    id: string
    fileName: string
    fileUrl: string
    mimeType: string
  }>
  options: {
    style?: string
    colorScheme?: string
    layoutPreference?: string
    targetAudience?: string
    batchSettings?: Record<string, unknown>
  }
}

// Helper functions
export async function addJob<T = unknown>(
  queueName: QueueName,
  data: T,
  options?: JobsOptions
): Promise<Job<T>> {
  const queue = getQueue(queueName)
  return await queue.add(queueName, data, {
    ...defaultJobOptions,
    ...options,
  })
}

export async function getJob(
  queueName: QueueName,
  jobId: string
): Promise<Job | undefined> {
  const queue = getQueue(queueName)
  return await queue.getJob(jobId)
}

export async function getJobCounts(queueName: QueueName) {
  const queue = getQueue(queueName)
  return await queue.getJobCounts()
}

export async function pauseQueue(queueName: QueueName) {
  const queue = getQueue(queueName)
  await queue.pause()
}

export async function resumeQueue(queueName: QueueName) {
  const queue = getQueue(queueName)
  await queue.resume()
}

export async function cleanQueue(
  queueName: QueueName,
  grace: number = 0,
  limit: number = 100,
  status: 'completed' | 'failed' = 'completed'
) {
  const queue = getQueue(queueName)
  return await queue.clean(grace, limit, status)
}

// Export queue utilities
export { Queue, Worker, Job, QueueEvents } from 'bullmq'