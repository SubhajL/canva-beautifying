"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"

export type DensityMode = "comfortable" | "compact"

interface DensityContextValue {
  mode: DensityMode
  setMode: (mode: DensityMode) => void
  toggle: () => void
}

const DensityContext = createContext<DensityContextValue | null>(null)

const STORAGE_KEY = "ui:density"
const DEFAULT_MODE: DensityMode = "comfortable"

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<DensityMode>(DEFAULT_MODE)

  // Initialize from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "comfortable" || stored === "compact") {
        setModeState(stored)
      }
    } catch (error) {
      // localStorage access failed, use default
      console.warn("Failed to read density mode from localStorage:", error)
    }
  }, [])

  // Sync to document.body.dataset and localStorage
  useEffect(() => {
    document.body.dataset.density = mode

    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch (error) {
      // localStorage write failed, continue without persistence
      console.warn("Failed to persist density mode to localStorage:", error)
    }
  }, [mode])

  const setMode = useCallback((newMode: DensityMode) => {
    setModeState(newMode)
  }, [])

  const toggle = useCallback(() => {
    setModeState((prev) => (prev === "comfortable" ? "compact" : "comfortable"))
  }, [])

  const value: DensityContextValue = {
    mode,
    setMode,
    toggle,
  }

  return (
    <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
  )
}

export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext)
  if (!context) {
    throw new Error("useDensity must be used within DensityProvider")
  }
  return context
}

export function useDensityClass(): string {
  const { mode } = useDensity()

  return mode === "comfortable" ? "gap-4 py-4 px-6" : "gap-2 py-2 px-3"
}
