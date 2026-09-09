# 0199 — A frozen archive does not belong on the retrieval path, and "it holds unique facts" is a reason to EXTRACT them

**Status:** Accepted (2026-09-09, at PO instruction) — the extraction and the move below are DONE.
**Area:** documentation / backend surface map / authorization records
**Related:** [0078](./0078-authorization-capability-model.md) · [0105](./0105-rename-is-tenancy-admin-of.md) · [0185](./0185-documentation-restructure-feature-hubs-and-gated-registers.md) · [0186](./0186-documentation-consolidation-one-home-per-fact.md)
**Amends:** [0196](./0196-backend-state-split-on-the-module-seam-axis.md) — D9 preserved the pre-split currency-stamp chain inside `docs/backend-state/`, routed as a seam, on the grounds that several stamps carried facts appearing nowhere else. This decision keeps D9's premise and reverses its conclusion.

## Context

> ⚠ **This blockquote sits BELOW the `## Context` heading deliberately, and must stay there** — the same
> constraint the amended decision documents. `**Amends:**` is the last preamble label, so its value runs
> to the end of the preamble, and any decision number appearing above this heading would be parsed as a
> second amends target and planted as a false back-pointer.

`docs/backend-state/stamp-history.md` was the frozen `Last updated: … / Previous: … / prior: …` chain the
single-file map accumulated until the seam split. It was routed from `README.md` as a twelfth seam, so it
counted as an active seam and was pulled into normal context.

Measured at HEAD, 2026-09-09:

| | |
|---|---|
| size | **72,441 bytes — 9.6% of the directory** (`669 KB` after removal, `734 KB` before) |
| shape | **60 lines**, of which line 59 is **66,653 characters / 67,456 bytes** — 93% of the file |
| content | **38 stamps**, dated **2026-06-15 … 2026-08-09**, split on the chain's own `Last updated:` / `Previous:` / `prior:` / `Earlier:` delimiters |

⚠ The external finding that prompted this reported **72,345 bytes** and a **66,557-character** line. Both
are right for the commit they were taken at (`aa8eac1a`, the split); the link-repair commit `659e1bb1`
added 96 bytes to line 59 hours later. Recorded because the discrepancy looks like an error and is not —
and because it is a small live demonstration of why a figure needs the query that produced it.

## Problem

**The reason the file was kept is the reason it could not stay.** D9 kept it because several stamps carry
facts that appear nowhere else, and because compressing it to fit a cap would have selected against
exactly those qualifiers. Both halves of that are true. But a current fact whose only home is a frozen
archive is a **locality failure**, and routing the archive as a seam does not fix it — it makes the
archive read as current state, which is how its stalest claims kept circulating.

Enumerating the chain mechanically — 38 stamps, every backticked identifier tested against all 11 seam
files, then each surviving claim checked against the live catalog — shows D9's example list was wrong in
**both** directions:

1. **A named example was not chain-only.** `hospital_indicator_rollup`'s lost `is_admin` arm is fully
   documented at `data-access.md:129`, with its migration, its bug id and its pgTAP guard. It never
   needed the chain.
2. **The real set is ~150 claims, not three** — including four whole tracks (S1·SUP, S1·MEM, f-cleanup,
   nsp-per-hospital Phase B) with no owning seam section at all.
3. **Six of them CONTRADICT a posted seam section, and the seam is wrong in all six.** The chain was the
   only place the truth was written down. Each verified against the local catalog at migration
   `20261003007350`:

   | Posted seam statement | Live catalog |
   |---|---|
   | `data-access.md` — dashboards gated `is_staff_admin_of OR is_admin` | **no** `dashboard_*` carries `is_admin`; 6 of 9 use `is_tenancy_admin_of`, 3 are staff-admin-only |
   | `data-access.md` — every case-scoped policy **MUST** use `can_read_case_or_admin` | the function **does not exist** |
   | `data-access.md` — `allowed_result_ids` is live | column **dropped**, replaced by three junctions |
   | `data-access.md` — `submitted_form_responses` predicate | live body **does** carry the SUP successor-exclusion |
   | `data-access.md` — `mint_event_code` takes a global advisory lock | **per-hospital**, deliberately, so volume cannot be inferred from gaps |
   | `forms-and-responses.md` — `supersedes_id` "deliberately NOT added" | the column **exists** |

⭐ **The qualifier, not the name, is what the split lost.** In most cases the identifier survived into a
seam and the sentence explaining *why it is shaped that way* did not. `verify_audit_chain` is the sharp
case: the seams name it three times, and **nowhere** say that its `app.is_admin()` arm is the deliberate
platform-tier branch. A noun-rule conformance sweep — the kind this repo runs — would have stripped it as
a BUG-AUTHZ-002 repeat, with nothing in the seams to object.

## Decision

**D1 — The chain moves to `docs/progress/backend-state-stamp-history-archive.md` and is no longer routed.**
`docs/INDEX.md` already classifies `progress/` as tier-7 *Historical* and already holds the `*-archive.md`
convention. Every link inside the chain is `../`, so a sibling directory under `docs/` rebases nothing —
the failure that cost 87 dangling links at the split does not recur here.

**D2 — "It holds facts found nowhere else" is a reason to EXTRACT, never a reason to ROUTE.** The
observation was correct; the remedy was not. An archive earns its place by being *reachable*, not by being
*routed*. This is the general rule, and it generalises past this file.

**D3 — A fact moves only after the CATALOG confirms it, and a fact that fails moves nowhere.** Extraction
is not transcription. Every entry names the stamp it came from and the date it was re-measured. Claims that
no longer hold are **retired in place with the reason**, never quietly dropped and never carried across as
though current — two were: three `trg_audit_*` triggers whose tables were collapsed, and the "no caller yet
(FUP-MEM-3b)" warning on the technical-direction helpers, a follow-up that was **built the same day the
stamp was written**.

**D4 — A negative claim is measured against a live control.** "`is_nsp_org_admin_of` appears in no PHI
door" is worth nothing if the query was malformed, so it ships with its discrimination half: 0 PHI doors,
**11** references overall. Likewise `member_can` (0 in `cases`/`case_phases` policies, 3 elsewhere) and
committee titles (0 policies and 0 predicates keyed on `title_id`, 7 procedures referencing it).

**D5 — The corrections APPEND; the posted sections stay frozen.** Rule 1 of the maintenance rules is
untouched. Each correction lives in an `## Extracted from the pre-split stamp chain` section and leaves a
`⚠ **Superseded**` forward marker under the heading that owns the wrong statement. Gate 16 check C
validates the named file **and** the named heading; both arms were mutation-proven to fire on these
markers before the work was committed.

**D6 — What was NOT extracted is named, not silently omitted.** The four unowned tracks are a
**follow-up**, not an extraction: their end states already reached the seams through later work, what is
missing is the record of when and by what the surface changed, and the sources for that are the migration
files and `schema_migrations` — not a frozen archive. Reconstructing a surface record from the chain would
repeat the error this decision exists to correct.

## Considered options

1. **Leave it routed, per D9.** Rejected: it is what produced the defect. A routed archive is read as
   state, and the six contradictions above sat in the seams for a month while the chain held the
   correction.
2. **Cut the chain down to the unique facts and keep the remnant in the directory.** Rejected for the
   reason D9 gives and this decision keeps: compressing to fit a cap selects against qualifiers, and the
   qualifiers are the whole value. Extract-then-archive-whole preserves both.
3. **Delete it; rely on `git`.** Rejected *for now*. It is recoverable from `2b4fa89b:docs/backend-state.md`,
   but ~150 claims would stop being greppable the moment the extraction proved incomplete — and this
   decision's own follow-up says it is incomplete by design. Revisit once the four tracks have owning
   sections.
4. **Extract all ~150 claims.** Rejected as written: most are 2026-07 authorization claims that would need
   individual catalog verification, and writing them unverified is the precise failure this repo names
   ("a verified-facts baseline is a HAND-LIST wearing a label"). The verified subset moved; the rest is
   D6's follow-up.

## Consequences

- `docs/backend-state/` is **11 seam files + `README.md`**, 669 KB, largest `authorization-and-audit.md` at
  119.7 KB against a 160 KB warn line. The router's own arithmetic — *"Seven of these eleven … four
  cross-cutting"*, which summed to 11 while the directory held 12 — becomes true as a side effect.
- Six seam statements that were actively wrong are corrected, and each is now falsifiable: every entry
  carries the query that produced it, per maintenance rule 5.
- ⚠ **This collides with the sibling `backend-state-current-state` branch**, which adds an in-place
  `⛔ **ARCHIVE**` declaration to `stamp-history.md` and a gate-16 check-G exemption for it. That
  exemption's subject no longer exists in the directory; whoever merges second should drop the exemption
  and the declaration rather than restoring the file. The two decisions agree that the chain is history —
  they disagree only on whether history stays routed, and this one is later.
- Gate 16 needs no change: the population is the directory listing (D7 of the amended decision), so
  removing a file removes it from every check without editing the gate.
