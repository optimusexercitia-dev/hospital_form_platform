# Phase 12 — Case Timeline (archived task detail)

✅ complete 2026-06-16. A read-only chronological **Linha do tempo** tab on the case
detail page, aggregating the case's real sub-entities (lifecycle, phases, interviews,
meetings, documents, action items, manual notes) into two layouts — vertical **Feed**
(default) + horizontal **Duration/Gantt** — per `docs/design/README_timeline.md`,
adapted to real dates + the project design system. **No DB migration; reuses existing
table RLS.** Design + 15 decisions: plan `when-visualizing-a-case-misty-rossum.md`;
ADR [0027](../decisions/0027-case-timeline.md); review
[phase-12-review.md](../reviews/phase-12-review.md). Execution was prototype-first
(human visual checkpoint before data wiring).

## Tasks

| ID | Owner | Task | Depends on | Status |
| -- | ----- | ---- | ---------- | ------ |
| B1 | backend | Post **contract**: `CaseTimelineEvent`/`TimelineEventType`/`TimelineStatus`/`TimelinePerson` types + derived helpers (`anchor`/`endDay`/`durationDays`/`statusOf`/`initialsOf`) in PURE **`src/lib/timeline/event-model.ts`** (client-importable; no server imports — clean boundary); stub `getCaseTimeline(caseId)` + `listCaseMeetings(caseId)` + `CaseTimeline`/`CaseMeetingLink` in `src/lib/queries/case-timeline.ts` (typed-empty). | – | ✅ |
| F1 | frontend | **Visual prototype** vs README seed data: `src/components/timeline/` — `type-meta`, `timeline-feed`, `timeline-gantt` (adaptive axis), `timeline-view-switch`, `timeline-density-switch`, `timeline-legend`, `timeline-event-sheet`, `avatar-stack`, `timeline-motion`, `gantt-axis`, `format`. **Human approved the look** at the visual checkpoint (density toggle stays visible; lifecycle/note nudged apart). | B1 | ✅ |
| B2 | backend | Implement `getCaseTimeline` + new `listCaseMeetings` (reverse `meeting_cases→meetings`, reuses exported `mapMeetingListItem`/`MEETING_LIST_COLUMNS`/`MeetingRow`); direct RLS-scoped `case_phases` read for bar timestamps (NO RPC change — `case_phases_select` allows member read); interview→case_event dedup (by `registry_event_id`) **+ meeting-echo dedup** (drop `case_events kind='meeting'`); lifecycle-closed tint from `outcome.colorToken`; wrapped `getCaseDetail`/`getCommissionAccess` in React `cache()`. Verified vs seeded CCIH cases (open + closed). | B1 | ✅ |
| F2 | frontend | Route refactor via **`(detail)` ROUTE GROUP** (not a bare `[caseId]/layout.tsx`, which would double-header the sibling `fase/[phaseId]/respostas` + `interviews/[interviewId]` deep routes): new `(detail)/layout.tsx` (spine + `CaseTabs`) + `(detail)/page.tsx` (Detalhes body, moved not rewritten) + `(detail)/timeline/page.tsx` (real `getCaseTimeline`); URL persistence codec `timeline-params.ts` + mounted-guarded `useEffect`→`router.replace({scroll:false})` in the shell (SSR-correct, robust same-tick); responsive (Feed default, Gantt scrolls); empty states; lifecycle→cool / note→warm-taupe separation in `globals.css`; deleted unused `__fixtures__`. Verified in preview — Detalhes unchanged, real data on open `…c1` + closed `…c2`, both deep routes keep their own single header. | B2, F1 | ✅ |
| T1 | tester | `e2e/phase12-timeline.spec.ts` (18 tests, AC1–AC10 + regression + security, incl. keyboard-only AC9) `[gate]`. Spec authored by `tester`; **lead ran the authoritative `--workers=1` fresh-seed pass to declare green** (tester subagent stalled on its watchdog during the long full-suite run). Full suite **169/169 GREEN**. Tester's interim parallel-run failures classified (by its own isolation runs) as parallel DB-contention + seed drift, NOT regressions — confirmed by the clean serial pass. | F2 | ✅ |
| Q1 | qa | Requirements + code + RLS/security review → `docs/reviews/phase-12-review.md`. **APPROVED** (0 blockers/majors; 1 MINOR — Sheet `DialogPrimitive.Description` — resolved pre-record). | T1 | ✅ |

## Lead notes

Read-only feature; the durable backend surface is in `docs/backend-state.md`.
Contract-first: B1 unblocked F1 (prototype) and B2 in parallel. Right-sized review:
B1/B2 touched **no migrations/RLS** (additive query + types over existing RLS-scoped
reads) → one-line plan + ack. F1/F2 introduced a **new route group + a genuinely new UI
pattern** → full frontend plan review (the `(detail)` route-group decision came out of
that review, fixing a header-doubling risk on the deep routes). File ownership: backend =
`src/lib/{timeline,queries}`; frontend = `src/app/c/[slug]/manage/cases/[caseId]/**`,
`src/components/timeline/**`, `globals.css`.

**Operational learnings (carry forward to future gates):**
- The local Playwright config is **fully parallel by default** (`workers: undefined`); the
  green gate recipe is **`npx playwright test --workers=1` after a fresh `npx supabase db
  reset`**. Parallel runs over the shared local DB produce contention failures that
  isolation runs clear — they are NOT regressions.
- **Subagents stall on the 600s stream watchdog during the long (~6 min) full-suite run**
  (a single foreground Bash call makes no tool-call progress). The lead ran the
  authoritative full-suite pass via **background Bash** (watchdog-immune; re-invokes on
  completion). Prefer this for the gate's declare-green run.

## Gate
- **Build:** typecheck + lint clean (0/0).
- **Test pass:** full suite **169/169** serial (re-confirmed green after the MINOR-1 fix).
  See PROGRESS Test Run Summary (2026-06-16 rows).
- **QA:** APPROVED — [phase-12-review.md](../reviews/phase-12-review.md). 1 MINOR resolved.
