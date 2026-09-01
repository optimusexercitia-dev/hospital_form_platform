---
paths:
  - "supabase/tests/mutation/*.sh"
anchors:
  - supabase/tests/mutation/p0-authz-invariant.sh#ARM 3: census closure
  - docs/design/authz-evolution-arm-baseline-ae0.md#564
  - docs/decisions/0079-authz-door-blindness-standing-invariant.md
source: PROGRESS.md § Now residue, rotated here at the AE0 Record step 2026-08-26 · ADR 0079
---

# An authz arm's EXIT CODE is not its verdict — read what it enumerated

⛔ **Do not trust any authz-gate result predating 2026-08-24.** The step-1 suite was **not
running on this platform at all**, and `ARM=census` printed `INVARIANT HOLDS` **at exit 0
having enumerated ZERO gates**.

✅ **The current trusted baseline is AE0's**, taken on a fresh reset at head
`20261003004300`: census **564** gates / **600** verdicts · hat self-test **6/6** · floor
**72** never-called doors · wrapper BLIND **41** (anchored above).

## What to do, every time

- **Record what the arm ENUMERATED, never that it exited 0.** A green with no count is a
  red: "all four ARMs hold" naming no numbers has not been checked.
- **Fresh reset first.** Absence measured against a stale DB is not absence — `ARM=floor`
  reads phantom never-called doors on a mutated stack.
- ⛔ **Never pipe an arm through `head`/`tail` and read `$?`** — that is the pipe's exit
  code, not the arm's. Capture it directly.
- **A brand-new gate is in no BLIND set**, so it passes `ARM=policy` and `ARM=wrapper`
  **vacuously**. `ARM=census` is the arm that catches a gate you just added.

## Why it is load-bearing

- **No gate enforces this.** An arm cannot report that it measured nothing — that IS the
  failure mode. This rule is the only witness.
- **Green arms bound their own domain.** Reachable `prosecdef` non-`bool` command doors
  sit outside every arm (`FUP-AUTHZ-COMMAND-DOOR-UNSWEPT`, C2) — green is no claim about
  them.
  ⭐ `c2-command-door-neutralizer.sh` (ADR 0171) measures them but is **not an ARM**;
  ⛔ never call the class *"covered-but-unpinned"* — it found **3 BLIND**.
