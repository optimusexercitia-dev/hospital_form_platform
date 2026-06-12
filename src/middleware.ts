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
] as const

// Authenticated users are bounced AWAY from these to home — a logged-in user
// has no business on the login or reset-request screens. `/redefinir-senha` and
// `/convite` are deliberately NOT here: a recovery/invite session IS
// authenticated and must reach the set-password UI.
const AUTHED_REDIRECT_AWAY = ['/login', '/recuperar-senha'] as const

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/auth/')) return true
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
}

export async function middleware(request: NextRequest) {
  // Always refresh the session first; `response` carries any rotated cookies and
  // MUST back every return path (including redirects) or the session is dropped.
  const { response, user } = await updateSession(request)

  const { pathname, search } = request.nextUrl

  // Unauthenticated → only public paths are allowed; otherwise send to /login
  // preserving where they were headed so sign-in can return them there.
  if (!user) {
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
  // Run on every path EXCEPT Next internals, the favicon, and static asset
  // files (matched by a trailing file extension). `/auth/*` and the public auth
  // pages still pass through to their handlers/pages — they are handled inside
  // `middleware` as public, not excluded here.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|map)$).*)',
  ],
}
