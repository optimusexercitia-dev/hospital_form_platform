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
- [x] `follow-ups-open.md` ≤ 160 KB — 151,978 B (baseline 737,876 B; the 120 KB target was
      re-set at Wave 5: headings verbatim + 33 merged backlog entries); entries ≤ 20 lines; zero
      `Register line` paragraphs (baseline 123); zero `##` inside entries; parked entries carry
      the status. Gated.
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

- Waves 0–3 (`8f96e223` … `0ccabf95`): branch, plan, ADR 0186 (accepted 2026-09-03); RETIRED
  arm + sweep (95 → 0 citations); CURRENT arm and roll-up gone; one summary + one log per unit,
  handoffs folded into records and deleted. Detail: the record's session log.
- Wave 5 (`4384f204`): the register is an index (152 KB, 204 entries, 159 body files); backlog
  merged and deleted; eight ratchets set from measured counts; BUGS.md links 48 archive bodies;
  LESSONS 72 → 75 with the first postmortem.
- Wave 6 (`dfdda783`): one link checker shared by gates 7 and 13; row-grade `complete` check;
  YAML block scalars parsed; tombstones out; lint-gates.md is thirteen paragraphs.
- Wave 4 (PO-authorized diff, 2026-09-03): CLAUDE.md 37,734 → 20,454 B; CURRENT.md, its
  directory and the progress-contract rule deleted; the contract table lives in `docs/INDEX.md`;
  the RETIRED arm now covers CLAUDE.md.

### In progress

- Nothing — Wave 7 (Record) is next.

### Next

- Wave 7: read-only review (`docs/reviews/docs-consolidation-review.md`); hub → complete, block
  appended to the record; migration script deleted with its SHA recorded; branch deleted; PO
  approval to merge to `main`.

### Blockers

- Gate 9's proposed-ADR review is due 2026-09-24 (plan 6.5) — the PO's.
- The merge to `main` is the PO's call; `main` is unpushed.
