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
population with whether arm 3 diverges from the oracled arms, **derived** from the live catalog
and the generator; get a PO expected value per derived cell **CLASS**; retire the manifest's
*"arm 3 is OPEN AND MASKING"* by making the oracle cover arm 3; and close 0175 D3 at its source.

### Done since start
Unit opened on the PO's naming (plan §6 hands the successor choice to the PO; `AE5` resolved to
this unit — the two docs-only successors, ADR 0202 and ADR 0204, stay unopened). Preconditions
measured, not assumed: `git status` porcelain empty on `main` @ `44f69ff6`; `git rev-list --count
origin/main..main` = **0** *after* `git fetch` — ⚠ the handoff recorded *"~26, NOT pushed"* at
Batch 10's close, so `main` **was pushed** between that close and this open; the handoff told its
successor to re-measure rather than quote, and this is the divergence that instruction anticipated.
No worktrees. `docs/features/INDEX.md` showed `in progress 0` before this edit. Branch
`authz-ae5-matrix-arm3-cells` cut off `main` **before** the hub was flipped (gate 13 resolves an
`in_progress` hub's `branch:` against local branches).

### In progress
Scope derivation, not building. Two read-only Explore agents are out: one over the AE5 programme
(what increment 1 and its *matrix* are, ADR 0155 G1's exact post-pilot bar, the live QA finding at
`docs/reviews/authz-ae4-review.md:99-101`, and a **re-measurement** of the hub's own 216 / 0 /
`:1240` figures at today's head pair); one over `scripts/gen-authz-differential-cells.py`,
`scripts/gen-authz-matrix-cells.mjs`, the arms' concrete SQL definitions, and which pgTAP tests
consume the vectors. ⚠ The hub's three headline figures were measured **2026-09-09 at head pair
`(20261003007360, 525)`**; the tree is now at **`(20261003007390, 528)`**, so they are re-derived
before any of them is used, never quoted forward.

### Next
Report the re-measured population as a **set**, derive the cell classes, state the class count,
and put the classes to the PO for an expected value each — before any generated vector changes.
Gate 12 (`lint:authz-vectors`) already `--check`s both generators, so the labels must land
**through** the generator, never as a hand-edit of `authz_differential_cells.psql`.

### Blockers
None. ⚠ Standing, not a blocker: *"do not push"* is the standing instruction (plan §6); the four
one-push overrides on record are each spent.
