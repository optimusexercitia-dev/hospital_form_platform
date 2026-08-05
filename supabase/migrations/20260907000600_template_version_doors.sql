-- ADR 0096 — Process-template versioning · M6: authoring + lifecycle doors.
--
-- Bodies below were taken from `pg_proc` on the live catalog, not from migration
-- files (CLAUDE.md / ADR 0078 A28: file text is stale by design here).
--
-- Two mechanical rules applied throughout:
--   * the draft gate `select status from process_templates` becomes
--     `select status from process_template_versions` — the status IS the
--     version's now, which is the whole point of the remodel;
--   * every `join process_templates t on t.id = X.template_id` becomes a two-hop
--     join through process_template_versions.
--
-- DROP + CREATE wherever a parameter name changes, so `p_template_id` cannot
-- survive as a name that lies about its content (ADR 0096 Amendment A1.1 item 6).
--
-- The case-creation doors (create_case_from_template, bulk_create_cases,
-- get_case_detail) are NOT here — they land in the next migration, because they
-- resolve the PUBLISHED version rather than being re-keyed, and
-- create_case_from_template must preserve the ADR-0095 H4 existence filter.

-- ===========================================================================
-- 1. Version-children copier (mirrors app.copy_version_children for forms)
-- ===========================================================================

create or replace function app.copy_template_version_children(
  p_source_version_id uuid, p_target_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_source_commission uuid;
  v_target_commission uuid;
  v_target_status text;
  v_actor uuid := (select auth.uid());
  r record;
begin
  v_source_commission := app.commission_of_template_version(p_source_version_id);
  v_target_commission := app.commission_of_template_version(p_target_version_id);

  if v_source_commission is null or v_target_commission is null then
    raise exception 'versão de processo não encontrada'
      using errcode = 'no_data_found';
  end if;

  -- This runs as the owner, so it must re-check the authority its caller proved
  -- via RLS. Mirrors app.copy_version_children exactly, including tolerating a
  -- null actor (migrations/tests run without auth.uid()).
  if v_actor is not null and not (
    (app.is_staff_admin_of(v_source_commission) or app.is_commission_admin_of(v_source_commission))
    and
    (app.is_staff_admin_of(v_target_commission) or app.is_commission_admin_of(v_target_commission))
  ) then
    raise exception 'você não pode editar processos nesta comissão'
      using errcode = '42501';
  end if;

  select status into v_target_status
  from public.process_template_versions where id = p_target_version_id;

  if v_target_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'HC0P4';
  end if;

  create temp table _tpl_phase_map (old_id uuid, new_id uuid) on commit drop;

  -- Phases. `position` is the join key for the id map: it is unique per version
  -- (M4 re-pointed that unique to the version grain, which is exactly what makes
  -- two versions able to both own a phase at position 1).
  with src as (
    select id, position, form_id, title, recommend_when, default_due_days,
           blocks, display_position, result_ruleset, emits_result
    from public.process_template_phases
    where template_version_id = p_source_version_id
  ),
  ins as (
    insert into public.process_template_phases (
      template_version_id, position, form_id, title, recommend_when,
      default_due_days, blocks, display_position, result_ruleset, emits_result
    )
    select p_target_version_id, position, form_id, title, recommend_when,
           default_due_days, blocks, display_position, result_ruleset, emits_result
    from src
    order by position
    returning id, position
  )
  insert into _tpl_phase_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.position = src.position;

  -- The allowed-results junction, re-pointed onto the cloned phases.
  insert into public.process_template_phase_allowed_results
    (template_phase_id, result_id, position)
  select m.new_id, ar.result_id, ar.position
  from public.process_template_phase_allowed_results ar
  join _tpl_phase_map m on m.old_id = ar.template_phase_id;

  -- The offered shadow is derived, not copied: recompute it per cloned phase.
  for r in select new_id from _tpl_phase_map loop
    perform app.recompute_template_phase_offered_results(r.new_id);
  end loop;

  insert into public.process_template_narratives (
    template_version_id, narrative_type_id, display_position, title,
    instructions, is_expected
  )
  select p_target_version_id, narrative_type_id, display_position, title,
         instructions, is_expected
  from public.process_template_narratives
  where template_version_id = p_source_version_id;

  insert into public.process_template_outcomes
    (template_version_id, outcome_id, position)
  select p_target_version_id, outcome_id, position
  from public.process_template_outcomes
  where template_version_id = p_source_version_id;

  insert into public.process_template_custom_fields (
    template_version_id, key, label, field_type, options, required,
    show_in_list, position
  )
  select p_target_version_id, key, label, field_type, options, required,
         show_in_list, position
  from public.process_template_custom_fields
  where template_version_id = p_source_version_id;

  drop table _tpl_phase_map;
end;
$$;

-- ===========================================================================
-- 2. Lifecycle doors
-- ===========================================================================

-- create_process_template now mints the identity AND its v1 draft in one call.
--
-- NOTE: the INSERT below writes only (commission_id, created_by). The legacy
-- title/description/status columns on process_templates still exist and are
-- still NOT NULL at THIS point in the migration sequence — they are dropped two
-- migrations later. That is safe because plpgsql bodies are not validated at
-- CREATE time and nothing calls this function until every migration has run
-- (seed.sql runs after the full sequence). Ordering the drop earlier is not an
-- option: the policy swap has to happen before the columns go.
create or replace function public.create_process_template(
  p_commission_id uuid, p_title text, p_description text default null
)
returns public.process_templates
language plpgsql
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
  insert into public.process_templates (commission_id, created_by)
  values (p_commission_id, auth.uid())
  returning * into v_result;

  -- RLS (process_template_versions staff_admin-write) authorizes this one.
  insert into public.process_template_versions
    (template_id, version_number, status, title, description, created_by)
  values
    (v_result.id, 1, 'draft', btrim(p_title), nullif(btrim(p_description), ''), auth.uid());

  return v_result;
end;
$$;

-- Mirrors public.clone_form_version, including its idempotency contract: when an
-- open draft already exists it is RETURNED and nothing is cloned. That is the
-- guarantee the typed frontend surface depends on (`draftVersionId` would be
-- ambiguous with two drafts), and it is independently enforced by the
-- one-draft partial unique index from M1.
create or replace function public.clone_template_version(p_source_version_id uuid)
returns uuid
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_next_number integer;
  v_new_version_id uuid;
  v_uid uuid := auth.uid();
  v_existing_draft uuid;
begin
  perform app.assert_cases_enabled();

  select template_id into v_template_id
  from public.process_template_versions
  where id = p_source_version_id;

  if v_template_id is null then
    raise exception 'versão % não encontrada', p_source_version_id
      using errcode = 'no_data_found';
  end if;

  select id into v_existing_draft
  from public.process_template_versions
  where template_id = v_template_id and status = 'draft'
  limit 1;

  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.process_template_versions
  where template_id = v_template_id;

  -- RLS-gated. This INSERT is the authority proof for the clone; the helper
  -- re-checks the same predicate for its own writes because it runs as owner.
  insert into public.process_template_versions (
    template_id, version_number, status, title, description,
    collects_patient, case_type_id, created_by
  )
  select v_template_id, v_next_number, 'draft', s.title, s.description,
         s.collects_patient, s.case_type_id, v_uid
  from public.process_template_versions s
  where s.id = p_source_version_id
  returning id into v_new_version_id;

  perform app.copy_template_version_children(p_source_version_id, v_new_version_id);

  return v_new_version_id;
end;
$$;

-- Draft-only. Archives the incumbent published version FIRST, then publishes
-- this one — that order matters, because the one-published partial unique index
-- would reject the reverse. Both statements sit inside the same GUC window, so
-- a template is never momentarily unpublished and create_case_from_template can
-- never observe zero or two published versions.
create or replace function public.publish_template_version(p_template_version_id uuid)
returns public.process_template_versions
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_template_id uuid;
  v_status text;
  v_phase_count integer;
  v_result public.process_template_versions;
  r record;
begin
  perform app.assert_cases_enabled();

  select template_id, status into v_template_id, v_status
  from public.process_template_versions
  where id = p_template_version_id
  for update;

  if v_template_id is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser publicadas'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_phase_count
  from public.process_template_phases
  where template_version_id = p_template_version_id;

  if v_phase_count < 1 then
    raise exception 'um processo precisa de ao menos uma fase para ser publicado'
      using errcode = 'HC016';
  end if;

  for r in
    select position, recommend_when
    from public.process_template_phases
    where template_version_id = p_template_version_id and recommend_when is not null
  loop
    perform app.validate_template_recommend_when(
      p_template_version_id, r.position, r.recommend_when);
  end loop;

  for r in
    select position
    from public.process_template_phases
    where template_version_id = p_template_version_id and emits_result
  loop
    perform app.validate_template_phase_result(p_template_version_id, r.position);
  end loop;

  perform set_config('app.in_template_publish_rpc', 'on', true);

  update public.process_template_versions
  set status = 'archived'
  where template_id = v_template_id
    and status = 'published';

  update public.process_template_versions
  set status = 'published',
      published_at = now()
  where id = p_template_version_id
  returning * into v_result;

  perform set_config('app.in_template_publish_rpc', 'off', true);

  update public.process_templates set updated_at = now() where id = v_template_id;

  return v_result;
end;
$$;

-- Thin wrapper kept for the UI button and the 19 pgTAP suites that call it
-- (ADR 0096 Amendment A1.1 item 1). One implementation, two names.
create or replace function public.publish_process_template(p_template_id uuid)
returns public.process_templates
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_draft uuid;
  v_result public.process_templates;
begin
  v_draft := app.draft_version_of_template(p_template_id);

  if v_draft is null then
    raise exception 'este processo não tem um rascunho para publicar'
      using errcode = 'check_violation';
  end if;

  perform public.publish_template_version(v_draft);

  select * into v_result from public.process_templates where id = p_template_id;
  return v_result;
end;
$$;

-- ADR 0096 Amendment A1.1 item 3: archiving the template archives EVERY
-- non-archived version, so "archived template" means all versions archived and
-- archiving never leaves a published version in force.
create or replace function public.archive_process_template(p_template_id uuid)
returns public.process_templates
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  if not exists (select 1 from public.process_templates where id = p_template_id) then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1 from public.process_template_versions
    where template_id = p_template_id and status <> 'archived'
  ) then
    raise exception 'este processo não pode ser arquivado'
      using errcode = 'HC023';
  end if;

  perform set_config('app.in_template_publish_rpc', 'on', true);

  update public.process_template_versions
  set status = 'archived'
  where template_id = p_template_id
    and status <> 'archived';

  perform set_config('app.in_template_publish_rpc', 'off', true);

  update public.process_templates set updated_at = now() where id = p_template_id;

  select * into v_result from public.process_templates where id = p_template_id;
  return v_result;
end;
$$;

-- Discarding a DRAFT. Never touches the published version, so the process keeps
-- running while an abandoned edit is thrown away. The immutability trigger
-- refuses this for any non-draft, and cases.template_version_id ON DELETE
-- RESTRICT independently protects a version a case ran under.
create or replace function public.discard_template_draft(p_template_version_id uuid)
returns void
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_status text;
begin
  perform app.assert_cases_enabled();

  select status into v_status
  from public.process_template_versions
  where id = p_template_version_id;

  if v_status is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser descartadas'
      using errcode = 'check_violation';
  end if;

  -- RLS-gated delete; children cascade.
  delete from public.process_template_versions where id = p_template_version_id;
end;
$$;

-- ===========================================================================
-- 3. Authoring doors that take a VERSION id (DROP + CREATE — param renamed)
-- ===========================================================================

drop function public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[], jsonb, boolean, jsonb);

create function public.add_template_phase(
  p_template_version_id uuid,
  p_form_id uuid,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_default_due_days integer default null,
  p_blocks integer[] default '{}'::integer[],
  p_result_ruleset jsonb default null,
  p_emits_result boolean default false,
  p_allowed_result_ids jsonb default null
)
returns public.process_template_phases
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select v.status, t.commission_id into v_status, v_commission_id
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_template_version_id;

  if v_status is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.forms
    where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.process_template_phases
  where template_version_id = p_template_version_id;

  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  -- D3 (F-cleanup Minor): re-enforce the dropped *_result_emits CHECK invariant
  -- BEFORE the phase insert. Reject (not silently drop) to match the old
  -- constraint's semantics.
  if not coalesce(p_emits_result, false)
     and p_allowed_result_ids is not null
     and jsonb_typeof(p_allowed_result_ids) = 'array'
     and jsonb_array_length(p_allowed_result_ids) >= 1 then
    raise exception
      'a fase % não emite um resultado e não pode ter resultados permitidos', v_position
      using errcode = 'HC067';
  end if;

  insert into public.process_template_phases
    (template_version_id, position, form_id, title, recommend_when, default_due_days,
     blocks, result_ruleset, emits_result)
  values
    (p_template_version_id, v_position, p_form_id, nullif(btrim(p_title), ''),
     p_recommend_when, p_default_due_days, v_blocks,
     p_result_ruleset, p_emits_result)
  returning * into v_result;

  if p_allowed_result_ids is not null then
    insert into public.process_template_phase_allowed_results (template_phase_id, result_id, position)
    select v_result.id, (m #>> '{}')::uuid, ord::int
    from jsonb_array_elements(p_allowed_result_ids) with ordinality as t(m, ord)
    where (m #>> '{}') is not null
    on conflict do nothing;
  end if;

  perform app.recompute_template_phase_offered_results(v_result.id);

  perform app.validate_template_recommend_when(p_template_version_id, v_position, p_recommend_when);
  perform app.validate_template_phase_blocks(p_template_version_id, v_position, v_blocks);
  perform app.validate_template_result_ruleset(p_template_version_id, v_position, p_result_ruleset);
  perform app.validate_template_allowed_results(p_template_version_id, v_position, p_allowed_result_ids);

  return v_result;
end;
$$;

drop function public.add_template_narrative(uuid, uuid, text, text, boolean);

create function public.add_template_narrative(
  p_template_version_id uuid,
  p_narrative_type_id uuid,
  p_title text default null,
  p_instructions text default null,
  p_is_expected boolean default false
)
returns public.process_template_narratives
language plpgsql
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_position integer;
  v_result public.process_template_narratives;
begin
  perform app.assert_narratives_enabled();

  select status into v_status
  from public.process_template_versions
  where id = p_template_version_id;

  if v_status is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  -- Next display_position over BOTH slot kinds (the interleave). Phases fall back
  -- to `position` when their display_position is null.
  select coalesce(max(dp), 0) + 1 into v_position
  from (
    select coalesce(display_position, position) as dp
    from public.process_template_phases where template_version_id = p_template_version_id
    union all
    select display_position as dp
    from public.process_template_narratives where template_version_id = p_template_version_id
  ) s;

  insert into public.process_template_narratives
    (template_version_id, narrative_type_id, display_position, title, instructions, is_expected)
  values
    (p_template_version_id, p_narrative_type_id, v_position,
     nullif(btrim(p_title), ''), nullif(btrim(p_instructions), ''),
     coalesce(p_is_expected, false))
  returning * into v_result;

  return v_result;
end;
$$;

drop function public.set_process_outcomes(uuid, uuid[]);

create function public.set_process_outcomes(
  p_template_version_id uuid, p_outcome_ids uuid[]
)
returns void
language plpgsql
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_extras_enabled();

  select t.commission_id, v.status into v_commission_id, v_status
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_template_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  delete from public.process_template_outcomes
  where template_version_id = p_template_version_id;

  insert into public.process_template_outcomes (template_version_id, outcome_id, position)
  select p_template_version_id, oid, ord::integer
  from unnest(p_outcome_ids) with ordinality as t(oid, ord);
end;
$$;

drop function public.set_template_case_type(uuid, uuid);

create function public.set_template_case_type(
  p_template_version_id uuid, p_case_type_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
begin
  select t.commission_id, v.status into v_commission_id, v_status
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_template_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- Was "archived cannot be edited". Now DRAFT-ONLY: a published version is
  -- immutable, so the previous test would have let a publish-time edit through.
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if p_case_type_id is not null
     and not exists (
       select 1
       from public.case_types ct
       where ct.id = p_case_type_id
         and ct.organization_id = app.org_of_commission(v_commission_id)
     ) then
    raise exception 'este tipo de caso não pertence à organização desta comissão'
      using errcode = 'HC0F7';
  end if;

  update public.process_template_versions
  set case_type_id = p_case_type_id
  where id = p_template_version_id;
end;
$$;

drop function public.set_template_collects_patient(uuid, boolean);

create function public.set_template_collects_patient(
  p_template_version_id uuid, p_collects boolean
)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_case_patient_enabled();

  select t.commission_id, v.status into v_commission_id, v_status
  from public.process_template_versions v
  join public.process_templates t on t.id = v.template_id
  where v.id = p_template_version_id;

  if v_commission_id is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  update public.process_template_versions
  set collects_patient = coalesce(p_collects, false)
  where id = p_template_version_id;
end;
$$;

drop function public.reorder_case_layout_template(uuid, jsonb);

create function public.reorder_case_layout_template(
  p_template_version_id uuid, p_ordered jsonb
)
returns void
language plpgsql
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_expected integer;
  v_supplied integer;
  v_matched integer;
begin
  perform app.assert_narratives_enabled();

  select status into v_status
  from public.process_template_versions where id = p_template_version_id;
  if v_status is null then
    raise exception 'versão % não encontrada', p_template_version_id
      using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if p_ordered is null or jsonb_typeof(p_ordered) <> 'array' then
    raise exception 'a ordem informada é inválida' using errcode = 'HC054';
  end if;

  select
    (select count(*) from public.process_template_phases
      where template_version_id = p_template_version_id)
    + (select count(*) from public.process_template_narratives
      where template_version_id = p_template_version_id)
    into v_expected;

  select count(*) into v_supplied
  from jsonb_array_elements(p_ordered) as e
  where e ->> 'kind' in ('phase', 'narrative') and (e ->> 'id') is not null;

  if v_supplied <> v_expected then
    raise exception
      'a ordem informada está incompleta (esperado %, recebido %)', v_expected, v_supplied
      using errcode = 'HC054';
  end if;

  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind, n::integer as pos
    from jsonb_array_elements(p_ordered) with ordinality as t(e, n)
  )
  update public.process_template_phases ph
  set display_position = o.pos
  from ord o
  where o.kind = 'phase' and ph.id = o.id
    and ph.template_version_id = p_template_version_id;

  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind, n::integer as pos
    from jsonb_array_elements(p_ordered) with ordinality as t(e, n)
  )
  update public.process_template_narratives nr
  set display_position = o.pos
  from ord o
  where o.kind = 'narrative' and nr.id = o.id
    and nr.template_version_id = p_template_version_id;

  -- Belt-and-suspenders: confirm every supplied entry matched a row of THIS
  -- version (rejects a complete-count set referencing foreign/garbage ids).
  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind
    from jsonb_array_elements(p_ordered) as e
    where e ->> 'kind' in ('phase', 'narrative') and (e ->> 'id') is not null
  )
  select count(*) into v_matched
  from ord o
  where exists (
    select 1 from public.process_template_phases ph
    where ph.id = o.id and ph.template_version_id = p_template_version_id
      and o.kind = 'phase'
  ) or exists (
    select 1 from public.process_template_narratives nr
    where nr.id = o.id and nr.template_version_id = p_template_version_id
      and o.kind = 'narrative'
  );

  if v_matched <> v_expected then
    raise exception 'a ordem informada referencia itens inválidos' using errcode = 'HC054';
  end if;
end;
$$;

-- ===========================================================================
-- 4. Child-keyed doors — signatures UNCHANGED, so CREATE OR REPLACE. Only the
--    draft-gate join and the sibling lookups move to the version grain.
-- ===========================================================================

create or replace function public.remove_template_phase(p_phase_id uuid)
returns void
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_position integer;
  v_status text;
  r record;
begin
  perform app.assert_cases_enabled();

  select ph.template_version_id, ph.position, v.status
    into v_version_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_template_versions v on v.id = ph.template_version_id
  where ph.id = p_phase_id;

  if v_version_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.process_template_phases
    where template_version_id = v_version_id
      and recommend_when is not null
      and (recommend_when ->> 'from_phase')::integer = v_position
  ) then
    raise exception
      'não é possível remover a fase %: outra fase a usa como condição de recomendação',
      v_position
      using errcode = 'HC016';
  end if;

  if exists (
    select 1 from public.process_template_phases
    where template_version_id = v_version_id
      and blocks @> array[v_position]
  ) then
    raise exception
      'não é possível remover a fase %: outra fase a tem como bloqueio',
      v_position
      using errcode = 'HC016';
  end if;

  delete from public.process_template_phases where id = p_phase_id;

  -- Renumber the tail AND shift the blocks references in a SINGLE UPDATE per row
  -- so the BEFORE-UPDATE shape trigger always sees a CONSISTENT row.
  update public.process_template_phases
  set position = position - 1,
      blocks = (
        select coalesce(array_agg(
                 (case when b > v_position then b - 1 else b end)
                 order by (case when b > v_position then b - 1 else b end)), '{}')
        from unnest(blocks) as b
      )
  where template_version_id = v_version_id and position > v_position;

  for r in
    select position, recommend_when, blocks
    from public.process_template_phases
    where template_version_id = v_version_id
  loop
    if r.recommend_when is not null then
      perform app.validate_template_recommend_when(v_version_id, r.position, r.recommend_when);
    end if;
    perform app.validate_template_phase_blocks(v_version_id, r.position, r.blocks);
  end loop;
end;
$$;

create or replace function public.reorder_template_phase(p_phase_id uuid, p_direction text)
returns void
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
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

  select ph.template_version_id, ph.position, v.status
    into v_version_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_template_versions v on v.id = ph.template_version_id
  where ph.id = p_phase_id;

  if v_version_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_version_id = v_version_id and position < v_position
    order by position desc limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_version_id = v_version_id and position > v_position
    order by position asc limit 1;
  end if;

  if v_neighbor_id is null then
    return;  -- boundary
  end if;

  -- Swap positions AND value-swap blocks in a SINGLE UPDATE over every row of
  -- the version, so the BEFORE-UPDATE shape trigger always sees a consistent row.
  update public.process_template_phases
  set position = case id
                   when p_phase_id then v_neighbor_position
                   when v_neighbor_id then v_position
                   else position
                 end,
      blocks = (
        select coalesce(array_agg(
                 case b
                   when v_position then v_neighbor_position
                   when v_neighbor_position then v_position
                   else b
                 end
                 order by case b
                   when v_position then v_neighbor_position
                   when v_neighbor_position then v_position
                   else b
                 end), '{}')
        from unnest(blocks) as b
      )
  where template_version_id = v_version_id;

  for r in
    select position, recommend_when, blocks
    from public.process_template_phases
    where template_version_id = v_version_id
  loop
    if r.recommend_when is not null then
      perform app.validate_template_recommend_when(v_version_id, r.position, r.recommend_when);
    end if;
    perform app.validate_template_phase_blocks(v_version_id, r.position, r.blocks);
  end loop;
end;
$$;

create or replace function public.set_template_phase_blocks(
  p_phase_id uuid, p_blocks integer[]
)
returns public.process_template_phases
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_position integer;
  v_status text;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_version_id, ph.position, v.status
    into v_version_id, v_position, v_status
  from public.process_template_phases ph
  join public.process_template_versions v on v.id = ph.template_version_id
  where ph.id = p_phase_id;

  if v_version_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  perform app.validate_template_phase_blocks(v_version_id, v_position, v_blocks);

  update public.process_template_phases
  set blocks = v_blocks
  where id = p_phase_id
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.update_template_phase(
  p_phase_id uuid,
  p_form_id uuid default null,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_clear_recommend_when boolean default false,
  p_default_due_days integer default null,
  p_clear_default_due_days boolean default false,
  p_blocks integer[] default null,
  p_clear_blocks boolean default false,
  p_result_ruleset jsonb default null,
  p_clear_result_ruleset boolean default false,
  p_emits_result boolean default null,
  p_allowed_result_ids jsonb default null,
  p_clear_allowed_result_ids boolean default false
)
returns public.process_template_phases
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_position integer;
  v_status text;
  v_commission_id uuid;
  v_new_recommend jsonb;
  v_new_due_days integer;
  v_new_blocks integer[];
  v_new_ruleset jsonb;
  v_new_emits boolean;
  v_new_allowed jsonb;
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_version_id, ph.position, v.status, t.commission_id
    into v_version_id, v_position, v_status, v_commission_id
  from public.process_template_phases ph
  join public.process_template_versions v on v.id = ph.template_version_id
  join public.process_templates t on t.id = v.template_id
  where ph.id = p_phase_id;

  if v_version_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  if p_form_id is not null and not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  if p_clear_recommend_when then
    v_new_recommend := null;
  elsif p_recommend_when is not null then
    v_new_recommend := p_recommend_when;
  else
    select recommend_when into v_new_recommend
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_default_due_days then
    v_new_due_days := null;
  elsif p_default_due_days is not null then
    v_new_due_days := p_default_due_days;
  else
    select default_due_days into v_new_due_days
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_blocks then
    v_new_blocks := '{}';
  elsif p_blocks is not null then
    v_new_blocks := coalesce(
      (select array_agg(distinct b order by b)
       from unnest(p_blocks) as b
       where b is not null),
      '{}');
  else
    select blocks into v_new_blocks
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_result_ruleset then
    v_new_ruleset := null;
  elsif p_result_ruleset is not null then
    v_new_ruleset := p_result_ruleset;
  else
    select result_ruleset into v_new_ruleset
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_allowed_result_ids then
    v_new_allowed := null;
  elsif p_allowed_result_ids is not null then
    v_new_allowed := p_allowed_result_ids;
  else
    select case when count(*) = 0 then null
                else jsonb_agg((result_id)::text order by position) end
      into v_new_allowed
    from public.process_template_phase_allowed_results
    where template_phase_id = p_phase_id;
  end if;

  if p_emits_result is not null then
    v_new_emits := p_emits_result;
  else
    select emits_result into v_new_emits
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- D3 (F-cleanup Minor): re-enforce the dropped *_result_emits CHECK on the
  -- RESULTING state, so it covers both replace-with-allowed and the
  -- emits->false flip that would otherwise retain the keep-path rows.
  if not coalesce(v_new_emits, false)
     and v_new_allowed is not null
     and jsonb_typeof(v_new_allowed) = 'array'
     and jsonb_array_length(v_new_allowed) >= 1 then
    raise exception
      'a fase % não emite um resultado e não pode ter resultados permitidos', v_position
      using errcode = 'HC067';
  end if;

  update public.process_template_phases
  set form_id = coalesce(p_form_id, form_id),
      title = case when p_title is null then title else nullif(btrim(p_title), '') end,
      recommend_when = v_new_recommend,
      default_due_days = v_new_due_days,
      blocks = v_new_blocks,
      result_ruleset = v_new_ruleset,
      emits_result = v_new_emits
  where id = p_phase_id
  returning * into v_result;

  delete from public.process_template_phase_allowed_results where template_phase_id = p_phase_id;
  if v_new_allowed is not null then
    insert into public.process_template_phase_allowed_results (template_phase_id, result_id, position)
    select p_phase_id, (m #>> '{}')::uuid, ord::int
    from jsonb_array_elements(v_new_allowed) with ordinality as t(m, ord)
    where (m #>> '{}') is not null
    on conflict do nothing;
  end if;

  perform app.recompute_template_phase_offered_results(p_phase_id);

  perform app.validate_template_recommend_when(v_version_id, v_position, v_new_recommend);
  perform app.validate_template_phase_blocks(v_version_id, v_position, v_new_blocks);
  perform app.validate_template_result_ruleset(v_version_id, v_position, v_new_ruleset);
  perform app.validate_template_allowed_results(v_version_id, v_position, v_new_allowed);

  return v_result;
end;
$$;

create or replace function public.update_template_narrative(
  p_narrative_id uuid,
  p_title text default null,
  p_instructions text default null,
  p_is_expected boolean default null,
  p_clear_title boolean default false,
  p_clear_instructions boolean default false
)
returns public.process_template_narratives
language plpgsql
set search_path = app, public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_status text;
  v_result public.process_template_narratives;
begin
  perform app.assert_narratives_enabled();

  select n.template_version_id, v.status
    into v_version_id, v_status
  from public.process_template_narratives n
  join public.process_template_versions v on v.id = n.template_version_id
  where n.id = p_narrative_id;

  if v_version_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
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

create or replace function public.remove_template_narrative(p_narrative_id uuid)
returns void
language plpgsql
set search_path = app, public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_display_position integer;
  v_status text;
begin
  perform app.assert_narratives_enabled();

  select n.template_version_id, n.display_position, v.status
    into v_version_id, v_display_position, v_status
  from public.process_template_narratives n
  join public.process_template_versions v on v.id = n.template_version_id
  where n.id = p_narrative_id;

  if v_version_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser editadas'
      using errcode = 'check_violation';
  end if;

  delete from public.process_template_narratives where id = p_narrative_id;

  -- Shift the tail of BOTH tables down by one.
  update public.process_template_narratives
  set display_position = display_position - 1
  where template_version_id = v_version_id and display_position > v_display_position;

  update public.process_template_phases
  set display_position = display_position - 1
  where template_version_id = v_version_id and display_position > v_display_position;
end;
$$;
