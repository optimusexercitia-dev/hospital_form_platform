# IV2 — Interviews v2 (Sessions + Reporting/Confidentiality) — completed-track record

Rotated out of the live PROGRESS.md at Record (2026-07-14). **First track of S2** (Pilot cores) in the
[Pre-Pilot Release Scope Expansion](../plans/pre-pilot-release-scope-expansion.md) (ADR 0071). Pre-pilot revision
of the shipped Phase-11 Interviews module. Plan: [interviews-v2-sessions.md](../plans/interviews-v2-sessions.md) ·
ADR [0070](../decisions/0070-interview-data-model-v2-sessions.md). Flag `interviews` (existing, ON).
**Local-first; remote deploy DEFERRED to the pilot reset.** Branch `pre-pilot-release-s0`.

## What shipped
Replaces the one-encounter-per-interview rigidity with an `interview_sessions` 1:N child. **Reset-OK hard-cut /
forward-only** (drops the moved columns; no back-compat; seed rewritten).

- **I1 schema/RLS** (mig `20260720000800_interview_sessions_schema.sql`): new `public.interview_sessions`
  (`sequence_number` UNIQUE per interview, `session_type`, `status`, nullable `modality`, `scheduled_*`/`actual_*`,
  `location_text`, `meeting_url`, `cancellation_reason`); CHECKs + `updated_at` touch + `guard_interview_child_lock`.
  RLS **mirrors the LIVE `case_interview_subjects` sibling** through `interview_id`: SELECT = `can_read_case OR
  is_commission_admin_of`, WRITE = `can_write_interview OR is_commission_admin_of`, InitPlan `(select auth.uid())`
  (correct ADR-0051 helper — the dropped `is_org_admin_of_commission` trap avoided). Helpers
  `app.commission_of_session` + `app.assert_session_writable`. `case_interviews`: **DROP** 5 scheduling cols +
  `modality`; **ADD** `interview_category` (required), `confidentiality_level` (**non-enforcing**, default
  `standard`); status widened with `awaiting_follow_up`; `guard_interview_status` rewritten for the §4 machine.
  `case_interview_subjects.relationship_to_case` (required; **excludes patient/family** — staff-only, Rule 12).
- **I2 RPCs** (mig `20260720000810_interview_sessions_rpcs.sql`): re-mapped `create/update/conclude/reopen/
  cancel_interview` (drop scheduling args; require category); new `schedule/update/start/complete/cancel/
  no_show_session`; `add/update_interview_subject` (+ relationship). All DEFINER + `assert_interviews_enabled` +
  writability guard + **t19 REVOKE→GRANT**. `awaiting_follow_up` derived inside `complete_session` (side-effect,
  not a trigger — auditable/testable). `conclude_interview` recomposes the single `case_events` registry row from
  session actuals. Session verbs emitted via **`app.audit_write`** (mutation door), NOT `log_audit_access` — the
  correct S0 §D routing (the plan §2.4 wording was imprecise for write verbs).
- **I3 frozen contract**: `queries/interviews.ts` (unions `InterviewCategory`/`InterviewConfidentiality`/
  `RelationshipToCase`/`SessionType`/`SessionStatus`; `InterviewSession` + `listInterviewSessions`; reshaped
  `InterviewListItem`/`InterviewDetail`/`InterviewSubject` + `nextSession`); `lib/interviews/{actions,messages}.ts`
  (session actions + create-then-schedule; `HC0B0-2` pt-BR); `components/interviews/interview-labels.ts` label maps.
  2-line consumer fix in `queries/case-timeline.ts` (dropped cols → `nextSession.scheduledStart ?? concludedAt`).
- **I4 UI** (`src/components/interviews/*`): NEW `sessions-panel.tsx` + `session-form.tsx`; rewired
  form-dialog/header/panel/lifecycle-actions/subject-form/subjects-panel/badges/format + the host page. Create =
  required category + non-enforcing confidentiality (mandatory visible helper via `aria-describedby` + muted badge,
  `title`/`sr-only`); create-then-schedule one action; per-session lifecycle; required relationship picker;
  `awaiting_follow_up` badge.

## SQLSTATE
`HC0B0` schedule precondition · `HC0B1` missing/invalid `interview_category` · `HC0B2` missing/invalid
`relationship_to_case` · reuse `HC038` (invalid transition) / `HC039` (not writable) / `HC041` (min-subject).
`HC0B3–9` reserved.

## Gate (CLAUDE.md §6) — all ✅
- **Build:** whole-project `tsc` GREEN · `eslint --max-warnings=0` 0/0 · Vitest **369/369** · `next build` ok.
- **pgTAP:** `121_interviews.sql` **60/60**; full suite **2287 PASS** on fresh reset (3 sibling fixtures
  `144`/`197`/`208` patched for the new NOT-NULL cols).
- **Phase E2E:** `e2e/phase11-interviews.spec.ts` fully rewritten (13 specs, IV2-0…IV2-11) — **13/13**, run 2×
  independently on fresh resets, 0 flakes, **0 bugs**; passed again in the full run (batch 5).
- **Full `e2e:prod` (declaring-green, BATCH_SIZE=4, 14 batches):** 667p/19f/1flaky — **within the documented
  ~18–31 flaky baseline** (memory `e2e-prod-build-flaky-baseline`). **Every failing spec proven GREEN in strict
  isolation** (batch-11 collapse phase4/phase5 + batch-1 answer-model/builder-dialog → 31/0 `RETRIES=0`; batch-8
  specs 75/0; views-labels 7/7). The residual full-run reds are purely the Windows prod-standalone stochastic
  env-collapse — a different batch collapses each run (batch 8 then batch 11), NOT code. **Zero IV2 regressions.**
  - One deterministic red surfaced + fixed: `views-labels-participants` AC-6a — a **pre-existing, non-IV2** stale
    selector from the branch's `ce4744e` datetime a11y fix (label-wrapping → sibling); retargeted to the existing
    `fieldContainer()` helper (`6599b42`); re-verified 7/7 in isolation. `e2e/` swept — only that spec had it.
- **QA:** ✅ **APPROVED** — 0 B / 0 M / 0 m / 4 Info ([review](../reviews/iv2-interviews-review.md)).
- **Human:** ✅ approved 2026-07-14 → Record + open RV2.

## Collision conformance (S0 §E)
- **X-γ:** landed the inert columns (`confidentiality_level` non-enforcing, `relationship_to_case`) with **no**
  `participant_id` FK → ETH·E1 (S3) adds enforcement + the FK with no re-migration.
- **X-δ:** IV2's own 3-value confidentiality set (`standard/restricted/highly_restricted`) is correct-for-now; the
  remap to the F2 7-value taxonomy is E1's job (S0 §I ETH·E1 O3).

## Commits (branch `pre-pilot-release-s0`)
`b015815` I1-I3 backend · `da7c219` I4 UI · `77daa90` I5 spec · `55506df`/`b01a83a` graphify · `5d85913` QA review ·
`6599b42` AC-6a stale-test fix · `phase(11-v2): complete` (Record).

## Open follow-ups (non-blocking, from QA Info)
- `update_interview_subject` / `commission_of_session` carry `REVOKE ALL FROM PUBLIC` in the migration but lack
  their own t19 pgTAP assertion — add to `121` when convenient.
- `createInterview` persists the draft if the inline first-session schedule fails (intentional; documented).

Backend surface durably mapped in [backend-state.md](../backend-state.md).
