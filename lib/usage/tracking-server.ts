import { createClient } from '@/lib/supabase/server';
import { UsageTracker } from './tracking-base';

/**
 * Create a usage tracker instance for server components
 */
export async function createUsageTracker() {
  const supabase = await createClient();
  return new UsageTracker(supabase);
}

// Re-export types for convenience
export * from './tracking-base';