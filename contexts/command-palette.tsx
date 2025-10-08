'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export type Command = {
  id: string
  label: string
  description?: string
  group?: string
  href?: string
  action?: () => void | Promise<void>
}

type CommandSource = {
  id: string
  getCommands: () => Promise<Command[]> | Command[]
}

type CommandContextValue = {
  open: boolean
  query: string
  results: Command[]
  registerSource: (source: CommandSource) => () => void
  setQuery: (q: string) => void
  openPalette: () => void
  closePalette: () => void
  execute: (cmd: Command) => Promise<void>
}

const CommandContext = createContext<CommandContextValue | null>(null)

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const sourcesRef = useRef<Map<string, CommandSource>>(new Map())
  const [allCommands, setAllCommands] = useState<Command[]>([])

  // Simple fuzzy search: case-insensitive substring on label/description
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allCommands
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) || (c.description?.toLowerCase().includes(q) ?? false)
    )
  }, [query, allCommands])

  const refresh = useCallback(async () => {
    const promises = Array.from(sourcesRef.current.values()).map(async (s) => {
      try {
        return await s.getCommands()
      } catch {
        return [] as Command[]
      }
    })
    const lists = await Promise.all(promises)
    // ensure unique ids, latest source overrides
    const byId = new Map<string, Command>()
    lists.flat().forEach(c => byId.set(c.id, c))
    setAllCommands(Array.from(byId.values()))
  }, [])

  const registerSource = useCallback((source: CommandSource) => {
    sourcesRef.current.set(source.id, source)
    // fire and forget refresh
    refresh()
    return () => {
      sourcesRef.current.delete(source.id)
      refresh()
    }
  }, [refresh])

  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => setOpen(false), [])

  const execute = useCallback(async (cmd: Command) => {
    if (cmd.action) {
      await cmd.action()
    } else if (cmd.href) {
      router.push(cmd.href)
    }
    setOpen(false)
  }, [router])

  // Global keyboard: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Refresh on mount and when sources change (handled in register)
  useEffect(() => { refresh() }, [refresh])

  const value: CommandContextValue = {
    open,
    query,
    results,
    registerSource,
    setQuery,
    openPalette,
    closePalette,
    execute,
  }

  return (
    <CommandContext.Provider value={value}>
      {children}
    </CommandContext.Provider>
  )
}

export function useCommandPalette() {
  const ctx = useContext(CommandContext)
  if (!ctx) throw new Error('useCommandPalette must be used within CommandProvider')
  return ctx
}

