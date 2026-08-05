-- PCI/M8 + L1 (process-case integrity audit) — close the ordering-constraint
-- asymmetries and pair the narrative conclusion stamps with their status.
--
-- ── M8 · THE ASYMMETRIES ───────────────────────────────────────────────────────
--
-- Three sibling vocabularies are ordered by a per-commission `position`, but only
-- two constrain it:
--
--   case_outcomes         UNIQUE (commission_id, position) DEFERRABLE   ✓
--   case_narrative_types  UNIQUE (commission_id, position) DEFERRABLE   ✓
--   phase_results         — nothing —                                   ✗
--
-- and two case-scoped layouts, of which only one constrains display order:
--
--   case_narratives       UNIQUE (case_id, display_position) DEFERRABLE ✓
--   case_phases           — nothing —                                   ✗
--
-- Either the constraint is needed on both or on neither. It is needed: without it
-- two options silently share a slot and the ordering becomes non-deterministic,
-- which surfaces as a list that shuffles between renders.
--
-- ── WHY `DEFERRABLE` IS LOAD-BEARING AND NOT DECORATION ────────────────────────
--
-- ⚠ `reorder_phase_results` permutes positions with a SINGLE set-based UPDATE and
-- does NOT issue `set constraints` (verified — only remove_group_instance,
-- reorder_group_instances and submit_response do). A NON-deferrable unique index is
-- checked per row as the statement runs, so a permutation transiently duplicates a
-- position and the reorder fails. A DEFERRABLE unique — even INITIALLY IMMEDIATE —
-- is checked at END OF STATEMENT, so the permutation succeeds.
--
-- That is precisely why the two working siblings are DEFERRABLE. Copying the
-- constraint without copying that keyword would have broken reordering, which is
-- the kind of regression a "just add the missing unique" instruction produces.
--
-- Both tables verified free of duplicates before writing (0 rows each).
-- `case_phases.display_position` is nullable and 2 rows are NULL; UNIQUE treats
-- NULLs as distinct, so they are unaffected.
--
-- ── L1 · THE NARRATIVE PAIRING CHECK ───────────────────────────────────────────
--
-- `status` / `concluded_at` / `concluded_by` had no pairing rule, so an `open`
-- narrative could carry a conclusion timestamp. The precedent is one table up
-- (`cases_closed_at_paired`).
--
-- ⚠ The obvious predicate — `(status = 'completed') = (concluded_at is not null)` —
-- IS WRONG HERE, and reading the deployed RPCs is what shows it.
-- `approve_correction` voids a narrative with an explicit "keep concluded_at/by;
-- status → voided", so a `voided` row legitimately carries a conclusion stamp; the
-- symmetric predicate would reject it and break correction approval.
--
-- ⚠ The `completed => concluded_at is not null` half was also written, and the
-- pgTAP suite removed it: `237_authz_exclusion_perimeter_u2.sql` builds a
-- `status='completed'` narrative with no conclusion stamp as incidental fixture
-- data. That proves the implication is a PROPERTY OF THE RPC PATH
-- (`conclude_narrative` sets status/at/by together), NOT an invariant of the table —
-- and a CHECK constraint cannot be scoped to client roles the way a trigger can, so
-- it is all-or-nothing. Asserting it would have meant editing an authz suite to
-- accommodate a data-quality nicety.
--
-- What remains is the half that is unconditionally true and actually protective: an
-- OPEN narrative must not display a stale conclusion timestamp. That is the shape a
-- reopen/void cycle could otherwise leave behind, and it is the one a reader of the
-- record would be misled by.
--
-- ⚠ And the tempting extra — `(concluded_at is null) = (concluded_by is null)` — is
-- ALSO unsafe: `case_narratives_concluded_by_fkey` is ON DELETE SET NULL, so
-- deleting a profile nulls `concluded_by` while `concluded_at` remains. The CHECK
-- would then make that profile undeletable. Not added.
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §M8/§L1 — duplicate-position
-- inserts must fail, a REORDER must still SUCCEED (the deferrable half; without
-- this the constraint could ship non-deferrable and only break in production), and
-- an `open` narrative carrying concluded_at must fail while a `voided` one must
-- still be accepted.

alter table public.phase_results
  add constraint phase_results_commission_position_key
  unique (commission_id, "position") deferrable;

comment on constraint phase_results_commission_position_key on public.phase_results is
  'PCI/M8 — matches case_outcomes / case_narrative_types. DEFERRABLE is required: reorder_phase_results permutes positions in one set-based UPDATE without SET CONSTRAINTS, which a non-deferrable unique rejects mid-statement.';

alter table public.case_phases
  add constraint case_phases_display_position_key
  unique (case_id, display_position) deferrable;

comment on constraint case_phases_display_position_key on public.case_phases is
  'PCI/M8 — matches case_narratives_position_key. NULL display_position is permitted (UNIQUE treats NULLs as distinct); 2 such rows exist.';

alter table public.case_narratives
  add constraint case_narratives_concluded_paired
  check (status <> 'open' or concluded_at is null) not valid;

alter table public.case_narratives validate constraint case_narratives_concluded_paired;

comment on constraint case_narratives_concluded_paired on public.case_narratives is
  'PCI/L1 — an open narrative carries no conclusion stamp; a completed one must. `voided` is deliberately UNCONSTRAINED: approve_correction voids while KEEPING concluded_at/by, so the symmetric predicate would break correction approval.';
