"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type DensityMode = 'comfortable' | 'compact'
type DensityContextValue = { mode: DensityMode; setMode: (m: DensityMode) => void; toggle: () => void }

const DensityContext = createContext<DensityContextValue | null>(null)
const KEY = 'ui:density'

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DensityMode>('comfortable')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY) as DensityMode | null
      if (stored) setMode(stored)
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(KEY, mode) } catch {}
    // Reflect on document body for global density-aware styles
    if (typeof document !== 'undefined') {
      document.body.dataset.density = mode
    }
  }, [mode])

  const toggle = useCallback(() => setMode((m) => (m === 'comfortable' ? 'compact' : 'comfortable')), [])

  const value = useMemo(() => ({ mode, setMode, toggle }), [mode, toggle])
  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
}

export function useDensity() {
  const ctx = useContext(DensityContext)
  if (!ctx) throw new Error('useDensity must be used within DensityProvider')
  return ctx
}

export function useDensityClass() {
  const { mode } = useDensity()
  return mode === 'compact' ? 'gap-2 py-2 px-3' : 'gap-4 py-4 px-6'
}

