# QA Review — AUDIT-DOOR-BLINDNESS P0 (ADR 0078 §7.14 / ADR 0079)

- **Reviewer:** `qa` (independent final review)
- **Date:** 2026-07-18
- **Branch:** `fix/authz-audit-door-blindness` (commits `a32be9c` → `f783f37`)
- **Scope:** the pre-S4 P0 closing door-blindness — FIX-A (26 ERROR reclassification),
  FIX-B (standing invariant `p0-authz-invariant.sh`), FIX-C (50 mutation-proven
  keystones in `supabase/tests/25{0,1,2}_authz_p0_isolation.sql`). Additive; no
  migration/schema change.

## Verdict: ✅ APPROVED

0 P0 · 0 MAJOR · 2 MINOR (hygiene, non-blocking) · 1 INFO.

The claim independently verified holds. All six required checks were **run**, not
read from committed logs. The work is exactly what §7.14 asked for: a catalog-driven
neutralization oracle, a repeatable standing invariant, and a high-risk keystone set
each proven non-vacuous by reverting its own gate and requiring redness.

Note on method: per CLAUDE.md's binding graphify exception, this audit was driven from
the **live catalog** (`pg_policies`, `has_table_privilege`, `test_helpers.claims_for`
under `set local role`) and the test harnesses — never migration text or graphify.

## Evidence (independently reproduced)

**1. Baseline (`supabase test db`).** `Result: PASS`, **Files=115, Tests=3288**,
`0` `not ok`, no pgtap-in-public red. Matches the claim byte-for-byte.

**2. Mutation proof (`p0b-isolation-mutation-audit.sh`, re-run).** **50/50 RED-PROVEN,
0 anomalies** (no `NOT PROVEN` / GREEN / ABSENT). All 3 CONTROL files all-green with no
mutation (14 + 40 + 48 = 102 ok, 0 not ok) — the harness is not a red-generator. Each
keystone reddens only when *its own* gate is opened, confirming none is vacuous (§7.1).
The keystone files themselves are disciplined: every DENY runs against a row seeded /
inserted as an authorized writer (§7.10 non-vacuity), asserts ROWS/RAISE rather than a
predicate boolean, uses a reader-non-writer principal for every UPDATE/DELETE (ADR 0079,
so redness is attributable to the write policy not the SELECT gate), and carries a
POSITIVE twin so a fail-closed regression (cf. [[d11]]) cannot masquerade as passing
isolation. The `profiles_admin_insert` POS (42501 for non-admin vs 23505 PK for admin)
and `capa_effectiveness_write` POS (23505 one-per-capa) are especially clean at
distinguishing policy denial from an unrelated failure.

**3. Adversarial allowlist audit (the highest-value check).** For every allowlisted
`_select`/`_write` on a clinical/PHI/case table I pulled the live `pg_policies` qual and
the `authenticated` table privileges:
- **Door-only PHI backstops verified genuine:** `event_patient` and `patient_xref` have
  SELECT/INSERT/UPDATE **all revoked** for `authenticated` — PostgREST cannot reach the
  base table; the blind base policy is defense-in-depth, not a leak. `notifications`
  UPDATE is likewise revoked (matches the `notifications_update_own` backstop claim).
- **Every reachable allowlisted SELECT routes to a proven or centrally-covered gate:**
  `rca_*_select` and `event_triage_sentinel_flags_select` → `can_read_event` (keystoned
  rep `event_custody_select`); `capa_*_select` → `can_read_capa` (rep `capa_action_select`);
  `professional_participants_select` → `can_read_professional_profile` (rep
  `professional_profiles_select`); `interview_{summaries,topics,session_attendance}_select`
  → `can_read_interview` (rep `interview_sessions_select`); `answer_{matrix_cells,
  references,risk_matrix}_select` → the standard answers gate (`created_by OR
  is_commission_admin_of OR (submitted AND is_staff_admin_of)`, represented by
  `answers_select`); `case_phase_*/tag _select` → `can_read_case` (separately COVERED).
  No allowlisted gate is a reachable high-risk **orphan** (a unique unproven predicate on
  a reachable table). The "represented by group" claim checks out at the gate level: the
  authorization function is identical to the keystoned representative; only the row→id
  derivation (`event_of_rca`, subqueries) differs, and those are pure lookups, not gates.

**4. Live-leak spot-check (non-inferential).** As `postgres`, `professional_profiles
fb..e1` EXISTS=1 and `event_custody e1..a1` EXISTS=1. Under `set local role authenticated`
with a FOREIGN rede-B principal (`staff.qual.b`, `..b3`), both read **0** rows; the
authorized CCIH `staff_admin` reads the professional profile (count=1). The "no leak"
claim is confirmed against rows that provably exist, not by qual-reading. (The `rca_evidence`
probe returned 0-from-empty — no seed row on that rca — but `event_custody` covers the same
`can_read_event` gate against a real row, so the rca_*_select family is proven non-leaking.)

**5. Non-vacuity.** Confirmed by reading 250/251/252: DENYs target seeded/inserted rows,
POS twins prove existence, CONTROL runs are all-green (twins pass) and the mutation proof
requires the DENY to redden (which is only possible against an existing row). No
`0-from-empty` DENY.

**6. Invariant sanity.** ARM 1 (FROMFINDINGS fast): **BLIND=72 ⊆ allowlist — INVARIANT
HOLDS**, no offenders. ARM 2 (floor, full suite + `track_functions=all`): **93
never-called doors, all on the floor allowlist — INVARIANT HOLDS**. The floor allowlist
is defensible: it exempts only `*_enabled()` feature-flag helpers, thin CRUD write RPCs
(whose `can_write_*` gates ARE keystoned in 252), and frontend read helpers. The actual
PHI-read single-doors are **not** on the floor list (only `patient_access_audit` and the
`*_enabled` flags are), meaning the real PHI boundary doors are pgTAP-driven — no
high-risk read boundary is hidden by the floor exemption.

## Findings

**MINOR-1 (hygiene, already anticipated by ADR 0079).** `authz-blind-allowlist.txt`
carries 2 entries now COVERED — `app.can_read_document_of_version(...)` and
`app.can_sign_section(...)` — which ARM 1 flags non-fatally as stale. Prune when
convenient; not a gap (over-inclusive allowlist errs safe).

**MINOR-2 (residual coverage note).** Three central predicates that back allowlisted
selects — `can_reach_meeting` (meeting_closed_sessions/signatures), `can_read_attachment`
(attachment_subjects/references), `can_read_referral_metadata` (referral_reply_attachment)
— are "represented by group" via pre-existing suites (120_meetings, attachments, 150_referrals)
rather than carrying a dedicated P0 mutation-proven keystone. This is within the PO-scoped
boundary ("high-risk keystoned, low-severity allowlisted") and each is a reachable-but-
central read gate, not an orphan. Reasonable to track as FIX-C burn-down backlog.

**INFO-1 (division of labor, disclosed).** I ran ARM 1 in `FROMFINDINGS` fast mode
(compares the committed findings md to the allowlist), not the authoritative ~90-min live
re-sweep, which per ADR 0079 is the lead's background job. The APPROVED verdict therefore
relies on the committed door/writepath findings being accurate for the *classification*
of BLIND vs COVERED; the mutation proofs, reachability checks, and live-leak checks that
carry the security weight were all reproduced live. If the lead has not yet completed a
fresh full ARM-1 sweep on this branch, it should run once before merge as belt-and-suspenders.

## Why this is APPROVED, not CHANGES REQUESTED

No unmet blocking requirement. No RLS/immutability hole: the PHI door-only backstops are
verified revoked at the grant level; every reachable allowlisted gate resolves to a
keystoned or centrally-covered predicate; a foreign principal provably reads 0 of existing
PHI-adjacent rows. The 50 keystones are each proven to fail when their gate opens (not
vacuous) and to pass when the authorized principal acts (not fail-closed). The standing
invariant closes the recurrence vector. The two MINOR items are hygiene/backlog and do not
weaken the boundary.
