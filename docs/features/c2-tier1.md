---
id: C2-TIER1
title: Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure
status: in_progress
kind: feature
program: AUTHZ
phase: "ADR 0162 §3 — C2 Tier 1 (pilot cutline, pre-Gate-AE4 PO approval)"
branch: authz-c2-tier1
plan: ../plans/authz-evolution.md
progress: ~
reviews: []
adrs: ["0171", "0162", "0079"]
handoff: ~
fup: ~
---

# C2-TIER1 — Command-door Tier 1 sweep

## Acceptance criteria

Full ruling: `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` / Critical FUP C2
(docs/progress/follow-ups-open.md, PO ruling 2026-08-18) and the re-grained predicate in
[authz-c2-tier1-sizing.md § 8b](../design/authz-c2-tier1-sizing.md). Still open:

- [ ] "Sizing closed nothing here — no door has a verdict" (docs/progress/follow-ups-open.md
      `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`; PROGRESS.md § Now)
- [ ] "8 of 171 measured — the FULL SWEEP HAS NOT RUN, no door has a verdict, C2 stays OPEN"
      (PROGRESS.md § Now)
- [ ] `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS` — "the first 8 measurements ... found 3 BLIND:
      `public.nsp_org_capa_rollup`, `public.cancel_event` (both **0** pgTAP mentions) and
      `public.cancel_session`" — each needs a keystone (docs/progress/follow-ups-open.md)
- [ ] "`assume_role` remains ERROR-shaped, not COVERED, and must be resolved *within* Tier 1"
      (docs/design/authz-c2-tier1-sizing.md § 10)
- [ ] "the C2 subset closed (pilot cutline)" before Gate AE4's PO approval
      (docs/plans/authz-evolution.md:1066; ADR 0162 §3)

## Current state

**Updated:** 2026-09-03

### Objective

Sweep the 237 command doors that touch PHI (Tier 1, gate-aware closure over `ARM=census`'s
population — re-grained 2026-08-31, [sizing record § 8b](../design/authz-c2-tier1-sizing.md))
with the new command-door neutralizer, before Gate AE4's PO approval (ADR 0162 §3).

### Done since start

- Sizing: parent population 427 doors (345 `public` + 82 `app`); Tier 1 re-grained to 237/427
  (55.5 %), Tier 2 = 190, all 6 positive controls pass, no hand-list (§8b).
- Tenancy disjunct DROPPED (a domain tautology, 92.5 %→81.0 %→74.5 % across every grain tried) —
  those doors are Tier 2/deferred, not cleared; tenant isolation still rides on
  `ARM=hat`/`floor`/`policy`.
- Command-door neutralizer BUILT (`c2-command-door-neutralizer.sh`, rewrites an authz `raise` to
  `null;`) and merged to `main` (`66b31cd1`, `1163443d`; ADR 0171).
- Proven on both polarities: 5 COVERED, 3 BLIND of 8 measured, against a `Files=248, Tests=8289`
  baseline.
- Branch `authz-c2-tier1` cut at `8ca976d7`, pushed to origin, to continue the sweep on another
  machine.

### In progress

- The remaining 163 of 171 new enforcers (237 doors share 243 enforcers, 72 already in the bool
  arm) — unmeasured.
- The 3 BLIND guards from the proof-of-concept need keystones
  (`FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS`).

### Next

- Run the full sweep from `authz-c2-tier1`.
- Resolve `assume_role`'s ERROR shape to COVERED within Tier 1.
- Close the sweep before Gate AE4's PO approval is sought (ADR 0162 §3).

### Blockers

- No door has a recorded sweep verdict yet; C2 stays OPEN (PROGRESS.md § Now).
- ⚠ **VERIFIED 2026-09-03:** `authz-c2-tier1`'s only commit ahead of the shared AE4/C2 base is a
  handoff-carry doc (`77d94b60`, 2026-09-02) — "C2 is about to be run from THIS branch on another
  machine" (its own commit message). No sweep-execution commit is observed on it here.
- Full sweep estimated ~3.5–7h pre-re-grain; not re-estimated for the 237-door population.
