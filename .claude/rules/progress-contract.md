---
paths:
  - "PROGRESS.md"
  - "docs/progress/**"
  - "docs/followups/**"
  - "docs/bugs/**"
  - "docs/features/**"
  - "docs/planning/**"
broad: the tracker and every one of its rotation destinations IS the subject
anchors:
  - scripts/check-progress-doc.mjs
  - scripts/check-docs-registers.mjs
  - docs/decisions/0185-documentation-restructure-feature-hubs-and-gated-registers.md
source: ADR 0124, ADR 0185
---

# Editing PROGRESS.md, the hubs and the registers

**Mechanical checks are not restated here.** `npm run lint:progress` (gate 7) and
`npm run lint:registers` (gate 13) are the authority — read the scripts, not a copy of them.

## Where a line belongs (ADR 0185)

- **Phase status** → PROGRESS.md § Phase Status. Nothing else lives in that file but § State,
  the generated roll-up and pointers; a cut section that comes back reds.
- **Working state of a unit** → its hub's `## Current state` (`docs/features/<code>.md`): six
  sections, replace never append, ≤ 60 lines; the unit is listed in `docs/planning/CURRENT.md`.
- **Bug** → one row in `docs/bugs/BUGS.md`; status is a cell, there is no rotation.
- **Follow-up** → one entry in `docs/followups/follow-ups-open.md` with Filed · Owner ·
  Severity · Closes when; parked → `deferred-backlog.md` with **Revisit when**; resolved →
  `follow-ups-archive.md`. `PO to rule` is the honest value; an invented one is not.
- **Standing prohibition** (no resolution event) → `.claude/rules/`, ADR 0127 admission.

## Rotation

Completed phase row → `phase-ledger.md` verbatim · completed hub → status `complete`, its
Current state cut into the progress record · resolved entry → the archive. Append before the
cut, `cmp`-verify. ⛔ **Repoint links in the same edit** — root-relative `docs/…` becomes
`../…` from a subdirectory; skipping this broke 474 links once, 41 more later, 20 on 2026-09-03.
