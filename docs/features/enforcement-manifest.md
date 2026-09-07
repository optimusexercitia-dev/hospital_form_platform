---
id: ENFORCEMENT-MANIFEST
title: Enforcement manifest — hardDenyClasses made falsifiable, the template's re-key defect (policy re-keyed, DEFINER writer left on layer 1) resolved across the `_staff_admin_write` class, the two undeclared consumers recorded, and the rollback runbook re-measured (pre-AE5 Batch 4, Batch 5 riding along)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 4 of the follow-up batches ruled 2026-09-04 (runs on the second machine, in parallel with Batch 3; merge order Batch 3 first)"
branch: authz-enforcement-manifest
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/enforcement-manifest.md
reviews: ["../reviews/enforcement-manifest-rereview.md", "../reviews/enforcement-manifest-review.md"]
adrs: ["0079", "0162", "0176", "0190", "0191"]
handoff: ~
fup: ~
---

# ENFORCEMENT-MANIFEST — the per-role template's oracle

## Acceptance criteria

The unit closes **four** open follow-ups in `docs/followups/follow-ups-open.md` (Batch 4) and, riding
along, **one** more (Batch 5), each on its own `Closes when` clause — quoted there, not paraphrased
here. Nothing else counts as closure. The subject is the enforcement manifest that the AE4 per-role
template reads as its oracle, its lint arm, pgTAP `410`, the DEFINER writers the re-key left on their
legacy gate, and the rollback runbook AE5 will run eleven times.

- [x] `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` 🟠 — remediation (b), **one change**: `hardDenyClasses`
      populated from the catalog OR the M7 loop replaced by an assertion that fails on the empty
      case; **plus** a §6.2 discrimination control anchored on a class known present; **plus** §6.2's
      search transitive over the composed-call closure, comment-stripped. ⛔ Not "one hop" (measured
      depths 2, 3, 4). ⛔ Not closed by (a), the 2026-09-03 disclosure, which is already on `main`.
- [x] `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` 🟠 — `public.set_item_validations` re-keyed onto the
      permission OR the split recorded deliberately (policy as backstop, DEFINER as the enforcement
      site) in the manifest row. ⛔ Pointing at the re-keyed policy does not close it. **The whole
      `_staff_admin_write` class enumerated** from the live catalog — every policy of that shape and
      every DEFINER writer behind it — and each member dispositioned the same way, so the template
      AE5 copies has no second instance of this defect.
- [x] `FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` 🟡 — **PO ruling**: the function added to
      the `org.professionals.read` row's `enforcementSites` OR a reviewed exclusion recorded in the
      manifest; either way the by-name pin in pgTAP `410 §8.5` deleted **in the same change**.
- [x] `FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED` 🟡 — a named note where the
      authorizer's consumers are enumerated (the manifest row's qualifier or `backend-state.md`)
      saying `app._audit_access_authorized` is a consumer and deliberately not an enforcement site.
      ⛔ NOT added to `enforcementSites`.
- [x] `FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR` 🟠 (Batch 5, rides along) — §6.2 re-measured at
      **this unit's tip** (a class-wide re-key moves the count again) and rewritten: pre/post state,
      `alter policy` count, `tablename` list and row-count assertion, both halves of each `FOR ALL`;
      the interim banner deleted. §6.1's `can_manage_case_vocabulary` expiry note re-measured.
- [x] Every new check **proven able to fire** on a planted reproducer with the observed exit code and
      output, beside a clean-tree negative control and a discrimination half; the transitive search
      proven by **selection** (the depth-2/3/4 sites it now finds, named, against the depth-1 set).
- [ ] Gate: `npm run lint` 0/0; `typecheck`; `npm run test:db` on a fresh reset (shape must not move
      except where a `410` pin is deleted — state the delta); the four authz arms with domains quoted;
      `SELFTEST=1` (deriver + door harness); the set-valued targeted home; **the diff-scoped sweep,
      both arms, derived over `main...HEAD` with its `SCOPE:` line quoted** — owed because any re-key
      is a migration. ⚠ Until Batch 3 lands, the write-arm case list is checked **by hand** to be
      non-empty before its exit code is read as a pass. **Re-run both arms after the rebase onto
      merged Batch 3**, `SCOPE:` re-quoted; `npm run lint` mid-merge.
- [ ] ADR **0193** (reserved 2026-09-07; 0192 is Batch 3's — renumber inside the rebase stop if either
      moved), `accepted` at the Record step.

## Current state

**Updated:** 2026-09-07

### Objective
Make the enforcement manifest a falsifiable oracle before AE5 copies the per-role template eleven
times: a `hardDenyClasses` arm that can fail, a transitive §6.2, the policy-re-keyed-but-DEFINER-still-
legacy defect resolved across the `_staff_admin_write` class, the two undeclared consumers recorded,
and the rollback runbook re-measured at the tip (Batch 5).

### Done since start
- **All five follow-ups closed**, each on its own quoted condition, rotated to the archive with its
  body (ADR 0185 D5); `FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR` filed (PO ruling Q5).
  ADR **0193** written, `proposed`, amends 0176 + 0178. `hardDenyClasses` is a committed claim with a
  falsifiable `410` §6.2 (transitive set equality, no depth bound); one migration `20261003007350`
  re-keys `public.set_item_validations`; PO rulings Q1/Q3/Q6 applied; ten fire-proofs observed,
  red-first honoured.
- **QA iteration 1 closed all eight findings** (six commits over `7b9b1eb7`; detail + proofs in the
  record): runbook §6 re-measured at the tip (Batch 5) found a sixth stale figure (`a115005b…`
  unreachable by this revert, landing value `c227d64eb11909e94400b7ba6bcaab0b`); the deriver's
  `FINDING (1)` discharged by a real targeted mutation case, COVERED; the findings-baseline merge
  made portable (GNU-only block replaced), `SELFTEST=1` PASS 34/0/0; three text corrections,
  `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` filed (owner lead).
- **The lead's tip gate ran and ruled** (2026-09-07): all four authz arms, `SELFTEST=1` (deriver +
  door harness), the set-valued targeted home, and the diff-scoped sweep both arms all quoted; exit 1
  on the sweep is the FINDING itself, discharged by the targeted case above (ADR 0190). Two lead
  process errors recorded, one filed as `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP`.
- **QA re-review round 2 returned CHANGES REQUESTED** (N-1 blocking, N-2, N-3, N-4, N-REC-1, N-REC-2);
  **iteration 2 closed all six** (four commits over `5a64520f`; detail + proofs in the record): the
  runbook's three remaining `a115005b…` occurrences corrected (5 hits left, all now correct); commit
  counts corrected and made re-derivable (`git rev-list --count main..HEAD`); this hub brought level
  with the record, `reviews:` populated; the merge-scenario comment corrected to 18 with its
  derivation named; the targeted case's COVERED verdict pinned to the exact assertion (test 32,
  § 2.10e, by description text), proven with a real run and a scratch negative control; the merge's
  `diff`-alignment dependency disclosed with a dated qualifier. Gate re-run clean: `lint` 0/0,
  `typecheck`, `test:db` `Files=262, Tests=8882, PASS`, `SELFTEST=1` 34/0/0, targeted case COVERED
  bare rc 0 — no migration/RLS/`src`/`e2e` touched, so the arms and door sweep were not re-run.

### In progress
- Nothing. Iteration 2 is complete and committed on `authz-enforcement-manifest` —
  `git rev-list --count main..HEAD` = **22** as of `926f4066` (before this doc commit); the full
  commit list is in the record.

### Next
- QA re-review round 3 of the six N-findings above, or Record at the lead's discretion. Then PO →
  wait for Batch 3 → rebase, re-run both arms, `npm run lint` mid-merge → Record (ADR 0193 →
  `accepted`).

### Blockers
- None. ⚠ Merge order fixed: **Batch 3 first** — the other way round, its write-path baseline
  measures a `set_item_validations` body that no longer exists.
