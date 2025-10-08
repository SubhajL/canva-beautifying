"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

export type UploadPreferredAction = 'upload' | 'canva-import' | 'batch-upload'

type Prefs = {
  uploadPreferredAction?: UploadPreferredAction
  resultsLastSettings?: Record<string, unknown>
}

const KEY = 'ui:prefs'

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writePrefs(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch {}
}

export function useUserPrefs() {
  const [prefs, setPrefs] = useState<Prefs>({})

  useEffect(() => { setPrefs(readPrefs()) }, [])

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      writePrefs(next)
      return next
    })
  }, [])

  const rememberUploadAction = useCallback((action: UploadPreferredAction) => setPref('uploadPreferredAction', action), [setPref])
  const setResultsLastSettings = useCallback((settings: Record<string, unknown>) => setPref('resultsLastSettings', settings), [setPref])

  return useMemo(() => ({ prefs, setPref, rememberUploadAction, setResultsLastSettings }), [prefs, setPref, rememberUploadAction, setResultsLastSettings])
}

