# Current development state

Lists **in-flight units only** — one line per hub whose `status` is `in_progress`. The working
state for each lives in its own hub, not here (ADR 0185 D2). For everything else — planned,
gated, complete, parked — see the hub files under `docs/features/`.

- **DOCS-CONSOLIDATION** — [Documentation consolidation](../features/docs-consolidation.md), one
  home per fact (ADR 0186, proposed); branch `docs-consolidation`. This file is deleted by that
  unit's Wave 2 (ADR 0186 D1) together with the arm that gates it.
