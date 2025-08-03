'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getSocketManager } from '@/lib/websocket/client'
import type { Notification } from '@/lib/websocket/types'

interface WebSocketContextValue {
  isConnected: boolean
  connectionError?: string
  notifications: Notification[]
  clearNotification: (id: string) => void
  reconnect: () => Promise<void>
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined)

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string>()
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (!user) return

    const socketManager = getSocketManager()

    // Connection event handlers
    const handleConnected = () => {
      setIsConnected(true)
      setConnectionError(undefined)
    }

    const handleDisconnected = () => {
      setIsConnected(false)
    }

    const handleConnectionFailed = (...args: unknown[]) => {
      const error = args[0] as string
      setConnectionError(error)
      setIsConnected(false)
    }

    const handleError = (...args: unknown[]) => {
      const error = args[0] as string
      console.error('WebSocket error:', error)
      setConnectionError(error)
    }

    // Notification handler
    const handleNotification = (...args: unknown[]) => {
      const notification = args[0] as Notification
      setNotifications(prev => [...prev, notification])
      
      // Auto-clear info notifications after 5 seconds
      if (notification.type === 'info') {
        setTimeout(() => {
          clearNotification(notification.id)
        }, 5000)
      }
    }

    // Subscribe to events
    socketManager.on('connected', handleConnected)
    socketManager.on('disconnected', handleDisconnected)
    socketManager.on('connection_failed', handleConnectionFailed)
    socketManager.on('error', handleError)
    socketManager.on('notification', handleNotification)

    // Subscribe to user's notifications
    socketManager.on('ready', () => {
      socketManager.subscribeToUser(user.id)
    })

    // Connect
    socketManager.connect().catch(err => {
      console.error('Failed to connect WebSocket:', err)
      setConnectionError(err.message)
    })

    return () => {
      socketManager.off('connected', handleConnected)
      socketManager.off('disconnected', handleDisconnected)
      socketManager.off('connection_failed', handleConnectionFailed)
      socketManager.off('error', handleError)
      socketManager.off('notification', handleNotification)
      
      if (socketManager.isConnected()) {
        socketManager.unsubscribeFromUser(user.id)
        socketManager.disconnect()
      }
    }
  }, [user])

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const reconnect = async () => {
    const socketManager = getSocketManager()
    try {
      await socketManager.connect()
    } catch (err) {
      console.error('Reconnection failed:', err)
      setConnectionError(err instanceof Error ? err.message : 'Connection failed')
    }
  }

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        connectionError,
        notifications,
        clearNotification,
        reconnect,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketConnection() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketConnection must be used within WebSocketProvider')
  }
  return context
}