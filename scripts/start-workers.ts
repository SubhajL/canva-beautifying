import 'dotenv/config'
import { startWorkers, stopWorkers } from '../lib/queue/processors'

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await stopWorkers()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await stopWorkers()
  process.exit(0)
})

// Start workers
async function main() {
  try {
    console.log('Starting queue workers...')
    await startWorkers()
    console.log('Queue workers are running. Press Ctrl+C to stop.')
  } catch (error) {
    console.error('Failed to start workers:', error)
    process.exit(1)
  }
}

main()