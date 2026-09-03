---
id: DOCS-RESTRUCTURE
title: Documentation restructure — feature hubs, CURRENT.md, gated registers (ADR 0185)
status: complete
kind: feature
program: DOCS
phase: "ADR 0185 D1–D8 — no product phase; a tracking-apparatus change"
branch: docs-restructure
plan: ~
progress: ../progress/docs-restructure.md
reviews: ["../reviews/docs-restructure-review.md"]
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

## Completed 2026-09-03

Landed on `main` by fast-forward (PO instruction 2026-09-03: "have all work on main", not pushed).
The Current-state block was cut into the progress record at completion, as D2 requires:
[docs-restructure.md § Current state at completion](../progress/docs-restructure.md). Still owed by
the PO, not by this unit: the three rulings lists in that record.
