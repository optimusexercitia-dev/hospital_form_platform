---
paths:
  - "supabase/tests/mutation/*.sh"
anchors:
  - supabase/tests/mutation/c2-command-door-neutralizer.sh#RESTORE FAILED
  - docs/followups/FUP-C2-TIER1-INFLIGHT-SENTINEL-ERASED-BY-ITS-OWN-RESTORE.md
source: AE1.5 2026-08-27 open UPDATE policy; C2 B2a 2026-09-04 stranded gate
---

# ⛔ Never kill a running sweep — it opens live gates, then restores them

✅ Let a contaminated run FINISH; discard its verdicts. ✅ Launch DETACHED, outside the
tool's job tree, own `WORK` + sentinel path, **no timeout**. Full C2 sweep ≈ 9.5 h:
RE-MEASURE, never quote.

## A kill is CAUGHT — only where a harness has a SENTINEL

C2 + `p0-authz-{door,writepath}-audit.sh`; ⛔ NOT `p0-authz-{invoker,rowdoor}-audit.sh`
(`FUP-AUTHZ-INVOKER-AND-ROWDOOR-HARNESSES-HAVE-NO-SENTINEL`).

⚠ A sentinel survives SIGKILL; 2026-09-04's signal was a job-tree **SIGTERM** — the trap
runs, its `psql` child dies with the group, the restore fails. Believe a restore only when
the **CATALOG agrees**: psql rc **and** live `md5(pg_get_functiondef)` = the snapshot. ⭐ **A failed restore KEEPS the sentinel**; the next run
REFUSES, exit 2. An exit status alone was never proof — without `ON_ERROR_STOP=1` psql
returns 0 on a SQL ERROR.

⛔ **Never delete the sentinel**: it restores nothing and is the only record a gate is
open. `RECOVER=1 bash <harness>` applies it; VERIFY in the catalog — that message is no
proof. `supabase db reset --local` is the blunt option.

## Hunting an open gate: ENUMERATE, never count

`pg_policies where coalesce(qual,'')='true' or coalesce(with_check,'')='true'`
⚠ **~10 are `true` BY DESIGN** (vocabulary `SELECT` policies), so a `count = 0` check
shows ~11 and reads as a baseline. ⭐ Discriminator: `cmd <> 'SELECT'` —
`degenerate_NON_SELECT` must be **0**.

## "DB silence" is the wrong ask

A sweep's baseline is the suite's SHAPE (`Files=`/`Tests=`), so **adding a file under
`supabase/tests/**` invalidates a run as surely as touching the database** — and looks
nothing like DB activity. Freeze the TREE.
