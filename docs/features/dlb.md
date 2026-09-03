---
id: DLB
title: Deliberation & Voting Model — typed committee decisions with vote arithmetic the database owns
status: planned
kind: feature
program: DLB
phase: "ADR 0115 (proposed, not ratified) — Slice 0 (ratification + catalog verification)"
branch: ~
plan: ../plans/deliberations.md
progress: ~
reviews: []
adrs: ["0115"]
handoff: ~
fup: ~
---

# DLB — Deliberation & Voting Model

## Acceptance criteria

Full definition: [ADR 0115](../decisions/0115-deliberation-and-voting-model.md) (20 PO decisions,
D1–D20) and [deliberations.md § Slice 0](../plans/deliberations.md). Still open:

- [ ] "PO ratifies ADR 0115 (status → accepted)" (docs/plans/deliberations.md § Slice 0, item 1)
- [ ] "answers the one open build-order question: does Slice 6 (D14, resolutions) wait for the
      ADR 0114 document-model build ... or ship v1 without promotion?" — plan's own recommendation
      is "ship v1 without Slice 6" (docs/plans/deliberations.md § Slice 0, item 1)
- [ ] "Catalog verification checklist — all against the live catalog" (registered migration
      version, free pgTAP suite numbers, `HC0V` SQLSTATE prefix unused, live shapes of
      `commission_meeting_settings`/`meetings`/`meeting_cases`/`commission_member_titles`/
      `memberships`/`controlled_documents.doc_type`, `btree_gist` availability, grant style per
      touched table) (docs/plans/deliberations.md § Slice 0, item 3)

## Current state

**Updated:** 2026-09-03

### Objective

Ratify ADR 0115 and complete Slice 0's catalog-verification checklist — the gate for everything
else; "no phase may start before ratification" (docs/plans/deliberations.md § Status banner).

### Done since start

None.

### In progress

None — status is **ADR PROPOSED, NOT ratified; nothing built and nothing may start**
(PROGRESS.md § Phase Status, DLB row).

### Next

Slice 0 (lead + backend, ~half day): the PO ratification decision, including the Slice-6/ADR-0114
dependency question above; then the catalog-verification checklist; then migration + pgTAP suite
window allocation (docs/plans/deliberations.md § Slice 0).

### Blockers

- **ADR 0115 is not ratified.** Not a scheduling gap — the plan states explicitly that no phase
  may start before it (docs/plans/deliberations.md § Status banner).
- Slice 6 (resolution promotion, D14) additionally depends on ADR 0114's document-model substrate,
  which is ratified but **not built** (ADR 0115 D14); the plan recommends shipping v1 without
  Slice 6 rather than waiting.
