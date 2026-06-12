# 0011 — Position reorder via deferrable constraints + SQL swap RPCs

Date: 2026-06-12
Status: Accepted
Phase: 4 (Form Builder & Versioning)

## Context

The builder reorders sections (up/down within a version) and items (up/down
within a section). Ordering is `form_sections.position` (unique per
`form_version_id`) and `form_items.position` (unique per `section_id`). Both
unique constraints were NON-DEFERRABLE, so swapping two adjacent rows
(`A.position ⇄ B.position`) collides the instant the first row takes the
other's value — a naive two-statement swap fails mid-way.

## Options considered

1. **Make the two unique constraints `DEFERRABLE INITIALLY IMMEDIATE`, and do
   the swap as ONE statement** (chosen). The transient duplicate exists only
   within the single statement; the check runs at end-of-statement, by which
   point the two positions no longer collide. `INITIALLY IMMEDIATE` keeps every
   ordinary single-row insert/update checked per-statement (no behaviour change
   anywhere else).
2. **Offset-band reorder** — shift the moved rows into a high temporary band,
   then assign final positions. More statements, a magic band to reason about,
   and still needs care to stay collision-free; no upside over (1).

## Decision

Option 1. The swap MUST be a single `UPDATE ... SET position = CASE id WHEN A
THEN posB WHEN B THEN posA END WHERE id IN (A, B)` statement, so it lives in
SQL as two `security invoker` RPCs — `reorder_section(p_section_id, p_direction)`
and `reorder_item(p_item_id, p_direction)` — in migration
`20260612100010_form_builder_rpcs.sql`. PostgREST/supabase-js cannot express a
CASE update, and two separate `.update()` calls are two separate statements
(the first would still trip the per-statement check), so the swap cannot be done
from the TypeScript action; the B3/B4 reorder actions call these via `.rpc()`.

Each RPC finds the immediate neighbour in the requested direction, returns
silently at a boundary (already first/last — the UI also disables the control),
and runs under the caller's RLS + the published-immutability trigger (draft
versions only).

## Consequences

- Reorder is a single atomic statement; positions stay contiguous and unique.
- The constraints are dropped/recreated with identical names in the new
  migration; no object depends on them (all FKs reference the PRIMARY KEY `id`,
  verified against `pg_constraint`), so the swap is transparent.
- The deferrable window is intentionally tiny: only the swap statement relies on
  it. Cross-section moves (`moveItemToSection`) and item-deletes append/compact
  with plain statements and never lean on the deferred check.
