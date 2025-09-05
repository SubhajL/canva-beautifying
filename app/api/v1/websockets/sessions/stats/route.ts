import { NextRequest, NextResponse } from 'next/server'
import { checkAuthentication } from '@/lib/api/middleware'
import { createResponse } from '@/lib/api/response'
import { sessionStore } from '@/lib/redis/session-store'
import { getWebSocketServer } from '@/lib/websocket/server'
import { redis } from '@/lib/queue/redis'

// GET /api/v1/websockets/sessions/stats - Get detailed session statistics
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authResult = await checkAuthentication(request)
    if (!authResult.authenticated) {
      return NextResponse.json(
        createResponse(null, 'Authentication required'),
        { status: 401 }
      )
    }

    // Get session counts by user
    const sessionCounts = await sessionStore.getSessionCounts()
    const totalSessions = Object.values(sessionCounts).reduce((a, b) => a + b, 0)
    const totalUsers = Object.keys(sessionCounts).length

    // Get WebSocket server stats
    const wsServer = getWebSocketServer()
    const connectedClients = wsServer.getConnectedUsersCount()
    const rooms = wsServer.getRoomsInfo()

    // Calculate room statistics
    const roomStats = {
      documentRooms: 0,
      batchRooms: 0,
      userRooms: 0,
      totalSubscriptions: 0
    }

    Object.entries(rooms).forEach(([room, count]) => {
      if (room.startsWith('document:')) {
        roomStats.documentRooms++
      } else if (room.startsWith('batch:')) {
        roomStats.batchRooms++
      } else if (room.startsWith('user:')) {
        roomStats.userRooms++
      }
      roomStats.totalSubscriptions += count
    })

    // Get server information
    const serverId = process.env.SERVER_ID || 'unknown'
    const serverSessions = await sessionStore.getServerSessions(serverId)

    // Calculate average sessions per user
    const avgSessionsPerUser = totalUsers > 0 ? (totalSessions / totalUsers).toFixed(2) : 0

    // Get Redis health
    const redisHealthy = await sessionStore.healthCheck()

    const stats = {
      overview: {
        totalSessions,
        totalUsers,
        connectedClients,
        avgSessionsPerUser
      },
      server: {
        serverId,
        sessionCount: serverSessions.length,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      },
      rooms: roomStats,
      distribution: {
        byUser: sessionCounts
      },
      health: {
        redis: redisHealthy,
        websocket: connectedClients >= 0
      }
    }

    return NextResponse.json(createResponse(stats))
  } catch (error) {
    console.error('Failed to get session stats:', error)
    return NextResponse.json(
      createResponse(null, 'Failed to retrieve session statistics'),
      { status: 500 }
    )
  }
}