import { useState, useEffect, useCallback, useRef } from 'react'
import { getStorageItem, setStorageItem, removeStorageItem } from '@/lib/utils/local-storage'

export interface UseUserPrefsResult<T> {
  prefs: T | null
  setPrefs: (value: T) => void
  removePrefs: () => void
  isLoading: boolean
}

/**
 * Custom hook for persisting user preferences to localStorage
 * with type safety, SSR support, and cross-tab synchronization
 */
export function useUserPrefs<T>(
  key: string,
  defaultValue: T
): UseUserPrefsResult<T> {
  const [prefs, setPrefsState] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const defaultRef = useRef(defaultValue)

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = getStorageItem<T>(key, defaultRef.current)
    setPrefsState(stored)
    setIsLoading(false)
  }, [key])

  // Update preferences and persist to localStorage
  const setPrefs = useCallback(
    (value: T) => {
      const success = setStorageItem(key, value)
      if (success) {
        setPrefsState(value)
      }
    },
    [key]
  )

  // Remove preferences from state and localStorage
  const removePrefs = useCallback(() => {
    removeStorageItem(key)
    setPrefsState(null)
  }, [key])

  // Sync across tabs via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        if (e.newValue === null) {
          setPrefsState(null)
        } else {
          try {
            const newValue = JSON.parse(e.newValue) as T
            setPrefsState(newValue)
          } catch (error) {
            console.warn('Failed to parse storage event value:', error)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [key])

  return { prefs, setPrefs, removePrefs, isLoading }
}
