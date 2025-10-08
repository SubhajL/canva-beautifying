// Lightweight query protection shim for tests and local dev.
// In production, this can be extended to enforce row limits, timeouts, etc.
// For now, it simply returns the provided client unchanged.

// Use a loose type to avoid importing Supabase types at test time
type AnyClient = any

export function applyQueryProtection<T = unknown>(
  client: AnyClient,
  _options?: {
    bypassProtectionForTables?: string[]
  }
) {
  return client as AnyClient
}

