---
paths:
  - "supabase/tests/mutation/*.sh"
anchors:
  - supabase/tests/mutation/p0-authz-invariant.sh#ARM 3: census closure
  - docs/design/authz-evolution-arm-baseline-ae0.md#564
  - docs/decisions/0079-authz-door-blindness-standing-invariant.md
source: rotated from PROGRESS.md's Now section (retired 2026-09-03, ADR 0185) at the AE0 Record step 2026-08-26 · ADR 0079
---

# An authz arm's EXIT CODE is not its verdict — read what it enumerated

⛔ **Do not trust any authz-gate result predating 2026-08-24.** The step-1 suite was **not
running on this platform at all**, and `ARM=census` printed `INVARIANT HOLDS` **at exit 0
having enumerated ZERO gates**.

✅ **Trust only a baseline a gate record took at a NAMED head** — latest: Gate AE4
(`docs/progress/authz-ae4.md`, census **581**). AE0's 564/600/6/72/41 was the FIRST
trusted one (anchored above), not the current one.

## What to do, every time

- **Record what the arm ENUMERATED, never that it exited 0.** A green with no count is a
  red: "all four ARMs hold" naming no numbers has not been checked.
- **Fresh reset first.** Absence measured against a stale DB is not absence — `ARM=floor`
  reads phantom never-called doors on a mutated stack.
- ⛔ **Never pipe an arm through `head`/`tail` and read `$?`** — that is the pipe's exit
  code, not the arm's. Capture it directly
- **A brand-new gate is in no BLIND set**, so it passes `ARM=policy` and `ARM=wrapper`
  **vacuously**. `ARM=census` is the arm that catches a gate you just added.

## Why it is load-bearing

- No gate enforces this. An arm cannot report that it measured nothing — that IS the
  failure mode. This rule is the only witness.
- Green arms bound their own domain. Reachable `prosecdef` non-`bool` command doors
  sit outside every arm (C2) — green is no claim about them. C2 CLOSED 2026-09-04 at
  170 COVERED / 1 BLIND disclosed / 0 ERROR (ADR 0187/0188); `c2-command-door-neutralizer.sh`
  (ADR 0171) measures them but is **not an ARM**.
