-- =============================================================================
-- Case custom fields (ADR 0083) — template-defined administrative descriptors.
--
-- Two dedicated case-attribute relations (NOT the form/response engine, D1):
--   * process_template_custom_fields — the DEFINITIONS, authored on a template.
--   * case_custom_field_values       — per-case SNAPSHOT + value (D2), frozen on
--                                      create so later template edits never rewrite
--                                      historical cases.
--
-- RLS mirrors the existing case-attribute patterns (verified against the LIVE
-- catalog, not migration text — ADR 0078): the definitions table follows
-- process_template_outcomes; the values table follows case_offered_outcomes
-- (SELECT via can_read_case; write via staff_admin AND NOT case-excluded).
--
-- create_case_from_template is EXTENDED (new p_custom_fields param) to snapshot
-- the defs + write values + enforce required IN THE SAME TRANSACTION (D6). A new
-- update_case_custom_field_values RPC is the audited edit path (D7), modeled on
-- update_case_meta. PHI: none — administrative references only (Rule 12 intact).
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. process_template_custom_fields — the DEFINITIONS (on the template).
-- -----------------------------------------------------------------------------
create table public.process_template_custom_fields (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.process_templates (id) on delete cascade,
  key         text not null,
  label       text not null,
  field_type  text not null
    check (field_type in ('short_text', 'number', 'date', 'dropdown', 'multiple_choice')),
  -- Single-select options ({code,label}[]). Non-empty IFF the field is a choice
  -- type; empty ('[]') otherwise (D3).
  options     jsonb not null default '[]'::jsonb
    check (
      case
        when field_type in ('dropdown', 'multiple_choice')
          then jsonb_typeof(options) = 'array' and jsonb_array_length(options) > 0
        else options = '[]'::jsonb
      end
    ),
  required     boolean not null default false,
  show_in_list boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint process_template_custom_fields_key_unique unique (template_id, key)
);

create index process_template_custom_fields_template_idx
  on public.process_template_custom_fields (template_id);

alter table public.process_template_custom_fields enable row level security;

-- SELECT: members of the template's commission (mirrors process_template_outcomes).
create policy process_template_custom_fields_select
  on public.process_template_custom_fields
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_template(template_id))
    or app.is_commission_admin_of(app.commission_of_template(template_id))
  );

-- WRITE(ALL): staff_admin / commission-admin of the template's commission.
create policy process_template_custom_fields_staff_admin_write
  on public.process_template_custom_fields
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_template(template_id))
    or app.is_commission_admin_of(app.commission_of_template(template_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template(template_id))
    or app.is_commission_admin_of(app.commission_of_template(template_id))
  );

grant all on table public.process_template_custom_fields to authenticated;
grant all on table public.process_template_custom_fields to service_role;

comment on table public.process_template_custom_fields is
  'ADR 0083 — template-defined custom-field DEFINITIONS. Snapshotted onto each case at creation (case_custom_field_values). Administrative references only, NON-PHI (Rule 12).';

-- -----------------------------------------------------------------------------
-- 2. case_custom_field_values — per-case SNAPSHOT + value.
-- -----------------------------------------------------------------------------
create table public.case_custom_field_values (
  id      uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  -- Provenance only (nullable): the case does not depend on the def surviving.
  template_field_id uuid references public.process_template_custom_fields (id) on delete set null,
  -- FROZEN snapshot of the def at creation time (D2).
  key        text not null,
  label      text not null,
  field_type text not null
    check (field_type in ('short_text', 'number', 'date', 'dropdown', 'multiple_choice')),
  options    jsonb not null default '[]'::jsonb
    check (
      case
        when field_type in ('dropdown', 'multiple_choice')
          then jsonb_typeof(options) = 'array' and jsonb_array_length(options) > 0
        else options = '[]'::jsonb
      end
    ),
  -- The value, stored as jsonb so a number stays a JSON number (avoids the
  -- lexical-compare pitfall). number → JSON number; date → 'YYYY-MM-DD' string;
  -- single-select → option code string; short_text → string. Nullable.
  value      jsonb,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_custom_field_values_key_unique unique (case_id, key)
);

create index case_custom_field_values_case_idx
  on public.case_custom_field_values (case_id);

alter table public.case_custom_field_values enable row level security;

-- SELECT: anyone who can read the case (mirrors case_offered_outcomes).
create policy case_custom_field_values_select
  on public.case_custom_field_values
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

-- WRITE(ALL): staff_admin of the case's commission AND not case-excluded
-- (mirrors case_offered_outcomes — the exclusion perimeter, ADR 0078 Unit 2).
create policy case_custom_field_values_staff_admin_write
  on public.case_custom_field_values
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    and (not app.is_case_excluded(case_id, auth.uid()))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id))
    and (not app.is_case_excluded(case_id, auth.uid()))
  );

grant all on table public.case_custom_field_values to authenticated;
grant all on table public.case_custom_field_values to service_role;

comment on table public.case_custom_field_values is
  'ADR 0083 — per-case SNAPSHOT of custom fields + their value (jsonb). Frozen at creation; edited via update_case_custom_field_values (audited). NON-PHI (Rule 12).';

-- -----------------------------------------------------------------------------
-- 3. Feature flag (default OFF; seed forces ON for local/E2E).
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values (
  'case_custom_fields',
  false,
  'ADR 0083 — template-defined case custom fields (administrative descriptors). Default off.'
)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 4. create_case_from_template — EXTENDED with p_custom_fields (D6).
--    Rebuilt from the LIVE function body (pg_get_functiondef), NOT reconstructed
--    from an older migration (ADR 0078 — migration text is stale). Additions:
--      (a) required-field validation, early (before minting the case);
--      (b) the custom-field SNAPSHOT insert, beside the offered-outcomes snapshot.
--    Adding a param changes arity → DROP then CREATE.
-- -----------------------------------------------------------------------------
drop function public.create_case_from_template(uuid, text, uuid, text, uuid);

create function public.create_case_from_template(
  p_template_id uuid,
  p_label text DEFAULT NULL::text,
  p_department_id uuid DEFAULT NULL::uuid,
  p_department_other text DEFAULT NULL::text,
  p_case_type_id uuid DEFAULT NULL::uuid,
  p_custom_fields jsonb DEFAULT '[]'::jsonb
)
 RETURNS cases
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
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

  if p_case_type_id is not null and app.feature_enabled('case_types') then
    select default_visibility_policy, default_confidentiality_level
      into v_visibility, v_confidentiality
    from public.case_types
    where id = p_case_type_id
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
        (commission_id, template_id, label, created_by, patient_enabled,
         department_id, department_other, visibility_policy, confidentiality_level)
      values
        (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(),
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

revoke all on function public.create_case_from_template(uuid, text, uuid, text, uuid, jsonb) from public;
grant execute on function public.create_case_from_template(uuid, text, uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.create_case_from_template(uuid, text, uuid, text, uuid, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- 5. update_case_custom_field_values — the audited EDIT path (D7).
--    Self-gates like update_case_meta (coordinator/commission-admin, OR a
--    create_cases Administrativo behind its flag), enforces the exclusion
--    perimeter (HC0F1) + terminal-case freeze (HC025), and UPDATES existing
--    value rows only (the snapshot set is fixed at creation — no new rows). A
--    required field cannot be blanked (HC068). Emits one PHI-free audit row.
-- -----------------------------------------------------------------------------
create function public.update_case_custom_field_values(
  p_case_id uuid,
  p_values jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_commission uuid;
  v_status text;
begin
  perform app.assert_cases_enabled();

  select commission_id, status into v_commission, v_status
  from public.cases where id = p_case_id;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  -- Authority: coordinator/commission-admin (flag-independent), OR an
  -- Administrativo with create_cases (flag-gated). Mirrors update_case_meta.
  if app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission) then
    null;
  elsif app.member_can(v_commission, 'create_cases') then
    perform app.assert_administrativo_enabled();
  else
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Exclusion perimeter (ADR 0078 Unit 2): a recused/respondent coordinator is
  -- denied (HC0F1) after authority, before the terminal check.
  perform app.assert_not_case_excluded(p_case_id);

  -- A terminal case is frozen (HC025).
  if v_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- A required field cannot be blanked. The resulting value is the payload value
  -- when the key is present, else the existing stored value. "required" is read
  -- from the LIVE def (via the provenance FK); a value whose def was deleted is
  -- treated as optional.
  if exists (
    select 1
    from public.case_custom_field_values v
    join public.process_template_custom_fields f
      on f.id = v.template_field_id and f.required
    left join lateral (
      select (e.elem -> 'value') as val
      from jsonb_array_elements(coalesce(p_values, '[]'::jsonb)) as e(elem)
      where e.elem ->> 'key' = v.key
      limit 1
    ) nv on true
    where v.case_id = p_case_id
      and (
        case
          when nv.val is not null then
            jsonb_typeof(nv.val) = 'null'
            or (jsonb_typeof(nv.val) = 'string' and btrim(nv.val #>> '{}') = '')
          else
            v.value is null
            or jsonb_typeof(v.value) = 'null'
            or (jsonb_typeof(v.value) = 'string' and btrim(v.value #>> '{}') = '')
        end
      )
  ) then
    raise exception 'não é possível deixar em branco um campo obrigatório'
      using errcode = 'HC068';
  end if;

  -- Update existing rows only (matched by frozen key). Unknown keys no-op; the
  -- snapshot set cannot grow after creation.
  update public.case_custom_field_values v
  set value = case
        when jsonb_typeof(nv.val) = 'null'
          or (jsonb_typeof(nv.val) = 'string' and btrim(nv.val #>> '{}') = '')
        then null
        else nv.val
      end,
      updated_at = now()
  from (
    select e.elem ->> 'key' as key, (e.elem -> 'value') as val
    from jsonb_array_elements(coalesce(p_values, '[]'::jsonb)) as e(elem)
    where e.elem -> 'value' is not null
  ) nv
  where v.case_id = p_case_id
    and v.key = nv.key;

  -- One PHI-free mutation audit row (no-ops while audit_trail is off) — same
  -- shape as set_case_offered_outcomes (Rule 11).
  perform app.audit_write(
    'case.custom_fields_set', 'case', p_case_id, v_commission,
    'Campos personalizados do caso atualizados',
    jsonb_build_object(
      'count', (select count(*) from jsonb_array_elements(coalesce(p_values, '[]'::jsonb)))
    )
  );
end;
$function$;

revoke all on function public.update_case_custom_field_values(uuid, jsonb) from public;
grant execute on function public.update_case_custom_field_values(uuid, jsonb) to authenticated;
grant execute on function public.update_case_custom_field_values(uuid, jsonb) to service_role;

commit;
