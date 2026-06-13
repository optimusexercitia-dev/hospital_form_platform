-- Phase 7 / B3: Case + phase RPCs, the submit trigger, the recommendation
-- engine, and the definer board reads.
--
-- A case materializes a published template into case_phases, each pinning the
-- bound form's currently-published version (a SNAPSHOT — template edits never
-- reach a live case). Phases are filled/submitted through the EXISTING
-- start_or_resume_response / save_section_answers / submit_response machinery
-- (a phase IS a response, bridged by responses.case_phase_id); an AFTER UPDATE
-- trigger flips the phase to concluida when its response is submitted. Cross-
-- phase recommendations REUSE app.eval_condition verbatim — the only new thing
-- is the answer-map source (a submitted-only, single-phase map) and the
-- from_phase-stripping. The condition evaluator (SQL + the TS mirror) and the
-- shared vector file are UNCHANGED (no drift).
--
-- Modes: SECURITY INVOKER unless marked DEFINER. Invoker RPCs rely on the B4
-- RLS (cases/case_phases staff_admin-write; responses fill policies) as the
-- authority. DEFINER RPCs are the narrow, internally is_staff_admin_of-gated
-- exceptions (mirror ADR 0016's list_signoff_queue / get_response_for_signoff):
-- create_case_from_template (writes across tables atomically), the board reads
-- (list_cases_board / get_case_detail — STATUS only / SUBMITTED answers only),
-- and the recommendation engine (case_phase_answer_map / recompute_recommendations,
-- which read submitted answers ACROSS members and are the single cross-member
-- read surface — they stay SUBMITTED-ONLY, preserving the Phase-7 in_progress-
-- answers invariant).
--
-- Every RPC gates app.feature_enabled('cases_multi_phase') at entry.
--
-- SQLSTATEs (see 20260613090004 header): HC016 invalid recommend_when, HC017 no
-- published version, HC018 not sequentially activatable, HC019 phase wrong
-- state, HC020 case not open, HC021 assignee not a member, HC022 caller not the
-- assignee. HC010-HC013 are reused for the phase fill/submit path.

-- ===========================================================================
-- app.commission_of_case(case_id) -> uuid   (used by B4 RLS too)
-- ===========================================================================
create function app.commission_of_case(p_case_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select commission_id from public.cases where id = p_case_id;
$$;

revoke all on function app.commission_of_case(uuid) from public;
grant execute on function app.commission_of_case(uuid) to authenticated, service_role;

-- ===========================================================================
-- app.case_phase_answer_map(case_phase_id) -> jsonb   (question_key -> value)
-- ===========================================================================
-- SECURITY DEFINER. Returns the answers of a phase's response as
-- question_key -> value, *** ONLY when that response is SUBMITTED ***; returns
-- '{}' otherwise (in_progress, skipped, or no response yet).
--
-- THIS IS THE SINGLE SECURITY-CRITICAL CROSS-MEMBER READ SURFACE. The Phase-7
-- in_progress-answers invariant (ADR 0016) says a coordinator (or the
-- recommendation engine acting on their behalf) must NEVER see another member's
-- in_progress answers. By filtering to status='submitted' here, an in-progress
-- source phase contributes an EMPTY map — so a recommend_when over it evaluates
-- as "no value" (equals/in false, not_equals true), exactly as a skipped phase
-- does. The '{}' -for-in-progress behaviour is covered by a dedicated pgTAP
-- test (B6). DO NOT relax the status filter.
create function app.case_phase_answer_map(p_case_phase_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(jsonb_object_agg(a.question_key, a.value), '{}'::jsonb)
  from public.responses r
  join public.answers a on a.response_id = r.id
  where r.case_phase_id = p_case_phase_id
    and r.status = 'submitted'
    and a.value is not null;
$$;

revoke all on function app.case_phase_answer_map(uuid) from public;
grant execute on function app.case_phase_answer_map(uuid) to authenticated, service_role;

-- ===========================================================================
-- recompute_recommendations(case_id)
-- ===========================================================================
-- SECURITY DEFINER. For every PENDENTE phase carrying a recommend_when: resolve
-- from_phase -> the earlier case-phase at that position, build that phase's
-- SUBMITTED-ONLY answer map, strip the from_phase qualifier
-- (recommend_when - 'from_phase' yields a plain visible_when), and feed
-- app.eval_condition (UNCHANGED) to set `recommended`. Non-pendente phases are
-- frozen (recommended stays as it was when the phase left pendente). Called by
-- create_case_from_template, the submit trigger, and skip_phase.
--
-- It writes case_phases.recommended only — never status — and runs under
-- app.in_case_rpc so the phase-status guard permits the flag toggle uniformly.
create function public.recompute_recommendations(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  r record;
  v_source_phase_id uuid;
  v_answers jsonb;
  v_should boolean;
begin
  perform set_config('app.in_case_rpc', 'on', true);

  for r in
    select id, position, recommend_when
    from public.case_phases
    where case_id = p_case_id
      and status = 'pendente'
      and recommend_when is not null
  loop
    -- Resolve from_phase (a case-phase position) to the source phase id.
    select id into v_source_phase_id
    from public.case_phases
    where case_id = p_case_id
      and position = (r.recommend_when ->> 'from_phase')::integer;

    if v_source_phase_id is null then
      -- Dangling reference (should not happen post-snapshot validation); treat
      -- as "no source data" -> empty map.
      v_answers := '{}'::jsonb;
    else
      v_answers := app.case_phase_answer_map(v_source_phase_id);
    end if;

    -- Strip the qualifier; the remainder is a plain visible_when the UNCHANGED
    -- evaluator accepts.
    v_should := app.eval_condition(r.recommend_when - 'from_phase', v_answers);

    update public.case_phases
    set recommended = v_should, updated_at = now()
    where id = r.id
      and recommended is distinct from v_should;
  end loop;

  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

revoke all on function public.recompute_recommendations(uuid) from public;
grant execute on function public.recompute_recommendations(uuid) to authenticated, service_role;

-- ===========================================================================
-- create_case_from_template(template_id, label) -> cases
-- ===========================================================================
-- SECURITY DEFINER, internally gated by is_staff_admin_of (mirror
-- list_signoff_queue's self-gate). Atomically: insert the case (number via the
-- minting trigger, one-shot unique_violation retry), materialize every template
-- slot into case_phases pinning the form's currently-published version (HC017 if
-- none), copy recommend_when, RE-VALIDATE each recommend_when against the PINNED
-- source versions (HC016 if the referenced key is now absent), and run an
-- initial recompute. Phase 1 starts PENDENTE (the coordinator activates it).
-- All writes run under app.in_case_rpc so the guards permit the inserts.
create function public.create_case_from_template(
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
    select position, form_id, title, recommend_when
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

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when, is_ad_hoc)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false);
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
-- activate_phase(case_phase_id, assigned_to) -> case_phases
-- ===========================================================================
-- SECURITY INVOKER (RLS case_phases staff_admin-write is the authority). Guards:
-- the case is aberto (HC020); the phase is pendente (HC019); every EARLIER phase
-- is concluida or nao_necessaria (HC018 — strict sequential); the assignee is a
-- member of the commission (HC021). Sets ativa + assigned_to + activated_at.
create function public.activate_phase(
  p_case_phase_id uuid,
  p_assigned_to uuid
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
  set status = 'ativa', assigned_to = p_assigned_to, activated_at = now(), updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.activate_phase(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- app.is_member_of_for(commission_id, user_id) -> boolean
-- ===========================================================================
-- Membership check for an ARBITRARY user (not auth.uid()). is_member_of only
-- answers for the caller; assigning a phase needs to verify the *assignee*.
-- SECURITY DEFINER so it reads commission_members regardless of the caller's RLS.
create function app.is_member_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1 from public.commission_members
    where commission_id = p_commission_id and user_id = p_user_id
  );
$$;

revoke all on function app.is_member_of_for(uuid, uuid) from public;
grant execute on function app.is_member_of_for(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- skip_phase(case_phase_id) -> case_phases
-- ===========================================================================
-- SECURITY INVOKER. pendente -> nao_necessaria only (never skip an ativa phase —
-- that would orphan its draft). Guards: case aberto (HC020), phase pendente
-- (HC019). Then recompute (a skipped phase contributes an empty map, possibly
-- changing downstream recommendations).
create function public.skip_phase(p_case_phase_id uuid)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_status text;
  v_case_status text;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, c.status
    into v_case_id, v_status, v_case_status
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
    raise exception 'apenas fases pendentes podem ser marcadas como não necessárias'
      using errcode = 'HC019';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'nao_necessaria', skipped_at = now(), updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case_id);

  return v_result;
end;
$$;

grant execute on function public.skip_phase(uuid) to authenticated, service_role;

-- ===========================================================================
-- add_ad_hoc_phase(case_id, form_id, title, recommend_when, assigned_to) -> phase
-- ===========================================================================
-- SECURITY INVOKER. Appends a phase to an OPEN case at max(position)+1,
-- is_ad_hoc = true, pinning the form's published version (HC017). Append-only ->
-- never renumbers, so no from_phase reference can break. recommend_when (if
-- given) is validated: from_phase < the new position AND the referenced key
-- exists in that source phase's PINNED version (HC016). Starts pendente.
create function public.add_ad_hoc_phase(
  p_case_id uuid,
  p_form_id uuid,
  p_title text default null,
  p_recommend_when jsonb default null,
  p_assigned_to uuid default null
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_position integer;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_case_status, v_commission_id
  from public.cases where id = p_case_id;
  if v_case_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_case_status <> 'aberto' then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  if not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão' using errcode = 'check_violation';
  end if;

  v_version := app.published_version_of_form(p_form_id);
  if v_version is null then
    raise exception 'este formulário ainda não foi publicado' using errcode = 'HC017';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_phases where case_id = p_case_id;

  -- Validate recommend_when against the existing (earlier) phases' pinned versions.
  if p_recommend_when is not null then
    v_from_phase := (p_recommend_when ->> 'from_phase')::integer;
    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= v_position then
      raise exception 'a recomendação deve referenciar uma fase anterior'
        using errcode = 'HC016';
    end if;
    select form_version_id into v_source_version
    from public.case_phases where case_id = p_case_id and position = v_from_phase;
    if v_source_version is null then
      raise exception 'a recomendação referencia uma fase inexistente'
        using errcode = 'HC016';
    end if;
    if not app.version_has_input_key(v_source_version, p_recommend_when ->> 'question_key') then
      raise exception 'a recomendação referencia uma pergunta inexistente no formulário de origem'
        using errcode = 'HC016';
    end if;
  end if;

  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (case_id, position, form_id, form_version_id, title, recommend_when, is_ad_hoc, assigned_to)
  values
    (p_case_id, v_position, p_form_id, v_version, nullif(btrim(p_title), ''),
     p_recommend_when, true, p_assigned_to)
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(p_case_id);

  return v_result;
end;
$$;

grant execute on function public.add_ad_hoc_phase(uuid, uuid, text, jsonb, uuid)
  to authenticated, service_role;

-- ===========================================================================
-- reassign_phase(case_phase_id, new_assignee) -> case_phases
-- ===========================================================================
-- SECURITY INVOKER. Changes assigned_to ONLY while no response exists for the
-- phase yet (HC019 otherwise — once a draft exists the assignee owns it). Case
-- must be aberto (HC020); new assignee a member (HC021). Covers an assignee
-- removed from the commission before they started.
create function public.reassign_phase(
  p_case_phase_id uuid,
  p_new_assignee uuid
)
returns public.case_phases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_has_response boolean;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select c.status, c.commission_id
    into v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_commission_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status <> 'aberto' then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  select exists (
    select 1 from public.responses where case_phase_id = p_case_phase_id
  ) into v_has_response;
  if v_has_response then
    raise exception 'não é possível redefinir o responsável após o início do preenchimento'
      using errcode = 'HC019';
  end if;

  if not app.is_member_of_for(v_commission_id, p_new_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set assigned_to = p_new_assignee, updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.reassign_phase(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- start_or_resume_phase(case_phase_id) -> responses
-- ===========================================================================
-- SECURITY INVOKER. The ASSIGNEE's entry into the wizard. Guards: the phase is
-- ativa (HC019); the caller is the assignee (HC022). Resolves the PINNED
-- form_version_id (NOT "currently published" — the pin may now be archived, so
-- this deliberately SKIPS the published-only backstop in start_or_resume_response).
-- Resumes the phase's single response or creates it (case_phase_id set), with a
-- unique_violation catch for the double-click race against
-- responses_one_per_case_phase_idx. The INSERT runs under responses_insert_own
-- (created_by = auth.uid() AND member), so a non-member is rejected by RLS.
create function public.start_or_resume_phase(p_case_phase_id uuid)
returns public.responses
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_assigned_to uuid;
  v_version_id uuid;
  v_commission_id uuid;
  v_uid uuid := auth.uid();
  v_result public.responses;
begin
  perform app.assert_cases_enabled();

  select cp.status, cp.assigned_to, cp.form_version_id, c.commission_id
    into v_status, v_assigned_to, v_version_id, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_version_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'ativa' then
    raise exception 'esta fase não está ativa' using errcode = 'HC019';
  end if;
  if v_assigned_to is distinct from v_uid then
    raise exception 'apenas o responsável pode preencher esta fase' using errcode = 'HC022';
  end if;

  -- Resume the phase's existing response (any status; a submitted one is handed
  -- back read-only by the wizard).
  select * into v_result
  from public.responses where case_phase_id = p_case_phase_id;
  if v_result.id is not null then
    return v_result;
  end if;

  -- Create. NOTE: we pin v_version_id WITHOUT the published-only backstop — the
  -- snapshot may now be archived.
  begin
    insert into public.responses (form_version_id, commission_id, created_by, status, case_phase_id)
    values (v_version_id, v_commission_id, v_uid, 'in_progress', p_case_phase_id)
    returning * into v_result;
  exception
    when unique_violation then
      select * into v_result
      from public.responses where case_phase_id = p_case_phase_id;
  end;

  return v_result;
end;
$$;

grant execute on function public.start_or_resume_phase(uuid) to authenticated, service_role;

-- ===========================================================================
-- sync_case_phase_on_submit — AFTER UPDATE ON responses
-- ===========================================================================
-- When a phase's response flips in_progress -> submitted, advance the phase to
-- concluida and recompute downstream recommendations. Phase completion is a
-- REACTION to the UNCHANGED submit_response (no forked submit RPC).
--
-- CRITICAL (lead confirmation 1): submit_response sets app.in_submit_rpc, NOT
-- app.in_case_rpc — so this trigger MUST set app.in_case_rpc itself around the
-- case_phases update (and reset after), or guard_case_phase_status would block
-- the ativa -> concluida flip. recompute_recommendations sets/clears the flag
-- internally, so we reset BEFORE calling it (idempotent set is fine either way).
--
-- A stranded draft on a closed/cancelled case is INERT: if the case is not
-- aberto we return without advancing the phase (edge-case 3).
create function public.sync_case_phase_on_submit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case_id uuid;
  v_case_status text;
begin
  -- Only react to a phase response transitioning to submitted.
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  select cp.case_id, c.status
    into v_case_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  -- Stranded draft on a non-open case: leave the phase as-is (inert).
  if v_case_status is distinct from 'aberto' then
    return new;
  end if;

  -- Advance the phase under our OWN session flag (submit_response only set
  -- app.in_submit_rpc, which the phase guard does not honour).
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'concluida', completed_at = now(), updated_at = now()
  where id = new.case_phase_id and status = 'ativa';
  perform set_config('app.in_case_rpc', 'off', true);

  -- Recompute downstream recommendations against the newly-submitted answers.
  perform public.recompute_recommendations(v_case_id);

  return new;
end;
$$;

create trigger sync_case_phase_on_submit_trg
  after update on public.responses
  for each row execute function public.sync_case_phase_on_submit();

-- ===========================================================================
-- close_case(case_id) / cancel_case(case_id) -> cases
-- ===========================================================================
-- SECURITY INVOKER (RLS cases staff_admin-write authorizes). aberto only
-- (HC020). Both flip any remaining pendente/ativa phases to nao_necessaria so
-- the board reads cleanly; a stranded in_progress draft is then inert (the
-- submit trigger no-ops on a non-open case). Run under app.in_case_rpc so the
-- guards permit the terminal transitions.
create function public.close_case(p_case_id uuid)
returns public.cases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  select status into v_status from public.cases where id = p_case_id;
  if v_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'aberto' then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  update public.cases
  set status = 'concluido', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.close_case(uuid) to authenticated, service_role;

create function public.cancel_case(p_case_id uuid)
returns public.cases
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  select status into v_status from public.cases where id = p_case_id;
  if v_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'aberto' then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  update public.cases
  set status = 'cancelado', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.cancel_case(uuid) to authenticated, service_role;

-- ===========================================================================
-- list_cases_board(commission_id) -> setof rows   (STATUS only, no answers)
-- ===========================================================================
-- SECURITY DEFINER, internally gated by is_staff_admin_of (mirror
-- list_signoff_queue). One row per case + a jsonb-aggregated phases array
-- carrying STATUS / recommended / assignee ONLY — never answers. Non-staff_admins
-- get an empty set (no leak).
create function public.list_cases_board(p_commission_id uuid)
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
               'assignee_name', pr.full_name
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
-- get_case_detail(case_id) -> jsonb   (SUBMITTED answers reachable only)
-- ===========================================================================
-- SECURITY DEFINER, internally gated by is_staff_admin_of(commission_of_case).
-- Returns the case header + every phase. Per phase, response_id / submitted_at
-- are populated ONLY for a CONCLUIDA (submitted) phase — so the coordinator can
-- deep-link a completed phase's answers via the EXISTING staff_admin
-- submitted-response read path. An in_progress phase exposes status only; no
-- answer and no in_progress response id ever leaves this envelope (the Phase-7
-- invariant). Raises no_data_found when the caller is not entitled.
create function public.get_case_detail(p_case_id uuid)
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
