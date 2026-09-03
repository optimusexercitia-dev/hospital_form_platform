# Postmortems

A postmortem is the long form of one row in [`../LESSONS.md`](../LESSONS.md); the row is the short
form. Both carry the same `LEARN-NNN` id — that id is the only link between them, so a postmortem
file is invisible to the register unless its row already exists.

**Filename:** `<LEARN-NNN>-<slug>.md` (e.g. `LEARN-014-dashboard-definer-door-blindness.md`), placed
directly in this directory.

**Required sections, `## `, in this exact order:**

1. `## What happened`
2. `## Why it happened`
3. `## Why we didn't detect it earlier`
4. `## What worked well`
5. `## What failed`
6. `## General lesson`
7. `## Changes made`
8. `## New rule`
9. `## Applies to`

**Admission (ADR 0185 D7).** Any session may open a postmortem for a failure it judges costly
enough — the same judgement call that decides what enters session memory. There is no severity
threshold enforced by tooling; use judgement, not a rule. The PO prunes postmortems that turn out
not to have earned their file.

**Gate.** All nine sections above must be present, in order, and non-empty, and the file's
`LEARN-NNN` prefix must match an existing row in `LESSONS.md`. A postmortem that fails either check
is not yet admitted — fix the row or the sections before treating it as part of the register.
