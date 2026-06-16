# Phase 12 — Case Timeline: QA Review

**Date:** 2026-06-16
**Reviewer:** qa (QA Reviewer)
**Verdict:** APPROVED

---

## Verdict summary

All acceptance criteria are met. Security/RLS is sound (read-only composition over
existing RLS-scoped reads; no new attack surface; fails closed for foreign-commission
callers at both the route and query layers). Code quality is high: event-model.ts is
genuinely pure, TS strict is respected with no unjustified `any`, data access flows
through `src/lib/queries/`, Server Components by default, a11y is complete. ADR 0027
exists and is accurate. One MINOR (missing `DialogDescription` on the Sheet dialog for
screen readers) is itemized below for pre-record resolution per user preference.

---

## Checklist

### 1. Requirements — plan acceptance criteria

**AC: Timeline reachable as a secondary tab; URL is shareable; detail tab unaffected.**
PASS. `(detail)/layout.tsx` installs the `CaseTabs` bar (`Detalhes | Linha do tempo`).
The route group correctly scopes the layout to the two tab pages only — the sibling deep
routes (`fase/[phaseId]/respostas`, `interviews/[interviewId]`) are outside the group and
keep their own single `h1` (verified by AC1-regression E2E test). `view`/`density`/`types`
are shareable URL params (SSR-decoded by the server page, mirrored by the client shell
with `router.replace({scroll:false})`). Default state serializes to an empty query (clean
URL). AC1 + AC1-regression + AC8-persistence + AC8-default all pass.

**AC: One normalized event array drives both layouts; phases as bars, all other as pins.**
PASS. `getCaseTimeline` assembles a single `CaseTimelineEvent[]` sorted by `anchor`. Both
`TimelineFeed` and `TimelineGantt` consume it. Phases with `start`/`end` render as width-
proportional bars in Gantt (via `axis.spanWidth`); phases and all other types render as
single-day pins when `day` is set. AC2 + AC2-phases-as-bars pass.

**AC: All 8 types resolve to existing tokens; legend = filter.**
PASS. `type-meta.tsx` maps every type to a `var(--event-*)` / `var(--event-*-soft)` pair.
All 8 CSS custom properties are declared in `globals.css` (light and dark). No hard-coded
hex. The `TimelineLegend` doubles as the filter (`aria-pressed` toggle buttons, grouped
under `role="group"`). The shell guards the last-visible-type case (minimum 1 always on).
AC3 passes.

**AC: Duration — adaptive unit, weekend bands, today marker, sticky axis, horizontal scroll,
pins right-anchor.**
PASS. `gantt-axis.ts` picks `day`/`week`/`month` unit based on span; weekend bands render
in `day` unit only; `Marker` renders today (open) or closed marker. The axis header has
`sticky top-0`. The outer `div.overflow-x-auto` provides horizontal scroll. `nearRightEdge`
drives the right-anchor flip of pins in `Pin`. AC4 passes.

**AC: Feed — equal-height nodes, duration as text only, today divider before first upcoming.**
PASS. All feed nodes share the same `grid grid-cols-[3rem_1.875rem_1fr]` layout; the
`data-node` circle is `size-7` for every type (equal-height). Duration is `durationSuffix`
text only (never height). `TodayDivider` is inserted before `firstUpcomingIdx` (open cases
only; `reference = null` sets `firstUpcomingIdx = -1` suppressing it). AC5 passes.

**AC: done/active/upcoming from `statusOf`; closed cases static with terminal marker.**
PASS. `statusOf(e, reference)` — `reference = null` for closed cases returns `'done'` for
every event. `getCaseTimeline` uses `isTerminalCaseStatus(detail.case.status)` to
determine `isOpen`. Closed cases push the `case:closed` lifecycle node and set
`closedAt`. Duration draws the terminal marker via `axis.closedX`. AC6-closed and
AC6-closed-Duration pass.

**AC: Click opens consistent detail Sheet; deep-link where applicable.**
PASS. `TimelineEventSheet` is a Radix Dialog (proper modal: focus trap, `Escape` to close,
scroll-lock, `aria-*` wiring). "Abrir registro" renders only when `event.href` is non-null.
Interviews are the only type with a non-null `href` today (the standalone interview route).
Documents use the signed download URL as href. All others are Sheet-only with the
"exibido apenas aqui na linha do tempo" footer. AC7 passes.

**AC: Density + view + filters persist in URL; Feed is default and mobile default.**
PASS. `timeline-params.ts` encodes/decodes all three params. The server page reads initial
values from `searchParams`; the client shell writes them back. Feed is the default for
absent/unknown `view`; `parseView` falls back to `'feed'`. AC8-persistence + AC8-default +
AC8-responsive pass.

**AC: Keyboard accessible; reduced-motion safe.**
PASS. `TimelineViewSwitch` is a `radiogroup` with arrow-key navigation; all cards/bars are
`<button>` elements with `focus-visible:ring-[3px] focus-visible:ring-ring/40`. The Sheet
(Radix Dialog) traps focus and restores it on close. `TimelineMotion` bails early when
`useReducedMotion()` returns true; GSAP errors are caught and never block render. AC9 +
AC10-reduced-motion pass.

**Checkpoint tweaks.**
Both visual-checkpoint adjustments are present: density toggle is visible in the toolbar
(not hidden or icon-only — the label is `sr-only sm:not-sr-only`, visible at sm+); the
lifecycle/note color separation is reflected in `globals.css` (lifecycle = cool slate
`oklch(…252)`, note = warm taupe `oklch(…95)`).

---

### 2. Security / RLS (Architecture Rules 1, 9)

**No new attack surface.** Phase 12 adds no tables, no RLS policies, no migrations. It
adds one new query function (`listCaseMeetings`) and one internal helper
(`listCasePhasesForTimeline`), both using the RLS-scoped anon client (`createClient()`
from `@/lib/supabase/server`).

**`getCaseTimeline` composes only existing RLS-scoped reads.**
`getCaseDetail` is a SECURITY DEFINER RPC (is_staff_admin_of gated); it returns `null`
for non-staff_admin callers, and `getCaseTimeline` short-circuits to `empty` on `null`
detail. Every subsequent read (`listCaseInterviews`, `listCaseMeetings`,
`listCasePhasesForTimeline`, etc.) uses the anon client and its RLS. A foreign-commission
caller gets `null` from `getCaseDetail` before any subsequent fetch is attempted —
fail-closed.

**`case_phases_select` correctly permits the direct read.**
The `case_phases_select` policy (migration `20260613090007_cases_rls.sql` L89) is
`app.is_member_of(app.commission_of_case(case_id)) or app.is_admin()`. The
`listCasePhasesForTimeline` direct read is member-scoped (not a SECURITY DEFINER bypass)
and is justified by the fact that `getCaseDetail` (the `get_case_detail` DEFINER RPC)
does not expose `activated_at`/`completed_at`/`skipped_at` bar timestamps — confirmed by
grepping `cases.ts`. The ADR 0027 documents this choice explicitly.

**No service-role key client-side.** The only service-role usage in `src/` is
`src/lib/supabase/admin.ts` (pre-existing, server-only route handler). No new
service-role client was introduced in Phase 12.

**Route guard — defense in depth.**
`(detail)/layout.tsx` checks `access.role !== 'staff_admin' && !access.context.isAdmin`
then `detail.case.commissionId !== access.commission.id`. `(detail)/timeline/page.tsx`
repeats the identical guard independently. Both reads are `cache()`-memoized, so the
repeat costs nothing. The Security E2E test (`chefe.farm@test.local` on the CCIH timeline)
verifies: 404 at the route level AND empty array at the `case_phases` API level (RLS fails
closed at the DB).

**`(detail)` route group does NOT alter sibling routes.**
The `fase/` and `interviews/` deep routes are siblings outside the group. Verified by
inspecting the directory structure and the AC1-regression test (exactly one `h1`, no tab
navigation rendered on the interview detail page).

**Document href = signed download URL.**
`listCaseDocuments` uses `createSignedUrls(paths, 3600)` — short-lived (1 hour), minted
JIT by the existing scoped client, consistent with how documents are surfaced everywhere
else in the codebase. The timeline event sheet renders the URL in an `<a>` element;
clicking downloads the file from Supabase Storage without any privilege escalation (the
signed URL is already scoped to the requesting member).

**Dedup correctness.**
Interview echo dedup: `interviewRegistryEventIds` fetches `registry_event_id` from
`case_interviews` and builds a `Set<string>`; the event loop skips any `case_events` row
whose `id` is in that set. This is correct and cannot drop a legitimate manual note
(manual notes are authored directly, never assigned a `registry_event_id`).
Meeting echo dedup: drops `case_events kind='meeting'` wholesale. This is correct because
the meeting-conclusion RPC auto-writes these echoes (ADR 0027), manual notes are authored
with `kind ∈ {note, other}`, and decisions with `kind = 'decision'`. A user cannot author
a `kind='meeting'` event via the UI; the code comment in `getCaseTimeline` (line 408–415)
explains the invariant clearly.

**Taxonomy mapping.**
`kind='decision'` → `milestone`, `kind ∈ {note, other}` → `note`. The plan specifies
`kind ∈ {note, meeting, other}` → `note`; the implementation intentionally deviates by
dropping `kind='meeting'` (the echo dedup) rather than mapping it. This deviation is
correctly documented in the code comment and in ADR 0027 ("Deviation from the plan's
'kind ∈ {note,meeting,other} → note'") and is semantically correct.

---

### 3. event-model.ts purity (Architecture Rule 9)

`src/lib/timeline/event-model.ts` has zero import statements. It exports only pure
TypeScript types and functions. No `createClient`, `next/headers`, `server-only`, or any
cross-module import. The purity contract stated in the file header is satisfied.

---

### 4. Code quality (§8)

**TypeScript strict.** No `any` appears in `event-model.ts`, `case-timeline.ts`, or any
`src/components/timeline/` file. The cast in `e2e/phase12-timeline.spec.ts`
(`as { access_token: string }`, `as Array<{ id: string }>`, etc.) is test code and
acceptable. No violations in application code.

**Data access through `src/lib/queries/`.** Both new query functions
(`getCaseTimeline`, `listCaseMeetings`) live in `src/lib/queries/case-timeline.ts`. No
inline supabase-js in components or pages. Architecture Rule 9 satisfied.

**Server Components by default.** Both `(detail)/layout.tsx` and `(detail)/timeline/page.tsx`
are async Server Components (no `"use client"` directive). `CaseTimeline`, `TimelineFeed`,
`TimelineGantt`, `TimelineLegend`, `TimelineDensitySwitch`, `TimelineViewSwitch`,
`TimelineEventSheet`, `TimelineMotion`, and `AvatarStack` are all correctly marked
`"use client"` because they hold state or interact with events. `type-meta.tsx`,
`gantt-axis.ts`, `format.ts`, `timeline-params.ts` are pure modules with no client
directive. The boundary is clean.

**pt-BR user-facing text (Rule 10).** All user-facing strings are pt-BR:
"Linha do tempo", "Ciclo do caso", "Fase", "Marco", "Entrevista", "Reunião",
"Documento", "Ação", "Nota", "Abrir registro", "Fechar", "Hoje", "Em andamento",
"Concluído", "Previsto", "Cancelada", "Não necessária", empty-state messages, etc.
No raw English labels reach the UI.

**No raw Postgres/Supabase errors in the UI.** `getCaseTimeline` returns `empty` on any
error (all sub-reads fail silently to `[]`); the page renders an empty-state component.
No error propagation path to user-visible strings.

**Motion.** `TimelineMotion` bails on `useReducedMotion()`. GSAP is dynamically imported;
a `try/catch` wraps the async block so any failure is silent. No `three.js` (per plan
decision 11). The GSAP `clearProps` calls ensure no residual transform affects layout.

**File ownership.** Backend files: `src/lib/timeline/event-model.ts`,
`src/lib/queries/case-timeline.ts`, additions to `src/lib/queries/cases.ts` (cache wrap)
and `src/lib/queries/session.ts` (cache wrap), exports added to `src/lib/queries/meetings.ts`.
Frontend files: `src/components/timeline/**`, `src/app/c/[slug]/manage/cases/[caseId]/(detail)/**`,
`src/app/globals.css`. No cross-ownership violations.

**ADR.** ADR 0027 (`docs/decisions/0027-case-timeline.md`) exists, is accurate, and
documents all material decisions including the meeting-echo dedup deviation.

---

### 5. UX & Accessibility

**Labels and keyboard flow.**
- `TimelineFeed`: `ol[aria-label="Linha do tempo do caso"]`. Every card is a `<button type="button">` with visible focus ring. The `data-node` marker is `aria-hidden="true"` (decorative).
- `TimelineGantt`: Phase bars (`data-bar`) and pins (`data-pin`) are `<button type="button">` with `focus-visible` styles.
- `TimelineViewSwitch`: `role="radiogroup" aria-label="Modo de visualização"` with `role="radio" aria-checked` buttons and ArrowLeft/Right key handling.
- `TimelineDensitySwitch`: `role="radiogroup" aria-label="Densidade"` with the same pattern.
- `TimelineLegend`: `role="group" aria-label="Filtrar tipos de evento"` with `aria-pressed` toggle buttons.
- AC9 keyboard-only flow: tab to view switch → ArrowRight flips to Gantt → ArrowLeft back → tab to card → Enter opens Sheet → Escape closes. All pass.

**Sheet (Radix Dialog) accessibility.**
`DialogPrimitive.Title` (rendered as the event's title, `text-xl`) provides the dialog's
accessible name. `DialogPrimitive.Close` has `aria-label="Fechar"`. The Radix Dialog
primitive handles `role="dialog"`, `aria-modal="true"`, focus trap, and `Escape` dismissal
natively.

---

## Findings

### MINOR-1 — Sheet dialog missing `DialogDescription` for screen readers

`src/components/timeline/timeline-event-sheet.tsx`, `SheetBody` (rendered inside
`DialogPrimitive.Content`): the dialog has a `DialogPrimitive.Title` (the event title)
but no `DialogPrimitive.Description`. Radix logs a console warning in development when
`Description` is absent (`VisuallyHidden` wrapping an empty description is the idiomatic
fix). WCAG 2.1 SC 4.1.2 does not strictly require a description, but a screen reader user
hears only the title when the dialog opens, with no summary of what the panel contains
(type, date, status). This is a minor a11y gap; the plan does not mandate it but §8 sets a
high a11y bar.

**Fix:** Add a `DialogPrimitive.Description` immediately after `DialogPrimitive.Title` with
a brief pt-BR summary (e.g., `Detalhes do evento {meta.label} · {formatEventDate(event)}`).
It can be visually hidden if the design is tight, but it must be present in the DOM.

Example (inside `SheetBody`, after the `Title`):

```tsx
<DialogPrimitive.Description className="sr-only">
  {meta.label} · {formatEventDate(event)}
</DialogPrimitive.Description>
```

---

### INFO-1 — ADR 0027 was present pre-review (no action)

ADR 0027 exists at `docs/decisions/0027-case-timeline.md` and was written during the
phase. Its absence as an INFO item is therefore not applicable. Noted for completeness.

---

## Verdict

**APPROVED** — pending MINOR-1 fix pre-record (per user preference).

All acceptance criteria are met. Security/RLS is sound: the read-only composition over
existing RLS-scoped reads introduces no new attack surface; a foreign-commission caller
gets a 404 at the route and an empty array at the DB level. The `case_phases` direct read
is correctly justified and scoped. event-model.ts is pure. TS strict is clean. A11y is
complete at the layout, card, Sheet, and keyboard levels, with one minor missing
`DialogDescription` to address before the Record step.
