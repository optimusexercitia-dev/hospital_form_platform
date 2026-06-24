-- Default (anchor) section now TRACKS POSITION 0.
--
-- Bug: the builder bound the "inicial" badge + the no-condition / not-deletable
-- treatment to the stored `is_default` flag, which stayed pinned to the
-- originally auto-created section. Reordering another section to the top left
-- the anchor treatment stranded on a non-first section (and the condition
-- affordance inverted: a non-first default could not take a condition the DB
-- still forbids, while a non-default first section was wrongly offered one).
--
-- Decision (user): the anchor status follows POSITION — whatever section is
-- first IS the anchor. We keep the existing `is_default` machinery (the
-- one-default-per-version unique index, the default_shape CHECK forbidding a
-- condition/sign-off on the anchor, the "can't delete the last section" guard)
-- and simply maintain the invariant `is_default <=> (position = min)` whenever
-- sections are reordered. A section promoted to first has its condition /
-- sign-off CLEARED (a first section references no earlier answer, so a condition
-- on it is meaningless and the default_shape CHECK forbids it anyway).
--
-- This migration:
--   1. Re-creates `reorder_section` to re-sync `is_default` after the swap.
--   2. One-time normalizes existing DRAFT versions whose anchor drifted off
--      position 0 (published versions are immutable and left untouched).

-- ---------------------------------------------------------------------------
-- 1. reorder_section: swap positions, then re-sync the anchor flag.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."reorder_section"("p_section_id" "uuid", "p_direction" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_version_id uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
  v_first_id uuid;
  v_current_default_id uuid;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select form_version_id, position into v_version_id, v_position
  from public.form_sections
  where id = p_section_id;

  if v_version_id is null then
    raise exception 'seção % não encontrada', p_section_id using errcode = 'no_data_found';
  end if;

  -- Find the immediate neighbour in the requested direction within the version.
  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_sections
    where form_version_id = v_version_id and position < v_position
    order by position desc
    limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_sections
    where form_version_id = v_version_id and position > v_position
    order by position asc
    limit 1;
  end if;

  -- Boundary: nothing to swap with.
  if v_neighbor_id is null then
    return;
  end if;

  -- Single-statement swap; the deferrable constraint tolerates the transient
  -- duplicate within the statement.
  update public.form_sections
  set position = case id
                   when p_section_id then v_neighbor_position
                   when v_neighbor_id then v_position
                 end
  where id in (p_section_id, v_neighbor_id);

  -- Re-sync the anchor: the section now at the lowest position must be the sole
  -- default. Only act when it drifted (the swap only changes the first section
  -- when position 0 is involved). Clear the OLD default first so the
  -- non-deferrable one-default-per-version unique index never sees two at once.
  select id into v_first_id
  from public.form_sections
  where form_version_id = v_version_id
  order by position asc
  limit 1;

  select id into v_current_default_id
  from public.form_sections
  where form_version_id = v_version_id and is_default
  limit 1;

  if v_first_id is distinct from v_current_default_id then
    if v_current_default_id is not null then
      update public.form_sections
      set is_default = false
      where id = v_current_default_id;
    end if;

    -- Promote the new first section; clear condition + sign-off so the
    -- default_shape / signoff_role CHECKs hold (a first section cannot
    -- reference an earlier answer, so a condition on it is meaningless).
    update public.form_sections
    set is_default = true,
        visible_when = null,
        requires_signoff = false,
        signoff_role = null
    where id = v_first_id;
  end if;
end;
$$;

ALTER FUNCTION "public"."reorder_section"("p_section_id" "uuid", "p_direction" "text") OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- 2. One-time normalization of existing DRAFT versions whose anchor drifted.
--    Published versions are immutable (guard_published_structure) and skipped.
-- ---------------------------------------------------------------------------
DO $$
declare
  r record;
  v_first_id uuid;
begin
  for r in
    select distinct fs.form_version_id
    from public.form_sections fs
    join public.form_versions fv on fv.id = fs.form_version_id
    where fv.status = 'draft'
  loop
    select id into v_first_id
    from public.form_sections
    where form_version_id = r.form_version_id
    order by position asc
    limit 1;

    -- Skip versions already consistent (first section is the sole default).
    if exists (
      select 1 from public.form_sections
      where form_version_id = r.form_version_id
        and is_default
        and id = v_first_id
    ) and (
      select count(*) from public.form_sections
      where form_version_id = r.form_version_id and is_default
    ) = 1 then
      continue;
    end if;

    -- Clear every default first (zero defaults is fine transiently), then set
    -- the first section as the sole anchor with a cleared condition/sign-off.
    update public.form_sections
    set is_default = false
    where form_version_id = r.form_version_id and is_default;

    update public.form_sections
    set is_default = true,
        visible_when = null,
        requires_signoff = false,
        signoff_role = null
    where id = v_first_id;
  end loop;
end;
$$;
