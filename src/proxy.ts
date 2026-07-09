import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

/**
 * Coarse auth gate + session refresh (Phase 2). This is intentionally NOT the
 * role-landing authority: it only refreshes the Supabase session and enforces
 * the authenticated/unauthenticated boundary. The role-aware landing
 * (admin → /admin, single membership → /c/[slug], multi → picker, none →
 * no-access) is resolved in the root `/` Server Component via
 * `getSessionContext()`, keeping per-request DB load out of the edge.
 */

// Public paths reachable WITHOUT a session. Everything else (including `/`)
// requires auth. `/auth/*` route handlers (e.g. /auth/confirm) are public so
// recovery/invite links can verify their OTP before a session exists.
const PUBLIC_PATHS = [
  '/login',
  '/recuperar-senha',
  '/redefinir-senha',
  '/convite',
  // Inactive-account notice. Reachable both with a still-valid JWT (a user
  // deactivated/suspended mid-session, before their token expires) and after the
  // page's sign-out clears the session — so it must be public AND excluded from
  // AUTHED_REDIRECT_AWAY below (the anti-loop fix; see requireUser + BE-6).
  '/conta-inativa',
] as const

// Authenticated users are bounced AWAY from these to home — a logged-in user
// has no business on the login or reset-request screens. `/redefinir-senha` and
// `/convite` are deliberately NOT here: a recovery/invite session IS
// authenticated and must reach the set-password UI. `/conta-inativa` is NOT here
// either: an inactive user still holds a valid JWT, so bouncing them to `/` would
// loop them straight back here via requireUser — they must be allowed to stay.
const AUTHED_REDIRECT_AWAY = ['/login', '/recuperar-senha'] as const

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/auth/')) return true
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export async function proxy(request: NextRequest) {
  // Always refresh the session first; `response` carries any rotated cookies and
  // MUST back every return path (including redirects) or the session is dropped.
  // `claims` is the LOCALLY-verified JWT payload (ADR 0009) — null = no valid,
  // unexpired, correctly-signed session; no GoTrue round trip on the hot path.
  const { response, claims } = await updateSession(request)

  const { pathname, search } = request.nextUrl

  // Unauthenticated → only public paths are allowed; otherwise send to /login
  // preserving where they were headed so sign-in can return them there.
  if (!claims) {
    if (isPublicPath(pathname)) {
      return response
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('redirect', `${pathname}${search}`)
    return redirectPreservingCookies(loginUrl, response)
  }

  // Authenticated → keep them out of the login / reset-request screens.
  if (AUTHED_REDIRECT_AWAY.some((p) => pathname === p)) {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    return redirectPreservingCookies(homeUrl, response)
  }

  return response
}

/**
 * Build a redirect that retains the refreshed auth cookies from `source`.
 * `NextResponse.redirect` starts with empty cookies, so we copy them over —
 * dropping them would log the user out on the very next request.
 */
function redirectPreservingCookies(
  url: URL,
  source: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url)
  for (const cookie of source.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}

export const config = {
  // Run on every path EXCEPT Next internals, the favicon, static asset files
  // (matched by a trailing file extension), and the orchestrator liveness probe
  // `/api/health` (must return 200 to Coolify/Docker WITHOUT a session, so it is
  // excluded from the gate entirely — see src/app/api/health/route.ts). `/auth/*`
  // and the public auth pages still pass through to their handlers/pages — they
  // are handled inside `proxy` as public, not excluded here.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|map)$).*)',
  ],
}
