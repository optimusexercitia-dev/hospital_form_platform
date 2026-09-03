---
id: DOCS-RESTRUCTURE
title: Documentation restructure — feature hubs, CURRENT.md, gated registers (ADR 0185)
status: in_progress
kind: feature
program: DOCS
phase: "ADR 0185 D1–D8 — no product phase; a tracking-apparatus change"
branch: docs-restructure
plan: ~
progress: ../progress/docs-restructure.md
reviews: []
adrs: ["0185"]
handoff: ~
fup: ~
---

# DOCS-RESTRUCTURE — feature hubs, CURRENT.md, gated registers

The ADR is the plan: [0185](../decisions/0185-documentation-restructure-feature-hubs-and-gated-registers.md).
This hub was created in the branch's second commit, after the branch was cut — the D1 rule "a hub
exists before a branch is cut" applies from this ADR forward, and this unit is the first to record
the violation it closes.

## Acceptance criteria

- [ ] Every register D1–D7 names has a gate arm that reds on it, and the arm is proven able to
      red by a self-test fixture (`node scripts/check-docs-registers.mjs --self-test`).
- [ ] `npm run lint` is green at every commit on the branch (gate 7 included).
- [ ] PROGRESS.md holds only § Phase Status, the generated roll-up, § State and pointers; no
      forbidden section can return without a red.
- [ ] The three PO lists (untriaged bugs, blank closing conditions, blank revisit triggers) exist
      in the progress record with file:line witnesses.
- [ ] `docs/reviews/docs-restructure-review.md` answers "does every new register have a gate that
      can red" with a verdict.
- [ ] CLAUDE.md diff approved by the PO before its commit.

## Current state

**Updated:** 2026-09-03

### Objective

Land ADR 0185 on `docs-restructure`, gate-first, without breaking gate 7 at any commit; merge
after AE4.

### Done since start

- Committed, rebased onto `authz-ae4-catalog` @ `3b21826b`: the ADR (written as 0183, renumbered
  0185 at the rebase when AE4's own 0183/0184 appeared — the collision its header predicted),
  one visible correction, and commit B: `lint:registers` (gate 13) + `features:index`, hubs,
  CURRENT.md, legend, BUGS.md (161 rows), LESSONS.md (72 rows), postmortems template, CONTEXT.md
  jargon, ARCHITECTURE.md admission header + 13 `Enforced by:` lines, `docs/INDEX.md`, register
  normalized by an idempotent script (165 entries after AE4's 9 landed). ADR 0184's handoff
  citation promoted to durable records.
- Staged for commit C (working tree, full chain exit 0): PROGRESS.md cut to § Phase Status +
  roll-up + § State with the seven retired sections forbidden by gate 7; register + bug archive
  moved to `docs/followups/` and `docs/bugs/`; ⭐⭐ Critical pinned in the register; 6 open § Now
  items filed as entries; § Now / Decisions / Test Run / QA rotated verbatim; two open-bug docs;
  ~130 references repointed; `progress-contract.md`, `lint-gates.md`, CLAUDE.md edited.

### In progress

- Commit C, held for the PO's approval of the CLAUDE.md diff (61 insertions, 43 deletions).

### Next

1. Commit C on approval; regenerate nothing by hand — `npm run features:index` + `adr:index`.
2. Read-only review → `docs/reviews/docs-restructure-review.md`: one question, does every new
   register have a gate that can red.
3. Rebase once more onto AE4's tip when AE4 is ready to merge; merge after it.

### Blockers

- CLAUDE.md commit waits on the PO's diff approval (CLAUDE.md's own rule).
- AE4 is still being committed to; the final rebase target is not fixed until it merges.
