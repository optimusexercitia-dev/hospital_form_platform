---
id: DOOR-SWEEP-DERIVER
title: Door-sweep case deriver — select gates by PROPERTY, read the whole declaration, scope the increment, and let a full run keep the hand-authored baseline (pre-AE5 Batch 1)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 1 of the follow-up batches ruled 2026-09-04"
branch: authz-door-sweep-deriver
plan: ~
progress: ../progress/door-sweep-deriver.md
reviews: []
adrs: ["0079", "0148", "0153", "0173", "0182"]
handoff: ~
fup: ~
---

# DOOR-SWEEP-DERIVER — the diff-scoped sweep's case deriver

## Acceptance criteria

The unit closes **five** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure. Four
live in `scripts/door-sweep-cases.sh` (the §6 step-1 instrument every AE5 increment will run);
the fifth in the full-run emit path of the sweep harness that writes the committed baseline.

- [ ] `FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE` 🟠 — gates selected by a **property**,
      not a name filter (or the exclusions printed with their reason); `BASE=9a4bbd22^ TIP=9a4bbd22`
      must stop deriving zero cases. ⛔ Not by widening the filter to admit one name.
- [ ] `FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES` 🟠 — the `door-sweep-targets:` parser
      consumes continuation lines, or rejects an unmatched continuation loudly; `20261003007250`'s
      three targets derive **from the declaration path**, provable with its `create or replace`
      lines removed from consideration. ⛔ Not by reformatting `…007250`.
- [ ] `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION` 🟠 — `alter function … security definer`
      is grepped like `alter policy`, the altered function's return type resolved from the **live
      catalog**; a `prosecdef` flip on an existing boolean gate derives that gate.
- [ ] `FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE` 🟠 — the deriver takes an explicit
      scope (migration-id floor or path prefix) **or** prints per-file provenance (committed-range ·
      working-tree · untracked), so a union can never again be recorded as one increment's
      coverage. ⛔ Not by dropping the working-tree/untracked sources.
- [ ] `FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` 🟡 — a **full** sweep merges
      generated rows into `docs/reviews/authz-door-audit-findings.md` and the hand-authored
      material (the `<!-- … -->` subset block, the RENAME note, the skipped-policy annotations)
      survives byte-for-byte. ⛔ Not by extending the subset guard to full runs.
- [ ] Every new selection/parse arm **proven able to fire** on its own reproducer (`9a4bbd22`;
      `…007250` declaration-only; a planted `ALTER FUNCTION … SECURITY DEFINER` on a boolean gate
      in a scratch migration never committed; a two-increment working tree; a full-run emit over a
      copy of the baseline), each paired with a clean negative control.
- [ ] Gate: `npm run lint` green; `npm run test:db` on a fresh reset green; the four authz arms
      hold; the diff-scoped door sweep **not owed** (no policy or `prosecdef` gate changes — if that
      turns out false, it is owed, both arms — derived, for the first time, by the fixed deriver).

## Current state

**Updated:** 2026-09-05

### Objective
Make `scripts/door-sweep-cases.sh` — the instrument CLAUDE.md §6 step 1 makes every phase and
every AE5 increment run — derive the diff-scoped case list by property, read the whole
declaration notation, attribute what it swept to an increment, and let the periodic full sweep
re-baseline without destroying the committed file's hand-authored material (Batches 2–3 need
that re-baseline).

### Done since start
- Branch cut off `main` @ `76d87a4f`; hub + record opened.

### In progress
- `backend` briefed; full plan required before any script change (the deriver decides what the
  standing gate sweeps; the emit path rewrites a committed baseline).

### Next
- Plan review → build red-first (each arm shown to FIRE on its reproducer before it is trusted at
  0) → gate → QA review → PO → Record.

### Blockers
- None. Batch 0 (`HARNESS-CRASH-SAFETY`, merged `76d87a4f`) made the sweeps this unit will run
  crash-safe; harness runs still go detached, never under a tool timeout.
