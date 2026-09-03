---
id: C2-TIER1
title: Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure
status: gated
kind: feature
program: AUTHZ
phase: "ADR 0162 §3 — C2 Tier 1 (pilot cutline, pre-Gate-AE4 PO approval)"
branch: ~   # landed on main with AE4 2026-09-03; authz-ae4-catalog deleted; not closed (ADR 0184 pts 4–5)
plan: ../plans/authz-evolution.md
progress: ~
reviews: ["../reviews/c2-command-door-findings.md"]
adrs: ["0171", "0162", "0079", "0184", "0153"]
handoff: ../handoffs/c2-tier1-2026-09-03.md
fup: ~
---

# C2-TIER1 — Command-door Tier 1 sweep

## Acceptance criteria

Full ruling: `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` / Critical FUP C2
(docs/followups/follow-ups-open.md, PO ruling 2026-08-18) and the re-grained predicate in
[authz-c2-tier1-sizing.md § 8b](../design/authz-c2-tier1-sizing.md). Still open:

- [x] "Sizing closed nothing here — no door has a verdict" — **superseded**: the full sweep has
      since run, 171/171 enforcers now carry a verdict (PROGRESS.md § Now, "C2 FULL SWEEP COMPLETE
      2026-09-02")
- [x] "8 of 171 measured — the FULL SWEEP HAS NOT RUN, no door has a verdict, C2 stays OPEN" —
      **superseded**: full sweep ran — COVERED 109 · BLIND 40 · ERROR 22 (PROGRESS.md § Now;
      [findings](../reviews/c2-command-door-findings.md))
- [ ] `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS` — "the first 8 measurements ... found 3 BLIND:
      `public.nsp_org_capa_rollup`, `public.cancel_event` (both **0** pgTAP mentions) and
      `public.cancel_session`" — each needs a keystone; still true of the larger 40 BLIND from the
      full sweep, and none are written yet (docs/followups/follow-ups-open.md)
- [ ] "`assume_role` remains ERROR-shaped, not COVERED, and must be resolved *within* Tier 1"
      (docs/design/authz-c2-tier1-sizing.md § 10; unchanged per the c2-tier1-neutralizer handoff)
- [ ] "the C2 subset closed (pilot cutline)" before Gate AE4's PO approval — **still open despite
      the full sweep**: "C2 IS NOT CLOSED" (PROGRESS.md § Now; ADR 0184 points 4–5;
      docs/plans/authz-evolution.md:1066; ADR 0162 §3, amended by ADR 0184 on branch-order only)
- [ ] The three uncovered populations named in ADR 0184 point 4 must be resolved before the class
      can be called swept: Tier 2's 190 doors (deferred, ADR 0171); the `HCDS*` family (60 raises)
      + `28000` (6), structurally absent from the worklist because the mutation anchor and the
      gate-fn filter share one syntax; ~10 ERROR enforcers with no verdict at all (35 raises span a
      `;` the anchor cannot match)
- [ ] "A COVERED/BLIND verdict from this run means `HC0*`-coded-guard coverage, NOT authorization
      coverage" — the `HC0*` space must be classified by property before a verdict here can be read
      as an authorization claim (ADR 0184 point 5)

## Current state

**Updated:** 2026-09-03

### Objective

Sweep the 237 command doors that touch PHI (Tier 1, gate-aware closure over `ARM=census`'s
population), then close the three uncovered populations the sweep itself exposed, before Gate
AE4's PO approval (ADR 0162 §3, amended on branch-order by ADR 0184).

### Done since start

- Full sweep RAN 2026-09-02 — 171/171 enforcers: **COVERED 109 · BLIND 40 · ERROR 22**. Committed
  [findings](../reviews/c2-command-door-findings.md) say 106/40/25; 3 ERROR rows are tail-drift
  artifacts re-measured to COVERED in isolation. Baseline `Files=259, Tests=8685, PASS`, **~53
  s/run** (design doc's ~23 s assumption was wrong; full sweep ≈5 h). DB restored, zero
  `ROLLBACK FAILED`.
- PO ruling 2026-09-02: the branch-order HOLD is LIFTED — the sweep runs against the branch's own
  schema (519 migrations, AE4's 18 included), not `main`'s 501 (ADR 0184, amends ADR 0162 §3 on
  branch-order only; the cutline itself is unchanged).
- 13 commits (via `origin/authz-c2-tier1`) merged into `authz-ae4-catalog` 2026-09-03 (`3b21826b`)
  — three textual conflicts plus one silent collision (both branches minted ADR `0180`; C2's
  renumbered to **0184**).
- Anchor-regex fix for the semicolon-spanning ERROR class VALIDATED (2294/2294 matched, 0
  regressions) — staged, not yet applied to the harness.

### In progress

- Keystones for the 40 BLIND findings — designs complete
  (`docs/design/authz-c2-blind-keystone-designs.md`), none written yet.
- Classifying the `HC0*` error space by property (state guard vs. authorization guard) so a
  verdict can be read honestly.

### Next

- Write keystones, targeting the clusters first (correction workflow 4/5 BLIND, interview 6/9 —
  not spread evenly).
- Land the validated anchor-regex fix, then the delta sweep for `HCDS*`/`28000` (a new population).
- Diagnose the 16 suite-abort doors (`FUP-C2-SUITE-ABORT-ERROR-CLASS`); resolve `assume_role`'s
  ERROR shape to COVERED within Tier 1.

### Blockers

- C2 does **not** close despite the full sweep — the mutation anchor is a syntax, not a property
  (three uncovered populations, ADR 0184 point 4; verdicts here mean `HC0*`-guard coverage, not
  authorization coverage, point 5).
- ⚠ **MEASURED 2026-09-03 (branch continuity):** `git log authz-c2-tier1 -1` → `77d94b60`
  (2026-09-02, a handoff-carry commit only) — the **local** `authz-c2-tier1` ref never advanced.
  The 13 real sweep commits are on `origin/authz-c2-tier1` (tip `8ad1f2a4`), which is what merged
  into `authz-ae4-catalog`. The stale local `authz-c2-tier1` ref was **deleted 2026-09-03** (fully
  contained in `main`); `origin/authz-c2-tier1` remains on the remote until a push is authorized.
  ⚠ **2026-09-03: `authz-ae4-catalog` was fast-forwarded into `main` (`898cb0ab`) and deleted**, so
  C2's remaining work has no branch — hence `branch: ~` and `status: gated`; the next increment cuts
  a branch from `main` first.
- C2's findings **landed on `main` with AE4 on 2026-09-03** (the PO-accepted tradeoff of ADR 0184
  point 2 played out as one fast-forward); `main` is not pushed.
- 40 BLIND findings need keystones; allowlisting is prohibited — it would make `ARM=floor` and
  this harness agree while both measure nothing.
