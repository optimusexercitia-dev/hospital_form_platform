# 0196 — The backend surface map splits on the MODULE SEAM axis, and a router replaces the reading list

**Status:** Accepted (2026-09-09, at PO instruction) — the split below is DONE and on `main`.
**Area:** documentation / backend surface map / gates
**Related:** [0078](./0078-authorization-capability-model.md) · [0079](./0079-authz-door-blindness-standing-invariant.md) · [0105](./0105-rename-is-tenancy-admin-of.md) · [0127](./0127-standing-rules-home-and-staleness-gate.md) · [0185](./0185-documentation-restructure-feature-hubs-and-gated-registers.md) · [0186](./0186-documentation-consolidation-one-home-per-fact.md) · [0195](./0195-a-committed-number-needs-one-home-and-a-gated-mirror.md)
**Amends:** [0186](./0186-documentation-consolidation-one-home-per-fact.md) — 0186 classified `backend-state.md` as an *Outbound* destination ("anything that outlives the unit, on demand") and left its internal shape unspecified. That omission is what this decision closes: an outbound destination with no axis and no cap grows without bound.

> ⛔ **This ADR does not change what the map is FOR, and it does not move a single fact into a
> different authority rank.** The live catalog is still the sole truth for schema, RLS and grants
> (CLAUDE.md § graphify, ADR 0078); the map is still a map. What changes is how the map is
> **partitioned and entered** — and, for the first time, that the partition is enforced.

## Context

`docs/backend-state.md` was a single file. Measured at the split:

| | |
|---|---|
| size | **742,255 bytes / 6,353 lines** |
| growth | 119 KB (2026-07-01) → 314 KB (08-01) → 714 KB (09-01) → 742 KB (09-09) — **superlinear, never shrinking** |
| churn | **183 commits, 84 of them in the last 30 days** (~2.8/day) |
| structure | 1 preamble block + **66 `##` sections** |
| of those | **53 dated work-unit slices, 4,577 lines = 72% of the body**, ordered by PHASE |
| the rest | 13 reference registries, 1,396 lines |
| self-correction apparatus | **33 `SUPERSEDED` · 45 `STALE` · 35 "no longer" · 194 ⛔ · 257 ⚠ · 266 date stamps** |
| one line | line 380 was **67,360 characters** — the collapsed `Last updated: … / Previous: … / prior: …` chain |

CLAUDE.md told the lead **and every teammate** to reference this file at phase start. No context
window holds 742 KB, so nobody ever read it whole. ⭐ **The instruction read like a guard across
many phases while guarding nothing** — the same shape as a designated authority with zero callers,
and the reason this decision is filed as an ADR rather than a tidy-up.

The precedent is not theoretical. The sibling project `scheduler_platform` hit the identical
failure — a file of the same name reaching **914 KB / 13,155 lines in nine days** — and split it
onto a module-seam axis on 2026-09-09. ⚠ **Its method is one day old and its largest seam file was
already over its own warn threshold**, so what that precedent demonstrates is that the split is
*executable*, not that it *lasts*. The caps and gate below are this project's answer to that.

## Problem

**The phase axis is the defect.** A reader asks *"what is the surface NOW"*; a phase-ordered file
answers *"what changed on 2026-08-17"*. Reconstructing the first from the second means replaying 53
slices in order and applying every supersession by hand. The file itself conceded this: its top
carried an END-STATE block introduced with *"Read this instead of reconstructing the surface from
five chronological slice sections"* — a hand-maintained materialized view over a hand-maintained
event log, **with nothing keeping the two consistent**. That block's own migration-registry figure
had gone stale, which is precisely the failure the block existed to prevent, one level up.

Two further problems compound it:

1. **No cap, and no gate of any kind on the file's shape.** Gate 12 and gate 15 parsed *two* of its
   thirteen registries; the other eleven and all 53 slices were ungated prose.
2. **A second copy of a generated artifact.** Its `## ADR index` was a hand-curated prose list of
   ADRs — `scripts/build-adr-index.mjs` cites that very list by name as the reason the generated
   `docs/decisions/INDEX.md` exists, noting it *"had stopped in the 0070s"*.

## Decision

**D1 — One file per module seam, never per phase, never per table.** `docs/backend-state.md`
becomes `docs/backend-state/` with **11 seam files + a router + one frozen archive**:
`conventions` · `tenancy-and-identity` · `authorization-and-audit` · `forms-and-responses` ·
`document-model` · `cases-and-ethics` · `printing` · `privacy-and-dsr` ·
`meetings-and-governance` · `notifications` · `data-access`, plus `stamp-history` (below).

**D2 — A new phase EXTENDS its seam file.** It never opens a new file, and never a phase-named one.
This is the rule that keeps D1 from decaying back into the phase axis one file at a time.

**D3 — The router dispatches on the ACTION, not on contents.** `README.md` is a table of
*"Open this / When you are about to …"*. ⛔ **The index is the unit of reading; the section is the
unit of retrieval.** No document may instruct anyone to "read `docs/backend-state/`".

**D4 — Per-file size is gated: warn at 160 KB, FAIL at 200 KB.** ⛔ The remedy is never to raise the
cap, never to open a phase-named overflow file, and never to delete a posted section — it is to find
the seam inside the file that wants its own home. At the split the largest file is
`authorization-and-audit.md` at **114.6 KB**.

**D5 — A posted section is frozen; corrections are APPENDED with a forward marker.** The marker form
is `⚠ **Superseded** — <clause>. See <file> § <n>.`, and gate 16 reds if the named target does not
exist. This is Architecture Rule 5's discipline (a published version is immutable; editing clones)
applied to prose.

**D6 — The shared preamble is byte-identical across every seam file, and gate 16 proves it.** A rule
repeated in twelve files is a rule that drifts in eleven of them.

**D7 — The gate's population is the DIRECTORY LISTING, never a list inside the gate.** A guard that
enumerates a list somebody must remember to update has a hole shaped like forgetting.

**D8 — The `## ADR index` section is DELETED, not moved.** It was an ungated second copy of a
generated file. The router points at `docs/decisions/INDEX.md` instead.

**D9 — The pre-split currency-stamp chain is preserved verbatim in `stamp-history.md`, FROZEN.**
⚠ It is kept rather than cut **because several stamps carry facts that appear nowhere else** — the
two hospital-tier DEFINER doors that lost their `app.is_admin()` arm, `verify_audit_chain` KEEPING
its platform branch, `earliestSessionStart()`. Compressing it to fit would have selected against
exactly those qualifiers.

**D10 — Historical records are NOT rewritten, but dangling LINKS are repaired.** Following ADR 0105:
a record states what was true when written. A moved file path, however, is not a historical claim —
it is a pointer, and a pointer that resolves nowhere is worse than none. 18 markdown links in
gate-covered corpora were repointed at the seam file their own text names; ADRs needed **zero**
edits (gate 9 was already green — they cite by code span, not by link).

## Considered options

1. **Leave it, cap growth by discipline.** Rejected: 183 commits of discipline produced 742 KB and
   33 supersession markers. There was no gate, and prose does not enforce itself.
2. **Split by PHASE into `backend-state/<phase>.md`.** Rejected — it is the defect, formalised. It
   also collides head-on with ADR 0186: a unit's work already has two homes (hub + record), and a
   per-phase surface file would be a third.
3. **Split by TABLE.** Rejected: 169 relations means 169 files, and the facts that actually matter
   (a door's arms, a policy family, a flag's reach) span tables. The seam is where a teammate is
   assigned, so it is where the reading happens.
4. **Generate the whole map from the live catalog.** Rejected *for now*, and this is the one place
   where `scheduler_platform`'s method is deliberately NOT copied: that project is **contract-first**
   (the doc is a specification, posted before the code, and the code is checked against it) whereas
   this project is **catalog-first** (ADR 0078 — the catalog is the sole truth, the doc is a map).
   Generation is the right long-term answer *for the registries*, and the derive-and-compare pair
   already exists for two of them (`service-role-dml-census.mjs` + gate 12; gate 15). Extending it to
   the remaining eleven is follow-on work, not a blocker for the split.

## Consequences

- ⭐ **A reader's entry cost drops from 742 KB to the router plus one seam file** — largest 114.6 KB,
  median ~60 KB. That is the whole point; everything else is scaffolding to keep it true.
- **Gate 16 (`lint:backend-state`) is added to the `npm run lint` chain**, with a 17-arm self-test in
  which every check is proven able to fire AND to stay silent, plus a live mutation run against the
  real corpus (preamble drift, unrouting, and a dangling marker each caught; baseline green after
  rollback).
- **Gates 12 and 15 moved in the same commit as their sections.** Both hard-code a path plus a
  heading regex; a stale path in either fails LOUD (rc 1 / a `FATAL` at the parse site), never blind.
  ⚠ Both were re-run green after the move, at the new path with new line numbers.
- ⚠ **Total volume did not fall** — 742 KB became 732 KB across 13 files, and the ~10 KB delta is the
  deleted ADR index minus twelve added preambles. **The split bounds per-file size; it does not
  reduce what must be maintained.** A reader who expects the map to have gotten smaller has
  misunderstood what was fixed.
- ⚠ **The seam axis reduces the supersession problem; it does not eliminate it.** A reader of
  `document-model.md` still replays 12 DM slices in order — but 12, not 53, and none of them
  interleaved with authz or printing. The remaining reduction has to come from D5 being used.
- ⛔ **`scripts/check-service-role-registry.mjs` still resolves its paths from `process.cwd()`**,
  unlike gate 15, which was hardened on 2026-09-08. Untouched here on purpose: it is a live
  behaviour change to a gate outside this decision's subject. Filed as follow-on.
- **Line-number citations into the old file are now unrecoverable** and were replaced by section
  references where found (`check-supabase-config-schemas.mjs` cited `backend-state.md:3547-3549`).
  ⚠ Applied migrations were deliberately **not** edited — their text is frozen by ADR 0078's rule,
  and two carry now-stale mentions.
