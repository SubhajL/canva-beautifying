"use client"

import { ReactNode, useEffect } from "react"
import { useStoreSync } from "@/hooks/use-store-sync"

interface StoreProviderProps {
  children: ReactNode
}

export function StoreProvider({ children }: StoreProviderProps) {
  // Initialize store sync
  useStoreSync()

  return <>{children}</>
}

// Optional loading component while store initializes
export function StoreLoadingGuard({ children }: StoreProviderProps) {
  const { isReady, loading, error } = useStoreSyncGuard()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading size="xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="mb-4 text-red-600">Failed to initialize application</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-primary px-4 py-2 text-white hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!isReady) {
    return null
  }

  return <>{children}</>
}

// Import the hook at the top
import { useStoreSyncGuard } from "@/hooks/use-store-sync"
import { Loading } from "@/components/ui/loading"
