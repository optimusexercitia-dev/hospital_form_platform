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
  forms: { title: string | null } | null
  profiles: { full_name: string | null } | null
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
       due_date, assigned_to,
       forms:form_id ( title ),
       profiles:assigned_to ( full_name )`,
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
  const base = {
    id: `phase:${p.id}`,
    type: 'phase' as const,
    title: phaseTitle(p),
    owner: personOf(p.profiles?.full_name),
    statusSlug: p.status,
    href: null,
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

  const [interviews, meetings, documents, events, actions, phases, registryIds] =
    await Promise.all([
      listCaseInterviews(caseId),
      listCaseMeetings(caseId),
      listCaseDocuments(caseId),
      listCaseEvents(caseId),
      listCaseActionItems(caseId),
      listCasePhasesForTimeline(caseId),
      interviewRegistryEventIds(caseId),
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

  // --- Manual case events (milestone / note), with two dedups -----------
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
  for (const e of events) {
    if (registryIds.has(e.id)) continue
    if (e.kind === 'meeting') continue
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
