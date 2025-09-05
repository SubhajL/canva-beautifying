import { useEffect, useRef } from 'react'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import { connectDashboardSocket, disconnectDashboardSocket } from '@/lib/websocket/dashboard-socket'
import { useAuth } from '@/lib/auth/auth-context'

// Sync store with server and WebSocket
export function useStoreSync() {
  const { user, session } = useAuth()
  const initialized = useRef(false)
  const setUser = useDashboardStore(state => state.setUser)
  const setLoading = useDashboardStore(state => state.setLoading)
  const setError = useDashboardStore(state => state.setError)
  const reset = useDashboardStore(state => state.reset)

  useEffect(() => {
    if (!session?.access_token) {
      // No session, reset store
      if (initialized.current) {
        reset()
        disconnectDashboardSocket()
        initialized.current = false
      }
      return
    }

    if (initialized.current) return

    const initializeStore = async () => {
      try {
        setLoading(true)
        
        // Set user data from auth
        if (user) {
          setUser({
            id: user.id,
            email: user.email!,
            name: user.user_metadata?.name || user.email!.split('@')[0],
            avatarUrl: user.user_metadata?.avatar_url,
            subscription: {
              tier: 'free', // This would come from your database
              status: 'active'
            },
            usage: {
              documentsProcessed: 0,
              documentsLimit: 10,
              storageUsed: 0,
              storageLimit: 1073741824 // 1GB
            },
            preferences: {
              theme: 'system',
              emailNotifications: true,
              defaultEnhancementSettings: {}
            }
          })
        }

        // Connect WebSocket
        connectDashboardSocket(session.access_token)
        
        // Load initial data
        await loadInitialData()
        
        initialized.current = true
      } catch (error) {
        console.error('Failed to initialize store:', error)
        setError(error instanceof Error ? error.message : 'Failed to initialize')
      } finally {
        setLoading(false)
      }
    }

    initializeStore()

    // Cleanup on unmount
    return () => {
      if (initialized.current) {
        disconnectDashboardSocket()
      }
    }
  }, [session, user, setUser, setLoading, setError, reset])

  // Load initial documents and enhancements
  const loadInitialData = async () => {
    try {
      // Fetch user's documents
      const response = await fetch('/api/documents', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load documents')
      }

      const { data: documents } = await response.json()
      
      // Set documents in store
      useDashboardStore.getState().setDocuments(
        documents.map((doc: any) => ({
          ...doc,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt)
        }))
      )

      // Load active enhancements
      const enhancementsResponse = await fetch('/api/enhancements/active', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      })

      if (enhancementsResponse.ok) {
        const { data: enhancements } = await enhancementsResponse.json()
        
        // Set enhancements in store
        enhancements.forEach((enhancement: any) => {
          useDashboardStore.getState().setEnhancement(enhancement.documentId, {
            ...enhancement,
            createdAt: new Date(enhancement.createdAt),
            startedAt: enhancement.startedAt ? new Date(enhancement.startedAt) : undefined,
            completedAt: enhancement.completedAt ? new Date(enhancement.completedAt) : undefined
          })
        })
      }
    } catch (error) {
      console.error('Failed to load initial data:', error)
      throw error
    }
  }
}

// Hook to ensure store is synced before rendering
export function useStoreSyncGuard() {
  const loading = useDashboardStore(state => state.loading)
  const error = useDashboardStore(state => state.error)
  const user = useDashboardStore(state => state.user)

  return {
    isReady: !loading && !error && user !== null,
    loading,
    error
  }
}