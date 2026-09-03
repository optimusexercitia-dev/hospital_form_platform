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

- Wave 0 (`8f96e223`): branch + worktree from `main` at `8e0ecd1a`; plan, ADR 0186 (proposed),
  this hub, the record with the baseline, the CURRENT.md line; indexes regenerated.
- Wave 1: the RETIRED arm of gate 13 (self-test proven non-vacuous) and the sweep it gates —
  0 retired-section citations in 237 living files (baseline 95 lines / 36 files); lead-playbook
  §5, the four agent files, the handoff skill's promote table and RESUME step, the two numbering
  sentences, the prettier caps, the AE4 hub contradiction, the BUGS.md header, three unreachable
  SHAs. 43 files, full lint green.

- Wave 2: the CURRENT arm and the PROGRESS.md roll-up deleted with their gate code; the features
  index is the one projection; CURRENT.md a stub until Wave 4 (gate 7 link-checks CLAUDE.md,
  which links it); ledger holds completed rows only; planned hubs forbid a state block;
  legacy-codes moved to `docs/followups/`.

- ADR 0186 accepted 2026-09-03 (PO: "continue"). Wave 3: HUBS arm requires a record with a
  `## Session log` (dates non-decreasing) for in-progress/gated hubs; HANDOFFS arm requires
  `branch:` or `expires:` and reds past expiry; the handoff skill is a four-section resume
  pointer; C2 got its record, AE4's snapshots became log entries, both landed handoffs folded
  into the records and deleted; AE4 and C2 hub blocks purged to 35 / 32 lines.

- Wave 5: the open register is an index (152 KB, 204 entries, 159 body files, 0 Register-line
  paragraphs); the backlog merged as 33 parked entries and deleted; archive cleaned; Critical
  pin rows ≤ 300 chars; BUGS.md links 48 archive bodies; LESSONS +3 rows, first postmortem;
  eight ratchets set from the measured counts; every new check proven able to red.

### In progress

- Wave 6 (gate hygiene) — does not touch CLAUDE.md.

### Next

- Wave 4: the CLAUDE.md diff (drafted, 20,454 B), presented for explicit approval; it also
  deletes the CURRENT.md stub, its `docs/INDEX.md` row, and the progress-contract rule file.

### Blockers

- The Wave 4 diff needs the PO's explicit approval (CLAUDE.md §5); gate 9's proposed-ADR review
  is due 2026-09-24 (Wave 6.5).
- CLAUDE.md holds two citations of retired sections, three CURRENT.md links and a §7 sentence
  naming "the generated feature roll-up" — all only the Wave 4 diff may change; the RETIRED arm
  excludes CLAUDE.md until then by a named constant.
