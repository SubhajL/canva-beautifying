import { useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useDashboardStore } from '@/lib/store/dashboard-store'
import type { Document, OptimisticUpdate } from '@/lib/store/types'

export function useOptimisticUpdate() {
  const addOptimisticUpdate = useDashboardStore(state => state.addOptimisticUpdate)
  const removeOptimisticUpdate = useDashboardStore(state => state.removeOptimisticUpdate)
  const rollbackOptimisticUpdate = useDashboardStore(state => state.rollbackOptimisticUpdate)

  const createDocument = useCallback(async (
    document: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>,
    serverAction: (doc: Document) => Promise<Document>
  ) => {
    const optimisticId = uuidv4()
    const optimisticDoc: Document = {
      ...document,
      id: optimisticId,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const updateId = uuidv4()
    const update: OptimisticUpdate<Document> = {
      id: updateId,
      type: 'create',
      timestamp: Date.now(),
      payload: optimisticDoc
    }

    // Apply optimistic update
    addOptimisticUpdate(update)

    try {
      // Execute server action
      const serverDoc = await serverAction(optimisticDoc)
      
      // Remove the optimistic update and add the real document
      removeOptimisticUpdate(updateId)
      
      // Update the document with server response
      useDashboardStore.getState().updateDocument(optimisticId, serverDoc)
      
      return { success: true, data: serverDoc }
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(updateId)
      return { success: false, error }
    }
  }, [addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate])

  const updateDocument = useCallback(async (
    documentId: string,
    updates: Partial<Document>,
    serverAction: (id: string, updates: Partial<Document>) => Promise<Document>
  ) => {
    const updateId = uuidv4()
    const update: OptimisticUpdate<Document> = {
      id: updateId,
      type: 'update',
      timestamp: Date.now(),
      payload: { id: documentId, ...updates }
    }

    // Apply optimistic update
    addOptimisticUpdate(update)

    try {
      // Execute server action
      const serverDoc = await serverAction(documentId, updates)
      
      // Remove the optimistic update
      removeOptimisticUpdate(updateId)
      
      // Update with server response
      useDashboardStore.getState().updateDocument(documentId, serverDoc)
      
      return { success: true, data: serverDoc }
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(updateId)
      return { success: false, error }
    }
  }, [addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate])

  const deleteDocument = useCallback(async (
    documentId: string,
    serverAction: (id: string) => Promise<void>
  ) => {
    const updateId = uuidv4()
    const update: OptimisticUpdate<Document> = {
      id: updateId,
      type: 'delete',
      timestamp: Date.now(),
      payload: { id: documentId } as Document
    }

    // Apply optimistic update
    addOptimisticUpdate(update)

    try {
      // Execute server action
      await serverAction(documentId)
      
      // Remove the optimistic update (delete is permanent)
      removeOptimisticUpdate(updateId)
      
      return { success: true }
    } catch (error) {
      // Rollback on error
      rollbackOptimisticUpdate(updateId)
      return { success: false, error }
    }
  }, [addOptimisticUpdate, removeOptimisticUpdate, rollbackOptimisticUpdate])

  return {
    createDocument,
    updateDocument,
    deleteDocument
  }
}

// Hook for batch optimistic updates
export function useBatchOptimisticUpdate() {
  const { createDocument, updateDocument, deleteDocument } = useOptimisticUpdate()

  const executeBatch = useCallback(async (
    operations: Array<{
      type: 'create' | 'update' | 'delete'
      data: any
      action: (...args: any[]) => Promise<any>
    }>
  ) => {
    const results = await Promise.allSettled(
      operations.map(async (op) => {
        switch (op.type) {
          case 'create':
            return createDocument(op.data, op.action)
          case 'update':
            return updateDocument(op.data.id, op.data.updates, op.action)
          case 'delete':
            return deleteDocument(op.data.id, op.action)
          default:
            throw new Error(`Unknown operation type: ${op.type}`)
        }
      })
    )

    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return {
      successful,
      failed,
      results
    }
  }, [createDocument, updateDocument, deleteDocument])

  return { executeBatch }
}