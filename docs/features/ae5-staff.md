---
id: AE5-STAFF
title: "AE5 increment 1 — the `staff` role substituted into the authz catalog through the AE4 per-role template: matrix → seed → generated-cell differential → atomic cutover → re-key → census → runbook"
status: in_progress
kind: feature
program: AUTHZ
phase: "ADR 0155 — Phase AE5, Proposed order item 1 (post-pilot by ADR 0155 G1 / ADR 0162; ordered by the PO 2026-09-13); staff_admin is the baseline (ADR 0207 D6), item 6 (member_can / capability plane) is NOT this unit"
branch: ae5-staff   # cut from main @ a02487bc
plan: ../plans/authz-evolution.md
progress: ../progress/ae5-staff.md
reviews: ["../reviews/ae5-staff-matrix-review-r1.md"]
adrs: ["0155", "0162", "0174", "0175", "0193", "0200", "0201", "0203", "0207", "0208"]
handoff: ~
fup: ~
---

# AE5-STAFF — increment 1: `staff`

The plan is [`docs/plans/authz-evolution.md`](../plans/authz-evolution.md) § Phase AE5: the
Proposed order (item 1 `staff` — *"simplest matrix; biggest population — flushes out fixture gaps
early"*), the per-role checklist, the ⚠⚠ block on what `AE5-MATRIX-ARM3-CELLS` changed under the
template (`case_reach` with mandatory `unreachable`; `arm3_divergence` + the 14th
`expected_legacy_granted` column; arms `arm9`/`arm10`; 1728 cells) and the five corrections. The
task breakdown T1–T14, with owners, files and gates, is in the record § Task list.

## Acceptance criteria

Each is the template step it names; the witness for every box is a dated entry in the record.

- [x] **AC-1 Matrix.** ✅ **PO-APPROVED 2026-09-13** (record § PO APPROVAL — scope table; item 5's per-class values still owed) — `docs/design/authz-ae5-staff-permission-matrix.md` derived from every plane
      (the name matched UNANCHORED ONCE and each hit classified; `.manage` split at reversibility
      boundaries), every row citing its plane and a live-catalog query; per arm its **subject** and
      **hat requirement** declared (ADR 0200 · ADR 0201 D3), per row its `definerSurface` (ADR 0193
      D5) — **PO-approved** before any seed row is written.
- [x] **AC-2 Deny-class effects** ✅ **PO-RULED 2026-09-14** (P3, record § PO rulings) — for `staff` over the declared `denyClasses` axis, each class in axis
      coordinates; expected values PO-approved.
- [ ] **AC-3 Generators multi-role.** Both cell generators range over `staff` + `staff_admin`; the
      `role` axis gets a real disposition; `npm run lint:authz-vectors` green and the self-test
      asserts WHICH arm fired (LEARN-103); `arm9`/`arm10` still bind.
- [ ] **AC-4 Seed + `test_validation`.** `staff` grants seeded; `authz.roles.staff` = `test_validation`;
      `403 § 3.2b` observed RED (recorded, never re-pointed) and `410 § 7.2` RED until the manifest
      names the suite; fixture gaps the tester lists are filled without ids shared across cases.
- [x] **AC-5 Differential oracle** ✅ **2026-09-14** (record: run 5 green, § 6 witness quoted, full suite `Result: PASS`) (`424`): two assertions per cell — `is(legacy, catalog)` AND
      `is(catalog, approved-value)` — over `authz.candidate_has_permission`; `case_reach` incl.
      `unreachable` swept; approved divergence in `expected_legacy_granted` only; shown able to fail.
      Every PA-F8 divergence dispositioned (a) fixed earlier / (b) named exception with owner +
      expiry / (c) blocks cutover.
- [x] **AC-6 Atomic cutover** ✅ **2026-09-14** (record: T6 applied red-first `665d9519`; ADR 0211 ACCEPTED by R-5 `f8a66457`; D1/D3 amendment owed under L14). Was: ⛔ PO ruling on the wrapper question first (record § Open rulings
      R-1, R-2). `create or replace` only; name · signature · `prosecdef` · volatility ·
      `search_path` · ACLs snapshotted before and asserted after; `staff` → `authoritative` with the
      count-verified `do` block; direct-call census derived per site from the comment-stripped
      catalog; ⛔ never `legacy OR new`, proven by a pgTAP grep.
- [x] **AC-7 Re-key.** ✅ **2026-09-14** (record: `425` round 2 21/21 on the post-T7 catalog, `e2d1d3b8`; § 3.1 47/47 · § 3.2 56/56 · § 3.3 P1 survivors measured). Was: Every site `staff`'s bundle touches re-pointed at a layer-3 authorizer carrying
      the code as a greppable literal; manifest rows `pending-rekey` → `re-keyed` with
      `enforcementSites` · `domainAuthorizer.composedWith` · `residualLegacyAuthority` ·
      `definerSurface` populated and a `staff`-shaped `layer1Gate`; `hardDenyClasses` re-measured per
      row (ADR 0203 D1 bound 2); DEFINER writers DECLARED, never silently counted (re-review N4); any
      new/touched DEFINER on `search_path = ''` (ADR 0208 D4); the grant-deletion differential
      (`425`) flips every policy door both polarities, observed RED on the pre-migration catalog.
- [x] **AC-8 Census + arms** ✅ **2026-09-14** (record: T8 gate record `eeb59466`, verified by the lead; census `INVARIANT HOLDS`; all four arms RED by plant / GREEN on rollback; door sweep 73/73 exit 3 RULED). Was: Direct-call census committed; G8 arms re-derived and each shown able to
      red; `409`'s vacuity control re-stated if a `staff` read site moved; `410 §§ 7.3/7.4` re-pinned
      1 → 2 only after being observed RED at 1.
- [ ] **AC-9 Runbook.** `staff` worked example in the rollback runbook + template, both revert shapes;
      ⛔ never a committed migration ([PA-F9]).
- [ ] **AC-10 Gate.** CLAUDE.md §6 step 1 in full: the four authz arms; the door sweep BOTH arms in one
      invocation with the deriver's `SCOPE:` line quoted and its exit read bare; the set-valued home;
      `SELFTEST=1` with `bash --version`; `RESET_EVERY` checked (port, then prove); NOTICED quoted as
      evidence; CARRIED rows dispositioned; lint · typecheck · `test:db` on a fresh reset ·
      `e2e:prod` once green. Then QA (`docs/reviews/ae5-staff-review.md`), PO approval, Record —
      including the authz seam's slice + `## Current state` re-cut.

## Current state

**Updated:** 2026-09-14

### Objective

Substitute `staff` — the biggest population, the simplest matrix — into the authz catalog through
the AE4 template, copying it for the first time and fixing in the template whatever the copy
exposes, so increments 2–7 inherit a template proven on two roles.

### Done since start

Unit opened on `main @ a02487bc` (`704fafcc`): hub, record, branch, T1–T14 task list; every pre-AE5
unit `complete`; stack started, fresh reset exit 0; one resolved follow-up moved to the archive;
review queue processed. **T1 + T2 delivered PROVISIONAL** (`a31ba31e`): the matrix
(`docs/design/authz-ae5-staff-permission-matrix.md`, 20 held rows / 18 new codes / 2 shared, two
non-rows kept visible) and the deny-class table, both measured on the LIVE catalog. **R-1
CONFIRMED** on the catalog; **R-2 REFUTED as stated** — `is_member_of` carries the hat one delegation
down (`has_role_any`), and the surviving grain difference is unreachable under
`memberships_one_commission_role_uq`. Two PA-F8 divergences found (record § Session log). T3 plan
posted, not executed.

### In progress

**T8 PARKED green 2026-09-14** (`34117443` … `eeb59466`, verified by the lead): the door sweep as THE
gate run — 73/73, 71 COVERED · 2 NOTICED (both standing, errcodes 42501 / HC033) · 0 BLIND · 0 ERROR,
exit 3 RULED partial-by-construction (`SCOPE:` line quoted in the record); write arm CLEAN re-earned;
census arm `INVARIANT HOLDS` after the 23 T7 verdicts were folded in by targeted insertion (the merge
helper had gutted the baseline 353 → 73 at exit 0 — caught by the census arm, restored, the helper now
aborts on missing baseline rows); all four arms RED by plant / GREEN on rollback; `RESET_EVERY` ported
and proven; SELFTEST ×2 green. L22's plant found `410` REVERSE 3b compared a string with itself —
repaired, 45/45. **Now:** `425` round 2 21/21 committed (AC-7 ✅); the tester holds the stack for T13's five specs;
then AC-10's fresh-reset run (full `test:db` owed after T8's test edits), the gate record, QA, PO.
`npm run lint` exit 0 at HEAD.

### Next

`425` round 2 (AC-7) → T13 specs → AC-10 gate (fresh reset: lint/typecheck/`test:db`, arms re-quoted,
`e2e:prod`) → T14 QA review → PO approval (visibility items in Blockers) → Record. T9 runbook is drafted.

### Blockers

None ruling-shaped (R-4, R-5 ruled `f8a66457`). ⚠ For the PO at the T7 gate, from T7's verification: two P0s caught pre-commit (one the lead's ruling L17,
now L24) — both closed with witnesses; a high follow-up on the closure gate that stayed green through the
second (`FUP-AE5-STAFF-HARD-DENY-CLOSURE-IS-BLIND-TO-OR-AROUND`). ⚠ For the PO at the T7 gate: the `staff` wrapper stands with ZERO
production callers for one unit under a named bound (L14); T7 touches 23 frozen-path DEFINER bodies and
converges them under ADR 0208 D4 as written (L15), `419` 860 → 837 attributed by name. ⚠ A second Supabase stack (`*_escalume`) runs on this host and made two resets
fail at the CLI's post-reset step; AC-10's runs need it stopped or the reset re-verified. ⛔ ADR 0211 D2 is reviewed by the PO at the T6 gate (put in front of the PO on
2026-09-14 as readable now). ⚠ Owed to T7/T13, not blocking: `app.can_reach_case_on_member_surface`
has ZERO production callers (matrix § 8.3); **4 of 12** seeded CCIH `staff` personas carry a non-role
case reach (§ 8.2 said 6 of 9; re-measured 2026-09-14 after this unit's own seeding moved both halves: 3 via `case_access_grants`, 1 via `case_participants`). ⚠ T7's manifest edits must be checked against what the generator EMITS, not
what the JSON holds (L6's second half: a field the gate could not see).
