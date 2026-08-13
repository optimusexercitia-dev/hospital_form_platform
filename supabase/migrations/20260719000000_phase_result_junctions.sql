-- =============================================================================
-- F-cleanup · D3 — jsonb/array → FK-backed junctions for the case-phase result
-- engine (D3-mid). Preventive normalization: phase_results is soft-deleted
-- (archive_phase_result), the only hard-delete path is a commission CASCADE, so
-- there is no reachable defect — this closes the TEMPLATE-side dangling-UUID hole
-- and normalizes the allowed-result arrays into junctions, following the existing
-- case_phase_offered_results pattern.
--
-- LOCKED decisions (lead; docs/plans/f-cleanup.md):
--   * D3-mid: 3 new junctions. result_ruleset STAYS jsonb (the evaluator
--     compute_case_phase_result reads case_phases.result_ruleset verbatim — Rule 3).
--     blocks STAYS integer[] — reorder_template_phase is UNTOUCHED (D3-Q2).
--   * No `ruleset ⊆ allowed` invariant (D3-Q1 = no): keep today's
--     allowed ∪ ruleset ∪ default offered-set union semantics.
--   * RPC signatures UNCHANGED (still accept p_allowed_result_ids / p_result_ruleset
--     jsonb; internally decompose into junction rows). compute_case_phase_result
--     UNCHANGED. set_case_phase_result_override reads the allowed subset from the
--     junction. RLS from creation via is_commission_admin_of() (NOT the
--     renamed-away is_org_admin_of_commission — ADR 0051).
--
-- ATOMIC: create resolver helpers + the 3 tables (RLS/FK/index/grants) + the
-- offered-shadow recompute helper, CREATE OR REPLACE the 5 consuming functions to
-- the junction-based bodies, THEN drop the two allowed_result_ids columns and
-- rewrite the *_result_emits CHECKs — all in ONE migration (a half-applied drop
-- breaks the RPCs). Reset-OK: no data backfill.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · Resolver helpers. SECURITY DEFINER so the junction RLS policies resolve the
--     parent's commission WITHOUT applying the parent table's own RLS (mirrors
--     app.commission_of_case / commission_of_template).
-- -----------------------------------------------------------------------------
create or replace function app.commission_of_template_phase(p_phase_id uuid)
  returns uuid language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select t.commission_id
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;
$$;
alter function app.commission_of_template_phase(uuid) owner to postgres;
revoke all on function app.commission_of_template_phase(uuid) from public;
grant execute on function app.commission_of_template_phase(uuid) to authenticated, service_role;

create or replace function app.case_of_case_phase(p_phase_id uuid)
  returns uuid language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select case_id from public.case_phases where id = p_phase_id;
$$;
alter function app.case_of_case_phase(uuid) owner to postgres;
revoke all on function app.case_of_case_phase(uuid) from public;
grant execute on function app.case_of_case_phase(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1 · Junction tables. RLS enabled from creation (Rule 1); scoping mirrors
--     process_template_phases / case_phase_offered_results with is_commission_admin_of().
-- -----------------------------------------------------------------------------

-- 1a · Authored allowed subset, TEMPLATE grain (replaces
--      process_template_phases.allowed_result_ids). `position` preserves author order.
create table if not exists public.process_template_phase_allowed_results (
  template_phase_id uuid not null
    references public.process_template_phases(id) on delete cascade,
  result_id uuid not null
    references public.phase_results(id) on delete cascade,
  position integer not null,
  primary key (template_phase_id, result_id)
);
alter table public.process_template_phase_allowed_results owner to postgres;
create index process_template_phase_allowed_results_result_idx
  on public.process_template_phase_allowed_results using btree (result_id);
alter table public.process_template_phase_allowed_results enable row level security;

create policy "process_template_phase_allowed_results_select"
  on public.process_template_phase_allowed_results for select to authenticated
  using (
    app.is_member_of(app.commission_of_template_phase(template_phase_id))
    or app.is_commission_admin_of(app.commission_of_template_phase(template_phase_id))
  );
create policy "process_template_phase_allowed_results_staff_admin_write"
  on public.process_template_phase_allowed_results to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_template_phase(template_phase_id))
    or app.is_commission_admin_of(app.commission_of_template_phase(template_phase_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template_phase(template_phase_id))
    or app.is_commission_admin_of(app.commission_of_template_phase(template_phase_id))
  );

grant all on table public.process_template_phase_allowed_results to authenticated;
grant all on table public.process_template_phase_allowed_results to service_role;

comment on table public.process_template_phase_allowed_results is
  'D3 (F-cleanup) — the author-selected allowed result subset of a template phase, '
  'normalized out of process_template_phases.allowed_result_ids jsonb into FK-backed '
  'rows (result_id → phase_results). Read back as allowedResultIds ordered by position.';

-- 1b · FK-integrity SHADOW = allowed ∪ ruleset rules ∪ default (template-grain twin
--      of case_phase_offered_results). Recomputed by add/update_template_phase; gives
--      the result_ruleset's result-ids FK visibility while the ruleset stays jsonb.
create table if not exists public.process_template_phase_offered_results (
  template_phase_id uuid not null
    references public.process_template_phases(id) on delete cascade,
  result_id uuid not null
    references public.phase_results(id) on delete cascade,
  primary key (template_phase_id, result_id)
);
alter table public.process_template_phase_offered_results owner to postgres;
create index process_template_phase_offered_results_result_idx
  on public.process_template_phase_offered_results using btree (result_id);
alter table public.process_template_phase_offered_results enable row level security;

create policy "process_template_phase_offered_results_select"
  on public.process_template_phase_offered_results for select to authenticated
  using (
    app.is_member_of(app.commission_of_template_phase(template_phase_id))
    or app.is_commission_admin_of(app.commission_of_template_phase(template_phase_id))
  );
create policy "process_template_phase_offered_results_staff_admin_write"
  on public.process_template_phase_offered_results to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_template_phase(template_phase_id))
    or app.is_commission_admin_of(app.commission_of_template_phase(template_phase_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template_phase(template_phase_id))
    or app.is_commission_admin_of(app.commission_of_template_phase(template_phase_id))
  );

grant all on table public.process_template_phase_offered_results to authenticated;
grant all on table public.process_template_phase_offered_results to service_role;

comment on table public.process_template_phase_offered_results is
  'D3 (F-cleanup) — FK-integrity shadow of a template phase''s reachable result set '
  '(allowed ∪ result_ruleset rules ∪ default_result_id). The template-grain twin of '
  'case_phase_offered_results: it gives the ruleset''s result-ids a real FK to '
  'phase_results while result_ruleset itself stays jsonb (Rule 3). '
  'Recomputed by add/update_template_phase via app.recompute_template_phase_offered_results.';

-- 1c · Authored allowed subset, CASE grain (replaces case_phases.allowed_result_ids).
--      Snapshotted from 1a at case creation.
create table if not exists public.case_phase_allowed_results (
  case_phase_id uuid not null
    references public.case_phases(id) on delete cascade,
  result_id uuid not null
    references public.phase_results(id) on delete cascade,
  position integer not null,
  primary key (case_phase_id, result_id)
);
alter table public.case_phase_allowed_results owner to postgres;
create index case_phase_allowed_results_result_idx
  on public.case_phase_allowed_results using btree (result_id);
alter table public.case_phase_allowed_results enable row level security;

create policy "case_phase_allowed_results_select"
  on public.case_phase_allowed_results for select to authenticated
  using (
    app.can_read_case(app.case_of_case_phase(case_phase_id), auth.uid())
    or app.is_commission_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id)))
  );
create policy "case_phase_allowed_results_staff_admin_write"
  on public.case_phase_allowed_results to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id)))
    or app.is_commission_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id)))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id)))
    or app.is_commission_admin_of(app.commission_of_case(app.case_of_case_phase(case_phase_id)))
  );

grant all on table public.case_phase_allowed_results to authenticated;
grant all on table public.case_phase_allowed_results to service_role;

comment on table public.case_phase_allowed_results is
  'D3 (F-cleanup) — the allowed result subset of a CASE phase, snapshotted from '
  'process_template_phase_allowed_results at case creation (replaces '
  'case_phases.allowed_result_ids jsonb). set_case_phase_result_override reads it to '
  'gate a MANUAL pick.';

-- -----------------------------------------------------------------------------
-- 2 · Offered-shadow recompute helper (single source of the union logic; used by
--     add/update_template_phase). SECURITY DEFINER — authorization is already
--     enforced by the calling RPC (draft-template staff_admin).
-- -----------------------------------------------------------------------------
create or replace function app.recompute_template_phase_offered_results(p_phase_id uuid)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  delete from public.process_template_phase_offered_results where template_phase_id = p_phase_id;

  insert into public.process_template_phase_offered_results (template_phase_id, result_id)
  select distinct p_phase_id, s.rid
  from (
    -- allowed subset
    select ar.result_id as rid
    from public.process_template_phase_allowed_results ar
    where ar.template_phase_id = p_phase_id
    union
    -- ruleset rule results
    select (r ->> 'result_id')::uuid
    from public.process_template_phases ph
    cross join lateral jsonb_array_elements(coalesce(ph.result_ruleset -> 'rules', '[]'::jsonb)) as r
    where ph.id = p_phase_id
    union
    -- ruleset default
    select (ph.result_ruleset ->> 'default_result_id')::uuid
    from public.process_template_phases ph
    where ph.id = p_phase_id
  ) s
  where s.rid is not null;
end;
$$;
alter function app.recompute_template_phase_offered_results(uuid) owner to postgres;
revoke all on function app.recompute_template_phase_offered_results(uuid) from public;
grant execute on function app.recompute_template_phase_offered_results(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3 · Re-create the 5 consuming functions (junction-aware). Signatures + return
--     types UNCHANGED; bodies from their LATEST live defs.
-- -----------------------------------------------------------------------------

-- 3a · add_template_phase (baseline latest). Writes the allowed junction from the
--      p_allowed_result_ids jsonb param, then recomputes the offered shadow.
create or replace function public.add_template_phase(
  p_template_id uuid, p_form_id uuid, p_title text default null,
  p_recommend_when jsonb default null, p_default_due_days integer default null,
  p_blocks integer[] default '{}'::integer[], p_result_ruleset jsonb default null,
  p_emits_result boolean default false, p_allowed_result_ids jsonb default null
) returns public.process_template_phases
  language plpgsql
  set search_path to 'public', 'pg_catalog'
as $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_status, v_commission_id
  from public.process_templates
  where id = p_template_id;

  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
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
  where template_id = p_template_id;

  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  -- D3 (F-cleanup Minor): re-enforce the dropped *_result_emits CHECK invariant
  -- BEFORE the phase insert (the old table CHECK rejected the row at insert time).
  -- The old constraint (emits_result OR allowed_result_ids IS NULL) rejected a
  -- NON-emitting phase carrying allowed results; under the junction model a table
  -- CHECK can no longer reference the allowed set, so the RPC re-imposes it. Reject
  -- (not silently drop) to match the old constraint's semantics.
  if not coalesce(p_emits_result, false)
     and p_allowed_result_ids is not null
     and jsonb_typeof(p_allowed_result_ids) = 'array'
     and jsonb_array_length(p_allowed_result_ids) >= 1 then
    raise exception
      'a fase % não emite um resultado e não pode ter resultados permitidos', v_position
      using errcode = 'HC067';
  end if;

  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days,
     blocks, result_ruleset, emits_result)
  values
    (p_template_id, v_position, p_form_id, nullif(btrim(p_title), ''),
     p_recommend_when, p_default_due_days, v_blocks,
     p_result_ruleset, p_emits_result)
  returning * into v_result;

  -- D3: allowed subset → junction (was allowed_result_ids jsonb). Order preserved.
  if p_allowed_result_ids is not null then
    insert into public.process_template_phase_allowed_results (template_phase_id, result_id, position)
    select v_result.id, (m #>> '{}')::uuid, ord::int
    from jsonb_array_elements(p_allowed_result_ids) with ordinality as t(m, ord)
    where (m #>> '{}') is not null
    on conflict do nothing;
  end if;

  -- D3: recompute the FK-integrity offered shadow = allowed ∪ ruleset ∪ default.
  perform app.recompute_template_phase_offered_results(v_result.id);

  perform app.validate_template_recommend_when(p_template_id, v_position, p_recommend_when);
  perform app.validate_template_phase_blocks(p_template_id, v_position, v_blocks);
  perform app.validate_template_result_ruleset(p_template_id, v_position, p_result_ruleset);
  perform app.validate_template_allowed_results(p_template_id, v_position, p_allowed_result_ids);

  return v_result;
end;
$$;
alter function public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[], jsonb, boolean, jsonb) owner to postgres;
revoke all on function public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[], jsonb, boolean, jsonb) from public;
grant execute on function public.add_template_phase(uuid, uuid, text, jsonb, integer, integer[], jsonb, boolean, jsonb) to authenticated, service_role;

-- 3b · update_template_phase (baseline latest). allowed clear/replace/keep now
--      targets the junction (keep reconstructs from the existing rows).
create or replace function public.update_template_phase(
  p_phase_id uuid, p_form_id uuid default null, p_title text default null,
  p_recommend_when jsonb default null, p_clear_recommend_when boolean default false,
  p_default_due_days integer default null, p_clear_default_due_days boolean default false,
  p_blocks integer[] default null, p_clear_blocks boolean default false,
  p_result_ruleset jsonb default null, p_clear_result_ruleset boolean default false,
  p_emits_result boolean default null, p_allowed_result_ids jsonb default null,
  p_clear_allowed_result_ids boolean default false
) returns public.process_template_phases
  language plpgsql
  set search_path to 'public', 'pg_catalog'
as $$
declare
  v_template_id uuid;
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

  -- result_ruleset (automatic): clear/replace/keep.
  if p_clear_result_ruleset then
    v_new_ruleset := null;
  elsif p_result_ruleset is not null then
    v_new_ruleset := p_result_ruleset;
  else
    select result_ruleset into v_new_ruleset
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- allowed_result_ids: clear/replace/keep → the junction (D3). `keep` reconstructs
  -- the current allowed set (ordered) from the existing junction rows.
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

  -- emits_result: explicit boolean when provided, else keep.
  if p_emits_result is not null then
    v_new_emits := p_emits_result;
  else
    select emits_result into v_new_emits
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- D3 (F-cleanup Minor): re-enforce the dropped *_result_emits CHECK invariant on
  -- the RESULTING state — a phase that is, or is TRANSITIONING to, non-emitting must
  -- carry NO allowed results. Evaluated on (v_new_emits, v_new_allowed) so it covers
  -- both replace-with-allowed and the emits→false flip that would otherwise retain
  -- the reconstructed (keep-path) rows. Reject, matching the old constraint.
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

  -- D3: re-materialize the allowed junction from v_new_allowed (clear → empty).
  delete from public.process_template_phase_allowed_results where template_phase_id = p_phase_id;
  if v_new_allowed is not null then
    insert into public.process_template_phase_allowed_results (template_phase_id, result_id, position)
    select p_phase_id, (m #>> '{}')::uuid, ord::int
    from jsonb_array_elements(v_new_allowed) with ordinality as t(m, ord)
    where (m #>> '{}') is not null
    on conflict do nothing;
  end if;

  perform app.recompute_template_phase_offered_results(p_phase_id);

  perform app.validate_template_recommend_when(v_template_id, v_position, v_new_recommend);
  perform app.validate_template_phase_blocks(v_template_id, v_position, v_new_blocks);
  perform app.validate_template_result_ruleset(v_template_id, v_position, v_new_ruleset);
  perform app.validate_template_allowed_results(v_template_id, v_position, v_new_allowed);

  return v_result;
end;
$$;
alter function public.update_template_phase(uuid, uuid, text, jsonb, boolean, integer, boolean, integer[], boolean, jsonb, boolean, boolean, jsonb, boolean) owner to postgres;
revoke all on function public.update_template_phase(uuid, uuid, text, jsonb, boolean, integer, boolean, integer[], boolean, jsonb, boolean, boolean, jsonb, boolean) from public;
grant execute on function public.update_template_phase(uuid, uuid, text, jsonb, boolean, integer, boolean, integer[], boolean, jsonb, boolean, boolean, jsonb, boolean) to authenticated, service_role;

-- 3c · create_case_from_template (latest 20260714000200). Snapshots the allowed
--      junction template → case; the offered set is now sourced from the case
--      allowed junction + case_phases.result_ruleset (same union semantics).
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
  v_case_phase_id uuid;
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

    -- D3: snapshot the allowed subset (template junction → case junction). Gate on
    -- emits_result to mirror the old case_phases *_result_emits CHECK (a non-emitting
    -- case phase carries no allowed rows). The template-side HC067 guard already
    -- blocks the source data; this is defense-in-depth so a case can never inherit an
    -- invariant-violating allowed set even from legacy/edge template rows.
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

  -- D3: freeze the OFFERED RESULT set = allowed ∪ ruleset rules ∪ default, now
  -- sourced from the case allowed junction + case_phases.result_ruleset (was the
  -- template jsonb). Union semantics unchanged. The computed-path guard reads THIS.
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

-- 3d · set_case_phase_result_override (baseline latest, is_org_admin_of_commission
--      already swapped → is_commission_admin_of by ADR 0051). MANUAL-pick allowed
--      gate now reads the case allowed junction.
create or replace function public.set_case_phase_result_override(
  p_case_phase_id uuid, p_result_id uuid, p_reason text default null
) returns void
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_phase_status text;
  v_case_status text;
  v_assigned_to uuid;
  v_position integer;
  v_is_staff_admin boolean;
  v_ruleset jsonb;
  v_emits boolean;
  v_is_manual boolean;
begin
  perform app.assert_phase_results_enabled();

  select cp.case_id, cp.status, cp.assigned_to, cp.position, c.commission_id, c.status,
         cp.result_ruleset, cp.emits_result
    into v_case_id, v_phase_status, v_assigned_to, v_position, v_commission_id, v_case_status,
         v_ruleset, v_emits
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;

  v_is_staff_admin := app.is_staff_admin_of(v_commission_id) or app.is_commission_admin_of(v_commission_id);
  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;

  if v_phase_status not in ('ativa', 'concluida') then
    raise exception 'o resultado só pode ser ajustado em uma fase ativa ou concluída'
      using errcode = 'HC057';
  end if;

  if v_phase_status = 'ativa' then
    if not (v_assigned_to = auth.uid() or v_is_staff_admin) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  else
    if not v_is_staff_admin then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    if v_case_status in ('concluido', 'cancelado') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC060';
    end if;
  end if;

  -- MANUAL phase: the result is the filler's pick over the ALLOWED subset, so it
  -- is MANDATORY (cannot be cleared) and must be one of the allowed options. An
  -- AUTOMATIC phase's override is a staff adjustment with full flexibility (any
  -- active result, clearable → revert to the computed result).
  if v_is_manual then
    if p_result_id is null then
      raise exception 'o resultado desta fase é obrigatório e não pode ser removido'
        using errcode = 'HC062';
    end if;
    -- D3: the allowed subset now lives in case_phase_allowed_results (was
    -- case_phases.allowed_result_ids jsonb). Empty set ⇒ no allowed restriction.
    if exists (
         select 1 from public.case_phase_allowed_results
         where case_phase_id = p_case_phase_id
       )
       and not exists (
         select 1 from public.case_phase_allowed_results
         where case_phase_id = p_case_phase_id and result_id = p_result_id
       ) then
      raise exception 'o resultado escolhido não está entre as opções permitidas para esta fase'
        using errcode = 'HC058';
    end if;
  end if;

  -- A non-null result must resolve to a NON-ARCHIVED option in the commission.
  if p_result_id is not null and not exists (
    select 1 from public.phase_results
    where id = p_result_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception 'opção de resultado inválida para esta comissão'
      using errcode = 'HC058';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set result_override_id = p_result_id,
      result_override_by = case when p_result_id is null then null else auth.uid() end,
      result_override_at = case when p_result_id is null then null else now() end,
      result_override_reason = case when p_result_id is null then null else nullif(btrim(p_reason), '') end,
      updated_at = now()
  where id = p_case_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.audit_write(
    'case_phase.result_override_set', 'case_phase', p_case_phase_id, v_commission_id,
    'Resultado da fase ' || v_position || ' ajustado manualmente',
    jsonb_build_object('result_override_id', p_result_id));

  if v_phase_status = 'concluida' then
    perform app.compute_case_phase_result(p_case_phase_id);
    -- ADR 0043: the concluded phase's EFFECTIVE result just changed/cleared —
    -- re-flip downstream result-based recommendations against it.
    perform public.recompute_recommendations(v_case_id);
  end if;
end;
$$;
alter function public.set_case_phase_result_override(uuid, uuid, text) owner to postgres;
revoke all on function public.set_case_phase_result_override(uuid, uuid, text) from public;
grant execute on function public.set_case_phase_result_override(uuid, uuid, text) to authenticated, service_role;

-- 3e · validate_template_phase_result (baseline). Publish-time re-validation: the
--      "emitting ⇒ has an allowed subset" check + archived/commission re-check now
--      read the allowed subset from the junction (reconstructed to jsonb for the
--      existing validator).
create or replace function app.validate_template_phase_result(p_template_id uuid, p_position integer)
  returns boolean language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_phase_id uuid;
  v_emits boolean;
  v_ruleset jsonb;
  v_allowed jsonb;
begin
  select id, emits_result, result_ruleset
    into v_phase_id, v_emits, v_ruleset
  from public.process_template_phases
  where template_id = p_template_id and position = p_position;

  -- D3: reconstruct the allowed subset (ordered) from the junction for re-validation.
  select case when count(*) = 0 then null
              else jsonb_agg((result_id)::text order by position) end
    into v_allowed
  from public.process_template_phase_allowed_results
  where template_phase_id = v_phase_id;

  if v_emits and v_allowed is null then
    raise exception
      'a fase % emite um resultado, mas nenhum resultado permitido foi selecionado', p_position
      using errcode = 'HC059';
  end if;

  perform app.validate_template_result_ruleset(p_template_id, p_position, v_ruleset);
  perform app.validate_template_allowed_results(p_template_id, p_position, v_allowed);
  return true;
end;
$$;
alter function app.validate_template_phase_result(uuid, integer) owner to postgres;
revoke all on function app.validate_template_phase_result(uuid, integer) from public;
grant execute on function app.validate_template_phase_result(uuid, integer) to authenticated, service_role;

-- 3f · validate_template_recommend_when (baseline, group-aware ADR 0043). The
--      result-condition's "referenced result ∈ the SOURCE phase's allowed subset"
--      check now reads the source phase's allowed subset from the junction.
create or replace function app.validate_template_recommend_when(p_template_id uuid, p_position integer, p_recommend_when jsonb)
  returns boolean language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  rc jsonb;                -- one sub-condition
  v_commission_id uuid;
  v_from_phase integer;
  v_question_key text;
  v_source_phase_id uuid;
  v_source_form_id uuid;
  v_source_version uuid;
  v_source_emits boolean;
  v_is_result boolean;
  v_id uuid;
  v_target_type text;
begin
  if p_recommend_when is null then
    return true;
  end if;

  select commission_id into v_commission_id
  from public.process_templates
  where id = p_template_id;

  for rc in select cond from app.recommend_when_conditions(p_recommend_when) cond loop
    v_from_phase := (rc ->> 'from_phase')::integer;
    v_is_result := (rc ->> 'source') = 'result';

    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= p_position then
      raise exception
        'a recomendação da fase % deve referenciar uma fase anterior (fase informada: %)',
        p_position, coalesce(v_from_phase::text, 'nula')
        using errcode = 'HC016';
    end if;

    select id, form_id, emits_result
      into v_source_phase_id, v_source_form_id, v_source_emits
    from public.process_template_phases
    where template_id = p_template_id and position = v_from_phase;

    if v_source_form_id is null then
      raise exception
        'a recomendação da fase % referencia a fase %, que não existe no processo',
        p_position, v_from_phase
        using errcode = 'HC016';
    end if;

    if v_is_result then
      if not coalesce(v_source_emits, false) then
        raise exception
          'a recomendação da fase % usa o resultado da fase %, que não emite resultado',
          p_position, v_from_phase
          using errcode = 'HC063';
      end if;

      if not (rc ? 'adverse') then
        for v_id in
          select (e #>> '{}')::uuid
          from jsonb_array_elements(
                 case when jsonb_typeof(rc -> 'value') = 'array'
                      then rc -> 'value'
                      else jsonb_build_array(rc -> 'value') end
               ) e
        loop
          if v_id is null then
            raise exception
              'a recomendação da fase % referencia um resultado inválido', p_position
              using errcode = 'HC064';
          end if;
          -- D3: the source phase's allowed subset is now in the junction.
          if not exists (
            select 1 from public.process_template_phase_allowed_results
            where template_phase_id = v_source_phase_id and result_id = v_id
          ) then
            raise exception
              'a recomendação da fase % referencia um resultado que não está entre as opções permitidas da fase %',
              p_position, v_from_phase
              using errcode = 'HC064';
          end if;
          if not exists (
            select 1 from public.phase_results
            where id = v_id and commission_id = v_commission_id and archived = false
          ) then
            raise exception
              'a recomendação da fase % referencia uma opção de resultado inválida ou arquivada',
              p_position
              using errcode = 'HC064';
          end if;
        end loop;
      end if;
    else
      -- Answer condition: question_key must exist as an input item; and the value
      -- codes must exist on it when it is a choice question.
      v_question_key := rc ->> 'question_key';

      v_source_version := app.published_version_of_form(v_source_form_id);
      if v_source_version is null then
        raise exception
          'o formulário da fase % (origem da recomendação) ainda não foi publicado',
          v_from_phase
          using errcode = 'HC017';
      end if;

      if not app.version_has_input_key(v_source_version, v_question_key) then
        raise exception
          'a recomendação da fase % referencia a pergunta "%", que não existe no formulário da fase %',
          p_position, v_question_key, v_from_phase
          using errcode = 'HC016';
      end if;

      v_target_type := app.item_question_type(v_source_version, v_question_key);
      perform app.assert_condition_value_codes(
        v_source_version, v_question_key, v_target_type, rc -> 'value',
        format('a recomendação da fase %s', p_position)
      );
    end if;
  end loop;

  return true;
end;
$$;
alter function app.validate_template_recommend_when(uuid, integer, jsonb) owner to postgres;
revoke all on function app.validate_template_recommend_when(uuid, integer, jsonb) from public;
grant execute on function app.validate_template_recommend_when(uuid, integer, jsonb) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4 · Drop the normalized-away columns + rewrite the *_result_emits CHECKs (which
--     referenced allowed_result_ids). Done LAST, after every consumer is
--     junction-based. The "non-emitting ⇒ no allowed" arm now lives in the RPCs
--     (a table CHECK cannot reference the junction): HC067 in add_/update_template_phase
--     rejects it at the source, and create_case_from_template gates its snapshot on
--     emits_result — together mirroring the dropped *_result_emits allowed arm.
-- -----------------------------------------------------------------------------
alter table public.process_template_phases drop constraint if exists process_template_phases_allowed_shape;
alter table public.process_template_phases drop constraint if exists process_template_phases_result_emits;
alter table public.process_template_phases
  add constraint process_template_phases_result_emits
  check (emits_result or (result_ruleset is null));
alter table public.process_template_phases drop column allowed_result_ids;

alter table public.case_phases drop constraint if exists case_phases_allowed_shape;
alter table public.case_phases drop constraint if exists case_phases_result_emits;
alter table public.case_phases
  add constraint case_phases_result_emits
  check (emits_result or (result_ruleset is null));
alter table public.case_phases drop column allowed_result_ids;
