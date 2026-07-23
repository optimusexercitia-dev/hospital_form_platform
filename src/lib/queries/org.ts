import { createClient } from '@/lib/supabase/server'
import type { HospitalRef } from '@/lib/queries/session'

/**
 * Organization-scoped read data-access (multi-tenancy Phase C; Architecture Rule
 * 9 — all reads go through `src/lib/queries/`). Backs the platform-admin
 * orgs/hospitals registry (`/admin`) and the org-admin management area
 * (`/o/[org]/manage` — hospitals, commissions, the org rollup, the org-tier
 * audit).
 *
 * RLS is the authority (Phase B):
 *  - `organizations` / `hospitals` / `organization_members` SELECT = platform_admin
 *    (all) OR org_admin of that org. So these reads run through the ordinary
 *    cookie-wired (RLS-scoped) client — a foreign caller simply gets empty.
 *  - `commissions` SELECT = member OR org_admin of the org. An org_admin reads
 *    every commission in its org without a membership row.
 *
 * SCOPING NUANCE (lead ruling): the `/o/[org]/manage` rollup + org-tier audit are
 * for the ONE org in the URL. The bare `commission_overview()` RPC returns the
 * UNION of ALL the caller's org_admin orgs — wrong for a multi-org admin viewing
 * one org. So the org rollup + audit reads below take an explicit `orgId` and
 * filter to it; they never rely on the auth.uid() union alone.
 */

// ---------------------------------------------------------------------------
// Domain types — the org-registry + rollup contract
// ---------------------------------------------------------------------------

/** A minimal organization, as the registry/picker UIs consume it. */
export interface OrganizationSummary {
  id: string
  name: string
  slug: string
  /** Number of hospitals under this org (platform registry column). */
  hospitalCount: number
  /** Number of commissions under this org (platform registry column). */
  commissionCount: number
}

/** A hospital within an org, with its commission count (org-manage list). */
export interface HospitalSummary {
  id: string
  name: string
  slug: string
  commissionCount: number
}

/**
 * A hospital within an org, enriched with its admin roster + user count for the
 * redesigned Hospitais card — one round trip via aliased embeds (see
 * {@link listHospitalsForOrgDetailed}).
 */
export interface HospitalDetail extends HospitalSummary {
  /** The hospital's current `hospital_admin`s, sorted by name (pt-BR). */
  admins: { userId: string; fullName: string; email: string }[]
  /** Count of profiles whose `home_hospital_id` = this hospital (not the wider
   * "vínculo" set {@link listHospitalUsers} pages — home-anchored only). */
  userCount: number
}

/** A commission within an org (org-manage list); mirrors the admin commission row. */
export interface OrgCommissionSummary {
  id: string
  name: string
  slug: string
  hospitalId: string | null
  hospitalName: string | null
}

/**
 * A commission within an org, enriched with the counts + coordinator roster the
 * redesigned Comissões card needs — one round trip via aliased `memberships`
 * embeds (see {@link listManagedCommissionsDetailed}).
 */
export interface OrgCommissionDetail extends OrgCommissionSummary {
  /** Count of `staff` + `staff_admin` members (the answerable roster; excludes
   * org-level roles that may hold a commission-scoped row). */
  memberCount: number
  /** The commission's `staff_admin`s, sorted by name (pt-BR). */
  coordinators: { userId: string; fullName: string; email: string }[]
  /** Count of forms owned by the commission. */
  formCount: number
}

/**
 * One commission's volume row for the org rollup painel — the same shape as the
 * platform `CommissionOverviewRow`, but scoped to ONE org (see scoping nuance).
 */
export interface OrgOverviewRow {
  commissionId: string
  commissionName: string
  slug: string
  formCount: number
  submittedCount: number
  submittedLast30Days: number
}

// ---------------------------------------------------------------------------
// Platform-admin registry reads (RLS: platform_admin sees all orgs)
// ---------------------------------------------------------------------------

/**
 * Every organization with its hospital + commission counts, for the platform-admin
 * registry at `/admin`. Sorted by name (pt-BR). Returns `[]` for a non-platform-
 * admin caller (RLS yields no org rows). Platform-admin only by RLS.
 */
export async function listOrganizationsForPlatform(): Promise<OrganizationSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, hospitals(count), commissions(count)')
    .order('name', { ascending: true })
    .returns<
      {
        id: string
        name: string
        slug: string
        hospitals: { count: number }[]
        commissions: { count: number }[]
      }[]
    >()

  if (error || !data) return []
  return data.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    hospitalCount: o.hospitals[0]?.count ?? 0,
    commissionCount: o.commissions[0]?.count ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Org-admin reads (RLS: org_admin sees its own org only)
// ---------------------------------------------------------------------------

/**
 * Hospitals under one org, each with a commission count, for `/o/[org]/manage`.
 * Sorted by name (pt-BR). RLS-scoped: empty for a caller who is not org_admin of
 * `orgId` (nor platform_admin).
 */
export async function listHospitalsForOrg(orgId: string): Promise<HospitalSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('hospitals')
    .select('id, name, slug, commissions!commissions_hospital_id_fkey(count)')
    .eq('organization_id', orgId)
    .order('name', { ascending: true })
    .returns<
      { id: string; name: string; slug: string; commissions: { count: number }[] }[]
    >()

  if (error || !data) return []
  return data.map((h) => ({
    id: h.id,
    name: h.name,
    slug: h.slug,
    commissionCount: h.commissions[0]?.count ?? 0,
  }))
}

interface HospitalDetailRow {
  id: string
  name: string
  slug: string
  commissions: { count: number }[]
  admins: {
    principal_id: string
    profiles: { full_name: string | null; email: string | null } | null
  }[]
  users: { count: number }[]
}

/**
 * {@link listHospitalsForOrg}, enriched with the `hospital_admin` roster and a
 * home-anchored user count — one PostgREST round trip via a `commissions(count)`
 * embed, a filtered `memberships` embed (admins), and a `profiles(count)` embed
 * keyed on `home_hospital_id` (NOT the wider "vínculo" set
 * {@link listHospitalUsers} pages — this is a home-anchor count only). Backs the
 * redesigned Hospitais card (`/o/[org]/manage/hospitais`, org_admin-only).
 *
 * RLS-scoped: empty for a caller who is not org_admin of `orgId` (nor
 * platform_admin) — same authority as {@link listHospitalsForOrg}. Admin rows
 * whose profile RLS hid (null `profiles`) are dropped; the remainder is sorted
 * by name (pt-BR).
 */
export async function listHospitalsForOrgDetailed(
  orgId: string,
): Promise<HospitalDetail[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('hospitals')
    .select(
      `id, name, slug, commissions!commissions_hospital_id_fkey(count),
       admins:memberships!memberships_hospital_id_fkey(principal_id, profiles:principal_id(full_name, email)),
       users:profiles!profiles_home_hospital_id_fkey(count)`,
    )
    .eq('organization_id', orgId)
    .eq('admins.role', 'hospital_admin')
    .order('name', { ascending: true })
    .returns<HospitalDetailRow[]>()

  if (error || !data) return []

  return data.map((h) => ({
    id: h.id,
    name: h.name,
    slug: h.slug,
    commissionCount: h.commissions[0]?.count ?? 0,
    admins: h.admins
      .filter(
        (a): a is typeof a & { profiles: NonNullable<typeof a.profiles> } =>
          a.profiles !== null,
      )
      .map((a) => ({
        userId: a.principal_id,
        fullName: a.profiles.full_name ?? '',
        email: a.profiles.email ?? '',
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    userCount: h.users[0]?.count ?? 0,
  }))
}

/**
 * Commissions under one org, with their hospital, for `/o/[org]/manage` (the
 * relocated `/admin/comissoes` list). Sorted by name (pt-BR). RLS-scoped.
 */
export async function listCommissionsForOrg(
  orgId: string,
): Promise<OrgCommissionSummary[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commissions')
    .select('id, name, slug, hospital_id, hospitals:hospital_id(name)')
    .eq('organization_id', orgId)
    .order('name', { ascending: true })
    .returns<
      {
        id: string
        name: string
        slug: string
        hospital_id: string | null
        hospitals: { name: string } | null
      }[]
    >()

  if (error || !data) return []
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    hospitalId: c.hospital_id,
    hospitalName: c.hospitals?.name ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Hospital-admin tier reads (ADR 0051) — the hospital switcher + hospital-scoped
// commission list + appointment rosters behind `/o/[org]/manage`. Empty for a
// caller lacking standing.
// ---------------------------------------------------------------------------

/**
 * A current holder of an appointable org-level role (hospital_admin /
 * nsp_org_admin), for the "administradores atuais" roster on
 * `/o/[org]/manage/administradores` (ADR 0051 Decision 4).
 */
export interface RoleHolder {
  userId: string
  fullName: string
  email: string
  /** When the grant was made (`memberships.granted_at`). */
  grantedAt: string
}

interface RoleHolderRow {
  principal_id: string
  granted_at: string
  profiles: { full_name: string | null; email: string | null } | null
}

/** Map + sort role-holder rows (drop rows whose profile RLS hid; name asc pt-BR). */
function mapRoleHolders(rows: RoleHolderRow[]): RoleHolder[] {
  return rows
    .filter(
      (r): r is RoleHolderRow & { profiles: NonNullable<RoleHolderRow['profiles']> } =>
        r.profiles !== null,
    )
    .map((r) => ({
      userId: r.principal_id,
      fullName: r.profiles.full_name ?? '',
      email: r.profiles.email ?? '',
      grantedAt: r.granted_at,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'))
}

/**
 * The current `hospital_admin` holders of `hospitalId` (ADR 0051). Joins
 * `memberships → profiles` (S1·MEM; formerly `organization_members`). RLS-scoped:
 * `memberships_select` (`is_admin() OR is_org_admin_of(organization_id)`) returns
 * rows only to an org_admin of the hospital's org (or platform_admin); `[]`
 * otherwise. Sorted by name (pt-BR). `grantedAt` = `memberships.granted_at`.
 */
export async function listHospitalAdmins(hospitalId: string): Promise<RoleHolder[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('memberships')
    .select('principal_id, granted_at, profiles:principal_id(full_name, email)')
    .eq('role', 'hospital_admin')
    .eq('hospital_id', hospitalId)
    .returns<RoleHolderRow[]>()

  if (error || !data) return []
  return mapRoleHolders(data)
}

/**
 * The `hospital_admin` holders of EVERY hospital in `hospitalIds`, in one
 * `memberships` read grouped by `hospital_id` in TS — kills the per-hospital N+1
 * loop the Administradores page used to run. Same RLS + shape as
 * {@link listHospitalAdmins} (which stays intact for its other, single-hospital
 * callers); each group is sorted by name (pt-BR) via {@link mapRoleHolders}.
 * Returns `{}` for an empty `hospitalIds` (no query issued) and omits hospitals
 * with no visible admins (no key, not an empty array).
 */
export async function listHospitalAdminsForOrg(
  hospitalIds: string[],
): Promise<Record<string, RoleHolder[]>> {
  if (hospitalIds.length === 0) return {}

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('memberships')
    .select('hospital_id, principal_id, granted_at, profiles:principal_id(full_name, email)')
    .eq('role', 'hospital_admin')
    .in('hospital_id', hospitalIds)
    .returns<(RoleHolderRow & { hospital_id: string | null })[]>()

  if (error || !data) return {}

  const grouped = new Map<string, RoleHolderRow[]>()
  for (const row of data) {
    if (!row.hospital_id) continue
    const rows = grouped.get(row.hospital_id)
    if (rows) rows.push(row)
    else grouped.set(row.hospital_id, [row])
  }

  const result: Record<string, RoleHolder[]> = {}
  for (const [hospitalId, rows] of grouped) {
    result[hospitalId] = mapRoleHolders(rows)
  }
  return result
}

/**
 * The current `nsp_org_admin` holders of `orgId` (ADR 0051; the role exists in
 * Phase A but is inert until Phase B — the roster is still shown for management).
 * Same RLS + shape as {@link listHospitalAdmins}. Org-level rows (hospital_id
 * NULL), so keyed on `organization_id`.
 */
export async function listNspOrgAdmins(orgId: string): Promise<RoleHolder[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('memberships')
    .select('principal_id, granted_at, profiles:principal_id(full_name, email)')
    .eq('role', 'nsp_org_admin')
    .eq('organization_id', orgId)
    .returns<RoleHolderRow[]>()

  if (error || !data) return []
  return mapRoleHolders(data)
}

/**
 * Hospitals under `orgId` as {@link HospitalRef}, the source for the
 * `/o/[org]/manage` hospital switcher (ADR 0051 Decision 7). Sorted by name
 * (pt-BR). RLS-scoped: `hospitals_select` returns the hospitals the caller may
 * read (org_admin of the org sees all; a hospital_admin sees the hospitals it
 * administers via the ADR-0051 read path; platform_admin sees all). Empty when
 * none are readable.
 */
export async function listOrgHospitals(orgId: string): Promise<HospitalRef[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('hospitals')
    .select('id, slug, name, organization_id')
    .eq('organization_id', orgId)
    .order('name', { ascending: true })
    .returns<
      { id: string; slug: string; name: string; organization_id: string }[]
    >()

  if (error || !data) return []
  return data.map((h) => ({
    id: h.id,
    slug: h.slug,
    name: h.name,
    organizationId: h.organization_id,
  }))
}

/**
 * Commissions the caller manages within `orgId`, optionally narrowed to one
 * hospital (`hospitalId`) — the hospital-scoped variant of
 * {@link listCommissionsForOrg} for the manage area under a selected hospital
 * (ADR 0051). Pass `hospitalId = null` for the org-wide manage list (org_admin);
 * pass a hospital id to scope to that hospital (a hospital_admin's landing set).
 * Reuses {@link OrgCommissionSummary}. Sorted by name (pt-BR). RLS-scoped: the
 * `commissions_select` policy (member / org_admin / hospital_admin / PQS /
 * coordinator) is the authority — a hospital_admin only reads its hospital's
 * commissions even without the `hospitalId` filter.
 */
export async function listManagedCommissions(
  orgId: string,
  hospitalId: string | null,
): Promise<OrgCommissionSummary[]> {
  const supabase = await createClient()

  let query = supabase
    .from('commissions')
    .select('id, name, slug, hospital_id, hospitals:hospital_id(name)')
    .eq('organization_id', orgId)
  if (hospitalId) query = query.eq('hospital_id', hospitalId)

  const { data, error } = await query
    .order('name', { ascending: true })
    .returns<
      {
        id: string
        name: string
        slug: string
        hospital_id: string | null
        hospitals: { name: string } | null
      }[]
    >()

  if (error || !data) return []
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    hospitalId: c.hospital_id,
    hospitalName: c.hospitals?.name ?? null,
  }))
}

interface CommissionDetailRow {
  id: string
  name: string
  slug: string
  hospital_id: string | null
  hospitals: { name: string } | null
  members: { count: number }[]
  coordinators: {
    principal_id: string
    profiles: { full_name: string | null; email: string | null } | null
  }[]
  forms: { count: number }[]
}

/**
 * {@link listManagedCommissions}, enriched with member count, the `staff_admin`
 * coordinator roster, and form count — one PostgREST round trip via TWO aliased
 * embeds of `memberships` (one counting `staff`+`staff_admin`, one listing
 * `staff_admin` profiles) plus a `forms(count)` embed. Backs the redesigned
 * Comissões card (`/o/[org]/manage/comissoes`).
 *
 * RLS-safe for BOTH tiers: `memberships_select` and `forms_select` both gate on
 * the combined `app.is_commission_admin_of` predicate (org_admin OR
 * hospital_admin of the commission — ADR 0051), same as
 * {@link listManagedCommissions}. Coordinator rows whose profile RLS hid (null
 * `profiles`) are dropped; the remainder is sorted by name (pt-BR).
 */
export async function listManagedCommissionsDetailed(
  orgId: string,
  hospitalId?: string | null,
): Promise<OrgCommissionDetail[]> {
  const supabase = await createClient()

  let query = supabase
    .from('commissions')
    .select(
      `id, name, slug, hospital_id, hospitals:hospital_id(name),
       members:memberships!memberships_commission_id_fkey(count),
       coordinators:memberships!memberships_commission_id_fkey(principal_id, profiles:principal_id(full_name, email)),
       forms(count)`,
    )
    .eq('organization_id', orgId)
    .in('members.role', ['staff', 'staff_admin'])
    .eq('coordinators.role', 'staff_admin')
  if (hospitalId) query = query.eq('hospital_id', hospitalId)

  const { data, error } = await query
    .order('name', { ascending: true })
    .returns<CommissionDetailRow[]>()

  if (error || !data) return []

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    hospitalId: c.hospital_id,
    hospitalName: c.hospitals?.name ?? null,
    memberCount: c.members[0]?.count ?? 0,
    coordinators: c.coordinators
      .filter(
        (co): co is typeof co & { profiles: NonNullable<typeof co.profiles> } =>
          co.profiles !== null,
      )
      .map((co) => ({
        userId: co.principal_id,
        fullName: co.profiles.full_name ?? '',
        email: co.profiles.email ?? '',
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    formCount: c.forms[0]?.count ?? 0,
  }))
}

/**
 * The org rollup painel: one volume row per commission in `orgId` (form +
 * submission counts), for `/o/[org]/manage`. SCOPED TO THE ONE ORG (see the
 * scoping nuance) by filtering the union `commission_overview()` returns down to
 * the org's commissions — correct for a multi-org admin. RLS-scoped: `[]` for a
 * non-org-admin of `orgId`.
 */
export async function getOrgCommissionOverview(
  orgId: string,
): Promise<OrgOverviewRow[]> {
  const supabase = await createClient()

  // The org's commission ids (RLS: org_admin reads its org's commissions).
  const { data: comms } = await supabase
    .from('commissions')
    .select('id')
    .eq('organization_id', orgId)
    .returns<{ id: string }[]>()

  const orgCommissionIds = new Set((comms ?? []).map((c) => c.id))
  if (orgCommissionIds.size === 0) return []

  // commission_overview() returns the UNION of all the caller's org_admin orgs;
  // filter to THIS org's commissions so a multi-org admin sees one org's painel.
  const { data, error } = await supabase.rpc('commission_overview')
  if (error || !data) return []

  return data
    .filter((r) => orgCommissionIds.has(r.commission_id))
    .map((r) => ({
      commissionId: r.commission_id,
      commissionName: r.commission_name,
      slug: r.slug,
      formCount: Number(r.form_count),
      submittedCount: Number(r.submitted_count),
      submittedLast30Days: Number(r.submitted_last_30_days),
    }))
}
