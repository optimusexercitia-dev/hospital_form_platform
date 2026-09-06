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
- Plan APPROVED with five rulings; §1 re-measured on a fresh reset — **every figure reproduced**.
- **Schema axis**: `PRED_DOMAIN` gains a literal `n.nspname='authz'` bounded at `bool`. Proven by
  SELECTION: 125→**127**, `PRED_OUT` 37→**35**, delta = exactly the two resolvers, **reverse delta
  0**, policy worklist byte-identical; deriver lift survives (**34/0**).
- **`authz.candidate_has_permission` has a FIRST verdict — COVERED**; `scope_reaches` COVERED from
  an arm rather than a hand run.
- **`NOTICED`** built; SELFTEST 6/6 with the instrument proven able to fail and the pre-change
  classifier run over the identical strings; fired live on the same runlog (ERROR → NOTICED).
- **`using`-only mirror** (all 62 ALL policies carry a non-null `polwithcheck`, so not vacuous);
  **`DOMAIN-STATEMENT`** with trigger enforcers derived (174/268).
- **Targeted home** — all 3 set-valued resolvers **COVERED**, first recorded verdicts; §4a residue
  arm 0-on-clean and proven to FIRE on each live mutation; §4b cardinality control green.
- ADR **0191** (proposed), 4 follow-ups, `act-hat-blind-sweep.sh:18`; gate all bare rc 0
  (`npm run lint`, door SELFTEST 6/6, deriver 34/0, typecheck); five commits.

### In progress
- **STOPPED for the PO's Q2 ruling on CARRIED.** The full run LANDED: 12 h 17 m, 353 cases,
  **228 COVERED / 18 BLIND / 102 NOTICED / 5 ERROR**, bare rc 1 (DIRTY). Merge verified three ways
  (rc; `MERGE_VERIFY` rc 0 holding 426 prose lines + 10 suffixes + 318 carried rows; 9/9 hand
  blocks, 7/7 notes, `git diff --stat` 1666/375). Stack left clean, enumerated.
- ⭐ **PO Q1 answered: exactly 5 flips**, all `(ALL)`, all CAPA `_write`, all covered by
  `252_authz_p0_isolation.sql` — and **zero SELECT rows flipped**, the discrimination the subset
  could not give. Filed with per-policy keystone specs.
- ⭐ **Headline: 102 NOTICED** (vs 1 predicted) — 107/353 gates carry no usable verdict. Measured
  cause: ~9 files abort together, three of them the authz meta-tests themselves. The old classifier
  would have called all 107 `ERROR` against a baseline recording 29, taken at half this suite.
- ⛔ **An external revert** returned the findings file to the pre-run baseline at 08:17; cause
  undetermined. It cost nothing — re-merging from `$WORK` reproduces the run **byte-for-byte**.

### Next
- PO rules on CARRIED (318 rows, **only 32 are human decisions**; 3 MUST be re-filed or step 11's
  `ARM=census` reds) → then commit the re-baseline + backlog lines + stale heading together →
  then step 11 (four arms at `WORK=/tmp/pd-full`, `test:db`, diff-scoped deriver) and the closures.
- ⚠ The **102 NOTICED** need their own ruling; they are not this unit's five follow-ups.

### Blockers
- ⛔ The re-baselined findings file is **NOT committed** and must not be until the Q2 ruling. It is
  reproducible from `$WORK` at any time (`555b058d405890c47b0b65754ca5379a`, 2215 lines).
- ⚠ Another session appears to share this stack: something reverted the findings file mid-analysis.
