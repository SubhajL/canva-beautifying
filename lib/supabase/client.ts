import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { applyQueryProtection } from '@/lib/database/protected-client'

export function createClient() {
  const supabaseClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Apply query protection
  return applyQueryProtection(supabaseClient, {
    // Allow bypassing protection for system tables that may need larger queries
    bypassProtectionForTables: ['rpc', 'storage.objects'],
  })
}