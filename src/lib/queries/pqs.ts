/**
 * NSP (Núcleo de Segurança do Paciente / PQS department) data-access (Phase 14a —
 * NSP Foundation; Architecture Rule 9; Rule 12 — PHI/HIPAA; per-HOSPITAL under ADR
 * 0052, re-keyed from the per-org ADR 0042 shape). Backs the per-hospital NSP
 * inbox/queue + roster + config under `/o/[org]/nsp/**`, plus the `patient_safety`
 * TS-layer flag gate.
 *
 * RLS / access (Rule 1 + Rule 12):
 *  - The PQS inbox is served by the `pqs_inbox` DEFINER RPC, HOSPITAL-SCOPED
 *    (NSP-per-hospital): it returns only events whose reporting commission is in one
 *    of the caller's operator hospitals (enrolled member OR appointed coordinator).
 *    PHI-FREE queue — governance metadata only, NEVER patient identifiers
 *    (minimum-necessary). A non-operator caller gets `[]`.
 *  - {@link patientSafetyEnabled} is the TS-layer flag read (mirror
 *    `meetingsEnabled`/`interviewsEnabled`/`auditTrailEnabled`).
 */

import { createClient } from '@/lib/supabase/server'
import type {
  EventStatus,
  OwnerKind,
  PqsInboxFilters,
  PqsInboxItem,
  SuspectedHarmLevel,
} from '@/lib/safety/types'
import type { PqsDepartment } from '@/lib/safety/triage-types'
import type {
  PqsRosterMember,
  PqsEligibleUser,
  NspHospitalGrant,
} from '@/lib/pqs/roster-types'

// The CLIENT-SAFE inbox types live in `@/lib/safety/types` (ZERO imports) so the
// NSP UI imports them WITHOUT dragging this server-only module into the client
// bundle (P14a-002). Re-exported so existing `import … from '@/lib/queries/pqs'`
// consumers keep resolving unchanged.
export type { PqsInboxItem, PqsInboxFilters } from '@/lib/safety/types'
export type { PqsDepartment } from '@/lib/safety/triage-types'
export type {
  PqsRosterMember,
  PqsEligibleUser,
  NspHospitalGrant,
} from '@/lib/pqs/roster-types'

interface PqsInboxRow {
  id: string
  code: string
  title: string
  status: string
  suspected_harm_level: string
  reporting_commission_id: string
  reporting_commission_name: string | null
  current_owner_kind: string
  current_owner_commission_id: string | null
  case_id: string | null
  case_number: number | null
  reported_at: string
  acknowledged_at: string | null
}

/**
 * The NSP triage queue, newest-first. Backed by the `pqs_inbox` DEFINER RPC
 * (`is_pqs_member`-gated, PHI-free). A non-PQS caller gets `[]`.
 */
export async function pqsInbox(
  filters: PqsInboxFilters = {},
): Promise<PqsInboxItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('pqs_inbox', {
      p_status: filters.status ?? undefined,
      p_suspected_harm_level: filters.suspectedHarmLevel ?? undefined,
      p_reporting_commission_id: filters.reportingCommissionId ?? undefined,
    })
    .returns<PqsInboxRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    status: r.status as EventStatus,
    suspectedHarmLevel: r.suspected_harm_level as SuspectedHarmLevel,
    reportingCommissionId: r.reporting_commission_id,
    reportingCommissionName: r.reporting_commission_name,
    currentOwnerKind: r.current_owner_kind as OwnerKind,
    currentOwnerCommissionId: r.current_owner_commission_id,
    caseId: r.case_id,
    caseNumber: r.case_number,
    reportedAt: r.reported_at,
    acknowledgedAt: r.acknowledged_at,
  }))
}

/** Whether the `patient_safety` feature flag is ON (TS-layer gate; mirrors
 * `meetingsEnabled`/`interviewsEnabled`/`auditTrailEnabled`). A feature-flag reader
 * MUST safe-default to `false` — it is called at render time by `c/[slug]/layout.tsx`,
 * so it can never throw. Backed by the `patient_safety_enabled` DEFINER read;
 * returns `false` on any error (exactly mirroring `auditTrailEnabled()`). */
export async function patientSafetyEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('patient_safety_enabled')
  if (error) return false
  return data === true
}

// ===========================================================================
// NSP-per-hospital (Phase B; ADR 0052) — CONTRACT STUBS.
//
// The PQS roster is now PER-HOSPITAL (re-keyed from per-org, ADR 0042): enrollment
// in a HOSPITAL's roster (`pqs_members` PK `(hospital_id, user_id)`) grants that
// hospital's PHI read, and a per-hospital `nsp_coordinator` is a FULL LOCAL OPERATOR
// (implicit PHI read + write, decision 12). The three-tier chain is org_admin
// (appoints) → nsp_org_admin (curates any hospital's roster + appoints coordinators,
// ZERO PHI) → nsp_coordinator (curates own hospital + reads/writes). All of these
// route through the hospital-scoped DEFINER RPCs landed by migration
// `20260710000000_nsp_per_hospital.sql` (B1–B5); read/probe bodies safe-default
// (`false`/`null`/`[]`) so `frontend` can build B6–B8 against these frozen types
// without runtime crashes. Keep the SIGNATURES stable — a shape change goes through
// the lead so `frontend` adapts (CLAUDE.md contract-first rule).
// ===========================================================================

/**
 * The hospital-scoped NSP-access probe: is the CURRENT user enrolled in
 * `hospitalId`'s PQS roster (`app.is_pqs_member_of(hospitalId, auth.uid())`)? Gates
 * the hospital-scoped NSP data-layer + `/o/[org]/nsp/**?hospital=` route guard. A
 * safe-default `false` reader — called at render time, must never throw. Backed by
 * the `is_pqs_member_of_self(p_hospital_id)` DEFINER RPC.
 *
 * NOTE: the no-arg `is_pqs_member_self()` (in `referrals.ts`) is KEPT as the
 * nav-level "member of ANY hospital roster" probe; THIS is its hospital-scoped
 * sibling. To gate a WRITE/read surface for the local operator (coordinator OR
 * member), pair with {@link isNspCoordinatorOfHospital} or read from
 * {@link listMyNspHospitals}.
 */
export async function isPqsMemberOfHospital(hospitalId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_pqs_member_of_self', {
    p_hospital_id: hospitalId,
  })
  if (error) return false
  return data === true
}

/**
 * Is the current user the per-hospital `nsp_coordinator` of `hospitalId`
 * (`app.is_nsp_coordinator_of(hospitalId, auth.uid())`)? A coordinator is a FULL
 * local operator (decision 12): implicit PHI read + NSP write for their hospital,
 * plus roster/config curation. Safe-default `false`; backed by an
 * `is_nsp_coordinator_of_self(p_hospital_id)` DEFINER probe.
 */
export async function isNspCoordinatorOfHospital(
  hospitalId: string,
): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_nsp_coordinator_of_self', {
    p_hospital_id: hospitalId,
  })
  if (error) return false
  return data === true
}

/**
 * The hospitals whose NSP the CURRENT user OPERATES — enrolled `pqs_member` OR
 * appointed `nsp_coordinator` — for the NSP hospital switcher (B6). One entry per
 * operator hospital, name-sorted (pt-BR); `role` reports the STRONGEST grant
 * (`'coordinator'` wins over `'member'` when the user holds both). Empty for a
 * non-operator. Backed by the `list_my_nsp_hospitals()` DEFINER RPC. Safe-default
 * `[]`; PHI-free.
 */
export async function listMyNspHospitals(): Promise<NspHospitalGrant[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_my_nsp_hospitals')
  if (error || !data) return []
  return (data as unknown as NspHospitalGrant[]).map((g) => ({
    hospitalId: g.hospitalId,
    hospitalName: g.hospitalName,
    orgId: g.orgId,
    role: g.role,
  }))
}

/**
 * List the enrolled members of `hospitalId`'s PQS roster, name-sorted (pt-BR).
 * Backed by the `list_pqs_members(p_hospital_id)` DEFINER RPC, gated to the
 * hospital's `nsp_coordinator` OR the org's `nsp_org_admin` (curation duty). A caller
 * with neither role gets `[]` (the RPC raises 42501; mapped to empty for the read
 * path).
 */
export async function listPqsMembers(
  hospitalId: string,
): Promise<PqsRosterMember[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_pqs_members', {
    p_hospital_id: hospitalId,
  })
  if (error || !data) return []
  // The DEFINER RPC already shapes camelCase keys (jsonb_build_object); narrow the
  // jsonb to the domain rows.
  return (data as unknown as PqsRosterMember[]).map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    email: m.email,
    addedAt: m.addedAt,
    addedBy: m.addedBy,
  }))
}

/**
 * The per-hospital NSP/PQS-department config for `hospitalId` (name + RCA due-window
 * the config area edits) — one row per hospital (NSP-per-hospital, ADR 0052).
 * PHI-free; RLS-scoped read (`pqs_department_select` = any authenticated); `null` if
 * absent.
 */
export async function getPqsDepartmentForHospital(
  hospitalId: string,
): Promise<PqsDepartment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pqs_department')
    .select('name, rca_default_due_days')
    .eq('hospital_id', hospitalId)
    .maybeSingle()
    .returns<{ name: string; rca_default_due_days: number } | null>()

  if (error || !data) return null
  return { name: data.name, defaultDueDays: data.rca_default_due_days }
}

/**
 * Users eligible to be enrolled in `hospitalId`'s PQS roster — DISTINCT users with
 * membership in the hospital's org (org-level ∪ commission members of the hospital's
 * commissions), name-sorted (pt-BR). Backed by the
 * `list_hospital_eligible_users_for_pqs(p_hospital_id)` DEFINER RPC (assembles the
 * union DEFINER-side), gated to the hospital's `nsp_coordinator` OR the org's
 * `nsp_org_admin`. A caller with neither role gets `[]` (the RPC raises 42501 → error
 * branch). PHI-free.
 */
export async function listHospitalEligibleUsersForPqs(
  hospitalId: string,
): Promise<PqsEligibleUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(
    'list_hospital_eligible_users_for_pqs',
    { p_hospital_id: hospitalId },
  )
  if (error || !data) return []
  return (data as unknown as PqsEligibleUser[]).map((u) => ({
    userId: u.userId,
    fullName: u.fullName,
    email: u.email,
  }))
}

/**
 * The ORG-WIDE eligible-user pool for `orgId` — DISTINCT users with ANY membership in
 * the org (org-level ∪ commission members of ANY hospital's commissions), name-sorted
 * (pt-BR). This is the picker pool for appointing ORG-LEVEL roles (nsp_org_admin,
 * hospital_admin) on the `manage/administradores` page — it INCLUDES org-level-only
 * users (no commission membership), which {@link listHospitalEligibleUsersForPqs}
 * (a per-hospital roster pool) would miss. Backed by the `list_org_eligible_users(
 * p_org_id)` DEFINER RPC (assembles the union DEFINER-side), gated to org_admin OR
 * nsp_org_admin of the org. A caller with neither role gets `[]`. PHI-free.
 */
export async function listOrgEligibleUsers(
  orgId: string,
): Promise<PqsEligibleUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_org_eligible_users', {
    p_org_id: orgId,
  })
  if (error || !data) return []
  return (data as unknown as PqsEligibleUser[]).map((u) => ({
    userId: u.userId,
    fullName: u.fullName,
    email: u.email,
  }))
}

/**
 * The CURRENT `nsp_coordinator`s of `orgId`, keyed by hospital (for the appoint
 * surface, so the appointer sees who is coordinator of which hospital + can revoke).
 * Reads `organization_members` filtered to `role = 'nsp_coordinator'` joined to
 * `profiles`; RLS scopes it to the org_admin / nsp_org_admin caller. PHI-free; `[]`
 * for an unauthorized caller (RLS yields no rows). Each row carries `hospitalId`
 * (a per-hospital coordinator, ADR 0052; `hospital_id` is NOT NULL for the role).
 */
export async function listNspCoordinators(
  orgId: string,
): Promise<(PqsEligibleUser & { hospitalId: string | null })[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, hospital_id, profiles:user_id(full_name, email)')
    .eq('organization_id', orgId)
    .eq('role', 'nsp_coordinator')
    .returns<
      {
        user_id: string
        hospital_id: string | null
        profiles: { full_name: string | null; email: string | null } | null
      }[]
    >()

  if (error || !data) return []
  return data
    .map((r) => ({
      userId: r.user_id,
      hospitalId: r.hospital_id,
      fullName: r.profiles?.full_name ?? null,
      email: r.profiles?.email ?? null,
    }))
    .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'pt-BR'))
}
