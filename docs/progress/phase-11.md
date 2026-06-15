# Phase 11 — Interviews (task detail)

✅ **Complete 2026-06-15.** Branch `phase-11-interviews`. Case-scoped sibling of Meetings,
behind the `interviews` flag (ON in-phase). Approved plan:
`~/.claude/plans/it-is-common-for-jazzy-lake.md` (14 resolved decisions). Design rationale:
ADR [0026](../decisions/0026-interviews.md). QA review:
[docs/reviews/phase-11-review.md](../reviews/phase-11-review.md) — APPROVED (0 blockers/0 majors).
Test gate: full suite **152/152** green (10 Phase-11 tests).

## Tasks

| ID | Owner | Task | Status |
| -- | ----- | ---- | ------ |
| B0 | backend | Contract-first: typed signatures in `src/lib/queries/interviews.ts` + `src/lib/interviews/actions.ts` + ADR 0026 | ✅ contract posted + corrected to lead's header/attachment-kind fixes + coordinator projections (`viewerCanWrite`/`subjectSummary`/dual `openUrl`+`externalUrl`/`createInterview→interviewId`) |
| B1 | backend | **[plan]** Migration + RLS plan for lead review (esp. `can_write_interview` row-level grant) | ✅ APPROVED by lead with corrections |
| B2 | backend | Migrations: core + children + `case_events` kind + storage bucket | ✅ `091000`–`091004` applied (db reset clean); ADR 0026 written |
| B3 | backend | RLS (`commission_of_interview`, `can_write_interview`) + lifecycle/participant/conclude RPCs + `interviews_enabled()`; regen types; seed | ✅ RLS + 16 RPCs + `interview_viewer_can_write` read; types regenerated; queries/actions/messages; seed fixture (Caso 0001, chefe.ccih registered interviewer) |
| B4 | backend | pgTAP: minting, lifecycle/freeze guards, participant write grant, commission/case+phase guards | ✅ `supabase/tests/121_interviews.sql` (28 tests); FULL pgTAP 349 green; lint+typecheck+24 vitest green |
| F0 | frontend | Queries/actions wiring + `interviews` flag gating against B0 contract | ✅ shared layer (labels/format/badges/`useInterviewAction`/confirm-delete); flag-gated reads |
| F1 | frontend | **[plan]** "Entrevistas" panel + interview detail route group | ✅ panel on case detail (flag-gated, coordinator-only create) + detail route group + `loading.tsx`; conditional back-link |
| F2 | frontend | Detail hub: header + lifecycle controls, summary editor, subjects/interviewers panels | ✅ header + 5-state lifecycle (`cancelada` terminal; only `concluida` reopens) + markdown summary + subjects (free-text role) + interviewers (fixed-enum role) |
| F3 | frontend | Attachments panel (upload + add-link + open/download); pt-BR; a11y; GSAP | ✅ unified attachments: upload (25 MiB, PDF/img/office) + add-link (https) + open/download (`openUrl`, new-tab + `rel=noopener noreferrer`) |
| T1 | tester | **[gate]** Playwright E2E per acceptance (participant-grant RLS negatives, keyboard flow) | ✅ 10/10 Phase-11 green (AC9 MINOR-1 lock-in added); full suite **152/152** |
| Q1 | qa | Requirements + code + RLS review → `docs/reviews/phase-11-review.md` | ✅ APPROVED — 0 blockers/0 majors; 1 MINOR (post-conclude upload UI) cleared pre-record |

## Lead notes

- Template cloned = Meetings (`20260615090000`–`090009`). Contract-first: B0 posted before F0/F1 so
  frontend built against real types in parallel; lead corrected the contract (header `modality`/
  `meeting_url`/`scheduled_start`+`end`/`conducted_at`/optional `title`; 4-value attachment `kind`
  with file-XOR-link; `viewerCanWrite` projection) before frontend's full build.
- **New RLS shape** (`can_write_interview` participant-write grant) and the **new route group** got
  full plan review (CLAUDE.md §4); the rest were pattern-following.
- Route placement: detail nested at `c/[slug]/manage/cases/[caseId]/interviews/[interviewId]` —
  verified no `manage/layout.tsx` guard, so a membership-level page guard there is valid for the
  plain-`staff` interviewer; back-link conditional (coordinators → case; others → commission home).
- Bugs: **P11-001** (BLOCKER, RSC closure-serialization on the attachments delete button — fixed via
  `.bind(null, …)`); **P11-MINOR-1** (post-conclusion upload UI; fixed via `canManageAttachments`,
  locked in by AC9). **P10-LATENT-001** (MAJOR) — identical latent crash found in passing in
  `meetings/attachments-panel.tsx`, fixed here.

## Deferred follow-up

- "Minhas entrevistas" discovery surface for plain-`staff` interviewers (out of scope per approved
  plan; v1 reaches the detail by direct link). Logged in PROGRESS Follow-ups.
