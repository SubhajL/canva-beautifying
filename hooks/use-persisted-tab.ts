import { useState, useEffect, useCallback } from 'react'
import { getStorageItem, setStorageItem } from '@/lib/utils/local-storage'

/**
 * Custom hook for persisting active tab state to localStorage
 * with validation, cross-tab synchronization, and type safety
 */
export function usePersistedTab(
  storageKey: string,
  defaultTab: string,
  tabs: string[]
): [string, (tab: string) => void] {
  const [activeTab, setActiveTabState] = useState<string>(defaultTab)

  // Initialize from localStorage with validation
  useEffect(() => {
    const stored = getStorageItem<string>(storageKey, defaultTab)

    if (tabs.includes(stored)) {
      setActiveTabState(stored)
    } else {
      // Invalid tab in storage, replace with default
      setActiveTabState(defaultTab)
      setStorageItem(storageKey, defaultTab)
    }
  }, [storageKey, defaultTab, tabs])

  // Update tab with validation
  const setActiveTab = useCallback(
    (tab: string) => {
      if (!tabs.includes(tab)) {
        console.warn(`Invalid tab "${tab}" ignored. Valid tabs: ${tabs.join(', ')}`)
        return
      }

      setActiveTabState(tab)
      setStorageItem(storageKey, tab)
    },
    [storageKey, tabs]
  )

  // Sync across tabs via storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const newTab = JSON.parse(e.newValue) as string
          if (tabs.includes(newTab)) {
            setActiveTabState(newTab)
          }
        } catch (error) {
          console.warn('Failed to parse storage event value:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [storageKey, tabs])

  return [activeTab, setActiveTab]
}
