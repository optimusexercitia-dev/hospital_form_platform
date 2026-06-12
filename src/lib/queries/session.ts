import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Session & membership data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). These functions back the role-aware app shell: the root
 * `/` Server Component resolves the landing area from `getSessionContext()`, the
 * commission layout gates access via `getCommissionAccess()`, and protected
 * Server Components call `requireUser()`.
 *
 * Identity is established by LOCAL JWT verification (`getClaims()` — signature
 * vs cached JWKS + `exp`), not a per-request `getUser()` GoTrue round trip
 * (ADR 0009): the round trip raced/failed under load and bounced authenticated
 * users to `/login`. `userId`, `email`, and `is_admin` come from the verified
 * claims (`is_admin` is injected by the custom access token hook, ADR 0002);
 * deriving it from the claim means admin UI fails CLOSED if the hook is ever
 * absent. `full_name` and memberships are RLS-scoped DB reads (PostgREST
 * validates the JWT locally too — no GoTrue call). The SQL `app.is_admin()`
 * helper keeps its DB fallback as defense-in-depth at the RLS layer.
 */

export type CommissionRole = 'staff' | 'staff_admin'

export interface Membership {
  commission: { id: string; name: string; slug: string }
  role: CommissionRole
}

export interface SessionContext {
  userId: string
  email: string
  fullName: string | null
  isAdmin: boolean
  /** Sorted by commission.name (pt-BR locale). */
  memberships: Membership[]
}

/**
 * The authenticated user's full session context, or `null` when unauthenticated.
 * One round trip resolves the profile and memberships (joined to commissions).
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient()

  // getSession() drives refresh-if-expired (only path that may touch GoTrue, and
  // only when the token is genuinely expired); getClaims() locally verifies the
  // JWT signature + exp and is the identity authority. We never trust
  // getSession()'s payload, so the @supabase/ssr "insecure" warning is moot here.
  await supabase.auth.getSession()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  if (!claims?.sub) {
    return null
  }

  const userId = claims.sub
  // `is_admin` strictly from the verified claim (ADR 0002 / 0009) — fails closed
  // (treated as non-admin) if the access-token hook is ever absent.
  const isAdmin = claims.is_admin === true

  // full_name + memberships in two RLS-scoped DB reads (PostgREST verifies the
  // JWT locally — no GoTrue call). `profiles` is readable for self;
  // `commission_members` is joined to `commissions` and filtered to the caller.
  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('commission_members')
      .select('role, commission:commissions(id, name, slug)')
      .eq('user_id', userId),
  ])

  const memberships: Membership[] = (membershipResult.data ?? [])
    .filter(
      (
        row,
      ): row is {
        role: CommissionRole
        commission: { id: string; name: string; slug: string }
      } =>
        row.commission !== null &&
        (row.role === 'staff' || row.role === 'staff_admin'),
    )
    .map((row) => ({ commission: row.commission, role: row.role }))
    .sort((a, b) =>
      a.commission.name.localeCompare(b.commission.name, 'pt-BR'),
    )

  return {
    userId,
    email: typeof claims.email === 'string' ? claims.email : '',
    fullName: profileResult.data?.full_name ?? null,
    isAdmin,
    memberships,
  }
}

/**
 * Returns the session context, redirecting to `/login` when unauthenticated.
 * For protected Server Components that need the user but not a specific
 * commission. Middleware is the coarse gate; this is the defensive server-side
 * check for components rendered behind it.
 */
export async function requireUser(): Promise<SessionContext> {
  const context = await getSessionContext()
  if (!context) {
    redirect('/login')
  }
  return context
}

/**
 * Resolves a commission the current user may access by slug.
 *
 * Returns `null` when the slug does not exist OR the user is neither a member
 * nor an admin — RLS makes a foreign/unknown commission indistinguishable
 * (the SELECT simply returns no row), so callers render `notFound()` (404) for
 * both, leaking nothing about which commissions exist.
 *
 * `role` is the caller's role in the commission, or `null` for an admin viewing
 * a commission they are not a member of (admins read every commission via RLS
 * but have no membership row).
 */
export async function getCommissionAccess(slug: string): Promise<{
  context: SessionContext
  commission: { id: string; name: string; slug: string }
  role: CommissionRole | null
} | null> {
  const context = await getSessionContext()
  if (!context) {
    return null
  }

  const supabase = await createClient()

  // RLS (`commissions_select_member_or_admin`) returns a row only for members
  // and admins; non-members get no row → null → notFound() upstream.
  const { data: commission } = await supabase
    .from('commissions')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!commission) {
    return null
  }

  const role =
    context.memberships.find((m) => m.commission.id === commission.id)?.role ??
    null

  return { context, commission, role }
}
