---
id: DOOR-SWEEP-DERIVER
title: Door-sweep case deriver — select gates by PROPERTY, read the whole declaration, scope the increment, and let a full run keep the hand-authored baseline (pre-AE5 Batch 1)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 1 of the follow-up batches ruled 2026-09-04"
branch: authz-door-sweep-deriver
plan: ~
progress: ../progress/door-sweep-deriver.md
reviews: []
adrs: ["0079", "0148", "0153", "0173", "0182"]
handoff: ~
fup: ~
---

# DOOR-SWEEP-DERIVER — the diff-scoped sweep's case deriver

## Acceptance criteria

The unit closes **five** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure. Four
live in `scripts/door-sweep-cases.sh` (the §6 step-1 instrument every AE5 increment will run);
the fifth in the full-run emit path of the sweep harness that writes the committed baseline.

- [x] `FUP-DOOR-SWEEP-DERIVER-NAME-FILTER-DROPS-A-REAL-GATE` 🟠 — gates selected by a **property**,
      not a name filter (or the exclusions printed with their reason); `BASE=9a4bbd22^ TIP=9a4bbd22`
      must stop deriving zero cases. ⛔ Not by widening the filter to admit one name.
- [x] `FUP-DOOR-SWEEP-MARKER-BLIND-TO-CONTINUATION-LINES` 🟠 — the `door-sweep-targets:` parser
      consumes continuation lines, or rejects an unmatched continuation loudly; `20261003007250`'s
      three targets derive **from the declaration path**, provable with its `create or replace`
      lines removed from consideration. ⛔ Not by reformatting `…007250`.
- [x] `FUP-DOOR-SWEEP-DERIVER-BLIND-TO-ALTER-FUNCTION` 🟠 — `alter function … security definer`
      is grepped like `alter policy`, the altered function's return type resolved from the **live
      catalog**; a `prosecdef` flip on an existing boolean gate derives that gate.
- [x] `FUP-DOOR-SWEEP-DERIVER-SPANS-THE-WHOLE-WORKING-TREE` 🟠 — the deriver takes an explicit
      scope (migration-id floor or path prefix) **or** prints per-file provenance (committed-range ·
      working-tree · untracked), so a union can never again be recorded as one increment's
      coverage. ⛔ Not by dropping the working-tree/untracked sources.
- [x] `FUP-DOOR-SWEEP-FULL-RUN-DESTROYS-HAND-MERGED-ANNOTATIONS` 🟡 — a **full** sweep merges
      generated rows into `docs/reviews/authz-door-audit-findings.md` and the hand-authored
      material (the `<!-- … -->` subset block, the RENAME note, the skipped-policy annotations)
      survives byte-for-byte. ⛔ Not by extending the subset guard to full runs.
- [x] Every new selection/parse arm **proven able to fire** on its own reproducer (`9a4bbd22`;
      `…007250` declaration-only; a planted `ALTER FUNCTION … SECURITY DEFINER` on a boolean gate
      in a scratch migration never committed; a two-increment working tree; a full-run emit over a
      copy of the baseline), each paired with a clean negative control.
- [x] Gate: `npm run lint` green; `npm run test:db` on a fresh reset green; the four authz arms
      hold; the diff-scoped door sweep **not owed** (no policy or `prosecdef` gate changes — if that
      turns out false, it is owed, both arms — derived, for the first time, by the fixed deriver).

## Current state

**Updated:** 2026-09-05

### Objective
Make `scripts/door-sweep-cases.sh` — the instrument CLAUDE.md §6 step 1 makes every phase and
every AE5 increment run — derive the diff-scoped case list by PROPERTY, read the whole
declaration notation, attribute what it swept to an increment, and let the periodic full sweep
re-baseline without destroying the committed findings file's hand-authored material (Batches
2–3 need that re-baseline).

### Done since start
Nine commits on `authz-door-sweep-deriver`: `bd5a8080` lift `PRED_DOMAIN` (never re-type it) ·
`0a0d3489` tier split — a door is a CATALOG fact, `CASES` is tier 2 only · `6234677d`
`ALTER FUNCTION … SECURITY DEFINER` · `1ba83bff` the whole `door-sweep-targets:` declaration,
read unconditionally · `9ba4cc35` the shared full-run MERGE with a self-verification that
ABORTS · `b08b5734` per-file extraction, per-case provenance and the quotable `SCOPE:` line ·
`8ca0d9ba` `SELFTEST=1` over committed fixtures · `d8ef85df` ADR 0190 · this one.
**Six follow-ups closed**, each on its own quoted `Closes when` (three on the BODY's condition —
their register field said `PO to rule`, disclosed per entry); **two filed**, one of them closed
here. Every new arm proven able to fire on its reproducer, each with a clean negative control
and a discrimination half, and the load-bearing ones re-run against the pre-unit deriver
(`53001454`) to show they are not green-on-first-run — witnesses in the record.
Measured on `731abda0^..HEAD`: 42 cases → **18**, with **0** tokens matching no gate (was 3).
⛔ No production function, policy, migration or seed changed; no sweep was run; the four
committed findings baselines are byte-identical.

### In progress
Nothing — the build and the gate are done, all exit codes read BARE on a fresh
`supabase db reset --local`: `lint` 0 · `typecheck` 0 · `test:db` 0 (`Files=262, Tests=8876,
Result: PASS`, byte-for-byte the last known-good shape) · the four authz arms 0 (`INVARIANT
HOLDS` each) · `SELFTEST=1` 0 (PASS 15 / FAIL 0 / SKIPPED 0) · the diff-scoped sweep **rc 3
NOT-APPLICABLE, derived rather than asserted**. ⚠ Two RED `test:db` runs preceded the green one
and are both in the record: the parked `FUP-PGTAP-WORKER-DEADLOCK` flake (which lost 115
assertions while keeping `Files=262`), then my own re-run against the DB that flake had left
truncated.

### Next
QA review → PO → Record. ⚠ The six closures are written at the BUILD step and are **pending QA
+ PO**; if either rejects, the rotation is reversible (entries and bodies are in
`follow-ups-archive.md` verbatim, `cmp`-checked before the source was cut).

### Blockers
None. ⚠ Open question for the lead, in the report: three of the six closures rest on the
follow-up BODY's condition because the REGISTER field read `PO to rule` — the lead's brief
directed the closure, but that field is the PO's.
