# FUP-C2-TIER1-VALUE-ASSERTIONS-ABORT-ON-AN-INLINE-RAISE

**Filed:** 2026-09-04 (C2 closure — found while fixing the last 4 residual abort sites)
**Owner:** backend
**Severity:** high — **296 measured latent sites**. Each is invisible to a green suite and can only
surface as an `ERROR` (a lost verdict) on some future mutation sweep, never as a wrong answer.

## The mechanism

> **A pgTAP *value* assertion — `is` / `isnt` / `ok` / `cmp_ok` / `isa_ok` — evaluates its subject
> expression *before* the assertion function is entered. So a door that raises inside that
> expression cannot fail the test: it aborts the file.** The mutation harness then reads a shape
> change and scores **`ERROR` — not a red** — so the verdict is lost rather than earned.

`throws_ok` and `lives_ok` are immune, because they take the statement as *text* and `EXECUTE` it
inside a `BEGIN … EXCEPTION` block.

**Fix pattern — capture, then assert.** Create the destination *empty*, do the call as
`lives_ok($$ insert into t … select door(…) $$)`, and assert on the captured value. A refused call
then leaves the assertion reading NULL — scored — instead of crashing, and the `lives_ok` names the
refusal as its own test.

## Why it is a real class and not a one-off

It was hit **four times in one day** across unrelated work: three "capture for `is`/`isnt`" edits in
Phase B1 (`80`, `305:358`, `350:558`), and then `305`'s assertion 6.7 at C2 closure — the one that
cost `cancel_minutes_job` its verdict on a full sweep. `305` had *already documented two other
variants of the same hazard in its own comments* (an `isnt()` at §4.9, and a `21000` scalar-subquery
abort at 6.8); the door-raises-inside-`is()` variant is simply the one nobody had reached yet.

## The measured population — 296 sites across 60 of 262 files

Method (`inline-raise-census.py`, C2 closure): population = the 171 derived enforcers ∪ the 237
Tier-1 door lines = **265 names**; a site is a statement-initial `select is|isnt|ok|cmp_ok|isa_ok(`
whose **first argument** calls one of those names, extracted by a **balanced-paren scan honouring
dollar-quotes and doubled quotes** — not a flat grep. **6216** value-assertion sites scanned, **296**
match: `is` 257 · `ok` 24 · `isnt` 12 · `cmp_ok` 3. Worst files: `279_accreditation_dispatch` 42 ·
`228_ethics_e1` 24 · `261_charters_rpcs` 19.

⚠ **Read the bound in both directions.** It is an **upper** bound on latent aborts — a site only
aborts if that door actually raises in the state its file built. It is a **lower** bound in another
— a door reached through a helper outside the 265-name population is not counted.

## Closes when

Either (a) the 296 are triaged and the reachable subset converted to capture-then-assert, or (b) a
gate detects the shape — a lint pass over `supabase/tests/*.sql` flagging a value assertion whose
first argument calls a door in the derived population, which is the same balanced-paren scan the
census already implements. ⛔ **Not closed by "no sweep has hit one yet"** — that is the state this
entry describes, and it is exactly the absence-of-a-verdict-is-not-absence-of-coverage error.

⚠ Fixing all 296 blindly is **not** proposed. Most will never be reached by a mutation that makes
their door raise; the value is in the triage and the detector, not the churn.

## Related

- **LEARN-083** — the register row for this shape.
- `docs/reviews/c2-suite-abort-diagnosis.md` — the 18-door class this is the residue of; note the
  distinction, since the two are easily conflated: those 18 aborted **downstream** of a scored
  failure (the suite noticed, then crashed), whereas these sites abort **instead of** scoring, so
  nothing notices at all.
- ADR [0079](../decisions/0079-authz-door-blindness-standing-invariant.md) — a verdict lost to an
  `ERROR` is not a covered door.
