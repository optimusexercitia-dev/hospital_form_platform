-- Audit-payload free-text sweep (Rule 11 / LGPD erasure).
--
-- The append-only, hash-chained audit_log can never be erased, so a free-text
-- value written into an audit payload is un-erasable forever — an LGPD conflict
-- the moment a reason embeds patient context. The case-corrections doors
-- (20260825000200, ADR 0085) already exclude free-text reasons from audit
-- payloads: the reason lives on an RLS-scoped, erasable row instead, and the
-- audit row records only structured keys (that + who, never payloads).
--
-- A catalog sweep of every app.audit_write call site (pg_proc.prosrc,
-- 2026-07-24) found exactly THREE doors still writing caller-supplied free
-- text into the payload:
--
--   * public.supersede_response  — jsonb 'reason' (p_reason, unconstrained).
--     Removed here; 'successor_id' stays. The reason remains MANDATORY
--     (HC0H3) — it is operator friction that forces a deliberate correction —
--     but is no longer persisted in the un-erasable trail.
--   * public.cancel_session      — jsonb 'reason'. Removed; the reason already
--     persists on interview_sessions.cancellation_reason (RLS-scoped, erasable).
--   * public.no_show_session     — same as cancel_session.
--
-- Every other text-typed payload arg is a controlled vocabulary enforced by an
-- in-function guard (dispose_*_phi p_reason, cast_case_vote p_vote,
-- record_ethics_finding p_finding, referral message/receipt types, …) — not
-- free text, left as-is. log_audit_access is a passthrough whose app callers
-- send structured metadata only.
--
-- Existing audit rows are untouched (the chain is append-only by design);
-- this changes future writes only. Bodies below are authored from the LIVE
-- catalog (pg_get_functiondef), not from prior migration text (ADR 0078 A28).
-- CREATE OR REPLACE preserves existing ACLs; no grant changes.

create or replace function public.supersede_response(p_response_id uuid, p_reason text)
returns public.responses
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
  v_form_version uuid;
  v_status text;
  v_case_phase uuid;
  v_reason text;
  v_new public.responses;
begin
  perform app.assert_response_correction_enabled();

  -- Predecessor visible + exists → else no_data_found (RLS-safe not-found; this
  -- DEFINER function reads without RLS, so "visible" here means "exists" — the
  -- authority check right after is what actually gates who may act on it).
  select commission_id, form_version_id, status, case_phase_id
    into v_commission, v_form_version, v_status, v_case_phase
  from public.responses where id = p_response_id;

  if v_commission is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Authority: staff_admin or commission-admin of the predecessor's commission
  -- (the supersede_document gate). Checked BEFORE further preconditions so an
  -- unauthorized caller never learns anything about the row's state.
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode corrigir respostas nesta comissão' using errcode = '42501';
  end if;

  -- Predecessor status = submitted (HC0H0) — an in_progress draft is edited directly.
  if v_status <> 'submitted' then
    raise exception 'apenas respostas enviadas podem ser corrigidas' using errcode = 'HC0H0';
  end if;

  -- Standalone-only (HC0H1) — case-wrapped responses are the case-phase
  -- lifecycle's to correct.
  if v_case_phase is not null then
    raise exception 'esta resposta pertence a um caso; a correção é feita pela fase do caso'
      using errcode = 'HC0H1';
  end if;

  -- No existing LIVE successor for this predecessor (HC0H2) — the clean
  -- pt-BR error; responses_one_successor_per_superseded backstops a direct
  -- double-insert race.
  if exists (select 1 from public.responses where supersedes_id = p_response_id) then
    raise exception 'já existe uma correção em andamento para esta resposta'
      using errcode = 'HC0H2';
  end if;

  -- Mandatory reason (HC0H3). Validated only — never written to the audit
  -- payload (Rule 11: free text in the un-erasable chain is an LGPD conflict).
  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'informe o motivo da correção' using errcode = 'HC0H3';
  end if;

  -- No live in_progress draft of THIS form version already owned by the caller
  -- (HC0H5). The platform's responses_one_draft_per_user_idx allows only ONE
  -- in_progress standalone response per (form_version_id, created_by); a normal
  -- fill-in-progress OR another open correction on the same version would make
  -- the successor INSERT below collide (raw 23505). Pre-empt it with a clean,
  -- actionable pt-BR message. The unique index stays as the backstop.
  if exists (
    select 1 from public.responses
    where created_by = auth.uid()
      and form_version_id = v_form_version
      and status = 'in_progress'
      and case_phase_id is null
  ) then
    raise exception 'você já tem um preenchimento em andamento para esta versão do formulário; conclua ou descarte-o antes de corrigir'
      using errcode = 'HC0H5';
  end if;

  -- Insert the successor — form_version_id + commission_id copied from the
  -- predecessor (the coherence trigger re-verifies this); case_phase_id is
  -- always null (standalone); supersedes_id pre-links the chain.
  insert into public.responses (
    form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id
  ) values (
    v_form_version, v_commission, auth.uid(), 'in_progress', null, p_response_id
  )
  returning * into v_new;

  -- Pre-populate (O-1): copy the predecessor's saved scalar answers into the
  -- new draft (fresh ids, response_id repointed; answered_at reset to now() —
  -- it is a contemporaneous per-answer timestamp (ALCOA+), not a value to
  -- backdate). sync_answer_typed_values (BEFORE INSERT on answers) re-derives
  -- value_number/value_date/value_time from the copied value.
  insert into public.answers (
    response_id, item_id, question_key, value, observation, other_text,
    group_instance_id, confidentiality_level
  )
  select
    v_new.id, a.item_id, a.question_key, a.value, a.observation, a.other_text,
    a.group_instance_id, a.confidentiality_level
  from public.answers a
  where a.response_id = p_response_id;

  -- Copy choice selections (answer_selected_options hangs off answer_id, not
  -- response_id — join the just-copied answers back to their predecessor
  -- counterpart via (response_id, item_id, group_instance_id), which is the
  -- one-row-per-item key while repeating groups are inert).
  insert into public.answer_selected_options (answer_id, option_id)
  select new_a.id, aso.option_id
  from public.answer_selected_options aso
  join public.answers old_a on old_a.id = aso.answer_id
  join public.answers new_a
    on new_a.response_id = v_new.id
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from old_a.group_instance_id
  where old_a.response_id = p_response_id;

  perform app.audit_write(
    'response.superseded', 'response', p_response_id, v_commission,
    'Resposta corrigida',
    jsonb_build_object('successor_id', v_new.id)
  );

  return v_new;
end;
$function$;

create or replace function public.cancel_session(p_session_id uuid, p_reason text default null::text)
returns public.interview_sessions
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_interview_id uuid;
  v_status text;
  v_result public.interview_sessions;
begin
  perform app.assert_interviews_enabled();
  select interview_id, status into v_interview_id, v_status
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);
  if v_status = 'completed' then
    raise exception 'uma sessão concluída não pode ser cancelada' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.interview_sessions
  set status = 'cancelled',
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), cancellation_reason)
  where id = p_session_id
  returning * into v_result;

  -- Payload: structured keys only — the free-text reason lives on the
  -- RLS-scoped row (cancellation_reason), never in the un-erasable chain.
  perform app.audit_write('interview.session_cancelled', 'interview', v_interview_id,
    app.commission_of_interview(v_interview_id),
    'Sessão nº ' || v_result.sequence_number || ' cancelada',
    jsonb_build_object('session_id', p_session_id));

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$function$;

create or replace function public.no_show_session(p_session_id uuid, p_reason text default null::text)
returns public.interview_sessions
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_interview_id uuid;
  v_status text;
  v_result public.interview_sessions;
begin
  perform app.assert_interviews_enabled();
  select interview_id, status into v_interview_id, v_status
  from public.interview_sessions where id = p_session_id;
  if v_interview_id is null then
    raise exception 'sessão de entrevista % não encontrada', p_session_id using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);
  if v_status = 'completed' then
    raise exception 'uma sessão concluída não pode ser marcada como não comparecimento' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.interview_sessions
  set status = 'no_show',
      cancellation_reason = coalesce(nullif(btrim(p_reason), ''), cancellation_reason)
  where id = p_session_id
  returning * into v_result;

  -- Payload: structured keys only — the free-text reason lives on the
  -- RLS-scoped row (cancellation_reason), never in the un-erasable chain.
  perform app.audit_write('interview.session_no_show', 'interview', v_interview_id,
    app.commission_of_interview(v_interview_id),
    'Sessão nº ' || v_result.sequence_number || ' registrada como não comparecimento',
    jsonb_build_object('session_id', p_session_id));

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$function$;
