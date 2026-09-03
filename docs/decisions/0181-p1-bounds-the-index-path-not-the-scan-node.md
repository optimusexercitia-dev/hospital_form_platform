# ADR 0181 — Acceptance condition P1 bounds the INDEX PATH, not the `Seq Scan` node

**Status:** accepted
**Date:** 2026-09-02

## Context

`FUP-AE4-P1-BOUNDS-A-SYNTAX-NOT-A-PROPERTY`. P1 of the AE4 performance acceptance reads *"No
`Seq Scan` on `public.memberships`, `public.profiles`, `public.commissions` or `public.hospitals`
anywhere in the nested plans"*, while the FAILS-when column beside it names a different predicate:
*"a seq scan is the regression F9 predicts, and it is **the one that turns linear into quadratic at
production scale**."*

Those two came apart under measurement (acceptance doc §12.2). `public.hospitals` is **124 rows in
2 pages**, so a full scan costs `3.24` against `hospitals_pkey`'s `8.29` — the planner was choosing
correctly, and against `ANALYZE`d copies at 124 / 620 / 1 984 / 19 964 rows it leaves the scan on
its own at **620 rows / 9 pages**. The node P1 forbids is, here, a self-correcting size artifact.

P1 has therefore failed on every run, and after `20261003007310` it fails on **4 120** nodes of
which **3 517 never execute**. A condition that is permanently red on a known-benign cause has the
same practical value as one that is permanently green: it cannot distinguish a new regression from
the old noise, and it gets tuned out.

⛔ **This is the move the acceptance protocol exists to distrust**, so the reasoning is recorded in
full rather than asserted. What makes it a correction and not a fudge: **the subject is unchanged.**
P1's stated hazard has been the same since `82613268`; only its instrument is replaced, and it is
replaced with one that measures the hazard directly.

## Decision

1. **P1 fails when a `Seq Scan` on one of those four tables SURVIVES `enable_seqscan = off`.**
   That setting does not forbid a sequential scan, it prices one punitively — so a scan that
   survives it is one the planner has **no index path for**, and it can never self-correct at any
   cardinality. A scan that disappears under it is a size-driven choice the planner will revisit.
2. **The raw seq-scan census over the nested region is still REPORTED**, as evidence, with
   executed-vs-`never executed` counts. It is no longer the pass/fail.
3. **The instrument is `scripts/authz-ae4-p1-index-path.sql`**, committed rather than left as prose
   commands so it cannot drift, and **its vacuity control is bundled inside it**: §0 builds an
   index-less copy of `hospitals` and the script **raises VOID unless that control produces a
   surviving scan**. *"No scan survived"* and *"the probe is broken"* are otherwise the same string.
4. ⚠ **The limit is stated in the instrument itself:** an index path EXISTING is not the planner
   CHOOSING it at production scale. For `hospitals` the crossover was measured separately and they
   do not come apart. **Any table added to P1's list later owes its own crossover measurement** and
   may not inherit this one.
5. **Verdicts already recorded are not rewritten.** Runs 1–5 were judged under the original wording
   and keep the FAIL they earned; §12's table carries both, each labelled with the wording in force.

### Options rejected

- ⛔ **Count only nodes that executed.** Rejected on measurement, not taste: **603 of the 4 120
  `hospitals` nodes do execute**, so P1 still fails and nothing is resolved. It was filed as a
  candidate without that being checked.
- ⛔ **Allowlist `public.hospitals` with the crossover attached.** Rejected: it makes the one table
  we understand the one table P1 can no longer see. A later genuine regression there — a join added
  that scans it at 50 000 rows — would read as silence. *Allowlisting a subject is what makes it
  blind* (ADR 0079's standing lesson).
- ⛔ **A page-count threshold below which scans are exempt.** Rejected: it encodes the right
  intuition as a tuned constant that drifts with row width and Postgres version, and it would
  wrongly excuse a table that is small in the fixture and large in production — which is §3.1's
  irreducible bound, not something to build a gate on top of.
- ⛔ **`ALTER FUNCTION … SET enable_seqscan = off` on `authz.scope_reaches`.** Never a candidate for
  the *condition*, and rejected as a *fix* in ADR 0180: measured buffer-neutral, so it moves no
  cost and would satisfy P1's wording while its subject was never present.

## Consequences

- **Run 5 re-evaluated: P1 PASSES**, `P1_PROBE_EXIT=0`, control FIRED, all four tables CLEAR
  (`hospitals` and `memberships` on Index Only Scans, `commissions` and `profiles` on Index Scans).
- **Both of the probe's verdicts are proven reachable**, which is the condition on believing either:
  the bundled control fires, pointing a §1 subject at the index-less copy raises and exits **3**,
  and the stronger control — dropping `hospitals`' real indexes in a rolled-back transaction —
  produced a surviving `Seq Scan` with the index path returning after rollback.
- ⛔ **P5 is untouched.** It fails at 5.28× / 4.99× against K = 4 and continues to. The conditions
  are independent; nothing here licenses re-deriving K, and P5 has never rested on P1.
- The acceptance is **still NOT MET**, now on **one** condition rather than two, with its cause
  named: volume in `authz.entailed_grants`' invocation structure, a separate increment.
