---
id: C2-TIER1
title: Command-door Tier 1 sweep — PHI-touching command doors, gate-aware closure
status: gated
kind: feature
program: AUTHZ
phase: "ADR 0162 §3 — C2 Tier 1 (pilot cutline, pre-Gate-AE4 PO approval)"
branch: ~   # landed on main with AE4 2026-09-03; authz-ae4-catalog deleted; not closed (ADR 0184 pts 4–5)
plan: ../plans/authz-evolution.md
progress: ../progress/c2-tier1.md
reviews: ["../reviews/c2-command-door-findings.md"]
adrs: ["0171", "0162", "0079", "0184", "0153"]
handoff: ~
fup: ~
---

# C2-TIER1 — Command-door Tier 1 sweep

## Acceptance criteria

Full ruling: `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` / Critical FUP C2
(docs/followups/follow-ups-open.md, PO ruling 2026-08-18) and the re-grained predicate in
[authz-c2-tier1-sizing.md § 8b](../design/authz-c2-tier1-sizing.md). Still open:

- [x] "Sizing closed nothing here — no door has a verdict" — **superseded**: the full sweep has
      since run, 171/171 enforcers now carry a verdict (docs/progress/2026-Q3.md, "C2 FULL SWEEP
      COMPLETE 2026-09-02")
- [x] "8 of 171 measured — the FULL SWEEP HAS NOT RUN, no door has a verdict, C2 stays OPEN" —
      **superseded**: full sweep ran — COVERED 109 · BLIND 40 · ERROR 22 (docs/progress/2026-Q3.md;
      [findings](../reviews/c2-command-door-findings.md))
- [ ] `FUP-C2-THREE-BLIND-COMMAND-DOOR-GUARDS` — "the first 8 measurements ... found 3 BLIND:
      `public.nsp_org_capa_rollup`, `public.cancel_event` (both **0** pgTAP mentions) and
      `public.cancel_session`" — each needs a keystone; still true of the larger 40 BLIND from the
      full sweep, and none are written yet (docs/followups/follow-ups-open.md)
- [ ] "`assume_role` remains ERROR-shaped, not COVERED, and must be resolved *within* Tier 1"
      (docs/design/authz-c2-tier1-sizing.md § 10; unchanged per the c2-tier1-neutralizer handoff)
- [ ] "the C2 subset closed (pilot cutline)" before Gate AE4's PO approval — **still open despite
      the full sweep**: "C2 IS NOT CLOSED" (docs/progress/2026-Q3.md; ADR 0184 points 4–5;
      docs/plans/authz-evolution.md:1066; ADR 0162 §3, amended by ADR 0184 on branch-order only)
- [ ] The three uncovered populations named in ADR 0184 point 4 must be resolved before the class
      can be called swept: Tier 2's 190 doors (deferred, ADR 0171); the `HCDS*` family (60 raises)
      + `28000` (6), structurally absent from the worklist because the mutation anchor and the
      gate-fn filter share one syntax; ~10 ERROR enforcers with no verdict at all (35 raises span a
      `;` the anchor cannot match)
- [ ] "A COVERED/BLIND verdict from this run means `HC0*`-coded-guard coverage, NOT authorization
      coverage" — the `HC0*` space must be classified by property before a verdict here can be read
      as an authorization claim (ADR 0184 point 5)

## Current state

**Updated:** 2026-09-03

### Objective

Sweep the 237 command doors that touch PHI (Tier 1, gate-aware closure over `ARM=census`'s population), then close the three uncovered populations the sweep itself exposed, before Gate AE4's PO approval (ADR 0162 §3, amended on branch-order by ADR 0184).

### Done since start

- Full sweep ran 2026-09-02 — 171/171 enforcers swept (COVERED 109 · BLIND 40 · ERROR 22; see acceptance criteria above and the record).
- PO ruling 2026-09-02 lifted the branch-order HOLD — the sweep ran against the branch's own schema, not `main`'s (ADR 0184).
- C2's commits merged into `authz-ae4-catalog` 2026-09-03; a duplicate-ADR-number collision was resolved by renumbering C2's sweep ADR to 0184 (detail: record).
- Anchor-regex fix for the semicolon-spanning ERROR class validated — staged, not yet applied to the harness.

### In progress

- Keystones for the 40 BLIND findings — designs complete (`docs/design/authz-c2-blind-keystone-designs.md`), none written yet.
- Classifying the `HC0*` error space by property (state guard vs. authorization guard) so a verdict can be read honestly.

### Next

- Write keystones, targeting the clusters first (correction workflow 4/5 BLIND, interview 6/9 — not spread evenly).
- Land the validated anchor-regex fix, then the delta sweep for `HCDS*`/`28000` (a new population).
- Diagnose the 16 suite-abort doors (`FUP-C2-SUITE-ABORT-ERROR-CLASS`); resolve `assume_role`'s ERROR shape to COVERED within Tier 1.
- Cut a new branch from `main` for the next increment — C2's remaining work currently has none.

### Blockers

- C2 does **not** close despite the full sweep — the mutation anchor is a syntax, not a property (three uncovered populations, ADR 0184 point 4).
- C2's remaining work has no branch — `authz-ae4-catalog` landed on `main` and was deleted 2026-09-03; `main` is not pushed.
- 40 BLIND findings need keystones; allowlisting is prohibited — it would make `ARM=floor` and this harness agree while both measure nothing.
