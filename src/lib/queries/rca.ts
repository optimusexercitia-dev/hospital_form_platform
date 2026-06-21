/**
 * Patient-safety RCA WORKSPACE data-access (Phase 14c — Root Cause Analysis;
 * Architecture Rule 9 — all reads go through `src/lib/queries/`). Backs the 4-stage
 * RCA workspace + the team / timeline / evidence panels under `/admin/nsp`.
 *
 * The domain TYPES are the FROZEN contract the frontend builds against; they live
 * in the import-free, client-safe `@/lib/safety/rca-types` (re-exported here). All
 * reads use the RLS-scoped cookie client and are PHI-FREE — the RCA carries NO
 * patient identifiers (those stay isolated on `event_patient`, Rule 12).
 *
 * RLS (the security boundary — Rule 1):
 *  - `rca` + children member-READ = the event's access-follows-custody scope
 *    (`app.can_read_event`); a foreign committee reads nothing. WRITE = the
 *    participant grant `app.can_write_rca` (PQS/admin OR a non-observer team member).
 *  - `nsp-evidence` Storage objects: members read (event scope), the writer
 *    inserts (RCA scope); NO update/delete (immutable, Rule 6). Reads via signed URLs.
 */

import { createClient } from '@/lib/supabase/server'
import { auditClinicalView } from '@/lib/audit/access'
import type {
  AssignableUser,
  Rca,
  RcaCitationTarget,
  RcaEvidence,
  RcaFactor,
  RcaMember,
  RcaRootCause,
  RcaTimelineEntry,
  RcaWhyChain,
} from '@/lib/safety/rca-types'

// Re-export the client-safe contract so consumers can import types/labels from the
// query module too (mirrors the Phase-14a/14b re-export pattern).
export type {
  AssignableUser,
  CitationTarget,
  EvidenceKind,
  FishboneCategory,
  Rca,
  RcaCitationTarget,
  RcaEvidence,
  RcaFactor,
  RcaMember,
  RcaMemberRole,
  RcaRootCause,
  RcaStatus,
  RcaTimelineEntry,
  RcaWhyChain,
  RootCauseClassification,
  RootCauseType,
} from '@/lib/safety/rca-types'
export {
  RCA_STATUS_LABELS,
  RCA_MEMBER_ROLE_LABELS,
  FISHBONE_CATEGORY_LABELS,
  ROOT_CAUSE_CLASSIFICATION_LABELS,
  ROOT_CAUSE_TYPE_LABELS,
  EVIDENCE_KIND_LABELS,
  FISHBONE_CATEGORY_ORDER,
} from '@/lib/safety/rca-types'

import type {
  CitationTarget,
  EvidenceKind,
  FishboneCategory,
  RcaMemberRole,
  RcaStatus,
  RootCauseClassification,
  RootCauseType,
} from '@/lib/safety/rca-types'

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

interface RcaRow {
  id: string
  event_id: string
  status: string
  due_date: string | null
  what_md: string | null
  expected_md: string | null
  detected: string | null
  impact: string | null
  scope: string | null
  summary_md: string | null
  submitted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  event: { code: string } | null
}

const RCA_SELECT =
  'id, event_id, status, due_date, what_md, expected_md, detected, impact, scope, ' +
  'summary_md, submitted_at, completed_at, created_at, updated_at, ' +
  'event:event_id(code)'

async function mapRca(r: RcaRow, viewerCanWrite: boolean): Promise<Rca> {
  return {
    id: r.id,
    eventId: r.event_id,
    eventCode: r.event?.code ?? null,
    status: r.status as RcaStatus,
    dueDate: r.due_date,
    whatMd: r.what_md,
    expectedMd: r.expected_md,
    detected: r.detected,
    impact: r.impact,
    scope: r.scope,
    summaryMd: r.summary_md,
    submittedAt: r.submitted_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    viewerCanWrite,
  }
}

// ---------------------------------------------------------------------------
// Queries — RLS-scoped (cookie client); all PHI-free
// ---------------------------------------------------------------------------

/**
 * The RCA for an event whose triage mandated one (1:1 via `pathway = rca`). Carries
 * `viewerCanWrite` (via `rca_writer_can_write`) for the UI's write-gating. Returns
 * `null` when no RCA exists or the caller is outside the event's access scope.
 */
export async function getRca(eventId: string): Promise<Rca | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca')
    .select(RCA_SELECT)
    .eq('event_id', eventId)
    .maybeSingle()
    .returns<RcaRow | null>()

  if (!data) return null
  await auditRcaView(data.id, data.event_id)
  return mapRca(data, await rcaViewerCanWrite(data.id))
}

/** The RCA by its own id (the workspace route key). Same shape/null rules as {@link getRca}. */
export async function getRcaById(rcaId: string): Promise<Rca | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca')
    .select(RCA_SELECT)
    .eq('id', rcaId)
    .maybeSingle()
    .returns<RcaRow | null>()

  if (!data) return null
  await auditRcaView(data.id, data.event_id)
  return mapRca(data, await rcaViewerCanWrite(data.id))
}

/** WS B (Rule 11/12): best-effort audit of an RCA workspace detail-open (free-text
 * problem statement / 5-Whys / root-cause narratives), attributed to the event's
 * reporting commission. App-layer on the RLS-scoped read. */
async function auditRcaView(rcaId: string, eventId: string): Promise<void> {
  await auditClinicalView({
    eventId,
    action: 'rca.viewed',
    entityType: 'rca',
    entityId: rcaId,
    summary: 'Análise de causa raiz (RCA) visualizada',
  })
}

interface RcaMemberRow {
  id: string
  rca_id: string
  user_id: string | null
  external_name: string | null
  role: string
  profile: { full_name: string | null } | null
}

/** The RCA team, by role then name. */
export async function listRcaMembers(rcaId: string): Promise<RcaMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca_members')
    .select('id, rca_id, user_id, external_name, role, profile:user_id(full_name)')
    .eq('rca_id', rcaId)
    .order('role', { ascending: true })
    .returns<RcaMemberRow[]>()

  return (data ?? []).map((m) => ({
    id: m.id,
    rcaId: m.rca_id,
    userId: m.user_id,
    name: m.profile?.full_name ?? m.external_name,
    externalName: m.external_name,
    role: m.role as RcaMemberRole,
  }))
}

interface RcaTimelineRow {
  id: string
  rca_id: string
  occurred_at: string
  description: string
  position: number
}

/** The incident-chronology entries, ordered by `position`. */
export async function listRcaTimeline(rcaId: string): Promise<RcaTimelineEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca_timeline_entries')
    .select('id, rca_id, occurred_at, description, position')
    .eq('rca_id', rcaId)
    .order('position', { ascending: true })
    .returns<RcaTimelineRow[]>()

  return (data ?? []).map((e) => ({
    id: e.id,
    rcaId: e.rca_id,
    occurredAt: e.occurred_at,
    description: e.description,
    position: e.position,
  }))
}

interface RcaEvidenceRow {
  id: string
  rca_id: string
  kind: string
  title: string
  storage_path: string | null
  external_url: string | null
  cited_interview_id: string | null
  cited_meeting_id: string | null
  cited_document_id: string | null
  citation_label: string | null
  created_at: string
}

/**
 * The non-deleted evidence rows. `document`-kind rows carry a signed `openUrl`
 * (resolved here from the `nsp-evidence` storage path); `link`/`citation` rows
 * carry their respective fields. Newest-first.
 */
export async function listRcaEvidence(rcaId: string): Promise<RcaEvidence[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca_evidence')
    .select(
      'id, rca_id, kind, title, storage_path, external_url, cited_interview_id, ' +
        'cited_meeting_id, cited_document_id, citation_label, created_at',
    )
    .eq('rca_id', rcaId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<RcaEvidenceRow[]>()

  const rows = data ?? []
  return Promise.all(
    rows.map(async (r) => {
      let openUrl: string | null = null
      if (r.kind === 'document' && r.storage_path) {
        const { data: signed } = await supabase.storage
          .from('nsp-evidence')
          .createSignedUrl(r.storage_path, 3600)
        openUrl = signed?.signedUrl ?? null
      }
      let citationTarget: CitationTarget | null = null
      let citedEntityId: string | null = null
      if (r.kind === 'citation') {
        if (r.cited_interview_id) {
          citationTarget = 'interview'
          citedEntityId = r.cited_interview_id
        } else if (r.cited_meeting_id) {
          citationTarget = 'meeting'
          citedEntityId = r.cited_meeting_id
        } else if (r.cited_document_id) {
          citationTarget = 'document'
          citedEntityId = r.cited_document_id
        }
      }
      return {
        id: r.id,
        rcaId: r.rca_id,
        kind: r.kind as EvidenceKind,
        title: r.title,
        openUrl,
        externalUrl: r.external_url,
        citationTarget,
        citationLabel: r.citation_label,
        citedEntityId,
        createdAt: r.created_at,
      }
    }),
  )
}

interface RcaFactorRow {
  id: string
  rca_id: string
  category: string
  text: string
  is_key: boolean
  position: number
}

/** The fishbone factors, grouped client-side by `category`; ordered by `position`. */
export async function listRcaFactors(rcaId: string): Promise<RcaFactor[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca_factors')
    .select('id, rca_id, category, text, is_key, position')
    .eq('rca_id', rcaId)
    .order('position', { ascending: true })
    .returns<RcaFactorRow[]>()

  return (data ?? []).map((f) => ({
    id: f.id,
    rcaId: f.rca_id,
    category: f.category as FishboneCategory,
    text: f.text,
    isKey: f.is_key,
    position: f.position,
  }))
}

interface RcaWhyChainRow {
  id: string
  rca_id: string
  factor_id: string
  steps: unknown
  root_text: string | null
}

/** The 5-Whys chains (one per key factor; lazily created). Keyed by `factorId`. */
export async function listRcaWhyChains(rcaId: string): Promise<RcaWhyChain[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca_why_chains')
    .select('id, rca_id, factor_id, steps, root_text')
    .eq('rca_id', rcaId)
    .returns<RcaWhyChainRow[]>()

  return (data ?? []).map((w) => ({
    id: w.id,
    rcaId: w.rca_id,
    factorId: w.factor_id,
    // `steps` is a jsonb array of strings; coerce defensively.
    steps: Array.isArray(w.steps) ? (w.steps as string[]) : [],
    rootText: w.root_text,
  }))
}

interface RcaRootCauseRow {
  id: string
  rca_id: string
  text: string
  category: string | null
  classification: string
  type: string
  position: number
}

/** The distilled root causes (stage 3), ordered by `position`. */
export async function listRcaRootCauses(rcaId: string): Promise<RcaRootCause[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rca_root_causes')
    .select('id, rca_id, text, category, classification, type, position')
    .eq('rca_id', rcaId)
    .order('position', { ascending: true })
    .returns<RcaRootCauseRow[]>()

  return (data ?? []).map((rc) => ({
    id: rc.id,
    rcaId: rc.rca_id,
    text: rc.text,
    category: (rc.category as FishboneCategory | null) ?? null,
    classification: rc.classification as RootCauseClassification,
    type: rc.type as RootCauseType,
    position: rc.position,
  }))
}

/**
 * Whether the viewer may write this RCA (`app.can_write_rca` via the
 * `rca_writer_can_write` DEFINER read) — the query layer's `viewerCanWrite` signal,
 * mirroring `interview_viewer_can_write`. Safe-defaults to `false` on any error.
 */
export async function rcaViewerCanWrite(rcaId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rca_writer_can_write', { p_rca_id: rcaId })
  if (error) return false
  return data === true
}

/**
 * The admin/PQS-wide roster of assignable platform users for the RCA team-member
 * picker (the `user_id` option). NOT commission-scoped — cross-functional RCAs pull
 * SMEs from anywhere; gated to PQS/admin (who already read all `profiles` via RLS).
 * Active profiles only, by name. Returns `[]` for a non-PQS caller (RLS scopes the
 * read; a non-admin sees only their own profile, which the picker simply shows).
 */
export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
    .returns<{ id: string; full_name: string | null; email: string | null }[]>()

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
  }))
}

/**
 * The in-scope citable artifacts for the evidence `citation` picker: the event's
 * CASE artifacts (interviews / meetings / case documents) when the event is
 * case-linked. Minimum-necessary + `can_read_event`-scoped (the underlying reads are
 * RLS-bound). Feeds `addRcaEvidence(kind:'citation', …)`. Returns `[]` for a
 * stand-alone (case-less) event.
 */
export async function listRcaCitationTargets(
  eventId: string,
): Promise<RcaCitationTarget[]> {
  const supabase = await createClient()

  // Resolve the event's case (RLS-scoped — out-of-scope callers get null).
  const { data: ev } = await supabase
    .from('patient_safety_event')
    .select('case_id')
    .eq('id', eventId)
    .maybeSingle()
    .returns<{ case_id: string | null } | null>()

  const caseId = ev?.case_id ?? null
  if (!caseId) return []

  const targets: RcaCitationTarget[] = []

  const { data: interviews } = await supabase
    .from('case_interviews')
    .select('id, interview_number, title, scheduled_start')
    .eq('case_id', caseId)
    .returns<
      { id: string; interview_number: number; title: string | null; scheduled_start: string | null }[]
    >()
  for (const i of interviews ?? []) {
    targets.push({
      kind: 'interview',
      id: i.id,
      label: i.title?.trim() || `Entrevista nº ${i.interview_number}`,
      date: i.scheduled_start,
    })
  }

  const { data: meetings } = await supabase
    .from('meeting_cases')
    .select('meeting:meeting_id(id, meeting_number, title, scheduled_start)')
    .eq('case_id', caseId)
    .returns<
      {
        meeting: {
          id: string
          meeting_number: number
          title: string | null
          scheduled_start: string | null
        } | null
      }[]
    >()
  for (const row of meetings ?? []) {
    const m = row.meeting
    if (!m) continue
    targets.push({
      kind: 'meeting',
      id: m.id,
      label: m.title?.trim() || `Reunião nº ${m.meeting_number}`,
      date: m.scheduled_start,
    })
  }

  const { data: docs } = await supabase
    .from('case_documents')
    .select('id, title, created_at')
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .returns<{ id: string; title: string | null; created_at: string }[]>()
  for (const d of docs ?? []) {
    targets.push({
      kind: 'document',
      id: d.id,
      label: d.title?.trim() || 'Documento',
      date: d.created_at,
    })
  }

  return targets
}
