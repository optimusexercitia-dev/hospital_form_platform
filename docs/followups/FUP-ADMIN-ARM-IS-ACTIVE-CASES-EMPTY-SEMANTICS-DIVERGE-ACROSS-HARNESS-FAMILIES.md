# FUP-ADMIN-ARM-IS-ACTIVE-CASES-EMPTY-SEMANTICS-DIVERGE-ACROSS-HARNESS-FAMILIES

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-10 · status open

**The mechanism.** Two sibling homes both key their case selection on a shell variable named
`CASES`, and an empty value means the OPPOSITE thing in each:

- `supabase/tests/mutation/authz-command-door-targeted-cases.sh:69-72` — its own header states it
  in words: *"HERE an empty/unset `CASES` selects EVERY case (`want` returns 0 on `-z`)."* `CASES`
  unset defaults to `""` at line 80 (`CASES="${CASES:-}"`), and the selection predicate (`want()`,
  used at each `CASE 1/2/3` guard) treats that empty string as "no filter" — i.e. run everything.
- The deriver family — `scripts/door-sweep-cases.sh` (which PRODUCES the `CASES=` list a caller is
  meant to export downstream) and its four `p0-authz-*.sh` consumers, each carrying the identical
  line since 2026-09-08: `supabase/tests/mutation/p0-authz-door-audit.sh:113`,
  `p0-authz-invoker-audit.sh:134`, `p0-authz-rowdoor-audit.sh:93`,
  `p0-authz-writepath-audit.sh:272` — `SELECTION_SOURCE="CASES set and EMPTY -> selects NOTHING
  (UNPROVEN, exit 3). ⛔ NOT a full run."` There, an explicitly-empty `CASES` (as opposed to unset)
  is a THIRD state, distinct from both "unset = full run" and "set + non-empty = subset run", and
  it refuses with exit 3 rather than silently running everything or nothing else.

**The hazard, named rather than left to the reader's memory.** `docs/learning/LESSONS.md`'s
"empty is the third state" lesson exists exactly because a prior batch was burned by conflating
these two conventions. The failure shape here is the mirror image: an engineer who has internalised
THAT lesson learns to write `CASES=` (exported, empty string) as the safe/explicit way to say "I
mean the full sweep, and I want that to be checked, not assumed." Reflexively applying that habit
to `authz-command-door-targeted-cases.sh` does not fail loud — it runs every targeted mutation
case, indistinguishable in its exit code and verdict shape from a deliberate subset run that
happened to match everything. The two sibling homes give the SAME input the OPPOSITE meaning, and
only one of the two refuses when it can't tell which the caller meant.

**Why this unit does not fix it.** Ruled out of scope for the fix-loop turn: the task was to draft
the follow-up, not to change either harness's semantics — that is a decision for the lead/PO, since
either direction (make the targeted-cases home refuse-on-empty like its siblings, or teach the
siblings to run-all-on-empty like the targeted-cases home) is a behavior change to a standing
mutation gate, not a bug fix. Batch 10 itself added CASE 2/3 to
`authz-command-door-targeted-cases.sh` (the two targeted cases the tip-gate deriver demanded for
`public.assume_role` and `app.audit_write`) without touching its `CASES=` semantics.

**Closes when**, observably, not narratively:
- `CASES="" bash supabase/tests/mutation/authz-command-door-targeted-cases.sh` exits **3** with a
  `SELECTION-SOURCE`-style message stating the refusal (matching the deriver family's shape:
  distinguishing "unset" from "set and empty"), rather than running every case; **and**
- `unset CASES; bash supabase/tests/mutation/authz-command-door-targeted-cases.sh` (no `CASES` in
  the environment at all) still runs **every** case — the "full sweep" path stays reachable, just
  no longer reachable via an exported empty string; **and**
- a **self-test row** proves both of the above mechanically (not by eye): one row asserting
  `CASES=""` yields exit 3 with the refusal message, one row asserting `unset CASES` yields the
  full case count — mirroring `door-sweep-selftest.sh:612` / `:618`'s own pair for the deriver's
  identical distinction, so the two harness families are asserted the same way, not just described
  the same way.
- ⛔ Not sufficient to close on: updating only the header comment to warn more loudly. The comment
  at `:69-72` already states the divergence correctly — the gap is behavioral, not documentary.

**Origin.** Filed at the Record step of pre-AE5 remediation Batch 10, unit `ADMIN-ARM-IS-ACTIVE`,
disclosed by QA's review of the unit (`docs/reviews/admin-arm-is-active-review.md`, Findings
§ MINOR-2) as "documented, not introduced" — `authz-command-door-targeted-cases.sh`'s CASE 1 and
its `CASES=` convention pre-date this batch; Batch 10 only added CASE 2/3 to the same file and is
the one that surfaced and documented the divergence. Full record:
[`docs/progress/admin-arm-is-active.md`](../progress/admin-arm-is-active.md).
