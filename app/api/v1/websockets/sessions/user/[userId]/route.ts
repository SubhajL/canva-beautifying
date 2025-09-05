import { NextRequest, NextResponse } from 'next/server'
import { checkAuthentication } from '@/lib/api/middleware'
import { createResponse } from '@/lib/api/response'
import { sessionStore } from '@/lib/redis/session-store'
import { createClient } from '@/lib/supabase/server'

interface Params {
  params: {
    userId: string
  }
}

// GET /api/v1/websockets/sessions/user/:userId - Get sessions for a specific user
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

    const { userId } = params

    // Check if requesting sessions for another user
    if (userId !== authResult.userId) {
      // Check if user is admin
      const isAdmin = authResult.user?.user_metadata?.role === 'admin'
      if (!isAdmin) {
        return NextResponse.json(
          createResponse(null, 'Unauthorized'),
          { status: 403 }
        )
      }
    }

    // Get user details
    const supabase = await createClient()
    const { data: userData } = await supabase
      .from('users')
      .select('email, subscription_tier, created_at')
      .eq('id', userId)
      .single()

    // Get active sessions
    const sessions = await sessionStore.getActiveSessions(userId)

    // Enrich session data
    const enrichedSessions = sessions.map(session => ({
      ...session,
      connectedDuration: Date.now() - session.connectedAt,
      lastSeenAgo: Date.now() - session.lastActivity,
      isActive: Date.now() - session.lastActivity < 60000 // Active if seen in last minute
    }))

    // Sort by last activity
    enrichedSessions.sort((a, b) => b.lastActivity - a.lastActivity)

    const response = {
      user: {
        id: userId,
        email: userData?.email,
        subscriptionTier: userData?.subscription_tier,
        createdAt: userData?.created_at
      },
      sessions: enrichedSessions,
      summary: {
        totalSessions: enrichedSessions.length,
        activeSessions: enrichedSessions.filter(s => s.isActive).length,
        oldestSession: enrichedSessions.reduce((oldest, session) => 
          session.connectedAt < oldest.connectedAt ? session : oldest,
          enrichedSessions[0] || { connectedAt: Date.now() }
        )
      }
    }

    return NextResponse.json(createResponse(response))
  } catch (error) {
    console.error('Failed to get user sessions:', error)
    return NextResponse.json(
      createResponse(null, 'Failed to retrieve user sessions'),
      { status: 500 }
    )
  }
}