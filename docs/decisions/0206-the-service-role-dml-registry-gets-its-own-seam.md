# 0206 — The service-role DML registry gets its own seam, and the gate that reads it moves in the same commit

**Status:** Accepted (2026-09-11, at PO ruling)
**Area:** documentation / backend surface map / gates
**Related:** [0105](./0105-rename-is-tenancy-admin-of.md) · [0155](./0155-post-aff4-tenancy-and-person-model-evolution-sequence.md) · [0186](./0186-documentation-consolidation-one-home-per-fact.md) · [0198](./0198-backend-state-seams-get-a-replaceable-current-state-layer.md) · [0199](./0199-a-frozen-archive-does-not-belong-on-the-retrieval-path.md)
**Amends:** [0196](./0196-backend-state-split-on-the-module-seam-axis.md) — D1 enumerated the seam files as a closed list of eleven, and D4 named the remedy for an over-warn file without anyone ever having applied it. This decision does both: it adds a twelfth hand-written seam, and it is D4's remedy carried out for the first time. D1's rule is untouched — one file per module seam, never per phase, never per table — and D2 is untouched too, because this is not a phase opening a file, it is a noun leaving one.

## Context

> ⛔ **Nothing was deleted, edited, reordered or summarised.** The moved section is byte-identical to
> the text `main` carried: the region cut from `git show main:docs/backend-state/authorization-and-audit.md`
> diffs empty against the region in the new file, rc 0. What changed is which file it sits in, one
> gate constant, the router, and two pointers.

`docs/backend-state/authorization-and-audit.md` crossed gate 16's 160 KB warn line when unit
`AE5-MATRIX-ARM3-CELLS` appended its slice. The gate still exits 0 — the warn line warns and the cap
is 200 KB — but three facts made this the moment to act rather than the moment to note:

- The file was the largest of the seams and every pre-AE5 unit since Batch 9 had appended to it, so
  the trend was monotone.
- Its `## Current state` block sat at **97 of the 100-line ratchet**. Under
  [`README.md` § The four rules a gate CANNOT enforce](../backend-state/README.md) rule 4, an
  over-ratchet block is fixed by cutting PARAPHRASE — and a block with three lines left starts
  cutting **bounds** instead, which is the failure that rule exists to prevent.
- ⛔ Neither the cap nor the ratchet may be raised. D4 says so, `README.md` maintenance rule 4 says
  so, and both name the same remedy: find the seam inside the file that wants its own home.

The PO ruled the noun on 2026-09-11 (register entry
[`FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`](../followups/follow-ups-archive.md)
§ Ruling — the entry and its body were archived verbatim on 2026-09-11 when this unit closed them,
so the link points at the archive, not at the body file that no longer exists): **the service-role
DML registry leaves.** Measured at the ruling by `awk` byte sum per
`##` heading, it was the largest single candidate at roughly 40 KB against 22 KB for quality-office
oversight (spread over three headings), 18 KB for the privilege budget, 13 KB for the `authz`
catalog and 5 KB for the audit trail. It is also the only candidate that is ONE self-contained
heading, and the router already named *a service-role write* as its own trigger clause — the seam
was visible in the dispatch table before it was visible in the filing.

## Problem

Three things could have gone wrong, and each is a shape this repo has already been bitten by.

1. **A move rebases every relative path inside the moved file.** The 2026-09-09 split left **87
   dangling links** and every gate was green, because none of them looked (LEARN-090; gate 16 check F
   exists because of it). A `MISSING = 0` proof is also silent on whether content still POINTS
   anywhere, so the check has to be RUN and shown able to FAIL.
2. **The gate reads the registry by a hard-coded path.** `scripts/check-service-role-registry.mjs`
   locates the table with `DOC` + a heading regex. A section that moves without its gate leaves a
   gate reading a file that no longer holds the table — and the 2026-09-09 review measured that this
   particular failure is LOUD (a FATAL at the parse site), which is a reason to move them together,
   not a reason to relax about it.
3. **A heading that vanishes strands every reader who navigates by it.** ADR 0196 D5 freezes posted
   sections; the reader-facing half of that is D5's forward marker, and `README.md` maintenance
   rule 2 gives it a form gate 16 validates in both halves — the FILE must exist and a HEADING in it
   must match.

## Decision

**D1 — The registry becomes `docs/backend-state/service-role-dml.md`, a twelfth hand-written seam.**
A digit-free noun, per gate 16 check E. It carries the shared preamble byte-identical to its
siblings (check A), its own scaffolded `## Current state` block (checks G–I), and then the frozen
slice verbatim.

**D2 — The slice moves VERBATIM, and the claim is proved by diff, not by eye.** The region is cut
from `main` and from the new file and diffed; empty output and rc 0 read bare is the evidence.
⛔ A frozen section is not an opportunity to fix its prose: the Summary paragraph disagrees with the
table it summarises (it says 44; gate 11 parses 45 rows), and that disagreement moves with it,
unfixed, because the slice already carries its own instruction to re-derive rather than adjust.

**D3 — The old heading STAYS, as a stub carrying a forward marker.** `## Service-role DML registry
(AE1.4 …)` remains in `authorization-and-audit.md` with a rule-2 `⚠ **Superseded**` line naming both
the file and the heading. A reader who navigates by that heading — or a dated record that cites it —
is sent on, not stranded.

**D4 — Gate 11 moves in the SAME commit as the section**, all three sites: the `DOC` constant, the
header comment, and the remediation text the failure path prints. The proof is its own output line:
the parsed row count before the move equals the count after. ⛔ Its `ROOT = process.cwd()` resolution
is NOT touched here — that is `FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD`'s subject, and
widening into it would be exactly the scope creep the ruling refused.

**D5 — The bounds relocate with the noun; they are not compressed away.** The re-cut block on
`authorization-and-audit.md` loses its registry bullets — not by shortening them, but by deleting
them whole and leaving a pointer, because every one of them carried a negation or a scope bound
(`"None found in TS" is not "unaudited"`; `door: X` is a NAME not a verdict; the census under-counts
BY DESIGN). Each is restated in the new file's own block, where the frozen text is directly below
it. ⛔ Cutting a bullet to fit a cap selects against qualifiers; moving it does not.

**D6 — Pointers are re-pointed, historical claims are not** (0196 D10, following ADR 0105). Two
citations name the registry's location and were re-pointed: the gate-11 entry in
[`lint-gates.md`](../lint-gates.md) and the re-derivation note in
[`FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST`](../followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md).
The dated reviews, records and rulings that say the registry was in `authorization-and-audit.md`
stay exactly as written — they were true when written. The privilege-budget citations in
`CONTEXT.md` are untouched: that noun did not move.

**D7 — The router's file-count sentence is arithmetic and is re-measured, not adjusted.** § The seam
axis states how many files map to a domain and how many are cross-cutting. It has been wrong once
already (it read *"Seven … four"* while the directory held twelve files). `service-role-dml` is
counted as **cross-cutting**, and the sentence now says why the word means something different for
it than for the other three: it enumerates ONE PROPERTY across the domains rather than binding them
all. ⛔ Re-count from the directory listing; the sentence says what population it counts, because no
gate checks it.

## Considered options

**A. Do nothing; the gate exits 0.** Rejected. The warn line is the signal D4 defines, the ratchet
had three lines of headroom, and the next append would have had to cut a bound to fit. "The gate is
green" is precisely the reading D4 was written to forbid.

**B. Raise the warn line or the ratchet.** ⛔ Forbidden explicitly by D4, by `README.md` maintenance
rule 4, and by the ruling. Recorded here only because it is the cheapest wrong answer and someone
will propose it again.

**C. Split a different noun** — quality-office oversight, the privilege budget, the `authz` catalog,
or the audit trail. Rejected by the PO on the measurement: the registry is the largest single
heading, the other candidates are smaller and the `authz` catalog and the audit trail are the seam's
CORE — a file named *authorization and audit* that does not hold them is misfiled by its own name.
Quality-office oversight is spread over three headings, so moving it is three moves.

**D. Summarise the registry in place and link out to a design doc.** Rejected: it would delete a
posted section (0196 D5, D4's "never delete a posted section"), and a summary of a machine-diffed
table is a second copy with no gate — the defect the four `generated-*.md` files exist to retire.

**E. Move the section and leave gate 11 pointing at the old file.** Rejected. It fails loud rather
than silently, which is a mitigation and not a defence; the 2026-09-09 split established the rule
that the gate constant travels in the same commit, and this is the second application of it.

## Consequences

- `authorization-and-audit.md` drops back under the warn line with room for the AE5 increments that
  will keep appending to it, and its block drops below the ratchet. Both figures are read from gate
  16's own output, in the unit record — ⛔ not quoted here, because a number in prose is a second
  copy with no gate.
- There is now a **second** `## Service-role DML registry` heading in the directory (the stub and the
  real one). Gate 16 does not check for duplicate headings, and deliberately so — measured at the
  split, heading duplication is structural three times out of three. This adds a fourth, by design.
- The `docs/backend-state/` directory grows by one file. That is the cost D4 accepts: the alternative
  to more files is bigger files, and this directory exists because one 742 KB file was unreadable.
  ⚠ The bound on file COUNT is the router — a seam nobody can find in the dispatch table is worse
  than a large file — so the row's *"when you are about to"* clause is the load-bearing half, not the
  filename.
- A reader of `authorization-and-audit.md` now has to follow one pointer to reach the registry. That
  is the intended trade, and the forward marker is what pays for it.
- ⚠ **This does not make the moved projection TRUE.** Gate 16 checks that a block exists, is shaped,
  is axis-free and is not stale; a wrong sentence in a well-formed block passes every check. The new
  block was written from the frozen text sentence by sentence, and that is a review property, not a
  gated one.
- ⛔ **`test:db` and `e2e:prod` are not owed by this change** and were not run: no migration, no RLS,
  no `src/`, no UI. The emptiness of `git diff --stat main -- supabase/migrations src` is the claim,
  and it is recorded as a run.
