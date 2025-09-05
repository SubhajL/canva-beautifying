import { useEffect } from 'react'
import { shallow } from 'zustand/shallow'
import { 
  useDashboardStore,
  selectFilteredDocuments,
  selectActiveEnhancements,
  selectDocumentWithEnhancement,
  selectIsConnected,
  selectIsReconnecting
} from '@/lib/store/dashboard-store'
import type { DashboardStore, Document, Enhancement } from '@/lib/store/types'

// Main store hook with selector
export function useDashboard<T>(selector: (state: DashboardStore) => T): T {
  return useDashboardStore(selector, shallow)
}

// Document hooks
export function useDocuments() {
  const documents = useDashboardStore(selectFilteredDocuments)
  const loading = useDashboardStore(state => state.loading)
  const error = useDashboardStore(state => state.error)
  const filters = useDashboardStore(state => state.filters)
  const sort = useDashboardStore(state => state.sort)
  
  const actions = useDashboardStore(state => ({
    setFilters: state.setFilters,
    setSort: state.setSort,
    addDocument: state.addDocument,
    updateDocument: state.updateDocument,
    deleteDocument: state.deleteDocument
  }), shallow)
  
  return {
    documents,
    loading,
    error,
    filters,
    sort,
    ...actions
  }
}

// Single document hook
export function useDocument(documentId: string) {
  const data = useDashboardStore(selectDocumentWithEnhancement(documentId))
  const updateDocument = useDashboardStore(state => state.updateDocument)
  const deleteDocument = useDashboardStore(state => state.deleteDocument)
  
  return {
    document: data.document,
    enhancement: data.enhancement,
    updateDocument: (updates: Partial<Document>) => updateDocument(documentId, updates),
    deleteDocument: () => deleteDocument(documentId)
  }
}

// Enhancement hooks
export function useEnhancements() {
  const activeEnhancements = useDashboardStore(selectActiveEnhancements)
  const actions = useDashboardStore(state => ({
    updateProgress: state.updateProgress,
    completeEnhancement: state.completeEnhancement,
    failEnhancement: state.failEnhancement
  }), shallow)
  
  return {
    activeEnhancements,
    ...actions
  }
}

// User hook
export function useUser() {
  const user = useDashboardStore(state => state.user)
  const loading = useDashboardStore(state => state.loading)
  const actions = useDashboardStore(state => ({
    updateUser: state.updateUser,
    updateUsage: state.updateUsage,
    updatePreferences: state.updatePreferences
  }), shallow)
  
  return {
    user,
    loading,
    ...actions
  }
}

// WebSocket status hook
export function useWebSocketStatus() {
  const connected = useDashboardStore(selectIsConnected)
  const reconnecting = useDashboardStore(selectIsReconnecting)
  const socketState = useDashboardStore(state => state.socketState)
  
  return {
    connected,
    reconnecting,
    error: socketState.lastError,
    reconnectAttempts: socketState.reconnectAttempts
  }
}

// Subscription management hook
export function useSubscriptions() {
  const subscriptions = useDashboardStore(state => state.socketState.subscriptions)
  const actions = useDashboardStore(state => ({
    addSubscription: state.addSubscription,
    removeSubscription: state.removeSubscription,
    clearSubscriptions: state.clearSubscriptions
  }), shallow)
  
  return {
    subscriptions: Array.from(subscriptions),
    ...actions
  }
}

// Auto-subscribe to document updates
export function useDocumentSubscription(documentId: string | undefined) {
  const addSubscription = useDashboardStore(state => state.addSubscription)
  const removeSubscription = useDashboardStore(state => state.removeSubscription)
  
  useEffect(() => {
    if (!documentId) return
    
    const channel = `document:${documentId}`
    addSubscription(channel)
    
    return () => {
      removeSubscription(channel)
    }
  }, [documentId, addSubscription, removeSubscription])
}

// Auto-subscribe to enhancement updates
export function useEnhancementSubscription(documentId: string | undefined) {
  const addSubscription = useDashboardStore(state => state.addSubscription)
  const removeSubscription = useDashboardStore(state => state.removeSubscription)
  
  useEffect(() => {
    if (!documentId) return
    
    const channel = `enhancement:${documentId}`
    addSubscription(channel)
    
    return () => {
      removeSubscription(channel)
    }
  }, [documentId, addSubscription, removeSubscription])
}