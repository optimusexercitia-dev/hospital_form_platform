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

// The CLIENT-SAFE inbox types live in `@/lib/safety/types` (ZERO imports) so the
// NSP UI imports them WITHOUT dragging this server-only module into the client
// bundle (P14a-002). Re-exported so existing `import … from '@/lib/queries/pqs'`
// consumers keep resolving unchanged.
export type { PqsInboxItem, PqsInboxFilters } from '@/lib/safety/types'
export type { PqsDepartment } from '@/lib/safety/triage-types'

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
 * The singleton NSP/PQS-department config (name + the RCA due-window the NSP config
 * area edits). PHI-free, any-authenticated READ (the `pqs_department` SELECT policy
 * is `to authenticated using(true)`, …121005). Returns `null` if the singleton is
 * somehow absent (defensive — the seed inserts exactly one).
 */
export async function getPqsDepartment(): Promise<PqsDepartment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pqs_department')
    .select('name, rca_default_due_days')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
    .returns<{ name: string; rca_default_due_days: number } | null>()

  if (error || !data) return null
  return { name: data.name, defaultDueDays: data.rca_default_due_days }
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
