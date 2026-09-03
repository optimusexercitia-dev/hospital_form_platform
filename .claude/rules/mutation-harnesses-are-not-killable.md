---
paths:
  - "supabase/tests/mutation/*.sh"
anchors:
  - supabase/tests/mutation/p0-authz-door-audit.sh
  - supabase/tests/mutation/p0-authz-writepath-audit.sh
  - docs/followups/follow-ups-open.md#meeting_cases_staff_admin_update
source: AE1.5 incident 2026-08-27 — a killed sweep left an UPDATE policy qual=true wc=true for ~4 min
---

# ⛔ Never kill a running sweep — it opens live gates, then restores them

It fails **silently** — no log line, no failing test, no gate red. The instance:
`meeting_cases_staff_admin_update`, `FOR UPDATE`, left open to `authenticated`.

✅ **Let a contaminated run FINISH; discard its verdicts.** ⛔ Never kill it to save time.

## Since 2026-08-29 a kill is CAUGHT, not prevented

`INT`/`TERM`/`HUP` restore on exit; a **crash sentinel** survives what no trap can (SIGKILL,
power cut, killed container), so the next run **REFUSES to start, exit 2** with the restore SQL.

- `RECOVER=1 bash <harness>` applies it — ⛔ then **VERIFY in the catalog**; that message
  is not proof. `supabase db reset` stays the blunt, certain option.
- ⛔ **Never delete the sentinel to clear the refusal** — it restores nothing and is the
  only record a gate is open. ⚠ The killed run's verdicts are void; re-run in full.

## Hunting an open gate: ENUMERATE, never count

`select … from pg_policies where coalesce(qual,'')='true' or coalesce(with_check,'')='true'`
⚠ **~10 are `true` BY DESIGN** (vocabulary/lookup `SELECT` policies). A `count = 0` check
shows ~11, reads as a pre-existing baseline, and walks past the open gate.
⭐ **The discriminator is `cmd <> 'SELECT'`** — no lookup table has a degenerate
non-`SELECT` policy. `degenerate_NON_SELECT` must be **0**.

## ⚠ "DB silence" is the wrong ask

A sweep's baseline is the **suite's shape** (`Files=`/`Tests=`), so **adding a file under
`supabase/tests/**` invalidates a run as surely as touching the database** — and to whoever
adds it, that looks nothing like DB activity. Freeze the **tree**, not just the stack.
