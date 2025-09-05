import { NextRequest, NextResponse } from 'next/server'
import { checkAuthentication } from '@/lib/api/middleware'
import { createResponse } from '@/lib/api/response'
import { sessionStore } from '@/lib/redis/session-store'
import { getWebSocketServer } from '@/lib/websocket/server'

interface Params {
  params: {
    sessionId: string
  }
}

// DELETE /api/v1/websockets/sessions/:sessionId - Force disconnect a session (admin only)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // Check authentication
    const authResult = await checkAuthentication(request)
    if (!authResult.authenticated) {
      return NextResponse.json(
        createResponse(null, 'Authentication required'),
        { status: 401 }
      )
    }

    // Check if user is admin
    const isAdmin = authResult.user?.user_metadata?.role === 'admin'
    if (!isAdmin) {
      return NextResponse.json(
        createResponse(null, 'Admin access required'),
        { status: 403 }
      )
    }

    const { sessionId } = params

    // Get session info first
    const session = await sessionStore.getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        createResponse(null, 'Session not found'),
        { status: 404 }
      )
    }

    // Try to disconnect the socket if it's on this server
    const wsServer = getWebSocketServer()
    const io = (wsServer as any).io
    if (io) {
      const socket = io.sockets.sockets.get(sessionId)
      if (socket) {
        socket.disconnect(true)
      }
    }

    // Remove session from Redis
    await sessionStore.removeSession(session.userId, sessionId)

    return NextResponse.json(
      createResponse({
        message: 'Session disconnected successfully',
        sessionId,
        userId: session.userId
      })
    )
  } catch (error) {
    console.error('Failed to disconnect session:', error)
    return NextResponse.json(
      createResponse(null, 'Failed to disconnect session'),
      { status: 500 }
    )
  }
}

// GET /api/v1/websockets/sessions/:sessionId - Get session details
export async function GET(request: NextRequest, { params }: Params) {
  try {
    // Check authentication
    const authResult = await checkAuthentication(request)
    if (!authResult.authenticated) {
      return NextResponse.json(
        createResponse(null, 'Authentication required'),
        { status: 401 }
      )
    }

    const { sessionId } = params

    // Get session info
    const session = await sessionStore.getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        createResponse(null, 'Session not found'),
        { status: 404 }
      )
    }

    // Check if user owns this session or is admin
    const isOwner = session.userId === authResult.userId
    const isAdmin = authResult.user?.user_metadata?.role === 'admin'
    
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        createResponse(null, 'Unauthorized'),
        { status: 403 }
      )
    }

    // Enrich session data
    const enrichedSession = {
      ...session,
      connectedDuration: Date.now() - session.connectedAt,
      lastSeenAgo: Date.now() - session.lastActivity,
      isActive: Date.now() - session.lastActivity < 60000
    }

    return NextResponse.json(createResponse(enrichedSession))
  } catch (error) {
    console.error('Failed to get session:', error)
    return NextResponse.json(
      createResponse(null, 'Failed to retrieve session'),
      { status: 500 }
    )
  }
}