"use client"

import React from "react"
import { useCommandPalette } from "@/contexts/command-palette"
import { createStaticRoutesSource } from "./sources/static-routes"
import {
  createRecentEnhancementsSource,
  type RecentEnhancement,
} from "./sources/recent-enhancements"
import { useAuth } from "@/contexts/auth"
import { createClient } from "@/lib/supabase/client"

// Dependency-injected fetcher for unit tests and production fetch
type Fetcher = (userId: string, limit: number) => Promise<RecentEnhancement[]>

async function defaultRecentFetcher(
  userId: string,
  limit: number
): Promise<RecentEnhancement[]> {
  const supabase = createClient()
  // Fetch recent enhancements joined with documents for names
  const { data, error } = await supabase
    .from("enhancements")
    .select(`id, created_at, documents(name)`) // expecting row.documents.name
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row: any) => ({
    id: row.id as string,
    documentName: row.documents?.name as string | undefined,
    createdAt: row.created_at as string | undefined,
  }))
}

export function CommandSourcesRegistrar({
  recentFetcherOverride,
  staticRoutesOverride,
  userIdOverride,
  limit = 8,
}: {
  recentFetcherOverride?: Fetcher
  staticRoutesOverride?: ReturnType<typeof createStaticRoutesSource> extends {
    getCommands: () => infer T
  }
    ? T
    : Array<{ id: string; label: string; href: string; group: string }>
  userIdOverride?: string
  limit?: number
}) {
  const { registerSource } = useCommandPalette()
  const { user } = useAuth()

  React.useEffect(() => {
    const unregisters: Array<() => void> = []

    // Static routes
    unregisters.push(
      registerSource(createStaticRoutesSource(staticRoutesOverride as any))
    )

    const userId = userIdOverride || user?.id

    if (userId) {
      const fetcher = recentFetcherOverride ?? defaultRecentFetcher
      unregisters.push(
        registerSource(
          createRecentEnhancementsSource({ fetcher, userId, limit })
        )
      )
    }

    return () => {
      unregisters.forEach((u) => u())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerSource, user?.id, userIdOverride, limit])

  return null
}
