import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/types/database'

/**
 * Browser-side Supabase client (Client Components).
 *
 * Uses ONLY the public URL and anon/publishable key, both of which are safe to
 * ship to the browser (Architecture Rule 1). The service-role key must never be
 * referenced here — doing so is a phase-blocking bug.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
