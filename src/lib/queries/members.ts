import { createClient } from '@/lib/supabase/server'

/**
 * Commission member data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). `listMembers` is the CANONICAL roster helper: it backs
 * both the commission member-management page (`/c/[slug]/manage/members`) and
 * the admin commission detail's staff_admin roster, so the two never drift.
 *
 * All reads use the cookie-wired (RLS-scoped) client: `memberships` RLS (S1·MEM;
 * formerly `commission_members_select`, M6) returns rows only to members of the
 * commission and admins; emails come from the denormalized `profiles.email` (M9,
 * ADR 0010) under `profiles_select_self_or_admin`. No service-role read on this
 * display path.
 */

export type CommissionRole = 'staff' | 'staff_admin'

export interface MemberListItem {
  /**
   * The `memberships.id` (NOT the user id) — the membership row's PK.
   * Required by `assignMemberTitle(memberId, …)` (ADR 0051): a user may hold
   * memberships in several commissions, so `userId` alone cannot identify the row.
   */
  memberId: string
  userId: string
  fullName: string | null
  email: string | null
  role: CommissionRole
  joinedAt: string
  /** The member's optional DISPLAY-ONLY committee title (ADR 0051). `null` when
   * unset. `titleName` is the resolved label for the badge; `titleId` is what
   * the assignment control writes back. */
  titleId: string | null
  titleName: string | null
  /**
   * Whether this member currently satisfies `app.is_active` — the predicate every
   * assignee-taking RPC enforces (via `app.is_member_of_for`). A roster row can be a
   * perfectly good *membership* and still fail it, because activity lives on the
   * PROFILE (deactivated account, or a suspension that has not lapsed).
   *
   * ⚠ Carried, never pre-filtered. The two consumer classes need opposite answers:
   * member MANAGEMENT must list a suspended member (that page is where you lift the
   * suspension), while any ASSIGNMENT surface must not offer them — see
   * {@link activeMembers}. `listMembers` returning only the active ones would break
   * the first; returning them unlabelled is what broke the second (FUP-BULK-1).
   */
  isActive: boolean
}

// Shape of a memberships row (commission-tier) joined to its profile + optional
// title. PostgREST returns each embedded relation as an object (or null if
// unset/RLS-hid).
interface MemberRow {
  id: string
  principal_id: string
  role: string
  granted_at: string
  title_id: string | null
  profiles: {
    full_name: string | null
    email: string | null
    is_active: boolean | null
    suspended_until: string | null
  } | null
  commission_member_titles: { name: string } | null
}

/**
 * The TS mirror of `app.is_active(uuid)`:
 *
 *   is_active and (suspended_until is null or now() >= suspended_until)
 *   …coalesced to FALSE for an absent profile (fail closed).
 *
 * Mirrored rather than round-tripped because the roster read already has both
 * columns (`authenticated` holds a column-level SELECT grant on each), so asking the
 * DB again would cost a call per member to learn what the row already says. The
 * evaluator-parity discipline of Architecture Rule 3 applies: if the SQL predicate
 * changes, this changes with it — `members.test.ts` pins the three branches.
 */
export function profileIsActive(profile: MemberRow['profiles']): boolean {
  if (!profile || profile.is_active !== true) return false
  if (profile.suspended_until === null) return true
  const until = Date.parse(profile.suspended_until)
  // An unparseable timestamp is treated as still-suspended, matching the coalesce's
  // fail-closed direction (never hand an assignment to someone we cannot vouch for).
  if (Number.isNaN(until)) return false
  return Date.now() >= until
}

/**
 * The commission's members, sorted staff_admin-first then by name (pt-BR
 * locale). Returns `[]` when the caller may not read the commission (RLS yields
 * no rows) — callers that need access control should gate via
 * `getCommissionAccessByOrg` before rendering.
 */
export async function listMembers(
  commissionId: string,
): Promise<MemberListItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('memberships')
    .select(
      // MEM added a SECOND memberships→profiles FK (granted_by), so the bare
      // `profiles(...)` embed is ambiguous (PGRST201). Pin the member-profile FK.
      'id, principal_id, role, granted_at, title_id, profiles!memberships_principal_id_fkey(full_name, email, is_active, suspended_until), commission_member_titles(name)',
    )
    .eq('commission_id', commissionId)
    .returns<MemberRow[]>()

  // An RLS-denied read yields `{ data: [], error: null }` → an empty roster is a
  // legitimate "no visible members" result (per this function's contract). But a
  // genuine query error (e.g. an ambiguous embed) must NOT masquerade as an empty
  // roster — surface it as a handled error so the failure is visible, not swallowed.
  if (error) {
    throw new Error(`Failed to list commission members: ${error.message}`)
  }

  const members: MemberListItem[] = (data ?? [])
    .filter(
      (row): row is MemberRow & { role: CommissionRole } =>
        row.role === 'staff' || row.role === 'staff_admin',
    )
    .map((row) => ({
      memberId: row.id,
      userId: row.principal_id,
      fullName: row.profiles?.full_name ?? null,
      email: row.profiles?.email ?? null,
      role: row.role,
      joinedAt: row.granted_at,
      titleId: row.title_id,
      titleName: row.commission_member_titles?.name ?? null,
      isActive: profileIsActive(row.profiles),
    }))

  return sortMembers(members)
}

/**
 * The roster narrowed to members an assignee-taking RPC will actually ACCEPT.
 *
 * FUP-BULK-1: the bulk wizard offered every member with a `staff`/`staff_admin` role
 * and defaulted them all to selected, while `bulk_create_cases` gates each owner on
 * `app.is_member_of_for` → `app.is_active` and raises HC021. With one suspended
 * member in a roster of nine and a `Math.random` deal, ~2/9 of runs handed a case to
 * someone the door refuses — a genuine user-facing failure that surfaced as a "flaky"
 * E2E red on every branch.
 *
 * Use this at any surface that OFFERS a member as an assignment target. Do NOT use it
 * for display or management rosters — an invisible suspended member cannot be
 * un-suspended. The same disagreement exists at the other assignee-taking doors
 * (`assign_narrative`, `reassign_phase`, `assign_referral_reviewer`,
 * `add_interview_interviewer`, `grant_case_access`, `appoint_administrativo`, …);
 * they fail loudly on a single explicit pick rather than randomly, and are tracked
 * separately — pass their rosters through here as each is covered.
 */
export function activeMembers(
  members: readonly MemberListItem[],
): MemberListItem[] {
  return members.filter((m) => m.isActive)
}

/** A registered platform user a coordinator may ADD to a commission. */
export interface AddableUser {
  userId: string
  fullName: string | null
  email: string | null
}

/**
 * The registered users a coordinator may ADD to this commission: ACTIVE profiles
 * anchored to the commission's ORGANIZATION who are not already members. Backed by
 * the coordinator-gated SECURITY DEFINER `list_addable_commission_members` RPC —
 * a staff_admin has no blanket `profiles` SELECT under RLS, so this single door is
 * how they read the org roster (org-scoped, minimum-necessary). Returns `[]` for a
 * non-coordinator (the RPC yields no rows).
 */
export async function listAddableMembers(
  commissionId: string,
): Promise<AddableUser[]> {
  const supabase = await createClient()

  const { data } = await supabase.rpc('list_addable_commission_members', {
    p_commission_id: commissionId,
  })

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name || null,
    email: row.email,
  }))
}

/**
 * The people a coordinator may LINK a professional profile to (ETH·E4, ADR 0108 D6
 * "possui conta"). A SECOND, different roster from `listAddableMembers` above — not a
 * redefinition of it. It reuses `AddableUser` because the row shape is identical.
 *
 * ⚠ WHY NOT `listAddableMembers`. That one is backed by
 * `list_addable_commission_members`, which filters `not exists (… memberships where
 * commission_id = p_commission_id …)` — org members who are **not already in this
 * commission**. Exactly right for "add a new member", exactly wrong here: the people
 * most likely to be seated as `respondent_doctor` on an ethics case ARE the
 * commission's own members, and that filter removes precisely them.
 *
 * The consequence was governance, not cosmetics. A coordinator who cannot find the
 * respondent under *possui conta* is pushed to **`não possui conta`** — which ADR 0108
 * D6 defines as an audited human assertion that makes the case exclusion VACUOUSLY
 * SATISFIED. The automatic impedimento would silently stop working, recorded as a
 * deliberate assertion that was really a UI dead end.
 *
 * ⚠ WHY A PLAIN RLS READ AND NOT A NEW DOOR — and what it does NOT do. Verified from
 * the catalog, then measured live: `profiles_select_self_or_admin` carries a
 * CO-MEMBERSHIP arm — `app.is_active(auth.uid()) and exists (select 1 from memberships
 * them where them.commission_id is not null and them.principal_id = profiles.id and
 * app.is_member_of(them.commission_id))` — so a coordinator already reads the profiles
 * of everyone sharing a commission with them. No widening, no new RPC, no migration.
 *
 * So this is NOT "every active user in the organization": for a staff_admin it is
 * their OWN existing read perimeter, intersected with the org. An org_admin (or a
 * hospital_admin, via the affiliation arms) does see the whole org, because their
 * policy arms already say so. Making it literally org-wide for a plain staff_admin
 * would require widening `profiles_select_self_or_admin`, which this deliberately
 * does NOT do.
 *
 * The two AFF/ADR-0097 directory doors were evaluated first and neither fits: both
 * gate on ORG ADMIN, so a commission coordinator gets nothing —
 * `list_org_people` returns empty (`is_org_admin_of ∨ hospital_admin`, silent
 * `return`), and `list_org_eligible_users` raises 42501
 * (`is_org_admin_of ∨ is_nsp_org_admin_of`).
 *
 * `is_admin` is excluded: a platform_admin is not a tenant person and never belongs on
 * a tenant roster (the noun rule, ADR 0078 A35) — mirroring `list_org_people`.
 */
export async function listLinkableOrgUsers(
  organizationId: string,
): Promise<AddableUser[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('home_organization_id', organizationId)
    .eq('is_active', true)
    .eq('is_admin', false)
    .order('full_name', { ascending: true, nullsFirst: false })
    .limit(500)

  // ⚠ THROW. This feeds the "possui conta" picker, so a swallowed error renders as
  // an empty user list — indistinguishable from "this professional has no account",
  // which walks the coordinator straight to `não possui conta` and makes the case
  // exclusion vacuously satisfied (ADR 0108 D6). `profiles` is on COLUMN-LIST grants,
  // so a future column added to the select without its own GRANT fails 42501 here —
  // exactly the error that must not be silent.
  if (error) throw error

  return (data ?? []).map((row) => ({
    userId: row.id,
    fullName: row.full_name || null,
    email: row.email,
  }))
}

/**
 * Administrativo delegation (ADR 0061). The finite capability menu; the string
 * union mirrors the DB CHECK on `commission_administrativo_capabilities.capability`.
 * Keep in sync with the migration's CHECK list.
 */
export type MemberCapability =
  | 'schedule_meetings'
  | 'create_cases'
  | 'assign_case_phases'
  | 'view_signoffs'

/** An "Administrativo" appointment row for a commission member (ADR 0061). */
export interface AdministrativoAppointment {
  userId: string
  appointedAt: string
}

/** A single granted capability of an Administrativo (ADR 0061). */
export interface MemberCapabilityGrant {
  userId: string
  capability: MemberCapability
}

/**
 * The commission's "Administrativo" appointments (ADR 0061). Backs the coordinator
 * member-manager UI (the "Administrativo" badge + the appoint control). RLS-scoped
 * via `commission_administrativos_select` (coordinator / commission-admin / self);
 * returns `[]` when the caller may not read them. Names/roles come from
 * {@link listMembers} — this only marks WHICH members are appointed.
 */
export async function listAdministrativos(
  commissionId: string,
): Promise<AdministrativoAppointment[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commission_administrativos')
    .select('user_id, appointed_at')
    .eq('commission_id', commissionId)
    .returns<{ user_id: string; appointed_at: string }[]>()

  if (error || !data) return []
  return data.map((row) => ({ userId: row.user_id, appointedAt: row.appointed_at }))
}

/**
 * The commission's granted Administrativo capabilities (ADR 0061), one row per
 * (member, capability). Backs the per-member capability checklist in the manager
 * UI. RLS-scoped via `commission_administrativo_capabilities_select`; returns `[]`
 * when the caller may not read them.
 */
export async function listMemberCapabilities(
  commissionId: string,
): Promise<MemberCapabilityGrant[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commission_administrativo_capabilities')
    .select('user_id, capability')
    .eq('commission_id', commissionId)
    .returns<{ user_id: string; capability: MemberCapability }[]>()

  if (error || !data) return []
  return data.map((row) => ({ userId: row.user_id, capability: row.capability }))
}

/**
 * Canonical member ordering: staff_admins first, then by full name (falling back
 * to email so unnamed rows still sort deterministically), pt-BR locale.
 */
export function sortMembers(members: MemberListItem[]): MemberListItem[] {
  const roleRank: Record<CommissionRole, number> = { staff_admin: 0, staff: 1 }
  return [...members].sort((a, b) => {
    if (a.role !== b.role) return roleRank[a.role] - roleRank[b.role]
    const aKey = a.fullName || a.email || ''
    const bKey = b.fullName || b.email || ''
    return aKey.localeCompare(bKey, 'pt-BR')
  })
}
