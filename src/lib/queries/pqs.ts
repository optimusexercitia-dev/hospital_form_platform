/**
 * NSP (Núcleo de Segurança do Paciente / PQS department) data-access (Phase 14a —
 * NSP Foundation; Architecture Rule 9; Rule 12 — PHI/HIPAA). Backs the NSP
 * inbox/queue under `/admin/nsp` and the `patient_safety` TS-layer flag gate.
 *
 * RLS / access (Rule 1 + Rule 12):
 *  - The PQS inbox is served by the `pqs_inbox` DEFINER RPC, `is_pqs_member`-gated
 *    (= `app.is_admin()` today; membership-ready). It is a PHI-FREE queue — it
 *    returns governance metadata only and NEVER selects patient identifiers
 *    (minimum-necessary). A non-PQS caller gets `[]`.
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
import type { PqsRosterMember, PqsEligibleUser } from '@/lib/pqs/roster-types'

// The CLIENT-SAFE inbox types live in `@/lib/safety/types` (ZERO imports) so the
// NSP UI imports them WITHOUT dragging this server-only module into the client
// bundle (P14a-002). Re-exported so existing `import … from '@/lib/queries/pqs'`
// consumers keep resolving unchanged.
export type { PqsInboxItem, PqsInboxFilters } from '@/lib/safety/types'
export type { PqsDepartment } from '@/lib/safety/triage-types'
export type { PqsRosterMember, PqsEligibleUser } from '@/lib/pqs/roster-types'

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

/**
 * @deprecated NSP-per-org (ADR 0042): `pqs_department` is now PER-ORG (multiple
 * rows), so the old singleton read (`.limit(1)`) would return an ARBITRARY org's
 * config — a latent cross-org leak. Use {@link getPqsDepartmentForOrg}. Returns
 * `null` (safe-empty, not throw — it was a render-time reader) so the existing
 * single-org config page keeps compiling + rendering empty until sub-phase B
 * re-homes it to `/o/[org]/nsp/configuracoes` and passes `orgId`.
 */
// TODO(nsp-per-org B): remove when the per-org config route supplies orgId
export async function getPqsDepartment(): Promise<PqsDepartment | null> {
  return null
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
// NSP-per-org (sub-phase A; ADR 0042) — CONTRACT STUBS.
//
// These are the new/changed query-layer signatures sub-phase B (frontend) builds
// against. The PQS roster is now PER-ORG: enrollment in an org's roster grants that
// org's PHI read; a per-org `nsp_coordinator` curates the roster (three-way duty
// separation org_admin ≠ coordinator ≠ member). All of these route through the
// org-scoped DEFINER RPCs landed by migration `20260630000000_nsp_per_org.sql`
// (A2/A3); bodies throw until then. Keep the SIGNATURES stable once posted — a shape
// change goes through the lead so `frontend` adapts (CLAUDE.md contract-first rule).
// ===========================================================================

/**
 * The org-scoped NSP-access probe: is the CURRENT user enrolled in `orgId`'s PQS
 * roster (`app.is_pqs_member_of(orgId, auth.uid())`)? This is the gate the per-org
 * QPS dashboard data-layer + the `/o/[org]/nsp/**` route guard use (the FE seam
 * `getNspAccessByOrg`). A safe-default `false` reader — it is called at render time
 * and must never throw. Backed by the `is_pqs_member_of_self(p_org_id)` DEFINER RPC.
 *
 * NOTE the no-arg `is_pqs_member_self()` (in `referrals.ts`) is KEPT as the
 * nav-level "member of ANY org" probe; THIS is its org-scoped sibling.
 */
export async function isPqsMemberOfSelf(orgId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_pqs_member_of_self', {
    p_org_id: orgId,
  })
  if (error) return false
  return data === true
}

/**
 * Is the current user the per-org `nsp_coordinator` of `orgId`
 * (`app.is_nsp_coordinator_of(orgId, auth.uid())`)? Gates the per-org roster
 * curation UI (enroll/remove/list) and the org-admin "appoint coordinator" affordance
 * check. Safe-default `false`; backed by an `is_nsp_coordinator_of_self(p_org_id)`
 * DEFINER probe.
 */
export async function isNspCoordinatorOfSelf(orgId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_nsp_coordinator_of_self', {
    p_org_id: orgId,
  })
  if (error) return false
  return data === true
}

/**
 * List the enrolled members of `orgId`'s PQS roster, name-sorted (pt-BR). Backed by
 * the `list_pqs_members(p_org_id)` DEFINER RPC, gated **coordinator-only** (curation
 * duty — NOT every enrolled member). A non-coordinator caller gets `[]` (the RPC
 * raises 42501; this maps to empty for the read path).
 */
export async function listPqsMembers(orgId: string): Promise<PqsRosterMember[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_pqs_members', {
    p_org_id: orgId,
  })
  if (error || !data) return []
  // The DEFINER RPC already shapes camelCase keys (jsonb_build_object); narrow the
  // jsonb to the domain rows (a non-coordinator caller gets `[]` from the 42501 →
  // error branch above).
  return (data as unknown as PqsRosterMember[]).map((m) => ({
    userId: m.userId,
    fullName: m.fullName,
    email: m.email,
    addedAt: m.addedAt,
    addedBy: m.addedBy,
  }))
}

/**
 * The singleton-per-org NSP/PQS-department config for `orgId` (name + RCA due-window
 * the config area edits). PHI-free; supersedes the global {@link getPqsDepartment}
 * (which read the lone singleton row). RLS-scoped read; `null` if absent.
 */
export async function getPqsDepartmentForOrg(
  orgId: string,
): Promise<PqsDepartment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pqs_department')
    .select('name, rca_default_due_days')
    .eq('organization_id', orgId)
    .maybeSingle()
    .returns<{ name: string; rca_default_due_days: number } | null>()

  if (error || !data) return null
  return { name: data.name, defaultDueDays: data.rca_default_due_days }
}

/**
 * Users eligible to be enrolled in `orgId`'s PQS roster OR appointed `nsp_coordinator`
 * — DISTINCT users with ANY membership in the org (org-level ∪ commission members of
 * the org's commissions), name-sorted (pt-BR). Backed by the
 * `list_org_eligible_users_for_pqs(p_org_id)` DEFINER RPC (a coordinator can't read
 * `commission_members` under RLS, so the union is assembled DEFINER-side), gated to
 * coordinator OR org_admin of the org. A caller with neither role gets `[]` (the RPC
 * raises 42501 → error branch). PHI-free.
 */
export async function listOrgEligibleUsersForPqs(
  orgId: string,
): Promise<PqsEligibleUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_org_eligible_users_for_pqs', {
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
 * The CURRENT `nsp_coordinator`s of `orgId` (for the org-admin appoint surface, so an
 * admin sees who is appointed + can revoke). Reads `organization_members` filtered to
 * `role = 'nsp_coordinator'` joined to `profiles`; RLS (`organization_members_select`
 * = `is_admin OR is_org_admin_of`) scopes it to the org_admin caller. PHI-free; `[]`
 * for a non-admin (RLS yields no rows).
 */
export async function listNspCoordinators(
  orgId: string,
): Promise<PqsEligibleUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id, profiles:user_id(full_name, email)')
    .eq('organization_id', orgId)
    .eq('role', 'nsp_coordinator')
    .returns<
      { user_id: string; profiles: { full_name: string | null; email: string | null } | null }[]
    >()

  if (error || !data) return []
  return data
    .map((r) => ({
      userId: r.user_id,
      fullName: r.profiles?.full_name ?? null,
      email: r.profiles?.email ?? null,
    }))
    .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'pt-BR'))
}
