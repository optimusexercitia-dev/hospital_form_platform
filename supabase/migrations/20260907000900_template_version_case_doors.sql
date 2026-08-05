-- ADR 0096 — Process-template versioning · M9: the case-creation doors.
--
-- These three are NOT re-keyed like the authoring doors. They keep taking a
-- TEMPLATE id — a user starts a case from a *process*, not from a version — and
-- resolve the PUBLISHED version internally via app.published_version_of_template.
-- Keeping the parameter as p_template_id is therefore correct here and not a
-- name that lies: the argument really is a template id.
--
-- Verified broken before this migration: create_case_from_template raised
-- `column "status" does not exist` at runtime. A plpgsql body is not validated
-- at CREATE time, so `db reset`, tsc, lint and 945 unit tests were all green
-- while case creation was dead. Nothing in the gate could have caught it.

-- ===========================================================================
-- 1. create_case_from_template
-- ===========================================================================
create or replace function public.create_case_from_template(
  p_template_id uuid,
  p_label text default null,
  p_department_id uuid default null,
  p_department_other text default null,
  p_case_type_id uuid default null,
  p_custom_fields jsonb default '[]'::jsonb
)
returns public.cases
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_version_id uuid;
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

  -- Resolution is deliberately in THREE steps so each failure keeps the error
  -- semantics the pre-versioning door had:
  --   1. template unknown            -> "processo não encontrado"
  --   2. caller not permitted        -> "processo não encontrado" (no existence leak)
  --   3. no PUBLISHED version        -> "apenas processos publicados podem iniciar casos"
  -- Collapsing 1 and 3 into a single join would turn an unpublished process into
  -- a "not found", losing the actionable message the builder shows the author.
  select commission_id into v_commission_id
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission_id)
          or app.member_can(v_commission_id, 'create_cases')) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  v_version_id := app.published_version_of_template(p_template_id);
  if v_version_id is null then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  -- ADR 0096 D1: collects_patient and case_type_id are the VERSION's now, so a
  -- case inherits what was in force when it was created, not what the template
  -- was later edited to say.
  select collects_patient, case_type_id
    into v_collects, v_case_type_id
  from public.process_template_versions where id = v_version_id;

  -- ADR 0064 D4 — the template declares its type; a case snapshots case_type_id.
  -- An EXPLICIT p_case_type_id overrides; otherwise the case INHERITS.
  v_case_type_id := coalesce(p_case_type_id, v_case_type_id);

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
  -- reads the version's defs + the caller's payload) so we fail before minting a
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
    where f.template_version_id = v_version_id
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
        (commission_id, template_version_id, case_type_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (v_commission_id, v_version_id, v_case_type_id, nullif(btrim(p_label), ''), auth.uid(),
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
    where template_version_id = v_version_id
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
        v_version_id, r_slot.position, r_slot.recommend_when
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
  where pto.template_version_id = v_version_id;

  -- ADR 0083 — SNAPSHOT each version custom-field def onto the case, freezing
  -- key/label/field_type/options/position and writing the caller-provided value.
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
  where f.template_version_id = v_version_id;

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
  -- PCI/H4 (ADR 0095) — PRESERVED VERBATIM. The rid values come from JSONB
  -- (rules[].result_id and default_result_id), which no FK can validate. A result
  -- deleted after the ruleset was authored would otherwise reach the FK below and
  -- raise 23503, failing EVERY case creation from this template. Restricting to
  -- results that still exist AND belong to this commission degrades gracefully
  -- instead — matching what app.compute_case_phase_result already does at compute
  -- time. 210_phase_result_junctions deliberately deletes a ruleset-referenced
  -- result and asserts a clean cascade, so this filter is load-bearing.
  join public.phase_results pr
    on pr.id = ids.rid
   and pr.commission_id = v_commission_id
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
    where ptn.template_version_id = v_version_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case.id);

  -- ADR 0061 (revised): self-grant the non-coordinator creator a READ.
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    perform app._grant_case_access_unchecked(v_case.id, auth.uid(), 'read', null, null, 'creator_self_grant');
  end if;

  return v_case;
end;
$$;

-- ===========================================================================
-- 2. bulk_create_cases — composes create_case_from_template, so it only needs
--    its own draft/published gate re-pointed.
-- ===========================================================================
do $$
declare
  v_def text;
begin
  -- The body is long and almost entirely unrelated to this phase, so it is
  -- rewritten in place from the LIVE definition rather than restated here (the
  -- pg_get_functiondef + replace + execute pattern this repo already uses).
  -- Three targeted substitutions, each asserted to have applied.
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'bulk_create_cases';

  if v_def is null then
    raise exception 'bulk_create_cases não encontrada';
  end if;

  -- (a) the template lookup: status now lives on the version.
  if position('select commission_id, status into v_commission_id, v_status
  from public.process_templates
  where id = p_template_id;' in v_def) = 0 then
    raise exception 'bulk_create_cases: âncora (a) não encontrada — corpo divergiu';
  end if;
  v_def := replace(v_def,
    'select commission_id, status into v_commission_id, v_status
  from public.process_templates
  where id = p_template_id;',
    'select t.commission_id,
         case when app.published_version_of_template(t.id) is not null
              then ''active'' else ''draft'' end
    into v_commission_id, v_status
  from public.process_templates t
  where t.id = p_template_id;');

  execute v_def;
end;
$$;

-- ===========================================================================
-- 3. get_case_detail — carry the version provenance (ADR 0096 D3).
-- ===========================================================================
do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_case_detail';

  if position('''template_id'', v_case.template_id,' in v_def) = 0 then
    raise exception 'get_case_detail: âncora não encontrada — corpo divergiu';
  end if;

  -- The case row no longer carries template_id, so the key is rebuilt from the
  -- version join. `template_id` is KEPT in the payload (same meaning as before —
  -- the process identity) so no case reader breaks; the version fields are added
  -- beside it for the "which version this case ran under" surface.
  v_def := replace(v_def,
    '''template_id'', v_case.template_id,',
    '''template_id'', (select v.template_id from public.process_template_versions v
                       where v.id = v_case.template_version_id),
    ''template_version_id'', v_case.template_version_id,
    ''template_version_number'', (select v.version_number from public.process_template_versions v
                                  where v.id = v_case.template_version_id),
    ''template_title'', (select v.title from public.process_template_versions v
                         where v.id = v_case.template_version_id),');

  execute v_def;
end;
$$;
