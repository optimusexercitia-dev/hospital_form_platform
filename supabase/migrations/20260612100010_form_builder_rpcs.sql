-- Phase 4 / M10: Form builder mutation entry points.
--
-- Phase 1 already laid the structure (M3), the immutability triggers (M4), the
-- publish RPC + condition validation (M5), the builder RLS (M6), and the
-- form-assets bucket (M7). This migration adds the missing *mutation entry
-- points* the builder needs. Each RPC is SECURITY INVOKER, consistent with its
-- siblings publish_form_version / submit_response — RLS is the authority
-- (Architecture Rule 1), no RPC bypasses it:
--
--   * create_form         — births a form + v1 draft + its default section.
--   * clone_form_version   — "editar publicado": copies a version into a new
--                            draft, preserving question_keys/conditions/sign-off
--                            settings/display blocks (Architecture Rule 5).
--   * reorder_section /
--     reorder_item         — atomic adjacent-position swaps, done as a single
--                            UPDATE so the deferrable unique constraint (below)
--                            is satisfied at end-of-statement.
--
-- It also repairs ONE latent Phase-1 RLS defect that the builder is the first
-- flow to exercise: the form_versions write policy's WITH CHECK was
-- self-referential and rejected every direct INSERT (see section (E) below).
--
-- See docs/decisions/0011-position-reorder-deferrable-swap.md,
-- docs/decisions/0012-clone-returns-existing-draft.md, and
-- docs/decisions/0013-form-versions-insert-rls-fix.md.

-- ---------------------------------------------------------------------------
-- (A) Deferrable position-uniqueness constraints.
-- ---------------------------------------------------------------------------
-- The two-level ordering uniques (form_sections.position per version,
-- form_items.position per section) were NON-DEFERRABLE, so any reorder that
-- swaps two adjacent rows trips the constraint mid-statement. Make them
-- DEFERRABLE INITIALLY IMMEDIATE: ordinary single-row inserts/updates are still
-- checked per-statement (no behaviour change), but a single multi-row UPDATE
-- that performs the swap (the reorder RPCs below) is checked at end-of-statement
-- by which point the two positions no longer collide.
--
-- No object depends on these unique constraints (the FKs from form_items,
-- responses, answers, response_section_signoffs all reference the PRIMARY KEY
-- `id`, verified against the catalog), so dropping and recreating them with the
-- same names is safe. Recreated names are kept identical to the auto-generated
-- ones so future migrations and tooling see no rename.
alter table public.form_sections
  drop constraint form_sections_form_version_id_position_key,
  add constraint form_sections_form_version_id_position_key
    unique (form_version_id, position) deferrable initially immediate;

alter table public.form_items
  drop constraint form_items_section_id_position_key,
  add constraint form_items_section_id_position_key
    unique (section_id, position) deferrable initially immediate;

-- ---------------------------------------------------------------------------
-- (B) create_form(commission_id, title, description)
-- ---------------------------------------------------------------------------
-- Atomically creates a form, its v1 draft version, and the version's default
-- section (is_default = true, title null, position 0). This is the ONLY path
-- that births a fresh version carrying just a default section — clone copies
-- sections instead, so there is deliberately NO "auto-create a default section"
-- trigger on form_versions insert (it would double-insert during a clone).
--
-- SECURITY INVOKER: the three inserts run under the caller's RLS. A staff_admin
-- of the commission (or an admin) passes forms_staff_admin_write /
-- form_versions_staff_admin_write / form_sections_staff_admin_write; anyone else
-- is denied by RLS. created_by is stamped from auth.uid(). Returns the form id
-- and the new draft version id so the caller can navigate straight to the
-- builder.
create function public.create_form(
  p_commission_id uuid,
  p_title text,
  p_description text default null
)
returns table (form_id uuid, version_id uuid)
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_form_id uuid;
  v_version_id uuid;
  v_uid uuid := auth.uid();
begin
  insert into public.forms (commission_id, title, description, created_by)
  values (p_commission_id, p_title, p_description, v_uid)
  returning id into v_form_id;

  insert into public.form_versions (form_id, version_number, status, created_by)
  values (v_form_id, 1, 'draft', v_uid)
  returning id into v_version_id;

  -- The default section: a plain container (is_default = true forces title /
  -- visible_when / requires_signoff to their empty shape via the table CHECK).
  insert into public.form_sections (form_version_id, position, is_default)
  values (v_version_id, 0, true);

  form_id := v_form_id;
  version_id := v_version_id;
  return next;
end;
$$;

grant execute on function public.create_form(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (C) clone_form_version(source_version_id)
-- ---------------------------------------------------------------------------
-- "Editar publicado". Creates a new DRAFT version of the same form and copies
-- every section and item into it, remapping section ids. question_key, label,
-- question_explanation, options, required, content (incl. any storage_path
-- reference — copied verbatim per Architecture Rule 6; the underlying object is
-- never re-uploaded) and visible_when all survive unchanged. visible_when
-- references question_key (not item id), so conditions keep working across the
-- clone (Architecture Rule 5).
--
-- Clone-when-draft-exists (ADR 0012): a form has at most one editable draft at a
-- time. If a draft already exists for the form, this returns that draft's id and
-- does nothing else — the builder routes the user to the existing draft rather
-- than proliferating versions.
--
-- SECURITY INVOKER: all reads/writes run under the caller's RLS. Reading the
-- source (published/archived/draft) needs form_*_select; writing the new draft
-- needs form_*_staff_admin_write. The new draft's structure inserts are
-- permitted by the published-immutability trigger because their target version
-- is itself a draft (guard_published_structure only fires for non-draft target
-- versions).
create function public.clone_form_version(p_source_version_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_form_id uuid;
  v_existing_draft uuid;
  v_new_version_id uuid;
  v_next_number integer;
  v_uid uuid := auth.uid();
begin
  select form_id into v_form_id
  from public.form_versions
  where id = p_source_version_id;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_source_version_id
      using errcode = 'no_data_found';
  end if;

  -- One editable draft per form: if one exists, hand it back untouched.
  select id into v_existing_draft
  from public.form_versions
  where form_id = v_form_id and status = 'draft'
  limit 1;

  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.form_versions
  where form_id = v_form_id;

  insert into public.form_versions (form_id, version_number, status, created_by)
  values (v_form_id, v_next_number, 'draft', v_uid)
  returning id into v_new_version_id;

  -- Copy sections, capturing the old->new id remap in a temp table so the item
  -- copy can rewrite section_id in a single set-based statement. A temp table
  -- (rather than a writable CTE) keeps the section INSERT and its BEFORE-INSERT
  -- triggers fully evaluated before the item copy reads the map.
  create temp table _clone_section_map (old_id uuid, new_id uuid) on commit drop;

  with src as (
    select id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from public.form_sections
    where form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_sections (
      form_version_id, position, title, description, is_default,
      visible_when, requires_signoff, signoff_role
    )
    select v_new_version_id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from src
    order by position
    returning id, position
  )
  insert into _clone_section_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.position = src.position;

  -- Copy items into the remapped sections. form_version_id is omitted: the
  -- form_items_sync_version_trg fills it from the (new) section. position /
  -- question_key / content etc. are preserved verbatim.
  insert into public.form_items (
    section_id, position, item_type,
    question_key, label, question_explanation, options, required, content
  )
  select m.new_id, i.position, i.item_type,
         i.question_key, i.label, i.question_explanation, i.options, i.required, i.content
  from public.form_items i
  join public.form_sections s on s.id = i.section_id
  join _clone_section_map m on m.old_id = i.section_id
  where s.form_version_id = p_source_version_id;

  drop table _clone_section_map;

  return v_new_version_id;
end;
$$;

grant execute on function public.clone_form_version(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (D) reorder_section / reorder_item — atomic adjacent swaps.
-- ---------------------------------------------------------------------------
-- The swap MUST be a single UPDATE so the deferrable-IMMEDIATE unique constraint
-- is satisfied at end-of-statement (two separate UPDATEs would each be checked
-- per-statement and the first would collide). PostgREST cannot express a CASE
-- update, so the swap lives here and the server actions call these via .rpc().
--
-- Direction is 'up' (toward a lower position) or 'down' (toward a higher one).
-- A no-op at a boundary (already first / already last) returns silently — the
-- UI disables the control, and a redundant call must not error. SECURITY
-- INVOKER: the UPDATE runs under the caller's RLS (form_sections /
-- form_items_staff_admin_write) and the published-immutability trigger (draft
-- versions only).

create function public.reorder_section(
  p_section_id uuid,
  p_direction text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
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
end;
$$;

grant execute on function public.reorder_section(uuid, text) to authenticated, service_role;

create function public.reorder_item(
  p_item_id uuid,
  p_direction text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_section_id uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
begin
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select section_id, position into v_section_id, v_position
  from public.form_items
  where id = p_item_id;

  if v_section_id is null then
    raise exception 'item % não encontrado', p_item_id using errcode = 'no_data_found';
  end if;

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_items
    where section_id = v_section_id and position < v_position
    order by position desc
    limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.form_items
    where section_id = v_section_id and position > v_position
    order by position asc
    limit 1;
  end if;

  if v_neighbor_id is null then
    return;
  end if;

  update public.form_items
  set position = case id
                   when p_item_id then v_neighbor_position
                   when v_neighbor_id then v_position
                 end
  where id in (p_item_id, v_neighbor_id);
end;
$$;

grant execute on function public.reorder_item(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (D2) delete_section_moving_items — atomic "move items, then delete section".
-- ---------------------------------------------------------------------------
-- PHASES.md §Phase 4: deleting a section "moves OR deletes its items". The
-- cascade-delete branch is plain SQL from the action; the MOVE branch must be
-- atomic (no partial move-then-fail) and needs row_number() to append the moved
-- items contiguously after the target's existing items — which PostgREST cannot
-- express — so it lives here.
--
-- Reassigns every item of p_section_id to p_target_section_id (appended at the
-- end, contiguous positions), then deletes the now-empty source section, in one
-- transaction. SECURITY INVOKER: every statement runs under the caller's RLS +
-- the published-immutability trigger (draft versions only). Both sections must
-- belong to the SAME version (cross-version moves are a clone, not an edit, and
-- the form_items sync trigger forbids them anyway). The source must not be the
-- target.
create function public.delete_section_moving_items(
  p_section_id uuid,
  p_target_section_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_source_version uuid;
  v_target_version uuid;
  v_base integer;
begin
  if p_section_id = p_target_section_id then
    raise exception 'a seção de destino deve ser diferente da seção excluída'
      using errcode = 'check_violation';
  end if;

  select form_version_id into v_source_version
  from public.form_sections where id = p_section_id;
  select form_version_id into v_target_version
  from public.form_sections where id = p_target_section_id;

  if v_source_version is null or v_target_version is null then
    raise exception 'seção não encontrada' using errcode = 'no_data_found';
  end if;

  if v_source_version <> v_target_version then
    raise exception 'as seções pertencem a versões diferentes'
      using errcode = 'check_violation';
  end if;

  -- Append after the target's current max position. row_number() gives each
  -- moved item a distinct, contiguous slot in a single UPDATE (the deferrable
  -- unique constraint tolerates any transient overlap within the statement).
  select coalesce(max(position), -1) into v_base
  from public.form_items where section_id = p_target_section_id;

  update public.form_items i
  set section_id = p_target_section_id,
      position = v_base + ranked.rn
  from (
    select id, row_number() over (order by position) as rn
    from public.form_items
    where section_id = p_section_id
  ) ranked
  where i.id = ranked.id;

  -- The source section is now empty; delete it (guard_default_section_delete
  -- still blocks the only default section).
  delete from public.form_sections where id = p_section_id;
end;
$$;

grant execute on function public.delete_section_moving_items(uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- (E) Repair form_versions_staff_admin_write (latent Phase-1 defect).
-- ---------------------------------------------------------------------------
-- The M6 policy authorized writes with
--   app.is_staff_admin_of(app.commission_of_version(id))
-- where commission_of_version(id) does
--   select f.commission_id from form_versions v join forms f ... where v.id = id.
-- On INSERT, the candidate row is not yet visible to that function's OWN query,
-- so commission_of_version returns NULL, is_staff_admin_of(NULL) is false, and
-- EVERY direct INSERT into form_versions is rejected. The seed never tripped
-- this because it runs as postgres (RLS-bypassed); the builder is the first
-- flow to insert a version under the authenticated role, via the invoker RPCs.
--
-- Fix: resolve the commission through the PARENT that already exists at
-- INSERT-check time — form_id -> forms.commission_id — instead of the
-- self-referential commission_of_version(id). Applied to both USING and
-- WITH CHECK for symmetry (USING already worked for existing rows since the row
-- is visible there; aligning both is cleaner and equivalent). The
-- form_sections / form_items policies are intentionally untouched: their
-- form_version_id references a version row written in a PRIOR statement, which
-- is visible, so they were never broken. See ADR 0013.
--
-- Repairing a genuinely-buggy applied policy in a forward-only migration via
-- DROP/CREATE POLICY (not editing the applied M6 file) is the sanctioned path.
drop policy form_versions_staff_admin_write on public.form_versions;

create policy form_versions_staff_admin_write on public.form_versions
  for all to authenticated
  using (
    app.is_admin()
    or app.is_staff_admin_of(
      (select f.commission_id from public.forms f where f.id = form_versions.form_id)
    )
  )
  with check (
    app.is_admin()
    or app.is_staff_admin_of(
      (select f.commission_id from public.forms f where f.id = form_versions.form_id)
    )
  );
