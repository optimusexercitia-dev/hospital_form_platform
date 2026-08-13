-- ADR 0096 — Process-template versioning · M4: constraint transition.
--
-- WHY THIS MIGRATION EXISTS (it was not in the original 7-file plan).
--
-- The re-keyed RPC doors land in M6 and will write `template_version_id` ONLY.
-- But at that point the legacy `template_id` columns still exist and are still
-- NOT NULL — and on process_template_outcomes, `template_id` is half of the
-- PRIMARY KEY. So an M6 insert that writes only the new column would fail on a
-- not-null violation, and the outcomes insert would fail on a null PK member.
--
-- There are two ways out and only one of them is good:
--
--   (a) Have the M6 doors write BOTH columns during the transition, then rewrite
--       every one of them AGAIN in the final migration once the old column is
--       dropped. That means authoring ~12 RPC bodies twice, and a transitional
--       double-write is exactly the kind of thing that gets left behind.
--   (b) Relax the constraints FIRST, so the doors are written once, in their
--       final form. That is this migration.
--
-- Sequenced after the backfill (M3) on purpose: the NOT NULLs below are only
-- safe to assert because M3 has already populated every row and raised if it
-- could not.

-- ---------------------------------------------------------------------------
-- 1. The new columns are now fully populated (M3 asserted it) — enforce it.
-- ---------------------------------------------------------------------------

alter table public.process_template_phases
  alter column template_version_id set not null;

alter table public.process_template_narratives
  alter column template_version_id set not null;

alter table public.process_template_outcomes
  alter column template_version_id set not null;

alter table public.process_template_custom_fields
  alter column template_version_id set not null;

-- NOTE: cases.template_version_id is deliberately NOT made NOT NULL. Processless
-- cases (public.create_case, suite 177) legitimately have no template, and the
-- two cases already orphaned by the old ON DELETE SET NULL cannot be re-pointed
-- to a version that never existed. ADR 0096 Amendment A1.1 item 4.

-- ---------------------------------------------------------------------------
-- 2. Move the uniqueness invariants to the VERSION grain.
--
-- Each of these currently reads (template_id, ...). Left alone they would keep
-- enforcing uniqueness across the whole template, so two DIFFERENT versions of
-- one template could not both have a phase at position 1 — which would make
-- cloning impossible. This is the single most load-bearing part of the re-key:
-- get it wrong and clone_template_version fails on its first call.
-- ---------------------------------------------------------------------------

alter table public.process_template_phases
  drop constraint process_template_phases_position_key;
alter table public.process_template_phases
  add constraint process_template_phases_position_key
  unique (template_version_id, "position");

alter table public.process_template_narratives
  drop constraint process_template_narratives_position_key;
alter table public.process_template_narratives
  add constraint process_template_narratives_position_key
  unique (template_version_id, display_position);

alter table public.process_template_custom_fields
  drop constraint process_template_custom_fields_key_unique;
alter table public.process_template_custom_fields
  add constraint process_template_custom_fields_key_unique
  unique (template_version_id, key);

-- The outcomes junction keys off template_id as half of its PRIMARY KEY.
alter table public.process_template_outcomes
  drop constraint process_template_outcomes_pkey;
alter table public.process_template_outcomes
  add constraint process_template_outcomes_pkey
  primary key (template_version_id, outcome_id);

-- ---------------------------------------------------------------------------
-- 3. Release the legacy columns so the M6 doors can stop writing them.
--
-- Dropping a PRIMARY KEY does NOT drop the NOT NULL it implied, so the outcomes
-- column needs the relaxation stated explicitly like the others.
-- ---------------------------------------------------------------------------

alter table public.process_template_phases
  alter column template_id drop not null;

alter table public.process_template_narratives
  alter column template_id drop not null;

alter table public.process_template_outcomes
  alter column template_id drop not null;

alter table public.process_template_custom_fields
  alter column template_id drop not null;
