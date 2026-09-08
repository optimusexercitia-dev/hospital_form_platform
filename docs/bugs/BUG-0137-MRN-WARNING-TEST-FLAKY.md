---
id: BUG-0137-MRN-WARNING-TEST-FLAKY
status: open
severity: high
area: referrals
opened: 2026-09-08
closed: null
feature: 0137
related_adrs: [0137]
---

# BUG-0137-MRN-WARNING-TEST-FLAKY — `npm run test` reds nondeterministically on the referral MRN-warning suite

> ⛔ **Filed, not fixed.** Found by the independent tip-gate runner of unit `PRIVILEGE-SURFACE`
> (pre-AE5 Batch 7) at `d428d515`, and filed in that unit's fix loop 4 because it was in no
> register of any kind. ⚠ **It is not caused by that unit**: `git diff --name-only main... -- src`
> is 0 bytes there, so this is a pre-existing condition inherited from `main`. The subject file is
> outside the filer's remit and was deliberately left untouched.

## Symptom

`npm run test` (Vitest, the full suite — **Phase Gate §6 step 1**) fails on a clean tree, and
passes on the very next invocation with nothing changed in between.

## Expected behavior

A Phase-Gate step-1 command is deterministic on a clean tree: the same tree gives the same exit
code every run, so its green carries information.

## Actual behavior

`src/components/referrals/referral-send-wizard-mrn-warning.test.tsx`, test **6** —
*"never renders BEFORE the review step, even when the MRN is missing"* — fails at `:259` with:

```
TestingLibraryElementError: Unable to find role="button" and name /enviar encaminhamento/i
```

i.e. a `findByRole` timeout. The file took **11541 ms** on the failing run. Every other file in the
suite passed.

## Reproduction

⚠ **Stated as a sample, never as a rate.** The observations below are `n = 2` full-suite runs plus
one isolated run, all at `d428d515` on a clean tree; they establish load-dependence, not a
frequency. ⛔ Do not quote "one run in two" as a measured rate — it is two runs.

| # | command | rc |
|---|---|---|
| 1 | `npm run test` (full suite) | **1** — test 6 of the file above times out |
| 2 | the same file alone | **0** |
| 3 | `npm run test` (full suite, immediately after) | **0** — 151/151 files, 2056/2056 tests |

Witness: `docs/progress/privilege-surface.md` § Session log,
`### 2026-09-08 — FINAL gate at the tip d428d515 (independent runner)`, command 4 and finding 1.

## Impact

The Phase Gate's step 1 can red on a tree that has nothing wrong with it. That costs a gate run and
sends the next reader hunting for a regression that does not exist — but the larger cost is the
inverse: **a step-1 green stops being evidence**, because a suite that reds nondeterministically
cannot distinguish "the tree is clean" from "the flake did not fire this time". The repo has a
documented flaky baseline for `e2e:prod` (`FUP-E2E-REPEAT-FLAKY`, `docs/testing/e2e-prod-build-gate.md`)
and **none for Vitest**, so a runner who meets this red has nothing to check it against — which is
why it is filed rather than remembered.

## Investigation

- ⛔ **Not this unit's doing**, asserted rather than assumed: the `PRIVILEGE-SURFACE` R5 pathspec
  diff (`git diff --name-only main... -- supabase/migrations supabase/seed.sql src`) is **0 bytes**,
  so no `src/` file changed on the branch the flake was observed on.
- The failure is a `findByRole` **timeout**, and it disappears when the file runs alone — the
  signature of contention for the default async-utility timeout under parallel-worker load, not of
  a wrong query or a missing element.
- ⚠ **Not investigated:** whether the cause is the default 1000 ms `findBy*` timeout, Vitest worker
  concurrency, a slow render in the wizard under load, or a leaked timer from a neighbouring suite.
  Nothing here rules any of those in or out.

## Root cause

_TBD_ — not investigated. ⛔ The `Reproduction` table is a symptom trace, not a mechanism; do not
promote it to a cause.

## Fix

_TBD_

## Regression protection

_TBD_ — ⚠ note for whoever fixes it: a fix verified by "the suite went green" is not verified. This
suite went green on its own, twice, while defective. The fix needs a control that reproduces the
failing state (the file under load, or the timeout budget forced down) and shows it caught.

## Related code

- `src/components/referrals/referral-send-wizard-mrn-warning.test.tsx` (test 6, assertion at `:259`)
  — added by `5c8f3542` `fix(0137): solve nine ADR-0137 follow-ups; two of them by PO ruling`.
- The component under test: `src/components/referrals/` (the send wizard's MRN warning).

## Lesson

A gate command that can red on a clean tree makes its own **green** uninformative — the flake costs
more as a false all-clear than as a false alarm, and an unrecorded flake costs the next runner the
whole diagnosis a second time.

## Resolution

_TBD_ — open.
