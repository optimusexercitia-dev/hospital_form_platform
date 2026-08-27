---
paths:
  - "supabase/tests/mutation/**"
anchors:
  - supabase/tests/mutation/p0-authz-door-audit.sh
  - supabase/tests/mutation/p0-authz-writepath-audit.sh
  - docs/progress/follow-ups.md#meeting_cases_staff_admin_update
source: AE1.5 incident 2026-08-27 — a killed sweep left an UPDATE policy qual=true wc=true for ~4 min
---

# ⛔ Never kill a running sweep — it restores gates from an EXIT trap

These harnesses **open a gate in the live catalog**, run the suite, then restore it from a
`trap … EXIT`. **Killing one (`TaskStop`, Ctrl-C, a timeout) skips the restore and leaves the
gate WIDE OPEN** — no log line, no failing test, no gate red.

**Measured 2026-08-27:** a killed run left `meeting_cases_staff_admin_update` at
`qual=true wc=true` — a `FOR UPDATE` policy open to `authenticated` — for ~4 minutes.

## If a run is contaminated

✅ **Let it finish and discard the verdicts** — 15 wasted minutes beats an open gate.
⛔ Never kill it to "save time".

## If one was killed anyway

1. **Enumerate degenerate policies — never count them:**
   `select … from pg_policies where coalesce(qual,'')='true' or coalesce(with_check,'')='true'`
   ⚠ **~10 are `true` BY DESIGN** (vocabulary/lookup `SELECT` policies). A `count = 0` check
   shows ~11, reads as a pre-existing baseline, and walks past the open gate.
   ⭐ **The discriminator is `cmd <> 'SELECT'`** — no lookup table has a degenerate
   non-`SELECT` policy. `degenerate_NON_SELECT` must be **0**.
2. **Restore with `supabase db reset`**, not by hand-writing the predicate back — a reset
   rebuilds from migrations, so a subtly-wrong restoration is impossible, and it repairs
   whatever else the kill left behind.

## "DB silence" is the wrong thing to ask for

A sweep's baseline is the **suite's shape** (`Files=`/`Tests=`), so **adding a file under
`supabase/tests/**` invalidates a run as effectively as touching the database** — and to
whoever adds it, that looks nothing like DB activity. Freeze the **tree**, not just the stack.
