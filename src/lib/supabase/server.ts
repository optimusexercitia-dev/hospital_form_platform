import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/types/database'

/**
 * Server-side Supabase client (Server Components, Route Handlers, Server
 * Actions, and middleware-adjacent code).
 *
 * Wired to Next.js's request-scoped cookie store so Supabase Auth sessions are
 * read and refreshed server-side via `@supabase/ssr`. Uses ONLY the public URL
 * and anon/publishable key (Architecture Rule 1) — never the service-role key.
 * Server route handlers that legitimately need to bypass RLS construct their
 * own elevated client separately and never expose it to the browser.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // `setAll` was called from a Server Component, where mutating
            // cookies is not allowed. This can be ignored when middleware
            // refreshes the session — it will write the updated cookies.
          }
        },
      },
    },
  )
}
