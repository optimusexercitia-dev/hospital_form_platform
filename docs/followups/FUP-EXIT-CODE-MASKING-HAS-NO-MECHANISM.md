# FUP-EXIT-CODE-MASKING-HAS-NO-MECHANISM — a control that rests entirely on habit, with a measured failure rate (owner: lead; **filed 2026-08-21 as an ACCEPTED RESIDUAL, not as resolved**)

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-08-21 · status open

_**Detail rotated VERBATIM from the Follow-ups section of PROGRESS.md (retired 2026-09-03, ADR 0185) on 2026-08-26**, restoring that index line to its declared one-line form during a size rotation. Nothing was summarised away — the text below is the removed substring exactly as it stood:_

> Measured failure rate **2 occurrences in one day**, both by an operator who knew the narrow form: `gate | tail && commit` landed **a commit on a FAILING gate**, and `cmd; echo "EXIT=$?"` reported a gate that exited **1** as green. ⛔ **Filed as an ACCEPTED RESIDUAL, not resolved** — `pipefail` cannot reach an ad-hoc command, a script cannot detect being piped, no gate can verify an exit code never captured, and a `.claude/rules/` entry fails ADR 0127 admission (POSIX semantics **cannot be shown stale**; an admissible variant would fire on *file edits* and both occurrences touched no file — **admissible and inert**). The control is a habit; recorded plainly, in the same register as the ADR 0131 training premise

**A pipe erases the exit status of everything to its left, and no gate in this repo can catch it.**

**Measured failure rate: two occurrences in one day**, both by an operator who already knew the
narrow form of the lesson:
- `npm run lint:progress 2>&1 | tail -2 && git add … && git commit …` — the `&&` chain reads
  **`tail`'s** status, which is 0 whatever the gate did. ⛔ **A commit landed on a FAILING gate.**
- `npm run e2e:prod > log 2>&1; echo "E2E_EXIT=$?"` — reported as *"the gate finished with exit code
  0"*. The 0 was the **trailing `echo`'s**. The gate had exited **1**, correctly.

⭐ **Both failed in the reassuring direction** — the one that does not prompt a second look.

### ⛔ Why this is filed as ACCEPTED rather than fixed: there is no mechanism to build

| candidate | why it cannot work |
|---|---|
| `set -o pipefail` | cannot reach an **ad-hoc typed** command, which is what both occurrences were |
| a check inside the gate scripts | **a script cannot detect that it is being piped** into something that discards its status |
| `lint:progress` / any repo gate | cannot verify an exit code that was **never captured** |
| a `.claude/rules/` entry | ⛔ **fails ADR 0127 admission.** Its subject is POSIX semantics — it **can never be shown stale**, so `lint:rules` would have nothing to check and it would sit unfalsifiable forever in a 12-slot, byte-bound population. It also has **no honest `paths:` glob**: the trigger is *authoring a command*, not opening a file |

⚠ **An admissible variant is constructible and would be ineffective** — scope to `package.json` +
`scripts/*.sh`, anchor on the gate script names. It would then fire when someone **edits those
files**, and both occurrences touched **no file at all**. **Admissible and inert is not a hint; it is
a fifth rule that never loads when the hazard occurs.**

**So the control is: the operator runs the gate bare, captures `$?` immediately, and reads the
value.** That is a habit, it is the whole of the mitigation, and it has a measured failure rate.
⛔ **Recording it as resolved would be false.** The lesson is generalised in memory (auto-loaded, and
generalised precisely because the narrow *"don't `tail` `e2e:prod`"* form **existed and failed to
transfer** to a different gate) — but memory is prose, and prose has now failed here once.

⭐ **This is filed in the same register as the ADR 0131 training premise at
[dm5-po-decisions.md](../progress/dm5-po-decisions.md) item 2**: when a control rests entirely on a human, this
repo says so plainly rather than letting a green gate imply otherwise. Raised by QA in the round-2
addendum, and the framing is theirs.
