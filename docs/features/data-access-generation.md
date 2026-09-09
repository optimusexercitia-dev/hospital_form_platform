---
id: DATA-ACCESS-GENERATION
title: Data-access registries generated from the catalog — four hand-maintained tables replaced by a derive-and-compare pair, gated in two halves (ADR 0197)
status: gated
kind: feature
program: DOCS
phase: "ADR 0197 D1–D7 — no product phase; executes the follow-on ADR 0196 § Considered options option 4 left open"
branch: data-access-generation   # cut from main @ e4ac95e5; a fast-forward merge
plan: ~
progress: ../progress/data-access-generation.md
reviews: []
adrs: ["0197", "0196", "0195", "0186", "0078"]
handoff: ~
fup: ~
---

# DATA-ACCESS-GENERATION — the registries derive, the prose judges

The decision is ADR
[0197](../decisions/0197-data-access-registries-are-generated-not-maintained.md). No plan
document: scoped, executed and recorded in one session, discharging the item ADR 0196 filed
against itself — *"extending it to the remaining eleven [registries] is follow-on work"* — for
`data-access.md`'s four.

## Acceptance criteria

Baselines, queries and the mutation-run table are in the record's session-log entry.

- [x] **The finding re-derived before acting, not quoted.** 533 non-trigger `public` functions
      exist and 169 were named; 42 typed flag fields and 18 absent; 109 modules and 36 unnamed.
      ⚠ Two figures in the prompting report did not reproduce and both are corrected in ADR 0197
      § Context — the 533 comes from the CATALOG, not `database.ts` (which holds 473), and 18
      flags were absent, not 15.
- [x] Four registries GENERATED from the live catalog + `src/` into four new seam files:
      `generated-rpc-surface.md` (555) · `generated-helper-surface.md` (526) ·
      `generated-feature-flags.md` (43) · `generated-query-modules.md` (109). Largest 114.3 KB,
      under gate 16's 160 KB warn.
- [x] **The handwritten half survives**: all four frozen sections kept verbatim (ADR 0196 D5), each
      given a `⚠ **Superseded** —` forward marker that states what IS superseded (the inventory)
      and what is NOT (the invariants, the SQL↔TS mirrors, each flag's PRODUCTION state).
- [x] Gate 17 `lint:data-access` in the `npm run lint` chain — eight checks, a **30-arm** self-test
      over a SYNTHETIC corpus built by the generator's own renderers, three near-miss
      discrimination halves, and the unmutated fixture as the global control.
- [x] **8-mutation run against the REAL corpus on disk**, every mutation asserted to have APPLIED
      before its arm was scored: all 8 caught as a FINDING (rc 1, never rc 2), baseline green after
      every rollback.
- [x] The pgTAP mirror `400_data_access_census.sql` proven **able to fail**: 6 tests run; a
      corrupted digest pin and a corrupted row-count pin each red it; green after restore.
- [x] Three live flag defects found and fixed — `power_authoring` + `technical_director` live with
      no typed field (one caller cast past the type system), `case_access` typed with no live key.
- [x] `npm run lint` rc=0 · `npm run typecheck` rc=0 · `npm run test:db` rc=0 on a **fresh
      `supabase db reset`** (263 files, 8,906 tests), all **taken bare, not through a pipe**.

## Current state

**Updated:** 2026-09-09

### Objective

Stop hand-maintaining `data-access.md`'s four registries: derive them from the live catalog and
from `src/`, keep only the judgements a catalog cannot hold, and gate the derivation in two
composable halves so neither needs the other's environment (ADR 0197).

### Done since start

Complete and committed on `data-access-generation`. Four generated seam files (245,206 B) + four forward markers
+ four router rows; `scripts/gen-data-access-surface.mjs` (51-arm self-test),
`scripts/data-access-census.sql`, gate 17 `scripts/check-data-access-registry.mjs` (30-arm
self-test), and the pgTAP mirror. Lint, typecheck and `test:db` all rc=0 bare, `test:db` on a fresh
reset. Four defects found by building it — three flag-typing drifts and a digest sort-order bug that
neither half of the gate could have found alone.

### In progress

Nothing. The unit is code-complete and committed, awaiting §6 step 3.

### Next

A read-only QA review. On APPROVED, this hub goes to `complete` with the block cut into the record
(ADR 0186 D3).

### Blockers

⛔ **Status is `gated`, not `complete`, because NO QA review has been run** — the same posture as
[BACKEND-STATE-SPLIT](backend-state-split.md), and recorded rather than worked around.
⚠ Committed on `data-access-generation`, **not on `main` and not pushed**. The branch is a
fast-forward from `e4ac95e5`.

## Scope note (2026-09-09) — what was deliberately NOT done

⛔ **Four of the eleven ungated registries, not eleven.** The seven remaining hand-maintained tables
elsewhere in `docs/backend-state/` are untouched, and so is
`FUP-BACKEND-STATE-SPLIT-GATE-12-RESOLVES-FROM-CWD` (`check-service-role-registry.mjs` still
resolves from `process.cwd()`) — a live behaviour change to a gate outside this unit's subject.
⚠ **`app.feature_flags.enabled` is emitted but asserted on by NOTHING**, in either half. It is the
seeded local value; the production claim is a human's and stays handwritten. Deliberate, stated in
the generated file, and not an oversight.
⚠ **Serialisation:** this unit adds files and appends markers, and edits no seam-file body — chosen
so the two sibling P1 units (current-state layers; retiring `stamp-history.md`) can proceed without
a content collision. Neither has a hub yet.
