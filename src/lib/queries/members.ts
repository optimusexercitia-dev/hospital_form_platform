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
  profiles: { full_name: string | null; email: string | null } | null
  commission_member_titles: { name: string } | null
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
      'id, principal_id, role, granted_at, title_id, profiles!memberships_principal_id_fkey(full_name, email), commission_member_titles(name)',
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
    }))

  return sortMembers(members)
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
