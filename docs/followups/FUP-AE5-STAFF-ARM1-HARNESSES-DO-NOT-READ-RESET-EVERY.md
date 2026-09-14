# FUP-AE5-STAFF-ARM1-HARNESSES-DO-NOT-READ-RESET-EVERY

**Filed:** 2026-09-14 (unit `AE5-STAFF`, T8) · **Owner:** backend
**Severity:** medium — no wrong verdict is known to have come from it; what is missing is the
BOUND on how much drift a verdict may carry, in two harnesses that run the full suite per case.
**Status:** open

## The measurement

Counting **reads of the variable** across all 38 harnesses in `supabase/tests/mutation/` —
`grep -cE '\$\{?RESET_EVERY'`, not `grep -c RESET_EVERY`, because a bare count returns prose hits
and would have reported these files as fine:

| harness | mentions | **reads** |
| --- | --- | --- |
| `p0-authz-door-audit.sh` | 35 | **13** |
| `p0-authz-writepath-audit.sh` | 38 | **11** |
| `c2-command-door-neutralizer.sh` | 31 | **13** |
| `p0-authz-rowdoor-audit.sh` | **0** | **0** |
| `p0-authz-invoker-audit.sh` | **0** | **0** |
| every other harness (33 files) | 0 | 0 |

`p0-authz-rowdoor-audit.sh` and `p0-authz-invoker-audit.sh` are **two of ARM 1's three sweeps**
(the standing invariant of ADR 0079 / ADR 0078 §7.14). Both define
`run_suite () { ( cd "$ROOT" && supabase test db ) 2>&1; }` and drive a per-door
`while IFS=$'\t' read -r oid label proname` loop — the same mutate → full-suite → restore shape the
door audit bounds with `RESET_EVERY`. Neither accepts the knob: an operator typing
`RESET_EVERY=5 bash …` gets a run that looks configured and is not.

## Why it matters

Every verdict in those two sweeps carries whatever drift the cases before it left, for the whole
run, with no reset and no baseline re-capture. That is precisely why AE5 T8's door-audit gate run
was **restarted** with `RESET_EVERY=5`: across 34 mutate/restore cycles an unbounded run makes any
`NOTICED` unattributable, and a harness's own restores are the thing under suspicion — a restore
that half-applied is invisible to the arm that performed it.

⚠ Not a defect in every harness that lacks the knob. `act-hat-blind-sweep.sh` was measured the
same way (0 reads) and **deliberately not ported**: it contains no `supabase test db` at all — it
is catalog analysis, so there is no per-case drift to bound and the knob would be decoration.
The distinguishing property is *runs the full suite inside a per-case loop*, not *lacks the knob*.

## Closes when

Both harnesses **read** the knob, with the door audit's rule stated in each file and the two facts
it turns on written down:

1. **set-ness, not value**, captured BEFORE the default is applied — `RESET_EVERY=20` typed by an
   operator and `RESET_EVERY` defaulted to 20 are the same string one line later;
2. the **default** each file chooses, with its measured reason — the door audit's 20 fits a
   34–150-case domain; a small domain needs a different default or the knob never fires and is
   indistinguishable from not being implemented (that reasoning is recorded in
   `authz-setvalued-targeted-cases.sh`, ported at T8 with default 0 and its deviations stated).

Proven by **one run each** showing the reset actually fires and announces itself — not by the
presence of the code. ⛔ A port whose run is never executed is the same class of claim this
follow-up exists to close.

## Prior art to copy

`p0-authz-door-audit.sh` lines ~253–262 (`RESET_EVERY_EXPLICIT` / `resets_enabled`), its
`periodic_reset` with the **sentinel interlock first** (a reset with a mutation in flight destroys
the evidence and its restore in one command), `maybe_periodic_reset`, and its ARM-2 self-test table
`rt_case` — six rows pinning the polarity, including `B'` (SUBSET, `RESET_EVERY=20` EXPLICIT → yes)
against `A` (SUBSET, defaulted 20 → no), which is the set-ness fact made falsifiable.
