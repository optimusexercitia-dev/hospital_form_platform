/**
 * Patient-safety event TRIAGE data-access (Phase 14b — Triage & Disposition;
 * Architecture Rule 9 — all reads go through `src/lib/queries/`). Backs the
 * three-pane NSP triage workstation + the NSP config area under `/admin/nsp`.
 *
 * The domain TYPES are the FROZEN contract the frontend builds against; they live
 * in the import-free, client-safe `@/lib/safety/triage-types` (re-exported here so
 * existing `import … from '@/lib/queries/triage'` consumers resolve). All reads use
 * the RLS-scoped cookie client and are PHI-FREE — the triage worksheet carries NO
 * patient identifiers (those stay isolated on `event_patient`, loaded only by the
 * audited `getEventPatient`, Rule 12).
 *
 * RLS (the security boundary — Rule 1):
 *  - `event_triage` + `event_triage_sentinel_flags` member-READ = the event's
 *    access-follows-custody scope (`app.can_read_event`); a foreign committee reads
 *    nothing. WRITE is DEFINER-RPC-only (PQS/admin — `is_pqs_member`).
 *  - `pqs_event_types` + `pqs_sentinel_criteria` (non-PHI config vocab) any-
 *    authenticated READ; WRITE is `is_pqs_member`-gated DEFINER CRUD.
 */

import { createClient } from '@/lib/supabase/server'
import { auditClinicalView } from '@/lib/audit/access'
import type {
  EventType,
  HarmSeverity,
  PseClosureReason,
  ReviewPathway,
  SentinelCriterion,
  Triage,
  TriageDisposition,
  TriageReach,
  TriageVerdict,
} from '@/lib/safety/triage-types'

// Re-export the client-safe contract so consumers can import types/labels from the
// query module too (mirrors the Phase-14a `safety-events.ts` re-export pattern).
export type {
  EventType,
  HarmSeverity,
  PseClosureReason,
  ReviewPathway,
  SentinelCriterion,
  Triage,
  TriageDisposition,
  TriageReach,
  TriageSentinelFlag,
  TriageVerdict,
} from '@/lib/safety/triage-types'
export {
  REACH_LABELS,
  HARM_SEVERITY_LABELS,
  PSE_CLOSURE_REASON_LABELS,
  REVIEW_PATHWAY_LABELS,
  TRIAGE_VERDICT_LABELS,
  REACH_META,
  HARM_META,
  REACH_ORDER,
  HARM_ORDER,
} from '@/lib/safety/triage-types'

// ---------------------------------------------------------------------------
// Row shapes (PostgREST embeds) + mappers
// ---------------------------------------------------------------------------

interface TriageRow {
  event_id: string
  is_pse: boolean | null
  pse_closure_reason: string | null
  reach: string | null
  harm_severity: string | null
  natural_course: boolean | null
  sentinel_determination: boolean
  review_pathway: string | null
  disposition_notes_md: string | null
  triaged_at: string | null
  updated_at: string
  triaged_by_profile: { full_name: string | null } | null
  event_triage_sentinel_flags: {
    criteria_id: string | null
    criteria_key: string
    criteria_label: string
  }[]
}

interface DispositionRow {
  event_id: string
  is_pse: boolean | null
  reached: boolean
  severe: boolean
  is_sentinel: boolean
  verdict: string
  review_pathway: string | null
  rca_due_date: string | null
}

interface VocabRow {
  id: string
  key: string
  label: string
  description: string | null
  position: number
  is_active: boolean
}

const TRIAGE_SELECT =
  'event_id, is_pse, pse_closure_reason, reach, harm_severity, natural_course, ' +
  'sentinel_determination, review_pathway, disposition_notes_md, triaged_at, ' +
  'updated_at, triaged_by_profile:triaged_by(full_name), ' +
  'event_triage_sentinel_flags(criteria_id, criteria_key, criteria_label)'

function mapTriage(r: TriageRow): Triage {
  return {
    eventId: r.event_id,
    isPse: r.is_pse,
    pseClosureReason: r.pse_closure_reason as PseClosureReason | null,
    reach: r.reach as TriageReach | null,
    harmSeverity: r.harm_severity as HarmSeverity | null,
    naturalCourse: r.natural_course,
    sentinelDetermination: r.sentinel_determination,
    reviewPathway: r.review_pathway as ReviewPathway | null,
    dispositionNotesMd: r.disposition_notes_md,
    sentinelFlags: (r.event_triage_sentinel_flags ?? []).map((f) => ({
      criterionId: f.criteria_id ?? '',
      criterionKey: f.criteria_key,
      criterionLabel: f.criteria_label,
    })),
    triagedAt: r.triaged_at,
    triagedByName: r.triaged_by_profile?.full_name ?? null,
    updatedAt: r.updated_at,
  }
}

function mapVocab(r: VocabRow): EventType {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    position: r.position,
    isActive: r.is_active,
  }
}

// ---------------------------------------------------------------------------
// Queries — RLS-scoped (cookie client); all PHI-free
// ---------------------------------------------------------------------------

/**
 * The 1:1 triage worksheet for one event (with its designated-category flags),
 * PHI-free. Returns `null` when no worksheet exists yet or the caller is outside
 * the event's access scope.
 */
export async function getEventTriage(eventId: string): Promise<Triage | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('event_triage')
    .select(TRIAGE_SELECT)
    .eq('event_id', eventId)
    .maybeSingle()
    .returns<TriageRow | null>()

  if (!data) return null

  // WS B (Rule 11/12): audit a detail-open of the triage worksheet (free-text
  // disposition notes). Best-effort, app-layer on the RLS-scoped read.
  await auditClinicalView({
    eventId,
    action: 'triage.viewed',
    entityType: 'event_triage',
    entityId: eventId,
    summary: 'Triagem do evento visualizada',
  })

  return mapTriage(data)
}

/**
 * The derived disposition for one event — the SQL `triage_disposition` RPC's
 * projection (the authority the disposition rail renders; the frontend's
 * `deriveVerdict` mirror is UX-only). Returns `null` when out of scope.
 */
export async function getTriageDisposition(
  eventId: string,
): Promise<TriageDisposition | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('triage_disposition', { p_event_id: eventId })
    .returns<DispositionRow[]>()

  if (error || !data || data.length === 0) return null
  const r = data[0]
  return {
    eventId: r.event_id,
    isPse: r.is_pse,
    reached: r.reached,
    severe: r.severe,
    isSentinel: r.is_sentinel,
    verdict: r.verdict as TriageVerdict,
    reviewPathway: r.review_pathway as ReviewPathway | null,
    rcaDueDate: r.rca_due_date,
  }
}

/**
 * The configurable always-review sentinel checklist (JC designated-category
 * defaults seeded). Active-only by default; pass `includeInactive` for the config
 * area. Ordered by `position`.
 */
export async function listSentinelCriteria(
  includeInactive = false,
): Promise<SentinelCriterion[]> {
  const supabase = await createClient()
  let query = supabase
    .from('pqs_sentinel_criteria')
    .select('id, key, label, description, position, is_active')
    .order('position', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)

  const { data } = await query.returns<VocabRow[]>()
  return (data ?? []).map(mapVocab)
}

/**
 * The configurable event-type vocabulary (NSP/WHO defaults seeded). Active-only by
 * default; pass `includeInactive` for the config area. Ordered by `position`.
 */
export async function listEventTypes(
  includeInactive = false,
): Promise<EventType[]> {
  const supabase = await createClient()
  let query = supabase
    .from('pqs_event_types')
    .select('id, key, label, description, position, is_active')
    .order('position', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)

  const { data } = await query.returns<VocabRow[]>()
  return (data ?? []).map(mapVocab)
}
