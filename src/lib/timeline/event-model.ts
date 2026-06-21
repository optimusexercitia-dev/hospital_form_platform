/**
 * Case Timeline — PURE event model (Phase 12 — Case Timeline).
 *
 * The single source of truth for the normalized timeline event SHAPE and the
 * derived date helpers, shared by BOTH layouts (Feed + Duration/Gantt). It is the
 * TypeScript analog of `docs/design/README_timeline.md` §1, lifted from
 * day-of-month integers to real ISO date strings.
 *
 * **Purity contract.** This module has NO server-only imports — it must remain
 * importable from CLIENT components (the two timeline views, the legend/filter,
 * the detail Sheet). It must NEVER import `@/lib/supabase/*`, `next/headers`,
 * `server-only`, or any data-access module. The composition that turns real
 * RLS-scoped rows into {@link CaseTimelineEvent}s lives in the SERVER module
 * `@/lib/queries/case-timeline` (which imports the types from here); the views
 * consume the assembled array + these pure helpers and hold no data-access of
 * their own.
 *
 * **Conventions.** Dates are ISO strings — `YYYY-MM-DD` for date-only fields
 * (phase `start`/`end`, single-day `day` after normalization) and `today`/the
 * status `reference`. The helpers compare on the DATE part only (calendar-day
 * granularity), so callers may pass either a date or a timestamp string. ASCII
 * union slugs ({@link TimelineEventType}, {@link TimelineStatus}) are STABLE
 * storage/logic values; all user-facing labels (icons, pt-BR text, pills) are
 * resolved in the UI's central `type-meta` map (Rule 10). The date math is
 * dependency-free (the repo ships no date library — confirmed against
 * `package.json`); do not add one.
 */

// ---------------------------------------------------------------------------
// Unions (stable ASCII slugs; pt-BR labels + icons resolved in the UI)
// ---------------------------------------------------------------------------

/**
 * The 9-type taxonomy (plan decision 13; `safety_event` added in Phase 14a). Each
 * maps in the UI's `type-meta` to one icon + one color role + one pt-BR legend label:
 *   - `lifecycle`    — case opened / closed (`cases.created_at` / `closed_at`).
 *   - `phase`        — a `case_phases` row; the ONLY durational (bar) type.
 *   - `milestone`    — a `case_events` row with `kind = 'decision'`.
 *   - `interview`    — a `case_interviews` row.
 *   - `meeting`      — a `meetings` row linked via `meeting_cases`.
 *   - `document`     — a `case_documents` row.
 *   - `action`       — a `case_action_items` row.
 *   - `safety_event` — a `patient_safety_event` raised from this case (Phase 14a).
 *                      STRICTLY PHI-FREE on the timeline: code/title/status/date/
 *                      owner only — never `event_patient` identifiers or
 *                      `description_md`. Composed under access-follows-custody.
 *   - `referral`     — a `case_referral` SENT from this case (Phase 22). STRICTLY
 *                      PHI-FREE on the timeline: code/subject/status/date/target
 *                      committee only — never `referral_patient` identifiers,
 *                      `description_md`, or the snapshot/reply bodies.
 *   - `note`         — a `case_events` row with `kind ∈ {note, meeting, other}`.
 */
export type TimelineEventType =
  | 'lifecycle'
  | 'phase'
  | 'milestone'
  | 'interview'
  | 'meeting'
  | 'document'
  | 'action'
  | 'safety_event'
  | 'referral'
  | 'note'

/**
 * An event's temporal state relative to a reference day (the README's
 * done/active/upcoming). For a CLOSED case the timeline is static history, so the
 * composition passes a `null` reference and {@link statusOf} returns `'done'` for
 * every event (no today marker, no upcoming).
 */
export type TimelineStatus = 'done' | 'active' | 'upcoming'

// ---------------------------------------------------------------------------
// Event shape
// ---------------------------------------------------------------------------

/** The single person shown on a card/bar (the primary owner). The full roster, where one exists, is fetched on demand in the detail Sheet. */
export interface TimelinePerson {
  /** Display name — a member's `profiles.full_name` or an external person's `external_name`. */
  name: string
  /** Up to 2 uppercase initials derived from {@link name} (see {@link initialsOf}). */
  initials: string
}

/**
 * One normalized timeline event — the common shape every source row is mapped
 * into, driving both layouts. A row is EITHER a durational phase (`start`/`end`)
 * OR a single-day event (`day`); never both. All optional display fields are
 * `null`/absent when the source has no value, so the views branch on presence
 * without guessing.
 */
export interface CaseTimelineEvent {
  /**
   * Stable composite id, unique within a case's event array and used as the
   * React key + the dedup/selection handle. Form: `"<source>:<discriminator>"`
   * — e.g. `"case:opened"`, `"case:closed"`, `"phase:<uuid>"`,
   * `"interview:<uuid>"`, `"meeting:<uuid>"`, `"document:<uuid>"`,
   * `"action:<uuid>"`, `"event:<uuid>"`.
   */
  id: string
  type: TimelineEventType
  /**
   * Icon discriminator for the two lifecycle nodes (folder-plus vs check-circle).
   * Set ONLY on `type = 'lifecycle'` events; absent for every other type.
   */
  subtype?: 'opened' | 'closed'
  /** pt-BR title shown on the card/bar (resolved at composition time). */
  title: string
  /**
   * Single-day anchor (ISO `YYYY-MM-DD`). Present on EVERY non-phase event and
   * mutually exclusive with `start`/`end`. The Feed positions the node here and
   * the Duration view pins it to this column.
   */
  day?: string
  /** Phase bar start (ISO `YYYY-MM-DD`). Present ONLY on `type = 'phase'`; paired with `end`. */
  start?: string
  /**
   * Phase bar end (ISO `YYYY-MM-DD`), inclusive. Present ONLY on `type = 'phase'`.
   * `null` = the phase is still ACTIVE → the Duration bar grows to "today" and
   * {@link endDay} clamps it (see also {@link statusOf}).
   */
  end?: string | null
  /** The single primary person on the card/bar; `null`/absent when none (e.g. an unassigned document). */
  owner?: TimelinePerson | null
  /** Secondary line under the title (e.g. a document note, a meeting location); `null` when absent. */
  note?: string | null
  /**
   * The raw entity status slug for the status pill (e.g. an interview's
   * `cancelada`, a meeting's `realizada`, an action's `done`, a phase's
   * `nao_necessaria`). `null` for types with no status of their own (lifecycle,
   * document, note/milestone). pt-BR pill labels are resolved in the UI.
   */
  statusSlug?: string | null
  /** `true` for cancelled / `nao_necessaria` entities — the view renders them muted. */
  muted?: boolean
  /**
   * In-app deep-link to the canonical record, RELATIVE to the commission area
   * (e.g. `manage/cases/<caseId>/interviews/<interviewId>`). `null` when no
   * standalone route exists (phases, documents, events, actions, meetings render
   * inline on the detail tab today). The timeline page prepends `/c/<slug>/`.
   */
  href?: string | null
  /**
   * A {@link import('@/lib/cases/case-status').CaseStatusColorToken} used to tint
   * the lifecycle-CLOSED node by the case outcome (green/red/…); `null` when not
   * tinted (the opened node and every non-lifecycle type). Kept as a loose
   * `string` here to preserve this module's purity (no cross-import); the UI maps
   * it through the shared palette.
   */
  colorToken?: string | null
}

// ---------------------------------------------------------------------------
// Pure date helpers (single source of truth — both layouts use these)
// ---------------------------------------------------------------------------

/**
 * The day part of an ISO date/timestamp string (`YYYY-MM-DD`). Robust to a bare
 * date or a full timestamp; takes the first 10 chars so comparisons are
 * calendar-day, timezone-free. Lexicographic comparison of these is a valid
 * chronological comparison (ISO-8601 ordering).
 */
function dayPart(iso: string): string {
  return iso.slice(0, 10)
}

/** The sort key + Feed/Gantt position: a single-day event's `day`, else a phase's `start`. */
export function anchor(e: CaseTimelineEvent): string {
  // A well-formed event always has `day` (single-day) or `start` (phase).
  return dayPart(e.day ?? e.start ?? '')
}

/**
 * The event's last covered day. Single-day events end on their `day`; a phase
 * ends on its `end`, or — while still active (`end == null`) — clamps to `today`
 * so the Duration bar runs to the today marker.
 */
export function endDay(e: CaseTimelineEvent, today: string): string {
  if (e.day != null) return dayPart(e.day)
  return dayPart(e.end ?? today)
}

/**
 * Inclusive day count for the Duration bar width: single-day events are `1`; a
 * phase is the inclusive number of calendar days from `start` to {@link endDay}
 * (minimum `1`, never negative for malformed/zero-length spans).
 */
export function durationDays(e: CaseTimelineEvent, today: string): number {
  if (e.day != null) return 1
  const start = anchor(e)
  const end = endDay(e, today)
  const days = Math.floor(diffDaysUtc(start, end)) + 1
  return days < 1 ? 1 : days
}

/**
 * The event's status relative to `reference` (today's ISO date for an OPEN case,
 * `null` for a CLOSED case → static history). With a `null` reference everything
 * is `'done'`. Otherwise: `done` when the event ended before the reference;
 * `active` when the reference falls within `[anchor, endDay]` (a phase spanning
 * today, or a single-day event ON today); `upcoming` when it starts after.
 */
export function statusOf(
  e: CaseTimelineEvent,
  reference: string | null,
): TimelineStatus {
  if (reference == null) return 'done'
  const ref = dayPart(reference)
  const a = anchor(e)
  const end = endDay(e, ref)
  if (end < ref) return 'done'
  if (a <= ref && ref <= end) return 'active'
  return 'upcoming'
}

/**
 * Initials from a full name (max 2 uppercase chars): first + last word's first
 * letter for multi-word names ("João Silva" → "JS"), first two letters for a
 * single word ("Ana" → "AN"), `'?'` for empty/whitespace input. Diacritics are
 * preserved as-is then upper-cased (e.g. "Ângela Ótimo" → "ÂÓ").
 */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  const first = words[0][0]
  const last = words[words.length - 1][0]
  return (first + last).toUpperCase()
}

/**
 * Whole-day difference `to − from` for two ISO date strings, computed in UTC so
 * DST never shifts the count. Internal to {@link durationDays}; both inputs are
 * already reduced to their day part by the caller.
 */
function diffDaysUtc(from: string, to: string): number {
  const a = Date.parse(`${dayPart(from)}T00:00:00Z`)
  const b = Date.parse(`${dayPart(to)}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return (b - a) / 86_400_000
}
