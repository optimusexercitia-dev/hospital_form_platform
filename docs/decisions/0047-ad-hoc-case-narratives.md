# ADR 0047 — Ad-hoc Case Narratives (per-case narrative add on an open case)

**Status:** Accepted · **Date:** 2026-07-01 · **Feature:** Ad-hoc Case Narratives
(additive, feature-flagged under the existing `case_narratives` flag).
**Extends / partially reverses:** ADR [0032](0032-case-narratives.md) (Case
Narratives — decision 7's "template-fixed per case, no per-case add/remove/reorder
in v1"). **Mirrors:** ADR [0017](0017-multi-phase-cases.md) / ADR
[0044](0044-processless-cases.md) (`add_ad_hoc_phase`, `case_phases.is_ad_hoc`).

## Context

ADR 0032 (decision 7) deliberately froze a case's narrative set at creation: a case
snapshots its narratives from the process template and offers **no per-case
add/remove/reorder** in v1. That was the right minimal scope for the templated case.
It leaves two gaps now that other features have landed:

- **Process-less cases** (ADR 0044, `template_id IS NULL`) start with **zero
  narratives** and — unlike phases, which they grow via `add_ad_hoc_phase` — had **no
  way to ever gain one**. A coordinator working an ad-hoc issue could add phases but
  never a "Resumo Clínico" / "Conclusão do Comitê" prose block.
- Even templated cases occasionally need a prose section the template author did not
  anticipate, discovered only while working the case.

Phases already solved the identical shape with `add_ad_hoc_phase` (append-only, open-
case-only, coordinator-gated, `is_ad_hoc` provenance). Narratives should grow the same
way.

## Decision

1. **A coordinator may add an ad-hoc narrative to an OPEN case**, via a new
   `public.add_ad_hoc_narrative(p_case_id, p_narrative_type_id?, p_new_type_label?,
   p_title?, p_instructions?, p_assigned_to?)` RPC — the narrative analogue of
   `add_ad_hoc_phase`, `SECURITY DEFINER`, coordinator-gated (`is_staff_admin_of`
   OR `is_org_admin_of_commission`; plain `staff` denied 42501). This **reverses
   ADR 0032 D7's "no per-case add" for open cases only.** Remove/reorder on a case
   remain out of scope (still template-authored), so the reversal is narrow.

2. **Provenance via `case_narratives.is_ad_hoc`** (new column, default `false`), exact
   parity with `case_phases.is_ad_hoc`. Added to the audit allow-list; surfaced in the
   UI as the pt-BR **"adicional"** chip, mirroring the ad-hoc phase chip (Rule 10).

3. **Append at the bottom of the interleave.** `display_position := max+1` over the
   UNION of the case's phases (`coalesce(display_position, position)`) and narratives
   (`display_position`) — copied verbatim from `add_ad_hoc_phase`. The new narrative
   starts `status = 'aberta'`, no body, `is_expected = false` (an ad-hoc mid-case
   addition is not a pre-declared template expectation, so it is never part of the
   advisory conclude warning of ADR 0032 D6).

4. **Type source: pick from the commission vocabulary, with inline create-or-reuse.**
   The dialog picks an existing `case_narrative_types` row, or the coordinator types a
   new label. A new label is resolved **atomically inside the RPC**
   (`insert … on conflict (commission_id,label) do update set label=…, archived=false
   returning id`), so a failed narrative insert can never orphan a type, and reusing an
   archived label **un-archives** it (bringing it back to the picker). `type_label` is
   snapshotted `coalesce(nullif(title,''), type.label)` — the effective-label rule of
   ADR 0032. This is essential for process-less cases whose commission may have an
   empty vocabulary.

5. **Same guards as the phase RPC.** Terminal case → **HC020** (checked before type
   resolution); assignee must be a commission member → **HC021**; a
   `p_narrative_type_id` from another commission → **HC054**. `body_md` / `title` /
   `instructions` stay OUT of the audit metadata (Rule 11); the body is still authored
   only through the existing sanitized-Markdown editor (Rule 7) — the add-dialog never
   accepts a body.

## Alternatives rejected

- **Two-round-trip inline create** (dialog calls `create_case_narrative_type`, then
  `add_ad_hoc_narrative` with the returned id). Rejected — a failed second call would
  leave an orphan type; the atomic in-RPC create-or-reuse is one audited transaction.
- **A free-text one-off label with `narrative_type_id = NULL`.** Rejected — it would
  not group with typed narratives or appear in the vocabulary; the create-or-reuse path
  gives the same flexibility while keeping provenance.
- **Widening the reversal to remove/reorder on a case.** Rejected — out of scope;
  case-level narratives stay append-only, consistent with phases.

## Consequences

- The phase subsystem is untouched; only `case_narratives` gains one nullable-default
  column and one new RPC. All ADR 0032 behaviour (snapshot, freeze-on-close HC054,
  assign/conclude/reopen lifecycle of ADR 0033) applies unchanged to ad-hoc narratives.
- Ships under the existing `case_narratives` flag (no new flag): dark where narratives
  are off, live where they are on.
- Verification: pgTAP `supabase/tests/178_ad_hoc_narratives.sql` + E2E
  `e2e/ad-hoc-narratives.spec.ts`.
