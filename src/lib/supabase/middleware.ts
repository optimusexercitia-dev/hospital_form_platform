import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/types/database'

/**
 * Edge-middleware Supabase client + session refresh (`@supabase/ssr` pattern).
 *
 * Runs on every matched request to keep the auth session fresh: it reads the
 * request cookies, calls `getUser()` (which transparently refreshes an expired
 * access token), and writes any rotated cookies onto BOTH the inbound request
 * (so downstream Server Components see them this same request) and the returned
 * `NextResponse` (so the browser receives them). Uses ONLY the public URL and
 * anon key (Architecture Rule 1) — never the service-role key.
 *
 * Returns the refreshed `response` and the validated `user` (or `null`) so
 * `middleware.ts` can apply its coarse auth gate without a second round trip.
 * Callers that issue a redirect MUST copy this response's cookies onto the
 * redirect (see `middleware.ts`), or the refreshed session is dropped.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // IMPORTANT: do not run code between createServerClient and getUser — an
  // unrefreshed session here can log the user out at random (per @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
