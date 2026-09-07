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

- [ ] `FUP-AE4-HARDDENY-CLASSES-CANNOT-FAIL` 🟠 — remediation (b), **one change**: `hardDenyClasses`
      populated from the catalog OR the M7 loop replaced by an assertion that fails on the empty
      case; **plus** a §6.2 discrimination control anchored on a class known present; **plus** §6.2's
      search transitive over the composed-call closure, comment-stripped. ⛔ Not "one hop" (measured
      depths 2, 3, 4). ⛔ Not closed by (a), the 2026-09-03 disclosure, which is already on `main`.
- [ ] `FUP-VALIDATIONS-WRITE-PATH-IS-LAYER-1` 🟠 — `public.set_item_validations` re-keyed onto the
      permission OR the split recorded deliberately (policy as backstop, DEFINER as the enforcement
      site) in the manifest row. ⛔ Pointing at the re-keyed policy does not close it. **The whole
      `_staff_admin_write` class enumerated** from the live catalog — every policy of that shape and
      every DEFINER writer behind it — and each member dispositioned the same way, so the template
      AE5 copies has no second instance of this defect.
- [ ] `FUP-READ-ORGANIZATIONS-LITERAL-IN-NO-MANIFEST-ROW` 🟡 — **PO ruling**: the function added to
      the `org.professionals.read` row's `enforcementSites` OR a reviewed exclusion recorded in the
      manifest; either way the by-name pin in pgTAP `410 §8.5` deleted **in the same change**.
- [ ] `FUP-AUDIT-REGISTRY-CONSUMER-OF-READ-AUTHORIZER-UNRECORDED` 🟡 — a named note where the
      authorizer's consumers are enumerated (the manifest row's qualifier or `backend-state.md`)
      saying `app._audit_access_authorized` is a consumer and deliberately not an enforcement site.
      ⛔ NOT added to `enforcementSites`.
- [ ] `FUP-AE4-ROLLBACK-RUNBOOK-SIX-SCOPED-TO-FOUR` 🟠 (Batch 5, rides along) — §6.2 re-measured at
      **this unit's tip** (a class-wide re-key moves the count again) and rewritten: pre/post state,
      `alter policy` count, `tablename` list and row-count assertion, both halves of each `FOR ALL`;
      the interim banner deleted. §6.1's `can_manage_case_vocabulary` expiry note re-measured.
- [ ] Every new check **proven able to fire** on a planted reproducer with the observed exit code and
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
- Branch `authz-enforcement-manifest` cut off `main` @ `23ec1fa5`; hub + record opened on the
  second machine (macOS; local stack `azkbbhskturikxpgmafq` up).

### In progress
- `backend` briefed; full plan required before any change — a re-key is a migration and the
  manifest decides what the site-axis arm measures.

### Next
- Plan review → PO ruling on the read-organizations row (before the build; it changes the manifest
  diff) → build with fire-proofs → gate incl. diff-scoped sweep both arms → QA → PO → wait for Batch
  3 to merge → rebase, re-run both arms → Record.

### Blockers
- None. ⚠ Merge order fixed: Batch 3 first. The write arm's empty-set trap is open until then.
