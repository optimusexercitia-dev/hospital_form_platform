---
id: AE5-MATRIX-ARM3-CELLS
title: "Arm-3 divergent cells enumerated — discharging ADR 0175 D3's forward promise, which is WORK and not a decision: 216 candidate rows carry zero divergence labels"
status: planned
kind: feature
program: AUTHZ
phase: "Named at pre-AE5 Batch 9 by PO ruling R9 — due before AE5 increment 1 runs its MATRIX, not before its TEMPLATE is written"
branch: ~
plan: ../plans/authz-evolution.md
progress: ~
reviews: []
adrs: ["0175", "0176", "0191"]   # 0201 added at Batch 9's Record step, once that file exists (gate 13 reds on an ADR with no file)
handoff: ~
fup: ~
---

# AE5-MATRIX-ARM3-CELLS — the enumeration ADR 0175 D3 promised AE5 would inherit

## Acceptance criteria

⚠ **Why this is a unit and not an ADR.** ADR [0175](../decisions/0175-ae4-po-batch-oracle-inputs-and-arm3-deferral.md)
D3 reads: *"D3 leaves AE5 a named inheritance: the arm-3 cells **arrive** already enumerated and
already known to diverge, so AE5 rules them rather than discovering them."* ⛔ That is a **forward
promise about the hand-off, not a claim of present completion** — and nothing discharges it. Measured
2026-09-09 at head pair `(20261003007360, 525)`: `supabase/tests/vectors/authz_differential_cells.psql`
holds **216** `org.professionals.read` rows (first at `:456`) and `grep -c divergent` over it returns
**0**; the enforcement manifest only *narrates* the hazard
(`supabase/tests/vectors/authz-enforcement-manifest.json:1240` — *"arms 1 and 3 are EXERCISED BUT NOT
ORACLED, and arm 3 is OPEN AND MASKING"*). ⇒ the work is **per-cell triage with a PO expected value
per cell class**, which is why pre-AE5 Batch 9 ruled it OUT (PO ruling R9) rather than absorbing it.

⚠ **The dependency is the MATRIX, not the TEMPLATE.** AE5's per-role template can be written without
this — ADR 0201 is what the template needs. This unit is due before **increment 1 runs its matrix**.
⛔ Sequencing it earlier buys nothing; sequencing it later blocks increment 1.

⚠ **A live home already exists and must not be duplicated:** the open QA finding at
`docs/reviews/authz-ae4-review.md:99-101`. Read it before deriving scope.

- [ ] **The divergence enumerated, derived not eyeballed.** ADR 0175 D3's divergence is that *arm 3
      grants with **no org term at all***. Owed: every cell in the candidate population labelled with
      whether arm 3 diverges from the oracled arms, the label **derived** from the live catalog and
      the generator, and the population stated as a **set, not a count** (⛔ Batch 7: *a count is not
      a set*; ⛔ Batch 7 again: *a derived sweep piped through `head` is a hand-list wearing a label*).
- [ ] **A PO expected value per cell CLASS**, not per row — with the classes themselves derived, and
      the class count reported before the rulings are sought.
- [ ] **Arm 3 stops being "OPEN AND MASKING"** — the manifest's own words at `:1240` are the
      condition to retire, and retiring them means the oracle covers arm 3, not that the sentence was
      deleted.
- [ ] **The forward promise closed at its source.** ADR 0175 D3's sentence gets a dated marker saying
      the inheritance was delivered (or, if the PO rules the cells need not be enumerated, why the
      promise is withdrawn). ⛔ Not closed by the cells existing while 0175 still reads as a promise
      nobody kept — that is the `409` § 3.7 failure shape pre-AE5 Batch 9 exists to retire.

**Gate.** `npm run lint` 0 errors / 0 warnings · `typecheck` · `npm run test:db` on a **fresh**
`supabase db reset` · the four authz arms with **domains quoted** · `SELFTEST=1` on the deriver **and**
the door harness · the set-valued targeted home · the diff-scoped deriver over `main...HEAD` with its
`SCOPE:` line quoted and its exit read **bare**. ⚠ This unit writes generated vectors under
`supabase/tests/vectors/**`, so ⛔ **Batch 7's empty-pathspec assertion does NOT apply** — but
`supabase/migrations` and `src` must still be untouched unless the unit is explicitly ruled a
migration. ⛔ Someone other than the builder runs the arms at the tip.
