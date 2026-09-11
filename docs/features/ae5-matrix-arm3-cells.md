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

**Updated:** 2026-09-10

### Objective
Discharge ADR 0175 D3's forward promise as WORK: label every cell in the arm-3 candidate
population with whether arm 3 diverges from the oracled arms, **derived**; get a PO expected value
per derived cell **CLASS**; make `403` actually oracle arm 3 (which is what retires the manifest's
*"OPEN AND MASKING"*); and close 0175 D3 at its source.

### Done since start
Unit opened on the PO's naming; preconditions measured (clean `main` @ `44f69ff6`, `origin/main..main`
= 0 after fetch, no worktrees). ⚠ The hub's three headline figures re-derived at today's head pair:
**216** and `grep -c diverg` **0** unmoved, ⛔ the anchor **`:456` STALE → `:459`** (corrected above).
⛔ **The local stack was one migration BEHIND the tree** — `(…7380, 527)` vs **528** — and the missing
one is Batch 10's rewrite of `is_admin_for`, i.e. **arm 1 of this very door**; fresh
`npx supabase db reset --local` (exit 0) put it at `(20261003007390, 528)`. The door read from the
**live catalog**: four grant terms in three arms, and its own body comment says arm 3 *"grants with NO
org term at all"*. Population stated as a **set**: persona 4 × context 3 × scope 3 × state 4 × self 2,
minus `absent`-only-for-`unprivileged` ⇒ 3×48 + 72 = **216** ✓ (30 grant / 186 deny, 8
`expected_source` values). ⭐ **Defect found and FIXED**: the manifest's `openArms` named the
re-key-removed `app.can_create_professional` and listed three arms while the emitted, gated
`authorizer_composed_with` carried the correct four — corrected against the live catalog, gate 12
**exit 0**. Full `npm run lint` **exit 0**. Two follow-ups filed (increment-1 ambiguity; ADR 0202's
borrowed census).

### In progress
`backend` is deriving, from the live catalog, which of the five swept axes arm 3 actually depends on
— ⚠ sharply, whether it depends on **account state**, since Batch 10 just made the admin arms follow
`app.is_active` and arm 3 may not — plus the minimal new axis that makes arm 3 expressible, and the
divergence **classes** with their counts.

### Next
Two PO decisions, in this order, **before** anything is generated: (1) **the seam** — the generator is
catalog-free **by design** (gate 12 must run without Docker), so *"derived from the live catalog and
the generator"* names two derivations that cannot happen in one place; (2) **an expected value per
derived class**, with the class count reported first. Then the build, whose shape `403` §7.3 already
fixes: approved values **first**, then a participation fixture that **breaks** its `0` sentinel —
⛔ which that assertion forbids renumbering.

### Blockers
None. ⚠ Standing, not a blocker: *"do not push"* (plan §6); the four one-push overrides are spent.
