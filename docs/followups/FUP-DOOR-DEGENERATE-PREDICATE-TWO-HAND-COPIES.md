# FUP-DOOR-DEGENERATE-PREDICATE-TWO-HAND-COPIES — the "is a gate already sitting open?" detector exists as two hand-kept copies of the same SQL, in two files, with no gate comparing them

Index entry: [follow-ups-open.md](follow-ups-open.md) · filed 2026-09-05 · status open

**What is wrong.** `DEGENERATE_PREDICATE` — the preflight that refuses to start a sweep on a stack
where some gate is already neutralized — is defined **twice**, verbatim, in two files:

- `supabase/tests/mutation/p0-authz-door-audit.sh` (§7.16 preflight), and
- `supabase/tests/mutation/p0-authz-invariant.sh` (the preflight to EVERY arm of the standing
  §6 step-1 gate).

Nothing compares them. Editing one and not the other leaves one harness able to see a residue the
other cannot, and **the failure is silent in the reassuring direction**: the copy that was not
updated finds nothing, prints `clean — 0 degenerate bodies`, and starts a multi-hour sweep whose
every verdict is a claim about an already-open door.

⭐ **This is the exact defect ADR 0079 Amendment 9 decision 3 fixed one layer up, and the
reasoning transfers verbatim.** `PRED_DOMAIN` used to be two hand-kept copies of the same SQL —
the worklist's filter and the out-of-domain census's `not (…)` — and the fix was not a better copy
but to stop copying: ONE string, interpolated twice, so the two *cannot* drift. The same argument
applies here and has not been applied.

**How it was measured (2026-09-05, unit PRED-DOMAIN).** Adding a fourth neutralization form (the
`P0-SETVALUED-NEUTRALIZED` marker that `authz-setvalued-targeted-cases.sh` writes into a
universal-set body) required editing **both** files, by hand, in the same commit — and the only
thing that made that happen was the plan saying so. `grep -n "P0-SETVALUED-NEUTRALIZED"
supabase/tests/mutation/*.sh` returns one line in each; a future author has no gate telling them
the second exists.

⚠ **The copies are byte-identical today.** This is a drift *hazard* with a live precedent, not a
measured divergence — which is why it is filed rather than fixed inside a unit whose subject was
the domain, not the preflight.

**What would close it.** The definition lives in ONE place and both harnesses read it from there —
either a tiny sourced fragment under `scripts/lib/`, or the same LIFT mechanism
`scripts/door-sweep-cases.sh` already uses on `PRED_DOMAIN` (`lift_block`, three explicit
substitutions, ABORT on any unexpanded `$`), which has the advantage of already being tested.
⛔ **Proven able to fire**: change the single definition, and show that BOTH harnesses' preflights
move — a shared definition that only one consumer actually reads is the same defect wearing a
tidier shape.

⛔ **What must NOT be mistaken for closing it.** A comment in each file pointing at the other. That
is the state today for `PRED_DOMAIN`'s *own* history and it did not prevent the drift; a rule is a
hint, never a substitute for a gate.
