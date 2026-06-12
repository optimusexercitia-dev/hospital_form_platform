import { createClient } from '@/lib/supabase/server'

/**
 * Admin commission data-access (Architecture Rule 9). Backs the `/admin`
 * commission list and the `/admin/comissoes/[slug]` detail. Reads use the
 * cookie-wired (RLS-scoped) client: an admin reads every commission via
 * `commissions_select_member_or_admin` / `app.is_admin()`, every membership via
 * `commission_members_select`, and every profile via `profiles_admin_select`
 * (M6). No service-role read on this display path.
 *
 * Staff_admin rosters reuse the canonical member shape from `./members`.
 */

export interface StaffAdminSummary {
  userId: string
  fullName: string | null
  email: string | null
}

export interface AdminCommissionListItem {
  id: string
  name: string
  slug: string
  createdAt: string
  memberCount: number
  staffAdmins: StaffAdminSummary[]
}

export interface AdminCommissionDetail {
  id: string
  name: string
  slug: string
  createdAt: string
  staffAdmins: StaffAdminSummary[]
}

// commission_members row joined to its profile, as PostgREST returns it.
interface MemberWithProfile {
  user_id: string
  role: string
  profiles: { full_name: string | null; email: string | null } | null
}

interface CommissionRow {
  id: string
  name: string
  slug: string
  created_at: string
  commission_members: MemberWithProfile[]
}

function toStaffAdmins(members: MemberWithProfile[]): StaffAdminSummary[] {
  return members
    .filter((m) => m.role === 'staff_admin')
    .map((m) => ({
      userId: m.user_id,
      fullName: m.profiles?.full_name ?? null,
      email: m.profiles?.email ?? null,
    }))
    .sort((a, b) =>
      (a.fullName || a.email || '').localeCompare(
        b.fullName || b.email || '',
        'pt-BR',
      ),
    )
}

/**
 * All commissions with member counts and staff_admin rosters, sorted by name
 * (pt-BR). Admin-only in practice — RLS returns every commission to an admin and
 * the member's own commissions to a non-admin; gate the calling page on
 * `isAdmin` regardless.
 */
export async function listCommissionsForAdmin(): Promise<
  AdminCommissionListItem[]
> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('commissions')
    .select(
      'id, name, slug, created_at, commission_members(user_id, role, profiles(full_name, email))',
    )
    .order('name')
    .returns<CommissionRow[]>()

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.created_at,
      memberCount: row.commission_members.length,
      staffAdmins: toStaffAdmins(row.commission_members),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/**
 * One commission by slug with its staff_admin roster, or `null` when no row is
 * visible (unknown slug OR not accessible — indistinguishable under RLS, so the
 * caller renders notFound() and leaks nothing about which commissions exist).
 */
export async function getCommissionForAdmin(
  slug: string,
): Promise<AdminCommissionDetail | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('commissions')
    .select(
      'id, name, slug, created_at, commission_members(user_id, role, profiles(full_name, email))',
    )
    .eq('slug', slug)
    .maybeSingle<CommissionRow>()

  if (!data) {
    return null
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    createdAt: data.created_at,
    staffAdmins: toStaffAdmins(data.commission_members),
  }
}
