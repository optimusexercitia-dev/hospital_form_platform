---
id: BACKEND-STATE-SERVICE-ROLE-SEAM
title: "The service-role DML registry gets its own seam — the first application of ADR 0196 D4's remedy, ruled by the PO on 2026-09-11 when authorization-and-audit.md crossed gate 16's warn line"
status: gated
kind: feature
program: DOCS
phase: "ADR 0196 D4 applied once — no product phase; discharges FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE"
branch: backend-state-service-role-seam   # cut from main @ 3c66efb6
plan: ~
progress: ../progress/backend-state-service-role-seam.md
reviews: ["../reviews/backend-state-service-role-seam-review.md"]
adrs: ["0196", "0198", "0199", "0186", "0105"]
handoff: ~
fup: ~
---

# BACKEND-STATE-SERVICE-ROLE-SEAM — one noun leaves the largest seam file

The PO ruled on 2026-09-11 (register entry
`FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`, body § Ruling) that **the
service-role DML registry leaves** `docs/backend-state/authorization-and-audit.md`. This unit is
the split, and nothing else: no schema, no RLS, no `src/` change. ⚠ It is **docs plus one gate
constant**, not docs-only — gate 11 (`scripts/check-service-role-registry.mjs`) reads the registry
from the seam file by a hard-coded path and a heading regex, so the section and the gate move in
one commit, exactly as they did at the 2026-09-09 split.

## Acceptance criteria

Figures below were measured at the ruling and are **re-measured at the first session** — the gate's
own line, the `awk` byte sum, and gate 11's parsed-key count are the baselines, never these numbers.

- [x] **Baselines taken before anything moves.** Gate 16's `[D]` line for `authorization-and-audit.md`
      (160.4 KB at the ruling); the byte sum of the frozen slice `## Service-role DML registry (AE1.4 …)`
      (40,694 at the ruling; groups A–H + Summary, 13 outbound links, all to
      `../design/authz-ae1-rpc-rulings.md`); gate 11's parsed identity-key count, read from its own output.
- [x] **The new seam file** `docs/backend-state/service-role-dml.md` — a digit-free noun (README
      § When you must touch it, row 4). It carries the shared preamble **byte-identical** to its
      siblings (gate 16 check A/C), a `## Current state` block printed by
      `node scripts/check-backend-state.mjs --scaffold` and filled **from the moved slice's own
      sentences** (README § The four rules a gate CANNOT enforce), then the frozen slice **verbatim**:
      the moved region diffs byte-empty against the region cut from the old file.
- [x] **The old file keeps a forward pointer, not a hole.** In `authorization-and-audit.md` the slice's
      heading stays as a stub carrying the rule-2 marker form
      `⚠ **Superseded** — moved to its own seam. See service-role-dml.md § Service-role DML registry …`
      (gate 16 reds if the named file or heading does not exist), so a reader who navigates by that
      heading is sent on, not stranded. Its `## Current state` block is **re-cut**: the registry bullets
      become one pointer, `**Updated:**` re-stamped, and the block **shorter** than before (97 lines at
      the ruling) — a cut of paraphrase, never of a bound.
- [x] **The router re-pointed.** `README.md` gains a row for `service-role-dml.md` ("touch a
      service-role write, `createAdminClient()`, or a row gate 11 diffs"), the authorization row loses
      *a service-role write*, and § The seam axis's file-count sentence is re-measured (it is
      arithmetic the split itself once corrected).
- [x] **Gate 11 follows the section.** `DOC`, the header comment and the help text in
      `scripts/check-service-role-registry.mjs` name the new file; gate 11 then parses the **same**
      key count as the baseline (zero keys is its own FATAL — the detector cannot pass on nothing).
      ⛔ `FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD` stays untouched.
- [x] **Every citation of the section re-pointed** (ADR 0196 D10: a pointer is not a historical
      claim): `docs/lint-gates.md` gate-11 line; `docs/followups/FUP-SERVICE-ROLE-WRITE-SITES-NO-GUARD-VANISH-TEST.md:9`;
      and whatever a run of `grep -rn "authorization-and-audit.md" --include=*.md` finds that names
      the **registry** (the privilege-budget citations in `CONTEXT.md` stay — that noun does not move).
- [x] **The link check is RUN and PROVEN ABLE TO FAIL** (LEARN-090; a detector that finds nothing
      must be shown able to find something): gate 16 check F and gate 13's shared checker green on the
      tree, then one link inside the moved slice mutated on a scratch copy and F observed red, then
      restored and green — both readings bare, recorded in the record.
- [x] **The decision written down**: an ADR **Amends 0196 D1** (a twelfth domain seam) and applies
      D4's remedy for the first time, numbered *highest on any live branch + 1* re-measured at
      reservation — 0206 at open; ⛔ never 0202 or 0204 (reserved); `npm run adr:index`.
- [x] **Gate**, every rc read **bare**: `npm run lint` 0/0 (gates 11, 13, 16 inside it) with gate 16
      printing **no `[D]` warning** on `authorization-and-audit.md`; `npm run typecheck`;
      `git diff --stat main -- supabase/migrations src` **empty**. `test:db` and `e2e:prod` are not owed
      (no SQL, no UI) — stated, not skipped silently.
- [ ] **The follow-up closed in both homes** per docs/INDEX.md, then QA review (read-only,
      docs-and-gate scope) → human approval → Record step.

## Current state

**Updated:** 2026-09-11

### Objective

Move the service-role DML registry out of `authorization-and-audit.md` into its own routed seam
file, take gate 11 with it, leave a forward pointer behind, and prove the move by gates run bare
rather than by eye.

### Done since start

**Built and gated; nine of ten boxes ticked.** The frozen slice moved to
`docs/backend-state/service-role-dml.md` **verbatim** — the region cut from `main` diffs byte-empty
against the region in the new file, rc 0. The new file's preamble is byte-identical by
CONSTRUCTION (extracted, not retyped); its `## Current state` block was printed by `--scaffold` and
filled from the slice's own sentences. The old file keeps the heading as a stub with a rule-2
forward marker naming file **and** heading, its block re-cut **shorter** with the registry bounds
relocated (deleted whole, restated in the new seam) rather than compressed. Gate 11 moved in the
same commit at all three sites and parses the **same** row count as the baseline. Router row added,
*a service-role write* removed from the authorization row, the seam-axis arithmetic re-measured from
the directory listing with the counted population now stated. Two pointers re-pointed, historical
claims left alone, `CONTEXT.md`'s privilege-budget citations untouched. ADR 0206 written
(`**Amends:** 0196`) and the index rebuilt. Figures, queries and the ⚠ frozen 44-vs-45 inconsistency
that travelled with the slice: record § Session log.

### In progress

Nothing. Gate re-run at the tip by the lead (not the builder): lint rc 0, typecheck rc 0, empty
pathspec diff, verbatim diff rc 0, gate 16 with no `[D]` line, gate 11 unchanged. QA review
**APPROVED, zero findings** (`docs/reviews/backend-state-service-role-seam-review.md`).

### Next

Human approval (Phase Gate step 4); then the Record step, where the lead closes
`FUP-AE5-MATRIX-ARM3-CELLS-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE` in both homes and fills the commit sha
into the `**Landed (pending QA)**` line already in its body.

### Blockers

None. ⛔ `test:db` and `e2e:prod` are **not owed** — no migration, no RLS, no `src/`, no UI; the
empty `git diff --stat main -- supabase/migrations src` is that claim's evidence, and it was run.
