import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  deriveUserStatus,
  type OrgUserDetail,
  type OrgUserListItem,
  type OrgUserPage,
  type Paging,
  type ProfessionalCategory,
  type ProfessionalCredential,
  type UserCommitteeMembership,
} from '@/lib/users/types'

/**
 * Org-scoped user-directory reads (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the org_admin user directory + per-user management
 * page under `/o/[org]/manage/usuarios`.
 *
 * RLS is the authority: `profiles` SELECT has an `is_org_admin_of(home_organization_id)`
 * path so an org_admin reads EVERY user anchored to their org — including a
 * freshly-registered `pending` user with no committee yet (which the existing
 * shared-commission / member-join paths would miss). These reads therefore run on
 * the ordinary cookie-wired (RLS-scoped) client; a foreign caller gets empty.
 */

/** The profile columns the directory + detail reads share. */
const PROFILE_SELECT =
  'id, full_name, email, home_organization_id, home_hospital_id, hospital_employee_id, professional_category_id, is_active, suspended_until, email_confirmed_at, created_at, hospital:hospitals!profiles_home_hospital_id_fkey(name), category:professional_categories(label_pt)'

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  home_organization_id: string | null
  home_hospital_id: string | null
  hospital_employee_id: string | null
  professional_category_id: string | null
  is_active: boolean
  suspended_until: string | null
  email_confirmed_at: string | null
  created_at: string
  hospital: { name: string } | null
  category: { label_pt: string } | null
}

/**
 * A page of the org's user directory, filtered by `search` (matches full_name,
 * email, or category label — case-insensitive) and windowed by `paging`.
 * Returns rows + total count for the pager. Empty when the caller is not an
 * org_admin of `orgId` (RLS-scoped).
 */
export async function listOrgUsers(
  orgId: string,
  search: string,
  paging: Paging,
): Promise<OrgUserPage> {
  const supabase = await createClient()

  const from = paging.page * paging.pageSize
  const to = from + paging.pageSize - 1

  let query = supabase
    .from('profiles')
    .select(PROFILE_SELECT, { count: 'exact' })
    .eq('home_organization_id', orgId)

  const term = search.trim()
  if (term) {
    // Case-insensitive match on name OR email OR the joined category label.
    // The embedded professional_categories filter uses the FK-embedded path.
    const escaped = term.replace(/[%,()]/g, '')
    query = query.or(
      `full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    )
  }

  const {
    data,
    count,
    error,
  } = await query
    .order('full_name', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (error) throw error

  const rows = (data ?? []) as unknown as ProfileRow[]

  // Committee counts for the page's users (one RLS-scoped read, grouped in TS —
  // PostgREST cannot return a per-parent aggregate in the same round trip).
  const ids = rows.map((r) => r.id)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: memberships, error: mErr } = await supabase
      .from('memberships')
      .select('principal_id')
      .not('commission_id', 'is', null)
      .in('principal_id', ids)
    if (mErr) throw mErr
    for (const m of memberships ?? []) {
      counts.set(m.principal_id, (counts.get(m.principal_id) ?? 0) + 1)
    }
  }

  const items: OrgUserListItem[] = rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    categoryLabel: r.category?.label_pt ?? null,
    status: deriveUserStatus(r.is_active, r.suspended_until, r.email_confirmed_at),
    homeHospitalName: r.hospital?.name ?? null,
    committeeCount: counts.get(r.id) ?? 0,
  }))

  return { rows: items, total: count ?? items.length }
}

/**
 * A page of ONE HOSPITAL's user directory, for a `hospital_admin` (ADR 0051
 * Decision 4 / Q2 — hospital-scoped directory, NO org-wide `profiles` read for a
 * hospital_admin). Scoped to users whose `home_hospital_id = hospitalId`, filtered
 * by `search` and windowed by `paging`. Same {@link OrgUserPage} shape as
 * {@link listOrgUsers}. RLS-scoped: empty for a caller who is not a
 * `hospital_admin` of `hospitalId` (nor org_admin of its org / platform_admin).
 *
 * A0 stub — the real read (mirroring `listOrgUsers` but keyed on
 * `home_hospital_id`) lands in A4/A5 once the hospital-admin RLS path exists.
 */
export async function listHospitalUsers(
  hospitalId: string,
  search: string,
  paging: Paging,
): Promise<OrgUserPage> {
  const supabase = await createClient()

  // The hospital's user set = home-anchored to the hospital ∪ members of any
  // commission under the hospital (Q2 scope). Resolve the commission-membership
  // arm's user ids first (RLS-scoped: a hospital_admin reads its hospital's
  // commissions + their members), then page `profiles` filtered to
  // home_hospital_id = hospitalId OR id IN that set — all under the profiles RLS
  // hospital_admin arm (migration 20260709000600), so a non-admin gets empty.
  const { data: commRows } = await supabase
    .from('commissions')
    .select('id')
    .eq('hospital_id', hospitalId)
    .returns<{ id: string }[]>()
  const commissionIds = (commRows ?? []).map((c) => c.id)

  const memberUserIds = new Set<string>()
  if (commissionIds.length > 0) {
    const { data: memberRows } = await supabase
      .from('memberships')
      .select('principal_id')
      .in('commission_id', commissionIds)
      .returns<{ principal_id: string }[]>()
    for (const m of memberRows ?? []) memberUserIds.add(m.principal_id)
  }

  const from = paging.page * paging.pageSize
  const to = from + paging.pageSize - 1

  // home_hospital match OR membership in the hospital's commissions. `.or` on the
  // id-set is built only when the set is non-empty (an empty in.() is invalid).
  let query = supabase.from('profiles').select(PROFILE_SELECT, { count: 'exact' })
  if (memberUserIds.size > 0) {
    const idList = Array.from(memberUserIds).join(',')
    query = query.or(`home_hospital_id.eq.${hospitalId},id.in.(${idList})`)
  } else {
    query = query.eq('home_hospital_id', hospitalId)
  }

  const term = search.trim()
  if (term) {
    const escaped = term.replace(/[%,()]/g, '')
    // Combine with the hospital-scope filter via an AND-ed .or on name/email.
    query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
  }

  const { data, count, error } = await query
    .order('full_name', { ascending: true, nullsFirst: false })
    .range(from, to)

  if (error) throw error

  const rows = (data ?? []) as unknown as ProfileRow[]

  // Committee counts for the page's users (one RLS-scoped read, grouped in TS).
  const ids = rows.map((r) => r.id)
  const counts = new Map<string, number>()
  if (ids.length > 0) {
    const { data: memberships, error: mErr } = await supabase
      .from('memberships')
      .select('principal_id')
      .not('commission_id', 'is', null)
      .in('principal_id', ids)
    if (mErr) throw mErr
    for (const m of memberships ?? []) {
      counts.set(m.principal_id, (counts.get(m.principal_id) ?? 0) + 1)
    }
  }

  const items: OrgUserListItem[] = rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    categoryLabel: r.category?.label_pt ?? null,
    status: deriveUserStatus(r.is_active, r.suspended_until, r.email_confirmed_at),
    homeHospitalName: r.hospital?.name ?? null,
    committeeCount: counts.get(r.id) ?? 0,
  }))

  return { rows: items, total: count ?? items.length }
}

/**
 * Full detail for one user (profile + credentials[] + committee memberships[] with
 * role). Returns `null` when the user does not exist or is not visible to the
 * caller (RLS-scoped: org_admin of the user's home org / the user themselves /
 * platform_admin).
 */
export async function getOrgUser(userId: string): Promise<OrgUserDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const profile = data as unknown as ProfileRow

  const [credentialsResult, membershipsResult] = await Promise.all([
    supabase
      .from('professional_credentials')
      .select(
        'id, user_id, issuing_country, issuing_state, issuing_authority, registration_number, verified_at, expires_on, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('memberships')
      .select('role, commission:commissions(id, name, slug)')
      .eq('principal_id', userId)
      .not('commission_id', 'is', null),
  ])

  if (credentialsResult.error) throw credentialsResult.error
  if (membershipsResult.error) throw membershipsResult.error

  const credentials: ProfessionalCredential[] = (
    credentialsResult.data ?? []
  ).map((c) => ({
    id: c.id,
    userId: c.user_id,
    issuingCountry: c.issuing_country,
    issuingState: c.issuing_state,
    issuingAuthority: c.issuing_authority,
    registrationNumber: c.registration_number,
    verifiedAt: c.verified_at,
    expiresOn: c.expires_on,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))

  const committees: UserCommitteeMembership[] = (membershipsResult.data ?? [])
    .filter(
      (
        m,
      ): m is {
        role: 'staff' | 'staff_admin'
        commission: { id: string; name: string; slug: string }
      } =>
        m.commission !== null &&
        (m.role === 'staff' || m.role === 'staff_admin'),
    )
    .map((m) => ({
      commissionId: m.commission.id,
      commissionName: m.commission.name,
      commissionSlug: m.commission.slug,
      role: m.role,
    }))
    .sort((a, b) => a.commissionName.localeCompare(b.commissionName, 'pt-BR'))

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    homeOrganizationId: profile.home_organization_id ?? '',
    homeHospitalId: profile.home_hospital_id,
    homeHospitalName: profile.hospital?.name ?? null,
    hospitalEmployeeId: profile.hospital_employee_id,
    professionalCategoryId: profile.professional_category_id,
    categoryLabel: profile.category?.label_pt ?? null,
    status: deriveUserStatus(
      profile.is_active,
      profile.suspended_until,
      profile.email_confirmed_at,
    ),
    emailConfirmedAt: profile.email_confirmed_at,
    suspendedUntil: profile.suspended_until,
    isActive: profile.is_active,
    createdAt: profile.created_at,
    credentials,
    committees,
  }
}

/**
 * The active professional-category vocabulary (for the register/edit form select).
 * Authenticated-readable (RLS), so this runs on the cookie client.
 */
export async function listProfessionalCategories(): Promise<
  ProfessionalCategory[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('professional_categories')
    .select('id, key, label_pt, issuing_authority, is_active')
    .eq('is_active', true)
    .order('position', { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id,
    key: c.key,
    labelPt: c.label_pt,
    issuingAuthority: c.issuing_authority,
    isActive: c.is_active,
  }))
}
