import { createClient } from '@/lib/supabase/client';
import { UsageTracker } from './tracking-base';

/**
 * Create a usage tracker instance for client components
 */
export function createClientUsageTracker() {
  const supabase = createClient();
  return new UsageTracker(supabase);
}

// Re-export types for convenience
export * from './tracking-base';