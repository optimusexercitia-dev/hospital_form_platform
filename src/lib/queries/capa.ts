/**
 * Patient-safety CAPA data-access (Phase 14d — Corrective Action Plan, Effectiveness
 * & Closure; Architecture Rule 9 — all reads go through `src/lib/queries/`). Backs the
 * CAPA workspace + KPIs under `/o/[org]/nsp/**` (per-org, ADR 0042).
 *
 * The domain TYPES are the FROZEN contract the frontend builds against; they live in
 * the import-free, client-safe `@/lib/safety/capa-types` (re-exported here). All reads
 * use the RLS-scoped cookie client and are PHI-FREE.
 *
 * RLS (the security boundary — Rule 1):
 *  - `capa_plan` + children member-READ = the SOURCE's scope: event/rca-sourced plans
 *    via `app.can_read_event` (NSP + reporting/holding committee); meeting/indicator/
 *    audit/manual-sourced plans = PQS/admin only (the non-event scopes arrive in
 *    Phases 15/18). WRITE = PQS/admin; an action assignee advances ONLY via the narrow
 *    `advance/complete_capa_action` DEFINER path.
 *  - Implementation evidence reuses the immutable `nsp-evidence` bucket (CAPA path);
 *    NO update/delete (Rule 6). Reads via signed URLs.
 */

import { createClient } from '@/lib/supabase/server'
import { auditClinicalView } from '@/lib/audit/access'
import type {
  CapaAction,
  CapaActionEvidence,
  CapaActionTask,
  CapaEffectiveness,
  CapaKpis,
  CapaMeasure,
  CapaMeasureResult,
  CapaPlan,
} from '@/lib/safety/capa-types'

// Re-export the client-safe contract so consumers import types/labels from the query
// module too (mirrors the Phase-14a/b/c re-export pattern).
export type {
  CapaAction,
  CapaActionEvidence,
  CapaActionStatus,
  CapaActionStrength,
  CapaActionTask,
  CapaClassification,
  CapaEffectiveness,
  CapaEffectivenessVerdict,
  CapaEvidenceKind,
  CapaKpis,
  CapaMeasure,
  CapaMeasureResult,
  CapaPlan,
  CapaSource,
  CapaStatus,
} from '@/lib/safety/capa-types'
export {
  CAPA_SOURCE_LABELS,
  CAPA_CLASSIFICATION_LABELS,
  CAPA_STATUS_LABELS,
  CAPA_ACTION_STRENGTH_LABELS,
  CAPA_ACTION_STATUS_LABELS,
  CAPA_EVIDENCE_KIND_LABELS,
  CAPA_EFFECTIVENESS_VERDICT_LABELS,
  CAPA_ACTION_STRENGTH_ORDER,
} from '@/lib/safety/capa-types'

import type {
  CapaActionStatus,
  CapaActionStrength,
  CapaClassification,
  CapaEffectivenessVerdict,
  CapaEvidenceKind,
  CapaSource,
  CapaStatus,
} from '@/lib/safety/capa-types'

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

interface CapaPlanRow {
  id: string
  code: string
  source: string
  source_rca_id: string | null
  source_event_id: string | null
  source_meeting_id: string | null
  source_indicator_id: string | null
  source_audit_finding_id: string | null
  classification: string
  status: string
  lessons_learned_md: string | null
  created_at: string
  closed_at: string | null
}

const CAPA_PLAN_SELECT =
  'id, code, source, source_rca_id, source_event_id, source_meeting_id, ' +
  'source_indicator_id, source_audit_finding_id, classification, status, ' +
  'lessons_learned_md, created_at, closed_at'

function sourceIdOf(r: CapaPlanRow): string | null {
  switch (r.source) {
    case 'rca':
      return r.source_rca_id
    case 'event':
      return r.source_event_id
    case 'meeting':
      return r.source_meeting_id
    case 'indicator':
      return r.source_indicator_id
    case 'audit_finding':
      return r.source_audit_finding_id
    default:
      return null
  }
}

async function mapCapaPlan(r: CapaPlanRow): Promise<CapaPlan> {
  const supabase = await createClient()

  // Resolve the event scope (event/rca-sourced) for the header WITHOUT an RPC:
  // event-sourced → source_event_id; rca-sourced → the rca's event_id.
  let eventId: string | null = null
  if (r.source === 'event') {
    eventId = r.source_event_id
  } else if (r.source === 'rca' && r.source_rca_id) {
    const { data: rcaRow } = await supabase
      .from('rca')
      .select('event_id')
      .eq('id', r.source_rca_id)
      .maybeSingle()
      .returns<{ event_id: string } | null>()
    eventId = rcaRow?.event_id ?? null
  }

  let eventCode: string | null = null
  if (eventId) {
    const { data: e } = await supabase
      .from('patient_safety_event')
      .select('code')
      .eq('id', eventId)
      .maybeSingle()
      .returns<{ code: string } | null>()
    eventCode = e?.code ?? null
  }

  // PQS/admin manage signal (DEFINER read; the app helper is not PostgREST-callable).
  const { data: canManage } = await supabase.rpc('capa_viewer_can_manage', {
    p_capa_id: r.id,
  })

  return {
    id: r.id,
    code: r.code,
    source: r.source as CapaSource,
    sourceId: sourceIdOf(r),
    eventId,
    eventCode,
    classification: r.classification as CapaClassification,
    status: r.status as CapaStatus,
    lessonsLearnedMd: r.lessons_learned_md,
    openedAt: r.created_at,
    closedAt: r.closed_at,
    viewerCanManage: canManage === true,
  }
}

/** One CAPA plan by id (with `viewerCanManage`). Null when out of scope. */
export async function getCapaPlan(capaId: string): Promise<CapaPlan | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_plan')
    .select(CAPA_PLAN_SELECT)
    .eq('id', capaId)
    .maybeSingle()
    .returns<CapaPlanRow | null>()

  if (!data) return null
  const plan = await mapCapaPlan(data)

  // WS B (Rule 11/12): audit a CAPA detail-open (free-text lessons-learned /
  // effectiveness method) when it is event/RCA-scoped — attribute to the event's
  // reporting commission. Non-event-sourced CAPA (e.g. meeting) carries no PHI event.
  if (plan.eventId) {
    await auditClinicalView({
      eventId: plan.eventId,
      action: 'capa.viewed',
      entityType: 'capa_plan',
      entityId: plan.id,
      summary: 'Plano de ação (CAPA) visualizado',
    })
  }

  return plan
}

/** All CAPA plans opened from an event (event-sourced OR via the event's RCA), newest-first. */
export async function listCapaPlansForEvent(eventId: string): Promise<CapaPlan[]> {
  const supabase = await createClient()
  // Event-sourced directly, OR rca-sourced where the rca belongs to this event.
  const { data: rcaRow } = await supabase
    .from('rca')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle()
    .returns<{ id: string } | null>()

  let query = supabase.from('capa_plan').select(CAPA_PLAN_SELECT)
  query = rcaRow?.id
    ? query.or(`source_event_id.eq.${eventId},source_rca_id.eq.${rcaRow.id}`)
    : query.eq('source_event_id', eventId)

  const { data } = await query
    .order('created_at', { ascending: false })
    .returns<CapaPlanRow[]>()

  return Promise.all((data ?? []).map(mapCapaPlan))
}

/** All CAPA plans opened from a specific RCA, newest-first. */
export async function listCapaPlansForRca(rcaId: string): Promise<CapaPlan[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_plan')
    .select(CAPA_PLAN_SELECT)
    .eq('source_rca_id', rcaId)
    .order('created_at', { ascending: false })
    .returns<CapaPlanRow[]>()

  return Promise.all((data ?? []).map(mapCapaPlan))
}

interface CapaActionRow {
  id: string
  capa_id: string
  title: string
  owner: string | null
  assignee_user_id: string | null
  due_date: string | null
  action_strength: string
  success_measure: string | null
  root_cause_id: string | null
  status: string
  position: number
  assignee: { full_name: string | null } | null
}

/** The plan's corrective actions, ordered by `position`. */
export async function listCapaActions(capaId: string): Promise<CapaAction[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_action')
    .select(
      'id, capa_id, title, owner, assignee_user_id, due_date, action_strength, ' +
        'success_measure, root_cause_id, status, position, assignee:assignee_user_id(full_name)',
    )
    .eq('capa_id', capaId)
    .order('position', { ascending: true })
    .returns<CapaActionRow[]>()

  return (data ?? []).map((a) => ({
    id: a.id,
    capaId: a.capa_id,
    title: a.title,
    owner: a.owner,
    assigneeUserId: a.assignee_user_id,
    assigneeName: a.assignee?.full_name ?? null,
    dueDate: a.due_date,
    actionStrength: a.action_strength as CapaActionStrength,
    successMeasure: a.success_measure,
    rootCauseId: a.root_cause_id,
    status: a.status as CapaActionStatus,
    position: a.position,
  }))
}

interface CapaTaskRow {
  id: string
  action_id: string
  description: string
  is_done: boolean
  position: number
}

/** One action's execution tasks, ordered by `position`. */
export async function listCapaActionTasks(actionId: string): Promise<CapaActionTask[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_action_task')
    .select('id, action_id, description, is_done, position')
    .eq('action_id', actionId)
    .order('position', { ascending: true })
    .returns<CapaTaskRow[]>()

  return (data ?? []).map((t) => ({
    id: t.id,
    actionId: t.action_id,
    description: t.description,
    isDone: t.is_done,
    position: t.position,
  }))
}

interface CapaEvidenceRow {
  id: string
  action_id: string
  kind: string
  title: string
  storage_path: string | null
  external_url: string | null
  created_at: string
}

/** One action's non-deleted implementation evidence (document rows carry a signed `openUrl`). */
export async function listCapaActionEvidence(
  actionId: string,
): Promise<CapaActionEvidence[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_action_evidence')
    .select('id, action_id, kind, title, storage_path, external_url, created_at')
    .eq('action_id', actionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<CapaEvidenceRow[]>()

  return Promise.all(
    (data ?? []).map(async (r) => {
      let openUrl: string | null = null
      if (r.kind === 'document' && r.storage_path) {
        const { data: signed } = await supabase.storage
          .from('nsp-evidence')
          .createSignedUrl(r.storage_path, 3600)
        openUrl = signed?.signedUrl ?? null
      }
      return {
        id: r.id,
        actionId: r.action_id,
        kind: r.kind as CapaEvidenceKind,
        title: r.title,
        openUrl,
        externalUrl: r.external_url,
        createdAt: r.created_at,
      }
    }),
  )
}

interface CapaMeasureRow {
  id: string
  capa_id: string
  name: string
  target: string | null
  definition: string | null
  indicator_id: string | null
  position: number
}

/** The plan's measures, ordered by `position`. */
export async function listCapaMeasures(capaId: string): Promise<CapaMeasure[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_measure')
    .select('id, capa_id, name, target, definition, indicator_id, position')
    .eq('capa_id', capaId)
    .order('position', { ascending: true })
    .returns<CapaMeasureRow[]>()

  return (data ?? []).map((m) => ({
    id: m.id,
    capaId: m.capa_id,
    name: m.name,
    target: m.target,
    definition: m.definition,
    indicatorId: m.indicator_id,
    position: m.position,
  }))
}

interface CapaResultRow {
  id: string
  measure_id: string
  period: string
  value: number | null
  note: string | null
  created_at: string
}

/** One measure's recorded results, newest period first. */
export async function listCapaMeasureResults(
  measureId: string,
): Promise<CapaMeasureResult[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_measure_result')
    .select('id, measure_id, period, value, note, created_at')
    .eq('measure_id', measureId)
    .order('period', { ascending: false })
    .returns<CapaResultRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    measureId: r.measure_id,
    period: r.period,
    value: r.value,
    note: r.note,
    createdAt: r.created_at,
  }))
}

interface CapaEffectivenessRow {
  capa_id: string
  verdict: string
  method_md: string | null
  verified_at: string
  verifier: { full_name: string | null } | null
}

/** The plan's 1:1 effectiveness verdict (the close precondition); null until recorded. */
export async function getCapaEffectiveness(
  capaId: string,
): Promise<CapaEffectiveness | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_effectiveness')
    .select('capa_id, verdict, method_md, verified_at, verifier:verified_by(full_name)')
    .eq('capa_id', capaId)
    .maybeSingle()
    .returns<CapaEffectivenessRow | null>()

  if (!data) return null
  return {
    capaId: data.capa_id,
    verdict: data.verdict as CapaEffectivenessVerdict,
    methodMd: data.method_md,
    verifiedByName: data.verifier?.full_name ?? null,
    verifiedAt: data.verified_at,
  }
}

interface CapaKpisRow {
  open_count: number
  in_verification: number
  overdue_actions: number
  closed_ytd: number
}

/** NSP-wide CAPA KPIs (PQS/admin-gated DEFINER read); zeros for a non-PQS caller. */
export async function getCapaKpis(): Promise<CapaKpis> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('capa_kpis').returns<CapaKpisRow[]>()
  if (error || !data || data.length === 0) {
    return { open: 0, inVerification: 0, overdueActions: 0, closedYtd: 0 }
  }
  const r = data[0]
  return {
    open: r.open_count,
    inVerification: r.in_verification,
    overdueActions: r.overdue_actions,
    closedYtd: r.closed_ytd,
  }
}
