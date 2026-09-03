---
id: DOCS-CONSOLIDATION
title: Documentation consolidation — one home per fact, one summary and one log per unit (ADR 0186)
status: complete
kind: feature
program: DOCS
phase: "ADR 0186 D1–D8 — no product phase; a tracking-apparatus change on top of ADR 0185"
branch: docs-consolidation
plan: ../plans/docs-consolidation.md
progress: ../progress/docs-consolidation.md
reviews: ["../reviews/docs-consolidation-review.md"]
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

Each is measurable; the baseline is in the record's first session-log entry, the final values in
the review (`docs/reviews/docs-consolidation-review.md`, APPROVED 2026-09-03).

- [x] `CLAUDE.md` ≤ 20,480 bytes — 20,454 B; zero dated change-log annotations (baseline 37,734 B; 5).
- [x] Zero citations of a retired PROGRESS.md section in living files — gated by the RETIRED arm,
      0 in 394 files (baseline 95 lines in 36 files).
- [x] Hub frontmatter has one projection, `docs/features/INDEX.md`; CURRENT.md and the roll-up are
      gone with their arms.
- [x] Every `in_progress` / `gated` hub links a record with a `## Session log` — gated. Zero
      handoffs for landed units (baseline 2, 33,898 B); the template holds only resume pointer,
      trust, tree, next command.
- [x] `follow-ups-open.md` ≤ 160 KB — 151,978 B (baseline 737,876 B; the 120 KB target was
      re-set at Wave 5: headings verbatim + 33 merged backlog entries); entries ≤ 20 lines; zero
      `Register line` paragraphs (baseline 123); zero `##` inside entries; parked entries carry
      the status. Gated.
- [x] Ratchets on `PO to rule` and `per emoji at consolidation` cannot increase — eight caps set
      (147/135/29/38/97/10/40/47), a raise proven to red.
- [x] One link checker, one resolved-heading regex — gate 7 imports both from gate 13's script.
- [x] A status change for one unit touches ≤ 3 hand-written files: the hub block, the record's
      session-log entry, and — only at completion, only for a phase — the ledger or PROGRESS.md row
      (review F-4 named the record; it was always the second file).
- [x] `docs/reviews/docs-consolidation-review.md`: every sampled cut has one canonical home; every
      new check has a fixture and the review states which are exercised live and which are
      fixture-only today. **Verdict: APPROVED**, four non-blocking findings, all addressed at Record.

## Completed 2026-09-03

Eight commits on `docs-consolidation` (`8f96e223` … Record), reviewed read-only and
**APPROVED** the same day. The final Current-state block was appended to the record's session
log at completion, as ADR 0186 D3 requires: [docs-consolidation.md § Record](../progress/docs-consolidation.md).
Still owed by the PO, not by this unit: gate 9's proposed-ADR review (due 2026-09-24), the three
ruling lists behind the ratchets, and the merge of this branch into `main`.
