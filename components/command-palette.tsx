'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Search, Upload, FileText, Settings, Home, Clock } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

type Item = {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  href?: string
  onSelect?: () => void
  group: 'Navigate' | 'Upload' | 'Results' | 'Settings' | 'Recent'
}

export function CommandPalette() {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<Item[]>([])

  // Keyboard shortcut (Cmd/Ctrl + K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Load recent documents (last 8) for quick jump to results
  useEffect(() => {
    const loadRecent = async () => {
      try {
        if (!user) return
        const supabase = createClient()
        // Prefer completed enhancements if available
        const { data, error } = await supabase
          .from('enhancements')
          .select('id, documents(name), status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8)

        if (error) throw error

        const items: Item[] = (data || []).map((row: any) => ({
          id: row.id,
          label: row.documents?.[0]?.name || 'Document',
          description: row.status === 'completed' ? 'Results' : 'In progress',
          icon: <FileText className="h-4 w-4" />,
          href: `/app/results/${row.id}`,
          group: 'Recent',
        }))
        setRecent(items)
      } catch (err) {
        // Soft-fail; palette still works for static nav
        console.warn('Command palette recent load failed:', err)
      }
    }
    loadRecent()
  }, [user])

  const staticItems: Item[] = useMemo(
    () => [
      { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <Home className="h-4 w-4" />, href: '/app/dashboard', group: 'Navigate' },
      { id: 'upload', label: 'Upload Files', description: 'Open upload page', icon: <Upload className="h-4 w-4" />, href: '/app/upload', group: 'Upload' },
      { id: 'settings-billing', label: 'Billing & Subscription', icon: <Settings className="h-4 w-4" />, href: '/app/settings/billing', group: 'Settings' },
    ],
    []
  )

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = [...staticItems, ...recent]
    if (!q) return all
    return all.filter((i) =>
      i.label.toLowerCase().includes(q) || (i.description?.toLowerCase().includes(q) ?? false)
    )
  }, [query, staticItems, recent])

  const groups: Array<Item['group']> = ['Navigate', 'Upload', 'Settings', 'Recent']

  const onSelect = (item: Item) => {
    setOpen(false)
    if (item.onSelect) return item.onSelect()
    if (item.href) router.push(item.href)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-xl">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Quick Command
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions, pages, recent documents..."
              className="pl-9"
              aria-label="Search commands"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-auto px-2 pb-2">
          {items.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              No matches. Try a different search.
            </div>
          ) : (
            groups.map((group) => {
              const groupItems = items.filter((i) => i.group === group)
              if (groupItems.length === 0) return null
              return (
                <div key={group}>
                  <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">{group}</div>
                  <ul className="mb-2">
                    {groupItems.map((i) => (
                      <li key={i.id}>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2"
                          onClick={() => onSelect(i)}
                        >
                          {i.icon}
                          <span className="font-medium">{i.label}</span>
                          {i.description && (
                            <span className="ml-2 text-xs text-muted-foreground">{i.description}</span>
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

