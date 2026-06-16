# ADR 0027 — Case Timeline (read-only event aggregation, two layouts)

**Status:** Accepted · **Date:** 2026-06-16 · **Phase:** 12 (Case Timeline)

## Context

A case accumulates many dated artifacts — phases, interviews, meetings,
documents, action items, manual notes — but the case detail page showed them in
separate panels with no chronological, at-a-glance picture of how the
investigation unfolded. We add a **Timeline** visualization, reachable as a
secondary tab on the case page, that aggregates the case's real sub-entities into
one time-ordered event array rendered in two interchangeable layouts. Reference
spec: `docs/design/README_timeline.md`, adapted to real dates and the project
design system. Settled via the design interview as decisions **1–15** in the
approved plan `when-visualizing-a-case-misty-rossum.md`. **No patient-identifiable
data**: the timeline shows committee process only. The feature is **read-only** —
it adds NO mutation and NO database migration; it composes existing RLS-scoped
reads (Architecture Rule 9).

## Decision

- **One normalized event model, two pure layouts.** A pure, client-importable
  `src/lib/timeline/event-model.ts` defines `CaseTimelineEvent` + the derived
  helpers (`anchor`/`endDay`/`durationDays`/`statusOf`/`initialsOf`) — the single
  source of truth both layouts consume (the TS analog of README §1). It carries
  **no server imports** so client components can import it safely.
- **Aggregation in the query layer, no migration.** `getCaseTimeline(caseId)`
  (`src/lib/queries/case-timeline.ts`) composes `getCaseDetail` + a direct
  RLS-scoped `case_phases` read (for the `activated_at`/`completed_at`/
  `skipped_at` bar timestamps `get_case_detail` doesn't expose — `case_phases_select`
  already permits member reads, so NO RPC change) + `listCaseInterviews`/
  `listCaseDocuments`/`listCaseEvents`/`listCaseActionItems` + a new reverse
  `listCaseMeetings` (meetings linked via `meeting_cases`, reusing exported
  `mapMeetingListItem`/`MEETING_LIST_COLUMNS`). Each row normalizes to a
  `CaseTimelineEvent`; the array sorts ascending by `anchor`.
- **8 event types.** lifecycle (`cases.created_at`/`closed_at`), phase (the only
  *durational bars*), milestone (`case_events kind='decision'`), interview,
  meeting, document, action, note (`case_events kind ∈ {note,other}`). Phases that
  haven't activated render as upcoming pins (at `due_date`) or are omitted;
  `nao_necessaria` renders as a muted pin.
- **Two dedups.** Drop any `case_events` row referenced by an interview's
  `registry_event_id` (the interview already represents it); AND drop
  `case_events kind='meeting'` (the meeting-conclusion RPC auto-writes one echo
  per linked case — the reverse `meeting_cases` link is the authoritative single
  representation). Without the second dedup every concluded meeting double-counts.
- **Live for open, static for closed.** `isOpen = !isTerminalCaseStatus(status)`;
  `reference` = today ISO for open cases (drives the today marker + done/active/
  upcoming via `statusOf`), `null` for closed (full history terminating at a
  `closed_at` marker, no today line).
- **Adaptive Duration axis.** The Gantt picks its column unit (day → week → month)
  from the case span so any duration stays readable; weekend bands only in day
  unit; horizontal scroll only when still wide. The Feed is strictly chronological
  with duration shown as text only.
- **`(detail)` route group, not a bare layout.** The shared header spine + tab bar
  (`Detalhes | Linha do tempo`) live in `(detail)/layout.tsx`, scoping them to the
  two tab pages. A bare `[caseId]/layout.tsx` would have wrapped the sibling deep
  routes (`fase/[phaseId]/respostas`, `interviews/[interviewId]`) and
  double-headered them; the route group leaves those untouched (URL unchanged).
  `getCaseDetail`/`getCommissionAccess` are wrapped in React `cache()` so the
  layout + child page share one request-scoped fetch.
- **Persistence + a11y.** `view`/`density`/`types` are shareable URL params
  (server reads initial; client mirrors via `router.replace({scroll:false})`).
  Feed is the default everywhere and the mobile default; the Gantt stays reachable
  (horizontal scroll). Motion reuses the app's reduced-motion-safe GSAP rise-in
  (no three.js). Visual-checkpoint calls: density toggle stays a visible control;
  `lifecycle` (cool slate) and `note` (warm taupe) get distinct neutral tones.

## Consequences

- **No new attack surface.** Reuses each table's existing RLS; a non-staff_admin /
  foreign-commission caller gets an empty timeline (every underlying read fails
  closed). The only deep-link with a credential is the document **signed download
  URL** already minted by `listCaseDocuments`. Interviews are the only event type
  with a standalone detail route (`href`); meetings/notes/actions/phases/lifecycle
  are Sheet-only.
- **Cross-cutting gotcha recorded:** meeting-conclusion writes a `case_events
  kind='meeting'` echo per linked case — any future case-event aggregation must
  dedup it (see the second dedup above).
- Adding a standalone meeting detail route later would let meeting events carry an
  `href` with no other change (the Sheet already renders "Abrir registro" when
  `href` is non-null).
- Verified by `e2e/phase12-timeline.spec.ts` (18 tests, all acceptance criteria
  incl. a keyboard-only flow); full suite green 169/169.
