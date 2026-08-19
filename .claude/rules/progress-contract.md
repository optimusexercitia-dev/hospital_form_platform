---
paths:
  - "PROGRESS.md"
  - "docs/progress/**"
broad: the tracker and every one of its rotation destinations IS the subject
anchors:
  - scripts/check-progress-doc.mjs
  - docs/decisions/0124-progress-live-state-contract.md
source: ADR 0124
---

# Editing PROGRESS.md and its archives

**Mechanical checks are not restated here.** `npm run lint:progress` is the authority —
read the script, not a second copy of it. A restated check is the copy that drifts.

## The three-way test, for every line

- **State** — merges and is recorded. Belongs here.
- **Backlog** — open, but nobody can act on it next session → `deferred-backlog.md`,
  indexed here by one line.
- **Rule** — a standing prohibition with **no resolution event** ("never fix X by granting
  Y"). It can only accumulate here → `.claude/rules/`, path-scoped, subject to ADR 0127's
  admission filter. This is the category that made this file grow monotonically.

## Rotation

Destinations: completed phase rows → `phase-ledger.md` · resolved follow-up index lines →
`follow-ups-archive.md` · closed bugs → `bug-log-archive.md` · concluded gate/QA/decision
rows → their archives. Mechanics: `docs/lead-playbook.md` §§4–5.

- Move **verbatim**, append **before** the cut, `cmp`-verify.
- ⛔ **Repoint links in the same edit.** A row written for the repo root carries
  root-relative `docs/...` links; from `docs/progress/` they must become `../...`. Skipping
  this broke 474 links once, and 41 more sat broken until the gate covered the destinations.
- ⛔ **Never rotate what CLAUDE.md §7 protects** to satisfy the size cap: § Critical FUP,
  and OPEN index lines. Rotate *concluded* material. The index is the register the PO reads
  from — a follow-up with no line in it is invisible work (QA finding R3).

## One-line form

§ Decisions is one line per decision; rationale lives in the ADR the row links to. A cell
that needs more than a line is an ADR nobody has written yet.
