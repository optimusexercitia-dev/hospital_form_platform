---
paths:
  - "PROGRESS.md"
  - "docs/progress/phase-ledger.md"
anchors:
  - docs/progress/now-concluded-2026-08.md#a commit count and a head sha are LIVE
  - docs/decisions/0124-progress-live-state-contract.md
  - PROGRESS.md#measure, never quote
source: ADR 0124
---

# Some facts may only be MEASURED here, never quoted

A tracker row is written once and read for weeks. These four go stale with **nothing in
the repo able to contradict them**, so a reader who quotes one is confidently wrong.

## Measure, every time. Never re-read a recorded figure.

| fact | the only acceptable source |
| --- | --- |
| unpushed commits | `git rev-list --count origin/main..main` |
| head sha | `git rev-parse --short HEAD` |
| remote migrations | `select count(*), max(version) from supabase_migrations.schema_migrations` **on the linked project** |
| remote users / data | `select count(*) from auth.users` **on the linked project** |

⛔ **A count or sha written inside the commit that contains it is off by one BY
CONSTRUCTION.** The § Now AFF2 bullet once read *"39 commits, head `ed125b93`"* and was
already wrong when committed — the Record commit that wrote it was commit 40.

⛔ **It recurs inside the paragraph that warns about it.** On 2026-08-24 § State's ADR 0137
row recorded *"`origin/main..main` = 0 at `ec1271a8`"*; HEAD was `2b69f19f` before the day
ended — again the Record commit that wrote the row. Prefer **dropping** the sha to updating
it: "measured current on <date>" carries the fact without the trap.

⛔ **The remote figures have gone stale FIVE times**, including a "HEAD is behind" claim
that was false when written. Never compute one either — *"444 + 5"* is right until a
migration lands from elsewhere, and that is the day it is wrong.

Provenance — the § Now bullets this was rotated out of, 2026-08-24 —
[now-concluded-2026-08.md](../../docs/progress/now-concluded-2026-08.md).
