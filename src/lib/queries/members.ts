import { createClient } from '@/lib/supabase/server'

/**
 * Commission member data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). `listMembers` is the CANONICAL roster helper: it backs
 * both the commission member-management page (`/c/[slug]/manage/members`) and
 * the admin commission detail's staff_admin roster, so the two never drift.
 *
 * All reads use the cookie-wired (RLS-scoped) client: `commission_members_select`
 * (M6) returns rows only to members of the commission and admins; emails come
 * from the denormalized `profiles.email` (M9, ADR 0010) under
 * `profiles_select_self_or_admin`. No service-role read on this display path.
 */

export type CommissionRole = 'staff' | 'staff_admin'

export interface MemberListItem {
  userId: string
  fullName: string | null
  email: string | null
  role: CommissionRole
  joinedAt: string
}

// Shape of a commission_members row joined to its profile. PostgREST returns the
// embedded `profiles` relation as an object (or null if RLS hid it).
interface MemberRow {
  user_id: string
  role: string
  created_at: string
  profiles: { full_name: string | null; email: string | null } | null
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

  const { data } = await supabase
    .from('commission_members')
    .select('user_id, role, created_at, profiles(full_name, email)')
    .eq('commission_id', commissionId)
    .returns<MemberRow[]>()

  const members: MemberListItem[] = (data ?? [])
    .filter(
      (row): row is MemberRow & { role: CommissionRole } =>
        row.role === 'staff' || row.role === 'staff_admin',
    )
    .map((row) => ({
      userId: row.user_id,
      fullName: row.profiles?.full_name ?? null,
      email: row.profiles?.email ?? null,
      role: row.role,
      joinedAt: row.created_at,
    }))

  return sortMembers(members)
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
