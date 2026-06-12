import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'

/**
 * Service-role Supabase client — bypasses RLS. Used ONLY by server code that
 * genuinely needs to act across users (Architecture Rule 1): looking up an
 * existing user by email and inviting a new one (`auth.admin.*`), and writing
 * membership rows on behalf of a freshly-invited profile.
 *
 * `import 'server-only'` (first line) makes importing this module from a Client
 * Component a build-time error, so the service-role key can never be bundled
 * into client JS — a service-role key reaching the browser is a phase-blocking
 * bug. Authorization for callers is the EXPLICIT server-side role check in each
 * server action (this client bypasses RLS, so RLS is not the authority here).
 *
 * No session is persisted or refreshed: this client never participates in the
 * user's cookie-based session — it is a standalone elevated connection.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  )
}
