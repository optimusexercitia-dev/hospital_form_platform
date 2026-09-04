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
- [x] "full §6 + e2e:prod" — **GATE GREEN 2026-09-03** against the re-key (`e3f986b1`): 1 256 passed
      · 0 failed · 0 infra · **6 flaky** · 0 did-not-run, 21 batches, `E2E_PROD_EXIT=0` read bare.
      6 flaky is well under the documented ~18–27 baseline, so no new flake class. IA-F9 MAJOR-3
      discharged — and it asked only for a `SPECS=`-scoped subset, so the full suite exceeds it.
      ⚠ **Not the FINAL pre-approval run**: C2 will land migrations, and a second is owed after it
- [ ] "QA review" — findings addressed 2026-09-03, **verdicts not yet re-signed**. Broad Gate AE4
      review: F-BLOCK-1 fixed, F-BLOCK-3 closed by PO ruling, F-BLOCK-2 items 1 + 3 discharged
      (item 2 = C2, still open), F-MAJOR-1 **remediation (a) APPLIED** (`1d913daf`) — § 6.2 is now
      captioned depth-1 and provenance renamed `measured-depth1-at-sites-and-authorizer`, the zero
      disclosed as a **search horizon, not an absence**. ⛔ **"depth 2 on BOTH arms" was MINE, not
      the review's** — the review is CORRECT on both counts (`:235` "a live depth-2 instance",
      which is `is_tenancy_admin_of_for` at depth 2; and *layer* 1 for `assignment_facts`). The
      generalisation to "both arms" arose in my spawn prompt, was echoed back, and I then
      attributed it upstream. Re-derived: `assignment_facts` sits at depth **4** on
      all three rows and `org.professionals.read` reaches `respondent_exclusion` at depth **5** —
      *layer* 1 was collapsed into *search depth* by paraphrase. It matters because it steers (b)
      toward "raise the search one hop", which catches one path and leaves five unmeasured. IA-F9
      review: MED-1/MAJOR-1/2a/2b/MED-2 and **IA-F9's** MAJOR-5 all either already fixed by
      `9a4bbd22` or
      now discharged. ⚠ **That review is STALE against `main`** — a re-review must verify and sign,
      not re-file (docs/reviews/authz-ae4-gate-review.md)
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

- Clearing the re-review's own findings: **N1/N5/N6/N8 done** (lead), **N2/N3/N4 done** (`967caf0a`). Remaining are the broad review's ten pre-existing open findings — three of them named in its own APPROVED conditions: **F-MAJOR-3**, **F-MAJOR-4b** (provably incapable of failing alone) and **F-MAJOR-5** (both vector generators' `--self-test` invoked by no gate).
- ⚠ **The door sweep's WRITE arm for `professional_profiles_select` is `exit 3` = UNPROVEN, recorded as such and NOT as a pass.** The zero is attributed by the harness itself — *"a SELECT policy has no write semantics"* — and its domain is the live catalog, unlike the 33-row snapshot that made ADR 0178's write-arm zero an apparatus gap.

### Next

1. Re-review returned **CHANGES REQUESTED** (2026-09-03): 20 discharged · 2 partial · 16 open, **all four grounds the broad review refused the gate on discharged**, no security finding. Clear its N2–N8. ⛔ **Two different "MAJOR-5"s exist** — IA-F9's (door sweep) is CLOSED; the broad review's **F-MAJOR-5** (both vector generators' `--self-test` invoked by no gate; `lint:authz-vectors` is still `--check && --check`) is **STILL OPEN**. Never write "MAJOR-5" unqualified.
2. **C2 is now the critical path** — 40 BLIND keystones designed, none written; two further populations. It has **no branch**.
3. A second `e2e:prod` after C2, then PO approval, then the Record step.

### Blockers

- ⛔ **PO ruled 2026-09-03: HOLD approval until C2 closes.** Nothing re-scoped; ADR 0162's "closes before PO approval" clause stands. AE4 stays `gated`.
- C2 does not close — three uncovered populations named in ADR 0184 point 4.
- ✅ IA-F9 MAJOR-4 **CLOSED** — ADR 0182's authorising party is **the PO**, confirmed directly 2026-09-03; the ADR header carries it. "operator" had named a seat, not an authority. ⛔ This line previously said the ADR "records no authorising party — awaiting the PO" and was left standing after the header was fixed, so the tree asserted an approval two contradictory ways (re-review N1) — **the same defect as F-BLOCK-3, one artifact later, committed by the session that had just closed F-BLOCK-3.**
- ⛔ **`main` HOLD stands and `main` is NOT pushed** — the branch landed by fast-forward ahead of the gate by PO ruling. `push-schema-before-code` fires at the PUSH (`db:push` first; Coolify deploys `main`). *(Restored 2026-09-03: a doc-consolidation compression had dropped this qualifier.)*
