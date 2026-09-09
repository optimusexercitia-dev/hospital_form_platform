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
reviews: []
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
- [x] Gate 16 `lint:backend-state` added to the `npm run lint` chain: preamble byte-identity,
      router reachability (population = the directory listing), forward-marker targets resolve,
      160 KB warn / 200 KB fail. 17-arm self-test, each check proven able to fire AND stay silent.
- [x] Gate 16 mutation-run against the **real** corpus: preamble drift, an unrouted file and a
      dangling marker each caught; baseline green after rollback.
- [x] The two gates that parse the map by path + heading (12 `lint:service-role-registry`,
      15 `lint:budget-anchor`) moved in the same commit as their sections, and both re-run green at
      the new path.
- [x] Zero dangling links: 18 repaired across the three link-gated corpora; gates 7, 9 and 13 green.
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

Executed on `main` in one session. ⚠ The lead advised deferring this past the Batch 7/8 boundary
(it competes with the pre-AE5 remediation programme and touches a file with 84 commits in 30 days);
the PO overrode that and instructed it be done now — recorded here because an approval's scope is a
fact that must be written down.

⛔ **No QA review was run** (§6 step 3), because this unit was not run as a phase. Two things are
therefore owed and are NOT closed by this hub: a read-only review of the split, and the follow-on
work ADR 0196 names — extending derive-and-compare to the eleven ungated registries, and the
`process.cwd()` hardening still missing from `check-service-role-registry.mjs`.
