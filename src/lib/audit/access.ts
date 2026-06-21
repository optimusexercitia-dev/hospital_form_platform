import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { AuditAction, AuditEntityType } from '@/lib/queries/audit'
import type { Json } from '@/lib/types/database'

/**
 * Explicit sensitive-READ / EXPORT audit instrumentation (Phase 13 — Audit Trail;
 * ADR 0029 §6). The instrumentation triggers (migration …120001) capture every
 * MUTATION path-independently, but a sensitive READ or EXPORT leaves no row change
 * for a trigger to see, so the FINITE set of such call sites logs explicitly here
 * via the `public.log_audit_access` DEFINER wrapper (which accepts ONLY `.read` /
 * `.exported` actions and forwards to `app.audit_write`; attribution is automatic
 * — DEFINER preserves `auth.uid()`).
 *
 * BEST-EFFORT by design (the lead's B5 refinement): a logging failure NEVER blocks
 * the read/export it accompanies — we swallow the error. The writer itself no-ops
 * while the `audit_trail` flag is OFF, so this is inert until the feature is live.
 * Only `.read`/`.exported` actions are permitted (a compile-time `AuditAction` plus
 * the DB-side CHECK), so this surface cannot forge a mutation row.
 */
/** The finite set of sensitive read/export actions this surface may emit (must
 * match the positive allow-list in `public.log_audit_access`, ADR 0029 §6). */
export type AuditAccessAction = Extract<
  AuditAction,
  | 'response.opened_foreign'
  | 'response.exported'
  | 'audit.exported'
  // patient-safety PHI READ (Phase 14a; Rule 11/12 — HIPAA requires logging PHI
  // access). Added to the DB-side positive allow-list in migration …121004.
  | 'event_patient.read'
  // PHI-bearing clinical-detail READS (WS B; Rule 11/12) — a detail-open of an
  // event / triage / RCA / CAPA / meeting / interview record on the RLS-scoped path.
  | 'safety_event.viewed'
  | 'triage.viewed'
  | 'rca.viewed'
  | 'capa.viewed'
  | 'meeting.viewed'
  | 'interview.viewed'
  // inter-committee referrals (Phase 22; Rule 11/12) — the audited PHI-identifier
  // read + the PHI-bearing detail/document open. Added to the DB-side allow-list in
  // migration 20260620014000_referrals_rpcs.sql.
  | 'referral_patient.read'
  | 'referral.viewed'
>

export async function logAuditAccess(params: {
  action: AuditAccessAction
  entityType: AuditEntityType
  entityId: string
  /** Sensitive reads/exports are ALWAYS commission-scoped (the global chain is
   * only for admin/system mutations, never these access rows). */
  commissionId: string
  summary: string
  metadata?: Json
}): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.rpc('log_audit_access', {
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId,
      p_commission: params.commissionId,
      p_summary: params.summary,
      p_metadata: (params.metadata ?? {}) as Json,
    })
  } catch {
    // Best-effort: never let an audit-logging failure break the underlying read.
  }
}

/**
 * WS B convenience: emit a clinical-detail `.viewed` audit row for a record that
 * hangs off a patient-safety event, attributing it to the event's reporting
 * (provenance) commission. Resolves the commission with a lightweight PK lookup;
 * best-effort throughout (a missing event or a failed write never breaks the read).
 * Use for the event/triage/RCA/CAPA detail reads that live under one event.
 */
export async function auditClinicalView(params: {
  eventId: string
  action: AuditAccessAction
  entityType: AuditEntityType
  entityId: string
  summary: string
}): Promise<void> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('patient_safety_event')
      .select('reporting_commission_id')
      .eq('id', params.eventId)
      .maybeSingle()
      .returns<{ reporting_commission_id: string } | null>()
    if (!data) return
    await logAuditAccess({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      commissionId: data.reporting_commission_id,
      summary: params.summary,
    })
  } catch {
    // Best-effort.
  }
}
