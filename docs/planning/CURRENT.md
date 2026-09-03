# Current development state

Lists **in-flight units only** — one line per hub whose `status` is `in_progress`. The working
state for each lives in its own hub, not here (ADR 0185 D2). For everything else — planned,
gated, complete, parked — see the hub files under `docs/features/`.

- **AE4** — authz catalog cutover, `staff_admin` substituted, 3 of 43 permissions load-bearing;
  IA-F9 acceptance MET (run 6/7); Gate AE4 still blocked on the broad QA review's CHANGES REQUESTED,
  `BUG-AE49-D6-REKEY-INCOMPLETE`, the owed `e2e:prod` and C2 → [hub](../features/ae4.md)
- **C2-TIER1** — command-door Tier 1 sweep: 171 of 171 enforcers swept (COVERED 109 · BLIND 40 ·
  ERROR 22), NOT closed — ADR 0184 points 4–5; its work now rides on `authz-ae4-catalog`
  → [hub](../features/c2-tier1.md)
