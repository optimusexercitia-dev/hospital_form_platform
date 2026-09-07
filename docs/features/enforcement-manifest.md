---
id: ENFORCEMENT-MANIFEST
title: Enforcement manifest — hardDenyClasses made falsifiable, the template's re-key defect (policy re-keyed, DEFINER writer left on layer 1) resolved across the `_staff_admin_write` class, the two undeclared consumers recorded, and the rollback runbook re-measured (pre-AE5 Batch 4, Batch 5 riding along)
status: gated
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 4 of the follow-up batches ruled 2026-09-04 (runs on the second machine, in parallel with Batch 3; merge order Batch 3 first)"
branch: authz-enforcement-manifest
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/enforcement-manifest.md
reviews: ["../reviews/enforcement-manifest-rereview-2.md", "../reviews/enforcement-manifest-rereview.md", "../reviews/enforcement-manifest-review.md"]
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
still-legacy defect resolved across the `_staff_admin_write` class, the two undeclared consumers
recorded, and the rollback runbook re-measured at the tip (Batch 5).

### Done since start
- **PO-approved 2026-09-07 at `dab3cc87`** (24 commits over `main` @ `23ec1fa5`, measured by
  `git rev-list --count main..HEAD`) on QA round 3 **APPROVED** — after round 1 (2 BLOCK) and round 2
  (1 BLOCK), every fix re-derived by QA by measurement. ADR **0193** → `accepted`, off the
  proposed-review list. All five follow-ups closed on their own quoted clause; two filed.
- Built: `hardDenyClasses` a committed claim, `410` §6.2 a transitive set equality with planted +
  natural controls; one migration `20261003007350` re-keys `public.set_item_validations`; seven
  DEFINER splits declared in `definerSurface`; `current_professional_read_organizations` declared a
  site; `_audit_access_authorized` a declared non-enforcement consumer with a partition arm; the
  rollback runbook §6 rewritten for six policies + the DEFINER door (six stale figures re-measured);
  the findings-baseline merge made portable; a targeted command-door case home.
- Lead's tip gate (record): lint 0/0 · pgTAP 262/8882 PASS on fresh resets · census 581/604 HOLD ·
  hat · floor · wrapper 41 HOLD · deriver SELFTEST 34/0 · door SELFTEST 23/23 · set-valued 3/3 CLEAN ·
  diff-scoped deriver `SCOPE:` quoted, exit 1 FINDING discharged by the targeted case (COVERED).

### In progress
- Nothing on this branch. **Waiting for Batch 3** (`authz-writepath-baseline`, other machine) to
  merge into `main` first — ruled order; the other way round Batch 3's baseline measures a
  `set_item_validations` body that no longer exists.

### Next
- **Merge session** (lead, after Batch 3 is on `main`): rebase `authz-enforcement-manifest` onto
  `main` · renumber ADR 0193 only if 0192 moved · `npm run adr:index` + `features:index` (never
  hand-merge the indexes) · `npm run lint` MID-merge · fresh reset + `test:db` · **re-run the
  diff-scoped deriver over `main` and BOTH arms** — read the deriver's bare exit BEFORE substituting
  `CASES=` (exit 1 ⇒ the targeted case, never a sweep) — `SCOPE:` re-quoted, write-arm verdict landing
  in Batch 3's re-baselined findings file · ledger row · hub → `complete` with this block cut into the
  record · `phase(ENFORCEMENT-MANIFEST): complete` · `git merge --ff-only` · branch deleted.

### Blockers
- Batch 3 not yet merged (this clone has no `authz-writepath-baseline`). Nothing else.
