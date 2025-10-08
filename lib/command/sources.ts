'use client'

import { Command } from '@/contexts/command-palette'
import { createClient } from '@/lib/supabase/client'

export function staticRoutes(): Command[] {
  return [
    { id: 'nav:dashboard', label: 'Go to Dashboard', group: 'Navigate', href: '/app/dashboard' },
    { id: 'nav:upload', label: 'Upload Files', description: 'Open upload page', group: 'Navigate', href: '/app/upload' },
    { id: 'nav:settings:billing', label: 'Settings · Billing', group: 'Settings', href: '/app/settings/billing' },
  ]
}

export async function recentResults(userId?: string): Promise<Command[]> {
  try {
    if (!userId) return []
    const supabase = createClient()
    const { data, error } = await supabase
      .from('enhancements')
      .select('id, created_at, documents(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8)
    if (error) throw error
    return (data || []).map((row: any) => ({
      id: `result:${row.id}`,
      label: row.documents?.[0]?.name || 'Result',
      description: 'View Results',
      group: 'Recent',
      href: `/app/results/${row.id}`,
    }))
  } catch {
    return []
  }
}

