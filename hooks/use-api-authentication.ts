'use client'

import { useState, useCallback, useEffect } from 'react'

export interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: Date
  lastUsed?: Date
  scopes: string[]
  status: 'active' | 'revoked' | 'expired'
  expiresAt?: Date
}

export interface ApiKeyValidation {
  isValid: boolean
  error?: string
  scopes?: string[]
  remaining?: number
  limit?: number
}

const STORAGE_KEY = 'beautifyai_api_keys'

export function useApiAuthentication() {
  const [apiKey, setApiKey] = useState<string>('')
  const [savedKeys, setSavedKeys] = useState<ApiKey[]>([])
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ApiKeyValidation | null>(null)

  // Load saved keys from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setSavedKeys(parsed.map((key: ApiKey) => ({
            ...key,
            createdAt: new Date(key.createdAt),
            lastUsed: key.lastUsed ? new Date(key.lastUsed) : undefined,
            expiresAt: key.expiresAt ? new Date(key.expiresAt) : undefined
          })))
        }
      } catch (error) {
        console.error('Failed to load saved API keys:', error)
      }
    }
  }, [])

  // Save keys to localStorage whenever they change
  const saveKeysToStorage = useCallback((keys: ApiKey[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
      } catch (error) {
        console.error('Failed to save API keys:', error)
      }
    }
  }, [])

  const validateApiKey = useCallback(async (key: string) => {
    setValidating(true)
    setValidationResult(null)

    try {
      // Simulate API key validation
      // In a real app, this would call an actual API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mock validation logic
      if (!key) {
        setValidationResult({
          isValid: false,
          error: 'API key is required'
        })
      } else if (!key.startsWith('bai_')) {
        setValidationResult({
          isValid: false,
          error: 'Invalid API key format. Keys should start with "bai_"'
        })
      } else if (key.length < 32) {
        setValidationResult({
          isValid: false,
          error: 'API key is too short'
        })
      } else {
        // Simulate successful validation
        setValidationResult({
          isValid: true,
          scopes: ['enhance:read', 'enhance:write', 'documents:read'],
          remaining: 950,
          limit: 1000
        })
      }
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      })
    } finally {
      setValidating(false)
    }
  }, [])

  const saveApiKey = useCallback((name: string, key: string, scopes: string[]) => {
    const newKey: ApiKey = {
      id: `key_${Date.now()}`,
      name,
      key,
      createdAt: new Date(),
      scopes,
      status: 'active'
    }

    const updated = [...savedKeys, newKey]
    setSavedKeys(updated)
    saveKeysToStorage(updated)
  }, [savedKeys, saveKeysToStorage])

  const removeApiKey = useCallback((id: string) => {
    const updated = savedKeys.filter(key => key.id !== id)
    setSavedKeys(updated)
    saveKeysToStorage(updated)
  }, [savedKeys, saveKeysToStorage])

  const updateApiKeyStatus = useCallback((id: string, status: ApiKey['status']) => {
    const updated = savedKeys.map(key => 
      key.id === id ? { ...key, status } : key
    )
    setSavedKeys(updated)
    saveKeysToStorage(updated)
  }, [savedKeys, saveKeysToStorage])

  const updateLastUsed = useCallback((id: string) => {
    const updated = savedKeys.map(key => 
      key.id === id ? { ...key, lastUsed: new Date() } : key
    )
    setSavedKeys(updated)
    saveKeysToStorage(updated)
  }, [savedKeys, saveKeysToStorage])

  const selectApiKey = useCallback((key: string) => {
    setApiKey(key)
    setValidationResult(null)
  }, [])

  const clearApiKey = useCallback(() => {
    setApiKey('')
    setValidationResult(null)
  }, [])

  const generateApiKey = useCallback(() => {
    // Generate a mock API key
    const prefix = 'bai_'
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let key = prefix

    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    return key
  }, [])

  return {
    apiKey,
    setApiKey,
    savedKeys,
    validating,
    validationResult,
    validateApiKey,
    saveApiKey,
    removeApiKey,
    updateApiKeyStatus,
    updateLastUsed,
    selectApiKey,
    clearApiKey,
    generateApiKey
  }
}