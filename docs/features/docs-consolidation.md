---
id: DOCS-CONSOLIDATION
title: Documentation consolidation — one home per fact, one summary and one log per unit (ADR 0186)
status: in_progress
kind: feature
program: DOCS
phase: "ADR 0186 D1–D8 — no product phase; a tracking-apparatus change on top of ADR 0185"
branch: docs-consolidation
plan: ../plans/docs-consolidation.md
progress: ../progress/docs-consolidation.md
reviews: []
adrs: ["0186", "0185"]
handoff: ~
fup: ~
---

# DOCS-CONSOLIDATION — one home per fact

The plan is [docs-consolidation.md](../plans/docs-consolidation.md); the decision is ADR
[0186](../decisions/0186-documentation-consolidation-one-home-per-fact.md) (proposed). This hub is
the branch's first commit, together with the plan and the ADR — the branch was cut from `main`
at `8e0ecd1a` into a worktree because other sessions were live on the primary tree.

## Acceptance criteria

Each is measurable; the baseline is in the record's first session-log entry.

- [ ] `CLAUDE.md` ≤ 20,480 bytes; zero dated change-log annotations (baseline 37,734 B; 5).
- [ ] Zero citations of a retired PROGRESS.md section in living files — gated by the RETIRED arm
      (baseline 95 lines in 36 files).
- [ ] Hub frontmatter has one projection, `docs/features/INDEX.md`; CURRENT.md and the roll-up are
      gone with their arms.
- [ ] Every `in_progress` / `gated` hub links a record with a `## Session log` — gated. Zero
      handoffs for landed units (baseline 2, 33,898 B); the template holds only resume pointer,
      trust, tree, next command.
- [ ] `follow-ups-open.md` ≤ 120 KB (baseline 737,876 B); entries ≤ 20 lines; zero `Register
      line` paragraphs (baseline 123); zero `##` inside entries; parked entries carry the status.
- [ ] Ratchets on `PO to rule` and `per emoji at consolidation` cannot increase.
- [ ] One link checker, one resolved-heading regex.
- [ ] A status change for one unit touches ≤ 3 hand-written files.
- [ ] `docs/reviews/docs-consolidation-review.md`: every cut leaves one canonical home; every new
      check reds on a live subject.

## Current state

**Updated:** 2026-09-03

### Objective

Collapse the ADR 0185 apparatus to one home per fact and one summary plus one log per unit,
with gates that red on the live population, in seven waves with five PO checkpoints
(plan § 5).

### Done since start

- Wave 0: branch + worktree from `main` at `8e0ecd1a`; plan, ADR 0186 (proposed), this hub, the
  record with the baseline, the CURRENT.md line; indexes regenerated.

### In progress

- Wave 1 (stale procedure text + the RETIRED arm), four parallel subagents partitioned by file:
  gate arm · lead-playbook / agents / skills / rules · the docs sweep · hubs / handoffs / records.

### Next

- Wave 2: delete CURRENT.md and the roll-up with their arms; ledger to completed rows only;
  planned hubs lose Current state; legacy-codes moves.
- Then stop for the ADR 0186 acceptance and the D3 ruling before Wave 3.

### Blockers

- PO checkpoints, not yet reached: ADR 0186 acceptance (Waves 3–6), D3 (Wave 3), the CLAUDE.md
  diff (Wave 4), gate 9's proposed-ADR review due 2026-09-24 (Wave 6.5).
- CLAUDE.md holds two citations of retired sections that only the Wave 4 diff may remove; the
  RETIRED arm states that exclusion until then.
