// Minimal in-memory session store for websockets and API tests

type SessionMeta = {
  userAgent?: string
  ipAddress?: string
  metadata?: Record<string, any>
  lastActive?: number
}

const sessionsByUser = new Map<string, Map<string, SessionMeta>>()

export const sessionStore = {
  async addSession(userId: string, sessionId: string, meta: SessionMeta = {}): Promise<void> {
    const userSessions = sessionsByUser.get(userId) || new Map<string, SessionMeta>()
    userSessions.set(sessionId, { ...meta, lastActive: Date.now() })
    sessionsByUser.set(userId, userSessions)
  },

  async touchSession(sessionId: string): Promise<void> {
    for (const [, map] of sessionsByUser) {
      const s = map.get(sessionId)
      if (s) {
        s.lastActive = Date.now()
        return
      }
    }
  },

  async removeSession(userId: string, sessionId: string): Promise<void> {
    const userSessions = sessionsByUser.get(userId)
    if (userSessions) {
      userSessions.delete(sessionId)
      if (userSessions.size === 0) sessionsByUser.delete(userId)
    }
  },

  async getUserSessions(userId: string): Promise<Array<{ id: string; meta: SessionMeta }>> {
    const userSessions = sessionsByUser.get(userId)
    if (!userSessions) return []
    return Array.from(userSessions.entries()).map(([id, meta]) => ({ id, meta }))
  },

  async healthCheck(): Promise<boolean> {
    return true
  },

  // No-op lifecycle methods for tests expecting these symbols
  async stopCleanup(): Promise<void> {
    return
  },

  async startCleanup(): Promise<void> {
    return
  },
}
