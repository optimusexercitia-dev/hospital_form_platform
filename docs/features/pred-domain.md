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

**Updated:** 2026-09-07

### Objective
Close the door-audit arm's measurement-domain gaps — the `authz.*` boolean resolvers excluded by
name, the `SETOF uuid` scope resolvers excluded by return type, the `FOR ALL` mirror ambiguity, the
abort-on-broad-gate ceiling, and the unstated trigger-enforcer bound — and re-earn the committed
findings baseline through Batch 1's merge, before AE5's eleven increments re-key onto exactly
these resolvers.

### Done since start
- Plan APPROVED with five rulings; §1 re-measured on a fresh reset — **every figure reproduced**.
- **Schema axis** proven by SELECTION: `PRED_TOTAL` 125→**127**, `PRED_OUT` 37→**35**, delta =
  exactly the two resolvers, **reverse delta 0**; deriver lift survives (**34/0**).
- **`NOTICED`** built and proven able to fire; **`using`-only mirror**; **`DOMAIN-STATEMENT`**
  (trigger enforcers 174/268); **targeted home** — all 3 set-valued resolvers COVERED, first
  recorded verdicts, §4a residue arm 0-on-clean and proven to FIRE on a live mutation.
- **Run 1 voided by tail drift (proven, no originating case)**; ADR 0189 D6's reset design
  **ported** (ADR 0191 D8) with `RESET_EVERY`, interlock-first reset, retry-once on `SHAPE_MOVED`,
  and the OID re-resolved from IDENTITY per case.
- ⭐ **RUN 2 LANDED AND IS VERIFIED** — 14 h 53 m, `FULLRUN_BARE_RC=1` (DIRTY: BLIND blocks),
  `SWEPT 353 · COVERED 294 · BLIND 36 · NOTICED 23 · ERROR 0`, `resets=40 (RESET_EVERY=20)` =
  17 scheduled + 23 retries. Stack ENUMERATED clean (0 degenerate non-`SELECT` policies, 0 bodies
  across all four forms, 0 §4a residue, no sentinel); merge verified three ways (`MERGE_VERIFY`
  bare rc 0, 9/9 hand blocks, 7/7 notes, `MERGE ABORTED` count 0). ADR **0191**, 5 follow-ups.

### In progress
- ⭐ **Run 2 has NO void tail**, measured three ways: 23 of 353 rows carry an off-baseline shape
  (330 at `Files=262, Tests=8876`), over **16** distinct `Tests=` values, longest repeat **2**, last
  at ordinal **264** with 89 clean cases after. Run 1 ended in 78 consecutive rows at one value.
- ⭐ **84 keys differ run 1 → run 2, ALL in one direction**: NOTICED→COVERED 61, NOTICED→BLIND 18,
  ERROR→COVERED 5. **Zero run-1 COVERED or BLIND rows moved.** The void tail's 79 rows now read
  61 COVERED + 18 BLIND + **0 NOTICED**.
- ⭐ **PO Q1 SETTLED: the flip count is ELEVEN** (5 CAPA + 6 `rca_*_write`), inside the stated bound
  5 ≤ n ≤ 21. **Zero non-`(ALL)` flips over all 353 cases**, and all 36 BLIND rows are either
  baseline-BLIND (25) or one of the 11 — **no coverage loss outside the mirror fix**. Of the 16
  stranded `(ALL)` rows, exactly the 6 RCA flipped; the other 10 came back COVERED.
- ⭐ **NOTICED attribution INVERTS run 1's reading**: **zero** of the 23 abort in an authz meta-test.
  Each aborts a *domain* file (15 distinct signatures, largest group 4), all at `Files=262` with
  only `Tests=` moving (−8…−207) — the LEARN-083 value-assertion shape, not a generic detector.
  All 23 were reset-and-retried and **all 23 reproduced**. ⚠ 19/23 have an authz-shaped file
  reddening outside the aborting one: a NAME-shaped signal, offered as input, **not a verdict**.
- **CARRIED = 275** (run 1's 318 superseded): 244 mechanical, **31 hand-prose**. 48 absent rows
  resolved against the LIVE catalog and the parts sum; that 45-key set is byte-identical to run 1's,
  so the **3 census-mandatory re-files stand** (`storage_upload_reserved`,
  `commission_cadence_overview`, `document_delete_affordances`).

### Next
- ⛔ **PO rulings owed: Q2 (the 275 CARRIED, 31 of them human) and the NOTICED class.** Both
  enumerations are in the record; nothing has been re-filed.
- Then, in ONE commit: apply the dispositions → commit `docs/reviews/authz-door-audit-findings.md`
  → delete `authz-unswept-backlog.txt:806` and `:863` (drafted, not applied).
- Then step 11 (four arms, `test:db`, deriver + `SCOPE:`), then the closures.

### Blockers
- ⛔ `docs/reviews/authz-door-audit-findings.md` is **uncommitted by design** and is the only path
  the run changed. Step 11 is blocked on it: `FROMFINDINGS=1` and `ARM=census` both read it, so
  running them now would measure the OLD baseline against the NEW domain.
- ⚠ The lead is working this tree concurrently; commits from both sides landed this week.
