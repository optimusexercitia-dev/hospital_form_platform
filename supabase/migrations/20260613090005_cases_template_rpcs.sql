-- Phase 7 / B2: Process-template lifecycle + phase-slot RPCs.
--
-- The mutation entry points for the per-commission template builder. Each is
-- SECURITY INVOKER (Architecture Rule 1): RLS remains the authority — the
-- process_templates / process_template_phases staff_admin-write policies (B4)
-- confine writes to staff_admins of the commission (+ admins). The RPCs add the
-- structural validation RLS cannot cheaply express (slot ordering, the
-- recommend_when invariants) and friendly typed errors.
--
-- Every RPC gates app.feature_enabled('cases_multi_phase') at entry; while the
-- flag is OFF (until phase completion) they raise a clean "feature unavailable"
-- check_violation. Tests / seed run with the flag temporarily ON.
--
-- recommend_when (ADR 0017) is a SUPERSET of a section's visible_when: it adds
-- from_phase (which earlier phase's answers it reads). Deep validity is enforced
-- by app.validate_template_recommend_when:
--   * from_phase is an integer in [1, position) — references an EARLIER slot;
--   * that earlier slot's form has a PUBLISHED version (else HC017);
--   * the referenced question_key exists as an INPUT item in that published
--     version (else HC016).
-- This is re-validated at snapshot (B3 create_case_from_template) against the
-- PINNED versions, since a template edit between publish and case creation could
-- otherwise leave a dangling reference.
--
-- New SQLSTATEs used here: HC016 (invalid recommend_when / slot still
-- referenced), HC017 (form has no published version), HC023 (template not in an
-- archivable state — QA MINOR-2). See 20260613090004 header.

-- ---------------------------------------------------------------------------
-- app.feature_cases_enabled() — shared entry gate
-- ---------------------------------------------------------------------------
-- A thin helper so every Phase-7 RPC gates the flag identically and raises the
-- same pt-BR-mappable error. check_violation (23514) maps to a generic
-- "feature unavailable" in the data layer.
create function app.assert_cases_enabled()
returns void
language plpgsql
stable
set search_path = app, public, pg_catalog
as $$
begin
  if not app.feature_enabled('cases_multi_phase') then
    raise exception 'o recurso de casos multifásicos não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function app.assert_cases_enabled() from public;
grant execute on function app.assert_cases_enabled() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- app.published_version_of_form(form_id) -> uuid
-- ---------------------------------------------------------------------------
-- The currently-published version of a form, or NULL if none. SECURITY DEFINER
-- + pinned search_path so it reads the version regardless of the caller's RLS
-- (it is only invoked from already-gated RPCs that have separately confirmed the
-- caller's staff_admin rights via RLS on the parent template/case write).
create function app.published_version_of_form(p_form_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select id
  from public.form_versions
  where form_id = p_form_id and status = 'published'
  order by version_number desc
  limit 1;
$$;

revoke all on function app.published_version_of_form(uuid) from public;
grant execute on function app.published_version_of_form(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- app.version_has_input_key(version_id, question_key) -> boolean
-- ---------------------------------------------------------------------------
-- True when the question_key exists as an INPUT item in the given version.
-- (form_items carries a denormalized form_version_id, so no section join is
-- needed.) Display items have a null question_key, so they never match.
create function app.version_has_input_key(p_version_id uuid, p_question_key text)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.form_items
    where form_version_id = p_version_id
      and question_key = p_question_key
      and item_type in ('multiple_choice', 'dropdown', 'checkbox', 'free_text')
  );
$$;

revoke all on function app.version_has_input_key(uuid, text) from public;
grant execute on function app.version_has_input_key(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- app.validate_template_recommend_when(template_id, position, recommend_when)
-- ---------------------------------------------------------------------------
-- Structural validation of one slot's recommend_when, evaluated against the
-- TEMPLATE's current slots (the source slot's form's PUBLISHED version). A null
-- recommend_when is always valid. Raises HC016 / HC017 with a clear pt-BR
-- message. Returns true when valid. SECURITY DEFINER (reads sibling slots +
-- versions); it does NOT itself write, and is only called from the gated RPCs.
create function app.validate_template_recommend_when(
  p_template_id uuid,
  p_position integer,
  p_recommend_when jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_from_phase integer;
  v_question_key text;
  v_source_form_id uuid;
  v_source_version uuid;
begin
  if p_recommend_when is null then
    return true;
  end if;

  v_from_phase := (p_recommend_when ->> 'from_phase')::integer;
  v_question_key := p_recommend_when ->> 'question_key';

  -- from_phase must reference an EARLIER slot (1-based positions).
  if v_from_phase is null or v_from_phase < 1 or v_from_phase >= p_position then
    raise exception
      'a recomendação da fase % deve referenciar uma fase anterior (fase informada: %)',
      p_position, coalesce(v_from_phase::text, 'nula')
      using errcode = 'HC016';
  end if;

  -- Resolve the source slot's form + its published version.
  select form_id into v_source_form_id
  from public.process_template_phases
  where template_id = p_template_id and position = v_from_phase;

  if v_source_form_id is null then
    raise exception
      'a recomendação da fase % referencia a fase %, que não existe no processo',
      p_position, v_from_phase
      using errcode = 'HC016';
  end if;

  v_source_version := app.published_version_of_form(v_source_form_id);
  if v_source_version is null then
    raise exception
      'o formulário da fase % (origem da recomendação) ainda não foi publicado',
      v_from_phase
      using errcode = 'HC017';
  end if;

  -- The referenced question_key must exist as an input item in that version.
  if not app.version_has_input_key(v_source_version, v_question_key) then
    raise exception
      'a recomendação da fase % referencia a pergunta "%", que não existe no formulário da fase %',
      p_position, v_question_key, v_from_phase
      using errcode = 'HC016';
  end if;

  return true;
end;
$$;

revoke all on function app.validate_template_recommend_when(uuid, integer, jsonb) from public;
grant execute on function app.validate_template_recommend_when(uuid, integer, jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_process_template(commission_id, title, description) -> process_templates
-- ---------------------------------------------------------------------------
create function public.create_process_template(
  p_commission_id uuid,
  p_title text,
  p_description text default null
)
returns public.process_templates
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe o título do processo' using errcode = 'check_violation';
  end if;

  -- RLS (process_templates staff_admin-write) authorizes the insert.
  insert into public.process_templates (commission_id, title, description, created_by)
  values (p_commission_id, btrim(p_title), nullif(btrim(p_description), ''), auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_process_template(uuid, text, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- archive_process_template(template_id) -> process_templates
-- ---------------------------------------------------------------------------
-- Only a draft or active template may be archived. Archiving an already-archived
-- (or otherwise non-archivable) template raises HC023 rather than silently
-- no-op'ing on an unconditional UPDATE (QA MINOR-2).
create function public.archive_process_template(p_template_id uuid)
returns public.process_templates
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  select status into v_status
  from public.process_templates
  where id = p_template_id;

  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;

  if v_status not in ('draft', 'active') then
    raise exception 'este processo não pode ser arquivado'
      using errcode = 'HC023';
  end if;

  update public.process_templates
  set status = 'archived', updated_at = now()
  where id = p_template_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.archive_process_template(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- add_template_phase(template_id, form_id, title, recommend_when) -> phase
-- ---------------------------------------------------------------------------
-- Appends a slot at max(position)+1 (1-based). recommend_when, when present, is
-- validated AFTER the row would sit at its position. Editing is only permitted
-- while the template is a draft (an active/archived template's phases are
-- frozen — a published template is a stable blueprint; clone-to-edit is out of
-- scope for v1, ADR 0017).
create function public.add_template_phase(
  p_template_id uuid,
  p_form_id uuid,
  p_title text default null,
  p_recommend_when jsonb default null
)
returns public.process_template_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

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

  -- The bound form must belong to the same commission.
  if not exists (
    select 1 from public.forms
    where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.process_template_phases
  where template_id = p_template_id;

  -- Insert first so validate_template_recommend_when can resolve this slot's
  -- position among its siblings if needed; validate the new recommend_when.
  insert into public.process_template_phases (template_id, position, form_id, title, recommend_when)
  values (p_template_id, v_position, p_form_id, nullif(btrim(p_title), ''), p_recommend_when)
  returning * into v_result;

  perform app.validate_template_recommend_when(p_template_id, v_position, p_recommend_when);

  return v_result;
end;
$$;

grant execute on function public.add_template_phase(uuid, uuid, text, jsonb)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- update_template_phase(phase_id, form_id, title, recommend_when) -> phase
-- ---------------------------------------------------------------------------
-- Updates a slot in place. NULL args leave form_id/title untouched;
-- recommend_when is REPLACED (pass the JSON to set, or 'null'::jsonb is rejected
-- by the shape check — callers pass SQL NULL to clear via a dedicated flag).
-- Because SQL cannot distinguish "omit" from "set null" for recommend_when, the
-- action layer always sends the desired final recommend_when (NULL to clear).
create function public.update_template_phase(
  p_phase_id uuid,
  p_form_id uuid default null,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_clear_recommend_when boolean default false
)
returns public.process_template_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_commission_id uuid;
  v_new_recommend jsonb;
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status, t.commission_id
    into v_template_id, v_position, v_status, v_commission_id
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_form_id is not null and not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  -- Determine the final recommend_when: clear, replace, or keep.
  if p_clear_recommend_when then
    v_new_recommend := null;
  elsif p_recommend_when is not null then
    v_new_recommend := p_recommend_when;
  else
    select recommend_when into v_new_recommend
    from public.process_template_phases where id = p_phase_id;
  end if;

  update public.process_template_phases
  set form_id = coalesce(p_form_id, form_id),
      title = case when p_title is null then title else nullif(btrim(p_title), '') end,
      recommend_when = v_new_recommend
  where id = p_phase_id
  returning * into v_result;

  perform app.validate_template_recommend_when(v_template_id, v_position, v_new_recommend);

  return v_result;
end;
$$;

grant execute on function public.update_template_phase(uuid, uuid, text, jsonb, boolean)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- reorder_template_phase(phase_id, direction)
-- ---------------------------------------------------------------------------
-- Adjacent swap (mirror reorder_section, ADR 0011): a single UPDATE so the
-- deferrable-immediate unique tolerates the transient duplicate. After the swap,
-- EVERY recommend_when in the template is re-validated, because a move can break
-- a from_phase < position reference (HC016).
create function public.reorder_template_phase(
  p_phase_id uuid,
  p_direction text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_neighbor_id uuid;
  v_neighbor_position integer;
  r record;
begin
  perform app.assert_cases_enabled();

  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_id = v_template_id and position < v_position
    order by position desc limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_id = v_template_id and position > v_position
    order by position asc limit 1;
  end if;

  if v_neighbor_id is null then
    return;  -- boundary
  end if;

  update public.process_template_phases
  set position = case id
                   when p_phase_id then v_neighbor_position
                   when v_neighbor_id then v_position
                 end
  where id in (p_phase_id, v_neighbor_id);

  -- Re-validate every recommend_when after the renumber.
  for r in
    select position, recommend_when
    from public.process_template_phases
    where template_id = v_template_id and recommend_when is not null
  loop
    perform app.validate_template_recommend_when(v_template_id, r.position, r.recommend_when);
  end loop;
end;
$$;

grant execute on function public.reorder_template_phase(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- remove_template_phase(phase_id)
-- ---------------------------------------------------------------------------
-- Deletes a slot and renumbers the tail. Rejected (HC016) when another slot's
-- recommend_when.from_phase references this position (removing it would dangle
-- the reference). After delete, every recommend_when is re-validated against the
-- renumbered positions.
create function public.remove_template_phase(p_phase_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  r record;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  -- A later slot recommending FROM this position would dangle.
  if exists (
    select 1 from public.process_template_phases
    where template_id = v_template_id
      and recommend_when is not null
      and (recommend_when ->> 'from_phase')::integer = v_position
  ) then
    raise exception
      'não é possível remover a fase %: outra fase a usa como condição de recomendação',
      v_position
      using errcode = 'HC016';
  end if;

  delete from public.process_template_phases where id = p_phase_id;

  -- Renumber the tail: every slot after the removed position shifts down one.
  update public.process_template_phases
  set position = position - 1
  where template_id = v_template_id and position > v_position;

  -- Re-validate remaining recommend_whens against the new numbering.
  for r in
    select position, recommend_when
    from public.process_template_phases
    where template_id = v_template_id and recommend_when is not null
  loop
    perform app.validate_template_recommend_when(v_template_id, r.position, r.recommend_when);
  end loop;
end;
$$;

grant execute on function public.remove_template_phase(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- publish_process_template(template_id) -> process_templates
-- ---------------------------------------------------------------------------
-- draft -> active. Requires >= 1 phase and validates every recommend_when. Once
-- active, the blueprint is stable (new cases snapshot it); editing is closed
-- (add/update/remove/reorder require draft).
create function public.publish_process_template(p_template_id uuid)
returns public.process_templates
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_phase_count integer;
  r record;
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  select status into v_status from public.process_templates where id = p_template_id;
  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser publicados'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_phase_count
  from public.process_template_phases where template_id = p_template_id;
  if v_phase_count < 1 then
    raise exception 'um processo precisa de ao menos uma fase para ser publicado'
      using errcode = 'HC016';
  end if;

  for r in
    select position, recommend_when
    from public.process_template_phases
    where template_id = p_template_id and recommend_when is not null
  loop
    perform app.validate_template_recommend_when(p_template_id, r.position, r.recommend_when);
  end loop;

  update public.process_templates
  set status = 'active', updated_at = now()
  where id = p_template_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.publish_process_template(uuid) to authenticated, service_role;
