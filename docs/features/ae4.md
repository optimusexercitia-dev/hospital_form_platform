---
id: AE4
title: Authz catalog cutover — staff_admin substituted, 3 of 43 permissions load-bearing
status: gated
kind: feature
program: AUTHZ
phase: "ADR 0155 — Phase AE4 (Gate AE4, pre-pilot)"
branch: ~   # landed on main 2026-09-03 (fast-forward, PO-ruled ahead of the gate); authz-ae4-catalog deleted
plan: ../plans/authz-evolution.md
progress: ../progress/authz-ae4.md
reviews: ["../reviews/authz-ae4-review.md", "../reviews/authz-ae4-gate-review.md"]
adrs: ["0079", "0155", "0162", "0172", "0174", "0175", "0176", "0177", "0178", "0179", "0180", "0181", "0182", "0183", "0184"]
handoff: ../handoffs/authz-ae4-2026-09-03.md
fup: ~
---

# AE4 — Authz catalog cutover, staff_admin substituted

## Acceptance criteria

Full definition: [Gate AE4](../plans/authz-evolution.md) (§ AE4.7 "Gate AE4" clause, line ~1061)
and the performance pass conditions P1–P6:
[authz-ae4-performance-acceptance.md § 6.1](../design/authz-ae4-performance-acceptance.md). Still
open:

- [x] P1 — "No `Seq Scan` on `public.memberships`, `public.profiles`, `public.commissions` or
      `public.hospitals` anywhere in the nested plans" — **PASS**, re-specified to bound the
      **index path**, not the `Seq Scan` node (ADR 0181); run 6 + run 7 both PASS, the bundled
      vacuity control FIRED, all four chain tables CLEAR (docs/design/authz-ae4-performance-acceptance.md
      §14, §17)
- [x] P5 — "The permission arm costs ≤ 4× the legacy arm on the identical statement over identical
      rows" — **PASS at 0.00×** (was 5.28×/4.99×; `K=4` never moved), via the statement-scoped
      resolver (ADR 0182) (docs/design/authz-ae4-performance-acceptance.md §14, §15.2)
- [ ] "the C2 subset closed (pilot cutline)" — still open: the full sweep ran (171/171 enforcers:
      COVERED 109 · BLIND 40 · ERROR 22) but "C2 IS NOT CLOSED" — three uncovered populations
      named (Tier 2's 190 doors; the `HCDS*`/`28000` family structurally absent from the worklist;
      ~10 ERROR enforcers with no verdict) (docs/progress/2026-Q3.md; ADR 0184 point 4)
- [ ] "the grant-deletion mutation flips the production door for each of the three
      representatives" — `commission.forms.edit` still re-keyed at only 4 of the 7 policy sites
      the PO-approved matrix names; `BUG-AE49-D6-REKEY-INCOMPLETE` remains OPEN
      (docs/bugs/BUGS.md)
- [ ] "full §6 + e2e:prod" — no further `e2e:prod` run since the single 2026-09-02 run; still owed
      at Gate AE4 (QA review MAJOR-3, unaddressed) (docs/reviews/authz-ae4-if9-statement-scoped-review.md
      §7 MAJOR-3)
- [ ] "QA review" — **two reviews outstanding**: the broad Gate AE4 review stays CHANGES REQUESTED,
      unaddressed (F-BLOCK-1/2/3, F-MAJOR-1) (docs/reviews/authz-ae4-gate-review.md); the narrower
      IA-F9 statement-scoped review's CHANGES REQUESTED findings were corrected and
      measurement-re-verified (§15) but a **formal QA re-review is still owed**
      (docs/reviews/authz-ae4-if9-statement-scoped-review.md; docs/progress/qa-verdicts-archive.md,
      2026-09-03 row)
- [ ] "PO approval = the pilot-gate authz milestone" — not yet sought
      (docs/plans/authz-evolution.md:1068)

## Current state

**Updated:** 2026-09-03

### Objective

Substitute `staff_admin` end-to-end against the `authz` catalog and make 3 of 43 permissions
load-bearing on real production doors (the Gate AE4 minimum re-key scope, PO-confirmed 2026-09-02,
ADR 0176 D6). Full narrative: [state snapshot](../progress/authz-ae4.md) (re-homed sections, below).

### Done since start

- **IA-F9 run 6 (2026-09-03): ACCEPTANCE MET.** P1/P2/P3/P4/P5/DC1/DC2/DC3/P7 all PASS; P5 **0.00×**
  (was 5.28×/4.99×), via the statement-scoped resolver — `authz.authorized_scope_ids` proposes a
  candidate scope per assignment fact and `authz.has_permission` itself confirms each one (ADR 0182,
  migration `20261003007320`).
- P1 re-specified (ADR 0181) to bound the **index path**, not the `Seq Scan` node.
- QA reviewed run 6: CHANGES REQUESTED (one real DEFINER `search_path` defect + 6 more) — all
  corrected and **every gate re-verified from scratch**, nothing inherited (§15.2): 0 over-grants
  across 520 cells / 37 principals / 11 hats / 13 orgs.
- External audit of run 6's P2 evidence disposed — 4 findings, none upheld as filed; P2
  re-specified with a committed checker (ADR 0183) and independently **measured PASS in run 7**
  (exit 0, both differential directions fired, §4 decomposition residual **0**).
- C2's full sweep ran — 171/171 enforcers: COVERED 109 · BLIND 40 · ERROR 22 — merged into this
  branch (`3b21826b`, 13 commits folded); see the C2-TIER1 hub.

### In progress

- The `authz.scope_reaches` fix, spun off to `authz-ae4-scope-reaches-fix`, is **folded back into
  this branch and verified** (ADR 0180; confirmed by IA-F9 runs 6/7) — it has no branch of its own
  and so no separate hub.
- Formal QA **re-review** of the IA-F9 statement-scoped corrections — self/measurement-verified
  (§15.2) but not yet re-reviewed by `qa`.
- Rollback runbook §6 worked example — still staged, PO-deferred until AE4 concludes and merges.

### Next

1. Fix `BUG-AE49-D6-REKEY-INCOMPLETE` (still open, 4 of 7 sites) — matrix at
   `docs/design/authz-ae43-staff-admin-permission-matrix.md:291`, verified against the live catalog.
2. QA re-review of the statement-scoped corrections; close F-BLOCK-3/F-MAJOR-1 on the broad
   Gate AE4 review.
3. One final `e2e:prod` run on a quiet machine, batching every remaining change into that window.
4. PO approval; Record step (AE4 row → `phase-ledger.md`, delete the handoff). ⚠ **PO ruled
   2026-09-03: the branch was landed on `main` by fast-forward AHEAD of Gate AE4's declaration,
   NOT pushed** — `push-schema-before-code` fires at the PUSH (`db:push` first; Coolify deploys `main`).

### Blockers

- `BUG-AE49-D6-REKEY-INCOMPLETE` still OPEN — `commission.forms.edit` re-keyed at only 4 of 7
  sites; nothing reds.
- The broad Gate AE4 review stays CHANGES REQUESTED — F-BLOCK-1/2/3, F-MAJOR-1 filed, untouched.
- `e2e:prod` still owed since the single 2026-09-02 run; certain once BUG-AE49-D6-REKEY-INCOMPLETE
  lands (it is a migration).
- C2 does not close — three uncovered populations named in ADR 0184 point 4 (Tier 2's 190 doors;
  the `HCDS*`/`28000` family, structurally absent from the worklist; ~10 ERROR enforcers).
- ✅ **RESOLVED 2026-09-03** (was an open ⚠ UNVERIFIED caution here): the `scope_reaches` fix
  (ADR 0180) landed and IA-F9 runs 6 + 7 confirm **ACCEPTANCE MET** — verified against the current
  working tree, not commit subjects alone.
