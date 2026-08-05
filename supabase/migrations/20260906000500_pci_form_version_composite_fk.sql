-- PCI/M4 (process-case integrity audit, finding M4) — make "this version belongs to
-- this form" expressible.
--
-- `case_phases` carries `form_id` and `form_version_id` as two INDEPENDENT single-
-- column FKs. Neither can state the relationship between them, so a row pinning
-- commission A's form to commission B's version satisfied both constraints. With
-- the INSERT hole (PCI/H1) that was directly reachable; H1 closes the door, this
-- closes the model.
--
-- ── REPLACE, DO NOT ADD — THE PGRST201 TRAP ────────────────────────────────────
--
-- ⚠ The audit finding as originally written said "add the composite FK". Doing
-- that literally would ship an outage. ADDING (form_id, form_version_id) ->
-- form_versions alongside the existing (form_version_id) -> form_versions gives
-- `case_phases` a SECOND foreign key to `form_versions`, which is exactly the
-- shape that produces PostgREST **PGRST201** ("Could not embed because more than
-- one relationship was found") for every un-hinted embed. This repo has shipped
-- that outage twice and 20260905000100 (ADR 0094 W1) documents it at length.
--
-- Replacing keeps the count at one FK per target. The new constraint deliberately
-- REUSES THE OLD NAME so any FK-hinted embed keeps resolving without a source
-- change — the same discipline W1 used.
--
-- Verified against this stack before writing:
--   * 0 rows violate the composite today
--       (join form_versions on id, count where fv.form_id <> cp.form_id => 0)
--   * no `.from('case_phases')` embed of form_versions exists in src/
--   * the only textual reference to the constraint name is the GENERATED
--     src/lib/types/database.ts, which `npm run gen:types` rewrites.
--
-- ── MATCH SIMPLE IS SOUND HERE (unlike in W1) ──────────────────────────────────
--
-- A multi-column FK defaults to MATCH SIMPLE: if ANY referencing column is NULL
-- the constraint passes without a lookup. W1 needed a separate CHECK to make that
-- safe. Here it is free — `case_phases.form_id` and `case_phases.form_version_id`
-- are BOTH `not null` in the catalog, so the null-escape is unreachable by
-- construction. If either is ever made nullable, this reasoning dies with it; the
-- pgTAP keystone pins both NOT NULL so that change cannot pass silently.
--
-- ON DELETE stays at the default (NO ACTION), matching the constraint being
-- replaced. A published version referenced by a live case phase must not vanish.
--
-- ── MUTATION PROOF ─────────────────────────────────────────────────────────────
-- supabase/tests/296_process_case_integrity.sql §M4 — insert a phase pinning a
-- form to another form's version and require 23503; plus the NOT NULL pin above.

-- The referenced key. Redundant with the PK for uniqueness; required because a
-- composite FK needs a matching unique constraint on the referenced side.
alter table public.form_versions
  add constraint form_versions_id_form_uq unique (id, form_id);

comment on constraint form_versions_id_form_uq on public.form_versions is
  'PCI/M4 — referenced key for case_phases_form_version_id_fkey (the pinned version must belong to the pinned form). Redundant with the PK for uniqueness; a composite FK requires a matching unique constraint.';

alter table public.case_phases drop constraint case_phases_form_version_id_fkey;
alter table public.case_phases
  add constraint case_phases_form_version_id_fkey
  foreign key (form_version_id, form_id)
  references public.form_versions (id, form_id);

comment on constraint case_phases_form_version_id_fkey on public.case_phases is
  'PCI/M4 — composite: the pinned form_version must belong to the pinned form. REPLACES the single-column FK rather than joining it, so case_phases keeps exactly ONE foreign key to form_versions (a second one is the PGRST201 shape). Name reused so FK-hinted embeds keep resolving. MATCH SIMPLE is sound because both referencing columns are NOT NULL.';
