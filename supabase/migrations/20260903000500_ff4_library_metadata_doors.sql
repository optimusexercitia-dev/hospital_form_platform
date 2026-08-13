-- =============================================================================
-- FF-4 (ADR 0092) — Power Authoring, part 6: the two metadata doors ruling 2
-- promised and BE-2..6 shipped no mechanism for ("renaming, re-describing,
-- and deleting an entry are allowed"). Flagged independently by `backend` and
-- `frontend` in the BE-2..6 report; this closes it.
--
-- Same posture as the two existing doors: DEFINER, the same commission
-- perimeter (`is_staff_admin_of` / `is_commission_admin_of`), `revoke …from
-- public` at creation. NO new RLS policy and NO new grant on
-- `form_block_library` — K9 stands: `authenticated` is still SELECT-only, and
-- these two doors join `save_block_to_library` / `insert_block_from_library`
-- as the ONLY writers, now covering UPDATE/DELETE as well as INSERT.
--
-- `update_block_library_entry` touches ONLY `name`/`description`. This is the
-- keystone `library_metadata_door_cannot_touch_snapshot` exists for: ruling
-- 2's snapshot/provenance immutability was a CONVENTION while nothing could
-- write at all (nothing can write wrongly if nothing writes); the moment an
-- update door exists, "the snapshot never changes" becomes a real invariant
-- that needs a real proof, not an absence.
--
-- SQLSTATE: allocates none — reuses HC0Q7 (flag off, same as the other two
-- doors), HC0Q8 (empty name, same as save_block_to_library's own check),
-- 42501 (authority), no_data_found (missing/cross-tenant entry — a
-- cross-commission id resolves as not-found, same DEFINER-reads-without-RLS
-- posture as insert_block_from_library).
-- =============================================================================

create or replace function public.update_block_library_entry(
  p_library_entry_id uuid,
  p_name text,
  p_description text default null
)
returns public.form_block_library
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_result public.form_block_library;
begin
  if not app.feature_enabled('power_authoring') then
    raise exception 'a biblioteca de blocos não está disponível'
      using errcode = 'HC0Q7';
  end if;

  if v_name = '' then
    raise exception 'informe um nome para o bloco'
      using errcode = 'HC0Q8';
  end if;

  select commission_id into v_commission_id
  from public.form_block_library where id = p_library_entry_id;

  if v_commission_id is null then
    raise exception 'bloco % não encontrado', p_library_entry_id
      using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (ADR 0079).
  if not (
    app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
  ) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  -- ONLY name/description. Never snapshot, commission_id, or the provenance
  -- columns (saved_by_id/saved_by_name/source_form_title/source_version_number)
  -- — library_metadata_door_cannot_touch_snapshot pins this structurally.
  update public.form_block_library
  set name = v_name,
      description = v_description
  where id = p_library_entry_id
  returning * into v_result;

  perform app.audit_write(
    'form_block_library.renamed', 'form_block_library', v_result.id, v_commission_id,
    'Bloco renomeado na biblioteca', '{}'::jsonb
  );

  return v_result;
end;
$$;

revoke all on function public.update_block_library_entry(uuid, text, text) from public;
grant execute on function public.update_block_library_entry(uuid, text, text) to authenticated;

comment on function public.update_block_library_entry(uuid, text, text) is
  'FF-4 (ADR 0092 ruling 2): DEFINER door — renames/re-describes a library '
  'entry. Touches ONLY name/description; never snapshot or the provenance '
  'columns (library_metadata_door_cannot_touch_snapshot). Same commission '
  'perimeter as save_block_to_library / insert_block_from_library.';

create or replace function public.delete_block_library_entry(
  p_library_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
begin
  if not app.feature_enabled('power_authoring') then
    raise exception 'a biblioteca de blocos não está disponível'
      using errcode = 'HC0Q7';
  end if;

  select commission_id into v_commission_id
  from public.form_block_library where id = p_library_entry_id;

  if v_commission_id is null then
    raise exception 'bloco % não encontrado', p_library_entry_id
      using errcode = 'no_data_found';
  end if;

  -- AUTHORITY FIRST (ADR 0079).
  if not (
    app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)
  ) then
    raise exception 'você não pode editar formulários nesta comissão'
      using errcode = '42501';
  end if;

  -- Deleting the library entry NEVER disturbs a form built from it: insert
  -- carries no live link back (ruling 2 — the whole reason there is no FK),
  -- so every prior `insert_block_from_library` call already materialized an
  -- ordinary, independent form_items subtree. This DELETE touches exactly one
  -- form_block_library row and nothing else — delete_safety_no_form_impact
  -- pins that behaviorally, not just by absence of a foreign key.
  delete from public.form_block_library where id = p_library_entry_id;

  perform app.audit_write(
    'form_block_library.deleted', 'form_block_library', p_library_entry_id, v_commission_id,
    'Bloco excluído da biblioteca', '{}'::jsonb
  );
end;
$$;

revoke all on function public.delete_block_library_entry(uuid) from public;
grant execute on function public.delete_block_library_entry(uuid) to authenticated;

comment on function public.delete_block_library_entry(uuid) is
  'FF-4 (ADR 0092 ruling 2): DEFINER door — deletes a library entry. No FK '
  'points at it (ruling 2), so this never touches any form_items built from '
  'it via a prior insert_block_from_library call. Same commission perimeter '
  'as the sibling doors.';
