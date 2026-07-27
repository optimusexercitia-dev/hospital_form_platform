-- =============================================================================
-- ETH·E3a BE-2 — cases.case_type_id (E1-surface amendment; ADR 0064 D4 / ADR 0072).
--
-- Additive, nullable, forward-only, reset-OK. A case SNAPSHOTS its case_type at
-- creation (O-1); NULL stays legal — a type-less case (the pre-Ethics default, the
-- overwhelming majority) is unaffected.
--
-- `create_case_from_template` already VALIDATES p_case_type_id (org-consistency guard
-- + derives default visibility/confidentiality from the type) but never PERSISTED it;
-- we add the column to its INSERT. The processless `create_case` gains the same
-- optional param AND the O-1 Rule-12 inheritance: when a case_type is supplied it MUST
-- resolve the type's default_visibility_policy/confidentiality_level (so an Ethics case
-- created via the processless path resolves explicit_grants_only — else E1's access
-- spine has a hole), never merely snapshot the id.
-- =============================================================================

alter table public.cases
  add column case_type_id uuid references public.case_types(id) on delete set null;

comment on column public.cases.case_type_id is
  'The case''s type (ADR 0064 D4), snapshotted at creation; NULL = type-less (the pre-Ethics default). Drives terminology resolution and default visibility/confidentiality inheritance at create time.';

-- ---------------------------------------------------------------------------
-- create_case_from_template — persist the case_type_id it already validates.
-- Signature UNCHANGED → the body is rewritten in place via the established
-- pg_get_functiondef + replace + execute pattern (touches ONLY the cases INSERT;
-- grants preserved, so no t19 re-grant). Fails loudly if the anchor text drifts.
-- ---------------------------------------------------------------------------
do $rewrite$
declare
  v_def  text := pg_get_functiondef('public.create_case_from_template(uuid,text,uuid,text,uuid,jsonb)'::regprocedure);
  v_cols_from text := E'        (commission_id, template_id, label, created_by, patient_enabled,\n         department_id, department_other, visibility_policy, confidentiality_level)';
  v_cols_to   text := E'        (commission_id, template_id, case_type_id, label, created_by, patient_enabled,\n         department_id, department_other, visibility_policy, confidentiality_level)';
  v_vals_from text := E'        (v_commission_id, p_template_id, nullif(btrim(p_label), ''''), auth.uid(),';
  v_vals_to   text := E'        (v_commission_id, p_template_id, p_case_type_id, nullif(btrim(p_label), ''''), auth.uid(),';
begin
  if position(v_cols_from in v_def) = 0 or position(v_vals_from in v_def) = 0 then
    raise exception 'create_case_from_template INSERT anchor not found — body drifted; migration must be revised';
  end if;
  v_def := replace(v_def, v_cols_from, v_cols_to);
  v_def := replace(v_def, v_vals_from, v_vals_to);
  execute v_def;
end;
$rewrite$;

-- ---------------------------------------------------------------------------
-- create_case (processless) — the signature GAINS p_case_type_id, so a plain
-- CREATE OR REPLACE would mint a SECOND overload. Drop + recreate, then re-issue the
-- t19 grants (revoke from public; grant to authenticated, service_role). No DB object
-- depends on it (pg_depend deptype='n' is empty), so the drop is safe.
-- ---------------------------------------------------------------------------
drop function if exists public.create_case(uuid, text, boolean, uuid[], uuid, text);

create function public.create_case(
  p_commission_id uuid,
  p_label text default null,
  p_patient_enabled boolean default false,
  p_outcome_ids uuid[] default '{}'::uuid[],
  p_department_id uuid default null,
  p_department_other text default null,
  p_case_type_id uuid default null
)
returns cases
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_attempt integer := 0;
  v_bad uuid;
  v_dept_other text := nullif(btrim(p_department_other), '');
  -- O-1: default to today's column defaults; a supplied case_type overrides them.
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
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

  -- O-1 Rule-12 inheritance: a supplied case_type must resolve in the case's org
  -- (mirrors create_case_from_template's guard) AND sets visibility/confidentiality
  -- from the type (an Ethics type resolves explicit_grants_only). Guarded by the
  -- case_types flag so the path is inert until E3a is live.
  if p_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = p_case_type_id
      and organization_id = app.org_of_commission(p_commission_id);
    if not found then
      raise exception 'tipo de caso não encontrado para esta organização'
        using errcode = 'no_data_found';
    end if;
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
        (commission_id, template_id, case_type_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (p_commission_id, null, p_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(p_patient_enabled, false), p_department_id, v_dept_other,
         v_visibility, v_confidentiality)
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

  -- ADR 0061 (revised): a NON-coordinator (capability-arm) creator self-grants a
  -- case_access READ — just enough to SEE the case they opened. Coordinators/commission
  -- admins already see the whole board — skip them. (Flag branch collapsed — B4.)
  if not (app.is_staff_admin_of(p_commission_id) or app.is_commission_admin_of(p_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant');
  end if;

  return v_case;
end;
$function$;

-- t19 — new arg list ⇒ re-issue grants (drop wiped the ACL).
revoke all on function public.create_case(uuid, text, boolean, uuid[], uuid, text, uuid) from public;
grant execute on function public.create_case(uuid, text, boolean, uuid[], uuid, text, uuid) to authenticated, service_role;
