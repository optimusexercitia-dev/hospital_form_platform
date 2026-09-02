# ADR 0179 — One open follow-up register: the PROGRESS.md index is folded into the bodies

**Status:** accepted
**Date:** 2026-09-02
**Amends:** ADR 0124, ADR 0140

## Context

Follow-ups were stored in four places at once: a one-line index in `PROGRESS.md` § Follow-ups,
full bodies in `docs/progress/follow-ups.md`, resolved items in `follow-ups-archive.md`, and
parked items in `deferred-backlog.md`. The index and the body were two records of one item, and
ADR 0140's gate existed precisely to catch them drifting apart — in both directions.

Measured 2026-09-02, before the change:

- The index was **125 lines / 51,391 bytes — 53 % of `PROGRESS.md`**, against an 80 KB target
  and a 100 KB hard cap, with 5,527 bytes of headroom left.
- It could not be rotated: the contract (ADR 0124, CLAUDE.md §7) forbids moving an OPEN index
  line at any file size, so the section grew monotonically by construction. A de-duplication
  pass on 2026-08-31 bought headroom once (96,352 → 76,629) and was spent within a day.
- The register's own entry, `FUP-PROGRESS-INDEX-LINES-HAVE-OUTGROWN-THE-CONTRACT`, had already
  named the two available remedies and recorded that the choice is the PO's: raise the target
  again, or give the register its own file.
- **27 items were entered in two live registers at once** (the 2026-08-19 "deferred tail":
  a bullet in `deferred-backlog.md` whose body lived in `follow-ups.md`).

The PO ruled on 2026-09-02: consolidate to one open register, keep § Critical FUP in
`PROGRESS.md`.

## Decision

1. **`docs/progress/follow-ups-open.md` is the single OPEN follow-up register.** One item is
   **one `###` entry** carrying severity, id, title, owner, origin and body together. There is no
   separate index, so there is nothing to keep in sync — the failure class ADR 0140's gate
   detected is now structurally absent rather than policed.
2. **The entry headings ARE the index.** `grep -n '^### ' docs/progress/follow-ups-open.md`
   reproduces it. Nothing is generated, so nothing can go stale.
3. **`docs/progress/follow-ups.md` is deleted**; its content moved into the new file. Every body
   was carried **verbatim** — verified by round-trip diff: 123 hunks, 123 added lines, all blank,
   **zero removed, zero changed**.
4. **`PROGRESS.md` § Follow-ups becomes a pointer**, and keeps its heading (gate 7 requires it).
   § Critical FUP stays in `PROGRESS.md` unchanged: it is PO-curated and **additive** — a row
   there adds a trigger and a deadline to an item that also keeps its full register entry. It
   exists so the general register's length cannot bury it, which moving it would defeat.
5. **The 27 double-registered items are cut to one record**: their `deferred-backlog.md` bullets
   were removed and their register entries carry a **`**Parked**`** marker, preserving the
   not-actionable-next-session signal at the item itself. 27 cut, 27 marked, verified both ways.
6. **The origin field is mandatory on new entries.** `**Filed:** <date> (<phase / increment /
   review>)`. A bare date is not an origin. This is the field that decides whether a six-week-old
   entry is actionable, and it was the one most often lost — a deferral whose only record is a
   phase doc disappears at the next Record step.

## Gate consequences (`scripts/check-progress-doc.mjs`, gate 7)

Two checkers asked their question of index lines that no longer exist, so both would have gone
**vacuously green** rather than red — the exact failure this script is written against. They were
replaced, not deleted:

| Retired | Successor | Property |
| --- | --- | --- |
| `checkFupIndex` | `checkRegisterResolved` | no RESOLVED entry left in the open register — opt-out only via an explicit, entry-scoped `**Retained**` line |
| `checkFupBodies` | `checkRegisterIntegrity` | no duplicate id; no id with an entry in **both** register and archive |
| `checkFupBodyResidue` | `checkDoubleRegistration` (**warning**) | no id entered in both register and backlog |
| — | `checkNoIndexInProgress` | § Follow-ups must not re-grow an index — the first line back reds |
| — | `checkCriticalRowsHaveEntries` | a § Critical FUP row whose id has no register entry is an orphan |

`checkDoubleRegistration` is a warning, not a finding, and the bound is stated: which register an
item belongs to is a parked-vs-actionable judgement the script cannot make. It reports; a human
routes.

`indexEntryRe`'s mention-vs-entry distinction (ADR 0140's eleven-day specimen) is **kept** and
still carries its vacuity controls, because `checkDoubleRegistration` depends on it.

## Consequences

- `PROGRESS.md`: **96,873 → ~47,300 bytes**, from 5.5 KB of headroom to roughly 34 KB, and the
  structural reason it grew monotonically is gone rather than deferred.
- Filing a follow-up is **one edit in one place**. The dual-write that produced "an index line
  with no body" and "a body with no index line" cannot be performed.
- ⚠ **The open register has no size cap, deliberately.** Cap pressure must never land on it:
  *compression under cap pressure cuts qualifiers first*, and this register's measured failure
  mode is **prose rot, not stale subjects** — 6 of the 10 oldest entries carried a false sentence,
  always in the act/don't-act clause, always erring tighter so it reads as care.
- ⚠ **Bounded, and not fixed here:** `scripts/authz-c2-tier1-sizing.sql:25` cites a PO ruling by
  **line number** (`follow-ups.md:946-990`). A line-number citation into a living document was
  already broken by any edit above it; this move guarantees it. It should be re-keyed to the
  entry's id.
- Historical prose in `docs/reviews/`, `docs/plans/` and `docs/decisions/` still says "index line
  **and** body". Those are dated records of what was true and were left as history; only broken
  **links** and live **instructions** were repointed.
