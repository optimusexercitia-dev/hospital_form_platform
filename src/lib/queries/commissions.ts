import { createClient } from '@/lib/supabase/server'

/**
 * Admin commission data-access (Architecture Rule 9). Backs the `/admin`
 * commission list and the `/admin/comissoes/[slug]` detail. Reads use the
 * cookie-wired (RLS-scoped) client: an admin reads every commission via
 * `commissions_select_member_or_admin` / `app.is_admin()`, every membership via
 * `memberships_select` (S1·MEM; formerly `commission_members_select`), and every
 * profile via `profiles_admin_select` (M6). No service-role read on this
 * display path.
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

// memberships row (commission-tier; S1·MEM, formerly commission_members) joined
// to its profile, as PostgREST returns it.
interface MemberWithProfile {
  principal_id: string
  role: string
  profiles: { full_name: string | null; email: string | null } | null
}

interface CommissionRow {
  id: string
  name: string
  slug: string
  created_at: string
  memberships: MemberWithProfile[]
}

function toStaffAdmins(members: MemberWithProfile[]): StaffAdminSummary[] {
  return members
    .filter((m) => m.role === 'staff_admin')
    .map((m) => ({
      userId: m.principal_id,
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

  const { data, error } = await supabase
    .from('commissions')
    .select(
      'id, name, slug, created_at, memberships!memberships_commission_id_fkey(principal_id, role, profiles!memberships_principal_id_fkey(full_name, email))',
    )
    .order('name')
    .returns<CommissionRow[]>()

  // A genuine query error must not masquerade as an empty admin list (an RLS-denied
  // read returns `{ data: [], error: null }`, which IS a legitimate empty result).
  if (error) {
    throw new Error(`Failed to list commissions for admin: ${error.message}`)
  }

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      createdAt: row.created_at,
      memberCount: row.memberships.length,
      staffAdmins: toStaffAdmins(row.memberships),
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

  const { data, error } = await supabase
    .from('commissions')
    .select(
      'id, name, slug, created_at, memberships!memberships_commission_id_fkey(principal_id, role, profiles!memberships_principal_id_fkey(full_name, email))',
    )
    .eq('slug', slug)
    .maybeSingle<CommissionRow>()

  // A genuine query error must not masquerade as "commission not visible" (which
  // legitimately returns null under RLS / unknown slug).
  if (error) {
    throw new Error(`Failed to load commission for admin: ${error.message}`)
  }

  if (!data) {
    return null
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    createdAt: data.created_at,
    staffAdmins: toStaffAdmins(data.memberships),
  }
}
