---
paths:
  - "PROGRESS.md"
  - "docs/progress/**"
anchors:
  - scripts/check-progress-doc.mjs
  - docs/decisions/0124-progress-live-state-contract.md
source: ADR 0124
---

# Editing PROGRESS.md and its archives

**Mechanical checks are not restated here.** `npm run lint:progress`
(`scripts/check-progress-doc.mjs`) is the authority — read the script, not a second
copy of it. A restated check is the copy that drifts.

## The three-way test, applied to every line

Before writing a line into `PROGRESS.md`, decide which of three it is:

- **State** — merges and is recorded. Rotates on *"did it merge?"*. Belongs here.
- **Backlog** — open but nobody can act on it next session. Belongs in
  `docs/progress/deferred-backlog.md`, indexed here by one line.
- **Rule** — a standing prohibition with **no resolution event** ("never fix X by
  granting Y"). It can only accumulate here. Belongs in `.claude/rules/`, path-scoped
  to the files it governs. This is the category that made the file grow monotonically.

## Rotation

Destinations: completed phase rows → `phase-ledger.md` · resolved follow-up index lines
→ `follow-ups-archive.md` · closed bugs → `bug-log-archive.md` · concluded gate/QA/decision
rows → their archives. Full mechanics: `docs/lead-playbook.md` §§4–5.

- Move **verbatim**, append **before** the cut, `cmp`-verify.
- ⛔ **Repoint links in the same edit.** A row written for the repo root carries
  root-relative `docs/...` links; from `docs/progress/` they must become `../...`.
  Skipping this broke 474 links once and 41 more sat broken until the link check was
  widened to cover the destinations.
- ⛔ **Never rotate to satisfy the size cap** what CLAUDE.md §7 protects: § Critical FUP,
  and OPEN index lines. Rotate *concluded* material. An index line is the register the
  PO reads from — a follow-up with no line in it is invisible work (QA finding R3).

## One-line form

§ Decisions is one line per decision; rationale lives in the ADR the row links to, not
in the row. The cell cap is enforced, and the sections it applies to are listed in the
script. A cell that needs more than a line is an ADR that has not been written yet.
