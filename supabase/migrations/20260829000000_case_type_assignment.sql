-- Case-type assignment: close the ADR 0064 D4 channel.
--
-- ETH·E3a shipped `cases.case_type_id` + an OPTIONAL `p_case_type_id` on both create
-- RPCs, and left "how does a case acquire a type" as Open decision O-1
-- (docs/phases/ethics-e3-surfacing.md). O-1 was never resolved, so NO caller ever passed
-- the param and the column was unreachable from the app: every app-created case landed
-- `case_type_id` NULL. That also made each `case_types` row's
-- `default_visibility_policy` / `default_confidentiality_level` INERT — the seeded
-- Ethics type resolves `explicit_grants_only` / `ethics_investigation`, but a case
-- created through the UI fell to the hardcoded `commission_default` /
-- `non_phi_internal`, i.e. visible to the whole commission (a Rule-12 gap the E3a
-- lead ruling believed closed).
--
-- This migration builds the channel ADR 0064 D4 specifies — "a process template
-- references a case_type; a case snapshots its case_type_id":
--
--   1. `process_templates.case_type_id` (nullable FK) — the template DECLARES its type.
--   2. An org-consistency trigger: the declared type must belong to the same org as the
--      template's commission. A trigger rather than a composite FK on purpose — a new
--      composite FK breaks un-hinted PostgREST embeds elsewhere (PGRST201, BUG-NPH-003).
--   3. `create_case_from_template` INHERITS the template's type when the caller passes
--      none; an explicit `p_case_type_id` still overrides.
--
-- `create_case` (processless) is unchanged: it has no template to inherit from, so
-- `p_case_type_id` stays its only channel, now supplied by the create-case dialog.
-- NULL remains legal end to end — an untyped case keeps today's exact behaviour and the
-- platform-default terminology bundle.

alter table public.process_templates
  add column case_type_id uuid references public.case_types(id) on delete set null;

comment on column public.process_templates.case_type_id is
  'The case type this process declares (ADR 0064 D4). Cases created from this template '
  'snapshot it into cases.case_type_id, inheriting the type''s default visibility / '
  'confidentiality. NULL = untyped (the pre-Ethics default).';

-- ---------------------------------------------------------------------------
-- Org-consistency guard
-- ---------------------------------------------------------------------------
-- process_templates is written directly through PostgREST under its
-- `process_templates_staff_admin_write` FOR ALL policy (no DEFINER write RPC), so the
-- cross-table org check has to live in a trigger; an action-layer check alone would be
-- bypassable by any other writer.
create or replace function app.guard_process_template_case_type()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $fn$
begin
  if new.case_type_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.case_types ct
    where ct.id = new.case_type_id
      and ct.organization_id = app.org_of_commission(new.commission_id)
  ) then
    raise exception 'este tipo de caso não pertence à organização desta comissão'
      using errcode = 'HC0F7';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_process_template_case_type on public.process_templates;
create trigger trg_process_template_case_type
  before insert or update of case_type_id, commission_id on public.process_templates
  for each row execute function app.guard_process_template_case_type();

-- ---------------------------------------------------------------------------
-- create_case_from_template — inherit the template's declared type
-- ---------------------------------------------------------------------------
-- Full body reproduced from the LIVE catalog (pg_get_functiondef) with five surgical
-- edits: declare + read + resolve `v_case_type_id`, then use it in the case_types
-- lookup and the INSERT. Everything else is byte-for-byte unchanged.

CREATE OR REPLACE FUNCTION public.create_case_from_template(p_template_id uuid, p_label text DEFAULT NULL::text, p_department_id uuid DEFAULT NULL::uuid, p_department_other text DEFAULT NULL::text, p_case_type_id uuid DEFAULT NULL::uuid, p_custom_fields jsonb DEFAULT '[]'::jsonb)
 RETURNS cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case_type_id uuid;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_case_phase_id uuid;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
  v_dept_other text := nullif(btrim(p_department_other), '');
  v_visibility text := 'commission_default';
  v_confidentiality text := 'non_phi_internal';
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient, case_type_id
    into v_commission_id, v_status, v_collects, v_case_type_id
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'create_cases')) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  -- ADR 0064 D4 — "the template declares its type; a case snapshots case_type_id".
  -- An EXPLICIT p_case_type_id overrides; otherwise the case INHERITS the template's.
  -- Before this, p_case_type_id was the only channel and no caller passed it, so the
  -- type (and with it a case_type's default_visibility_policy) was inert for every
  -- app-created case.
  v_case_type_id := coalesce(p_case_type_id, v_case_type_id);

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

  if v_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = v_case_type_id
      and organization_id = app.org_of_commission(v_commission_id);
    if not found then
      raise exception 'tipo de caso não encontrado para esta organização'
        using errcode = 'no_data_found';
    end if;
  end if;

  -- ADR 0083 — required custom fields must carry a value. Checked EARLY (only
  -- reads the template defs + the caller's payload) so we fail before minting a
  -- case. A value is "blank" when absent, JSON null, or an empty/whitespace string.
  if exists (
    select 1
    from public.process_template_custom_fields f
    left join lateral (
      select (e.elem -> 'value') as val
      from jsonb_array_elements(coalesce(p_custom_fields, '[]'::jsonb)) as e(elem)
      where e.elem ->> 'key' = f.key
      limit 1
    ) cf on true
    where f.template_id = p_template_id
      and f.required
      and (
        cf.val is null
        or jsonb_typeof(cf.val) = 'null'
        or (jsonb_typeof(cf.val) = 'string' and btrim(cf.val #>> '{}') = '')
      )
  ) then
    raise exception 'preencha todos os campos personalizados obrigatórios'
      using errcode = 'HC068';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases
        (commission_id, template_id, case_type_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (v_commission_id, p_template_id, v_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
         coalesce(v_collects, false), p_department_id, v_dept_other,
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

  for r_slot in
    select id, position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset, emits_result
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
       emits_result)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset,
       r_slot.emits_result)
    returning id into v_case_phase_id;

    insert into public.case_phase_allowed_results (case_phase_id, result_id, position)
    select v_case_phase_id, tar.result_id, tar.position
    from public.process_template_phase_allowed_results tar
    where tar.template_phase_id = r_slot.id
      and r_slot.emits_result;
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  -- ADR 0083 — SNAPSHOT each template custom-field def onto the case, freezing
  -- key/label/field_type/options/position and writing the caller-provided value.
  -- Value normalized to NULL when blank (JSON null or empty/whitespace string);
  -- otherwise the jsonb value is kept verbatim (a number stays a JSON number).
  insert into public.case_custom_field_values
    (case_id, template_field_id, key, label, field_type, options, value, position)
  select
    v_case.id, f.id, f.key, f.label, f.field_type, f.options,
    case
      when cf.val is null
        or jsonb_typeof(cf.val) = 'null'
        or (jsonb_typeof(cf.val) = 'string' and btrim(cf.val #>> '{}') = '')
      then null
      else cf.val
    end,
    f.position
  from public.process_template_custom_fields f
  left join lateral (
    select (e.elem -> 'value') as val
    from jsonb_array_elements(coalesce(p_custom_fields, '[]'::jsonb)) as e(elem)
    where e.elem ->> 'key' = f.key
    limit 1
  ) cf on true
  where f.template_id = p_template_id;

  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from (
    select (r ->> 'result_id')::uuid as rid
    from public.case_phases cp
    cross join lateral jsonb_array_elements(coalesce(cp.result_ruleset -> 'rules', '[]'::jsonb)) as r
    where cp.case_id = v_case.id
    union
    select (cp.result_ruleset ->> 'default_result_id')::uuid
    from public.case_phases cp
    where cp.case_id = v_case.id
    union
    select cpar.result_id
    from public.case_phase_allowed_results cpar
    join public.case_phases cp on cp.id = cpar.case_phase_id
    where cp.case_id = v_case.id
  ) ids
  where ids.rid is not null
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

  -- ADR 0061 (revised): self-grant the non-coordinator creator a READ. (Flag branch
  -- collapsed — B4.)
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant');
  end if;

  return v_case;
end;
$function$;
