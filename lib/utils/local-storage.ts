/**
 * Type-safe wrapper for localStorage.getItem
 * Handles JSON parsing and error recovery
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') {
    return defaultValue
  }

  try {
    const item = localStorage.getItem(key)
    if (item === null) {
      return defaultValue
    }
    return JSON.parse(item) as T
  } catch (error) {
    console.warn(`Error reading from localStorage key "${key}":`, error)
    return defaultValue
  }
}

/**
 * Type-safe wrapper for localStorage.setItem
 * Handles JSON stringification and quota errors
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.warn(`Error writing to localStorage key "${key}":`, error)
    return false
  }
}

/**
 * Safe wrapper for localStorage.removeItem
 * Returns success status
 */
export function removeStorageItem(key: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn(`Error removing localStorage key "${key}":`, error)
    return false
  }
}
