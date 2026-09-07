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
times: a `hardDenyClasses` arm that can fail, a transitive §6.2, the policy-re-keyed-but-DEFINER-
still-legacy defect resolved across the whole `_staff_admin_write` class, the two undeclared
consumers recorded, and the rollback runbook re-measured at the tip (Batch 5).

### Done since start
- **All five follow-ups closed**, each audited against its own quoted condition and rotated to the
  archive with its body (ADR 0185 D5); `FUP-AUTHZ-HARDDENY-GATELESS-CLASSES-HAVE-NO-DETECTOR` filed
  (PO ruling Q5). ADR **0193** written, `proposed`, amends 0176 + 0178.
- **`hardDenyClasses` is a committed claim** on the three re-keyed rows (`principal_inactive` ×3,
  `respondent_exclusion` on `org.professionals.read`), and `410` §6.2 is a per-row **set equality**
  against a fixed point over the composed-call closure — no depth bound, seeded from the sites AND
  the authorizer. §6.2b plants a class on a synthetic root (it also proves transitivity: 2 hops);
  §6.2c makes two real rows differ. M7 gained three arms that fail on the empty case.
- **One migration, `20261003007350`**: `public.set_item_validations` re-keyed onto
  `app.can_edit_commission_forms`, body regenerated from live `pg_get_functiondef`, one line changed.
  It is the ONLY `_staff_admin_write` member in the tree whose policy is wholly unreachable, so the
  permission was inert for that table. The other 7 of 8 form DEFINER writers are **declared, not
  re-keyed** (`definerSurface`, +M13, +`410` §8.7 both directions) and stay AE5's.
- **PO rulings applied**: Q1 — `app.current_professional_read_organizations` DECLARED a site (§8.5's
  element flips to `[declared site]`, §8.6 → `13 / 8 / 4`; ⛔ **no pin was deleted**, `plan()` does
  not fall by one on that account). Q3 — `nonEnforcementConsumers` + `410` §8.8's consumer partition.
  Q6 — matrix row 1's cell edited, before/after quoted in the record.
- **Runbook §6 re-measured at the tip** (Batch 5, all eight items). Four stale figures, not three;
  §6.1's `commission_of_version` live twin measured **dead**; a seventh revert artifact that is not
  a policy.
- **Ten fire-proofs observed** (D1–D10 + the two §8.8 halves), every plant in a container-side copy
  or a fake tree, every restore believed on the md5 and on `--check` exit 0 at sha `493370f994a5`.
  Red-first honoured: `409` §2.10c and §2.10e were observed RED on the un-migrated catalog.

### In progress
- Nothing. The build is complete and committed on `authz-enforcement-manifest` (7 commits).

### Next
- Lead runs the tip gate (§E): the four authz arms with domains quoted, `SELFTEST=1` deriver + door
  harness, the set-valued targeted home, and **the diff-scoped sweep both arms** with its `SCOPE:`
  line quoted — owed because this batch ships a migration. ⚠ The write arm's empty-set trap is open
  until Batch 3 lands: print the case list and check by hand that it is non-empty.
- Then QA → PO → wait for Batch 3 to merge → rebase, re-run both arms, `npm run lint` mid-merge →
  Record (ADR 0193 → `accepted`, removed from `proposed-review.json`).

### Blockers
- None. ⚠ Merge order fixed: **Batch 3 first** — merged the other way, its write-path baseline
  measures a `set_item_validations` body that no longer exists.
