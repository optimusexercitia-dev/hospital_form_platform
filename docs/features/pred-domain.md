---
id: PRED-DOMAIN
title: Door-audit domain — the authz resolvers enter PRED_DOMAIN (or a scheduled targeted-case home), the read arm stops mirror-ambiguous, and the findings baseline is re-earned through the merge (pre-AE5 Batch 2)
status: in_progress
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 2 of the follow-up batches ruled 2026-09-04"
branch: authz-pred-domain
plan: ~
progress: ../progress/pred-domain.md
reviews: []
adrs: ["0079", "0153", "0173", "0182", "0184", "0187", "0190"]
handoff: ~
fup: ~
---

# PRED-DOMAIN — the door-audit arm's domain

## Acceptance criteria

The unit closes **five** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure. The
subject is `supabase/tests/mutation/p0-authz-door-audit.sh`'s `PRED_DOMAIN` (which Batch 1's
deriver now **lifts**, so a widening here needs no deriver change) and its read arm.

- [ ] `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` 🟠 **+**
      `FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS` 🟠 — **one apparatus gap, two
      symptoms, resolved together**: either `PRED_DOMAIN` is widened along the schema axis (a
      `prosecdef` boolean in `authz` is in domain by its schema) **and** the return-type axis (a
      `prosecdef` scope-id-set resolver consumed by a policy is in domain regardless of `typname`)
      with the findings file re-baselined because `PRED_TOTAL` moves; **or** the resolver family is
      ruled swept by **targeted** cases with a **committed, scheduled home**. Either way
      `authz.candidate_has_permission` owes a **first** verdict, and `app.current_professional_read_organizations`
      (Batch 1's `9a4bbd22` door) owes its targeted case. ⛔ Not closed by the one-off hand-run
      verdicts of 2026-09-02/03, nor by a green from any arm whose domain excludes the population.
- [ ] `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` 🟡 — the read arm opens `using` and
      `with check` **separately** on a `FOR ALL` policy, or every verdict records which half the
      keystone exercised. ⛔ Not closed by the write arm's earlier fix.
- [ ] `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` 🟡 — ruled and built: (a) bespoke neutralization per
      aborting case, or (b) a fourth classifier outcome for "shape moved AND the suite went FAIL"
      that **never collapses into COVERED**. Proven on `app.event_current_custodian` / `140` test 11.
- [ ] `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` 🟠 — the sweep's **domain statement**
      names trigger enforcers as out of domain (or attributes trigger enforcement to the doors that
      reach the table), so a trigger-caused BLIND is distinguishable from an absent-assertion BLIND.
      ⛔ Not an allowlist entry.
- [ ] **The findings baseline re-earned through the merge** — the first real full door-arm run since
      ADR 0190: detached, crash-safe (Batch 0), hand-authored material preserved (Batch 1), the
      `CARRIED` block (bound **2 ≤ n ≤ 26** hand rows) re-filed by hand and each re-filing
      justified; the four authz arms' figures re-derived at the new `PRED_TOTAL`.
- [ ] Every widened selection proven to **select** what it claims (ADR 0173 §4: selection is the
      success criterion, a passing sweep is not) and every new classifier outcome **proven able to
      fire**, each with a clean negative control. `act-hat-blind-sweep.sh:18`'s stale domain
      sentence ("app+public" vs the executed `('app','public','authz')`) corrected.
- [ ] Gate: `npm run lint` green; `npm run test:db` on a fresh reset green; the four authz arms hold
      at the re-baselined figures; `SELFTEST=1 bash scripts/door-sweep-cases.sh` 34/0; the
      diff-scoped door sweep derived by the Batch 1 deriver with its `SCOPE:` line quoted — and
      **owed, both arms, if any policy or `prosecdef` gate changed** (a `PRED_DOMAIN` widening is a
      harness change, not a gate change — state which).

## Current state

**Updated:** 2026-09-05

### Objective
Close the door-audit arm's measurement-domain gaps — the `authz.*` boolean resolvers excluded by
name, the `SETOF uuid` scope resolvers excluded by return type, the `FOR ALL` mirror ambiguity, the
abort-on-broad-gate ceiling, and the unstated trigger-enforcer bound — and re-earn the committed
findings baseline through Batch 1's merge, before AE5's eleven increments re-key onto exactly
these resolvers.

### Done since start
- Plan APPROVED with five rulings. §1 re-measured on a fresh reset: **every figure reproduced**.
- **Schema axis** — `PRED_DOMAIN` gains a literal `n.nspname='authz'`, bounded at `bool`. Proven by
  SELECTION: `PRED_TOTAL` 125→**127**, `PRED_OUT` 37→**35**, delta = exactly the two named
  resolvers, **reverse delta 0**, policy worklist byte-identical. Deriver lift survives (**34/0**).
- **`authz.candidate_has_permission` earns its FIRST verdict — COVERED**; `scope_reaches` COVERED
  from an arm rather than a hand run (`predicate=2/127`, rc 0 CLEAN).
- **`NOTICED`** (4th outcome) built + SELFTEST arm 6/6, with the instrument proven able to fail and
  the pre-change classifier run over the identical strings; fired live on
  `app.event_current_custodian` (ERROR → NOTICED on the **same** 26 360-line runlog).
- **`using`-half-only mirror** built (all 62 ALL policies verified to carry a non-null
  `polwithcheck`, so the split is not vacuous). Direction column deferred per Q5.
- **`DOMAIN-STATEMENT`** printed every run + emitted into the findings; four populations, trigger
  enforcers **derived** (174/268).
- **Targeted home** `authz-setvalued-targeted-cases.sh` — all three resolvers **COVERED**, first
  recorded verdicts; §4a residue arm 0-on-clean and proven to FIRE on each live mutation; §4b
  cardinality control green. Three failed neutralizers were recorded, restored and catalog-verified.
- Residual §7 items FILED (3 new follow-ups); `act-hat-blind-sweep.sh:18` corrected; ADR **0191**
  drafted (`proposed`).
- ⭐ **Offline dry run of the full-run merge**: rc 0, ~5 s, 9/9 hand blocks + 7/7 notes preserved,
  prose cost exactly **1** duplicated heading, **predicted CARRIED 48 rows / 45 keys** partitioned
  A=4 / B=24 / C=17 against the live catalog.

- **Mirror discrimination**: 12/12 verdicts identical before/after — **no SELECT row moved**
  (the required property) and **no ALL row flipped either**, so the subset proves SAFETY, not
  firing. The change was proven to FIRE by a catalog positive control instead: `true || true`
  under the old version vs `true || <original predicate>` under the new one.
- Gate at the boundary: `npm run lint` **0**, door SELFTEST **6/6 rc 0**, deriver SELFTEST
  **34/0 rc 0**, `typecheck` **0**; ratchets not raised. Three commits, tree clean.

### In progress
- **The ONE full door-arm run, launched 19:54 and verified under way** (`predicate=127/127
  policy=226/226`, baseline `Files=262, Tests=8876, PASS`, reset rc 0). Measured ~2 min/case
  ⇒ **~11.8 h remaining**, ETA ≈ 07:45 on 2026-09-06.

### Next
- Read the run's BARE exit code → verify the merge three ways → diff the real CARRIED block
  against the **predicted 48** → **return the enumeration and STOP** for the PO's Q2 ruling →
  then step 11 and the closures.

### Blockers
- None. ⛔ This session STOPPED at the step-8 commit boundary with step 9 in flight (the brief's
  named fallback). ⛔ The re-baselined findings file is NOT committed until the CARRIED ruling;
  the committed baseline is byte-unchanged (`2ef469cabceff65e3f291e2a3054972f`).
- ⚠ Three keys would leave `ARM=census` UNACCOUNTED if the re-baseline were committed as-is —
  a re-filing obligation, measured at step 8, not a defect.
