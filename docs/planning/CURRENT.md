# Current development state

Lists **in-flight units only** — one line per hub whose `status` is `in_progress`. The working
state for each lives in its own hub, not here (ADR 0185 D2). For everything else — planned,
gated, complete, parked — see the hub files under `docs/features/`.

_No unit is in flight (2026-09-03): AE4 and C2-TIER1 landed on `main` and sit in the gate
(`status: gated` in their hubs — QA re-review, one open bug, the final `e2e:prod`, PO approval);
their branch `authz-ae4-catalog` was deleted after the fast-forward. The next unit to start gets a
hub first, then a branch, then a line here._
