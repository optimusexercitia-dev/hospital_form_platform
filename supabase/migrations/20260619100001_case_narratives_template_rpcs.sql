-- Case Narratives (2 of 4): TEMPLATE-slot CRUD + the cross-table interleave
-- reorder. ADR 0032.
--
-- The mutation entry points for the per-commission template builder's narrative
-- slots. Each is SECURITY INVOKER (Architecture Rule 1): RLS remains the authority
-- — the process_template_narratives staff_admin-write policy (…100000) confines
-- writes to staff_admins of the template's commission (+ admins). The RPCs add the
-- structural validation RLS cannot express (the cross-table display_position
-- interleave) + friendly typed errors. DRAFT-ONLY: a published/archived template's
-- slots are frozen (mirror the phase-slot RPCs in 20260613090005).
--
-- Every RPC gates app.assert_narratives_enabled() at entry and is re-revoked from
-- anon/public at the tail. display_position spans BOTH process_template_phases and
-- process_template_narratives (the interleave); position (the immutable phase
-- NUMBER) is NEVER touched here.
--
-- HC054 — used here for an incomplete reorder set. (The same-commission type
-- mismatch HC054 is raised by app.guard_template_narrative_type on INSERT.)

-- ---------------------------------------------------------------------------
-- add_template_narrative(template_id, narrative_type_id, title, instructions,
--                        is_expected) -> process_template_narratives
-- ---------------------------------------------------------------------------
-- Appends a narrative slot at max(display_position)+1 taken over the UNION of the
-- template's PHASE and NARRATIVE slots, so it lands at the bottom of the combined
-- list. Draft-only. The same-commission type guard (HC054) fires on the insert.
create function public.add_template_narrative(
  p_template_id uuid,
  p_narrative_type_id uuid,
  p_title text default null,
  p_instructions text default null,
  p_is_expected boolean default false
)
returns public.process_template_narratives
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_result public.process_template_narratives;
begin
  perform app.assert_narratives_enabled();

  select status, commission_id into v_status, v_commission_id
  from public.process_templates
  where id = p_template_id;

  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  -- Next display_position over BOTH slot kinds (the interleave). Phases fall back
  -- to `position` when their display_position is null — a phase added to the draft
  -- by the (unmodified) add_template_phase RPC leaves display_position null, but
  -- `position` is always present and the merge treats it as the display order
  -- (coalesce(display_position, position), same as get_case_detail / mergeCaseLayout).
  select coalesce(max(dp), 0) + 1 into v_position
  from (
    select coalesce(display_position, position) as dp
    from public.process_template_phases where template_id = p_template_id
    union all
    select display_position as dp
    from public.process_template_narratives where template_id = p_template_id
  ) s;

  insert into public.process_template_narratives
    (template_id, narrative_type_id, display_position, title, instructions, is_expected)
  values
    (p_template_id, p_narrative_type_id, v_position,
     nullif(btrim(p_title), ''), nullif(btrim(p_instructions), ''),
     coalesce(p_is_expected, false))
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.add_template_narrative(uuid, uuid, text, text, boolean)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- update_template_narrative(narrative_id, title, instructions, is_expected,
--                          clear_title, clear_instructions) -> slot
-- ---------------------------------------------------------------------------
-- In-place edit. SQL cannot distinguish "omit" from "set null" for the optional
-- text fields, so the clear flags are the explicit null path (mirror
-- update_template_phase's p_clear_recommend_when). is_expected is left untouched
-- when NULL. narrative_type_id + display_position are NOT editable here (type is
-- fixed at add; order is the reorder RPC). Draft-only.
create function public.update_template_narrative(
  p_narrative_id uuid,
  p_title text default null,
  p_instructions text default null,
  p_is_expected boolean default null,
  p_clear_title boolean default false,
  p_clear_instructions boolean default false
)
returns public.process_template_narratives
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_status text;
  v_result public.process_template_narratives;
begin
  perform app.assert_narratives_enabled();

  select n.template_id, t.status
    into v_template_id, v_status
  from public.process_template_narratives n
  join public.process_templates t on t.id = n.template_id
  where n.id = p_narrative_id;

  if v_template_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  update public.process_template_narratives
  set title = case
                when p_clear_title then null
                when p_title is null then title
                else nullif(btrim(p_title), '')
              end,
      instructions = case
                       when p_clear_instructions then null
                       when p_instructions is null then instructions
                       else nullif(btrim(p_instructions), '')
                     end,
      is_expected = coalesce(p_is_expected, is_expected)
  where id = p_narrative_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_template_narrative(uuid, text, text, boolean, boolean, boolean)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- remove_template_narrative(narrative_id)
-- ---------------------------------------------------------------------------
-- Deletes a narrative slot, then shifts BOTH phases AND narratives with a higher
-- display_position down by 1 (two UPDATEs), so the interleave stays contiguous. A
-- narrative is NEVER referenced by recommend_when/blocks (those key on phase
-- position), so removal can never dangle a reference — no re-validation needed.
-- Draft-only.
create function public.remove_template_narrative(p_narrative_id uuid)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_display_position integer;
  v_status text;
begin
  perform app.assert_narratives_enabled();

  select n.template_id, n.display_position, t.status
    into v_template_id, v_display_position, v_status
  from public.process_template_narratives n
  join public.process_templates t on t.id = n.template_id
  where n.id = p_narrative_id;

  if v_template_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  delete from public.process_template_narratives where id = p_narrative_id;

  -- Shift the tail of BOTH tables down by one. The deferrable display_position
  -- uniques tolerate any transient duplicate within each statement.
  update public.process_template_narratives
  set display_position = display_position - 1
  where template_id = v_template_id and display_position > v_display_position;

  update public.process_template_phases
  set display_position = display_position - 1
  where template_id = v_template_id and display_position > v_display_position;
end;
$$;

grant execute on function public.remove_template_narrative(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reorder_case_layout_template(template_id, p_ordered jsonb) -> void
-- ---------------------------------------------------------------------------
-- THE CROSS-TABLE INTERLEAVE REORDER. p_ordered is a top-to-bottom JSON array of
-- {kind,id} ('phase'|'narrative'), and renumbers display_position 1..N across BOTH
-- tables (generalizes reorder_case_outcomes' unnest…with ordinality to a
-- two-table join keyed by kind+id). position (the phase NUMBER) is NEVER touched.
-- The set MUST be COMPLETE (count = phases + narratives) else HC054 — a partial
-- set would leave rows un-renumbered and break the deferrable uniques / the merge.
-- Draft-only.
create function public.reorder_case_layout_template(
  p_template_id uuid,
  p_ordered jsonb
)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_expected integer;
  v_supplied integer;
  v_matched integer;
begin
  perform app.assert_narratives_enabled();

  select status into v_status from public.process_templates where id = p_template_id;
  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_ordered is null or jsonb_typeof(p_ordered) <> 'array' then
    raise exception 'a ordem informada é inválida' using errcode = 'HC054';
  end if;

  -- The COMPLETE set = every phase + every narrative of the template.
  select
    (select count(*) from public.process_template_phases where template_id = p_template_id)
    + (select count(*) from public.process_template_narratives where template_id = p_template_id)
    into v_expected;

  select count(*) into v_supplied
  from jsonb_array_elements(p_ordered) as e
  where e ->> 'kind' in ('phase', 'narrative') and (e ->> 'id') is not null;

  if v_supplied <> v_expected then
    raise exception
      'a ordem informada está incompleta (esperado %, recebido %)', v_expected, v_supplied
      using errcode = 'HC054';
  end if;

  -- Renumber phases 1..N from the ordinal of their {kind:'phase',id} entry. Each
  -- statement only touches rows whose id actually belongs to this template, so a
  -- spoofed id simply matches nothing.
  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind, n::integer as pos
    from jsonb_array_elements(p_ordered) with ordinality as t(e, n)
  )
  update public.process_template_phases ph
  set display_position = o.pos
  from ord o
  where o.kind = 'phase' and ph.id = o.id and ph.template_id = p_template_id;

  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind, n::integer as pos
    from jsonb_array_elements(p_ordered) with ordinality as t(e, n)
  )
  update public.process_template_narratives nr
  set display_position = o.pos
  from ord o
  where o.kind = 'narrative' and nr.id = o.id and nr.template_id = p_template_id;

  -- Belt-and-suspenders: confirm every supplied entry matched a row of this
  -- template (rejects a complete-count set that references foreign/garbage ids).
  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind
    from jsonb_array_elements(p_ordered) as e
    where e ->> 'kind' in ('phase', 'narrative') and (e ->> 'id') is not null
  )
  select count(*) into v_matched
  from ord o
  where exists (
    select 1 from public.process_template_phases ph
    where ph.id = o.id and ph.template_id = p_template_id and o.kind = 'phase'
  ) or exists (
    select 1 from public.process_template_narratives nr
    where nr.id = o.id and nr.template_id = p_template_id and o.kind = 'narrative'
  );

  if v_matched <> v_expected then
    raise exception 'a ordem informada referencia itens inválidos' using errcode = 'HC054';
  end if;
end;
$$;

grant execute on function public.reorder_case_layout_template(uuid, jsonb)
  to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function created above
-- ===========================================================================
revoke execute on function public.add_template_narrative(uuid, uuid, text, text, boolean) from anon, public;
revoke execute on function public.update_template_narrative(uuid, text, text, boolean, boolean, boolean) from anon, public;
revoke execute on function public.remove_template_narrative(uuid) from anon, public;
revoke execute on function public.reorder_case_layout_template(uuid, jsonb) from anon, public;
