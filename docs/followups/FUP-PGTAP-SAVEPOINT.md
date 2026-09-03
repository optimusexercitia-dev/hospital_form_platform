# FUP-PGTAP-SAVEPOINT — ⚠ **DOWNGRADED 2026-08-13 (🔴→🟡): the original claim was WRONG. No coverage is being lost** (owner: lead + backend)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-19 · status parked

> ## ⛔ CORRECTION — read this before the original text below
>
> **Measured on a clean reset (the run this follow-up demanded): `193` → `ok`, `194` → `ok`,
> ZERO bad plans across 190 files / 6149 tests, `Result: PASS`.** The two "affected" suites are
> **not** losing assertions.
>
> **The true mechanism**, pinned by a two-assertion repro (one outside the savepoint, one inside):
> ```
> plan(2); ok(true,'A'); savepoint s; throws_ok(…,'B'); rollback to savepoint s; finish();
>   → ok 1 - A          ← emitted to stdout
>   → ok 2 - B          ← ALSO emitted; TAP output cannot be rolled back
>   → # Looks like you planned 2 tests but ran 1
> ```
> **pg_prove parses the TAP stream, not pgTAP's internal table.** Both `ok` lines are emitted at
> statement execution and survive the rollback, so **the gate's tally is correct and the
> assertion does count**. Only pgTAP's *internal* counter under-counts, producing a `#`
> **diagnostic** that pg_prove does not treat as a failure.
>
> **What IS real:** the **degenerate** case — when *every* assertion in the file sits inside the
> rolled-back region, `finish()` raises `# No tests run!`, which **does** fail the file.
>
> ⚠ **My error, recorded because it is the more useful part: I generalized from the degenerate
> case.** The original repro was `plan(1)` with its single assertion inside the savepoint — the
> one shape where the internal under-count reaches zero and becomes an error. I proved that shape
> and then asserted the general one, filing a 🔴 gate-integrity item on a mechanism I had not
> tested in the configuration the live suites actually use.
> [[the-proposal-you-author-is-the-one-you-dont-test]], again, and this time it was mine.
>
> **Residual value (why this stays open at 🟡, not closed):** the `finish()` diagnostic is
> genuinely misleading to anyone reading it, and the degenerate shape is a real hazard worth not
> writing. `330`'s captured-definition pattern remains the better style. But **nothing is
> uncovered and no prior gate record is invalidated** — the earlier `194` "planned 8 but ran 0"
> was the dirty-DB artifact, exactly as `backend` suspected and declined to attribute.
>
> The original text below is retained as written, so the correction is legible as a correction.

### (original filing, superseded above) a pgTAP assertion inside a rolled-back savepoint PRINTS `ok` but is DISCARDED from the tally; 2 live suites use the shape

Found by `backend` during DM3·M2 (2026-08-13) and **independently reproduced by the lead
the same day**, twice, against the live DB.

**The mechanism, proven — not inferred.** With `pgtap` installed, two runs differing only
in the savepoint:

```
RUN A:  plan(1); savepoint s; select throws_ok($$ select 1/0 $$,'22012'); rollback to savepoint s; select * from finish();
        → prints  "ok 1 - threw 22012"   then  ERROR: # No tests run!
RUN B:  plan(1); select throws_ok($$ select 1/0 $$,'22012'); select * from finish();
        → prints  "ok 1 - threw 22012"   then  finish() returns 0 rows (clean)
```

pgTAP keeps its results in transaction-local state, so `rollback to savepoint` unwinds its
own bookkeeping along with the mutation. **The assertion still prints `ok`.** The file then
reports `planned N but ran <N`, which a summary line can hide — this is the pgTAP twin of
the class `lint:vacuous` gates for TypeScript, and there is **no equivalent gate for SQL**.

**Live instances — a lead sweep of `supabase/tests/` found the shape in 4 files:**

| File | Verdict |
| --- | --- |
| `193_schema_integrity.sql:89-99` | ⚠ **AFFECTED** — `throws_ok` at `:93` sits inside the window. **Missed by the original report, which flagged only 194.** The enclosed assertion is a *mutation twin* (drop the twin CHECK, assert the refusal still holds) — the kind whose silent non-counting matters most, because its whole job is to prove a barrier is independent |
| `194_tenant_composite_fk.sql:87-95` | ⚠ **AFFECTED** — `throws_ok` at `:89` inside the window (its test 4.1) |
| `330_dm3_controlled_documents.sql` | ✅ **CLEAN** — its 3 hits are *comments documenting the hazard*; the suite mutates without a savepoint and restores from a **captured** `pg_get_constraintdef`, so the restore cannot drift from the real definition |
| `100_dashboard.sql:411-412` | ✅ clean — **and it already carried the explanation**: *"⛔ Deliberately NOT a savepoint. pgTAP keeps its test counter in transaction-local state, so `rollback to savepoint` after an `is()` would rewind the counter."* |

**The most useful part of this finding is that last row.** The hazard was **already known and
already written down** — as a comment in one file, where it protected that file and nothing
else. Two other suites then shipped the shape. Knowledge that lives only in a local comment
does not propagate; that is what `lint:vacuous` and the keystone discipline exist to fix, and
this class had neither. Related: [a comment is an assertion that goes stale silently].

**What is NOT yet established.** The per-suite blast radius. `194` was observed reporting
`planned 8 but ran 0` on a **dirty** local DB, and that is *not* attributed to this mechanism —
`194` is a tenant/commission-count suite and the stack carried E2E leftovers, a known
spurious-red class. The suites cannot be run raw (`test_helpers` is harness-created), so the
real numbers come from `npm run test:db` on a **fresh `supabase db reset`**.

**Discharge:**
1. On a fresh reset, capture `planned N / ran M` for `193` and `194`; if `M < N`, those
   assertions have never contributed to any gate record, and the affected keystones' prior
   green must be re-read as unproven.
2. Rewrite both to `330`'s pattern — mutate without a savepoint, restore from a captured
   definition, and keep the file-level `rollback` as the outer restore.
3. **Add the missing gate.** A `lint:vacuous`-style check for pgTAP: flag any assertion
   between `savepoint` and `rollback to savepoint`, and/or assert `planned == ran` per file
   rather than trusting the summary. Without step 3 this recurs — it already did, twice,
   after being documented once.
