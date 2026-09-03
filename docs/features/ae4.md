---
id: AE4
title: Authz catalog cutover — staff_admin substituted, 3 of 43 permissions load-bearing
status: in_progress
kind: feature
program: AUTHZ
phase: "ADR 0155 — Phase AE4 (Gate AE4, pre-pilot)"
branch: authz-ae4-catalog
plan: ../plans/authz-evolution.md
progress: ../progress/authz-ae4.md
reviews: ["../reviews/authz-ae4-review.md", "../reviews/authz-ae4-gate-review.md"]
adrs: ["0079", "0155", "0162", "0172", "0174", "0175", "0176", "0177", "0178", "0179"]
handoff: ../handoffs/authz-ae4-catalog.md
fup: ~
---

# AE4 — Authz catalog cutover, staff_admin substituted

## Acceptance criteria

Full definition: [Gate AE4](../plans/authz-evolution.md) (§ AE4.7 "Gate AE4" clause, line ~1061)
and the performance pass conditions P1–P6:
[authz-ae4-performance-acceptance.md § 6.1](../design/authz-ae4-performance-acceptance.md). Still
open:

- [ ] "the C2 subset closed (pilot cutline)" — C2 Tier 1 stays OPEN, only 8 of 171 new enforcers
      measured, no door has a verdict (docs/plans/authz-evolution.md:1080-1081; PROGRESS.md § Now)
- [ ] P1 — "No `Seq Scan` on `public.memberships`, `public.profiles`, `public.commissions` or
      `public.hospitals` anywhere in the nested plans" — FAILED, 8 240 `Seq Scan on hospitals`
      (docs/design/authz-ae4-performance-acceptance.md § 6.1; docs/progress/authz-ae4.md § "Gate
      AE4 wave + IA-F9")
- [ ] P5 — "The permission arm costs ≤ 4× the legacy arm on the identical statement over identical
      rows" — FAILED at 6.19×/6.21× (docs/design/authz-ae4-performance-acceptance.md § 6.1;
      docs/progress/authz-ae4.md § "Gate AE4 wave + IA-F9")
- [ ] "the grant-deletion mutation flips the production door for each of the three
      representatives" — `commission.forms.edit` re-keyed at only 4 of the 7 policy sites the
      PO-approved matrix names (`BUG-AE49-D6-REKEY-INCOMPLETE`;
      docs/handoffs/authz-ae4-catalog.md § "Open questions / blockers")
- [ ] "full §6 + e2e:prod" — a further single, quiet-machine `e2e:prod` run is owed once
      `BUG-AE49-D6-REKEY-INCOMPLETE`'s migration lands (docs/handoffs/authz-ae4-catalog.md §
      "Next task" item 3)
- [ ] "QA review" — Gate AE4 QA = CHANGES REQUESTED (docs/reviews/authz-ae4-gate-review.md;
      PROGRESS.md § Now)
- [ ] "PO approval = the pilot-gate authz milestone" — not yet sought
      (docs/plans/authz-evolution.md:1068)

## Current state

**Updated:** 2026-09-03

### Objective

Substitute `staff_admin` end-to-end against the `authz` catalog and make 3 of 43 permissions
load-bearing on real production doors (the Gate AE4 minimum re-key scope, PO-confirmed 2026-09-02,
ADR 0176 D6). Full narrative: [state snapshot](../progress/authz-ae4.md) (re-homed section, below).

### Done since start

- AE4.1–AE4.9 D6+D5 built and gated; `e2e:prod` GATE GREEN in a single run (1h43m, 1273/1273
  accounted), 09-02.
- 4 ARMs (census/hat/floor/wrapper) exit 0, INVARIANT HOLDS; door-sweep READ arm exit 0 (7/7
  COVERED, 0 BLIND).
- Door-sweep WRITE arm re-aimed 33→107 policies (was bounded by a SYNTAX, not a property) and
  swept CLEAN: 4/107 COVERED, 0 BLIND, exit 0, merged (`974328e6`).
- IA-F9 earned a verdict after 4 runs: `AE4 ACCEPTANCE NOT MET (3 of 7 rows PASS)` (`8ca976d7`) —
  DC1/DC2/P2/P3/P4 PASS, P1/P5 FAIL. Attributed by planted-cost control to `authz.scope_reaches`'s
  `hospitals` seq-scan (8 240 scans), not the DEFINER SRF IA-F9's own premise blamed.
- C2 Tier 1 sized + re-grained (237/427 doors, all 6 controls pass, no hand-list); neutralizer
  built and proven on both polarities (5 COVERED / 3 BLIND of 8 measured).

### In progress

- `authz-c2-tier1` branch cut at `8ca976d7`, pushed — sweep continuation "about to be run … on
  another machine" (handoff-carry commit `77d94b60`); no sweep-execution commit observed yet.
- The `authz.scope_reaches` regression fix was spun off to `authz-ae4-scope-reaches-fix` and
  **folded back into this branch at `eebe1faa`** (measured 2026-09-03, `git log`); with no branch of
  its own it has no hub (ADR 0185 D1). `FUP-SCOPE-REACHES-HOSPITALS-SEQ-SCAN` is still OPEN in the register.
- Rollback runbook §6 worked example staged (`ae49-revert.sql`/`ae49-verify.sql`/
  `ae49-expectations.md`) — PO-deferred until AE4 concludes and merges.

### Next

1. Fix `BUG-AE49-D6-REKEY-INCOMPLETE` — re-key the two sibling policy sites
   (docs/design/authz-ae43-staff-admin-permission-matrix.md:291), verified against the live
   catalog.
2. Land the `scope_reaches` fix, then re-run the IA-F9 acceptance against it.
3. Batch remaining changes into one window; run `e2e:prod` once on a quiet machine.
4. QA re-review, PO approval, Record step (AE4 row → `phase-ledger.md`, delete the handoff).
5. Merge — schema before code (`push-schema-before-code` fires at that merge); `main` stays HELD
   until then (re-measure `git rev-list --left-right --count main...HEAD`, never quote it).

### Blockers

- Gate AE4 QA = CHANGES REQUESTED (`a6ff4ad0`); F-BLOCK-3 (approval scope stated 3 ways: 42/33/43)
  and F-MAJOR-1 (`hardDenyClasses` empty on 43/43, lint arm iterates zero times) filed, untouched.
- IA-F9 acceptance NOT MET: P1 FAIL (8 240 seq scans), P5 FAIL (6.19×/6.21× vs a 4× threshold) —
  cause `authz.scope_reaches`; fix + re-run owed before the gate can close.
- C2 Tier 1 not closed — 8 of 171 new enforcers measured; full sweep unrun.
- ⚠ **VERIFIED 2026-09-03:** `git branch --list` no longer shows `authz-ae4-scope-reaches-fix` —
  merged back into `authz-ae4-catalog` at `eebe1faa`. Commit **subjects** there (bodies unread)
  suggest `scope_reaches` fixed, P1 resolved (ADR 0181, absent here), IA-F9 "run 6 MEETS the
  acceptance" — **UNVERIFIED**: this worktree's docs predate the merge. Re-sync before trusting
  P1/P5 as still open above.
- `main` HOLD stands — no merge/push until Gate AE4's PO approval (schema-first rule armed, not
  yet fired).
