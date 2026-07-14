# QA Review — Interviews v2 (IV2): sessions + reporting/confidentiality

**Track:** S2 · IV2 (Phase-11 Interviews revision, ADR 0070). Branch `pre-pilot-release-s0`.
**Commits reviewed:** `b015815` (I1–I3 backend), `da7c219` (I4 UI), `55506df`/`77daa90` (I5 E2E + graph).
**Reviewer:** `qa`. **Date:** 2026-07-13.
**Verdict: ✅ APPROVED** — 0 Blocker · 0 Major · 0 Minor · 4 Info.

Audited against `docs/plans/interviews-v2-sessions.md` (§I1–I5 + §4 state machine + §2 spine),
ADR 0070, and `docs/plans/pre-pilot-release-s0-ratification.md` §D/§E (X-γ, X-δ). This is a
document/code audit; the full `e2e:prod` gate is the lead's separate run (spec passed 13/13
chromium ×2 per the tester).

---

## 1. Requirements (§I1–I5 + §4 state machine) — MET

- **Schema (I1).** `interview_sessions` created with all specified columns, CHECKs
  (`session_type`/`status`/`modality`/schedule-range/actual-range/`completed_has_start`),
  `unique(interview_id, sequence_number)` + index. `case_interviews` hard-cut of the five
  scheduling columns + `conducted_at`; added `interview_category` (NOT NULL, no default) and
  `confidentiality_level` (NOT NULL default `standard`); `status` CHECK widened with
  `awaiting_follow_up`. `case_interview_subjects.relationship_to_case` NOT NULL added. Helpers
  `app.commission_of_session` / `app.assert_session_writable` present (wrap the interview
  equivalents through `interview_id`).
- **State machine (§4) — exact.** `app.guard_interview_status` encodes precisely the §4 graph
  (`draft→{scheduled,cancelled}`, `scheduled→{in_progress,cancelled}`,
  `in_progress→{awaiting_follow_up,completed,cancelled}`, `awaiting_follow_up→{in_progress,
  completed,cancelled}`, `completed→in_progress`); invalid transitions raise `HC038`; out-of-RPC
  status changes blocked; terminal interviews frozen.
- **`awaiting_follow_up` derivation.** Lives inside `complete_session` (side-effect, not a
  trigger — auditable/testable per §2/§6): flips the interview to `awaiting_follow_up` iff
  another `scheduled` session remains (`status='scheduled' AND id<>p_session_id`), else stays
  `in_progress`. Cancelled/no_show sessions correctly do not count. pgTAP tests 24–28 lock both
  arms + the `awaiting_follow_up → in_progress` re-start.
- **Cancel cascade.** `cancel_interview` sets non-terminal (`scheduled`/`in_progress`) sessions
  to `cancelled` **before** flipping the parent terminal, so the child-lock trigger is not
  self-blocked. Correct ordering.
- **One registry row per interview.** `conclude_interview` upserts the single
  `case_events kind='interview'` row (insert when `registry_event_id` null, else update the same
  row), body recomposed from session actuals (`count(*)`, `min(actual_start)` of completed
  sessions). Precondition widened to `{in_progress, awaiting_follow_up}`; `≥1 subject` guard
  (HC041) kept. `reopen_interview` left unchanged (still `completed→in_progress`).
- **Required fields.** `interview_category` required at create (HC0B1, client + server);
  `relationship_to_case` required at add (HC0B2). Both enforced in RPC bodies and by NOT-NULL.
- **Data-access + UI (I3/I4).** New unions/`InterviewSession`/`listInterviewSessions`; list/detail
  drop the scheduling fields and gain `interviewCategory`/`confidentialityLevel`/`nextSession`;
  `InterviewSubject.relationshipToCase` added. UI: `sessions-panel` (start/complete/cancel/no-show
  wired), `session-form` (schedule/reschedule), split create dialog with required category +
  confidentiality picker, subject-form required relationship picker.

## 2. Security / RLS — SOUND (the load-bearing dimension)

- **`interview_sessions` SELECT is an exact mirror of the LIVE sibling.** IV2 policy:
  `can_read_case(case_of_interview(interview_id), (select auth.uid())) OR
  is_commission_admin_of(commission_of_interview(interview_id))` — byte-for-byte the live
  `case_interview_subjects_select` (migration `20260713001200`). A session is exactly as
  readable as its interview, no wider.
- **WRITE mirror + correct helper.** `can_write_interview(interview_id, (select auth.uid())) OR
  is_commission_admin_of(commission_of_interview(interview_id))` on `for all`, matching the live
  sibling write policy after migration `20260709000200` mechanically swapped
  `is_org_admin_of_commission → is_commission_admin_of` and dropped the old function. IV2 uses the
  **live** helper `is_commission_admin_of` (NOT the dropped name — this is the classic
  copy-a-stale-baseline trap, avoided here). InitPlan `(select auth.uid())` form used throughout.
  pgTAP tests 45/46 prove participant-write POS + non-writer HC039; test 48 proves cross-commission
  SELECT isolation (0 rows).
- **RPC hardening (t19).** All twelve public RPCs are `SECURITY DEFINER`, pin `search_path`, call
  `assert_interviews_enabled()` + a writability assert (`assert_interview_writable` /
  `assert_session_writable`), toggle the `app.in_interview_rpc` guard, and issue
  `REVOKE ALL … FROM PUBLIC` then `GRANT authenticated, service_role`. pgTAP tests 49–60 assert
  PUBLIC has no EXECUTE on each (incl. `app.assert_session_writable`).
- **Audit routed correctly.** Session verbs (`session_scheduled/rescheduled/started/completed/
  cancelled/no_show`, `confidentiality_changed`) emit via `app.audit_write(...)` (the mutation
  door) and are **not** added to the `log_audit_access` read allow-list. This matches S0 §D and is
  the correct divergence from the stale plan §2.4 (which pre-dated the S0 audit-door split); the
  RPC migration header documents the choice. PHI-free metadata only.
- **Rule 12 (PHI) held.** `relationship_to_case` CHECK + RPC allow-lists exclude
  `patient`/`family_member`; `interview_category` has no patient/family value; no `participant_id`
  FK; no PHI bucket or audited-single-door introduced. Interviews stay staff-only, non-PHI.
- **Confidentiality foot-gun neutralized.** `confidentiality_level` gates access **nowhere** — not
  in the two RLS policies, not in any `queries/interviews.ts` read path. The UI carries the
  mandatory *visible* helper (`CONFIDENTIALITY_HELPER_TEXT` = "Classificação informativa. Ainda não
  restringe o acesso…") wired via `aria-describedby` beside the picker, and the badge is muted
  (`bg-muted`/`bg-secondary`/`bg-accent` — never destructive) with the same clarification as a
  native `title` + `sr-only` span. A viewer cannot mistake it for a gate.

## 3. Collision conformance (S0 §E) — CONFORMANT

- **X-γ.** IV2 lands the inert columns only: `confidentiality_level` (non-enforcing) +
  `relationship_to_case`, with **no** `participant_id` FK and no participant wiring. ETH·E1 can add
  enforcement + the FK with no re-migration. No speculative wiring found.
- **X-δ.** Confidentiality uses its own 3-value set `{standard, restricted, highly_restricted}` —
  correct for IV2; the remap to the F2 7-value taxonomy is E1's job (S0 §I ETH·E1 O3). Not a
  taxonomy violation.

## 4. Code quality — CLEAN

- **Rule 8.** `src/lib/types/database.ts` regenerated: `interview_sessions` Row/Insert/Update
  present; `case_interviews` Row confirmed to carry `interview_category` + `confidentiality_level`
  and **none** of the six dropped columns. Types imported only from `src/lib/types`.
- **Rule 9.** Reads go through `src/lib/queries/interviews.ts`; every mutation routes through an
  RPC via the RLS-scoped client. (The pre-existing F2 `case_interview_links` inline write in
  `actions.ts` is unchanged by IV2 and out of scope.)
- **Rule 10.** DB stores English slugs; pt-BR labels + helper copy centralized in
  `interview-labels.ts`; comments/commits in English.
- **Strict TS / hard-cut cleanliness.** No unjustified `any`. The dropped fields are removed
  everywhere they were consumed — verified in the `case-timeline.ts` fix
  (`iv.conductedAt ?? iv.scheduledStart` → `iv.nextSession?.scheduledStart ?? iv.concludedAt`).
- **Tests.** `121_interviews.sql` `plan(60)`: schema/CHECKs/uniqueness, RLS member-read /
  non-member-0 / writer-vs-non-writer, the full transition NEG/POS incl. `awaiting_follow_up`
  derivation, cancel cascade, child-lock freeze, and the t19 REVOKE matrix. The 3 sibling fixtures
  (`144`/`197`/`208`) patched for the new NOT-NULL columns — a necessary hard-cut consequence.

## 5. Findings (Info only — none blocking)

- **INFO-1.** `update_interview_subject` and `app.commission_of_session` lack their **own** t19
  assertion in `121_interviews.sql` (the migration does issue `REVOKE ALL FROM PUBLIC` for both,
  and 12 representative guards exist). Add for completeness in a future pass.
- **INFO-2.** `createInterview` returns `{ok:false, interviewId}` if `create_interview` succeeds
  but the inline `schedule_session` fails — the draft interview persists and the dialog routes
  into it. Documented/intentional; acceptable.
- **INFO-3.** `getInterviewDetail` returns `subjectCount:0`/`subjectSummary:''` (subjects are
  fetched separately via `listInterviewSubjects`). Pre-existing pattern; benign.
- **INFO-4.** `conclude_interview` sets the registry `occurred_at` from `min(actual_start)` of
  completed sessions (earliest). Sensible for a registry date; noted since the plan mentioned
  "earliest/latest".

## Verdict

**APPROVED.** The load-bearing pieces — the §4 state machine and the `interview_sessions` RLS —
are faithful: the policies are exact mirrors of the live interview-child siblings using the correct
`is_commission_admin_of` helper and the InitPlan form, so a session is exactly as reachable as its
interview and no more. RPCs are DEFINER + flag-gated + writability-asserted + t19-revoked; audit is
on the mutation door; Rule 12 stays intact; the non-enforcing confidentiality tag gates nothing and
is unmistakably labelled. X-γ/X-δ conformant for E1. No blocking or actionable-now findings.
