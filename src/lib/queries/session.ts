import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { listMyNspHospitals } from '@/lib/queries/pqs'
import type { NspHospitalGrant } from '@/lib/pqs/roster-types'
import { deriveUserStatus, type UserStatus } from '@/lib/users/types'
// The TS mirror of `is_commission_admin_of` (ADR 0051): org_admin-of-org OR
// hospital_admin-of-hospital. access.ts imports ONLY types from this module, so
// this value import is not a runtime cycle (the back-edge is type-only, erased).
import { isCommissionAdmin } from '@/lib/auth/access'

/**
 * Session & membership data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). These functions back the role-aware app shell: the root
 * `/` Server Component resolves the landing area from `getSessionContext()`, the
 * commission layout gates access via `getCommissionAccessByOrg()`, and protected
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

/**
 * A hospital reference carried in the session context for the hospital-admin tier
 * (ADR 0051). `organizationId` lets FE co-locate a hospital under its org for the
 * switcher / deep-link without a second read.
 */
export interface HospitalRef {
  id: string
  slug: string
  name: string
  organizationId: string
}

/**
 * A hospital the caller administers (`hospital_admin`, ADR 0051), independent of any
 * commission membership. Carries the parent org so FE can group hospitals under it.
 */
export interface HospitalAdminMembership {
  organization: OrganizationRef
  hospital: HospitalRef
}

export interface SessionContext {
  userId: string
  email: string
  fullName: string | null
  isAdmin: boolean
  /**
   * Derived account status (BE-6). `active`/`pending` may use the app normally;
   * `suspended`/`deactivated` are gated out by `requireUser()` (→ `/conta-inativa`).
   * Exposed as an EXPLICIT signal — not a bare-null context — so consumers can act
   * on it without conflating "inactive" with "unauthenticated" (which would loop a
   * still-JWT'd inactive user against the login-bounce middleware).
   */
  status: UserStatus
  /** Convenience: `status` is `suspended` or `deactivated`. */
  isInactive: boolean
  /**
   * True when the user must set a new password before using the app — the
   * flag-OFF (admin-set-initial-password) registration path (ADR 0049). Gated by
   * `requireUser()` (→ `/primeiro-acesso`) AFTER the inactive check, so precedence
   * is `inactive` > `must-change` > normal. Cleared by `updatePassword`.
   */
  mustChangePassword: boolean
  /** Sorted by commission.name (pt-BR locale). */
  memberships: Membership[]
  /**
   * Organizations the caller is an `org_admin` of (parallel `organization_members`
   * read). Empty for non-org-admins. Sorted by organization.name (pt-BR locale).
   */
  orgAdminOf: OrgAdminMembership[]
  /**
   * Hospitals the caller is a `hospital_admin` of (ADR 0051; parallel
   * `organization_members` read where `role = 'hospital_admin'`). Empty for
   * non-hospital-admins. Sorted by hospital.name (pt-BR locale). The real read
   * wiring lands in A4/A5; A0 defaults it to `[]`.
   */
  hospitalAdminOf: HospitalAdminMembership[]
  /**
   * Organizations the caller is an `nsp_org_admin` of (ADR 0051; the role row is
   * admitted to the CHECK in Phase A but its BEHAVIOR ships in Phase B — this is
   * the shape-now/inert-now seam). Empty in Phase A.
   */
  nspOrgAdminOf: OrgAdminMembership[]
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
  const [
    profileResult,
    membershipResult,
    orgAdminResult,
    hospitalAdminResult,
    nspOrgAdminResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'full_name, is_active, suspended_until, email_confirmed_at, must_change_password',
      )
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
    // Hospitals the caller is hospital_admin of (ADR 0051). The self-read RLS arm
    // (20260709000500) lets the caller read its OWN grant rows; each carries the
    // org + hospital so `adminedHospitals`/`isHospitalAdmin` resolve without a
    // second hop. hospital_admin rows always have hospital_id set (the iff-CHECK).
    supabase
      .from('organization_members')
      .select(
        'organization:organizations(id, slug, name), hospital:hospitals(id, slug, name, organization_id)',
      )
      .eq('user_id', userId)
      .eq('role', 'hospital_admin'),
    // Orgs the caller is nsp_org_admin of (ADR 0051; inert until Phase B, shape now).
    supabase
      .from('organization_members')
      .select('organization:organizations(id, slug, name)')
      .eq('user_id', userId)
      .eq('role', 'nsp_org_admin'),
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

  // The embedded `hospital` comes back snake_cased (organization_id); map it to
  // the camelCase HospitalRef the SessionContext exposes.
  const hospitalAdminOf: HospitalAdminMembership[] = (
    hospitalAdminResult.data ?? []
  )
    .filter(
      (
        row,
      ): row is {
        organization: OrganizationRef
        hospital: {
          id: string
          slug: string
          name: string
          organization_id: string
        }
      } => row.organization !== null && row.hospital !== null,
    )
    .map((row) => ({
      organization: row.organization,
      hospital: {
        id: row.hospital.id,
        slug: row.hospital.slug,
        name: row.hospital.name,
        organizationId: row.hospital.organization_id,
      },
    }))
    .sort((a, b) => a.hospital.name.localeCompare(b.hospital.name, 'pt-BR'))

  const nspOrgAdminOf: OrgAdminMembership[] = (nspOrgAdminResult.data ?? [])
    .filter(
      (row): row is { organization: OrganizationRef } =>
        row.organization !== null,
    )
    .map((row) => ({ organization: row.organization }))
    .sort((a, b) =>
      a.organization.name.localeCompare(b.organization.name, 'pt-BR'),
    )

  // Derived account status (BE-6). When the profile row is missing (an anomaly —
  // the JWT already authenticated the user), default to `active`: RLS is the real
  // data backstop, and we must not hard-lock a valid session on a read miss.
  // platform_admin is never gated here (their profile is is_active=true anyway).
  const profile = profileResult.data
  const status: UserStatus = profile
    ? deriveUserStatus(
        profile.is_active,
        profile.suspended_until,
        profile.email_confirmed_at,
      )
    : 'active'
  const isInactive = status === 'suspended' || status === 'deactivated'
  // Default false on a profile read miss (same rationale as `status`): never trap
  // a valid session on an anomalous read. The real column defaults false anyway.
  const mustChangePassword = profile?.must_change_password ?? false

  return {
    userId,
    email: typeof claims.email === 'string' ? claims.email : '',
    fullName: profile?.full_name ?? null,
    isAdmin,
    status,
    isInactive,
    mustChangePassword,
    memberships,
    orgAdminOf,
    hospitalAdminOf,
    nspOrgAdminOf,
  }
}

/**
 * Returns the session context, redirecting to `/login` when unauthenticated, to
 * `/conta-inativa` when the account is suspended/deactivated (BE-6), and to
 * `/primeiro-acesso` when the user must rotate an admin-set initial password
 * (ADR 0049; checked AFTER inactive, so precedence is inactive > must-change).
 * For protected Server Components that need the user but not a specific commission.
 * Middleware is the coarse gate; this is the defensive server-side check for
 * components rendered behind it — and, for a user deactivated/suspended
 * MID-SESSION (still holding a valid JWT), the effective lock-out point on any
 * page render (RLS remains the data backstop; ADR 0009 ≤~1h JWT residual).
 */
export async function requireUser(): Promise<SessionContext> {
  const context = await getSessionContext()
  if (!context) {
    redirect('/login')
  }
  if (context.isInactive) {
    redirect('/conta-inativa')
  }
  // Precedence: inactive > must-change > normal. A user on the admin-set-initial-
  // password path (ADR 0049) is pulled to /primeiro-acesso until they rotate it.
  // The page itself reads getSessionContext() (not requireUser) to avoid a loop.
  if (context.mustChangePassword) {
    redirect('/primeiro-acesso')
  }
  return context
}

/**
 * Org-aware commission resolution for the `/o/[org]/c/[commission]` routes
 * (multi-tenancy). Resolves the organization by `orgSlug`, then the
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
 * This is the canonical commission-access resolver.
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
  // `hospital_id` is selected so the commission-admin mirror can resolve a
  // hospital_admin of THIS commission's hospital (ADR 0051 Decision 1; BUG-HAT-002).
  const { data: commissionRow } = await supabase
    .from('commissions')
    .select(
      'id, name, slug, hospital_id, organization:organizations!inner(id, slug, name)',
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

  // Member role first; else a COMMISSION-ADMIN of this commission (org_admin of
  // its org OR hospital_admin of its hospital — ADR 0051 Decision 1) maps to the
  // coordinator (staff_admin) branch; else null (platform admin without a held
  // role). BUG-HAT-002: the prior org_admin-only check 404'd a hospital_admin on
  // every `/o/[org]/c/[commission]/manage/**` page. The hospital_admin mirrors
  // org_admin here, so 'staff_admin'-equivalent is correct — no downstream page
  // distinguishes the two (same as org_admin already resolves). RLS is the real
  // authority; this TS seam only gates the notFound()/coordinator-UI branch.
  const memberRole =
    context.memberships.find((m) => m.commission.id === commission.id)?.role ??
    null
  const isCommAdmin = isCommissionAdmin(context, {
    organizationId: organization.id,
    hospitalId: commissionRow.hospital_id,
  })
  const role: CommissionRole | null =
    memberRole ?? (isCommAdmin ? 'staff_admin' : null)

  return { context, organization, commission, role }
}

/**
 * The NSP-console access resolver (NSP-per-hospital, ADR 0052) — the seam behind
 * `/o/[org]/nsp/**`, mirroring {@link getCommissionAccessByOrg}. Resolves the org by
 * slug (RLS-scoped: the `organizations_select` policy admits an enrolled `pqs_member`
 * / `nsp_coordinator` of any hospital in the org) and reports ORG-LEVEL NSP standing
 * plus the per-hospital operator grants that drive the hospital switcher (B6):
 *
 *   - `hospitals`     — the hospitals of THIS org whose NSP the caller operates
 *                       (enrolled member OR coordinator), from {@link listMyNspHospitals}
 *                       filtered to `orgId`. The switcher + the default-hospital pick.
 *   - `isCoordinator` — the caller coordinates ≥1 hospital in this org (curation nav).
 *   - `isPqsMember`   — the caller operates (member OR coordinator) ≥1 hospital in this
 *                       org (PHI nav lights up; per-hospital reads are re-gated at the
 *                       data doors, which resolve the specific hospital).
 *
 * Returns `null` when the caller operates NO hospital in this org (no NSP standing →
 * 404). A platform admin without enrollment gets `null` (duty separation — admin
 * standing is not NSP standing). The specific hospital view is gated per-hospital by
 * the data doors + the B6 `?hospital=` resolver against `hospitals` below.
 */
export const getNspAccessByOrg = cache(
  async (
    orgSlug: string,
  ): Promise<{
    context: SessionContext
    organization: OrganizationRef
    orgId: string
    isPqsMember: boolean
    isCoordinator: boolean
    hospitals: NspHospitalGrant[]
  } | null> => {
    return getNspAccessByOrgUncached(orgSlug)
  },
)

async function getNspAccessByOrgUncached(orgSlug: string): Promise<{
  context: SessionContext
  organization: OrganizationRef
  orgId: string
  isPqsMember: boolean
  isCoordinator: boolean
  hospitals: NspHospitalGrant[]
} | null> {
  const context = await getSessionContext()
  if (!context) {
    return null
  }

  const supabase = await createClient()

  // Resolve the org by slug. RLS (`organizations_select`) returns the row for a
  // platform admin, an org_admin/member, OR an enrolled PQS member/coordinator of any
  // hospital in this org. A foreign org's slug yields no row → null.
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('id, slug, name')
    .eq('slug', orgSlug)
    .maybeSingle()
    .returns<OrganizationRef | null>()

  if (!orgRow) {
    return null
  }

  // The caller's operator hospitals, filtered to THIS org. Per-hospital PHI reads are
  // re-gated at the data doors; this only decides console entry + the switcher set.
  const hospitals = (await listMyNspHospitals()).filter(
    (h) => h.orgId === orgRow.id,
  )

  // No NSP standing in any hospital of this org → no console access.
  if (hospitals.length === 0) {
    return null
  }

  const isCoordinator = hospitals.some((h) => h.role === 'coordinator')

  return {
    context,
    organization: orgRow,
    orgId: orgRow.id,
    isPqsMember: true, // operates ≥1 hospital → PHI nav lights up (per-hospital re-gated)
    isCoordinator,
    hospitals,
  }
}
