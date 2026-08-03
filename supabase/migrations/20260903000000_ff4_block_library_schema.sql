-- =============================================================================
-- FF-4 (ADR 0092) — Power Authoring, part 1 of 5: the LIBRARY TABLE.
--
-- `form_block_library` — one row per saved block, commission-owned (ruling 1).
-- K9 (ADR 0091 Amendment 2 lesson, applied at birth): `authenticated` gets
-- SELECT ONLY. The two DEFINER doors in parts 3/4 are the only writers —
-- `library_reader_non_writer` (277 §B) pins this, including the DELETE arm.
--
-- Provenance is denormalized, NOT a foreign key (ruling 2): `saved_by_id` is a
-- plain uuid (no `references profiles`), `saved_by_name` / `source_form_title`
-- / `source_version_number` are captured at save time and never re-resolved.
-- Any FK here is exactly the temptation ruling 2 removes — a snapshot that can
-- be joined back to its source is a snapshot that will eventually BE joined
-- back, which is how it quietly becomes a live link.
--
-- `snapshot` is the materialized subtree (a flat jsonb array: the root item
-- first, then its children in position order — depth is capped at 1 by
-- `form_items_no_nested_container`, so a flat array is the whole shape). Never
-- updated after insert (ruling 2); rename/re-describe/delete are open
-- questions this phase does not ship a door for (see BE-4/BE-5 migrations).
--
-- SQLSTATE high-water at authoring time is HC0Q5; this migration allocates
-- none (BE-4/BE-5 allocate HC0Q6-HC0Q8).
-- =============================================================================

create table public.form_block_library (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id) on delete cascade,
  name text not null,
  description text,
  -- The materialized subtree. NEVER updated (ruling 2) — "editing" a block
  -- means saving a new entry, so there is no writer for this column beyond
  -- the initial insert in save_block_to_library.
  snapshot jsonb not null,
  -- Provenance (ruling 2) — denormalized, NOT joined. saved_by_id carries no
  -- FK on purpose: this table's whole point is to outlive its source, and
  -- that includes the identity of who saved it staying a plain fact rather
  -- than a live reference.
  saved_by_id uuid not null,
  saved_by_name text not null,
  saved_at timestamptz not null default now(),
  source_form_title text not null,
  source_version_number integer not null,
  constraint form_block_library_name_present check (btrim(name) <> '')
);

comment on table public.form_block_library is
  'ADR 0092 (FF-4) — commission-owned reusable block library. One row per saved '
  'item subtree (a single input item, or one container with its children — '
  'ruling 8). K9: authenticated is SELECT-only; save_block_to_library and '
  'insert_block_from_library are the only writers. snapshot is immutable after '
  'insert; provenance columns are denormalized, never a foreign key (ruling 2).';

comment on column public.form_block_library.snapshot is
  'Flat jsonb array: the root item object first (is_child=false), then its '
  'children in position order (is_child=true) when the root is a container. '
  'Each entry carries every child-table shape app.copy_version_children copies '
  '(options / matrix rows+columns / validations) inline, so the array is a '
  'complete, self-contained materialization — no live reference back to the '
  'source form_items rows.';

comment on column public.form_block_library.saved_by_id is
  'The saving profile''s id, captured at save time. NO FK to profiles (ruling '
  '2) — renaming or deactivating that profile never touches this row.';

create index form_block_library_commission_idx
  on public.form_block_library (commission_id);

-- -----------------------------------------------------------------------------
-- RLS — ONE read arm (ruling 1): staff_admin / commission-admin of the OWNING
-- commission, same perimeter as the rest of the form-authoring surface
-- (form_items_staff_admin_write et al.). No write policy: K9 above is the
-- boundary for INSERT/UPDATE/DELETE, enforced entirely by the missing GRANT —
-- exactly the `answer_references` shape (ADR 0091), not the `form_items` one.
-- -----------------------------------------------------------------------------
alter table public.form_block_library enable row level security;

create policy form_block_library_select on public.form_block_library
  for select to authenticated
  using (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
  );

grant select on public.form_block_library to authenticated;

-- -----------------------------------------------------------------------------
-- The flag, seeded OFF. Flipped at the FF-4 gate (lead, at Record) — never in
-- a schema migration (`db push` carries migrations, not seed.sql; a flag ON
-- only in the seed is DARK in production — FF-2 r1 B-3, then FF-3 r1 B-1,
-- twice already).
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'power_authoring',
  false,
  'FF-4 (ADR 0092) — commission block library (save/insert reusable blocks) + '
  'dynamic per-item defaults (default_source). Gates both DEFINER doors and the '
  'draft-start default resolver. Seeded OFF; flipped at the FF-4 gate.'
)
on conflict (key) do nothing;
