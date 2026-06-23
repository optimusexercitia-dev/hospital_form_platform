import { createClient } from '@/lib/supabase/server'
import { getCaseDetail } from '@/lib/queries/cases'
import { listCaseInterviews } from '@/lib/queries/interviews'
import {
  listCaseDocuments,
  listCaseEvents,
} from '@/lib/queries/case-documents'
import { listCaseActionItems } from '@/lib/queries/case-action-items'
import {
  mapMeetingListItem,
  MEETING_LIST_COLUMNS,
  type MeetingListItem,
  type MeetingRow,
} from '@/lib/queries/meetings'
import { isTerminalCaseStatus } from '@/lib/cases/case-status'
import {
  anchor,
  initialsOf,
  type CaseTimelineEvent,
  type TimelinePerson,
} from '@/lib/timeline/event-model'

/**
 * Case Timeline data-access (Phase 12 — Case Timeline; Architecture Rule 9 — all
 * reads go through `src/lib/queries/`). The read-only Timeline tab aggregates a
 * case's real sub-entities into ONE chronological {@link CaseTimelineEvent} array
 * rendered in two layouts (Feed + Duration). It is a COMPOSITION layer: it adds
 * **no migration and no new RLS** — it calls the existing per-entity RLS-scoped
 * reads (+ one new REVERSE meetings read of `meeting_cases → meetings`, reusing
 * the meetings list projection, and a direct `case_phases` read for the bar
 * timestamps) and normalizes their rows in TypeScript, so a non-member of the
 * case's commission gets the same empty result those reads already return (RLS is
 * the boundary). The normalized shape + the date helpers live in the PURE
 * `@/lib/timeline/event-model` so server composition and client views share them
 * without dragging server imports into the client bundle.
 *
 * All user-facing strings are pt-BR, resolved here at composition time for the
 * lifecycle titles and in the UI's `type-meta` for icons/labels/pills (Rule 10);
 * the ASCII union slugs surfaced on each event ({@link CaseTimelineEvent.statusSlug})
 * are stable storage values, not labels. `href` values are commission-RELATIVE
 * (the Timeline page prepends `/c/<slug>/`); only interviews have a standalone
 * route today, and documents carry their signed download URL so the Sheet's
 * "Abrir registro" downloads the file.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * The assembled timeline for one case: the normalized event array plus the
 * lifecycle context both views need.
 *
 *   - `events`   — every source row normalized to {@link CaseTimelineEvent},
 *                  sorted ascending by `anchor` (oldest-first; the Feed default).
 *   - `reference`— the status/today reference passed to `statusOf`: today's ISO
 *                  date for an OPEN case (drives the today marker + done/active/
 *                  upcoming), `null` for a CLOSED case (static history).
 *   - `closedAt` — the case's `closed_at` ISO timestamp when closed, else `null`;
 *                  the Duration view draws a terminal marker here.
 *   - `isOpen`   — convenience flag mirroring `reference != null` (true while the
 *                  case is not terminally closed/cancelled).
 */
export interface CaseTimeline {
  events: CaseTimelineEvent[]
  reference: string | null
  closedAt: string | null
  isOpen: boolean
}

/**
 * A meeting linked to a case (the REVERSE of {@link import('@/lib/queries/meetings').listMeetingCases},
 * which lists a meeting's cases). Mirrors that join shape but anchored on the
 * CASE: `meeting_cases` rows of this case joined to their parent `meetings`
 * header, surfacing the per-meeting fields the timeline needs ({@link MeetingListItem})
 * plus the junction's `summary`/`decision`. RLS-scoped (members read their
 * commission's meetings via the `meetings`/`meeting_cases` policies).
 */
export interface CaseMeetingLink {
  /** The `meeting_cases` junction row id (stable key for the link). */
  linkId: string
  /** The linked meeting header (mirrors the meetings list projection). */
  meeting: MeetingListItem
  /** The junction's discussion summary for this case; `null` if absent. */
  summary: string | null
  /** The junction's recorded decision for this case; `null` if absent. */
  decision: string | null
}

// ---------------------------------------------------------------------------
// Internal row shapes (RLS-scoped table reads)
// ---------------------------------------------------------------------------

/** A `case_phases` row read directly (RLS `case_phases_select`: members read). */
interface CasePhaseTimelineRow {
  id: string
  position: number
  title: string | null
  status: 'pendente' | 'ativa' | 'concluida' | 'nao_necessaria'
  activated_at: string | null
  completed_at: string | null
  skipped_at: string | null
  due_date: string | null
  assigned_to: string | null
  /** The effective result source (phase-results); `null` until a result is set. */
  result_source: 'computed' | 'manual' | null
  forms: { title: string | null } | null
  profiles: { full_name: string | null } | null
  /** The LIVE-resolved result option (phase-results embed); `null` when none. */
  phase_results: {
    id: string
    label: string
    color_token: string
    is_adverse: boolean
  } | null
}

/** A `meeting_cases` row joined to its parent meeting (the reverse list). */
interface CaseMeetingLinkRow {
  id: string
  summary: string | null
  decision: string | null
  meetings: MeetingRow | null
}

/** The minimal interview projection for the case_event dedup (no contract change). */
interface InterviewRegistryRow {
  registry_event_id: string | null
}

/**
 * A `patient_safety_event` row read directly under the access-follows-custody RLS
 * (`patient_safety_event_select`). STRICTLY PHI-FREE — governance columns only;
 * NEVER `event_patient` identifiers or `description_md`. A case-linked event is
 * readable here only by a member in the event's access scope (the case detail is
 * staff_admin-gated upstream, and this read fails closed otherwise).
 */
interface CaseSafetyEventRow {
  id: string
  code: string
  title: string
  status: string
  current_owner_kind: string
  reported_at: string
  discovered_at: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a {@link TimelinePerson} from a display name, or `null` when absent/blank. */
function personOf(name: string | null | undefined): TimelinePerson | null {
  if (!name) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  return { name: trimmed, initials: initialsOf(trimmed) }
}

// ---------------------------------------------------------------------------
// Reverse meetings read
// ---------------------------------------------------------------------------

/**
 * The meetings linked to a case (the reverse of `listMeetingCases`), for the
 * `meeting` timeline events. RLS-scoped (members read their commission's
 * meetings + junction rows); `[]` when unreadable. Ordered by the meeting's
 * planned start.
 */
export async function listCaseMeetings(
  caseId: string,
): Promise<CaseMeetingLink[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meeting_cases')
    .select(
      `id, summary, decision,
       meetings:meeting_id ( ${MEETING_LIST_COLUMNS} )`,
    )
    .eq('case_id', caseId)
    .returns<CaseMeetingLinkRow[]>()

  if (error || !data) return []

  return data
    .filter(
      (r): r is CaseMeetingLinkRow & { meetings: MeetingRow } =>
        r.meetings != null,
    )
    .map((r) => ({
      linkId: r.id,
      meeting: mapMeetingListItem(r.meetings),
      summary: r.summary,
      decision: r.decision,
    }))
    .sort((a, b) =>
      a.meeting.scheduledStart.localeCompare(b.meeting.scheduledStart),
    )
}

// ---------------------------------------------------------------------------
// Per-source reads + normalization
// ---------------------------------------------------------------------------

/**
 * The case's phase rows read directly under RLS (`case_phases_select` — members
 * read). `getCaseDetail` exposes phase status/due_date but NOT the lifecycle
 * timestamps the bars need, so the bars come from this dedicated read.
 */
async function listCasePhasesForTimeline(
  caseId: string,
): Promise<CasePhaseTimelineRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_phases')
    .select(
      `id, position, title, status, activated_at, completed_at, skipped_at,
       due_date, assigned_to, result_source,
       forms:form_id ( title ),
       profiles:assigned_to ( full_name ),
       phase_results:result_id ( id, label, color_token, is_adverse )`,
    )
    .eq('case_id', caseId)
    .order('position', { ascending: true })
    .returns<CasePhaseTimelineRow[]>()

  if (error || !data) return []
  return data
}

/**
 * The `case_events` ids referenced by an interview's `registry_event_id` (the
 * interview-conclusion registry rows). Used to DEDUP: those `case_events` are
 * already represented by their interview event. A minimal projection so the
 * Phase-11 interviews list contract stays frozen.
 */
async function interviewRegistryEventIds(caseId: string): Promise<Set<string>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_interviews')
    .select('registry_event_id')
    .eq('case_id', caseId)
    .not('registry_event_id', 'is', null)
    .returns<InterviewRegistryRow[]>()

  if (error || !data) return new Set()
  return new Set(
    data
      .map((r) => r.registry_event_id)
      .filter((id): id is string => id != null),
  )
}

/**
 * The case's patient-safety events read directly under the access-follows-custody
 * RLS — STRICTLY PHI-FREE (code/title/status/dates/owner only). A non-member of
 * the event's access scope reads nothing (RLS fails closed); no PHI ever loads on
 * this path (the timeline never touches `event_patient`).
 */
async function listCaseSafetyEvents(
  caseId: string,
): Promise<CaseSafetyEventRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('patient_safety_event')
    .select(
      'id, code, title, status, current_owner_kind, reported_at, discovered_at',
    )
    .eq('case_id', caseId)
    .order('reported_at', { ascending: true })
    .returns<CaseSafetyEventRow[]>()

  if (error || !data) return []
  return data
}

/**
 * A `case_referral` row SENT from this case (Phase 22). STRICTLY PHI-FREE —
 * code/subject/status/dates/target-committee only; NEVER `referral_patient`
 * identifiers, `description_md`, or the snapshot/reply bodies. RLS-scoped (the
 * `case_referral` SELECT policy = source/target member OR QPS); a non-member reads
 * nothing. We bound to `source_case_id` so only outbound referrals OF this case
 * surface (the inbound view lives on the target committee's own case).
 */
interface CaseReferralTimelineRow {
  id: string
  code: string
  subject: string
  status: string
  sent_at: string | null
  created_at: string
  target_commission: { name: string } | null
}

async function listCaseReferralsForTimeline(
  caseId: string,
): Promise<CaseReferralTimelineRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_referral')
    .select('id, code, subject, status, sent_at, created_at, target_commission:target_commission_id(name)')
    .eq('source_case_id', caseId)
    .order('created_at', { ascending: true })
    .returns<CaseReferralTimelineRow[]>()

  if (error || !data) return []
  return data
}

/** A phase's display title: its own `title`, else the bound form title, else "Fase N". */
function phaseTitle(p: CasePhaseTimelineRow): string {
  return p.title?.trim() || p.forms?.title?.trim() || `Fase ${p.position}`
}

/**
 * Normalize a phase row into 0..1 timeline events (plan rules):
 *   - `ativa` / `concluida` (activated) → a `phase` BAR: `start = activated_at`,
 *     `end = completed_at ?? skipped_at ?? null` (null = active → grows to today).
 *   - `nao_necessaria` (skipped) → a muted single-day pin at `skipped_at`
 *     (falls back to `due_date`/omit if somehow unset).
 *   - `pendente` WITH a `due_date` → an upcoming single-day pin at `due_date`.
 *   - `pendente` WITHOUT a `due_date` → omitted (nothing to place).
 *
 * NOTE: a skipped/pending phase is a SINGLE-DAY event but keeps `type: 'phase'`
 * so the legend/filter still groups it under "Fases"; the view branches on
 * `day` vs `start`/`end` (pin vs bar), and `muted`/`statusSlug` drive the styling.
 */
function phaseToEvent(p: CasePhaseTimelineRow): CaseTimelineEvent | null {
  const result: CaseTimelineEvent['result'] = p.phase_results
    ? {
        id: p.phase_results.id,
        label: p.phase_results.label,
        colorToken: p.phase_results.color_token,
        isAdverse: p.phase_results.is_adverse,
        source: p.result_source,
      }
    : null

  const base = {
    id: `phase:${p.id}`,
    type: 'phase' as const,
    title: phaseTitle(p),
    owner: personOf(p.profiles?.full_name),
    statusSlug: p.status,
    href: null,
    result,
  }

  if (p.status === 'nao_necessaria') {
    const day = p.skipped_at ?? p.due_date
    if (!day) return null
    return { ...base, day, muted: true }
  }

  if (p.status === 'pendente') {
    if (!p.due_date) return null
    return { ...base, day: p.due_date }
  }

  // ativa / concluida → a durational bar. activated_at is set on activation.
  if (!p.activated_at) return null
  return {
    ...base,
    start: p.activated_at,
    end: p.completed_at ?? p.skipped_at ?? null,
  }
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * The assembled, sorted timeline for one case, or an empty timeline when the
 * caller may not read it (RLS-scoped — every underlying read fails closed). The
 * single read the Timeline page calls.
 *
 * Composition (plan-approved): lifecycle (opened always; closed only when the
 * case is terminal, tinted by the outcome colour) + phases (`getCaseDetail` for
 * the header/outcome; a direct `case_phases` read for the bar timestamps) +
 * interviews + meetings (reverse `meeting_cases` read) + documents + manual
 * events (kind=`decision` → milestone, else → note) + action items. The
 * interview→case_event dedup drops any `case_events` row referenced by an
 * interview's `registry_event_id` (the interview event already represents it).
 * Every owner avatar is `{ name, initials }`; events are sorted ascending by
 * `anchor` (oldest-first; the Feed default). `reference` = today ISO for an open
 * case (drives the today marker + done/active/upcoming), `null` for a closed one.
 */
export async function getCaseTimeline(caseId: string): Promise<CaseTimeline> {
  const empty: CaseTimeline = {
    events: [],
    reference: null,
    closedAt: null,
    isOpen: false,
  }

  // `getCaseDetail` is staff_admin/admin-gated; a non-staff_admin (or an absent
  // case) gets null → an empty timeline, never a leak.
  const detail = await getCaseDetail(caseId)
  if (!detail) return empty

  const [
    interviews,
    meetings,
    documents,
    events,
    actions,
    phases,
    registryIds,
    safetyEvents,
    referrals,
  ] = await Promise.all([
    listCaseInterviews(caseId),
    listCaseMeetings(caseId),
    listCaseDocuments(caseId),
    listCaseEvents(caseId),
    listCaseActionItems(caseId),
    listCasePhasesForTimeline(caseId),
    interviewRegistryEventIds(caseId),
    listCaseSafetyEvents(caseId),
    listCaseReferralsForTimeline(caseId),
  ])

  const isOpen = !isTerminalCaseStatus(detail.case.status)
  const reference = isOpen ? new Date().toISOString().slice(0, 10) : null
  const closedAt = detail.case.closedAt

  const out: CaseTimelineEvent[] = []

  // --- Lifecycle: opened (always) + closed (terminal only) ---------------
  out.push({
    id: 'case:opened',
    type: 'lifecycle',
    subtype: 'opened',
    title: 'Caso aberto',
    day: detail.case.createdAt,
    href: null,
  })
  if (!isOpen && closedAt) {
    out.push({
      id: 'case:closed',
      type: 'lifecycle',
      subtype: 'closed',
      title:
        detail.case.status === 'cancelado'
          ? 'Caso cancelado'
          : 'Caso concluído',
      day: closedAt,
      // Tint the closed node by the assigned outcome's colour, when present.
      colorToken: detail.outcome?.colorToken ?? null,
      note: detail.outcome?.label ?? null,
      href: null,
    })
  }

  // --- Phases ------------------------------------------------------------
  for (const p of phases) {
    const ev = phaseToEvent(p)
    if (ev) out.push(ev)
  }

  // --- Interviews --------------------------------------------------------
  for (const iv of interviews) {
    out.push({
      id: `interview:${iv.id}`,
      type: 'interview',
      title: iv.title?.trim() || `Entrevista nº ${iv.interviewNumber}`,
      day: iv.conductedAt ?? iv.scheduledStart ?? iv.createdAt,
      owner: null,
      note: iv.subjectSummary || null,
      statusSlug: iv.status,
      muted: iv.status === 'cancelada',
      href: `manage/cases/${caseId}/interviews/${iv.id}`,
    })
  }

  // --- Meetings (reverse link) ------------------------------------------
  for (const link of meetings) {
    const m = link.meeting
    out.push({
      id: `meeting:${m.id}`,
      type: 'meeting',
      title: m.title,
      day: m.scheduledStart,
      owner: null,
      note: m.locationText || link.summary || null,
      statusSlug: m.status,
      muted: m.status === 'cancelada',
      href: null,
    })
  }

  // --- Documents ---------------------------------------------------------
  for (const doc of documents) {
    out.push({
      id: `document:${doc.id}`,
      type: 'document',
      title: doc.title,
      day: doc.occurredAt ?? doc.createdAt,
      owner: personOf(doc.uploadedByName),
      note: doc.description || null,
      // The signed download URL doubles as the Sheet's "Abrir registro".
      href: doc.signedUrl ?? null,
    })
  }

  // --- Patient-safety events (Phase 14a) --------------------------------
  // STRICTLY PHI-FREE: code/title/status/date/owner only — never `event_patient`
  // identifiers or `description_md`. Composed under the access-follows-custody RLS
  // (a non-scope member read nothing above). The `cancelled` event renders muted.
  for (const se of safetyEvents) {
    out.push({
      id: `safety_event:${se.id}`,
      type: 'safety_event',
      title: se.title?.trim() ? `${se.code} — ${se.title.trim()}` : se.code,
      day: se.discovered_at ?? se.reported_at,
      owner: null,
      note: se.current_owner_kind === 'pqs' ? 'Em custódia do NSP' : null,
      statusSlug: se.status,
      muted: se.status === 'cancelled',
      href: null,
    })
  }

  // --- Inter-committee referrals (Phase 22) -----------------------------
  // STRICTLY PHI-FREE: code/subject/status/date/target-committee only — never
  // `referral_patient` identifiers, `description_md`, or snapshot/reply bodies.
  // Outbound only (source_case_id = this case). A withdrawn/declined referral
  // renders muted. The flag-OFF case simply yields no rows (RLS unaffected, and
  // the list returns [] when the table has none for this case).
  for (const r of referrals) {
    out.push({
      id: `referral:${r.id}`,
      type: 'referral',
      title: `${r.code} — ${r.subject}`,
      day: r.sent_at ?? r.created_at,
      owner: null,
      note: r.target_commission?.name
        ? `Para ${r.target_commission.name}`
        : null,
      statusSlug: r.status,
      muted: r.status === 'retirada' || r.status === 'recusada',
      href: null,
    })
  }

  // --- Manual case events (milestone / note), with three dedups ---------
  // 1. INTERVIEW echo: the interview-conclusion RPC writes a `case_events`
  //    kind='interview' row whose id is the interview's `registry_event_id`;
  //    the `interview` event already represents it → drop by id.
  // 2. MEETING echo: the meeting-conclusion RPC writes a `case_events`
  //    kind='meeting' row PER linked case (migration 20260615090006); the
  //    authoritative `meeting` event (reverse `meeting_cases` link) already
  //    represents it. These echoes carry NO back-reference to the meeting, so
  //    they can't be dropped by id — we drop the whole kind='meeting' class
  //    here (a manual note is never authored with kind='meeting'). Genuine
  //    manual notes are kind ∈ {note, other}; decisions → milestone. (Deviation
  //    from the plan's "kind ∈ {note,meeting,other} → note" — see report.)
  // 3. SAFETY-EVENT echo: `notify_safety_event` writes a `case_events`
  //    kind='safety_event' row per case-linked event (migration …121002); the
  //    authoritative `safety_event` event (direct `patient_safety_event` read)
  //    already represents it, and the echo carries no back-reference — drop the
  //    whole kind='safety_event' class (mirrors the meeting-echo dedup).
  for (const e of events) {
    if (registryIds.has(e.id)) continue
    // `safety_event` is a DB-only echo kind not in the user-facing CaseEventKind
    // union (see case-documents.ts) — compare the raw string to drop it.
    if (e.kind === 'meeting' || (e.kind as string) === 'safety_event') continue
    const isDecision = e.kind === 'decision'
    out.push({
      id: `event:${e.id}`,
      type: isDecision ? 'milestone' : 'note',
      title: e.title?.trim() || (isDecision ? 'Decisão' : 'Anotação'),
      day: e.occurredAt ?? e.createdAt,
      owner: personOf(e.createdByName),
      note: null,
      href: null,
    })
  }

  // --- Action items ------------------------------------------------------
  for (const a of actions) {
    out.push({
      id: `action:${a.id}`,
      type: 'action',
      title: a.title,
      day: a.createdAt,
      owner: personOf(a.assigneeName),
      note: a.description || null,
      statusSlug: a.status,
      muted: a.status === 'cancelled',
      href: null,
    })
  }

  // --- Sort ascending by anchor (oldest-first; the Feed default) ---------
  out.sort((a, b) => anchor(a).localeCompare(anchor(b)))

  return { events: out, reference, closedAt, isOpen }
}
