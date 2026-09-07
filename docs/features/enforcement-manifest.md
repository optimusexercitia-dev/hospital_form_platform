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
reviews: []
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
- **All five follow-ups closed**, each on its own quoted condition and rotated to the archive with
  its body (ADR 0185 D5); `FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR` filed (PO ruling
  Q5). ADR **0193** written, `proposed`, amends 0176 + 0178.
- **`hardDenyClasses` is a committed claim** on the three re-keyed rows, and `410` §6.2 is a per-row
  **set equality** against a fixed point over the composed-call closure — no depth bound, seeded from
  the sites AND the authorizer. §6.2b plants a class on a synthetic root (transitive: 2 hops); §6.2c
  makes two real rows differ. M7 gained three arms that fail on the empty case.
- **One migration, `20261003007350`**: `public.set_item_validations` re-keyed onto
  `app.can_edit_commission_forms`, body regenerated from live `pg_get_functiondef`, one line changed.
  The other 7 of 8 form DEFINER writers are **declared, not re-keyed** (`definerSurface`, +M13,
  +`410` §8.7 both directions) and stay AE5's.
- **PO rulings applied**: Q1 — `app.current_professional_read_organizations` DECLARED a site (§8.6 →
  `13 / 8 / 4`; ⛔ **no pin was deleted**); Q3 — `nonEnforcementConsumers` + §8.8's consumer partition;
  Q6 — matrix row 1's cell edited, before/after quoted in the record. **Ten fire-proofs observed**
  (D1–D10 + the two §8.8 halves), every plant in a container-side copy or a fake tree; red-first
  honoured — `409` §2.10c/§2.10e observed RED on the un-migrated catalog.
- **QA returned CHANGES REQUESTED (2026-09-07); iteration 1 closed all eight** (5 commits over
  `7b9b1eb7`; detail + observed proofs in the record):
  - **Runbook §6 re-measured at the tip** (Batch 5, all eight items). **Five** stale figures, not four
    — §6.7 step 4 was the fifth, and re-measuring it found a **sixth** nobody had counted: its `EXPECT
    after the revert` constant `a115005b…` is **no longer reachable by this revert** (`20261003007320`
    moved `professional_profiles_select` inside the same 99-policy aggregate). Post-revert value
    **`c227d64eb11909e94400b7ba6bcaab0b`**, by inversion in a rolled-back transaction; step 4 now
    carries all four landing values.
  - **The deriver's `FINDING (1)` is discharged by a real targeted mutation case**, not by `409`:
    `supabase/tests/mutation/authz-command-door-targeted-cases.sh`, **COVERED**, bare rc 0 on its
    first run (gate neutralized → `409` RED → md5-verified restore → `409` GREEN). C2's neutralizer
    was tried first and **measured** unable to take the door (`c2n.tier1 = 0`; rc 2, "swept 0 of
    171"). `409` §2.6f/§2.10e is named beside it as a **different** instrument.
  - **The findings-baseline merge is portable**: the GNU-only `diff --*-group-format` block is gone
    and `SELFTEST=1 bash scripts/door-sweep-cases.sh` is **PASS 34 · FAIL 0 · SKIPPED 0**, rc 0, on this
    Mac (was 17/17) — equivalence proven on the 18 merge scenarios and on all four **real** committed
    findings baselines, byte-identical; none changed.
  - Three text corrections (a migration id read as a date; §8.8's 12-of-13 + LEARN-079; the call-edge
    query beside its figure, **re-measured — 2564 / 867 exactly**), the two ⚠ recommendations, and
    `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` 🟠 **filed, not fixed** (owner lead).

### In progress
- Nothing. Iteration 1 is complete and committed on `authz-enforcement-manifest` (16 over `main`).

### Next
- **QA re-review** of the eight findings, then the lead's tip gate (§E): the four authz arms with
  domains quoted, `SELFTEST=1` deriver + door harness, the set-valued targeted home, and **the
  diff-scoped sweep both arms** — whose `SCOPE:` **and** `RESULT: FINDING (1)` lines are quoted in the
  gate record, with the targeted case above named as the discharge (ADR 0190). Then PO → wait for
  Batch 3 → rebase, re-run both arms, `npm run lint` mid-merge → Record (ADR 0193 → `accepted`).

### Blockers
- None. ⚠ Merge order fixed: **Batch 3 first** — the other way round, its write-path baseline measures a `set_item_validations` body that no longer exists.
