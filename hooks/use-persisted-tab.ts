"use client"

import { useEffect, useState } from 'react'

export function usePersistedTab(storageKey: string, defaultValue: string) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null
      if (stored) setValue(stored)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, value)
    } catch {}
  }, [storageKey, value])

  return [value, setValue] as const
}

