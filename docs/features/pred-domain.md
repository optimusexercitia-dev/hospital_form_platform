---
id: PRED-DOMAIN
title: Door-audit domain — the authz resolvers enter PRED_DOMAIN (or a scheduled targeted-case home), the read arm stops mirror-ambiguous, and the findings baseline is re-earned through the merge (pre-AE5 Batch 2)
status: complete
kind: feature
program: AUTHZ
phase: "Pre-AE5 remediation — Batch 2 of the follow-up batches ruled 2026-09-04"
branch: ~   # landed on main 2026-09-07; PO approved at 2a779bd8 on the QA re-review, ff-merged
plan: ../plans/pre-ae5-remediation.md
progress: ../progress/pred-domain.md
reviews: ["../reviews/pred-domain-rereview.md", "../reviews/pred-domain-review.md"]
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
