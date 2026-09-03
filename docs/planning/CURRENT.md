# Current development state

Lists **in-flight units only** — one line per hub whose `status` is `in_progress`. The working
state for each lives in its own hub, not here (ADR 0185 D2). For everything else — planned,
gated, complete, parked — see the hub files under `docs/features/`.

- **AE4** — authz catalog cutover, `staff_admin` substituted, 3 of 43 permissions load-bearing;
  Gate AE4 blocked on QA CHANGES REQUESTED + IA-F9 NOT MET + C2 open → [hub](../features/ae4.md)
- **C2-TIER1** — command-door Tier 1 sweep (237 PHI-touching doors), 8 of 171 enforcers measured,
  full sweep unrun → [hub](../features/c2-tier1.md)
- **DOCS-RESTRUCTURE** — ADR 0185: feature hubs, CURRENT.md, gated registers; gate-first, merges
  after AE4 → [hub](../features/docs-restructure.md)
