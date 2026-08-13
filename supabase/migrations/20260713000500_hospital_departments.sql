-- ============================================================================
-- Hospital Departments — a hospital-scoped, NON-PHI vocabulary ("Unidade /
-- setor"), first consumed by case creation (replaces the Novo-caso free-text
-- patient `unit` as the case's department). Mirrors the pqs_department
-- hospital-scoping pattern (ADR 0052) + the hospital_admin authority tier
-- (ADR 0051).
--
-- NON-PHI + CASE-LEVEL: the case's department lives on public.cases
-- (department_id / department_other), NEVER on the PHI case_patient table.
-- Safety events keep their own free-text case_patient.unit (untouched).
--
-- Additive, pre-launch (no back-compat). Applied LOCALLY via supabase migration
-- up / db reset; remote `db push` is coordinated separately.
--
-- ORDER:
--   1. table hospital_departments (+ constraints/indexes/RLS/trigger)
--   2. app.is_hospital_member_of(uuid) SELECT-arm helper
--   3. RLS policies (SELECT = any hospital member; WRITE = org_admin/hospital_admin)
--   4. reorder_departments RPC (atomic position rewrite)
--   5. cases.department_id / cases.department_other (+ shape CHECK)
--   6. create_case / create_case_from_template re-created with the two new params
-- ============================================================================

-- ============================================================================
-- SECTION 1 — TABLE
-- ============================================================================

create table if not exists public.hospital_departments (
  id           uuid primary key default gen_random_uuid(),
  hospital_id  uuid not null references public.hospitals(id) on delete cascade,
  name         text not null,
  position     integer not null default 0,
  archived     boolean not null default false,
  created_at   timestamp with time zone not null default now(),
  updated_at   timestamp with time zone not null default now(),
  constraint hospital_departments_name_not_blank check (btrim(name) <> '')
);

alter table public.hospital_departments owner to postgres;

comment on table public.hospital_departments is
  'Hospital-scoped, NON-PHI department vocabulary ("Unidade / setor"). Managed nested under each hospital by org_admin (any hospital in org) + hospital_admin (own hospital only); read by any member of the hospital (case creators need the dropdown). Consumed case-level via cases.department_id (never on the PHI case_patient table).';

-- Unique among NON-archived rows: an archived department may share a name with a
-- live one (re-create the same setor after archiving). Case-insensitive.
create unique index hospital_departments_hospital_lower_name_key
  on public.hospital_departments (hospital_id, lower(name))
  where archived = false;

-- The ordered per-hospital dropdown read (position, then name).
create index hospital_departments_hospital_position_idx
  on public.hospital_departments (hospital_id, position);

-- updated_at maintenance (bespoke trigger, mirrors touch_case_narrative_updated_at).
create or replace function app.touch_hospital_department_updated_at()
  returns trigger
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
alter function app.touch_hospital_department_updated_at() owner to postgres;

drop trigger if exists touch_hospital_department_updated_at_trg on public.hospital_departments;
create trigger touch_hospital_department_updated_at_trg
  before update on public.hospital_departments
  for each row execute function app.touch_hospital_department_updated_at();

alter table public.hospital_departments enable row level security;

-- ============================================================================
-- SECTION 2 — SELECT-arm helper: is_hospital_member_of(hospital)
-- Any commission member of the hospital (the plain-staff case-creator arm). Mirror
-- of is_org_member: STABLE SECURITY DEFINER, search_path pinned, is_active-gated,
-- REVOKE PUBLIC + GRANT authenticated/service_role. Read-only (no PHI).
-- ============================================================================

create or replace function app.is_hospital_member_of(p_hospital_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1
    from public.commissions c
    join public.commission_members cm on cm.commission_id = c.id
    where c.hospital_id = p_hospital_id
      and cm.user_id = auth.uid()
  );
$$;
alter function app.is_hospital_member_of(uuid) owner to postgres;
comment on function app.is_hospital_member_of(uuid) is
  'The caller is a commission member of ANY commission in the given hospital (hospital-membership via commission->hospital). is_active-gated. Mirror of is_org_member; read-only, NO PHI. Backs the hospital_departments SELECT policy''s plain-staff arm.';
revoke all on function app.is_hospital_member_of(uuid) from public;
grant execute on function app.is_hospital_member_of(uuid) to authenticated, service_role;

-- ============================================================================
-- SECTION 3 — RLS POLICIES
-- ============================================================================

-- SELECT: any member of the hospital (case creators must see the dropdown).
create policy hospital_departments_select on public.hospital_departments
  for select to authenticated
  using (
    app.is_admin()
    or app.is_org_admin_of(app.org_of_hospital(hospital_id))
    or app.is_hospital_admin_of(hospital_id)
    or app.is_pqs_operator_of(hospital_id)
    or app.is_hospital_member_of(hospital_id)
  );
comment on policy hospital_departments_select on public.hospital_departments is
  'Any member of the hospital reads the department vocabulary (org_admin / hospital_admin / NSP operator / commission member). Non-PHI; unblocks the Novo-caso dropdown for plain staff.';

-- WRITE (insert / update / archive): org_admin of the org OR hospital_admin of the
-- hospital. No DELETE policy (archive-only; deletes denied by absence).
create policy hospital_departments_write on public.hospital_departments
  for all to authenticated
  using (
    app.is_org_admin_of(app.org_of_hospital(hospital_id))
    or app.is_hospital_admin_of(hospital_id)
  )
  with check (
    app.is_org_admin_of(app.org_of_hospital(hospital_id))
    or app.is_hospital_admin_of(hospital_id)
  );
comment on policy hospital_departments_write on public.hospital_departments is
  'ADR 0051 authority tier: org_admin (any hospital in org) OR hospital_admin (own hospital only) may create/rename/reorder/archive departments. Archive-only (no DELETE policy).';

-- Table grants (RLS still gates). No DELETE grant (archive-only).
grant select, insert, update on public.hospital_departments to authenticated;

-- ============================================================================
-- SECTION 4 — reorder_departments RPC (atomic position rewrite)
-- ============================================================================

-- SECURITY DEFINER so the whole re-position is one transaction (vs N racy
-- PostgREST updates). Because DEFINER bypasses RLS, it re-enforces the WRITE
-- predicate in-body AND validates that EVERY id belongs to p_hospital_id and is
-- non-archived — else it raises (no silent-ignore, so a mixed/foreign id list can
-- neither scramble nor probe another hospital's departments).
create or replace function public.reorder_departments(
  p_hospital_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_bad uuid;
begin
  if p_hospital_id is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;

  if not (
    app.is_org_admin_of(app.org_of_hospital(p_hospital_id))
    or app.is_hospital_admin_of(p_hospital_id)
  ) then
    raise exception 'sem permissão para reordenar setores' using errcode = '42501';
  end if;

  -- Every listed id MUST be a non-archived department of THIS hospital. A foreign,
  -- archived, or nonexistent id fails the whole call (never a partial scramble).
  select oid into v_bad
  from unnest(p_ordered_ids) as oid
  where not exists (
    select 1 from public.hospital_departments d
    where d.id = oid
      and d.hospital_id = p_hospital_id
      and d.archived = false
  )
  limit 1;
  if found then
    raise exception 'a lista de setores contém um item inválido para este hospital'
      using errcode = 'HC030';
  end if;

  -- Rewrite position = array index. Unlisted (e.g. archived) departments keep their
  -- position — a reorder of the live list is fine and does not disturb archived rows.
  update public.hospital_departments d
  set position = ord.idx
  from (
    select id, (ordinality - 1)::int as idx
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) ord
  where d.id = ord.id
    and d.hospital_id = p_hospital_id;
end;
$$;
alter function public.reorder_departments(uuid, uuid[]) owner to postgres;
revoke all on function public.reorder_departments(uuid, uuid[]) from public;
grant execute on function public.reorder_departments(uuid, uuid[]) to authenticated, service_role;

-- ============================================================================
-- SECTION 5 — cases.department_id / cases.department_other
-- ============================================================================

alter table public.cases
  add column if not exists department_id uuid
    references public.hospital_departments(id) on delete set null,
  add column if not exists department_other text;

-- Exactly one of {department_id, department_other} may be set; both null =
-- unspecified. (department_other is trimmed-to-null by the create RPC.)
alter table public.cases
  add constraint cases_department_shape check (
    department_id is null or department_other is null
  );

comment on column public.cases.department_id is
  'The case''s department ("Unidade / setor"), FK -> hospital_departments (of the case''s hospital). NON-PHI, case-level. on delete set null so archiving/removing a department never orphans the case. Mutually exclusive with department_other. Optional (both null = unspecified).';
comment on column public.cases.department_other is
  'The custom "Outro" department value when the case''s setor is not in the managed list. NON-PHI, case-level. Mutually exclusive with department_id. Trimmed-to-null at write time.';

-- ============================================================================
-- SECTION 6 — create_case / create_case_from_template re-created with the two
-- new params. Bodies are byte-identical to the baseline EXCEPT the new params +
-- validation + the two new insert columns.
-- ============================================================================

-- app.department_belongs_to_commission(dept, commission): the department must
-- belong to the commission's HOSPITAL and be non-archived. Single helper so both
-- create RPCs validate identically (never re-implemented inline).
create or replace function app.department_belongs_to_commission(
  p_department_id uuid,
  p_commission_id uuid
)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.hospital_departments d
    join public.commissions c on c.hospital_id = d.hospital_id
    where d.id = p_department_id
      and c.id = p_commission_id
      and d.archived = false
  );
$$;
alter function app.department_belongs_to_commission(uuid, uuid) owner to postgres;
revoke all on function app.department_belongs_to_commission(uuid, uuid) from public;
grant execute on function app.department_belongs_to_commission(uuid, uuid) to authenticated, service_role;

create or replace function public.create_case(
  p_commission_id uuid,
  p_label text default null,
  p_patient_enabled boolean default false,
  p_outcome_ids uuid[] default '{}'::uuid[],
  p_department_id uuid default null,
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

  -- The commission must exist (DEFINER bypasses RLS -> validate explicitly).
  if not exists (select 1 from public.commissions where id = p_commission_id) then
    raise exception 'comissão % não encontrada', p_commission_id using errcode = 'no_data_found';
  end if;

  -- Authority: staff_admin of THIS commission OR platform admin.
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Department shape: at most one of {id, other} may be set (the DB CHECK also
  -- guards, but a clear pt-BR error is nicer than a raw 23514).
  if p_department_id is not null and v_dept_other is not null then
    raise exception 'informe um setor da lista OU um valor personalizado, não ambos'
      using errcode = '23514';
  end if;
  -- A chosen department must belong to THIS case's hospital + be non-archived
  -- (HC030 same-hospital idiom — a dept from a DIFFERENT hospital is rejected).
  if p_department_id is not null
     and not app.department_belongs_to_commission(p_department_id, p_commission_id) then
    raise exception 'este setor não pertence ao hospital deste caso'
      using errcode = 'HC030';
  end if;

  -- Validate the optional offered-outcome set.
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

  return v_case;
end;
$$;

alter function public.create_case(uuid, text, boolean, uuid[], uuid, text) owner to postgres;
revoke all on function public.create_case(uuid, text, boolean, uuid[], uuid, text) from public;
grant execute on function public.create_case(uuid, text, boolean, uuid[], uuid, text) to authenticated, service_role;

-- Drop the OLD 4-arg signature (superseded — the two-param version is the only one).
drop function if exists public.create_case(uuid, text, boolean, uuid[]);

create or replace function public.create_case_from_template(
  p_template_id uuid,
  p_label text default null,
  p_department_id uuid default null,
  p_department_other text default null
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

  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  -- Department shape + hospital ownership (same as create_case).
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

  return v_case;
end;
$$;

alter function public.create_case_from_template(uuid, text, uuid, text) owner to postgres;
revoke all on function public.create_case_from_template(uuid, text, uuid, text) from public;
grant execute on function public.create_case_from_template(uuid, text, uuid, text) to authenticated, service_role;

-- Drop the OLD 2-arg signature (superseded).
drop function if exists public.create_case_from_template(uuid, text);
