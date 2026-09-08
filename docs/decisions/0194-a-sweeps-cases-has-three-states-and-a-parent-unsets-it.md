# 0194 — A sweep's `CASES` has three states, and a parent asks for a full run by UNSETTING it

**Status:** Accepted
**Area:** authorization / mutation harnesses
**Related:** [0079](./0079-authz-door-blindness-standing-invariant.md) · [0153](./0153-subset-sweeps-write-to-scratch-not-the-committed-baseline.md) · [0190](./0190-the-door-sweep-deriver-selects-by-property-and-a-full-run-merges.md) · [0191](./0191-the-door-arms-domain-gains-a-schema-axis-a-targeted-home-and-a-fourth-outcome.md)
**Amends:** [0192](./0192-ownership-is-a-proxy-not-the-property-and-the-write-arms-crash-safety.md)

---

## Context

Four mutation harnesses sweep the authorization surface: `p0-authz-door-audit.sh` (boolean
predicate gates and read policies), `-writepath-audit.sh` (write gates), `-rowdoor-audit.sh`
(row-returning DEFINERs) and `-invoker-audit.sh` (invoker wrappers). Each takes an optional
`CASES` subset filter, and each derived two facts from it:

- **selection** — `want()` decided which gates the run would open;
- **placement** — whether the generated findings went to a **scratch** file or were merged into
  the **committed** baseline under `docs/reviews/`.

Both were keyed on the *value* of `CASES` (`[ -n "$CASES" ]`, `[ -z "$CASES" ] && return 0`) after
a `CASES="${CASES:-}"` default had already erased the distinction between "set to the empty
string" and "never set".

ADR 0192 fixed exactly one of the four — the write arm — and said so, on the reasoning that
"fixing one of two would read as fixing the class". `FUP-AUTHZ-EMPTY-CASES-RUNS-A-FULL-SWEEP` and
its twin `FUP-WRITEPATH-BASELINE-CASES-EMPTY-STRING-DEGRADES-TO-A-FULL-RUN` — one mechanism, two
entries filed the same day by two machines that could not see each other — carried the rest.

## Problem

**1. The empty string was indistinguishable from "no selection", and the caller that produces it
is the documented one.** ADR 0079 § The recipe prescribed
`CASES="$(bash scripts/door-sweep-cases.sh <base>)"`. The deriver's **exit 1 FINDING** is a real
outcome — *migrations touched, zero gates derived* — and on it the deriver correctly prints **no
case list**. Command substitution then discards the exit code that WAS the claim, `CASES` becomes
`""`, and the sweep read that as a **full run** over the whole domain, opening the committed
baseline for write. The `exit 3 UNPROVEN` door built for exactly this was unreachable from the
only caller that could produce the state — a correct door nothing can reach.

**2. The harness's only executable caller asked for a full sweep in precisely that syntax, on
purpose.** `p0-authz-invariant.sh` invoked all four children as `CASES= bash <child>` at `:336`,
`:337`, `:338` and `:754`. `VAR= cmd` sets `VAR` to the **empty string** in the child. The close
condition of the follow-up named two harnesses, a self-test scenario and the playbook recipe —
all four satisfiable while this caller stayed broken, because the sweep boundary had been drawn
from the incident's own call path and never saw the other one.

⭐ **The whole lesson is in the reason that line existed.** `CASES=` was introduced there **as a
defence**: its comment reads *"'FULL SWEEP' is now a fact about the child, not a hope"*, guarding
against an exported `CASES` in the operator's environment silently narrowing a child into a
subset whose smaller BLIND set would then read as a clean pass. Re-predicating the child
**inverted the parent's failure mode**. The defence became the defect.

⚠ **`:337` (writepath) was already broken on `main` from Batch 3 until this ADR, and both halves
of that sentence matter.** It is **latent, not observed**: CLAUDE.md §6 step 1 names the gate's
arms as `census`, `hat`, `floor` and `FROMFINDINGS=1 wrapper`, and the broken branch is
`ARM=policy` **without** `FROMFINDINGS` — the ~105-minute full sweep no Phase Gate arm reaches. So
it was not producing a false green anywhere. ⛔ Nor was it harmless: `|| RC=1` would have fired
**loudly at the RC level** while failing **vacuously at the measurement level** — the child writes
`blinds_writepath.SUBSET.tsv` or nothing at all, the union's `awk … 2>/dev/null` swallows the
absence, and the BLIND set silently loses that arm while the arm still prints its size and its
HOLDS line.

**3. The row-door and invoker sweeps could not be fixed by the same edit.** They carry the
byte-identical defective shape but neither has a self-test, a domain gate, a `RESET_EVERY`, or a
`BASE_SHAPE_OVERRIDE`. Porting selection and placement alone would have **replaced one silent
failure with another**: `CASES=""` would stop merging the committed baseline and start writing an
empty scratch report at **exit 0**, indistinguishable from a clean sweep.

**4. A startup-time capture cannot be proven in both polarities from one process.** The fix
requires reading set-ness *before* the default. Every self-test fixture assigns the derived flag
itself, so every row passes whether or not the startup capture exists — the instrument primed by
its own fixture. A run launched with `CASES` unset can never observe what a run launched with
`CASES=""` would have captured.

## Decision

**D1 — `CASES` has THREE states, keyed on set-ness, in all four sweeps.**

| `CASES` | selection | placement | exit |
|---|---|---|---|
| **unset** | everything | committed baseline (a full run may merge it) | 0/1/2 |
| **set, non-empty** | matching keys | scratch | 0/1/2/3 |
| **set, EMPTY** | **nothing** | **scratch** | **3 UNPROVEN** |

Set-ness is captured with `CASES_EXPLICIT=0; [ -n "${CASES+x}" ] && CASES_EXPLICIT=1` **before**
`CASES="${CASES:-}"`. Every run prints a `SELECTION-SOURCE:` line naming which of the three states
it is in, and the UNPROVEN exit repeats it — the old message used `${CASES:+…}`, a *value* test,
so on `CASES=""` it told the operator "0 selected" with no cause.

**D2 — a parent script asks for a full sweep with `unset CASES &&`, never `CASES=`.** All four
`p0-authz-invariant.sh` call sites now read
`( cd "$ROOT" && unset CASES && bash "$HERE/<child>.sh" )`. `unset` means "full sweep" under
**both** the old and the new semantics, so the repair is correct irrespective of which children
carry D1, and `unset` returns 0 whether or not the variable was set, so the `&&` chain is safe.
ADR 0079 § The recipe is edited to read the deriver's exit code **before** substituting its
stdout, with the superseded one-liner quoted in a dated note beside the correction.

**D3 — placement is a FUNCTION, `set_placement()`, that the self-test exercises.** Not a
condition the test restates: a second hand-written copy would prove only that the same `if` can
be typed twice.

**D4 — ported, not copied, and each port proven BY SELECTION.** The three ports differ, and the
differences are load-bearing:

- **door** keeps a **second disjunct** on `BASE_SHAPE_OVERRIDE`, which the write arm's
  `set_placement()` does not have because that harness has no such knob. The two disjuncts are
  keyed differently *on purpose*: an empty `CASES` is a selection that came back empty (a
  **result** — so set-ness), an empty `BASE_SHAPE_OVERRIDE` is no forged shape supplied (an
  **absence** — so value). Copying the write arm's one-disjunct version would silently delete it
  and re-open the hole Batch 0's QA F-MAJOR-3 recorded.
- **row-door** and **invoker** had **no self-test at all**, so each got one, and **no domain
  gate**, so each got a narrow one (D5).
- **invoker** additionally has a `DRYRUN` mode. It is **not** folded into placement: DRYRUN
  classifies without mutating and writes nothing, so it narrows no domain, and forcing it to
  "subset" would mislabel a full classification run as partial.

⛔ Every port is proven by **reverting that harness's own predicates and observing that only that
harness reds** — never by asserting the pattern was inherited.

**D5 — a narrow domain gate in the row-door and invoker sweeps, and its bound is stated.** Zero
selected produces a `RESULT: UNPROVEN` block and bare **exit 3**, placed above the neutralization
loop (and above the invoker's DRY-RUN block, so `DRYRUN=1 CASES=""` cannot print *"supported: 0"*
— a line that file's own text calls proof of a broken detector, which over an empty selection it
would not be). ⛔ **This is exit 3 for the empty-selection case ONLY.** Neither harness has a
graded verdict; a run with BLINDs still exits 0, and
`FUP-AUTHZ-ROWDOOR-INVOKER-HARNESSES-HAVE-NO-GRADED-EXIT` stays open. A partial fix reads as a
complete one unless its bound is written down.

**D6 — the startup capture is asserted from TWO processes.** Each harness records
`CASES_EXPLICIT_AT_STARTUP` (never reassigned, written by no fixture) and prints
`SELFTEST-STARTUP: CASES_EXPLICIT_AT_STARTUP=<bit>`. A new group in
`scripts/door-sweep-selftest.sh` launches all four harnesses **twice** — `unset CASES` expecting
`0`, `CASES=""` expecting `1` — and asserts the bare rc and the printed bit. ⭐ **The pair is the
control**: `unset -> 0` alone is satisfied by hard-wiring the bit to 0, `empty -> 1` alone by
hard-wiring it to 1; only both together pin the distinction, which is the entire defect.

**D7 — no count in a self-test banner is a literal.** The door's `SELFTEST` carried five (`6`,
`6`, `8`, `3`, and the grand `23`). Each arm now counts the rows that executed and the grand
total is the **sum of the parts**, guarded by `TOT -gt 0` because `0/0 ok` reads exactly like a
pass. `docs/lead-playbook.md` stops restating the suite's scenario counts and quotes the derived
`--- GROUP …` lines instead.

## Considered options

1. **Fix only the door arm, as the follow-up's clause literally required.** Rejected: it leaves
   the door's only executable caller broken and repeats Batch 0's mis-scoped closure, which Batch
   2 paid for with a voided run.
2. **Make `set_placement()` always report a subset** ("then nothing can ever write the
   baseline"). Rejected, and it is the *tempting* wrong fix because it looks maximally safe: it
   breaks every legitimate full sweep and every merge, and the self-test's row A exists to red on
   exactly it.
3. **Make `verify_baseline_untouched()` unconditional.** Rejected: since ADR 0190 a full run
   *legitimately* rewrites the committed baseline through a merge, so this turns every full sweep
   into a FATAL abort — re-predicating one gate inverting another gate's failure mode, which is
   the very shape this ADR is about.
4. **Make `door-sweep-cases.sh` print a case list on its FINDING exit.** Rejected: withholding
   the list is the one thing it does correctly there.
5. **A committed operator recipe instead of the two-process runner.** Rejected: the follow-up's
   own clause refuses closure by *"a note telling operators to check by hand"*.
6. **`env -u CASES` instead of `unset CASES &&`.** Equivalent; `unset` chosen for having no
   external dependency.

## Consequences

- The only behaviour that changes is the set-and-empty state. Unset, set-non-empty-matching,
  set-non-empty-unmatched, and `BASE_SHAPE_OVERRIDE` runs are byte-for-byte unaffected, and the
  self-test rows A/B/B2/D are the regression surface that says so.
- ⚠ **Named, intended, and inert:** for the empty state the door's `resets_enabled()` flips
  yes → no (because `SUBSET_RUN` becomes 1 with `RESET_EVERY` non-explicit) and
  `verify_baseline_untouched()` becomes enabled. Both are **unreachable** in that state — every
  reset call site sits below the `exit 3` gate — and are stated because the *variables* changed
  and a later refactor moving the gate would make them live.
- ⚠ **What is corrected but NOT proven:** the `PARTIAL RUN` blockquote in the door and write arms
  now keys on set-ness, and for `CASES=""` that line is **unreachable** — `emit_body` runs only
  from `record()`, past the exit-3 gate. It was corrected because it would mislabel a future
  caller, not because a scenario exercises it. Calling it proven would be the vacuity this ADR is
  about. The residual is filed as
  `FUP-DOOR-PARTIAL-RUN-BLOCKQUOTE-KEYED-OFF-PLACEMENT`.
- ⚠ **The fifth sweep is NOT ported.** `c2-command-door-neutralizer.sh` has the same defect in a
  different expression — four placement disjuncts at `:134`, a `case " $CASES " in` selector at
  `:880` and no `want()` at all — so a template port would be the copy-not-port error. Filed as
  `FUP-AUTHZ-C2-NEUTRALIZER-EMPTY-CASES-NOT-PORTED`.
- ⚠ Gate records quoting `TOTAL: 23/23` for the door self-test are historical figures for an older
  row count and stay correct as such. No back-editing.
- Two follow-up ids close on this work and **neither is retired or consolidated**: retiring an id
  orphans every citation naming it.
