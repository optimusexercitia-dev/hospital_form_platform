import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * Session & membership data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). These functions back the role-aware app shell: the root
 * `/` Server Component resolves the landing area from `getSessionContext()`, the
 * commission layout gates access via `getCommissionAccess()`, and protected
 * Server Components call `requireUser()`.
 *
 * Identity is always established from the Auth server (`getUser()`), never from
 * the cookie-stored session alone — `@supabase/ssr` cannot vouch for unverified
 * cookies. `is_admin` and memberships are read from the database (the source of
 * truth per ADR 0002), not from the JWT, so correctness never depends on the
 * access-token hook being configured. RLS scopes every read to the caller.
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

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return null
  }

  // Profile (is_admin, full_name) + memberships with their commission, in two
  // RLS-scoped reads. `profiles` is readable for self; `commission_members` is
  // joined to `commissions` and filtered to the current user.
  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, is_admin')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('commission_members')
      .select('role, commission:commissions(id, name, slug)')
      .eq('user_id', user.id),
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
    userId: user.id,
    email: user.email ?? '',
    fullName: profileResult.data?.full_name ?? null,
    isAdmin: profileResult.data?.is_admin ?? false,
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
