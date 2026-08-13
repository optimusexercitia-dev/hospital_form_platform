-- =============================================================================
-- FF-4 (ADR 0092) — Power Authoring, part 2 of 5: `default_source`.
--
-- The five-token dynamic-default vocabulary (ruling 5), a nullable `text`
-- column on `form_items` with two CHECKs (ruling 6):
--   a. XOR with `default_value` — an item carries a literal default, a dynamic
--      one, or neither, never both.
--   b. token <-> type — pinned to the set `supportsDefaultValue()` admits
--      (the eight INPUT_ITEM_TYPES), which is TIGHTER than the existing
--      `form_items_default_value_display_null` (that CHECK only excludes
--      `section_text`/`image`, so it currently accepts a `default_value` on a
--      matrix that nothing can ever apply — ADR 0092 §Substrate). FF-4 does
--      NOT inherit that looseness and does NOT retro-tighten the old CHECK
--      either (queued as an open question with its own backfill risk, per
--      `docs/decisions/0092-ff4-power-authoring.md`).
--
-- SQLSTATE: allocates none (both CHECKs raise the standard `23514`, never a
-- custom HC0Q code — this mirrors every other `form_items` CHECK).
-- =============================================================================

alter table public.form_items
  add column if not exists default_source text;

comment on column public.form_items.default_source is
  'FF-4 (ADR 0092 ruling 5) — one of the five closed dynamic-default tokens '
  '(today/now/current_user_name/current_user_email/commission_name), or null. '
  'XORs with default_value (form_items_default_source_xor) and is pinned to the '
  'input types that can honour it (form_items_default_source_type_check) — '
  'TS mirror: DEFAULT_SOURCE_ELIGIBLE_TYPES in src/lib/forms/item-tree.ts.';

-- -----------------------------------------------------------------------------
-- a. XOR with default_value. Neither is required to be set (an item may carry
--    no default at all).
-- -----------------------------------------------------------------------------
alter table public.form_items
  drop constraint if exists form_items_default_source_xor;

alter table public.form_items
  add constraint form_items_default_source_xor
  check (default_value is null or default_source is null);

-- -----------------------------------------------------------------------------
-- b. token <-> type, mirroring DEFAULT_SOURCE_ELIGIBLE_TYPES exactly:
--      today               -> date
--      now                 -> time
--      current_user_name   -> short_text, free_text
--      current_user_email  -> short_text, free_text
--      commission_name     -> short_text, free_text
--    `default_source is null` is unconditionally legal for every item type —
--    this CHECK only constrains the NON-null case.
-- -----------------------------------------------------------------------------
alter table public.form_items
  drop constraint if exists form_items_default_source_type_check;

alter table public.form_items
  add constraint form_items_default_source_type_check
  check (
    default_source is null
    or (default_source = 'today' and item_type = 'date')
    or (default_source = 'now' and item_type = 'time')
    or (
      default_source in ('current_user_name', 'current_user_email', 'commission_name')
      and item_type in ('short_text', 'free_text')
    )
  );
