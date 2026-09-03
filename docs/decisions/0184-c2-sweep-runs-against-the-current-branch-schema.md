# ADR 0184 — C2's full sweep runs against the current branch's schema, not against `main`

**Status:** accepted
**Date:** 2026-09-02
**Amends:** ADR 0162 §3 — its *branch-order* clause only. The cutline it sets (the
tenant-boundary/PHI subset of `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` closes before Gate AE4's PO
approval) and the domain-qualifier corollary both stand; only "never folded into AE1's or
AE4's branch" is retracted.
**Relates:** [0079](./0079-authz-door-blindness-standing-invariant.md) (the ARM domains C2 fills
the hole in) · [0178](./0178-ae49-d6-rekey-as-built.md) (the AE4.9 migrations now under the
sweep) · [0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md)
(subset runs write to SCRATCH) ·
[handoff](../handoffs/c2-tier1-neutralizer.md)

## Context

0162 §3 required C2 to run as its own increment, off AE1's and AE4's branches. The harness derives
its worklist **as a property of the live catalog every run**, so the schema it runs against *is*
the population it measures. Measured 2026-09-02: `authz-c2-tier1` holds 519 migrations to
`origin/main`'s 501 — a **strict superset**, the 18 extra being exactly AE4's
(`…7100_ae4_create_authz_catalog_schema` … `…7300_ae49_d6_rekey_three_representatives`), with
**zero** migrations on `main` that the branch lacks. A sweep costs ~5 h; running it on `main` would
measure a schema that no phase now builds against and would have to be re-run after the AE4 merge.

## Decision (PO, 2026-09-02)

1. **C2's full sweep runs against the current branch's schema** (`authz-c2-tier1`, 519 migrations,
   AE4's 18 included), not against `origin/main`'s 501. 0162 §3's "never folded into AE1's or
   AE4's branch" is retracted **as to branch order only**; its cutline is unchanged.
2. **Tradeoff accepted, stated so it is not rediscovered as a defect:** C2's findings now live on
   AE4's branch and are **not independently mergeable to `main`** — C2 lands when AE4 lands, and a
   C2 verdict may not be cited as holding on `main` until it does. C2 stops being a rollback-safe
   increment; it becomes an AE4 gate input.
3. **The domain qualifier survives and gains a third field.** 0162 §3's corollary still binds every
   AE gate record: state the **structurally uncovered** door population beside the covered one, and
   "all arms green" never appears without it. It now also states **the schema the two figures were
   measured on**. Because the branch is a strict superset (Context), no door that exists on `main`
   goes unmeasured — the verdicts are conservative in `main`'s direction. But **both** counts are
   branch figures: the uncovered population includes AE4-only doors that `main` does not have, so a
   bare "N doors outside every ARM domain" quoted onto a `main` record is wrong in the count even
   where it is right in the claim.

4. ⛔ **The qualifier names THREE uncovered populations, not one — discovered while this sweep ran
   (`FUP-C2-NEUTRALIZER-ANCHOR-BLIND-TO-HCDS-AND-28000`), and the reason point 3 is not merely
   bookkeeping.** The harness anchors on `errcode = '(42501|HC0[A-Z0-9]{2})'`, and that anchor is a
   **syntax, not a property**. A gate record citing this sweep must state all three:
   - **Tier 2 — 190 doors**, deferred by ADR 0171, not cleared.
   - **The `HCDS*` family (60 raises) and `28000` (6).** The anchor requires a literal `0` in
     position 3, and the **gate-fn filter uses the same anchor**, so these doors are *structurally
     absent from the worklist* — they appear in the findings neither as a verdict nor as an ERROR.
     `28000` is SQL-standard `invalid_authorization_specification`; the `HCDS*` lane is LGPD Art. 18.
   - **The ERROR class — ~10 enforcers expected, no verdict.** 39 anchored raises carry a `;` inside
     the message literal, which the negated-semicolon anchor cannot span, so the mutation never
     lands. It fails **closed** (never a false COVERED), but a door with no verdict is not a covered
     door. ⛔ It **concentrates on the PHI lane** — `HC078` twice in referral-PHI plus
     `dispose_referral_phi` — which is the very subset this ADR's point 1 leaves gating AE4.

5. **A COVERED/BLIND verdict from this run means `HC0*`-coded-guard coverage, NOT authorization
   coverage.** `HC0*` is this project's whole application error space: `HC038`
   (*"esta entrevista não pode ser cancelada neste estado"*) and `HC043` are **state** guards, while
   `HC039` (*"sem permissão…"*) is the authorization one. Gate records must not silently promote the
   former reading to the latter. ⚠ This does not devalue a BLIND verdict — a state guard that
   vanishes with the whole suite green is a real gap — it means the verdicts are **mislabelled**
   until the `HC0*` space is classified by property.

## Consequences

- Gate AE4's record carries C2's verdicts directly; there is no separate C2 merge to sequence.
- Any C2 re-derivation after further migrations land is a **new** measurement, not a refresh — the
  worklist is derived per run, so the enforcer count is a dated figure like every other in 0079.
- If AE4 is abandoned or rebased, C2's findings go with it and must be re-swept; that is the price
  of (2), and it is accepted knowingly.
- Points 4 and 5 mean **this sweep does not by itself discharge 0162 §3's cutline.** The cutline names
  the tenant-boundary/**PHI** subset, and the PHI subset currently contains doors with no verdict.
  Closing the cutline needs the anchor widened and the ERROR class re-swept — a *delta* run, since the
  existing verdicts stay valid for what they measured.
