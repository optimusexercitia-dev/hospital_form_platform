-- ============================================================================
-- Administrativo (ADR 0061) — grant the NON-coordinator creator case_access READ
-- ============================================================================
-- Closes the creator-visibility gap: app.can_read_case has NO creator arm, so a
-- `create_cases` Administrativo who opened a case (and isn't assigned/granted) could
-- neither see it on the board nor open it. Fix at the create RPCs, NOT by adding a
-- creator arm to can_read_case (the read boundary stays single-sourced through the
-- case_access ACL — auditable + revocable, ADR 0033).
--
-- After the case row is inserted, when the creator reached the RPC via the
-- member_can('create_cases') arm — i.e. a NON-coordinator creator — grant THEM a
-- case_access READ on their own case (revised model: read-only — just enough to SEE
-- the case they opened; case-content WRITE stays the coordinator's explicit
-- grant_case_access). A coordinator / commission-admin already sees the whole board
-- (list_cases_board fast-path) and needs nothing, so skip them (no audit noise). The
-- skip check `NOT (is_staff_admin_of OR is_commission_admin_of)` guarantees only the
-- capability-arm creator self-grants. Gated on the case_access feature being live.
--
-- Bodies are byte-identical to 20260714000000 (create_case / create_case_from_template)
-- EXCEPT the added self-grant before `return v_case`. Same signatures + RETURNS type,
-- so CREATE OR REPLACE (no drop). Forward-only, additive.
-- ============================================================================

-- create_case (process-less) — self-grant the non-coordinator creator.
create or replace function public.create_case(
  p_commission_id uuid, p_label text default null, p_patient_enabled boolean default false,
  p_outcome_ids uuid[] default '{}'::uuid[], p_department_id uuid default null,
  p_department_other text default null
) returns public.cases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
  v_dept_other text := nullif(btrim(p_department_other), '');
begin
  perform app.assert_cases_enabled();
  perform app.assert_processless_cases_enabled();

  if not exists (select 1 from public.commissions where id = p_commission_id) then
    raise exception 'comissão % não encontrada', p_commission_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()
          or app.member_can(p_commission_id, 'create_cases')) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, p_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  if cardinality(p_outcome_ids) > 0 then
    perform app.assert_extras_enabled();

    select oid into v_bad
    from unnest(p_outcome_ids) as oid
    where not exists (
      select 1 from public.case_outcomes o
      where o.id = oid
        and o.commission_id = p_commission_id
        and o.archived = false
    )
    limit 1;
    if found then
      raise exception 'este desfecho não pertence à comissão deste caso'
        using errcode = 'HC030';
    end if;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other)
      values
        (p_commission_id, null, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(p_patient_enabled, false), p_department_id, v_dept_other)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  if cardinality(p_outcome_ids) > 0 then
    insert into public.case_offered_outcomes (case_id, outcome_id)
    select v_case.id, oid from unnest(p_outcome_ids) as oid
    on conflict do nothing;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  -- ADR 0061 (revised): a NON-coordinator (capability-arm) creator self-grants
  -- case_access READ — just enough to SEE the case they opened (can_read_case has no
  -- creator arm). NOT write: case-content write stays the coordinator's explicit
  -- grant_case_access. Coordinators/commission-admins already see the whole board —
  -- skip them.
  if app.feature_enabled('case_access')
     and not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read');
  end if;

  return v_case;
end;
$$;
alter function public.create_case(uuid, text, boolean, uuid[], uuid, text) owner to postgres;
revoke all on function public.create_case(uuid, text, boolean, uuid[], uuid, text) from public;
grant execute on function public.create_case(uuid, text, boolean, uuid[], uuid, text) to authenticated, service_role;

-- create_case_from_template — self-grant the non-coordinator creator.
create or replace function public.create_case_from_template(
  p_template_id uuid, p_label text default null,
  p_department_id uuid default null, p_department_other text default null
) returns public.cases
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
  v_dept_other text := nullif(btrim(p_department_other), '');
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient
    into v_commission_id, v_status, v_collects
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'create_cases')) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, v_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other)
      values
        (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(v_collects, false), p_department_id, v_dept_other)
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset, emits_result, allowed_result_ids
    from public.process_template_phases
    where template_id = p_template_id
    order by position
  loop
    v_version := app.published_version_of_form(r_slot.form_id);
    if v_version is null then
      raise exception
        'o formulário da fase % ainda não foi publicado', r_slot.position
        using errcode = 'HC017';
    end if;

    if r_slot.recommend_when is not null then
      perform app.validate_template_recommend_when(
        p_template_id, r_slot.position, r_slot.recommend_when
      );
    end if;

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position, result_ruleset,
       emits_result, allowed_result_ids)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset,
       r_slot.emits_result, r_slot.allowed_result_ids);
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from public.process_template_phases ph
  cross join lateral (
    select (r ->> 'result_id')::uuid as rid
    from jsonb_array_elements(coalesce(ph.result_ruleset -> 'rules', '[]'::jsonb)) as r
    union
    select (ph.result_ruleset ->> 'default_result_id')::uuid
    union
    select (m #>> '{}')::uuid
    from jsonb_array_elements(coalesce(ph.allowed_result_ids, '[]'::jsonb)) as m
  ) ids
  where ph.template_id = p_template_id
    and ids.rid is not null
  on conflict do nothing;

  if v_narratives_on then
    insert into public.case_narratives
      (case_id, narrative_type_id, type_label, display_position, title,
       instructions, is_expected, created_by)
    select v_case.id, ptn.narrative_type_id,
           coalesce(nullif(btrim(ptn.title), ''), cnt.label),
           ptn.display_position, ptn.title, ptn.instructions, ptn.is_expected,
           auth.uid()
    from public.process_template_narratives ptn
    join public.case_narrative_types cnt on cnt.id = ptn.narrative_type_id
    where ptn.template_id = p_template_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case.id);

  -- ADR 0061 (revised): self-grant the non-coordinator (capability-arm) creator
  -- case_access READ (see create_case — read-only, not write).
  if app.feature_enabled('case_access')
     and not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read');
  end if;

  return v_case;
end;
$$;
alter function public.create_case_from_template(uuid, text, uuid, text) owner to postgres;
revoke all on function public.create_case_from_template(uuid, text, uuid, text) from public;
grant execute on function public.create_case_from_template(uuid, text, uuid, text) to authenticated, service_role;
