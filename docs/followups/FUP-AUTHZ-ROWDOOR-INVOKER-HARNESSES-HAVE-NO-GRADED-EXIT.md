# FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT — two mutation harnesses print verdicts and then exit 0 whatever they found

**Filed:** 2026-09-05 (QA review of DOOR-SWEEP-DERIVER, the parenthetical under F-MAJOR-5;
confirmed by measurement while wiring the merge abort into the exit codes)
**Owner:** backend
**Severity:** medium — the verdicts are PRINTED, so nothing is hidden from a human reading the
transcript; what is missing is the machine-readable half, and these two are periodic audits
rather than phase-gate arms. It is the same shape as `FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-
HAVE-NO-SENTINEL`, on the same two files, for the same reason: the pair were built before the
door/writepath harnesses grew their contracts and never inherited them.

## The measurement

Taken 2026-09-05 at `7df0bd9b` by reading the tail of every harness in
`supabase/tests/mutation/`:

| harness | graded `RESULT:` block | exit code |
|---|---|---|
| `p0-authz-door-audit.sh` | yes — UNPROVEN / DIRTY / UNPROVEN(PARTIAL) / CLEAN | 3 / 1 / 3 / 0 |
| `p0-authz-writepath-audit.sh` | yes — same four | 3 / 1 / 3 / 0 |
| **`p0-authz-rowdoor-audit.sh`** | **none** | whatever the last `echo` returned |
| **`p0-authz-invoker-audit.sh`** | **none** | whatever the last `echo` returned |

Both end on a summary that counts verdicts —
`awk -F'\t' '{c[$4]++} END{…}' "$PROGRESS"` — and then simply stop. A run with BLINDs, a run
with ERRORs and a wholly clean run are indistinguishable to any caller that reads the status.
`echo` returns 0, so the observable contract is "always 0".

⚠ **This entry is not about `MERGE_FAILED`.** DOOR-SWEEP-DERIVER added an explicit
`if [ "${MERGE_FAILED:-0}" = "1" ] … exit 2; fi; exit 0` to the tail of both files, because the
merge it introduced is its own to make safe. That block is deliberately minimal and closes one
condition only: it does **not** grade BLIND or ERROR, and the `exit 0` beside it is exactly the
status those runs already had. Widening the contract of two harnesses is a change with its own
blast radius (every caller, every recorded run, the wrapper arm's expectations) and belongs to
whoever does it deliberately.

## Why it matters

- ⭐ `.claude/rules/authz-gate-results-need-a-current-baseline.md`: *"An authz arm's EXIT CODE is
  not its verdict — read what it enumerated."* That rule was written because an arm printed
  `INVARIANT HOLDS` at exit 0 having enumerated **zero** gates. Here the inverse is standing:
  an arm can enumerate real BLINDs and still exit 0. Nobody has been bitten yet **because
  neither harness is wired into a gate** — which is the same sentence as "no gate would notice
  if it were".
- Anything that later wires them in (a periodic job, a lead-playbook step, a `npm` script)
  inherits a green that means nothing, and it inherits it silently.

## Closes when

`p0-authz-rowdoor-audit.sh` and `p0-authz-invoker-audit.sh` each end in a graded verdict block
of the same shape as the other two — an explicit `RESULT:` line and a distinct exit code for
0 gates swept over a non-empty domain, BLIND-or-ERROR present, requested-but-unmatched cases,
and clean — **and** each code is proven able to fire: run each harness against a plant that
forces one arm (a `CASES=` naming a gate that matches nothing → the UNPROVEN code; a run whose
progress file carries a BLIND → the DIRTY code), reading the exit code **bare**, never through
a pipe.

⛔ Not closed by adding the block and reading the code off a clean run: a graded exit that has
only ever returned 0 is the thing being replaced.
