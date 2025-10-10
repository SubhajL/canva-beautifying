import { useState, useEffect, useCallback } from 'react'

export interface EnhancementItem {
  id: string
  documentId: string
  userId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
}

export interface InfiniteEnhancementsResult {
  enhancements: EnhancementItem[]
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: Error | null
  loadMore: () => void
  refresh: () => void
}

interface EnhancementsPage {
  items: EnhancementItem[]
  nextCursor: string | null
}

/**
 * Fetch a single page of enhancements from the API
 */
async function fetchEnhancementsPage(
  userId: string,
  cursor: string | null,
  limit: number
): Promise<EnhancementsPage> {
  const url = new URL('/api/v1/enhancements', window.location.origin)
  url.searchParams.set('userId', userId)
  url.searchParams.set('limit', String(limit))
  if (cursor) {
    url.searchParams.set('cursor', cursor)
  }

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`Failed to fetch enhancements: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Custom hook for cursor-based pagination of user enhancements
 * with deduplication, error handling, and infinite scroll support
 */
export function useInfiniteEnhancements(
  userId: string,
  pageSize: number = 20
): InfiniteEnhancementsResult {
  const [enhancements, setEnhancements] = useState<EnhancementItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Fetch initial page
  const fetchInitialPage = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const page = await fetchEnhancementsPage(userId, null, pageSize)
      setEnhancements(page.items)
      setNextCursor(page.nextCursor)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setEnhancements([])
    } finally {
      setIsLoading(false)
    }
  }, [userId, pageSize])

  // Load more pages
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const page = await fetchEnhancementsPage(userId, nextCursor, pageSize)

      // Deduplicate by ID
      setEnhancements(prev => {
        const existingIds = new Set(prev.map(e => e.id))
        const newItems = page.items.filter(item => !existingIds.has(item.id))
        return [...prev, ...newItems]
      })

      setNextCursor(page.nextCursor)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoadingMore(false)
    }
  }, [userId, nextCursor, pageSize, isLoadingMore])

  // Refresh from beginning
  const refresh = useCallback(() => {
    setEnhancements([])
    setNextCursor(null)
    fetchInitialPage()
  }, [fetchInitialPage])

  // Fetch initial page on mount
  useEffect(() => {
    fetchInitialPage()
  }, [fetchInitialPage])

  return {
    enhancements,
    hasMore: nextCursor !== null,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    refresh,
  }
}
