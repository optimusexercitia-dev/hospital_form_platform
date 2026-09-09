---
id: BACKEND-STATE-SPLIT
title: Backend surface map split onto the module-seam axis — a router replaces the 742 KB reading list (ADR 0196)
status: gated
kind: feature
program: DOCS
phase: "ADR 0196 D1–D10 — no product phase; a documentation-apparatus change on top of ADR 0186"
branch: ~   # done directly on main 2026-09-09, at PO instruction
plan: ~
progress: ../progress/backend-state-split.md
reviews: ["../reviews/backend-state-split-review.md"]
adrs: ["0196", "0186", "0185", "0105", "0078"]
handoff: ~
fup: ~
---

# BACKEND-STATE-SPLIT — one file per module seam

The decision is ADR [0196](../decisions/0196-backend-state-split-on-the-module-seam-axis.md).
No plan document: the unit was scoped, executed and recorded in one session at PO instruction,
after an evaluation of `scheduler_platform`'s method (that project hit the identical failure —
a same-named file at 914 KB / 13,155 lines — and split it onto a seam axis the same day).

## Acceptance criteria

Baselines and final values are in the record's session-log entry.

- [x] `docs/backend-state.md` (742,255 B / 6,353 lines) becomes `docs/backend-state/`: **11 seam
      files + `README.md` router + `stamp-history.md`**, largest 114.6 KB (baseline: one file,
      742 KB).
- [x] **Nothing lost** — proven by multiset comparison of source lines against output lines, not by
      inspection: `MISSING = 0`, with the only deletions the 47-line `## ADR index` (an ungated
      duplicate of the generated `docs/decisions/INDEX.md`) and the 13-line H1+Purpose block that
      became the router.
- [x] Router dispatches on the ACTION ("Open this / When you are about to…"), not on contents.
- [x] Gate 16 `lint:backend-state` added to the `npm run lint` chain: **six** checks — preamble
      byte-identity, router rows with a real "when to open it" clause, router targets EXIST,
      forward-marker targets resolve, 160 KB warn / 200 KB fail, and no digit in a seam filename
      (D2's enforcer). **32-arm** self-test, each check proven able to fire AND stay silent.
      ⚠ Shipped with four checks; QA found two holes (M1, M2) and both are closed.
- [x] **All six** mutation-run against the **real** corpus — preamble drift, an unrouted file, a
      deleted seam file, a dangling marker, a phase-named file, and both size arms; baseline green
      after every rollback.
- [x] The two gates that parse the map by path + heading (12 `lint:service-role-registry`,
      15 `lint:budget-anchor`) moved in the same commit as their sections, and both re-run green at
      the new path.
- [x] Zero dangling links: **19 gate findings across 18 unique sites** repaired (one site is reported
      by two gates); gates 7, 9 and 13 green.
      ⚠ ADRs needed **zero** edits — they cite by code span, not by link.
- [x] `npm run lint` rc=0 and `npm run typecheck` rc=0, both **taken bare, not through a pipe**.

## Current state

**Updated:** 2026-09-09

### Objective

Re-file the 742 KB single-file backend surface map onto the MODULE SEAM axis, behind an
action-keyed router, and gate the shape so it cannot decay back (ADR 0196).

### Done since start

The split is DONE and on `main`, losslessly (`MISSING = 0` by multiset proof). 11 seam files +
router + frozen `stamp-history.md`, largest 114.6 KB. Gate 16 `lint:backend-state` is in the chain
with a 17-arm self-test and a live mutation run. Gates 12 and 15 moved with their sections and
re-run green. 18 dangling links repaired; gates 7/9/13 green. `npm run lint` and `npm run typecheck`
both rc=0, taken bare.

### In progress

Nothing. The unit is code-complete and awaiting §6 step 3.

### Next

A read-only QA review of the split. On APPROVED, this hub goes to `complete` with the block cut
into the record, per ADR 0186 D3.

### Blockers

⛔ **Status is `gated`, not `complete`, because NO QA review was run** — this ran as a direct PO
instruction, not as a phase. Gate 13 refused `complete` without an APPROVED verdict line, which is
the gate behaving correctly; it is recorded here rather than worked around.

## Execution note (2026-09-09) — scope, and what was NOT run

Executed on `main` in one session; the scope ruling and what was not run are in the record's
session log (QA m11 — a fact whose only home was this block would be cut with it at completion).

✅ **QA review round 1 run 2026-09-09** — verdict **CHANGES REQUESTED**
([backend-state-split-review.md](../reviews/backend-state-split-review.md)): 2 blocking, 4 major,
14 minor. All 20 addressed; re-review owed before this hub may go `complete`.
⛔ Still owed and NOT closed here: extending derive-and-compare to the eleven ungated registries, and
the `process.cwd()` hardening missing from `check-service-role-registry.mjs`
(`FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD`).
