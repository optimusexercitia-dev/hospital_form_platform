# 0173 — the door-sweep deriver is blind to runtime-rewrite migrations; a target-declaration convention with teeth, and the `PRED_DOMAIN` bound routed to C2

**Status:** Accepted · 2026-09-01 (PO-ruled during AE4, before AE4.5)
**Amends:** 0079 — the door-blindness standing invariant. Amendment 8 made a zero-row case list a
FINDING rather than a pass; this ADR closes the case *above* it — a class of migration the deriver
could not see at all, so it reported the honest-looking "nothing to sweep" for a diff that rewrote
`prosecdef` doors.
**Relates:** 0153 (subset runs write to SCRATCH) · 0155 / 0162 (the AE4 program this surfaced in) ·
0172 (AE4's catalog substrate) · `FUP-AUTHZ-COMMAND-DOOR-UNSWEPT` (**C2**), which owns the second
bound named below

## Context — how it surfaced

D2 (the seat-expiry fix, `20261003007180`) rewrote **four** function bodies, two of them
`prosecdef = true` with `authenticated EXECUTE = true`. The diff-scoped sweep derived **zero cases**
and exited 1. Measured rather than assumed: `scripts/door-sweep-cases.sh` selects functions on the
diff **text**, with

```
/create[ \t]+(or[ \t]+replace[ \t]+)?function[ \t]+(app|public)\./
```

and `20261003007180` contains **zero** matches for that, for `create policy` / `alter policy`, or
for `security definer`. It edits bodies it did not author using this repo's house pattern —
`pg_get_functiondef()` + `replace()` + `execute`.

⭐ **The deriver was blind to exactly the pattern CLAUDE.md documents as making migration text
stale-by-design.** Any gate keyed on migration text inherits the same blindness.

**Historical extent, measured:** 33 migrations use the pattern with no create-function line —
including `authz_gate2_sweep_meeting_management`, `authz_dashboard_gate_uniformity`,
`authz002_drop_is_admin_from_hospital_content_doors`. Authorization-door migrations, invisible to
the door sweep.

## Decisions

### 1 — The deriver selects rewrite targets (block 4b)

Two sources, in precedence order: an explicit declaration, then a narrow fallback.

### 2 — ⭐ The convention, and it is ENFORCEABLE — the ruling the PO asked for

**A migration that rewrites function bodies MUST declare its targets in a literal the deriver can
read:**

```sql
-- door-sweep-targets: app.some_fn(), public.other_fn(uuid, jsonb)
```

**Is it enforceable, or a hint that needs a human? ENFORCEABLE.** The deriver can detect a rewrite
migration whose targets it cannot resolve — `pg_get_functiondef` present **and** zero targets
recovered — and exits **1** with its own FINDING block, distinct from Amendment 8's zero-case one.

⭐ **That detection is worth more than the selection.** A migration the deriver *knows it cannot
read* is a completely different state from one it reads as empty, and until now those two were
indistinguishable. The 25-file style is now **loud** instead of silent.

⛔ A convention alone would not have been a gate — the same standard applied to the AE4.4b closure,
where "the migration rebuilds it" was a convention and pgTAP had to be the gate.

### 3 — ⚠ The ceiling is HISTORICAL, not structural

Of the 33, only **8** name their targets in the text at all. The other **25** select targets by
**catalog query at apply time**, whose predicate typically matches *what the migration then
removed* — so re-running it today returns zero and the door list is unrecoverable without a
historical snapshot. ⛔ **No text-based deriver can ever reach those 25.** Forward, the style is
ours to choose, which is what decision 2 fixes.

*(This corrects a premise stated as fact during review — that those migrations name their functions
in `text[]` literals. That held for the one migration examined. It is 8 of 33.)*

### 4 — ⛔ `PRED_DOMAIN` is NOT widened. The bound is NAMED and ROUTED to C2.

The read arm requires `t.typname='bool'`. D2's four return `int4`/`int4`/`int4`/`responses`, so
**even once selected they yield zero cases and the sweep is correctly UNPROVEN.** Selection is this
ADR's success criterion; a passing sweep is not.

Widening `PRED_DOMAIN` would change the **neutralization model**, not the case list — a far larger
change, and unnecessary: **the absent population is substantially C2's.** Measured, the 29 doors
absent from the findings are absent for one structural reason — **not one is
`prosecdef` + `authenticated`-reachable + `returns bool`** — and `create_case`, `cast_case_vote`,
`issue_decision` and `add_ethics_allegation` are already on the C2 Tier-1 worklist. C2 has its own
instrument (`supabase/tests/mutation/c2-command-door-neutralizer.sh`) and its own pre-pilot cutline.

⛔ **Recorded as a cross-reference to C2, never as a new finding.** A finding recorded twice under
two names doubles the register and halves the chance either copy closes.

**Discharge for the recipient-computation subclass** (ADR-level, from D2): a membership-derived role
term is **recipient computation**, not an authority decision, **only if the resolved set is ITERATED
and never BRANCHED ON**. iterate → recipients; branch → authority. If any control flow depends on
whether the caller is in the set, ADR 0079 rule 4's refactor half applies.

### 5 — The lookup's three bounds, so its result is not overread

1. It answers **"does a verdict exist"**, never "is the door correct".
2. The 55 rows are function **references**, not confirmed rewrite targets — some are the *callee
   being removed*, not the door.
3. ⚠ The findings file is **hand-merged from 2026-08-05** (last touched 2026-08-31). Several of
   these migrations rewrote bodies *after* those sweeps, so a `COVERED` verdict describes **the body
   as it was then**.

## Consequences

- **Both detector proofs were required and both were run** (a detector change needs both):
  **(1)** the amended deriver selects all four D2 functions — positive control;
  **(2)** selection is **unchanged** on ranges it already handled — 12 policy ranges, all producing
  non-empty selections, identical orig-vs-amended, and **zero added** on a 52-case range.
- ⛔ **The first draft OVER-SELECTED and the regression sample did not catch it.** Extracting every
  quoted schema-qualified callable returned `is_admin` and `is_commission_admin_of` on
  `20260903000700` — the `replace()` **operands**, the callee being swapped, not the targets.
  Excluding `~` lines was not enough: a replacement literal sits on a line with no `~`. **Naming the
  wrong door is worse than naming none.** The fallback is now gated on the file building an **array
  literal**, which is what a target list is and a replace() operand is not.
  ⚠ The near-miss was possible because the first regression sample contained **no rewrite
  migrations** — it compared the amendment only against ranges the amendment does not touch. A
  regression sample must include the class the change is *about*.
- ⚠ An earlier vacuity check on that same sample found all 60 comparisons **empty on both sides** —
  the script copies were running outside the repo (`FATAL: not a git repository`), so identical
  meant *identically broken*. Re-run inside the repo against ranges known to select.
- **D2 stays UNPROVEN**, correctly. The gate line records: sweep UNPROVEN (exit 3, both arms, zero
  cases), discharged behaviourally under rule 4's compensating-controls clause.
- ⚠ PROGRESS.md describes the C2 worklist as *"derived, 237 lines, never edited"*;
  `supabase/tests/mutation/c2-tier1-doors.txt` measures **255**. Flagged for re-measurement, not
  chased — C2 is not in flight.
