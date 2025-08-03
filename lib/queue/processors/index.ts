import { createDocumentAnalysisWorker } from './document-analysis.processor'
import { createEnhancementWorker } from './enhancement.processor'
import { createExportWorker } from './export.processor'
import { createEmailWorker } from './email.processor'
import { createBetaEmailWorker } from './beta-email.processor'

// Store worker instances
let workers: {
  documentAnalysis?: ReturnType<typeof createDocumentAnalysisWorker>
  enhancement?: ReturnType<typeof createEnhancementWorker>
  export?: ReturnType<typeof createExportWorker>
  email?: ReturnType<typeof createEmailWorker>
  betaEmail?: ReturnType<typeof createBetaEmailWorker>
} = {}

// Start all workers
export const startWorkers = async () => {
  console.log('Starting queue workers...')
  
  try {
    // Create and start workers
    workers.documentAnalysis = createDocumentAnalysisWorker()
    workers.enhancement = createEnhancementWorker()
    workers.export = createExportWorker()
    workers.email = createEmailWorker()
    workers.betaEmail = createBetaEmailWorker()
    
    console.log('All queue workers started successfully')
  } catch (error) {
    console.error('Failed to start workers:', error)
    throw error
  }
}

// Stop all workers gracefully
export const stopWorkers = async () => {
  console.log('Stopping queue workers...')
  
  const closePromises = []
  
  if (workers.documentAnalysis) {
    closePromises.push(workers.documentAnalysis.close())
  }
  if (workers.enhancement) {
    closePromises.push(workers.enhancement.close())
  }
  if (workers.export) {
    closePromises.push(workers.export.close())
  }
  if (workers.email) {
    closePromises.push(workers.email.close())
  }
  if (workers.betaEmail) {
    closePromises.push(workers.betaEmail.close())
  }
  
  await Promise.all(closePromises)
  workers = {}
  
  console.log('All queue workers stopped')
}

// Pause all workers
export const pauseWorkers = async () => {
  const pausePromises = []
  
  if (workers.documentAnalysis) {
    pausePromises.push(workers.documentAnalysis.pause())
  }
  if (workers.enhancement) {
    pausePromises.push(workers.enhancement.pause())
  }
  if (workers.export) {
    pausePromises.push(workers.export.pause())
  }
  if (workers.email) {
    pausePromises.push(workers.email.pause())
  }
  if (workers.betaEmail) {
    pausePromises.push(workers.betaEmail.pause())
  }
  
  await Promise.all(pausePromises)
  console.log('All queue workers paused')
}

// Resume all workers
export const resumeWorkers = async () => {
  const resumePromises = []
  
  if (workers.documentAnalysis) {
    resumePromises.push(workers.documentAnalysis.resume())
  }
  if (workers.enhancement) {
    resumePromises.push(workers.enhancement.resume())
  }
  if (workers.export) {
    resumePromises.push(workers.export.resume())
  }
  if (workers.email) {
    resumePromises.push(workers.email.resume())
  }
  if (workers.betaEmail) {
    resumePromises.push(workers.betaEmail.resume())
  }
  
  await Promise.all(resumePromises)
  console.log('All queue workers resumed')
}

// Get worker status
export const getWorkerStatus = () => {
  return {
    documentAnalysis: workers.documentAnalysis ? 'running' : 'stopped',
    enhancement: workers.enhancement ? 'running' : 'stopped',
    export: workers.export ? 'running' : 'stopped',
    email: workers.email ? 'running' : 'stopped',
    betaEmail: workers.betaEmail ? 'running' : 'stopped',
  }
}