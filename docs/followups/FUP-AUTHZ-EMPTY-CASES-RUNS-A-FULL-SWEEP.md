# FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP — an empty-but-set `CASES` selects EVERY gate and takes the full-run branch

**Filed:** 2026-09-07 (unit ENFORCEMENT-MANIFEST, QA fix loop iteration 1 — measured by the `lead`
the same day on this unit's tip gate)
**Owner:** lead · **Severity:** high — nothing about the *finding* is wrong; what is wrong is what
the shell does with it. The failure is silent, expensive, and it writes.

## What was measured

The lead's tip-gate chain ran the diff-scoped deriver and substituted its stdout:

```sh
CASES="$(bash scripts/door-sweep-cases.sh main)" bash supabase/tests/mutation/p0-authz-door-audit.sh
```

The deriver exited **1 — FINDING**, having resolved a door (`public.set_item_validations`) that no
arm's `PRED_DOMAIN` can select, and printed **no case list**. The substitution therefore set `CASES`
to the **empty string** — *set*, but empty — and the harness ran a **FULL sweep over the whole
domain**. It had to be killed after it had been running for hours, mid-merge, having already begun
rewriting the committed findings baseline.

> ⚠ **CORRECTED 2026-09-08, beside the original — the two figures in the sentence above are both
> wrong, and the unit's own record measures them.** [`docs/progress/enforcement-manifest.md`](../progress/enforcement-manifest.md),
> § *tip gate*, *"Two lead errors, recorded"*, first person and same day: the run *"swept
> `app.can_create_professional`, not in the diff"*, its merge *"then aborted on Apple diff"*, and it
> was **`killed after ~10 min`** — then, measured rather than assumed, **`git diff --stat` on both
> committed findings files empty**, DB restored by a fresh reset, and the two stale sentinels it left
> inspected and found healthy (`RECOVER=1` not needed). So: **~10 minutes, not hours**, and the
> committed baseline was **byte-unchanged**, not "already begun rewriting".
>
> ⛔ **This is not a downgrade, and the severity above stands unamended.** What stopped the run was an
> **unrelated merge abort plus a human noticing** — no guard fired, nothing reported, and
> `PARTIAL RUN — CASES=""` was never printed because it cannot be. An incident survived by luck is
> the same defect as one that is not; the argument for fixing it is *silent + it writes + reachable
> from the documented recipe*, none of which depends on how long that one run lasted.
>
> ⭐ The drift is worth naming because this file **is** the evidence a later session will quote: a
> narrative sentence in a follow-up body and a measured line in a record disagreed for a day, and the
> narrative is the one that reads as more alarming, so it is the one that gets repeated. It was, into
> the plan's Batch 6 row and the open register — both corrected the same day.

## The mechanism, in the two harnesses' own lines

`supabase/tests/mutation/p0-authz-door-audit.sh`:

```sh
:1096  want () {  # $1 = match key (proname or polname); returns 0 if in CASES (or CASES empty)
:1097    [ -z "$CASES" ] && return 0          # ⛔ EMPTY selects EVERYTHING
:128   if [ -n "$CASES" ] || [ -n "${BASE_SHAPE_OVERRIDE:-}" ]; then
:129     SUBSET_RUN=1                          # ⛔ EMPTY is NOT a subset run …
:130     FINDINGS="$WORK/authz-door-audit-findings.SUBSET.md"
       else                                    # … so it falls to the branch that
                                               #    WRITES THE COMMITTED BASELINE
```

`supabase/tests/mutation/p0-authz-writepath-audit.sh` has the identical shape at `:315`
(`[ -z "$CASES" ] && return 0`) and `:201` / `:1064` (`if [ -n "$CASES" ]`).

So the two states the caller cares about — *"no subset asked for, sweep everything"* and *"a subset
was asked for and it came back empty"* — are **the same state** to both harnesses. The harness
cannot tell "unset" from "set to nothing", and the more dangerous reading is the default.

## Why it is worth a gate rather than a note

* It is reachable from the **documented** recipe. `$(bash scripts/door-sweep-cases.sh <base>)` is how
  the lead-playbook § 4 chain derives its case list, and the deriver's `FINDING` exit — the outcome
  ADR 0191 added precisely so a door outside every `PRED_DOMAIN` is *named* rather than swallowed —
  is exactly the outcome that empties the substitution.
* The consequence is a **write**. A full run merges into the committed
  `docs/reviews/authz-*-findings.md` baseline; a killed full run leaves the contamination
  `FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` Part 2 describes (and, per that item, a killed run can leave
  an RLS policy neutralized with nothing reporting it).
* The operator sees no signal at all: `PARTIAL RUN — CASES=""` is not printed, because
  `if [ -n "$CASES" ]` is false. The run looks exactly like a deliberate full sweep.

## Closes when

An empty-but-set `CASES` is a **FINDING exit** — never a full run — in **both** harnesses, **proven
able to fire** (a scenario in `scripts/door-sweep-selftest.sh` that passes `CASES=""` and requires
that exit), **and** the lead-playbook § 4 recipe reads the deriver's **exit code** before
substituting its stdout.

⛔ **Not** closed by telling operators to check by hand: the shape of the bug is that the check is
invisible at the call site. ⛔ **Not** closed by making the deriver print something on a FINDING
exit either — a case list it must not emit is the one thing it correctly withholds.

## Relation

`FUP-DIFF-SCOPED-SWEEP-IS-HALF-AIMED` **Part 2** ("arm 2 reports success at exit 0 having measured
nothing") is the same family: a run that measured nothing must not be readable as a run that
measured everything, in either direction. That item is Batch 3's, on the other machine, and it edits
these same two harnesses — which is why this was **deliberately not fixed** in ENFORCEMENT-MANIFEST.
