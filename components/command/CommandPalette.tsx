'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useCommandPalette } from '@/contexts/command-palette'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

export default function CommandPalette() {
  const { open, query, setQuery, results, execute, closePalette } = useCommandPalette()
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const groups = useMemo(() => {
    const map = new Map<string, typeof results>()
    results.forEach((r) => {
      const g = r.group || 'General'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(r)
    })
    return Array.from(map.entries())
  }, [results])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closePalette()}>
      <DialogContent className="p-0 gap-0 max-w-xl" data-testid="command-palette">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">Command Palette</DialogTitle>
          <DialogDescription className="sr-only">Search and execute commands across the app</DialogDescription>
        </DialogHeader>
        <div className="p-4 pt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions, pages, recent documents…"
              className="pl-9"
              role="searchbox"
              aria-label="Search commands"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-auto px-2 pb-2" role="listbox" aria-label="Command results">
          {groups.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground" data-testid="command-empty">No matches</div>
          ) : (
            groups.map(([group, items]) => (
              <div key={group}>
                <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">{group}</div>
                <ul>
                  {items.map((i) => (
                    <li key={i.id} role="option" aria-selected="false">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => execute(i)}
                        data-testid={`command-${i.id}`}
                      >
                        <span className="font-medium">{i.label}</span>
                        {i.description && (
                          <span className="ml-2 text-xs text-muted-foreground">{i.description}</span>
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
