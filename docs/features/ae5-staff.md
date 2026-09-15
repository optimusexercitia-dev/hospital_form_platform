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
- [x] **AC-3 Generators multi-role.** ✅ **2026-09-15** (record: round 3 cells 1728 → 2808 over both roles, `lint:authz-vectors` 0 then and inside `npm run lint` at HEAD; ⚠ bound: the self-test asserts WHICH arm fired at the arm-prefix grain only — `FUP-AE5-STAFF-SELFTEST-WRONG-ARM-CHECK-COMPARES-ON-THE-ARM-PREFIX`, medium, open). Was: Both cell generators range over `staff` + `staff_admin`; the
      `role` axis gets a real disposition; `npm run lint:authz-vectors` green and the self-test
      asserts WHICH arm fired (LEARN-103); `arm9`/`arm10` still bind.
- [x] **AC-4 Seed + `test_validation`.** ✅ **2026-09-15** (record: AC-10 re-declared on the R-7 (a) / L36 seed — `410 § 7.2` reds by plant, no shared fixture ids, the unbound gaps bound (L34, L36), row 7's respondent cell added (R-7 (a)); `offboarded` deferred by the PO). Was: `staff` grants seeded; `authz.roles.staff` = `test_validation`;
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
- [ ] **AC-7 Re-key.** ⚠ **RE-OPENED 2026-09-15 by T14 F2** — `425` covers two INSERT policies and five DEFINER writers statically only, so the both-polarities clause is unmet for them. Was ticked ✅ **2026-09-14** (record: `425` round 2 21/21 on the post-T7 catalog, `e2d1d3b8`; § 3.1 47/47 · § 3.2 56/56 · § 3.3 P1 survivors measured). Was: Every site `staff`'s bundle touches re-pointed at a layer-3 authorizer carrying
      the code as a greppable literal; manifest rows `pending-rekey` → `re-keyed` with
      `enforcementSites` · `domainAuthorizer.composedWith` · `residualLegacyAuthority` ·
      `definerSurface` populated and a `staff`-shaped `layer1Gate`; `hardDenyClasses` re-measured per
      row (ADR 0203 D1 bound 2); DEFINER writers DECLARED, never silently counted (re-review N4); any
      new/touched DEFINER on `search_path = ''` (ADR 0208 D4); the grant-deletion differential
      (`425`) flips every policy door both polarities, observed RED on the pre-migration catalog.
- [x] **AC-8 Census + arms** ✅ **2026-09-14** (record: T8 gate record `eeb59466`, verified by the lead; census `INVARIANT HOLDS`; all four arms RED by plant / GREEN on rollback; door sweep 73/73 exit 3 RULED). Was: Direct-call census committed; G8 arms re-derived and each shown able to
      red; `409`'s vacuity control re-stated if a `staff` read site moved; `410 §§ 7.3/7.4` re-pinned
      1 → 2 only after being observed RED at 1.
- [x] **AC-9 Runbook** ✅ **2026-09-15** (record: § 7.0b/7.3/7.3.1 + template SECTION G verified on the catalog `5976bde0`, zero `⏳ verify` markers, every section A–G parsed inside `begin … rollback`, a stripped-quote plant reds). Was: `staff` worked example in the rollback runbook + template, both revert shapes;
      ⛔ never a committed migration ([PA-F9]).
- [x] **AC-10 Gate.** ✅ **2026-09-15** (record: AC-10 gate record — build complete at `a3740cdb`, declaring `e2e:prod` GREEN at `dc08f96f` 1270 passed · 0 failed). Was: CLAUDE.md §6 step 1 in full: the four authz arms; the door sweep BOTH arms in one
      invocation with the deriver's `SCOPE:` line quoted and its exit read bare; the set-valued home;
      `SELFTEST=1` with `bash --version`; `RESET_EVERY` checked (port, then prove); NOTICED quoted as
      evidence; CARRIED rows dispositioned; lint · typecheck · `test:db` on a fresh reset ·
      `e2e:prod` once green. Then QA (`docs/reviews/ae5-staff-review.md`), PO approval, Record —
      including the authz seam's slice + `## Current state` re-cut.

- [ ] **AC-11 Performance (R-8 (a) · Q-1 · Q-2 (C) · Q-4, T14 F1).** Every RLS path that filters many rows through a commission-scoped catalog permission resolves it once per STATEMENT, not once per row: the 40 T7 policies, the 6 AE4 forms FOR ALL policies, and the 81 helper-routed policies (the Class-1 modules planned per door first). INSERT-only `WITH CHECK` sites stay scalar, each named in the plan. Every OR arm, hard deny and audit obligation is kept; `_case_caps` resolves no permission a caller's bit cannot use; a `staff` performance acceptance (`428` + harness) shows resolutions scale with distinct scopes, not protected rows, in both polarities, with function counts, plans, and a semantic ablation that reds. Budget ceiling 772 + N (Q-4).

## Current state

**Updated:** 2026-09-15

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

**T14 external QA returned CHANGES REQUESTED at `cea431c7`** (`docs/reviews/ae5-staff-review.md`). The lead's
analysis is in the record:
- **F1 (P1) CONFIRMED and reproduced.** Batch policies call the catalog authorizer once per row, 4.68× the
  former membership check, 23 000 vs 5 000 buffers. The set path is 1.6 ms. That exceeds AE4's K = 4 bar.
- **F2 (P2) CONFIRMED as scoped.** `425` covers two INSERT policies and five writers statically only. The full
  gate does catch the auditor's mutation (`254` reds 3/25). AC-7 is re-opened.
- **F3 (P2) CONFIRMED.** The attendee fixture is unordered and picks arbitrary rows on a post-E2E stack.
- **The `_case_caps` eager S5 note CONFIRMED** on the live body.

The earlier gate witnesses stand for `cea431c7`, but they no longer declare the unit.

### Next

F1 / AC-11 plan ACCEPTED as design (`b6b5de7b`); Q-3 ruled (A); Q-1 · Q-2 (C) · Q-4 ruled → 81 partitioned (78 in scope, 3 insert-only) →
five family planners running (Class-1 per door) → integrated plan, lead review → ADR 0212 + `428` red-first → migration; F2 + F3 DONE in `425` (`075e298a`, verified 34/34) → F1 migration → `425` re-run on it → Phase Gate step 1 in full → `e2e:prod` → QA again →
PO approval → Record.

### Blockers

✅ **Q-1 convert · Q-2 (C) all 81 · Q-4 772 + N — RULED 2026-09-15.** ✅ **R-8 RULED 2026-09-15: option (a)** — F1 is resolved in this unit under AC-11; F2 and F3 go to the tester after F1's migration.
For the PO at approval, recorded and unchanged: two P0s were caught before commit (one from the lead's
L17, now L24) and closed with witnesses, and the high closure-gate follow-up stays open; the `staff`
wrapper has ZERO production callers for one unit under a named bound (L14); T7 converged 24 frozen
DEFINER bodies under ADR 0208 D4 as written (`419` 860 → 836, L15); a 21st DEFINER-only door sits
outside R-4's ruled set (L20). ⚠ A second Supabase stack (`*_escalume`) runs on this host; count it
and never touch it.
