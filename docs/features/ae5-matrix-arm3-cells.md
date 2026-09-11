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
reviews: ["../reviews/ae5-matrix-arm3-cells-review.md", "../reviews/ae5-matrix-arm3-cells-rereview.md"]
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

- [x] **The divergence enumerated, derived not eyeballed.** ADR 0175 D3's divergence is that *arm 3
      grants with **no org term at all***. Owed: every cell in the candidate population labelled with
      whether arm 3 diverges from the oracled arms, the label **derived** from the live catalog and
      the generator, and the population stated as a **set, not a count** (⛔ Batch 7: *a count is not
      a set*; ⛔ Batch 7 again: *a derived sweep piped through `head` is a hand-list wearing a label*).
- [x] **A PO expected value per cell CLASS**, not per row — with the classes themselves derived, and
      the class count reported before the rulings are sought.
- [x] **Arm 3 stops being "OPEN AND MASKING"** — the manifest's own words at `:1240` are the
      condition to retire, and retiring them means the oracle covers arm 3, not that the sentence was
      deleted.
- [x] **The forward promise closed at its source.** ADR 0175 D3's sentence gets a dated marker saying
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

**Updated:** 2026-09-11 (post-QA, awaiting human approval)

### Objective
Discharge ADR 0175 D3's forward promise as WORK: label every cell of the arm-3 candidate population
with whether arm 3 diverges, **derived**; a PO expected value per derived **CLASS**; make `403`
actually oracle arm 3 (what retires the manifest's *"OPEN AND MASKING"*); close 0175 D3 at its source.

### Done since start
All four acceptance criteria met (ticked above), each with its witness in the record. **Arm 3 derived
from the live catalog** (no org term — D3 CONFIRMED; role-free at S3/S4 only, so it survives an absent hat; `pending` reachable); a **live,
unmasked arm-3 grant reproduced on the untouched seed**. Population = a **partition of the 216
`grant_keyed` cells** at the rep (the rep holds 864): 108 blocked · 30 masking · 36 + 32 + 10 divergent
(over the rep's 864: 92 approved-divergent, 10 defective). **PO rulings R1** (generator-side axis) and **R2**
(classes 3 + 4 approved reach; class 5 a **BUG**, filed, not fixed). **Built and lead-verified at the
tip**: `case_reach` axis + `arm3_divergence` label (inc. 1); gate-scoped by a named rule bound to the
manifest via coverage `arm9`, 1728 cells, byte-identity proven (inc. 2); ⭐ **`403` ORACLES arm 3** —
§7.3 replaced, §7.3b/§7.4/§7.5/§4.1b added, R2 in a 14th column, `expected_granted` unmoved,
mutation-proven and the PO's caveat **widened** (neither an org term nor a role-keyed hat check) (inc. 3).
**This session (resumed from origin):** rebased onto `main` (one docs conflict, resolved to `main`);
**manifest qualifier RETIRED FOR ARM 3**, history verbatim, scope stated (arm 1 still owed); **ADR 0175
D3 closed by dated markers**; **authz seam slice + `## Current state` replaced** (97/100 lines; the
file crossed the 160 KB warn line → `FUP-…-AUTHZ-SEAM-CROSSED-ITS-WARN-LINE`).
**Gate at tip `29422327`, run by the lead, every rc bare:** typecheck 0 · unit 154/154 · `test:db` on a
fresh reset `Files=267, Tests=9023, PASS` · **census 608 HOLDS · hat HOLDS (4 allowlisted) · floor
HOLDS · wrapper HOLDS** · SELFTEST deriver `46/0/0` + door harness 0 · deriver **NOT-APPLICABLE (3)**
both arms (no migration; `SCOPE:` quoted in the record) · set-valued **CLEAN 3/3** · tree clean before
and after. ⛔ `lint` was **1** at that tip — gate 13 on the record's own handoff citation, reworded;
re-run bare at `eaf1757a`: **17/17, rc 0** (record entry *lint re-run BARE*).

### In progress
Phase Gate step 4 — **human approval, WAITING**. QA round 1 CHANGES REQUESTED (6 docs-only findings,
all fixed at `00846736`, one follow-up filed for the live door comment); round 2 **APPROVED** (two
MINORs discharged in the same commit as this block). `lint` bare rc 0 at `eaf1757a` and `00846736`.

### Next
On approval: the Record step (lead-playbook §4 — ledger row, plan §2 row, hub `complete`, review-queue
check, ff-merge to `main`; ⛔ **no push** — standing instruction). E2E `e2e:prod` **not owed** (no
`src`/migration/seed/`e2e` in the diff) — ruled by the lead, **confirmed by QA** in both rounds.

### Blockers
None. ⚠ Standing: *"do not push"*. ⛔ Class 5's fix is a filed bug and deliberately **not** this unit.
