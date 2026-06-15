-- Case data-model adjustments (4 of 4): case OUTCOMES (decisions D8-D11, D15) +
-- the D3 conclude gate + the consolidated final create_case_from_template + the
-- board/detail RPC envelope additions (outcome metadata + blocks).
--
-- A per-commission OUTCOME vocabulary (mirror case_tags). Each PROCESS selects
-- which outcomes it OFFERS (process_template_outcomes, frozen per-case into
-- case_offered_outcomes at creation). Each CASE is assigned at most one
-- (cases.outcome_id, D9). Each outcome carries two SIGNAL flags (D10, non-gating):
-- requires_action_plan (advisory) + is_adverse (tracking). Vocabulary edits
-- propagate everywhere (D11 — shared row, no per-case outcome snapshot; only the
-- OFFERED-set membership is frozen). Outcomes are OPTIONAL per process (D15).
--
-- FUNCTIONS finalized here (single definition):
--   * close_case(uuid) — the D3 conclude gate (HC031 unsettled phases / HC028
--     outcome required) + terminal-FIRST + fixed enum.
--   * create_case_from_template(uuid,text) — the CONSOLIDATED final body: the
--     093001 initial-key drop (default 'nao_iniciado' applies), the 093002 blocks
--     snapshot, AND the offered-outcomes copy. Its single definition lives here.
--   * list_cases_board / get_case_detail — extended with outcome metadata + the
--     per-phase blocks positions. STILL staff_admin-gated + ANSWER-FREE (the
--     Phase-7 invariant): outcome label/flags + blocks integers only.
--
-- ADDITIVE / forward-only. RLS mirrors case_tags / process_template_phases. Every
-- public function created/replaced is re-revoked from anon/public.
--
-- SQLSTATEs (continue after HC030 reserved here):
--   HC028 a process that offers outcomes requires one before conclusion.
--   HC029 the chosen outcome is not in the case's offered set.
--   HC030 outcome / commission mismatch (the join guard).
--   HC031 cannot conclude — unsettled (pendente/ativa) phases remain.
-- (HC025 case terminal is reused.)

-- ===========================================================================
-- public.case_outcomes — per-commission vocabulary
-- ===========================================================================
-- color_token mirrors the shared 7-token palette. (commission_id, position) is
-- DEFERRABLE INITIALLY IMMEDIATE so the reorder swap tolerates a transient
-- duplicate (mirror reorder_section / case_status_defs). archive (not delete) is
-- the retire path; cases.outcome_id is NO ACTION so a referenced row can't be
-- deleted.
create table public.case_outcomes (
  id uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions (id) on delete cascade,
  label text not null,
  color_token text not null default 'muted'
    check (color_token in ('muted', 'slate', 'blue', 'amber', 'green', 'red', 'violet')),
  requires_action_plan boolean not null default false,
  is_adverse boolean not null default false,
  archived boolean not null default false,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_outcomes_commission_label_key unique (commission_id, label),
  constraint case_outcomes_commission_position_key
    unique (commission_id, position) deferrable initially immediate,
  constraint case_outcomes_label_not_blank check (btrim(label) <> '')
);

alter table public.case_outcomes enable row level security;
create index case_outcomes_commission_idx on public.case_outcomes (commission_id);

-- ===========================================================================
-- public.process_template_outcomes — (template, outcome) offered set
-- ===========================================================================
create table public.process_template_outcomes (
  template_id uuid not null references public.process_templates (id) on delete cascade,
  outcome_id uuid not null references public.case_outcomes (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (template_id, outcome_id)
);

alter table public.process_template_outcomes enable row level security;
create index process_template_outcomes_outcome_idx
  on public.process_template_outcomes (outcome_id);

-- ===========================================================================
-- public.case_offered_outcomes — the PER-CASE FROZEN offered set
-- ===========================================================================
-- Snapshotted at case creation from process_template_outcomes. The conclude gate
-- + the case selector read THIS, never the live template join (whose template
-- link is ON DELETE SET NULL on cases and whose membership could change after the
-- template is edited/republished — that must not leak into in-flight cases).
create table public.case_offered_outcomes (
  case_id uuid not null references public.cases (id) on delete cascade,
  outcome_id uuid not null references public.case_outcomes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, outcome_id)
);

alter table public.case_offered_outcomes enable row level security;
create index case_offered_outcomes_outcome_idx
  on public.case_offered_outcomes (outcome_id);

-- ===========================================================================
-- cases.outcome_id — single nullable FK (D9), NO ACTION (archive, don't delete)
-- ===========================================================================
alter table public.cases
  add column outcome_id uuid references public.case_outcomes (id);

create index cases_outcome_idx on public.cases (outcome_id);

-- ===========================================================================
-- app.guard_process_template_outcome — BEFORE INSERT: outcome & template share a
-- commission (HC030)
-- ===========================================================================
-- Cheaper than a composite FK; clean HC030. SECURITY DEFINER so it reads both
-- parents regardless of the caller's RLS (the set_process_outcomes RPC has already
-- confirmed staff_admin rights). Mirrors guard_case_tag_assignment.
create function app.guard_process_template_outcome()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_template_commission uuid;
  v_outcome_commission uuid;
begin
  select commission_id into v_template_commission
  from public.process_templates where id = new.template_id;
  select commission_id into v_outcome_commission
  from public.case_outcomes where id = new.outcome_id;

  if v_template_commission is null or v_outcome_commission is null
     or v_template_commission <> v_outcome_commission then
    raise exception 'este desfecho não pertence à comissão deste processo'
      using errcode = 'HC030';
  end if;

  return new;
end;
$$;

create trigger guard_process_template_outcome_trg
  before insert on public.process_template_outcomes
  for each row execute function app.guard_process_template_outcome();

-- ===========================================================================
-- RLS — members read, staff_admin write (mirror case_tags / cases family)
-- ===========================================================================
create policy case_outcomes_select on public.case_outcomes
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy case_outcomes_staff_admin_write on public.case_outcomes
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

create policy process_template_outcomes_select on public.process_template_outcomes
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_template(template_id)) or app.is_admin()
  );

create policy process_template_outcomes_staff_admin_write on public.process_template_outcomes
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_template(template_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template(template_id)) or app.is_admin()
  );

create policy case_offered_outcomes_select on public.case_offered_outcomes
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_case(case_id)) or app.is_admin()
  );

create policy case_offered_outcomes_staff_admin_write on public.case_offered_outcomes
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  );

-- ===========================================================================
-- Outcome vocabulary CRUD (SECURITY INVOKER; RLS + explicit gate; gate cases_extras)
-- ===========================================================================
-- create_case_outcome(commission, label, color_token, requires_action_plan, is_adverse)
create function public.create_case_outcome(
  p_commission_id uuid,
  p_label text,
  p_color_token text default 'muted',
  p_requires_action_plan boolean default false,
  p_is_adverse boolean default false
)
returns public.case_outcomes
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_position integer;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do desfecho' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_outcomes where commission_id = p_commission_id;

  insert into public.case_outcomes
    (commission_id, label, color_token, requires_action_plan, is_adverse, position)
  values
    (p_commission_id, btrim(p_label), p_color_token,
     coalesce(p_requires_action_plan, false), coalesce(p_is_adverse, false), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.create_case_outcome(uuid, text, text, boolean, boolean)
  to authenticated, service_role;

-- update_case_outcome(outcome_id, label, color_token, requires_action_plan, is_adverse)
-- Edits propagate everywhere (D11 — shared row).
create function public.update_case_outcome(
  p_outcome_id uuid,
  p_label text,
  p_color_token text,
  p_requires_action_plan boolean,
  p_is_adverse boolean
)
returns public.case_outcomes
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id
  from public.case_outcomes where id = p_outcome_id;
  if v_commission_id is null then
    raise exception 'desfecho não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do desfecho' using errcode = 'check_violation';
  end if;

  update public.case_outcomes
  set label = btrim(p_label),
      color_token = p_color_token,
      requires_action_plan = coalesce(p_requires_action_plan, false),
      is_adverse = coalesce(p_is_adverse, false),
      updated_at = now()
  where id = p_outcome_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.update_case_outcome(uuid, text, text, boolean, boolean)
  to authenticated, service_role;

-- reorder_case_outcomes(commission, ordered_ids[]) -> void  (deferrable swap)
create function public.reorder_case_outcomes(
  p_commission_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_outcomes d
  set position = o.ord, updated_at = now()
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

grant execute on function public.reorder_case_outcomes(uuid, uuid[]) to authenticated, service_role;

-- archive_case_outcome(outcome_id) -> outcome
create function public.archive_case_outcome(p_outcome_id uuid)
returns public.case_outcomes
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id
  from public.case_outcomes where id = p_outcome_id;
  if v_commission_id is null then
    raise exception 'desfecho não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_outcomes set archived = true, updated_at = now()
  where id = p_outcome_id returning * into v_result;
  return v_result;
end;
$$;

grant execute on function public.archive_case_outcome(uuid) to authenticated, service_role;

-- ===========================================================================
-- set_process_outcomes(template_id, outcome_ids[]) -> void   (draft-only)
-- ===========================================================================
-- The builder's outcome multiselect persistence. SECURITY INVOKER (RLS
-- process_template_outcomes staff_admin-write is the authority) + explicit gate.
-- Draft-only (a published template is frozen, like its phases). Delete-then-insert
-- the full set; the BEFORE INSERT guard enforces same-commission (HC030). Pass
-- '{}' to offer none (D15). Gates cases_extras.
create function public.set_process_outcomes(
  p_template_id uuid,
  p_outcome_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_extras_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;
  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  delete from public.process_template_outcomes where template_id = p_template_id;

  insert into public.process_template_outcomes (template_id, outcome_id, position)
  select p_template_id, oid, ord::integer
  from unnest(p_outcome_ids) with ordinality as t(oid, ord);
end;
$$;

grant execute on function public.set_process_outcomes(uuid, uuid[]) to authenticated, service_role;

-- ===========================================================================
-- set_case_outcome(case_id, outcome_id|null) -> cases
-- ===========================================================================
-- Assign or clear a case's single outcome (D9). SECURITY INVOKER (RLS
-- cases_staff_admin_write authorizes the outcome_id update) + explicit
-- staff_admin/admin gate. Rejects a terminal case (HC025) for a clean error; a
-- non-null outcome must be in the case's FROZEN case_offered_outcomes (HC029).
-- Writes ONLY cases.outcome_id (a non-status column), which the rewritten
-- guard_case_status permits on a non-terminal case without app.in_case_rpc (its
-- "non-status update" branch returns NEW while non-terminal). Gates cases_extras.
create function public.set_case_outcome(
  p_case_id uuid,
  p_outcome_id uuid default null
)
returns public.cases
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.cases;
begin
  perform app.assert_extras_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- A non-null outcome must be one this case's process OFFERED (frozen set).
  if p_outcome_id is not null and not exists (
    select 1 from public.case_offered_outcomes
    where case_id = p_case_id and outcome_id = p_outcome_id
  ) then
    raise exception 'este desfecho não está disponível para este caso'
      using errcode = 'HC029';
  end if;

  update public.cases
  set outcome_id = p_outcome_id
  where id = p_case_id
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.set_case_outcome(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- close_case(case_id) — the D3 CONCLUDE GATE (FINAL form)
-- ===========================================================================
-- Conclude is available ONLY when every phase is concluida/nao_necessaria AND (if
-- the process offered outcomes) the case outcome is selected. Hard preconditions
-- (server rejects), not auto-settle:
--   * any phase still pendente/ativa            -> HC031
--   * case_offered_outcomes non-empty AND outcome_id is null -> HC028
-- Then terminal-FIRST: set 'concluido' + closed_* first, THEN flip residual phases
-- (a no-op here since the gate already requires all settled — kept for symmetry/
-- defence). Keeps gating ONLY cases_multi_phase (NOT cases_extras) so the existing
-- "Concluir" button keeps working. RLS cases_staff_admin_write authorizes (SECURITY
-- INVOKER). Replaces the 092001 thin wrapper (dropped app.apply_case_status).
create or replace function public.close_case(p_case_id uuid)
returns public.cases
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
declare
  v_status text;
  v_outcome_id uuid;
  v_unsettled integer;
  v_offered integer;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  select status, outcome_id into v_status, v_outcome_id
  from public.cases where id = p_case_id;
  if v_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- D3 gate 1: every phase must be settled (concluida or nao_necessaria).
  select count(*) into v_unsettled
  from public.case_phases
  where case_id = p_case_id and status in ('pendente', 'ativa');
  if v_unsettled > 0 then
    raise exception 'conclua ou marque todas as fases antes de concluir o caso'
      using errcode = 'HC031';
  end if;

  -- D3 gate 2: a process that OFFERS outcomes requires one selected.
  select count(*) into v_offered
  from public.case_offered_outcomes where case_id = p_case_id;
  if v_offered > 0 and v_outcome_id is null then
    raise exception 'selecione um desfecho antes de concluir o caso'
      using errcode = 'HC028';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Terminal FIRST: freeze the case, then any residual phase flip no-ops.
  update public.cases
  set status = 'concluido', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.close_case(uuid) to authenticated, service_role;

-- ===========================================================================
-- create_case_from_template(template, label) -> cases   (CONSOLIDATED final body)
-- ===========================================================================
-- The single definition combining: the 093001 initial-key drop (the case lands on
-- the 'nao_iniciado' column default — the recompute trigger then advances it as
-- phases are materialized... but they all start 'pendente', so it stays
-- 'nao_iniciado', correct for a fresh case), the 093002 blocks snapshot, AND the
-- offered-outcomes copy. Otherwise identical to the 091000 body (snapshot
-- default_due_days, recommend_when re-validation against pinned versions).
create or replace function public.create_case_from_template(
  p_template_id uuid,
  p_label text default null
)
returns public.cases
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_qkey text;
  v_attempt integer := 0;
begin
  perform app.assert_cases_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  -- Internal gate (DEFINER): only a staff_admin of the template's commission may
  -- open a case. Mirrors the definer board self-gate.
  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Insert the case; the minting trigger sets case_number. status defaults to
  -- 'nao_iniciado' (no explicit status -> the column default applies). Bounded
  -- unique_violation retry for the per-commission number race.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, created_by)
      values (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid())
      returning * into v_case;
      exit;  -- success
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
        -- loop and let the minting trigger recompute on the next attempt
    end;
  end loop;

  -- Materialize the template slots into case_phases, pinning published versions
  -- and snapshotting recommend_when, default_due_days AND blocks verbatim.
  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks
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

    -- Re-validate recommend_when against the PINNED source version.
    if r_slot.recommend_when is not null then
      v_from_phase := (r_slot.recommend_when ->> 'from_phase')::integer;
      v_qkey := r_slot.recommend_when ->> 'question_key';

      v_source_version := app.published_version_of_form(
        (select form_id from public.process_template_phases
         where template_id = p_template_id and position = v_from_phase)
      );
      if v_source_version is null then
        raise exception
          'o formulário da fase % (origem da recomendação) não está publicado',
          v_from_phase using errcode = 'HC017';
      end if;
      if not app.version_has_input_key(v_source_version, v_qkey) then
        raise exception
          'a recomendação da fase % referencia a pergunta "%", ausente no formulário publicado',
          r_slot.position, v_qkey using errcode = 'HC016';
      end if;
    end if;

    -- Snapshot the slot (ADR 0017 + blocks). due_date null. The blocks shape
    -- trigger re-asserts earlier-only on this insert.
    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks);
  end loop;

  -- Freeze the OFFERED outcome set for this case (D15) from the template's live
  -- offering. The conclude gate + selector read THIS, not process_template_outcomes.
  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  perform set_config('app.in_case_rpc', 'off', true);

  -- Initial recommendation pass (no submitted phases yet; uniform path).
  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

grant execute on function public.create_case_from_template(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- list_cases_board(commission) — add outcome metadata (answer-free)
-- ===========================================================================
-- Return-table signature gains outcome_id + outcome (a resolved jsonb object or
-- null). STILL is_staff_admin_of-gated and ANSWER-FREE: outcome label/flags only.
-- The outcome is resolved LIVE from case_outcomes (D11 propagation).
--
-- A CHANGED RETURNS TABLE shape (added columns) cannot go through CREATE OR
-- REPLACE (Postgres 42P13 "cannot change return type"), so DROP the prior 7-column
-- signature first (the 091000 form). The argument list is unchanged, so this is
-- the only overload.
drop function if exists public.list_cases_board(uuid);

create function public.list_cases_board(p_commission_id uuid)
returns table (
  case_id uuid,
  case_number integer,
  label text,
  status text,
  outcome_id uuid,
  outcome jsonb,
  created_at timestamptz,
  closed_at timestamptz,
  phases jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if not app.is_staff_admin_of(p_commission_id) then
    return;
  end if;

  return query
  select c.id,
         c.case_number,
         c.label,
         c.status,
         c.outcome_id,
         case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end as outcome,
         c.created_at,
         c.closed_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
               'position', cp.position,
               'title', cp.title,
               'status', cp.status,
               'recommended', cp.recommended,
               'assigned_to', cp.assigned_to,
               'assignee_name', pr.full_name,
               'due_date', cp.due_date
             ) order by cp.position)
            from public.case_phases cp
            left join public.profiles pr on pr.id = cp.assigned_to
            where cp.case_id = c.id),
           '[]'::jsonb) as phases
  from public.cases c
  left join public.case_outcomes o on o.id = c.outcome_id
  where c.commission_id = p_commission_id
  order by c.case_number desc;
end;
$$;

grant execute on function public.list_cases_board(uuid) to authenticated, service_role;

-- ===========================================================================
-- get_case_detail(case) — add outcome metadata + offered set + per-phase blocks
-- ===========================================================================
-- Signature UNCHANGED (jsonb). Adds: outcome_id, outcome (resolved live),
-- offered_outcomes (the FROZEN set resolved to label/flags), and 'blocks' to each
-- phase. STILL is_staff_admin_of-gated + ANSWER-FREE (response_id/submitted_at
-- still only for a concluida phase — the Phase-7 invariant is untouched).
create or replace function public.get_case_detail(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not app.is_staff_admin_of(v_case.commission_id) then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  -- The assigned outcome, resolved LIVE (or null).
  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    -- The FROZEN offered set (case_offered_outcomes), resolved to label/flags.
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'concluida'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_case_detail(uuid) to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE on every public function created/replaced above
-- ===========================================================================
revoke execute on function public.create_case_outcome(uuid, text, text, boolean, boolean) from anon, public;
revoke execute on function public.update_case_outcome(uuid, text, text, boolean, boolean) from anon, public;
revoke execute on function public.reorder_case_outcomes(uuid, uuid[]) from anon, public;
revoke execute on function public.archive_case_outcome(uuid) from anon, public;
revoke execute on function public.set_process_outcomes(uuid, uuid[]) from anon, public;
revoke execute on function public.set_case_outcome(uuid, uuid) from anon, public;
revoke execute on function public.close_case(uuid) from anon, public;
revoke execute on function public.create_case_from_template(uuid, text) from anon, public;
revoke execute on function public.list_cases_board(uuid) from anon, public;
revoke execute on function public.get_case_detail(uuid) from anon, public;
