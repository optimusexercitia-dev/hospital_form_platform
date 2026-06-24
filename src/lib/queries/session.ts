import { cache } from 'react'
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

/** Minimal organization reference carried alongside a commission (multi-tenancy). */
export interface OrganizationRef {
  id: string
  slug: string
  name: string
}

export interface Membership {
  /**
   * The commission, now nested under its organization (multi-tenancy Phase A).
   * `organization` is the parent org resolved via `commissions.organization_id`.
   */
  commission: { id: string; name: string; slug: string; organization: OrganizationRef }
  role: CommissionRole
}

/** An org the caller administers (org_admin), independent of any commission membership. */
export interface OrgAdminMembership {
  organization: OrganizationRef
}

export interface SessionContext {
  userId: string
  email: string
  fullName: string | null
  isAdmin: boolean
  /** Sorted by commission.name (pt-BR locale). */
  memberships: Membership[]
  /**
   * Organizations the caller is an `org_admin` of (parallel `organization_members`
   * read). Empty for non-org-admins. Sorted by organization.name (pt-BR locale).
   */
  orgAdminOf: OrgAdminMembership[]
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
  const [profileResult, membershipResult, orgAdminResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle(),
    // The nested `organization:organizations(...)` select resolves the parent org
    // via commissions.organization_id (denormalized, multi-tenancy Phase A).
    supabase
      .from('commission_members')
      .select(
        'role, commission:commissions(id, name, slug, organization:organizations(id, slug, name))',
      )
      .eq('user_id', userId),
    // Orgs the caller is org_admin of (parallel read; RLS-scoped to own orgs).
    supabase
      .from('organization_members')
      .select('organization:organizations(id, slug, name)')
      .eq('user_id', userId)
      .eq('role', 'org_admin'),
  ])

  const memberships: Membership[] = (membershipResult.data ?? [])
    .filter(
      (
        row,
      ): row is {
        role: CommissionRole
        commission: {
          id: string
          name: string
          slug: string
          organization: OrganizationRef
        }
      } =>
        row.commission !== null &&
        (row.commission as { organization: OrganizationRef | null })
          .organization !== null &&
        (row.role === 'staff' || row.role === 'staff_admin'),
    )
    .map((row) => ({ commission: row.commission, role: row.role }))
    .sort((a, b) =>
      a.commission.name.localeCompare(b.commission.name, 'pt-BR'),
    )

  const orgAdminOf: OrgAdminMembership[] = (orgAdminResult.data ?? [])
    .filter(
      (row): row is { organization: OrganizationRef } =>
        row.organization !== null,
    )
    .map((row) => ({ organization: row.organization }))
    .sort((a, b) =>
      a.organization.name.localeCompare(b.organization.name, 'pt-BR'),
    )

  return {
    userId,
    email: typeof claims.email === 'string' ? claims.email : '',
    fullName: profileResult.data?.full_name ?? null,
    isAdmin,
    memberships,
    orgAdminOf,
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
export const getCommissionAccess = cache(
  async (
    slug: string,
  ): Promise<{
    context: SessionContext
    commission: { id: string; name: string; slug: string }
    role: CommissionRole | null
  } | null> => {
    return getCommissionAccessUncached(slug)
  },
)

async function getCommissionAccessUncached(slug: string): Promise<{
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

/**
 * Org-aware commission resolution for the `/o/[org]/c/[commission]` routes
 * (multi-tenancy Phase A). Resolves the organization by `orgSlug`, then the
 * commission by `(organization_id, slug)` — the commission slug is unique only
 * PER ORG now, so the org scope is required.
 *
 * Returns `null` (caller renders `notFound()`, leaking nothing) when:
 *   - the org slug does not exist or is not visible to the caller, OR
 *   - the commission slug does not exist within that org, OR
 *   - the caller is neither a member of the commission, an org_admin of its org,
 *     nor a platform admin.
 *
 * `role` is the caller's effective coordinator-or-staff role in this commission:
 *   - their `commission_members` role when they are a member, ELSE
 *   - `'staff_admin'` when they are an org_admin of the commission's org (the
 *     org_admin → coordinator branch — an org_admin has coordinator authority
 *     over every commission in their org without an explicit membership row), ELSE
 *   - `null` for a platform admin viewing a commission they don't otherwise hold.
 *
 * This is the canonical end-state resolver. The legacy single-arg
 * `getCommissionAccess(slug)` above stays until Phase D cuts every `/c/[slug]`
 * caller over to this function and removes it.
 */
export const getCommissionAccessByOrg = cache(
  async (
    orgSlug: string,
    commissionSlug: string,
  ): Promise<{
    context: SessionContext
    organization: OrganizationRef
    commission: { id: string; name: string; slug: string }
    role: CommissionRole | null
  } | null> => {
    return getCommissionAccessByOrgUncached(orgSlug, commissionSlug)
  },
)

async function getCommissionAccessByOrgUncached(
  orgSlug: string,
  commissionSlug: string,
): Promise<{
  context: SessionContext
  organization: OrganizationRef
  commission: { id: string; name: string; slug: string }
  role: CommissionRole | null
} | null> {
  const context = await getSessionContext()
  if (!context) {
    return null
  }

  const supabase = await createClient()

  // Resolve the org first. RLS (`organizations_select`) returns a row only for
  // platform admins and org_admins; a plain commission member does NOT read the
  // org directly here. We therefore resolve the commission by org SLUG joined to
  // its organization, scoping on the org's slug — the commission SELECT policy
  // (member or admin) is the access authority, and the nested org comes back via
  // the denormalized FK regardless of the org-table policy.
  const { data: commissionRow } = await supabase
    .from('commissions')
    .select(
      'id, name, slug, organization:organizations!inner(id, slug, name)',
    )
    .eq('slug', commissionSlug)
    .eq('organization.slug', orgSlug)
    .maybeSingle()

  if (!commissionRow || commissionRow.organization === null) {
    return null
  }

  const organization = commissionRow.organization as OrganizationRef
  const commission = {
    id: commissionRow.id,
    name: commissionRow.name,
    slug: commissionRow.slug,
  }

  // Member role first; else org_admin-of-this-org maps to the coordinator
  // (staff_admin) branch; else null (platform admin without a held role).
  const memberRole =
    context.memberships.find((m) => m.commission.id === commission.id)?.role ??
    null
  const isOrgAdmin = context.orgAdminOf.some(
    (o) => o.organization.id === organization.id,
  )
  const role: CommissionRole | null =
    memberRole ?? (isOrgAdmin ? 'staff_admin' : null)

  return { context, organization, commission, role }
}
