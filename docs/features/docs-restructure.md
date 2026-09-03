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

- Commit A (`8cdc1549`): ADR written, index + back-pointers regenerated. Commit A2 (`2c078f74`):
  one false sentence corrected visibly.
- Written, uncommitted at this Updated date: `lint:registers` (13th gate) + `features:index`
  generator, both self-tested; hubs AE4 / C2-TIER1 / C1B-DISPOSAL / DLB; CURRENT.md;
  legacy-codes legend (30 codes, 0 unknown); BUGS.md (161 rows) + template; LESSONS.md (72 rows,
  48 `prose only`) + postmortems template; CONTEXT.md authz jargon; ARCHITECTURE.md admission
  header + 13 `Enforced by:` lines; `docs/INDEX.md`; register field normalization (in flight).

### In progress

- Follow-up register normalization to the three-line field template (agent pass, scripted so it
  can be re-run on AE4's newer copy after the rebase).

### Next

1. Commit B once `lint:registers` and the full chain are green.
2. Rebase onto `authz-ae4-catalog` (moved 9+ commits since the cut; it holds ADRs 0180–0184, so
   ADR 0185 here renumbers to the highest live number + 1); re-run the normalization on AE4's
   register; re-derive AE4's Current state from its fresh § Now.
3. Commit C: PROGRESS.md cut, follow-up files → `docs/followups/`, bug archive → `docs/bugs/`,
   `check-progress-doc.mjs` + `progress-contract.md` + CLAUDE.md edits (diff to PO first).
4. Read-only review → `docs/reviews/docs-restructure-review.md`; merge after AE4.

### Blockers

- CLAUDE.md commit waits on the PO's diff approval.
- AE4 is being committed to concurrently (measured twice on 2026-09-03, moving between two
  `git diff --stat` runs) — the rebase target is not fixed until AE4 merges.
