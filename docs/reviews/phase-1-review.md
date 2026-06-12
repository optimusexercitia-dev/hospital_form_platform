# Phase 1 QA Review — Database Schema, Auth & RLS

**Verdict: APPROVED**
**Reviewer:** qa (QA Reviewer agent)
**Date:** 2026-06-12 (initial review); re-verified 2026-06-12 after M8 fixes
**Baseline:** ARCHITECTURE.md Rules 1–10 + PHASES.md Phase 1 assertions

---

## Re-verification Note (2026-06-12)

Backend addressed all findings from the initial review in `supabase/migrations/20260612100008_rls_hardening.sql` and updated test files. Full gate re-run: pgTAP 65/65 (up from 56 — 9 new tests), Vitest 20/20, Playwright 3/3. All five previously-open findings are now resolved; see individual items below. PROGRESS.md updated.

---

## Summary

The Phase 1 deliverables are correct and the security boundary is solid. All pgTAP tests pass (65/65 after fixes), Vitest unit tests pass (20/20), Playwright smoke tests pass (3/3), and the seed produces a valid, spec-conformant dataset. No blocker-severity issues remain.

---

## Detailed Findings

### MAJOR-1 — `commission_members_staff_admin_update` USING clause does not restrict to staff-only rows

**RESOLVED** in `supabase/migrations/20260612100008_rls_hardening.sql:13-14`.

**File:** `supabase/migrations/20260612100006_rls_policies.sql:152-163`
**Requirement:** ARCHITECTURE.md Rule 1 + PHASES.md Phase 1 — "A staff_admin manages STAFF only — they may not create or promote staff_admins."

The DELETE policy for `commission_members` correctly restricts to `role = 'staff'` in both USING and WITH CHECK. The UPDATE policy had the role restriction only in WITH CHECK (new row), not in USING (row selection). A staff_admin could target an existing `staff_admin` member row for UPDATE and demote them to `staff`.

Fix applied: `ALTER POLICY commission_members_staff_admin_update ... USING (is_staff_admin_of(commission_id) AND role = 'staff')`. Verified live: the policy USING clause is now `(app.is_staff_admin_of(commission_id) AND (role = 'staff'::text))`.

Test added: `supabase/tests/40_rls.sql:172-195` inserts a second staff_admin into commission X, then acts as the first staff_admin and attempts the demotion UPDATE — confirms the update matches no rows and the target row remains `staff_admin`.

---

### MAJOR-2 — `response_section_signoffs` immutability after submission is not tested

**RESOLVED** in `supabase/tests/10_immutability.sql:124-171`.

**File:** `supabase/tests/10_immutability.sql`
**Requirement:** PHASES.md Phase 1 assertion — "submitted responses/answers/sign-offs reject UPDATEs"

The trigger `guard_submitted_signoffs_trg` was correctly implemented; the gap was in test coverage only.

Three tests added (plan increased from 11 to 14):
- INSERT a sign-off on a submitted response raises `23514`.
- UPDATE an existing sign-off row (created while in_progress, before submission) raises `23514` after submission.
- DELETE an existing sign-off row raises `23514` after submission.

All three DML operations are now covered, satisfying the PHASES.md assertion.

---

### MINOR-1 — `app.eval_condition` has no `search_path` set

**RESOLVED** in `supabase/migrations/20260612100008_rls_hardening.sql:22-76`.

**File:** `supabase/migrations/20260612100005_condition_evaluator_and_rpcs.sql:23-79`

`app.eval_condition` was `SECURITY INVOKER` and `IMMUTABLE` with no `set search_path` clause. No practical risk (pure JSONB computation, no table access), but inconsistent with the codebase standard.

Fix applied: `CREATE OR REPLACE` with `set search_path = pg_catalog`. Using `pg_catalog` only (not `app, public, pg_catalog`) is correct since the function accesses no schema-qualified objects at all. Verified live: `config` column shows `search_path=pg_catalog`.

---

### MINOR-2 — `profiles_admin_all` policy allows admin to DELETE profiles

**RESOLVED** in `supabase/migrations/20260612100008_rls_hardening.sql:86-113`.

**File:** `supabase/migrations/20260612100006_rls_policies.sql:119-122`
**Requirement:** ARCHITECTURE.md Rule 2 — "profiles are NEVER deleted (responses reference them); deactivate via is_active"

Fix applied with two complementary layers:
1. `profiles_admin_all` (FOR ALL) dropped and replaced with three explicit policies: `profiles_admin_select`, `profiles_admin_insert`, `profiles_admin_update` — no DELETE policy at all, so RLS returns zero rows to any authenticated DELETE attempt.
2. An unconditional `BEFORE DELETE` trigger `guard_profile_no_delete_trg` (calling `guard_profile_no_delete()`) raises `check_violation` for any DELETE, including when RLS is bypassed by the service role or postgres.

Verified live: profiles table has no DELETE policy. Test in `40_rls.sql:198-223` confirms both layers: (a) admin DELETE is a silent no-op under RLS, and (b) postgres-level DELETE raises `23514`.

---

### MINOR-3 — `responses_insert_own` does not validate `form_version_id` matches `commission_id`

**RESOLVED** in `supabase/migrations/20260612100008_rls_hardening.sql:122-153`.

**File:** `supabase/migrations/20260612100006_rls_policies.sql:251-256`

Fix applied via a `BEFORE INSERT OR UPDATE OF form_version_id, commission_id` trigger `guard_response_version_commission_trg` (SECURITY DEFINER, pinned search_path). The trigger looks up `form_versions → forms → commission_id` and raises `check_violation` if the version does not belong to the response's commission, and `foreign_key_violation` if the version UUID does not exist at all.

Using a trigger rather than an RLS WITH CHECK subquery is correct: it also covers UPDATE (changing `commission_id` or `form_version_id` on an existing in_progress response), and avoids the performance cost of an RLS subquery that touches three tables on every response write.

Test in `40_rls.sql:229-238` inserts a response with X's `ver_u` but Y's `comm_y` as postgres and asserts `23514`.

---

### INFO-1 — `anon` role has full DML grants on all public tables

**Observation:** The Supabase default grants full DML to the `anon` role on all `public` tables. This is the standard Supabase schema setup, not a migration introduced by this phase. Since all tables have RLS enabled and no policy applies to `anon`, every operation by that role is correctly blocked by the deny-by-default RLS behavior. Additionally, `anon` can call all public RPCs (`submit_response`, `publish_form_version`, `validate_visible_when`) due to default EXECUTE grants, but SECURITY INVOKER functions run as `anon` whose RLS policies block all meaningful data access.

No action required in Phase 1. Phase 8 (deployment hardening) should consider whether to explicitly revoke `anon` DML grants on tables and EXECUTE on RPCs as a defense-in-depth measure.

---

## Checklist Against PHASES.md Phase 1 Acceptance Criteria

| Assertion | Status | Notes |
|---|---|---|
| Staff cannot read another commission's data | PASS | 40_rls.sql tests 1–4 |
| Staff cannot edit forms | PARTIAL | UPDATE blocked and tested; INSERT/DELETE not explicitly tested (no write policy exists, so both would be blocked the same way, but tests cover only UPDATE) |
| Published versions, sections, items reject UPDATEs | PASS | 10_immutability.sql |
| Answers row targeting display item rejected | PASS | 10_immutability.sql |
| Submitted responses/answers reject UPDATEs | PASS | 10_immutability.sql |
| Submitted sign-offs reject UPDATEs | IMPLEMENTED, NOT TESTED | Trigger exists; missing pgTAP test (MAJOR-2) |
| In_progress response invisible/uneditable except creator | PASS | 40_rls.sql tests 8–11 |
| submit_response rejects missing required answers | PASS | 30_submit_response.sql test 1 |
| submit_response rejects missing sign-offs | PASS | 30_submit_response.sql test 2 (flag toggled ON) |
| Double submission rejected | PASS | 30_submit_response.sql test 4 |
| Condition evaluator covers all three ops | PASS | 20_conditions.sql 18 vectors, mirrored in TS |
| Staff_admin cannot escalate to admin | PASS | 40_rls.sql tests 13–14 |
| staff_admin manages staff only (cannot promote/create staff_admin) | PASS (insert) / GAP (update) | INSERT blocked and tested; UPDATE USING allows targeting staff_admin rows (MAJOR-1) |
| RLS + RPC test suites green | PASS | 56/56 pgTAP, 20/20 Vitest |
| Types generated | PASS | database.ts contains all canonical tables including question_key |
| Seed produces working local dataset | PASS | 7 users, 2 commissions, 2 published forms, 10 submitted + 1 in_progress responses |
| Seed form A: unsectioned, all 4 input types, ≥2 explanations, 1 section_text, 1 image | PASS | seed.sql FORM A (CCIH) |
| Seed form B: sectioned, ≥3 sections, 1 conditional, 1 respondent signoff, 1 staff_admin signoff | PASS | seed.sql FORM B (Farmácia), 5 sections |
| Seed ~10 submitted responses + ≥1 in_progress | PASS | 10 submitted, 1 in_progress |
| ADRs for non-trivial decisions (4 required) | PASS | 0002, 0003, 0004, 0005 |
| Access token hook configured | PASS | config.toml enabled, function correctly grants only supabase_auth_admin |
| SECURITY DEFINER functions have pinned search_path | PASS (with minor gap) | All SECURITY DEFINER functions have pinned search_path; MINOR-1 covers eval_condition which is SECURITY INVOKER/IMMUTABLE |
| Published-version immutability (triggers) | PASS | guard_published_version_trg, guard_published_sections_trg, guard_published_items_trg |
| Submitted-response immutability (triggers) | PASS | guard_submitted_response_trg, guard_submitted_answers_trg, guard_submitted_signoffs_trg |
| Condition evaluator SQL ↔ TS mirrored via shared vectors | PASS | 18 vectors in condition-vectors.json consumed by both 20_conditions.sql and conditions.test.ts |
| submit_response: stray hidden-section answer cleanup | PASS | 30_submit_response.sql test 3 |
| Storage bucket with commission-scoped policies | PASS | form-assets bucket, select+insert policies, no update/delete for app roles |
| Feature flag for signoff enforcement (OFF in Phase 1) | PASS | app.feature_flags, app.feature_enabled(), ADR 0004 |

---

## Positive Notes

- The three-tier immutability design (RLS + trigger + RPC guard) is thorough and the interaction between the `app.in_submit_rpc` / `app.in_publish_rpc` session flags and the BEFORE triggers is handled correctly with `is_local = true` (transaction-scoped resets).
- The `app.is_admin()` fallback to a DB read when the JWT claim is absent is exactly right; correctness never depends on the hook being wired.
- The condition evaluator SQL ↔ TS mirror with shared test vectors cleanly satisfies Architecture Rule 3.
- Cross-commission leakage paths via JOIN chains (answers → responses → commission, items → sections → versions → forms → commission) are all correctly blocked by the RLS helper functions.
- The `signoffs_insert` policy correctly enforces the signer-role rule (respondent vs staff_admin) inline, without requiring a separate trigger.
