---
id: AE4
title: Authz catalog cutover — staff_admin substituted, 3 of 43 permissions load-bearing
status: complete
kind: feature
program: AUTHZ
phase: "ADR 0155 — Phase AE4 (Gate AE4, pre-pilot)"
branch: ~   # landed on main 2026-09-03; Gate AE4 PO-APPROVED 2026-09-04 once C2 closed
plan: ../plans/authz-evolution.md
progress: ../progress/authz-ae4.md
reviews: ["../reviews/authz-ae4-review.md", "../reviews/authz-ae4-gate-review.md", "../reviews/authz-ae4-gate-rereview.md"]
adrs: ["0188", "0079", "0155", "0162", "0172", "0174", "0175", "0176", "0177", "0178", "0179", "0180", "0181", "0182", "0183", "0184", "0187"]
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
- [x] ✅ **C2 CLOSED 2026-09-04** at `170 COVERED · 1 BLIND · 0 ERROR = 171`, QA APPROVED ([review](../reviews/c2-tier1-closure-review.md)); ⛔ Tier 2's 190 doors stay deferred by ADR 0171 and are **NOT** cleared. Original text: "the C2 subset closed (pilot cutline)" — the full sweep ran (171/171 enforcers:
      COVERED 109 · BLIND 40 · ERROR 22) but "C2 IS NOT CLOSED". ⛔ **ADR 0187 re-scopes what
      closing means** (amends 0184 point 4): Tier 2's 190 doors are a **DISCLOSURE** obligation
      deferred by ADR 0171, **not** a closure blocker — every gate record must state "Tier 2's 190
      doors stay deferred by ADR 0171 and are NOT cleared". C2 closes on exactly three things: the
      anchor fix · the ERROR class re-swept · the keystones. ⛔ Superseded figures, never re-quote:
      "~10 ERROR" (**22**, = 16 suite-abort + 5 semicolon-spanning + 1 `save_block_to_library`);
      `HCDS*`/`28000` "structurally absent" (**false** — 8 functions, all 8 also raise an anchored
      `42501`, so none is excluded by the `:153` filter; 4 already carry verdicts, 4 await a Tier-1
      membership ruling) and its "60 raises + 6" (**retired**) (ADR 0187 C2/C3, D1)
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
- [x] "QA review" — ✅ **RE-REVIEW APPROVED 2026-09-04** at `main` @ `1ac811fe`, both prior AE4
      verdicts re-signed: **36 discharged/resolved · 2 partial · 8 open, none blocking**, no security
      finding, and **all four grounds the broad review refused the gate on discharged**
      (docs/reviews/authz-ae4-gate-**rereview**.md — a NEW file; the broad review keeps its own
      CHANGES REQUESTED header as history). ⭐ It flipped at round 3 **on measurement, not because
      the list got shorter**: 5 of the 6 round-3 proofs re-run or re-constructed by the reviewer,
      all 5 reproducing — the load-bearing one, F-MAJOR-4b, took the **old** assertion **from git**
      rather than from the new file's description of it, and showed it staying green under the very
      mutation that reds the new one. ⚠ Its scope is the two reviews' **findings**, NOT the gate.
      Broad Gate AE4
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
      `9a4bbd22` or now discharged. ✅ **Both reviews were stale against `main`, and the re-review
      verified and signed rather than re-filing** — the instruction this bullet used to carry is
      discharged. All five **F-MAJOR** items + **F-REC-8** closed at `1ac811fe`, F-REC-2/3 at
      `f6a8ec28`, F-REC-5/6 at `fa56e099`, N1–N8 across `e331a095`/`0182421a`/`967caf0a`/`27ec066a`/
      `f397ff8b`, and LOW-1/2/3/8 at `01628bb2`. ⛔ **The verdict's 36 · 2 · 8 is as-of `1ac811fe`
      and has since MOVED**: `01628bb2` closed LOW-1/2/8 and the LOW-3 partial, `05ba7925` closed
      LOW-5's remaining half, so IA-F9's whole open tail is discharged and 4 remain — 3 broad (one
      is C2) + 1 of the re-review's own, every one a non-blocking record/caption item. ⛔ Re-derive
      from the review's tables, never from this sentence or from the signed count
- [x] ✅ **PO APPROVED Gate AE4 on 2026-09-04**, the HOLD discharged by C2's closure. Original text: "PO approval = the pilot-gate authz milestone" — PO ruled 2026-09-03: HOLD until C2
      closes.** Not sought, deliberately; nothing is re-scoped and ADR 0162's "closes before PO
      approval" clause stands (docs/plans/authz-evolution.md:1068)
