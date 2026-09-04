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
handoff: ~
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
- [x] "the grant-deletion mutation flips the production door for each of the three
      representatives" — **DONE 2026-09-03** (`e3f986b1`, migration `20261003007340`).
      `BUG-AE49-D6-REKEY-INCOMPLETE` **fixed**: all **six** live `R` policies re-keyed in BOTH
      halves, catalog-verified. ⛔ The matrix's "7 ALL" was wrong twice — `form_block_library` is a
      **`D` site with no write policy**, and `form_item_validations`' policy is an **unreachable
      backstop** (`FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1`); row 1 corrected (F-REC-4). Equivalence
      proven over 6 204 cells, 0 disagreements, discrimination control firing exactly 5
- [ ] "full §6 + e2e:prod" — no further `e2e:prod` run since the single 2026-09-02 run; still owed
      at Gate AE4 (QA review MAJOR-3, unaddressed) (docs/reviews/authz-ae4-if9-statement-scoped-review.md
      §7 MAJOR-3)
- [ ] "QA review" — findings addressed 2026-09-03, **verdicts not yet re-signed**. Broad Gate AE4
      review: F-BLOCK-1 fixed, F-BLOCK-3 closed by PO ruling, F-BLOCK-2 items 1 + 3 discharged
      (item 2 = C2, still open), F-MAJOR-1 confirmed at depth 2 on BOTH arms — remediation (a)
      recommended, not yet applied. IA-F9 review: MED-1/MAJOR-1/2a/2b/MED-2 all either already
      fixed in code by `9a4bbd22` or now corrected in spec. ⚠ **That review is STALE against
      `main`** — a re-review must verify and sign, not re-file (docs/reviews/authz-ae4-gate-review.md)
- [ ] "PO approval = the pilot-gate authz milestone" — ⛔ **PO ruled 2026-09-03: HOLD until C2
      closes.** Not sought, deliberately; nothing is re-scoped and ADR 0162's "closes before PO
      approval" clause stands (docs/plans/authz-evolution.md:1068)

## Current state

**Updated:** 2026-09-03

### Objective

Substitute `staff_admin` end-to-end against the `authz` catalog and make 3 of 43 permissions load-bearing on real production doors (Gate AE4 minimum, ADR 0176 D6). Full narrative: [the record](../progress/authz-ae4.md) § Session log.

### Done since start

- IA-F9 run 6/7: **ACCEPTANCE MET** via the statement-scoped resolver (ADR 0182); figures above and in the record.
- P1 re-specified (ADR 0181) to bound the **index path**, not the `Seq Scan` node.
- External audit of run 6's P2 evidence disposed — none of 4 findings upheld; P2 re-specified (ADR 0183), measured PASS in run 7.
- C2's full sweep ran (171/171 enforcers) and merged into this branch; see the C2-TIER1 hub.
- ⭐ **Gate-blocker batch, 2026-09-03** (`e3f986b1` + uncommitted doc work): `BUG-AE49-D6-REKEY-INCOMPLETE` **fixed** (six sites, both halves) and the gate that could not see it **closed** — pgTAP `410` § 8's site-axis arm, proven able to red in BOTH directions plus an attribution control. F-BLOCK-3 closed by PO ruling; F-BLOCK-2 items 1 + 3 discharged; matrix row 1 corrected (F-REC-4). All gates green, exit codes read bare: `test:db` 8 760 tests, `lint` 13/13, `typecheck`, all four authz arms, both door-sweep arms.

### In progress

- `e2e:prod` — running 2026-09-03 against the re-key. ⚠ It cannot be the FINAL pre-approval run: C2 will land more migrations, so a second is owed after C2 closes.
- Formal QA **re-review** — the last open step of Gate AE4's own list. ⚠ Both reviews are now **stale against `main`**: most IA-F9 findings were already fixed by `9a4bbd22` and the rest are corrected. The re-review verifies and signs; re-filing them would be wrong.
- F-MAJOR-1 remediation **(a)** — narrow `410` § 6.2's caption and provenance to depth-1. Confirmed at depth 2 on BOTH arms (`is_active` inside `assignment_facts` and inside `is_tenancy_admin_of_for`). ⛔ (b), the transitive form, must fix M7's zero-iteration loop in the same change or it buys nothing.

### Next

1. QA re-review → verdict; apply F-MAJOR-1 (a); MAJOR-5's door-sweep re-run on a fresh reset.
2. **C2 is now the critical path** — 40 BLIND keystones designed, none written; two further populations. It has **no branch**.
3. A second `e2e:prod` after C2, then PO approval, then the Record step.

### Blockers

- ⛔ **PO ruled 2026-09-03: HOLD approval until C2 closes.** Nothing re-scoped; ADR 0162's "closes before PO approval" clause stands. AE4 stays `gated`.
- C2 does not close — three uncovered populations named in ADR 0184 point 4.
- ADR 0182 records **no authorising party** though § 12.4 required its own approval (IA-F9 MAJOR-4) — awaiting the PO; ⛔ not to be invented.
- ⛔ **`main` HOLD stands and `main` is NOT pushed** — the branch landed by fast-forward ahead of the gate by PO ruling. `push-schema-before-code` fires at the PUSH (`db:push` first; Coolify deploys `main`). *(Restored 2026-09-03: a doc-consolidation compression had dropped this qualifier.)*
