import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { listMyNspHospitals } from '@/lib/queries/pqs'
import { featureEnabled } from '@/lib/queries/feature-flags'
import type { MemberCapability } from '@/lib/queries/members'
import type { NspHospitalGrant } from '@/lib/pqs/roster-types'
import { deriveUserStatus, type UserStatus } from '@/lib/users/types'
// The pure role partition (FUP-QO-2). Value import; the back-edge from
// session-grants.ts is type-only and therefore erased — no runtime cycle.
import {
  partitionGrants,
  type SessionGrant,
} from '@/lib/queries/session-grants'
// The TS mirror of `is_tenancy_admin_of` (ADR 0051): org_admin-of-org OR
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

/**
 * A hospital whose TECHNICAL DIRECTION the caller holds (ADR 0094 W4) — either as
 * the titular Diretor Técnico or as a substituto.
 *
 * ⚠ `role` is carried for display only. By decision D1 a deputy holds the SAME
 * authority as the titular (a substituto who cannot decide is decorative, and a
 * referral would stall whenever the titular was away), so NOTHING may be gated on
 * this field — every DB predicate admits both. It exists so a screen can say which
 * hat the reader is wearing, not to withhold anything from a deputy.
 */
export interface TechnicalDirectionMembership {
  organization: OrganizationRef
  hospital: HospitalRef
  role: 'technical_director' | 'technical_director_deputy'
}

/**
 * A hospital whose quality office the caller reviews for (ADR 0100 D1,
 * `quality_reviewer`) — hospital-scoped, one entry per reviewed hospital.
 *
 * ⚠ STRICTLY READ-ONLY standing (D7): nothing may map this to a member role.
 * The reviewer reaches committee content through the DB's S7 arm
 * (`app._case_caps`) on oversight-VISIBLE commissions only; this list exists so
 * the shell can route `/o/[org]/qualidade` and flag the read-only case view —
 * never to open a write affordance.
 */
export interface QualityReviewMembership {
  organization: OrganizationRef
  hospital: HospitalRef
}

/**
 * A hospital whose NSP (Núcleo de Segurança do Paciente) the caller OPERATES —
 * an enrolled `pqs_member` or an appointed `nsp_coordinator` (NSP-per-hospital,
 * ADR 0052). Both roles are hospital-scoped with `commission_id NULL`.
 *
 * ⚠ `role` is carried for DISPLAY ONLY and nothing may be gated on it here. The
 * console-entry gate is `getNspAccessByOrg` → `list_my_nsp_hospitals()`, and every
 * PHI read is re-gated per hospital at its own DEFINER door (Rule 12). This list
 * exists so the shell can ROUTE the operator; it confers nothing.
 *
 * FUP-QO-2 (F7): added because a principal holding ONLY one of these two roles had
 * no `SessionContext` field at all, so every branch in `src/app/page.tsx` stepped
 * over them and they landed on "sem acesso" — instances four and five of that class.
 */
export interface NspOperatorMembership {
  organization: OrganizationRef
  hospital: HospitalRef
  role: 'pqs_member' | 'nsp_coordinator'
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
   * Hospitals whose technical direction the caller holds (ADR 0094 W4) — titular OR
   * deputy, undifferentiated in authority (D1). Empty for everyone else. This is the
   * ONLY standing a Diretor Técnico has: the office confers no commission membership,
   * so without this the shell has no way to route them anywhere.
   */
  technicalDirectionOf: TechnicalDirectionMembership[]
  /**
   * Organizations the caller is an `nsp_org_admin` of (ADR 0051; the role row is
   * admitted to the CHECK in Phase A but its BEHAVIOR ships in Phase B — this is
   * the shape-now/inert-now seam). Empty in Phase A.
   */
  nspOrgAdminOf: OrgAdminMembership[]
  /**
   * Hospitals whose quality office the caller reviews for (ADR 0100,
   * `quality_reviewer`). Empty for everyone else. Like the technical direction,
   * this office confers no commission membership — without this list the shell
   * cannot route the reviewer anywhere (FUP-QO-2 is exactly that failure).
   */
  qualityReviewerOf: QualityReviewMembership[]
  /**
   * Hospitals whose NSP the caller operates — `pqs_member` OR `nsp_coordinator`
   * (ADR 0052). Empty for everyone else. Like the technical direction and the
   * quality office, these confer no commission membership; without this list the
   * shell has no way to route the operator (FUP-QO-2 instances four and five).
   */
  nspOperatorOf: NspOperatorMembership[]
  /**
   * ACT (ADR 0106 D12) — the caller's active hat, read from the SAME verified
   * `active_role` JWT claim `app.active_role()` reads server-side (minted by
   * `custom_access_token_hook`; a `public.platform_role` value, or `null` for
   * a hatless multi-role session, D5). `null` for every pre-cutover-shaped
   * session too, by construction — the claim is simply absent.
   */
  activeRole: string | null
  /**
   * ACT (ADR 0106 D5/D7) — true when this session has NO active hat AND the
   * caller's hat-blind grants (the SAME `memberships` union `grants` already
   * used to fill the fields above) span more than one distinct role TYPE
   * (D2: the unit is the role type, not the membership row). The picker gate
   * (`src/app/page.tsx`, per the Stage 3 destination-sweep design note) reads
   * this to redirect to `/selecionar-perfil` before any of the role-precedence
   * branches below run. A single-role hatless session (D11 break-glass covers
   * everyone with exactly one type) is never true here — the hook already gave
   * it a claim, so `activeRole` above is non-null and this is false.
   */
  needsRoleSelection: boolean
}

/**
 * The authenticated user's full session context, or `null` when unauthenticated.
 * One round trip resolves the profile and memberships (joined to commissions).
 */
// WS-5 P1: React `cache()`-wrapped so a single render tree resolves the session
// context ONCE (deduped across Server Components) instead of re-running the profile +
// 3-way membership reads per call. Mirrors the already-cached siblings below
// (getCommissionAccessByOrg / getNspAccessByOrg), which call this internally.
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
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

  // ACT (ADR 0106 D12) — the verified claim, same source app.active_role() reads.
  // Computed early: both `isAdmin` below and the grant partition further down
  // depend on it.
  const activeRole =
    typeof claims.active_role === 'string' ? claims.active_role : null

  // `is_admin` strictly from the verified claim (ADR 0002 / 0009) — fails closed
  // (treated as non-admin) if the access-token hook is ever absent.
  //
  // ACT (ADR 0106 D11) P0 follow-up: ALSO requires the platform_admin hat to
  // be ACTIVE — the identical condition `app.is_admin()` gained at the DB
  // layer (migration `20260918002200`). Found auditing THIS field's ~23 TS
  // consumers (`src/lib/{admin,platform,users,org,cases,forms,meetings,
  // interviews,responses,case-*}/actions.ts`) while investigating
  // BUG-ACT-HATBLIND-001: nearly every one uses the same
  // `if (context.isAdmin) return true` short-circuit shape BEFORE a
  // role-scoped check, and at least two (`src/lib/admin/actions.ts`,
  // `src/lib/users/actions.ts`) run their mutation on the SERVICE-ROLE
  // client, which bypasses RLS entirely — both say so explicitly in their own
  // SECURITY comments. For those, this TS field is the ONLY authority; a
  // hat-blind `isAdmin` here would have reproduced the exact same fail-open
  // class with NO RLS backstop underneath at all (worse than the tester's
  // original finding, where `app.is_admin()`'s own D11 gate still denied the
  // read one layer down). Provably a no-op today by the SAME argument as
  // `is_admin()`'s: zero platform_admins hold any membership
  // (`315_act_stage3_hat_condition.sql`'s TRIPWIRE), so `claims.is_admin`
  // and `activeRole === 'platform_admin'` can never actually diverge yet.
  const isAdmin = claims.is_admin === true && activeRole === 'platform_admin'

  // ADR 0094 W2/T2.2 — ONE RLS-scoped round trip (PostgREST verifies the JWT
  // locally; no GoTrue call). `public.session_context()` replaces the former five
  // reads (one `profiles` + four separately-filtered `memberships` reads).
  //
  // This is an internal re-plumb: the exported `SessionContext` shape is unchanged,
  // and so is the derivation below. What moved into SQL is the definition of an
  // EFFECTIVE grant — specifically the expiry filter
  // (`expires_at is null or expires_at > now()`), which `app.has_role_any` has always
  // applied and this TypeScript never did. Before W2 an expired membership rendered
  // a commission in the shell that every DB predicate then denied.
  //
  // The RPC is GENERIC OVER ROLES — it returns every grant with its scope references
  // and lets the caller partition. Adding a role no longer means adding a query here;
  // it means adding a filter below (or not, if the shell does not surface it).
  const { data: ctxData } = await supabase.rpc('session_context')

  // The RPC's return type is `Json`; this is its documented shape (see the migration
  // 20260905000200 header). Narrowed once, here, rather than at each use.
  // ⭐ FUP-QO-2: the `SessionGrant` shape and the role partition below it moved to
  // `./session-grants` — a PURE module with no server imports — so the catalog-derived
  // role-to-landing guard can run the REAL derivation instead of a re-implementation.
  const ctx = ctxData as {
    profile: {
      full_name: string | null
      is_active: boolean
      suspended_until: string | null
      email_confirmed_at: string | null
      must_change_password: boolean
    } | null
    grants: SessionGrant[]
  } | null

  const grants: SessionGrant[] = ctx?.grants ?? []

  // ⛔ P0 FIX (BUG-ACT-HATBLIND-001, found live by `tester` — a dual-hat
  // `quality_reviewer` reached the full `/manage` org-admin console, and vice
  // versa). `session_context()` is a DESIGNED hat-blind door (ADR 0106 D9: the
  // picker and the "other hats held" hint both need the caller's FULL grant
  // union, unfiltered) — but that hat-blindness was never meant to propagate
  // past it. Every downstream consumer of the derived lists below is an ACCESS
  // DECISION, not a display list: `orgAdminOf`/`hospitalAdminOf` gate `/manage`
  // and (via `isCommissionAdmin`, `src/lib/auth/access.ts`) the commission
  // area's tenancy-admin escalation; `technicalDirectionOf` gates
  // `/direcao-tecnica`; `nspOrgAdminOf` gates `/nsp-org`'s primary check;
  // `qualityReviewerOf` gates `/qualidade` and the commission area's reviewer
  // branch; `memberships` gates the commission area's member branch. Every one
  // of them, PLUS `src/app/page.tsx`'s own landing-precedence branch chain
  // (same fields), reads `getSessionContext()`'s output, never the raw grants —
  // so filtering ONCE, HERE, to rows matching the caller's ACTIVE hat is the
  // single seam that makes all of them correct at once, without editing any of
  // their call sites.
  //
  // No active hat -> every derived list is empty (D5: a hatless session is a
  // stranger to every hat-aware door). This is intentionally the SAME rule
  // `needsRoleSelection` (below) already encodes for the picker redirect in
  // `page.tsx`, which runs BEFORE any of these lists are consulted for a
  // genuinely hatless multi-role session; a hatless SINGLE-role-type session
  // cannot reach here with empty lists at all — D11's implicit derivation means
  // the hook already minted a claim for it.
  //
  // The raw, UNFILTERED `grants` stays reachable via `getRawGrants()` (below) —
  // the single, explicitly-named hat-blind path, used ONLY by the picker
  // (`/selecionar-perfil`) and the D9 "other hats held" hint
  // (`src/components/role/*`). Enumerated: `docs/plans/act-as-buildnotes.md`.
  const hatFilteredGrants: SessionGrant[] =
    activeRole === null ? [] : grants.filter((g) => g.role === activeRole)

  // ⭐ FUP-QO-2 — the ROLE PARTITION, now in `./session-grants`. It is the FIRST of
  // two seams a new role must cross before its holder lands anywhere (the second is
  // `src/app/page.tsx`'s branch chain), and it has been missed three times: a role
  // with no filter here produces an all-empty context, which every branch in
  // `page.tsx` steps over. `session-grants.test.ts` enumerates the vocabulary from
  // `memberships_role_check` in the LIVE CATALOG and drives this exact function, so a
  // role added to the CHECK with no home reds the suite instead of the user.
  const {
    memberships,
    orgAdminOf,
    hospitalAdminOf,
    technicalDirectionOf,
    nspOrgAdminOf,
    qualityReviewerOf,
    nspOperatorOf,
  } = partitionGrants(hatFilteredGrants)

  // Derived account status (BE-6). When the profile row is missing (an anomaly —
  // the JWT already authenticated the user), default to `active`: RLS is the real
  // data backstop, and we must not hard-lock a valid session on a read miss.
  // platform_admin is never gated here (their profile is is_active=true anyway).
  const profile = ctx?.profile ?? null
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

  // D2: collapse the hat-blind grants to distinct role TYPES — the picker's own
  // unit — using the SAME `grants` read every field above already partitions,
  // no second query. `needsRoleSelection` is true only for a hatless session
  // whose grants span more than one type (D11's implicit single-role derive
  // means a hatless single-type session cannot occur: the hook already gave it
  // a claim).
  const distinctRoleTypes = new Set(grants.map((g) => g.role))
  const needsRoleSelection = activeRole === null && distinctRoleTypes.size > 1

  return {
    userId,
    email: typeof claims.email === 'string' ? claims.email : '',
    fullName: profile?.full_name ?? null,
    activeRole,
    needsRoleSelection,
    isAdmin,
    status,
    isInactive,
    mustChangePassword,
    memberships,
    orgAdminOf,
    hospitalAdminOf,
    technicalDirectionOf,
    nspOrgAdminOf,
    qualityReviewerOf,
    nspOperatorOf,
  }
})

/**
 * ACT Stage 3 (ADR 0106 D9/§1) — the caller's raw, hat-blind grant list, for
 * the `/selecionar-perfil` picker's option cards (via
 * `getSelectableRoles(rawGrants)`, `src/lib/queries/session-grants.ts`) and
 * the D9 hint's "other hats held" set. Deliberately NOT `cache()`-wrapped like
 * `getSessionContext` — the picker is a one-shot interstitial render, not a
 * value read repeatedly across a render tree, and caching would make it
 * fetch-once-per-request identically to a plain call here regardless.
 *
 * Returns `[]` when unauthenticated (mirrors `getSessionContext`'s `null`
 * shape at the boundary the RPC itself enforces via RLS — an anonymous caller
 * has no `auth.uid()` to resolve grants for).
 */
export async function getRawGrants(): Promise<SessionGrant[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('session_context')
  const ctx = data as { grants: SessionGrant[] } | null
  return ctx?.grants ?? []
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
 * `role` is the caller's MEMBERSHIP role in this commission — their `memberships`
 * row when they are a member, else `null`. ⛔ BUG-QOB-003 (ADR 0100 D12): a
 * tenancy admin (org_admin/hospital_admin) with no membership row is NO LONGER
 * coerced to `'staff_admin'`. QO·B's content wall removed the tenancy admins from
 * every committee-content surface, so the coercion opened coordinator affordances
 * the DB now refuses (and, pre-wall, it was the UI half of the over-reach itself).
 * Tenancy-admin standing is carried as the distinct `isTenancyAdmin` flag —
 * exactly the Phase-A `isQualityViewer` treatment: a FLAG, never a member role.
 * Configuration affordances (the Q1–Q9 KEEP set) gate via
 * {@link canConfigureCommission}; content affordances gate on the membership
 * role / {@link canInCommission} and stay closed to a bare tenancy admin.
 *
 * `capabilities` / `isAdministrativo` report the CALLER's own Administrativo
 * standing in THIS commission (ADR 0061): `isAdministrativo` = the caller holds a
 * `commission_administrativos` row; `capabilities` = their granted capability keys.
 * Both honor the `administrativo` feature flag's kill switch — when the flag is
 * OFF they are `false` / `[]` (mirroring the flag-aware `app.member_can`), so a dark
 * flag confers no effective capabilities. Affordance gating goes through
 * {@link canInCommission} (coordinator OR holds the capability).
 *
 * This is the canonical commission-access resolver.
 */
export interface CommissionAccess {
  context: SessionContext
  organization: OrganizationRef
  commission: { id: string; name: string; slug: string; hospitalId: string | null }
  role: CommissionRole | null
  /** The caller's granted Administrativo capabilities in this commission (ADR
   * 0061). `[]` for a coordinator (they hold every capability implicitly — gate
   * via {@link canInCommission}, not this array) and when the flag is OFF. */
  capabilities: MemberCapability[]
  /** Whether the caller is an appointed Administrativo of this commission (ADR
   * 0061). `false` when the flag is OFF. Independent of `capabilities` — an
   * Administrativo may hold zero capabilities. */
  isAdministrativo: boolean
  /**
   * ADR 0100 D10 — the caller reaches this commission ONLY as a quality
   * reviewer (hospital-scoped `quality_reviewer` of the commission's hospital,
   * commission oversight-visible). Always paired with `role: null`: the
   * reviewer is a FLAG, never a member role — mapping it to `'staff_admin'`
   * would open every `role === 'staff_admin'` write gate, which D7 forbids.
   * Write affordances stay hidden; the DB arm (S7 confers read bits only) is
   * the boundary either way.
   */
  isQualityViewer: boolean
  /**
   * ADR 0100 D12 (BUG-QOB-003) — the caller administers this commission's TENANCY
   * (org_admin of its org OR hospital_admin of its hospital; the TS mirror of
   * `app.is_tenancy_admin_of`). A FLAG, never a member role — QO·B walled the
   * tenancy admins off committee CONTENT, so mapping them to `'staff_admin'`
   * (the pre-QO·B behaviour) rendered write affordances the DB refuses.
   * What this flag still confers (PO rulings Q1–Q9, the KEEP set): form
   * DEFINITIONS/builder, process templates, committee taxonomy + meeting
   * settings, member management, indicator DEFINITIONS — gate those via
   * {@link canConfigureCommission}. What it must NEVER open: responses/dashboard
   * row content, document content, indicator measurements, case content, or any
   * {@link canInCommission} capability (all four are content capabilities).
   * Independent of `role`: a tenancy admin who is ALSO a member keeps their
   * membership role AND carries this flag.
   */
  isTenancyAdmin: boolean
}

export const getCommissionAccessByOrg = cache(
  async (
    orgSlug: string,
    commissionSlug: string,
  ): Promise<CommissionAccess | null> => {
    return getCommissionAccessByOrgUncached(orgSlug, commissionSlug)
  },
)

async function getCommissionAccessByOrgUncached(
  orgSlug: string,
  commissionSlug: string,
): Promise<CommissionAccess | null> {
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
      'id, name, slug, hospital_id, quality_oversight, organization:organizations!inner(id, slug, name)',
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
    hospitalId: commissionRow.hospital_id,
  }

  // Member role from the membership row ONLY. ⛔ BUG-QOB-003 (ADR 0100 D12): the
  // former `memberRole ?? (isCommAdmin ? 'staff_admin' : null)` coercion is GONE.
  // QO·B's content wall (M1–M6) removed org_admin/hospital_admin from every
  // committee-content surface, so resolving them to the coordinator role rendered
  // write buttons and content screens that then returned empty lists or raised
  // `sem permissão`. Tenancy-admin standing is now the distinct `isTenancyAdmin`
  // flag below — the same treatment `isQualityViewer` got in Phase A (a FLAG,
  // never a member role). Both tenancy tiers ride ONE predicate (Q4: the same
  // wall), mirroring `app.is_tenancy_admin_of` — BUG-HAT-002's hospital_admin
  // mirror is preserved by the shared flag, not by the coercion.
  const memberRole =
    context.memberships.find((m) => m.commission.id === commission.id)?.role ??
    null
  const isTenancyAdmin = isCommissionAdmin(context, {
    organizationId: organization.id,
    hospitalId: commissionRow.hospital_id,
  })
  const role: CommissionRole | null = memberRole

  // ADR 0100 D10 — the quality-reviewer VIEWER branch. Evaluated only when the
  // membership check above resolved nothing: a reviewer who is ALSO a member
  // keeps their member role (and its affordances) untouched. (Post-BUG-QOB-003 a
  // tenancy admin has `role === null` too, so a tenancy admin who ALSO holds the
  // reviewer flag now resolves as a quality viewer — correct: the reviewer
  // standing is their only content-bearing standing, and the DB's S7 arm is what
  // actually serves it.)
  //
  // ⚠ The oversight-visibility test is EXPLICIT and load-bearing. An earlier
  // version omitted it, reasoning that for a bare reviewer the only admitting
  // arm of `commissions_select_member_or_admin` is the M6 reviewer arm (which
  // carries `quality_oversight = 'visible'`) — that invariant is FALSE (QA m1):
  // `is_pqs_operator_of(hospital_id)` and `is_nsp_org_admin_of(organization_id)`
  // also admit the row. A reviewer who is ALSO a PQS operator of the same
  // hospital would therefore resolve an EXCLUDED commission and be flagged a
  // quality viewer on it. The DB still yields nothing (S7 requires 'visible', so
  // it failed closed on data), but the flag would be wrong — so it is now tested
  // here rather than inferred from a policy's arm set.
  const isQualityViewer =
    role === null &&
    commission.hospitalId !== null &&
    commissionRow.quality_oversight === 'visible' &&
    context.qualityReviewerOf.some(
      (q) => q.hospital.id === commission.hospitalId,
    )

  // Administrativo standing (ADR 0061), flag-aware. The self arm of the SELECT
  // policies returns the caller's own rows; we still filter to (commission, self)
  // explicitly. When the flag is OFF, the rows may exist but confer nothing (the
  // kill switch), so short-circuit to false/[] — matching app.member_can.
  let capabilities: MemberCapability[] = []
  let isAdministrativo = false
  if (await featureEnabled('administrativo')) {
    const [{ data: apptRow }, { data: capRows }] = await Promise.all([
      supabase
        .from('commission_administrativos')
        .select('user_id')
        .eq('commission_id', commission.id)
        .eq('user_id', context.userId)
        .maybeSingle(),
      supabase
        .from('commission_administrativo_capabilities')
        .select('capability')
        .eq('commission_id', commission.id)
        .eq('user_id', context.userId)
        .returns<{ capability: MemberCapability }[]>(),
    ])
    isAdministrativo = apptRow !== null
    capabilities = (capRows ?? []).map((r) => r.capability)
  }

  return {
    context,
    organization,
    commission,
    role,
    capabilities,
    isAdministrativo,
    isQualityViewer,
    isTenancyAdmin,
  }
}

/**
 * Whether the caller may perform an Administrativo-gated action in a commission
 * (ADR 0061): a MEMBERSHIP coordinator implicitly holds every capability;
 * otherwise the caller must hold the specific capability. The single seam the UI
 * gates every delegated affordance through — mirrors the DB gate
 * `is_staff_admin_of OR member_can`.
 *
 * ⛔ ADR 0100 D12 (BUG-QOB-003): all five `MemberCapability` values
 * (`schedule_meetings` / `create_cases` / `assign_case_phases` / `view_signoffs` /
 * `read_cases` — the fifth added by ADR 0134 D6) are committee CONTENT
 * capabilities, so a bare tenancy admin holds NONE of them.
 * That falls out of `role` now being membership-only — do NOT add an
 * `isTenancyAdmin` arm here. Configuration affordances (the Q1–Q9 KEEP set) are
 * a different seam: {@link canConfigureCommission}.
 *
 * ⭐ `access.role !== null` IS the membership test, and it is load-bearing — it
 * mirrors `app.member_can`'s `app.is_member_of` conjunct, which this helper
 * omitted until FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED was closed by
 * measurement (2026-08-22). Nothing revokes an Administrativo appointment or its
 * capability rows when a membership is deleted (no FK, no cascade trigger), and
 * `commission_administrativo_capabilities_select`'s `user_id = auth.uid()` arm is
 * hat-BLIND, so `access.capabilities` stays populated for such an ORPHAN. The DB
 * refuses them — so the un-narrowed mirror was strictly WIDER than the door.
 *
 * ⭐ WHY THAT SURVIVES A NEW CAPABILITY, stated as a PROPERTY rather than as a
 * census (a census goes stale the next time the vocabulary grows — and it did):
 * the membership term lives inside the capability predicate ITSELF, not in the
 * shape of whatever gate encloses it. So it holds whether the consumer is written
 * `is_staff_admin_of OR member_can(...)` — as all of the four content
 * capabilities' consumers are (measured 2026-08-22 by property over
 * comment-stripped `prosrc` plus `pg_policy`: 9 functions + the 3
 * `meetings_staff_admin_*` policies) — or as a bare capability test.
 *
 * `read_cases`, the fifth value, is the second shape: its only consumer is the ADR
 * 0134 S8 arm inside `app._case_caps`, which is a bare
 * `app.member_can_for(commission, 'read_cases', uid)`. ⚠ Note the `_for` — ADR 0134
 * Amendment 6: `app.member_can` resolves `auth.uid()` and cannot answer about a
 * third party, so the resolver (a `(case, uid)` function) uses the `_for` twin, and
 * `member_can` is now a thin `auth.uid()` binding of the same single body. Both
 * carry `app.is_member_of[_for]`, so the orphan is refused on either.
 *
 * ⚠ That width was REACHABLE, not theoretical. A plain orphan is stopped a step
 * earlier (`commissions_select_member_or_admin` denies them the commission row,
 * so the resolver returns `null`), but an orphan who ALSO holds tenancy-admin or
 * quality-reviewer standing reads the commission row on that other arm, arrives
 * with `role: null` + a full `capabilities` array, and was offered "Novo caso"
 * behind a door that answered "Você não tem permissão para esta ação."
 * Both composites are pinned by `e2e/orphan-administrativo-reachability.spec.ts`.
 *
 * ⛔ Narrowing here CANNOT under-grant: `role === 'staff_admin'` already implies a
 * membership, and the capability arm now requires one, which is exactly the door's
 * shape. Do NOT "restore" the membership-blind form to fix a missing affordance —
 * an affordance missing HERE means the DB would have refused it too.
 */
export function canInCommission(
  access: Pick<CommissionAccess, 'role' | 'capabilities'>,
  capability: MemberCapability,
): boolean {
  if (access.role === 'staff_admin') return true
  return access.role !== null && access.capabilities.includes(capability)
}

/**
 * Whether the caller may administer this commission's CONFIGURATION — the
 * PO-ratified KEEP surface of ADR 0100 D12 (rulings Q1–Q9): form
 * DEFINITIONS/builder, process templates, committee taxonomy (tags, outcomes,
 * narrative types, phase-result vocab), meeting types + settings, member
 * management, and indicator DEFINITIONS (Q3 splits the family — the
 * MEASUREMENT half is content and stays membership-gated).
 *
 * `true` for the commission's own membership coordinator AND for a tenancy admin
 * (org_admin/hospital_admin — `isTenancyAdmin`), mirroring the DB, where every
 * KEEP policy/door still reads `is_staff_admin_of OR is_tenancy_admin_of`.
 *
 * ⛔ NEVER gate a CONTENT affordance on this helper — content (responses,
 * dashboards' row-level doors, documents, measurements, cases, sign-offs) is
 * exactly what QO·B removed from the tenancy admins; those gates stay on
 * `role === 'staff_admin'` / {@link canInCommission} / `isQualityViewer`.
 */
export function canConfigureCommission(
  access: Pick<CommissionAccess, 'role' | 'isTenancyAdmin'>,
): boolean {
  return access.role === 'staff_admin' || access.isTenancyAdmin
}

/**
 * Server-action variant of {@link canConfigureCommission}, resolved by commission
 * id — the lib action guards (`src/lib/*\/actions.ts`) hold a `commissionId`, not
 * a `CommissionAccess`. Same seam, same rule: the commission's own MEMBERSHIP
 * coordinator, or a tenancy admin of its org/hospital.
 *
 * Mirrors `authorizeStaffOps` in `members/actions.ts`: the tenancy legs need the
 * commission's scope columns, so they share one RLS-scoped read — deliberately
 * RLS-scoped, because a caller who cannot SELECT the commission cannot administer
 * it either. Inactive accounts fail closed.
 *
 * ⛔ Route only ADR 0100 D12 KEEP-surface (configuration) actions through this —
 * the same warning as {@link canConfigureCommission}: a content action guard that
 * adopts it re-opens the wall at the affordance layer (the BUG-QOB-003 class).
 */
export async function canConfigureCommissionById(
  commissionId: string,
): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isInactive) return false

  if (
    context.memberships.some(
      (m) => m.commission.id === commissionId && m.role === 'staff_admin',
    )
  ) {
    return true
  }

  if (context.orgAdminOf.length === 0 && context.hospitalAdminOf.length === 0) {
    return false
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('commissions')
    .select('organization_id, hospital_id')
    .eq('id', commissionId)
    .maybeSingle()
  if (!data) return false

  return isCommissionAdmin(context, {
    organizationId: data.organization_id,
    hospitalId: data.hospital_id,
  })
}

/**
 * The technical-direction access resolver (ADR 0094 W4 / FUP-MEM-3b) — the seam
 * behind `/o/[org]/direcao-tecnica/**`, mirroring {@link getCommissionAccessByOrg}.
 *
 * Returns `null` (caller renders `notFound()`, leaking nothing) when the caller holds
 * no technical direction in this org. `hospitals` is every hospital of THIS org whose
 * direction they hold — titular or deputy, undifferentiated (D1).
 *
 * ⚠ NO DATABASE READ, deliberately — and this is the point of the resolver rather
 * than an oversight. Every sibling resolver re-reads `organizations` by slug, which
 * works for them because `organizations_select` admits their standing. A Diretor
 * Técnico's ONLY standing is a hospital-tier membership, so making the org row the
 * gate would make console entry depend on whether that policy happens to carry an arm
 * for the office — a coupling that would fail silently and look like a missing route.
 * `session_context` is SECURITY DEFINER and already returned the org ref alongside
 * each grant, so the authoritative answer is in hand: match the slug against it.
 *
 * This decides CONSOLE ENTRY only. Every referral the console shows is RLS-scoped at
 * the data door (`case_referral`'s SELECT policy admits the direction of
 * `target_hospital_id`), so a tampered slug or hospital id yields an empty list rather
 * than someone else's referrals.
 */
export const getTechnicalDirectionAccessByOrg = cache(
  async (
    orgSlug: string,
  ): Promise<{
    context: SessionContext
    organization: OrganizationRef
    hospitals: TechnicalDirectionMembership[]
  } | null> => {
    const context = await getSessionContext()
    if (!context) return null

    const held = context.technicalDirectionOf.filter(
      (t) => t.organization.slug === orgSlug,
    )
    if (held.length === 0) return null

    return { context, organization: held[0].organization, hospitals: held }
  },
)

/**
 * The quality-office console access resolver (ADR 0100 D10) — the seam behind
 * `/o/[org]/qualidade/**`, mirroring {@link getNspAccessByOrg}'s shape with the
 * technical-direction resolver's NO-DATABASE-READ resolution: a reviewer's ONLY
 * standing is a hospital-tier membership, and `session_context` (SECURITY
 * DEFINER) already returned the org ref alongside each grant — match the slug
 * against it. (The `organizations_select` RLS arm for the reviewer EXISTS — M6,
 * `is_quality_reviewer_in_org` — and is what makes the org-scoped screens'
 * direct reads work; console ENTRY just doesn't need the round trip.)
 *
 * Returns `null` (→ `notFound()`, leaking nothing) when the caller reviews no
 * hospital of this org. `hospitals` drives the `?hospital=` data filter
 * (hospital is NEVER a URL segment — ADR 0041 D8). Everything the console shows
 * is re-gated at the data doors: the board door 42501s a non-reviewer, and every
 * case row rides `app.can_read_case` (the S7 arm; D6 keeps locked cases out).
 */
export const getQualidadeAccessByOrg = cache(
  async (
    orgSlug: string,
  ): Promise<{
    context: SessionContext
    organization: OrganizationRef
    orgId: string
    hospitals: QualityReviewMembership[]
  } | null> => {
    const context = await getSessionContext()
    if (!context) return null

    const held = context.qualityReviewerOf.filter(
      (q) => q.organization.slug === orgSlug,
    )
    if (held.length === 0) return null

    return {
      context,
      organization: held[0].organization,
      orgId: held[0].organization.id,
      hospitals: held,
    }
  },
)

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
