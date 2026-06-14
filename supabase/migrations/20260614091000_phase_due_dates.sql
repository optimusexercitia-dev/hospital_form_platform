-- Feature: due dates for case phases (post-Phase-8 addition).
--
-- Two coordinator inputs are added on top of the multi-phase cases feature:
--   1. An OPTIONAL DEFAULT number of days per TEMPLATE phase-slot
--      (process_template_phases.default_due_days) — a planning hint authored when
--      a slot is defined ("Nova fase").
--   2. An OPTIONAL DUE DATE per CASE phase (case_phases.due_date), set/edited/
--      removed when the coordinator activates a phase ("Ativar e atribuir fase"),
--      pre-filled in the UI from the snapshot of the slot's default.
--
-- SNAPSHOT ISOLATION (ADR 0017) is mandatory: the slot's default_due_days is
-- COPIED into case_phases.default_due_days at case creation, so a later template
-- edit never reaches a live case. due_date itself is a per-case datum, null at
-- creation and only set on activation.
--
-- This migration is ADDITIVE and forward-only (CLAUDE.md): two new nullable
-- columns + one on process_template_phases, and CREATE OR REPLACE of the existing
-- cases RPCs to thread the new field/param through. ALL prior RPC logic is
-- preserved verbatim; only the new column/parameter handling is added. New params
-- are APPENDED at the END of each signature so existing callers keep working.
--
-- NOTE on overloads: CREATE OR REPLACE with a CHANGED argument list creates a NEW
-- overload rather than replacing the old one, so we DROP the prior signatures of
-- add_template_phase / update_template_phase / activate_phase first (exact old arg
-- types from 20260613090005 / 20260613090006) to avoid leaving stale overloads.
-- create_case_from_template / list_cases_board / get_case_detail keep their
-- argument lists unchanged, so a plain CREATE OR REPLACE is sufficient there.
--
-- No new RLS, no new SQLSTATE, the condition evaluator is untouched. The
-- activate_phase due_date UPDATE rides the EXISTING app.in_case_rpc flag (set in
-- the same statement block), so guard_case_phase_status permits it unchanged.

-- ===========================================================================
-- Columns
-- ===========================================================================

-- Template slot default (planning hint). Non-negative when present.
alter table public.process_template_phases
  add column default_due_days integer;

alter table public.process_template_phases
  add constraint process_template_phases_default_due_days_nonneg
  check (default_due_days is null or default_due_days >= 0);

-- Case phase: the SNAPSHOT copy of the slot default (ADR 0017) + the actual due
-- date set on activation. Mirror the non-negative check on the copy for parity.
alter table public.case_phases
  add column default_due_days integer;

alter table public.case_phases
  add constraint case_phases_default_due_days_nonneg
  check (default_due_days is null or default_due_days >= 0);

alter table public.case_phases
  add column due_date date;

-- ===========================================================================
-- Drop the prior overloads (exact old arg types) before recreating with the
-- appended parameter(s).
-- ===========================================================================
drop function if exists public.add_template_phase(uuid, uuid, text, jsonb);
drop function if exists public.update_template_phase(uuid, uuid, text, jsonb, boolean);
drop function if exists public.activate_phase(uuid, uuid);

-- ===========================================================================
-- add_template_phase(template, form, title, recommend_when, default_due_days)
-- ===========================================================================
-- Unchanged from 20260613090005 except: p_default_due_days appended; stored in
-- the insert.
create function public.add_template_phase(
  p_template_id uuid,
  p_form_id uuid,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_default_due_days integer default null
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
  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days)
  values
    (p_template_id, v_position, p_form_id, nullif(btrim(p_title), ''),
     p_recommend_when, p_default_due_days)
  returning * into v_result;

  perform app.validate_template_recommend_when(p_template_id, v_position, p_recommend_when);

  return v_result;
end;
$$;

grant execute on function public.add_template_phase(uuid, uuid, text, jsonb, integer)
  to authenticated, service_role;

-- ===========================================================================
-- update_template_phase(phase, form, title, recommend_when, clear_recommend_when,
--                       default_due_days, clear_default_due_days)
-- ===========================================================================
-- Unchanged from 20260613090005 except: p_default_due_days + the explicit
-- p_clear_default_due_days flag appended; the final default_due_days is computed
-- exactly like recommend_when (clear / replace / keep) and set in the UPDATE.
create function public.update_template_phase(
  p_phase_id uuid,
  p_form_id uuid default null,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_clear_recommend_when boolean default false,
  p_default_due_days integer default null,
  p_clear_default_due_days boolean default false
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
  v_new_due_days integer;
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

  -- Determine the final default_due_days with the SAME clear/replace/keep logic.
  if p_clear_default_due_days then
    v_new_due_days := null;
  elsif p_default_due_days is not null then
    v_new_due_days := p_default_due_days;
  else
    select default_due_days into v_new_due_days
    from public.process_template_phases where id = p_phase_id;
  end if;

  update public.process_template_phases
  set form_id = coalesce(p_form_id, form_id),
      title = case when p_title is null then title else nullif(btrim(p_title), '') end,
      recommend_when = v_new_recommend,
      default_due_days = v_new_due_days
  where id = p_phase_id
  returning * into v_result;

  perform app.validate_template_recommend_when(v_template_id, v_position, v_new_recommend);

  return v_result;
end;
$$;

grant execute on function public.update_template_phase(uuid, uuid, text, jsonb, boolean, integer, boolean)
  to authenticated, service_role;

-- ===========================================================================
-- create_case_from_template(template, label) — snapshot default_due_days
-- ===========================================================================
-- Argument list UNCHANGED (plain CREATE OR REPLACE). Identical to 20260613090006
-- except: the slot's default_due_days is SELECTed and copied into the materialized
-- case_phases row (ADR 0017 snapshot — a later template edit never reaches this
-- case). due_date stays null at creation.
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

  -- Insert the case; the minting trigger sets case_number. The unique backstop
  -- can collide under a concurrent open for the same commission; the trigger
  -- re-acquires the advisory lock + recomputes max() each attempt, so a bounded
  -- retry loop converges.
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

  -- Materialize the template slots into case_phases, pinning published versions.
  for r_slot in
    select position, form_id, title, recommend_when, default_due_days
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

    -- Re-validate recommend_when against the PINNED source version: a template
    -- edit between publish and now could have removed the referenced key.
    if r_slot.recommend_when is not null then
      v_from_phase := (r_slot.recommend_when ->> 'from_phase')::integer;
      v_qkey := r_slot.recommend_when ->> 'question_key';

      -- Resolve the source slot's currently-published version (the one this
      -- case pins for that earlier phase).
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

    -- Snapshot the slot default into the case phase (ADR 0017). due_date null.
    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days);
  end loop;

  perform set_config('app.in_case_rpc', 'off', true);

  -- Initial recommendation pass (no submitted phases yet, so this is a no-op in
  -- practice, but keeps the path uniform).
  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

grant execute on function public.create_case_from_template(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- activate_phase(case_phase, assigned_to, due_date) — set the due date
-- ===========================================================================
-- Unchanged from 20260613090006 except: p_due_date appended; set in the same
-- UPDATE that flips the phase to ativa. The UPDATE runs under app.in_case_rpc, so
-- guard_case_phase_status permits the due_date column change alongside the status
-- transition (it permits any non-status field change while the flag is on).
create function public.activate_phase(
  p_case_phase_id uuid,
  p_assigned_to uuid,
  p_due_date date default null
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_position integer;
  v_status text;
  v_case_status text;
  v_commission_id uuid;
  v_blocking integer;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.position, cp.status, c.status, c.commission_id
    into v_case_id, v_position, v_status, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status <> 'aberto' then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pendente' then
    raise exception 'esta fase não está pendente' using errcode = 'HC019';
  end if;

  -- Strict sequential: any earlier phase not yet concluida/nao_necessaria blocks.
  select count(*) into v_blocking
  from public.case_phases
  where case_id = v_case_id
    and position < v_position
    and status not in ('concluida', 'nao_necessaria');
  if v_blocking > 0 then
    raise exception 'conclua ou marque as fases anteriores antes de ativar esta'
      using errcode = 'HC018';
  end if;

  if not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'ativa',
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      activated_at = now(),
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.activate_phase(uuid, uuid, date) to authenticated, service_role;

-- ===========================================================================
-- list_cases_board(commission) — expose due_date per phase
-- ===========================================================================
-- Return-table signature UNCHANGED (plain CREATE OR REPLACE). Identical to
-- 20260613090006 except: 'due_date' is added to each phase's jsonb_build_object.
create or replace function public.list_cases_board(p_commission_id uuid)
returns table (
  case_id uuid,
  case_number integer,
  label text,
  status text,
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
  where c.commission_id = p_commission_id
  order by c.case_number desc;
end;
$$;

grant execute on function public.list_cases_board(uuid) to authenticated, service_role;

-- ===========================================================================
-- get_case_detail(case) — expose due_date + default_due_days per phase
-- ===========================================================================
-- Signature UNCHANGED (plain CREATE OR REPLACE). Identical to 20260613090006
-- except: 'due_date' and 'default_due_days' are added to each phase's
-- jsonb_build_object.
create or replace function public.get_case_detail(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case public.cases;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not app.is_staff_admin_of(v_case.commission_id) then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
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
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          -- response_id / submitted_at ONLY for a submitted (concluida) phase.
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
