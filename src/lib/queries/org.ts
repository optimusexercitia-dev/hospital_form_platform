import { createClient } from '@/lib/supabase/server'

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

/** A commission within an org (org-manage list); mirrors the admin commission row. */
export interface OrgCommissionSummary {
  id: string
  name: string
  slug: string
  hospitalId: string | null
  hospitalName: string | null
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
    .select('id, name, slug, commissions(count)')
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
