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
reviews: ["../reviews/authz-ae4-review.md", "../reviews/authz-ae4-gate-review.md", "../reviews/authz-ae4-gate-rereview.md"]
adrs: ["0079", "0155", "0162", "0172", "0174", "0175", "0176", "0177", "0178", "0179", "0180", "0181", "0182", "0183", "0184", "0187"]
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
- [ ] "PO approval = the pilot-gate authz milestone" — ⛔ **PO ruled 2026-09-03: HOLD until C2
      closes.** Not sought, deliberately; nothing is re-scoped and ADR 0162's "closes before PO
      approval" clause stands (docs/plans/authz-evolution.md:1068)

## Current state

**Updated:** 2026-09-04

### Objective

Substitute `staff_admin` end-to-end against the `authz` catalog and make 3 of 43 permissions load-bearing on real production doors (Gate AE4 minimum, ADR 0176 D6). Full narrative: [the record](../progress/authz-ae4.md) § Session log.

### Done since start

- IA-F9 run 6/7: **ACCEPTANCE MET** via the statement-scoped resolver (ADR 0182); figures above and in the record.
- P1 re-specified (ADR 0181) to bound the **index path**, not the `Seq Scan` node.
- External audit of run 6's P2 evidence disposed — none of 4 findings upheld; P2 re-specified (ADR 0183), measured PASS in run 7.
- C2's full sweep ran (171/171 enforcers) and merged into this branch; see the C2-TIER1 hub.
- ⭐ **Gate-blocker batch, 2026-09-03** (`e3f986b1`): `BUG-AE49-D6-REKEY-INCOMPLETE` **fixed** (six sites, both halves) and the gate that could not see it **closed** — pgTAP `410` § 8's site-axis arm, proven able to red in BOTH directions plus an attribution control. F-BLOCK-3 closed by PO ruling; F-BLOCK-2 items 1 + 3 discharged; matrix row 1 corrected (F-REC-4).
- ⭐ **Review backlog cleared, 2026-09-03/04** — all five F-MAJOR + F-REC-8 (`1ac811fe`), F-REC-2/3 (`f6a8ec28`), F-REC-5/6 (`fa56e099`), N1–N8, LOW-1/2/3/8 (`01628bb2`), ADR 0183's approval (`05ba7925`). ⛔ Both "MAJOR-5"s are now **DISCHARGED** — IA-F9's (door sweep) and the broad review's F-MAJOR-5; `lint:authz-vectors` runs `--self-test` for real. Never write "MAJOR-5" unqualified even so.
- ✅ **QA RE-REVIEW APPROVED 2026-09-04** at `1ac811fe` (see the acceptance bullet). ADR **0187** re-scopes C2's closure and retires six figures; ADR **0183** ratified by the PO **after the fact**, recorded as such.
- Gates, exit codes read bare: `test:db` 8 764 / 262 files PASS on a fresh reset · `lint` 13/13 · `typecheck` · all four authz arms (`ARM=census` 581 live gates) · both door-sweep arms · **`e2e:prod` GATE GREEN**.

### In progress

- The 4 remaining findings, all non-blocking record/caption items their own filing review classed LOW: 3 from the broad review (one of them **C2**, open by design) + 1 of the re-review's own. ⛔ Re-derive from the review tables — the signed **36 · 2 · 8** is as-of `1ac811fe` and five items closed after it.
- ⚠ **The door sweep's WRITE arm for `professional_profiles_select` is `exit 3` = UNPROVEN, recorded as such and NOT as a pass.** The zero is attributed by the harness itself — *"a SELECT policy has no write semantics"* — and its domain is the live catalog, unlike the 33-row snapshot that made ADR 0178's write-arm zero an apparatus gap. Its READ arm is **COVERED**, and the row now carries the post-ALTER re-measurement annotation ADR 0079 Amdt 8 ruling 3 requires (`31fc5c91`) — the measurement had been made at `1d913daf`; only the record was missing. ⛔ `ARM=census` structurally cannot catch that class: the policy is not a newcomer.

### Next

1. **C2 is the critical path**, and it has **no branch**. ⛔ Its closure condition is ADR 0187 D1's three items — anchor fix · ERROR class re-swept · keystones — **not** "the three uncovered populations". Keystones are **39**, not 40 (D3 ruled `print_source_series` out), and ⛔ **the designs are NOT complete**: the design doc covers **3**, so **36 of 39 have no design** (0187 C1, correcting the hub's own former "designs complete").
2. A second `e2e:prod` after C2 lands its migrations — **owed, and the 2026-09-03 green does not stand in for it**.
3. Then PO approval, then the Record step.

### Blockers

- ⛔ **PO ruled 2026-09-03: HOLD approval until C2 closes.** Nothing re-scoped; ADR 0162's "closes before PO approval" clause stands. AE4 stays `gated`. **Approval is PO-held — it has not been sought.**
- C2 does not close — the three ADR 0187 D1 conditions above. ⚠ Tier 2's 190 doors stay **deferred by ADR 0171 and are NOT cleared**; that is a disclosure every gate record must carry, not a blocker.
- ✅ IA-F9 MAJOR-4 **CLOSED** — ADR 0182's authorising party is **the PO**, confirmed directly 2026-09-03; the ADR header carries it. "operator" had named a seat, not an authority. ⛔ This line previously said the ADR "records no authorising party — awaiting the PO" and was left standing after the header was fixed, so the tree asserted an approval two contradictory ways (re-review N1) — **the same defect as F-BLOCK-3, one artifact later, committed by the session that had just closed F-BLOCK-3.**
- ⛔⛔ **The SCHEMA is pushed; `main` is not fully pushed — and this line has now been wrong in BOTH directions.** Measured 2026-09-04 against the live remote (`git ls-remote`, not the tracking ref): `origin/main` = `27ec066a`, `main` = `31fc5c91`, **11 commits ahead, 0 behind**. The **migration set is identical** — 523 files each side, remote head **`20261003007340`** (the AE4 re-key) — so `push-schema-before-code` holds in outcome and the `e2e:prod` green still describes what ships. The 11 are docs + 5 pgTAP files + `package.json` + `role-catalog.ts` + **comment-only** edits to two already-applied migrations. ⚠ The recorded HOLD ("no merge/push until Gate AE4's PO approval") is still in force, approval PO-held pending C2; the earlier push was not made by this session or its agents. ⛔ **Never re-read this line — re-measure `origin/main..main` and the remote `schema_migrations`** ([live-facts rule](../../.claude/rules/live-facts-measure-dont-quote.md)). It went false the first time by being written, and the commit that recorded *"measured as PUSHED"* (`f6a8ec28`) is itself one of the 11 unpushed.
