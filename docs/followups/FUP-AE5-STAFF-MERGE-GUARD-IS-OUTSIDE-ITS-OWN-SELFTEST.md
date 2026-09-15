# FUP-AE5-STAFF-MERGE-GUARD-IS-OUTSIDE-ITS-OWN-SELFTEST

**Filed:** 2026-09-14 (unit `AE5-STAFF`, T8, by the lead) · **Owner:** backend
**Severity:** low — the guard works and is proven; what is missing is a STANDING proof.
**Status:** open

## The gap

`scripts/lib/merge-findings-baseline.sh` gained (`34117443`, L25) a guard that aborts when the
generated report is MISSING baseline rows — the defect that gutted the committed findings baseline
353 → 73 at exit 0 on 2026-09-14. The guard is scoped to `SELFTEST != 1`: under the helper's own
self-test it is OFF, because it aborted 5 of the helper's 18 merge scenarios, which exercise the
carry path (rows present in the baseline and absent from the generated file are carried forward).

Two consequences:

1. **The guard's discrimination rests on a one-off run**, quoted in the unit's record (subset →
   exit 2 `missing 303 row(s)`; full-shaped and superset → exit 0). No self-test scenario holds it,
   so a later edit that silently disables it is caught by nothing until the next gutting.
2. **The self-test proves a merge the real run refuses.** Five scenarios pass on a carry the guard
   forbids outside self-test; the helper's self-test is therefore green on behaviour the helper no
   longer has. This is the same family as the gate row whose label claims a knob the script does
   not read — a green proof about a path that is not the production path.

## Closes when

The helper's self-test carries BOTH halves with the guard ON: a scenario that feeds a subset and
requires the `missing N row(s)` abort (exit 2), and the carry scenarios re-stated as what the real
run does with a missing row (abort, or a carry explicitly requested by a knob the production
sweep never sets — `docs/lint-gates.md`'s trap in reading its output applies). `SELFTEST=1
door-sweep-cases.sh`'s `--- GROUP merge helper:` line must show the new scenario counted, and the
guard must be shown ABLE TO RED inside the self-test, not only in the record.
