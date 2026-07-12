# 0068 — Case-phase result engine: jsonb/array → FK-backed junctions (D3)

**Date:** 2026-07-12 · **Status:** accepted. **Owner:** platform lead → backend.
**Scope:** schema hardening, reset-OK, pre-pilot; branch `f-cleanup`. Detail →
[docs/plans/f-cleanup.md](../plans/f-cleanup.md). Part of the F-cleanup residual-hardening
batch (pre-pilot-foundations-program §F-cleanup; audit item **D3**).

## Context

The case-phase result engine stored `phase_results.id` UUIDs in **un-FK'd** jsonb
arrays — `process_template_phases.allowed_result_ids`, `case_phases.allowed_result_ids` —
and inside jsonb `result_ruleset` objects. The 2026-07 audit (D3) flagged this as a latent
dangling-UUID risk: `phase_results` is soft-deleted, so no defect is reachable today, but a
future hard-delete path would orphan those references. The case side was **already**
FK-covered by the existing `case_phase_offered_results` junction; the real hole was
template-side. Pre-launch reset-OK posture — fix the correct shape, no back-compat.

## Decision

**D3-mid.** Normalize the *allowed* arrays into three FK-backed junctions, keep the ruleset
jsonb:

1. New tables: `process_template_phase_allowed_results` (authored allowed subset, template
   grain), `case_phase_allowed_results` (snapshot, case grain), and
   `process_template_phase_offered_results` — an FK-integrity **shadow** (= allowed ∪
   ruleset rule refs ∪ default) that gives the ruleset's result-ids a real FK while the
   ruleset itself stays jsonb. All with **RLS from creation** mirroring their parents
   (`is_member_of`/`can_read_case` read; `is_staff_admin_of`/`is_commission_admin_of` write —
   ADR-0051 helper), FK `ON DELETE CASCADE`, `(result_id)` index.
2. **`result_ruleset` stays jsonb** — the evaluator `compute_case_phase_result` reads it
   verbatim and is **unchanged** (Architecture Rule 3). **`blocks` stays `integer[]`** —
   positions carry no dangling-UUID risk and the atomic `reorder_template_phase` is untouched.
3. **RPC signatures unchanged** (`add_/update_template_phase` still accept
   `p_allowed_result_ids`/`p_result_ruleset` jsonb; decompose into junction rows internally).
   The query layer re-aggregates the junction back to `allowedResultIds: string[]`, so the
   `ProcessTemplatePhase` domain type is byte-identical — **zero frontend changes**.
4. **Re-enforce the old `*_allowed_shape` CHECK invariant** the drop removed — a non-emitting
   phase (`emits_result = false`) may hold no allowed results — as a guard in the RPCs and the
   case snapshot (the CHECK could not survive the column drop; the junction model needs the
   guard instead).
5. One **atomic** migration (`20260719000000`): create tables/RLS/FKs + recompute helpers,
   `CREATE OR REPLACE` the 6 consuming functions, then drop the two `allowed_result_ids`
   columns + their CHECKs. No backfill (reset-OK).

## Consequences

- Deleting a `phase_results` row FK-CASCADEs out of every junction (template + case grain,
  including a ruleset-only reference) — **no dangling UUID reaches behavior**; proven by the
  keystone pgTAP (`210`).
- Evaluator parity preserved (Rule 3); PostgREST embeds unambiguous (single FK per junction).
- The `emits_result ⇒ no allowed` coupling is enforced by the RPC/snapshot guard rather than a
  table CHECK. `blocks` normalization was explicitly **not** done (out of scope; no dangling
  risk).
