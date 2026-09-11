---
id: AE5-MATRIX-ARM3-CELLS
title: "Arm-3 divergent cells enumerated — discharging ADR 0175 D3's forward promise, which is WORK and not a decision: 216 candidate rows carry zero divergence labels"
status: in_progress
kind: feature
program: AUTHZ
phase: "Named at pre-AE5 Batch 9 by PO ruling R9 — due before AE5 increment 1 runs its MATRIX, not before its TEMPLATE is written"
branch: authz-ae5-matrix-arm3-cells
plan: ../plans/authz-evolution.md
progress: ../progress/ae5-matrix-arm3-cells.md
reviews: []
adrs: ["0175", "0176", "0191", "0201"]   # 0201 added at Batch 9's Record step, as promised when it was dropped at unit open
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

⚠ **Re-measured 2026-09-10 at head pair `(20261003007390, 528)`, at this unit's open.** The **216**
and the **0** are unmoved (re-derived, not quoted). ⛔ The anchor **`:456` is STALE — the first
`org.professionals.read` row is now `:459`**, three lines down, because `a74f2409` (*row 31 gets its
own differential representative*, PO ruling R4, unit `ADMIN-ARM-IS-ACTIVE`) inserted three
`org.professionals.create` rows above the block. The 2026-09-09 figures above are kept as the dated
measurement they are; this paragraph is the correction, and `:456` occurred nowhere else (the
register body at `docs/followups/follow-ups-open.md:1919` carries 216 / 0 with no line anchor).

⛔ **"Arm 3" names a door that has since grown a FOURTH arm, and the same `:1240` field says so.**
The sentence this unit must retire does not end where the criterion below quotes it — it continues:
*"⚠ THE RE-KEY MADE THIS WORSE, NOT BETTER: the authorizer now has **FOUR** arms, not three
(`can_create_professional` was inlined into a permission check plus `can_manage_professional`), so
there is one more way for a green to be somebody else's answer."* ⇒ the candidate population is
**re-derived over the live four-arm door**, never inherited from ADR 0175 D3's three-arm picture.
That same field also fixes the method: *"Any equivalence differential for this code must observe a
coordinate where NO other arm is open, or it measures nothing."*

⚠ **The AE4 review is mid-phase and NOT verdict-bearing** (`docs/reviews/authz-ae4-review.md:10-13`),
so F3 (`:93-101`) is a **finding**, not a gate. ADR 0175 D3 discharged F3's *first* ask (403 calls the
real door); ⛔ what this unit owes is F3's **second**: *"record the divergent cells with their own
expected values, **never substitute the subject**."*

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

## Current state

**Updated:** 2026-09-11

### Objective
Discharge ADR 0175 D3's forward promise as WORK: label every cell of the arm-3 candidate population
with whether arm 3 diverges, **derived**; a PO expected value per derived **CLASS**; make `403`
actually oracle arm 3 (what retires the manifest's *"OPEN AND MASKING"*); close 0175 D3 at its source.

### Done since start
Hub's own figures re-derived (**216** and **0** unmoved; ⛔ anchor `:456` → **`:459`**). ⛔ The local
stack was **one migration behind the tree** on this door's own arm 1; reset to `(20261003007390, 528)`.
**Arm 3 derived from the live catalog**: ⛔ no org term (ADR 0175 D3 **CONFIRMED**); `_case_caps` STEP 2
gates on `app.is_active`, so suspended/deactivated close it — ⚠ but `pending` is **not** an `is_active`
state, so 54 pending cells stay reachable; S3/S4 carry **no role lookup**, so arm 3 survives an
**absent hat**. ⭐ A **live, unmasked arm-3 grant reproduced on the untouched seed**. Population = a
**partition of 216**: 108 blocked · 30 masking · **36 + 32 + 10 divergent**.
**PO rulings:** **R1** generator-side, axis-driven seam; **R2** classes 3 + 4 **approved** as designed
reach, class 5 a **BUG** (filed; the PO's caveat binds its fix **and its test**).
**Built, each verified by the lead at the tip — ⛔ never by the builder:**
**inc. 1** `case_reach` axis + `arm3_divergence` label; **inc. 2** gate-scoped by a named rule bound to
the manifest by new coverage `arm9` — 1728 cells, per-cell **byte-identity** proven (0 altered);
**inc. 3** ⭐ **`403` now ORACLES arm 3** — §7.3 **REPLACED not renumbered** (old sentinel text count =
**0**), §7.3b measures all four reaches where `unreachable` and `grant_keyed` are **one grant row
apart**, §7.4 pins the defect, §7.5 is the class-4 guard, §4.1b pays for the carve-out. R2's GRANT
landed in a **new 14th column** `expected_legacy_granted` (320 true; **92 flips, all on approved
labels**) — ⛔ `expected_granted` **unmoved at 228**, proven by stripping col 14 and diffing: **0 of
1728 rows differ**. **Mutation-proven**, and it **widened the PO's caveat**: a role-keyed hat check
also kills class 3's 36 approved cells, because S3 is role-free by design.
`403` run by the lead: **EXIT=0, Files=2, Tests=28, 0 `not ok`**. `npm run lint` **17/17 exit 0**.
**Found in passing:** manifest `openArms` **fixed**; the register header's per-bug-doc figure
re-derived (**3** → **5**, stale before this unit); two follow-ups; **LEARN-103**.

### In progress
Second documentation pass — auditing every home this unit touched (backend-state seam, PROGRESS.md,
the plan, QA finding F3, the declared ADRs, the registers) for what is owed **before** the gate.

### Next
Retire the manifest qualifier **because `403` oracles arm 3**, ⛔ never by editing the sentence; close
ADR 0175 D3 at its source with a dated marker; append the authz seam's slice and **replace** its
`## Current state`. Then the gate: `test:db` on a **fresh** reset, the four authz arms with domains
quoted, `SELFTEST=1` on deriver **and** door harness, the diff-scoped sweep read **bare**.

### Blockers
None. ⚠ Standing: *"do not push"*. ⛔ Class 5's fix is a filed bug and deliberately **not** this unit.
