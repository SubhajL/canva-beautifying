"use client"

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from '@/contexts/auth-context'

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const { user, session } = useAuth()

  useEffect(() => {
    if (!user || !session) {
      return
    }

    // Create socket connection with auth
    const socketInstance = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001', {
      auth: {
        token: session.access_token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    })

    // Connection handlers
    socketInstance.on('connect', () => {
      console.log('WebSocket connected')
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
    })

    setSocket(socketInstance)

    // Cleanup on unmount
    return () => {
      if (socketInstance.connected) {
        socketInstance.disconnect()
      }
    }
  }, [user, session])

  return {
    socket,
    isConnected
  }
}