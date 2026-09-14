# FUP-AE5-STAFF-PERIODIC-RESET-LINE-PRINTS-THE-RUNNING-TOTAL

**Filed:** 2026-09-14 (unit `AE5-STAFF`, T8) · **Owner:** backend
**Severity:** low — cosmetic in the code, but the line is READ AS EVIDENCE in gate records, and it
over-states the very quantity `RESET_EVERY` exists to bound.
**Status:** open

## The defect

`supabase/tests/mutation/p0-authz-door-audit.sh`'s scheduled reset announces itself as

```
--- PERIODIC RESET (scheduled — N case(s) swept since the last baseline) ---
```

but `N` is `$((DONE - 1))` — the **running total of cases swept in the run**, not the count since
the previous reset. The two coincide only for the first reset.

Measured on AE5 T8's door-audit gate run (`RESET_EVERY=5`, confirmed in `/proc/<pid>/environ` for
both PIDs), the four scheduled lines read:

```
--- PERIODIC RESET (scheduled — 5 case(s) swept since the last baseline) ---
--- PERIODIC RESET (scheduled — 10 case(s) swept since the last baseline) ---
--- PERIODIC RESET (scheduled — 15 case(s) swept since the last baseline) ---
--- PERIODIC RESET (scheduled — 20 case(s) swept since the last baseline) ---
```

Every one of those resets came **5 cases** after the previous baseline. The fourth line says 20.

## Why a cosmetic line is worth a follow-up

The whole point of `RESET_EVERY` is the sentence a gate record gets to write: *"the drift any
verdict can carry is bounded to N cases."* This line is the run's own evidence for that sentence,
and it reports the bound as **4× larger** than it was at the fourth reset — growing without limit
as the run goes on. A reader auditing whether a `NOTICED` was attributable would read "20 cases of
drift" where the true answer is 5, and could reject a sound verdict — or, on a longer run, accept
the number as proof of a bound the harness was in fact enforcing far more tightly.

⚠ It is the **inverse** of the usual failure: the text errs toward looking *worse* than reality,
so nobody is harmed by trusting it — which is exactly why it can sit unnoticed indefinitely. A
register's failure mode is prose rot, and the false clause that errs tighter reads as care.

## Closes when

The scheduled line prints the count **since the last reset** (`DONE - LAST_RESET_AT`, or an
equivalent counter reset inside `periodic_reset`), and **one run shows the corrected line at the
SECOND reset** — the first reset cannot distinguish the two quantities, so a run that stops after
one is not a proof. With `RESET_EVERY=5` the second line must read `5 case(s)`, not `10`.

⛔ Do not close this by rewording the line to say "swept so far" — that would make the text true
and leave the gate record without the number it actually needs. The count since the last baseline
is the quantity; print it.

## Scope note

Checked in the same pass: `p0-authz-writepath-audit.sh` and `c2-command-door-neutralizer.sh` are
the only other harnesses that read the knob (`grep -cE '\$\{?RESET_EVERY'` → 11 and 13). Whether
they carry the same wording is **not measured here** and should be checked when this is fixed —
⛔ do not assume they share the defect, and do not assume they do not.
