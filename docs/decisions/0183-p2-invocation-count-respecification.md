# ADR 0183 — Acceptance condition P2 counts INVOCATIONS against a bound, not `loops` values

**Status:** accepted
**Date:** 2026-09-03
**Amends:** 0182

## Context

AE4/IA-F9 acceptance condition **P2** was re-stated by ADR 0182 (acceptance doc §13.2) as
*"`authz.assignment_facts` is invoked **once per STATEMENT** on the converted read path"*. The
property is right and the reason for re-stating it was right — the old *"≤ 1 per protected row"*
form went vacuous the moment the read stopped being per-row. **The instrument was left where it
was**, at acceptance §9.7 stage 2:

```
grep -oE 'Function Scan on assignment_facts af .*loops=[0-9]+' | grep -oE 'loops=[0-9]+' | sort | uniq -c
```

That pipeline counts **`loops` values**, never the node count against a bound. Every nested
`has_permission` is its own `SECURITY DEFINER` body and emits its own plan carrying its own node at
`loops=1`, so *"every node `loops=1`"* — the sentence run 6's PASS was written on — is true for any
number of candidate scopes and **cannot report the other answer**. ⭐ **This is the second time P2
went vacuous the same way:** §13.2 re-specified the *condition* and left the *measurement* one level
down, where it went vacuous again. A condition and its instrument are re-specified together or not
at all.

The second half is scope. Run 6 recorded **7** invocations against a condition reading "once per
statement" and scored **PASS**. Decomposed against the committed artifact
(`authz-ae4-perf-run6-passB.txt`, M1-nested = lines 857–5960): line 2818 is the `candidate` CTE
(rows = 20 = M); lines 1820 + 2746 are the two candidate confirmations through `entailed_grants`;
line 3822 is `entailed_grants` from the policy's **ELSE** arm; lines 4049 / 4792 / 5535 are
`authz.holds_role` via `app.can_manage_professional`. **3 of the 7 are the resolver (`1 + U`,
`U = 2`, exactly as the structure predicts); 4 are its neighbours** — M1-nested is `limit 200`
**unfiltered**, so one row missed the set arm and fell through to
`app.can_read_professional_profile`. ⛔ Nothing was anomalous. The defect is that run 6's P2
evidence **counted off-path nodes into its subject**. *A criterion that cannot tell its own subject
from its neighbours is the same failure as one whose observable cannot move.*

P2 was also the only condition with **no committed checker** — registered `UNRUN` in the harness and
scored by eye off a grep pipeline. Precedent for the fix is ADR 0181, which re-specified P1's
instrument the same way and committed it as a script with a bundled vacuity control.

## Decision

1. **P2 becomes a bound with a measured right-hand side.** With `A` = `authz.assignment_facts`
   invocations per statement and `U` = the **measured** number of candidate confirmations the
   resolver performs: **`A = 1 + U`**, and `authz.authorized_scope_ids` itself entered exactly
   **once** per statement. **P2a**: `ΔA = 0` when `N` goes 200 → 400. **P2b**: planting candidate
   scopes gives `ΔA = ΔU`.
2. **P2a is measured on the ORG-FILTERED statement**, where the policy's `ELSE` arm is
   `never executed` by construction — and that is **asserted**
   (`Δapp.can_read_professional_profile = 0`), not assumed. Run 6 is why: on the unfiltered
   statement the fallback did execute, four times, and its calls were scored as P2 evidence.
3. **P2's subject is the resolver's own re-entry.** `holds_role` and `ELSE`-arm contributions are
   reported as a **decomposition** and are never folded into the count. Any residual is a **named
   unexplained term**, never absorbed.
4. **The instrument is `scripts/authz-ae4-p2-invocation-count.sql`**, committed rather than left as
   prose commands so it cannot drift; exit **0** = clear, **3** = FAIL or a control did not fire
   (VOID). Counting is `pg_stat_get_function_calls(oid)` under a per-session
   `track_functions = 'all'`, keyed by **OID** via `::regprocedure` — no text scraping, no queryid
   matching, no plan parsing — which also yields the §4 decomposition in the same pass.
5. **Two controls, and they are different things, and both must fire.**
   **§0 liveness:** one direct call over `M` rows must move the counter by exactly **1**; `Δ = M`
   means it is counting rows and the run is **VOID with a named remedy**, never a number divided by
   `M`. **§1 discrimination:** the candidate differential, including a **`ΔU = 0` arm** (a seat in an
   already-proposed organization — without it an instrument counting *facts* rather than
   *invocations* passes anyway) and a **non-authorizing arm** (`ΔU > 0` while the granted count does
   not move — without it the count is not shown to track proposals rather than grants). A
   plant-only control measures the `INSERT`'s own trigger cost rather than assuming it is zero.
6. ⛔ **Verdict precedence: `ΔU > 0 ∧ ΔA = 0` is VOID (a dead instrument), never FAIL.** Any other
   `ΔA ≠ ΔU` is FAIL. Collapsing the two loses the finding that matters.
7. **`U` is measured on the same counter, as `authz.has_permission` invocations.** ⛔ It is **not**
   readable off the resolver's plan, and that is a catalog fact rather than a preference:
   `authz.authorized_scope_ids` is `SECURITY DEFINER` ⇒ never inlined ⇒ `EXPLAIN (ANALYZE)` of any
   statement calling it stops at `Function Scan on authz.authorized_scope_ids`. Verified against the
   live catalog 2026-09-03.
8. **P2 is `UNRUN` until run 7.** Run 6 is **re-decomposable but not re-scorable** (see Consequences).
   Its recorded PASS stands as a PASS under the wording then in force and is not retroactively
   converted into a fail; what is retired is the wording and the instrument, not the measurement.
9. **P1 · P3 · P4 · P5 · P7 · DC1 · DC2 · DC3 are UNCHANGED. No threshold moves.** P2 is an
   invocation count, not a cost; nothing here re-derives a latency or a ratio.

## Options rejected

- ⛔ **Keep parsing the auto_explain nested region, with a corrected grep.** Rejected: it is *what
  failed*, it cannot carry an exit code, and it cannot attribute a node to its caller — which is
  precisely how three `holds_role` nodes became P2 evidence. It stays as **evidence, never verdict**.
- ⛔ **Read `U` off the `SubPlan → ProjectSet rows=` node** (`passA.txt:342`). Rejected on
  measurement: that is the **granted** count, a different quantity. The checker's non-authorizing
  arm separates them by construction — `ΔU = +1` with the granted count unmoved — and a bound
  written on the granted count would have silently excused a denied proposal.
- ⛔ **Hand-copy the resolver's candidate `CASE` into the harness to predict `U`.** Rejected: a
  harness holding a copy of production text is a duplicate no gate protects, and `k` planted
  memberships need not map to `k` distinct candidates anyway. `ΔU` is measured, never predicted.
- ⛔ **`pg_stat_statements` with `track = 'all'`.** Rejected: the entry is identified by fragile
  normalized body text, the counter is cluster-global, and `pg_stat_statements_reset()` is **not
  transactional**, which breaks the everything-rolls-back rule this work runs under.
- ⛔ **Lean on P7 for row-independence.** Rejected: P7 bounds the *outer* structure on M1b and its
  `never executed` holds **only because M1b is org-filtered**. Run 6 is the proof of the gap.

## Consequences

- **The checker passes on the live path, exit 0** (2026-09-03, perf fixture loaded): calibration
  `Δ = 1` over `M = 20`; baseline `A = 3, U = 2, granted = 2`; arms *new org authorizing*
  `ΔA = ΔU = 1` (granted 2 → 3), *same org* `ΔA = ΔU = 0`, *new org non-authorizing* `ΔA = ΔU = 1`
  (granted **unchanged**); `N` 200 → 400 gives `ΔA` **3 → 3** with the ELSE arm at 0 calls, against
  a control at **200 → 400**; §4 closes at `A = 7 = 1 + 3 + 3 + 0 + 0`, **residual 0** — the Context
  table above, re-derived by machine.
- ⭐ **Every failure mode was forced and observed**, which is the condition on believing the pass:
  dropping the forced flush ⇒ §0 **VOID**; planting all three arms into already-proposed
  organizations ⇒ §1 coverage **VOID** (*"the differential never fired"*, **not** PASS); freezing
  the counter ⇒ §1 **VOID** *"DEAD INSTRUMENT, not a pass"* with VOID outranking the FAILs it also
  produces; and a resolver mutated to enter `assignment_facts` once more — in a rolled-back
  transaction, derived from `pg_get_functiondef` so the mutation is not a hand-copy either — ⇒ §3
  **FAIL** `A = 4, 1 + U = 3`. All four exited **3**; all four postflights passed.
- ⚠ **A measured hazard, recorded because it is silent:** pending function-call stats are invisible
  inside a transaction block and are **not** flushed immediately after one. Read without a
  top-level `pg_stat_force_next_flush()`, the delta is **0** — an instrument reporting "nothing was
  invoked" while everything was. §0 is what catches it.
- **Run 6 is re-decomposable but NOT re-scorable, so a fresh run is owed.** The artifacts yield
  `U = 2`, `1 + U = 3` and the seven-node attribution with no re-run; they lack (i) any org-filtered
  nested capture, (ii) a second `N`, (iii) the candidate differential and its `ΔU = 0` arm, and
  (iv) any invocation counter (`track_functions` was `none` for every run to date). Acceptance §16.4.
- **The harness registers P2's checker by name** (`authz-ae4-perf-harness.sql`), the §7 runbook gains
  a step that runs both committed checkers, and the run ledger gains `P2PROBE` **from run 7 on**.
  ⛔ The run-6 ledger lines carry no `P2PROBE` and must not be given one: back-filling a field into
  a record of a run that did not produce it is how a record stops being one.
- **Two records corrected forward rather than in the migration.** Acceptance §14.1's
  `402 buffers / ~2.8 ms` — a figure matching neither artifact, and contradicting its own section's
  P5 row — becomes `402 buffers / 3.842 ms` with its apparatus named; ADR 0182's `8.3 ms` keeps its
  number and gains the clause naming **its** apparatus (pre-commit candidate in a rolled-back
  transaction, read off EXPLAIN), so the two cannot read as a contradiction. The buffer count is
  **402** under all three apparatus and is what the argument rests on.
- **Acceptance §13.4's claim that `professional_participants_select` "is DC1's new subject" is
  struck** (not deleted): §13.5, four lines below it, records that that re-aim was measured and
  killed. The bullet's conclusion — the policy is not converted — stands.
- ⚠ **ADR 0182's description of the pgTAP `413` repair is corrected**, because the repair it
  described was reversed the same day: `413` pins both siblings against the direct constant rather
  than asserting sibling-equality, and the class is swept by `414`. Sibling-equality defines a
  security invariant as equality with a mutable object. ⭐ What made the original defect a defect was
  copying a constant **out of a broken catalog**, not the use of a constant as such.
