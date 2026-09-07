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
adrs: ["0079", "0153", "0173", "0182", "0184", "0187", "0190", "0191"]
handoff: ~
fup: ~
---

# PRED-DOMAIN — the door-audit arm's domain

## Acceptance criteria

The unit closes **five** open follow-ups in `docs/followups/follow-ups-open.md`, each on its own
`Closes when` clause — quoted there, not paraphrased here. Nothing else counts as closure. The
subject is `supabase/tests/mutation/p0-authz-door-audit.sh`'s `PRED_DOMAIN` (which Batch 1's
deriver now **lifts**, so a widening here needs no deriver change) and its read arm.

- [x] `FUP-DOOR-SWEEP-DOMAIN-MISSES-THE-AUTHZ-RESOLVERS` 🟠 **+**
      `FUP-DOOR-SWEEP-DOMAIN-GAP-WIDENED-BY-SET-VALUED-RESOLVERS` 🟠 — **one apparatus gap, two
      symptoms, resolved together**: either `PRED_DOMAIN` is widened along the schema axis (a
      `prosecdef` boolean in `authz` is in domain by its schema) **and** the return-type axis (a
      `prosecdef` scope-id-set resolver consumed by a policy is in domain regardless of `typname`)
      with the findings file re-baselined because `PRED_TOTAL` moves; **or** the resolver family is
      ruled swept by **targeted** cases with a **committed, scheduled home**. Either way
      `authz.candidate_has_permission` owes a **first** verdict, and `app.current_professional_read_organizations`
      (Batch 1's `9a4bbd22` door) owes its targeted case. ⛔ Not closed by the one-off hand-run
      verdicts of 2026-09-02/03, nor by a green from any arm whose domain excludes the population.
- [x] `FUP-DOOR-AUDIT-ALL-POLICY-COVERED-IS-MIRROR-AMBIGUOUS` 🟡 — the read arm opens `using` and
      `with check` **separately** on a `FOR ALL` policy, or every verdict records which half the
      keystone exercised. ⛔ Not closed by the write arm's earlier fix.
- [x] `FUP-DOOR-SWEEP-BROAD-GATE-ABORTS-A-FILE` 🟡 — ruled and built: (a) bespoke neutralization per
      aborting case, or (b) a fourth classifier outcome for "shape moved AND the suite went FAIL"
      that **never collapses into COVERED**. Proven on `app.event_current_custodian` / `140` test 11.
- [x] `FUP-C2-TIER1-TRIGGER-ENFORCERS-OUT-OF-SWEEP-DOMAIN` 🟠 — the sweep's **domain statement**
      names trigger enforcers as out of domain (or attributes trigger enforcement to the doors that
      reach the table), so a trigger-caused BLIND is distinguishable from an absent-assertion BLIND.
      ⛔ Not an allowlist entry.
- [x] **The findings baseline re-earned through the merge** — the first real full door-arm run since
      ADR 0190: detached, crash-safe (Batch 0), hand-authored material preserved (Batch 1), the
      `CARRIED` block (bound **2 ≤ n ≤ 26** hand rows) re-filed by hand and each re-filing
      justified; the four authz arms' figures re-derived at the new `PRED_TOTAL`.
- [x] Every widened selection proven to **select** what it claims (ADR 0173 §4: selection is the
      success criterion, a passing sweep is not) and every new classifier outcome **proven able to
      fire**, each with a clean negative control. `act-hat-blind-sweep.sh:18`'s stale domain
      sentence ("app+public" vs the executed `('app','public','authz')`) corrected.
- [x] Gate: `npm run lint` green; `npm run test:db` on a fresh reset green; the four authz arms hold
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
- Schema axis proven by SELECTION (`PRED_TOTAL` 125→**127**, `PRED_OUT` 37→**35**, delta = exactly
  the two resolvers, reverse delta 0); `NOTICED`; `using`-only mirror; `DOMAIN-STATEMENT`; the
  targeted home with all three set-valued resolvers' FIRST recorded verdicts.
- Run 1 voided by tail drift; ADR 0189 D6's reset design ported (ADR 0191 D8). ⭐ **RUN 2 LANDED** —
  353 cases / 14 h 53 m, `SWEPT 353 · COVERED 294 · BLIND 36 · NOTICED 23 · ERROR 0`, `resets=40`
  = 17 scheduled + 23 retries; **all 23 NOTICED retried and all 23 reproduced**.
- ⭐ **RE-BASELINE COMMITTED** (`b59d4bbf`). The 275 CARRIED rows dispositioned **by script** off
  the PO-carried table (join 1:1 on key + both verdicts + a hand flag RECOMPUTED from column 5,
  agreeing 31/31): **242** deleted/retired · **15** hand notes re-attached byte-for-byte · **15**
  archived verbatim into the record · **3** re-filed as rows. **31 hand rows in → 31 preserved.**
- ⭐ **The NOTICED ruling is encoded WHERE THE RESULT LINE IS COMPUTED**, not only in prose: the
  exit chain extracted into `emit_result()`, classes printed separately, and 0 BLIND ∧ 0 ERROR ∧
  >0 NOTICED now exits **0 with the disclosure**; a mutant restoring it reds exactly the two rows.
- **Five follow-ups CLOSED** clause by clause and rotated to the archive (426/426 prose lines,
  9/9 blocks, 7/7 notes, 11 suffixes, 275 rows verified).
- **QA reviewed at `6f94a634`: CHANGES REQUESTED** — 3 blocking + 9 major, **all text**, nine of
  eleven questions clean; nothing touching RLS, a migration or `src/`.

### In progress
- **QA fix loop, iteration 1 of ≤5 — all twelve findings addressed by RE-MEASUREMENT**, never by
  re-wording: the three set-valued verdicts filed as census-readable rows (`verdicts_from_findings`
  356→**359**, unique) and the backlog entry deleted in the same commit; the `DOMAIN-STATEMENT`'s
  false witness replaced with a dated, true one and its provenance labelled per figure; ADR 0187
  D1's sentence now byte-exact, asserted offline against the ADR (door `SELFTEST` **20→23/23**).
- **Gate re-run bare after the loop**: `lint` **0** (ratchets unmoved) · `lint:adr-index` **0** ·
  deriver `SELFTEST` **34/0** · door `SELFTEST` **23/23** · merge-helper `SELFTEST` **34/0** ·
  `git diff --name-only main... -- supabase/migrations supabase/seed.sql src` **EMPTY**. No `.sql`
  and no neutralization logic changed, so no fresh reset is owed.
- ⛔ **The four §6 arms are NOT re-run by the builder** — QA asked a second party do it
  (could-not-verify #1): the lead runs `census`, `hat`, `floor`, `FROMFINDINGS=1 wrapper` at the tip.

### Next
- **QA re-review → PO approval → Record** (lead-playbook §§4–5). ⚠ At the Record step, close
  `FUP-AUTHZ-SETVALUED-TARGETED-HOME-HAS-NO-SCHEDULE`: the lead landed both §4 lines at
  `376d5717`, which satisfies its close condition (QA F-REC-9).

### Blockers
- **None blocking, one disclosure CORRECTED and now larger than it read.** `FROMFINDINGS=1
  ARM=policy` is RED — **already red at `main`** (16 offenders); the re-baseline moves it to 24,
  +11 being exactly the mirror flips work-listed in `FUP-AUTHZ-FOR-ALL-READ-HALF-BLINDS` and −3
  subjects that no longer exist. ⛔ **The earlier "0 false offenders today" was FALSE: RE-MEASURED
  2026-09-07, 12 of the 24 are section-stale rows carrying COVERED in column 4** (each BLIND at
  `main` → COVERED at HEAD, each absent from the allowlist), because `blind_from_findings` reads a
  row's SECTION, not column 4 — 74 door BLINDs counted where the run measured 36. So the
  stale-finding generator is already generating, and **that arm's red is not readable** until
  `FUP-AUTHZ-BLIND-SET-READ-FROM-THE-SECTION-NOT-THE-VERDICT` (re-rated **high**) is fixed. It is
  NOT one of §6's four arms, no flipped row was relabelled, and ⛔ the twelve must not be
  allowlisted. All 12 are enumerated in the record.
