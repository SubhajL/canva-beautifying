import { NextRequest, NextResponse } from 'next/server'
import { checkAuthentication } from '@/lib/api/middleware'
import { createResponse } from '@/lib/api/response'
import { sessionStore } from '@/lib/redis/session-store'
import { getWebSocketServer } from '@/lib/websocket/server'

// GET /api/v1/websockets/sessions - List all sessions or sessions for a user
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

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const includeStats = searchParams.get('includeStats') === 'true'

    // Check if requesting sessions for another user (admin only)
    if (userId && userId !== authResult.userId) {
      // Check if user is admin
      const isAdmin = authResult.user?.user_metadata?.role === 'admin'
      if (!isAdmin) {
        return NextResponse.json(
          createResponse(null, 'Unauthorized'),
          { status: 403 }
        )
      }
    }

    // Get sessions
    if (userId) {
      const sessions = await sessionStore.getActiveSessions(userId)
      return NextResponse.json(
        createResponse({
          userId,
          sessions,
          count: sessions.length
        })
      )
    }

    // Get all session counts
    const sessionCounts = await sessionStore.getSessionCounts()
    const totalSessions = Object.values(sessionCounts).reduce((a, b) => a + b, 0)
    const totalUsers = Object.keys(sessionCounts).length

    const response: any = {
      totalSessions,
      totalUsers,
      sessionCounts
    }

    // Include detailed stats if requested
    if (includeStats) {
      const wsServer = getWebSocketServer()
      response.serverStats = {
        connectedClients: wsServer.getConnectedUsersCount(),
        rooms: wsServer.getRoomsInfo()
      }
    }

    return NextResponse.json(createResponse(response))
  } catch (error) {
    console.error('Failed to get sessions:', error)
    return NextResponse.json(
      createResponse(null, 'Failed to retrieve sessions'),
      { status: 500 }
    )
  }
}