import { createServerClient } from '@supabase/ssr'
import type { JwtPayload } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/types/database'

/**
 * Edge-middleware Supabase client + session refresh (`@supabase/ssr` pattern),
 * with LOCAL JWT verification on the request hot path (ADR 0009).
 *
 * Per request it: (1) reads the request cookies; (2) calls `getSession()`, which
 * — via `@supabase/ssr` — refreshes the access token ONLY when it is actually
 * expired (rare; that is the one case that touches GoTrue `/token`, and rotated
 * cookies are written onto BOTH the request and the response); (3) calls
 * `getClaims()`, which verifies the JWT SIGNATURE locally against the cached
 * JWKS (the stack signs with ES256) and validates `exp`. There is NO per-request
 * GoTrue `/user` round trip — that round trip was the cause of the post-login
 * bounce under load: a valid, cookie-present session was intermittently treated
 * as unauthenticated when the `/user` call raced/failed, bouncing the user back
 * to `/login`.
 *
 * Returns the refreshed `response` and the locally-verified `claims` (or `null`)
 * so `middleware.ts` can gate without any auth-server call. Callers that redirect
 * MUST copy this response's cookies onto the redirect (see `middleware.ts`).
 *
 * Uses ONLY the public URL and anon key (Architecture Rule 1) — never the
 * service-role key.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; claims: JwtPayload | null }> {
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

  // getSession() drives the refresh-if-expired behaviour (the only path that may
  // call GoTrue, and only when the token is genuinely expired). We never trust
  // getSession()'s payload for identity — so the @supabase/ssr "insecure session"
  // warning does not apply to how we use it; getClaims() below is the verified
  // authority (local signature + exp check). IMPORTANT: keep getSession→getClaims
  // back-to-back with no intervening code (an unrefreshed session here can log
  // the user out at random, per @supabase/ssr).
  await supabase.auth.getSession()
  const { data } = await supabase.auth.getClaims()

  return { response, claims: data?.claims ?? null }
}
