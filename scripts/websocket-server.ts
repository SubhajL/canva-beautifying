import { createServer } from 'http'
import { getWebSocketServer } from '../lib/websocket/server'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const PORT = process.env.WEBSOCKET_PORT || 5001

// Create HTTP server
const httpServer = createServer()

// Initialize WebSocket server
const wsServer = getWebSocketServer()
wsServer.initialize(httpServer)

// Start server
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`)
})

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await wsServer.close()
  httpServer.close(() => {
    process.exit(0)
  })
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await wsServer.close()
  httpServer.close(() => {
    process.exit(0)
  })
})