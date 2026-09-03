# FUP-LINT-VECTOR-DIMENSION-DRIFT — propose a lint gate over shared SQL↔TS **vector fixtures**: a declared dimension that no vector varies, or a consumer that silently drops one (owner: lead + PO; **a gate change is not a mid-build edit**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-18 · status parked

Filed 2026-08-18 (lead) during the ADR 0125/0126 prévia build, on `backend`'s proposal. **Deliberately not
built in that build** — CLAUDE.md §8's own record is that each of the seven gates was added *after* its class
shipped a live defect, one at a time and on its own evidence. This one already has its evidence; what it does
not have is a PO ruling.

**The proposal, in the proposer's words:**

> A lint gate over the shared-vector fixtures that fails when a predicate's declared *input dimensions* and
> its *asserted rows* diverge: specifically, when a fixture gains a dimension that no vector varies (the flag
> exists but nothing pins it), or when a consumer's state-mapping function silently drops a dimension the
> fixture declares (the row passes because the flag never reaches the predicate).

**Both shapes were LIVE in the build that proposed it — this is not a hypothetical:**

1. **A dimension nothing varied.** `print-source-registers-vectors.json` declared `correction_open` /
   `phase_voided` as `form_response`-only and `meeting_disposed` as `meeting`-only, and the requirement that
   each predicate **IGNORE** a flag outside its kind was stated **in a comment and asserted by no vector** —
   every meeting row carried the form_response flags `false`, so the kind-scoping was never exercised in
   either direction. Found only because the build's task text asked for the pin by name. Fixed by adding 3
   cross-kind rows.
2. **A consumer that dropped one.** `frontend`'s `stateOf(v)` mapped three of the fixture's four keys, so the
   new `form_response + meeting_disposed → registers=true` row **passed on its first run** — the flag never
   reached the predicate, so the row asserted nothing. ⚠ The tell was *green-on-first-run*, which reads as
   "already correct" and was in fact "not yet connected". Its mirror row **was** real and also passed, so half
   the cross-kind pin worked and half was theatre, **under one indistinguishable green bar**.

**Why a gate rather than a rule.** The vector-fixture pattern is what makes a SQL↔TS mirror safe at all — ADR
0126 D3 rejects "two computations of one property" precisely because they can disagree with nothing going red,
and the mirror survives that rejection **solely** because the fixture is the thing that reds. A fixture with a
dimension nothing varies is therefore not a weak test; it is **the mirror's safety property silently absent**.
Architecture Rule 3 already mandates this pattern for the condition evaluator, so the gate would generalise
beyond the print derivation rather than serving one feature.

**Prior art to build on:** [`check-vacuous-assertions.mjs`](../../scripts/check-vacuous-assertions.mjs) is the
precedent for turning "a test that can go green having asserted nothing" into a mechanical gate, and it
self-red-proves each checker on every run — a new gate should do the same, or it joins the class it audits.
⚠ Note the existing gate's own scope limit, recorded in `FUP-PGTAP-VACUOUS`: it scans **TS spec files only**.
A vector fixture is consumed from **both** sides, so this gate must reason about the fixture and its
consumers, not about one language's test files.

**Not in scope until ruled:** whether it becomes gate 8 of `npm run lint` or a standalone check, and whether it
is fixture-shape-generic or keyed to a declared manifest. Both are PO calls, and neither should be settled by
whoever happens to be mid-build.
