-- Case Correction Lifecycle — BE-2 current-revision reader sweep + sync guard.
--
-- With BE-1 a case phase can now carry a supersession CHAIN of responses (root +
-- successors) plus the current-revision pointer case_phases.current_response_id.
-- Every reader that used to select "the phase's submitted response" would now hit
-- MULTIPLE submitted rows (double-count / nondeterministic). This migration rewires
-- them to resolve the single current revision via the pointer, and makes the submit
-- sync trigger both (a) set that pointer on first submit and (b) take no effect for
-- an unapproved successor's submit (approval owns effect-taking).
--
-- It also restructures app.guard_supersession_coherent so that a service-role /
-- DEFINER-door / migration caller (auth.uid() null) may build a STRUCTURALLY
-- coherent same-phase chain (chain-tip only), while any real authenticated caller's
-- case-bound supersession stays hard-blocked (HC0H1) until BE-3 installs the
-- open-request corrector arm. No real user gains a new write path in BE-2.
--
-- All bodies below were authored from the LIVE local catalog (pg_get_functiondef),
-- not migration file text (stale by design — CLAUDE.md graphify exception).

-- ---------------------------------------------------------------------------
-- 1a. app.case_phase_answer_map — resolve the current revision; empty unless the
--     phase is `completed` (keeps voided answers out of recommend_when).
-- ---------------------------------------------------------------------------
create or replace function app.case_phase_answer_map(p_case_phase_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  with
  -- The phase's CURRENT revision (BE-2): the pointer, and only while completed.
  -- Voided / non-completed phases yield an empty map.
  resp as (
    select cp.current_response_id as id
    from public.case_phases cp
    where cp.id = p_case_phase_id
      and cp.status = 'completed'
      and cp.current_response_id is not null
  ),
  scalars as (
    select a.question_key, a.value
    from public.answers a
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    where a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  selected as (
    select i.question_key, i.item_type, o.code, o.position
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  single as (
    select question_key, to_jsonb(min(code)) as value
    from selected
    where item_type = any (array['multiple_choice','dropdown'])
    group by question_key
  ),
  multi as (
    select question_key, jsonb_agg(to_jsonb(code) order by position) as value
    from selected
    where item_type = 'checkbox'
    group by question_key
  ),
  merged as (
    select question_key, value from scalars
    union all select question_key, value from single
    union all select question_key, value from multi
  )
  select coalesce(jsonb_object_agg(question_key, value), '{}'::jsonb)
  from merged;
$function$;

-- ---------------------------------------------------------------------------
-- 1b. app.case_phase_option_aggregates — resolve the current revision (kills the
--     two-submitted-rows double-count). No completed filter: compute is only ever
--     called for a phase transitioning active→completed, never for a voided phase.
-- ---------------------------------------------------------------------------
create or replace function app.case_phase_option_aggregates(p_case_phase_id uuid)
returns table(total_score numeric, flagged_options integer)
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  with resp as (
    select cp.current_response_id as id
    from public.case_phases cp
    where cp.id = p_case_phase_id
      and cp.current_response_id is not null
  ),
  sel as (
    select o.score, o.flagged
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  )
  select
    coalesce(sum(coalesce(score, 0)), 0)::numeric as total_score,
    coalesce(count(*) filter (where flagged), 0)::int as flagged_options
  from sel;
$function$;

-- ---------------------------------------------------------------------------
-- 1c. public.get_case_detail — the per-phase response lateral resolves the pointer
--     (removes the unordered `limit 1` nondeterminism). Envelope shape unchanged.
--     Reproduced verbatim from the live body; ONLY the lateral changed.
-- ---------------------------------------------------------------------------
create or replace function public.get_case_detail(p_case_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Flag branch collapsed (B4): the case_access read path is the only path now.
  if not app.can_read_case(p_case_id, auth.uid()) then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_commission_admin_of(v_case.commission_id);

  if not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

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
    'has_patient', v_case.has_patient,
    'patient_enabled', v_case.patient_enabled,
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
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
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at,
          'result_id', cp.result_id,
          'result_computed_at', cp.result_computed_at,
          'result', case when prr.id is null then null else jsonb_build_object(
            'id', prr.id,
            'label', prr.label,
            'color_token', prr.color_token,
            'is_adverse', prr.is_adverse,
            'source', cp.result_source
          ) end
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join public.phase_results prr on prr.id = cp.result_id
       -- BE-2: resolve the current revision via the pointer (was an unordered
       -- `limit 1` over all submitted rows — nondeterministic once chains exist).
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.id = cp.current_response_id
           and cp.status = 'completed'
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'is_ad_hoc', cn.is_ad_hoc,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 1d. public.start_or_resume_phase — the resume select becomes the chain ROOT
--     (first-fill door only; corrections never enter here).
-- ---------------------------------------------------------------------------
create or replace function public.start_or_resume_phase(p_case_phase_id uuid)
returns responses
language plpgsql
set search_path to 'public', 'pg_catalog'
as $function$
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
  if v_status <> 'active' then
    raise exception 'esta fase não está ativa' using errcode = 'HC019';
  end if;
  if v_assigned_to is distinct from v_uid then
    raise exception 'apenas o responsável pode preencher esta fase' using errcode = 'HC022';
  end if;

  -- Resume the phase's ROOT response (BE-2: supersedes_id is null). Correction
  -- successors are never handed back through the first-fill door.
  select * into v_result
  from public.responses
  where case_phase_id = p_case_phase_id and supersedes_id is null;
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
      from public.responses
      where case_phase_id = p_case_phase_id and supersedes_id is null;
  end;

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 1e. public.sync_case_phase_on_submit — (i) an unapproved successor's submit
--     takes NO effect; (ii) first submit sets the current-revision pointer.
-- ---------------------------------------------------------------------------
create or replace function public.sync_case_phase_on_submit()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid;
  v_case_status text;
begin
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  -- BE-2: a correction successor's submit must have ZERO effect on the phase —
  -- approval (BE-3) owns effect-taking (re-point + compute + recompute). Without
  -- this, an unapproved successor would recompute the result from unapproved
  -- answers and prematurely re-complete the phase.
  if new.supersedes_id is not null then
    return new;
  end if;

  -- ETH·E2 §D13: a targeted respondent's defense does not advance the committee workflow.
  if new.target_case_participant_id is not null then
    return new;
  end if;

  select cp.case_id, c.status
    into v_case_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  if v_case_status in ('completed', 'cancelled') then
    return new;
  end if;

  -- First-submit arm: complete the phase AND set the current-revision pointer.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'completed', completed_at = now(), updated_at = now(),
      current_response_id = new.id
  where id = new.case_phase_id and status = 'active';
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.compute_case_phase_result(new.case_phase_id);

  perform public.recompute_recommendations(v_case_id);

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. app.guard_supersession_coherent — allow service-role coherent same-phase
--    chains (chain-tip); keep case-bound supersession hard-blocked (HC0H1) for
--    any real authenticated caller until BE-3. Standalone arm unchanged.
-- ---------------------------------------------------------------------------
create or replace function app.guard_supersession_coherent()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_pfv uuid; v_pcomm uuid; v_pstatus text; v_pphase uuid;
  v_uid uuid; v_pcur uuid;
begin
  if new.supersedes_id is null then return new; end if;
  select form_version_id, commission_id, status, case_phase_id
    into v_pfv, v_pcomm, v_pstatus, v_pphase
  from public.responses where id = new.supersedes_id;
  if v_pfv is null then
    raise exception 'resposta anterior não encontrada' using errcode = 'HC0H4';
  end if;
  if new.form_version_id <> v_pfv or new.commission_id <> v_pcomm then
    raise exception 'a correção deve manter versão e comissão da resposta original'
      using errcode = 'HC0H4';
  end if;
  if v_pstatus <> 'submitted' then
    raise exception 'apenas respostas enviadas e avulsas podem ser corrigidas'
      using errcode = 'HC0H1';
  end if;

  v_uid := auth.uid();

  -- ---- STANDALONE arm (unchanged — response_correction / SUP) ----
  -- gates flag + authority for any real authenticated writer; service-role skips
  -- (RLS-exempt / trusted per ADR 0075). The legitimate supersede_response RPC
  -- runs SECURITY DEFINER but auth.uid() reads the request JWT, so the guard sees
  -- the real caller, whom the RPC already verified.
  if v_pphase is null and new.case_phase_id is null then
    if v_uid is not null then
      perform app.assert_response_correction_enabled();
      if not (app.is_staff_admin_of(new.commission_id) or app.is_commission_admin_of(new.commission_id)) then
        raise exception 'você não pode corrigir respostas nesta comissão' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  -- ---- CASE-BOUND arm (BE-2: STRUCTURAL coherence only) ----
  -- Must be a same-phase chain; mixed / cross-phase → HC0H1.
  if new.case_phase_id is null or v_pphase is null or new.case_phase_id <> v_pphase then
    raise exception 'apenas respostas enviadas e avulsas podem ser corrigidas'
      using errcode = 'HC0H1';
  end if;
  -- Chain-tip rule: the predecessor must be the phase's current revision.
  select current_response_id into v_pcur from public.case_phases where id = new.case_phase_id;
  if new.supersedes_id is distinct from v_pcur then
    raise exception 'somente a revisão atual da fase pode ser corrigida'
      using errcode = 'HC0H1';
  end if;
  -- BE-2: case-bound supersession stays hard-blocked for any real authenticated
  -- caller. BE-3 REPLACES this block with the open-request corrector arm
  -- (assert_case_corrections_enabled + open request with permitted_corrector = uid,
  -- else 42501). Until then only a service-role / DEFINER-door / migration caller
  -- (auth.uid() null) may build the structurally-coherent chain — no real user
  -- gains a new write path in BE-2.
  if v_uid is not null then
    raise exception 'apenas respostas enviadas e avulsas podem ser corrigidas'
      using errcode = 'HC0H1';
  end if;

  return new;
end;
$function$;
