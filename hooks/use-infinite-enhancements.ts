"use client"

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'

export interface InfiniteOptions {
  limit?: number
  search?: string
  status?: string
  fileType?: string
  fromDate?: string
}

export function useInfiniteEnhancements(opts: InfiniteOptions = {}) {
  const { limit = 20, search, status, fileType, fromDate } = opts
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState<number | null>(null)

  const filtersKey = useMemo(() => JSON.stringify({ search, status, fileType, fromDate }), [search, status, fileType, fromDate])

  const load = async (reset = false) => {
    if (!user) return
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      let query = supabase
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (search) query = query.ilike('title', `%${search}%`)
      if (status) query = query.eq('status', status)
      if (fileType) query = query.eq('file_type', fileType)
      if (fromDate) query = query.gte('created_at', fromDate)
      if (!reset && cursor) query = query.lt('created_at', cursor)

      const { data, error: fetchError, count } = await query.limit(limit)
      if (fetchError) throw fetchError

      if (reset) {
        setItems(data || [])
      } else {
        setItems(prev => [...prev, ...(data || [])])
      }
      setTotalCount(count ?? null)
      setHasMore((data?.length || 0) === limit)
      const last = (data || [])[data!.length - 1]
      setCursor(last ? last.created_at : null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }

  // Reset when filters change
  useEffect(() => {
    setCursor(null)
    setItems([])
    setHasMore(true)
    // initial load
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, limit, filtersKey])

  const fetchNext = () => load(false)

  return { items, loading, error, hasMore, fetchNext, totalCount }
}

