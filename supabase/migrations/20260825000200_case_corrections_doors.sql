-- Case Correction Lifecycle — BE-3 request doors + corrector supersession arm + read grants.
--
-- The complete DEFINER door surface for the correction workflow (file → start/save
-- draft → resubmit → review → approve/reject/withdraw), covering BOTH phase and
-- narrative targets and the void kind. Every door: SECURITY DEFINER, flag gate
-- (assert_case_corrections_enabled), resolve case → authority → assert_not_case_excluded
-- → app.is_active (AFTER authority, per the conclude_narrative A33 ordering) → open-case
-- HC020, writes to case_correction_requests under app.in_correction_rpc, pt-BR errors,
-- semantic audit via app.audit_write. Free-text (reason / body / answers) is NEVER
-- written to the audit log (Rule 11).
--
-- Also: guard_supersession_coherent's case-bound arm gains the corrector authorization
-- (replacing BE-2's authenticated hard-block); a read arm lets a non-assignee corrector
-- SELECT the predecessor for diffing.
--
-- All precedent bodies were read from the LIVE catalog (supersede_response copy block,
-- conclude_narrative ordering, the RLS quals), never migration file text.
--
-- Errcodes (verified free): HC0M0 target not completed · HC0M1 not the corrector ·
-- HC0M2 open slot taken · HC0M3 narrative draft blank · HC0M4 corrector invalid ·
-- HC0M5 targeted-response phase · HC0M6 reject reason blank · HC0M7 resubmitted must be
-- rejected first · HC0M9 stale draft at approval. (HC0M8 = reopen_case, BE-4.)

-- ---------------------------------------------------------------------------
-- 0. Audit: replace the BE-1 generic status_changed trigger with semantic
--    door-level events. Every write is door-mediated (the write guard requires
--    app.in_correction_rpc, set only inside these doors), so the semantic events
--    give complete, richer coverage; the trigger's only unique arm (cascade
--    DELETE) is a no-op (commission_of_case is null under case cascade).
-- ---------------------------------------------------------------------------
drop trigger if exists audit_case_correction_requests_trg on public.case_correction_requests;
drop function if exists app.trg_audit_case_correction_requests();

-- ---------------------------------------------------------------------------
-- 1. Read arm — a non-assignee corrector may read the predecessor (and the whole
--    phase chain) for diffing while an open request ties them to that phase.
-- ---------------------------------------------------------------------------
create or replace function app.can_read_correction_response(p_response_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select exists (
    select 1
    from public.responses r
    join public.case_correction_requests cr on cr.case_phase_id = r.case_phase_id
    where r.id = p_response_id
      and r.case_phase_id is not null
      and cr.permitted_corrector = p_uid
      and cr.status in ('requested', 'in_progress', 'resubmitted', 'under_review', 'rejected')
  );
$function$;

grant execute on function app.can_read_correction_response(uuid, uuid) to authenticated;

-- OR-append the read arm to the three select policies (existing arms verbatim).
alter policy responses_select on public.responses
  using (
    ((created_by = ( SELECT auth.uid() AS uid))
     OR app.is_commission_admin_of(commission_id)
     OR ((status = 'submitted'::text) AND app.is_staff_admin_of(commission_id)))
    OR app.can_read_correction_response(id, ( SELECT auth.uid() AS uid))
  );

alter policy answers_select on public.answers
  using (
    (EXISTS ( SELECT 1
       FROM responses r
      WHERE ((r.id = answers.response_id)
        AND ((r.created_by = ( SELECT auth.uid() AS uid))
             OR app.is_commission_admin_of(r.commission_id)
             OR ((r.status = 'submitted'::text) AND app.is_staff_admin_of(r.commission_id))))))
    OR app.can_read_correction_response(answers.response_id, ( SELECT auth.uid() AS uid))
  );

alter policy answer_selected_options_select on public.answer_selected_options
  using (
    (EXISTS ( SELECT 1
       FROM (answers a JOIN responses r ON ((r.id = a.response_id)))
      WHERE ((a.id = answer_selected_options.answer_id)
        AND ((r.created_by = ( SELECT auth.uid() AS uid))
             OR app.is_commission_admin_of(r.commission_id)
             OR ((r.status = 'submitted'::text) AND app.is_staff_admin_of(r.commission_id))))))
    OR (EXISTS ( SELECT 1
       FROM answers a2
      WHERE (a2.id = answer_selected_options.answer_id)
        AND app.can_read_correction_response(a2.response_id, ( SELECT auth.uid() AS uid))))
  );

-- ---------------------------------------------------------------------------
-- 2. guard_supersession_coherent — case-bound arm gains the corrector arm
--    (replaces BE-2's authenticated hard-block). Standalone arm byte-identical.
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

  -- ---- STANDALONE arm (byte-identical) ----
  if v_pphase is null and new.case_phase_id is null then
    if v_uid is not null then
      perform app.assert_response_correction_enabled();
      if not (app.is_staff_admin_of(new.commission_id) or app.is_commission_admin_of(new.commission_id)) then
        raise exception 'você não pode corrigir respostas nesta comissão' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  -- ---- CASE-BOUND arm ----
  if new.case_phase_id is null or v_pphase is null or new.case_phase_id <> v_pphase then
    raise exception 'apenas respostas enviadas e avulsas podem ser corrigidas'
      using errcode = 'HC0H1';
  end if;
  -- Chain-tip rule.
  select current_response_id into v_pcur from public.case_phases where id = new.case_phase_id;
  if new.supersedes_id is distinct from v_pcur then
    raise exception 'somente a revisão atual da fase pode ser corrigida'
      using errcode = 'HC0H1';
  end if;
  -- Corrector arm: a real authenticated writer must be the designated corrector on
  -- an OPEN correction request for this phase. Service-role / DEFINER-door /
  -- migration (auth.uid() null) is trusted (ADR 0075).
  if v_uid is not null then
    perform app.assert_case_corrections_enabled();
    if not exists (
      select 1 from public.case_correction_requests cr
      where cr.case_phase_id = new.case_phase_id
        and cr.permitted_corrector = v_uid
        and cr.status in ('requested', 'in_progress', 'rejected')
    ) then
      raise exception 'você não pode corrigir esta fase' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. file_correction_request — open a request against a completed phase/narrative.
-- ---------------------------------------------------------------------------
create or replace function public.file_correction_request(
  p_kind text,
  p_case_phase_id uuid,
  p_case_narrative_id uuid,
  p_reason text,
  p_classification text,
  p_permitted_corrector uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text;
  v_target_status text; v_assignee uuid; v_cur_resp uuid; v_target_pcp uuid;
  v_corrector uuid; v_reason text; v_request_id uuid;
begin
  perform app.assert_case_corrections_enabled();

  if (p_case_phase_id is not null) = (p_case_narrative_id is not null) then
    raise exception 'informe exatamente um alvo (fase ou narrativa)' using errcode = 'check_violation';
  end if;

  if p_case_phase_id is not null then
    select cp.case_id, cp.status, cp.assigned_to, cp.current_response_id
      into v_case_id, v_target_status, v_assignee, v_cur_resp
    from public.case_phases cp where cp.id = p_case_phase_id;
  else
    select cn.case_id, cn.status, cn.assigned_to
      into v_case_id, v_target_status, v_assignee
    from public.case_narratives cn where cn.id = p_case_narrative_id;
  end if;
  if v_case_id is null then
    raise exception 'alvo da correção não encontrado' using errcode = 'no_data_found';
  end if;
  select commission_id, status into v_commission, v_case_status
  from public.cases where id = v_case_id;

  -- Authority: any case-content reader may file.
  if not app.can_read_case(v_case_id, auth.uid()) then
    raise exception 'você não pode solicitar correções neste caso' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  -- Target must be completed/concluded.
  if v_target_status is distinct from 'completed' then
    raise exception 'a fase ou narrativa precisa estar concluída para ser corrigida'
      using errcode = 'HC0M0';
  end if;

  -- Targeted-response phases are out of scope v1.
  if p_case_phase_id is not null and v_cur_resp is not null then
    select target_case_participant_id into v_target_pcp
    from public.responses where id = v_cur_resp;
    if v_target_pcp is not null then
      raise exception 'fases de resposta direcionada não podem ser corrigidas por aqui'
        using errcode = 'HC0M5';
    end if;
  end if;

  -- One open request per target (pre-check; the partial-unique indexes backstop).
  if exists (
    select 1 from public.case_correction_requests
    where status in ('requested', 'in_progress', 'resubmitted', 'under_review', 'rejected')
      and ((p_case_phase_id is not null and case_phase_id = p_case_phase_id)
        or (p_case_narrative_id is not null and case_narrative_id = p_case_narrative_id))
  ) then
    raise exception 'já existe uma solicitação de correção aberta para este alvo'
      using errcode = 'HC0M2';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'informe o motivo da correção' using errcode = 'check_violation';
  end if;

  -- Resolve the corrector: default = the target's assignee; explicit designation is
  -- staff_admin-only. The corrector must be a commission member with case read.
  if p_permitted_corrector is null then
    v_corrector := v_assignee;
  else
    if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
      raise exception 'apenas administradores podem designar o corretor' using errcode = '42501';
    end if;
    v_corrector := p_permitted_corrector;
  end if;
  if v_corrector is null
     or not app.is_member_of_for(v_commission, v_corrector)
     or not app.can_read_case(v_case_id, v_corrector) then
    raise exception 'o corretor precisa ser membro da comissão com acesso ao caso'
      using errcode = 'HC0M4';
  end if;

  perform set_config('app.in_correction_rpc', 'on', true);
  insert into public.case_correction_requests
    (case_id, commission_id, kind, case_phase_id, case_narrative_id, status,
     reason, classification, requested_by, permitted_corrector)
  values
    (v_case_id, v_commission, p_kind, p_case_phase_id, p_case_narrative_id, 'requested',
     v_reason, p_classification, auth.uid(), v_corrector)
  returning id into v_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  perform app.audit_write('case_correction.requested', 'case_correction_request',
    v_request_id, v_commission,
    'Solicitação de correção (' || p_kind || ') criada',
    jsonb_build_object('kind', p_kind, 'classification', p_classification,
      'case_phase_id', p_case_phase_id, 'case_narrative_id', p_case_narrative_id,
      'permitted_corrector', v_corrector));

  return v_request_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Shared: resolve the request + case context and run the common door gate
-- (flag / corrector-or-admin authority is per-door, so this only returns context).
-- ---------------------------------------------------------------------------

-- 4. start_correction_draft — phase correction/addendum; create/resume the successor.
create or replace function public.start_correction_draft(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text;
  v_status text; v_phase uuid; v_corrector uuid; v_draft uuid;
  v_predecessor uuid; v_fv uuid;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_phase_id,
         cr.permitted_corrector, cr.draft_response_id
    into v_case_id, v_commission, v_kind, v_status, v_phase, v_corrector, v_draft
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;
  if v_phase is null then
    raise exception 'esta solicitação não é de fase' using errcode = 'check_violation';
  end if;

  -- Authority: the designated corrector only.
  if auth.uid() is distinct from v_corrector then
    raise exception 'apenas o corretor designado pode iniciar o rascunho' using errcode = 'HC0M1';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  -- Idempotent resume: an existing draft is returned as-is.
  if v_status = 'in_progress' and v_draft is not null then
    return v_draft;
  end if;
  -- rejected → re-open the same (already in_progress) draft.
  if v_status = 'rejected' then
    perform set_config('app.in_correction_rpc', 'on', true);
    update public.case_correction_requests set status = 'in_progress' where id = p_request_id;
    perform set_config('app.in_correction_rpc', 'off', true);
    perform app.audit_write('case_correction.draft_started', 'case_correction_request',
      p_request_id, v_commission, 'Rascunho de correção retomado',
      jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase));
    return v_draft;
  end if;
  if v_status <> 'requested' then
    raise exception 'a solicitação não está no estado necessário para iniciar um rascunho'
      using errcode = 'check_violation';
  end if;

  -- Pin the predecessor = the phase's current revision; create the successor.
  select current_response_id, form_version_id into v_predecessor, v_fv
  from public.case_phases where id = v_phase;
  if v_predecessor is null then
    raise exception 'a fase não possui uma resposta atual para corrigir' using errcode = 'HC0M9';
  end if;

  -- The successor INSERT rides the guard_supersession_coherent corrector arm
  -- (open request with permitted_corrector = auth.uid()).
  insert into public.responses
    (form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
  select v_fv, v_commission, auth.uid(), 'in_progress', v_phase, v_predecessor
  returning id into v_draft;

  -- Copy the predecessor's answers + selections (supersede_response copy block).
  insert into public.answers
    (response_id, item_id, question_key, value, observation, other_text,
     group_instance_id, confidentiality_level)
  select v_draft, a.item_id, a.question_key, a.value, a.observation, a.other_text,
         a.group_instance_id, a.confidentiality_level
  from public.answers a where a.response_id = v_predecessor;

  insert into public.answer_selected_options (answer_id, option_id)
  select new_a.id, aso.option_id
  from public.answer_selected_options aso
  join public.answers old_a on old_a.id = aso.answer_id
  join public.answers new_a
    on new_a.response_id = v_draft
   and new_a.item_id = old_a.item_id
   and new_a.group_instance_id is not distinct from old_a.group_instance_id
  where old_a.response_id = v_predecessor;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests
    set predecessor_response_id = v_predecessor, draft_response_id = v_draft,
        status = 'in_progress'
    where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  perform app.audit_write('case_correction.draft_started', 'case_correction_request',
    p_request_id, v_commission, 'Rascunho de correção iniciado',
    jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase));

  return v_draft;
end;
$function$;

-- 5. save_correction_draft_body — narrative correction/addendum draft text.
create or replace function public.save_correction_draft_body(p_request_id uuid, p_body_md text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text;
  v_status text; v_narr uuid; v_corrector uuid;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_narrative_id,
         cr.permitted_corrector
    into v_case_id, v_commission, v_kind, v_status, v_narr, v_corrector
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;
  if v_narr is null then
    raise exception 'esta solicitação não é de narrativa' using errcode = 'check_violation';
  end if;

  if auth.uid() is distinct from v_corrector then
    raise exception 'apenas o corretor designado pode editar o rascunho' using errcode = 'HC0M1';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status not in ('requested', 'in_progress', 'rejected') then
    raise exception 'a solicitação não está no estado necessário para editar o rascunho'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests
    set draft_body_md = p_body_md, status = 'in_progress'
    where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  -- Body is PHI-bearing free text — NEVER audited (Rule 11).
  perform app.audit_write('case_correction.draft_started', 'case_correction_request',
    p_request_id, v_commission, 'Rascunho de narrativa salvo',
    jsonb_build_object('kind', v_kind, 'case_narrative_id', v_narr));
end;
$function$;

-- 6. resubmit_correction — mark the draft ready for review.
create or replace function public.resubmit_correction(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text;
  v_status text; v_phase uuid; v_narr uuid; v_corrector uuid;
  v_draft uuid; v_body text;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_phase_id,
         cr.case_narrative_id, cr.permitted_corrector, cr.draft_response_id, cr.draft_body_md
    into v_case_id, v_commission, v_kind, v_status, v_phase, v_narr, v_corrector, v_draft, v_body
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;

  if auth.uid() is distinct from v_corrector then
    raise exception 'apenas o corretor designado pode reenviar' using errcode = 'HC0M1';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'in_progress' then
    raise exception 'a solicitação não está no estado necessário para reenviar'
      using errcode = 'check_violation';
  end if;

  if v_phase is not null then
    -- Phase kinds: submit the successor through the real RPC (keeps required /
    -- bounds / signoff enforcement). sync early-returns (successor).
    if v_draft is null then
      raise exception 'inicie o rascunho antes de reenviar' using errcode = 'HC0M9';
    end if;
    perform public.submit_response(v_draft);
  else
    -- Narrative kinds: a non-blank draft body is required.
    if nullif(btrim(coalesce(v_body, '')), '') is null then
      raise exception 'escreva o texto da narrativa antes de reenviar' using errcode = 'HC0M3';
    end if;
  end if;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests set status = 'resubmitted' where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  perform app.audit_write('case_correction.resubmitted', 'case_correction_request',
    p_request_id, v_commission, 'Correção reenviada para revisão',
    jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase, 'case_narrative_id', v_narr));
end;
$function$;

-- 7. review_correction — coordinator moves it to under_review.
create or replace function public.review_correction(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_status text; v_kind text;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.status, cr.kind
    into v_case_id, v_commission, v_status, v_kind
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas administradores podem revisar correções' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  -- Void has no draft/resubmit step: it is reviewed directly from 'requested'.
  if (v_kind = 'void' and v_status <> 'requested')
     or (v_kind <> 'void' and v_status <> 'resubmitted') then
    raise exception 'a solicitação não está no estado necessário para revisão'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests set status = 'under_review' where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);
end;
$function$;

-- 8. approve_correction — apply the correction atomically.
create or replace function public.approve_correction(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text; v_status text;
  v_phase uuid; v_narr uuid; v_requested_by uuid; v_corrector uuid;
  v_draft uuid; v_body text;
  v_self boolean;
  v_draft_status text; v_draft_super uuid; v_cur uuid;
  v_position int; v_impact jsonb; v_old_body text; v_revnum int;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_phase_id,
         cr.case_narrative_id, cr.requested_by, cr.permitted_corrector,
         cr.draft_response_id, cr.draft_body_md
    into v_case_id, v_commission, v_kind, v_status, v_phase, v_narr,
         v_requested_by, v_corrector, v_draft, v_body
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas administradores podem aprovar correções' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  -- Void is decided directly from 'requested' (no draft/resubmit); other kinds
  -- require the corrector to have resubmitted.
  if (v_kind = 'void' and v_status not in ('requested', 'under_review'))
     or (v_kind <> 'void' and v_status not in ('resubmitted', 'under_review')) then
    raise exception 'a solicitação não está no estado necessário para aprovação'
      using errcode = 'check_violation';
  end if;

  v_self := auth.uid() in (v_requested_by, v_corrector);

  if v_phase is not null then
    -- ===== PHASE arms =====
    select cp.position, cp.current_response_id into v_position, v_cur
    from public.case_phases cp where cp.id = v_phase;

    if v_kind = 'void' then
      -- (b) phase void.
      perform set_config('app.in_case_rpc', 'on', true);
      update public.case_phases
        set status = 'voided', result_id = null, result_source = null,
            result_computed_at = null
        where id = v_phase;
      perform set_config('app.in_case_rpc', 'off', true);
      perform public.recompute_recommendations(v_case_id);
    else
      -- (a) phase correction / addendum: verify the submitted successor is the
      -- chain tip, stamp impact, re-point, recompute.
      select status, supersedes_id into v_draft_status, v_draft_super
      from public.responses where id = v_draft;
      if v_draft_status is distinct from 'submitted' or v_draft_super is distinct from v_cur then
        raise exception 'o rascunho da correção não está pronto para aprovação (a fase mudou)'
          using errcode = 'HC0M9';
      end if;

      select coalesce(jsonb_agg(jsonb_build_object(
                'id', cp2.id, 'position', cp2.position, 'title', cp2.title,
                'status', cp2.status, 'result_id', cp2.result_id) order by cp2.position), '[]'::jsonb)
        into v_impact
      from public.case_phases cp2
      where cp2.case_id = v_case_id and cp2.position > v_position
        and cp2.status in ('active', 'completed');

      perform set_config('app.in_case_rpc', 'on', true);
      update public.case_phases set current_response_id = v_draft where id = v_phase;
      perform set_config('app.in_case_rpc', 'off', true);

      begin
        perform app.compute_case_phase_result(v_phase);
      exception when others then
        if sqlstate = 'HC061' then
          raise exception 'defina o resultado da fase antes de aprovar' using errcode = 'HC061';
        end if;
        raise;
      end;
      perform public.recompute_recommendations(v_case_id);
    end if;
  else
    -- ===== NARRATIVE arms =====
    select coalesce(max(revision_number), 0) + 1 into v_revnum
    from public.case_narrative_revisions where case_narrative_id = v_narr;
    select body_md into v_old_body from public.case_narratives where id = v_narr;

    -- Snapshot the OLD body (append-only; requires app.in_correction_rpc).
    perform set_config('app.in_correction_rpc', 'on', true);
    insert into public.case_narrative_revisions
      (case_narrative_id, correction_request_id, revision_number, body_md, snapshotted_by)
    values (v_narr, p_request_id, v_revnum, coalesce(v_old_body, ''), auth.uid());
    perform set_config('app.in_correction_rpc', 'off', true);

    perform set_config('app.in_narrative_rpc', 'on', true);
    if v_kind = 'void' then
      -- (d) narrative void: keep concluded_at/by; status → voided.
      update public.case_narratives set status = 'voided', updated_by = auth.uid()
        where id = v_narr;
    else
      -- (c) narrative correction/addendum: swap body; concluded_at/by UNTOUCHED.
      update public.case_narratives set body_md = v_body, updated_by = auth.uid()
        where id = v_narr;
    end if;
    perform set_config('app.in_narrative_rpc', 'off', true);
  end if;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests
    set status = 'approved', self_approved = v_self, impact_snapshot = v_impact,
        resolved_by = auth.uid(), resolved_at = now()
    where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  perform app.audit_write('case_correction.approved', 'case_correction_request',
    p_request_id, v_commission,
    'Correção aprovada' || case when v_self then ' (autoaprovação)' else '' end,
    jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase,
      'case_narrative_id', v_narr, 'self_approved', v_self));
end;
$function$;

-- 9. reject_correction — send it back to the corrector for editing.
create or replace function public.reject_correction(p_request_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text; v_status text;
  v_phase uuid; v_narr uuid; v_draft uuid; v_reason text;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_phase_id,
         cr.case_narrative_id, cr.draft_response_id
    into v_case_id, v_commission, v_kind, v_status, v_phase, v_narr, v_draft
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'apenas administradores podem reprovar correções' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if (v_kind = 'void' and v_status not in ('requested', 'under_review'))
     or (v_kind <> 'void' and v_status not in ('resubmitted', 'under_review')) then
    raise exception 'a solicitação não está no estado necessário para reprovação'
      using errcode = 'check_violation';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'informe o motivo da reprovação' using errcode = 'HC0M6';
  end if;

  -- Phase kinds: flip the submitted successor back to an editable draft.
  if v_phase is not null and v_draft is not null then
    perform set_config('app.in_submit_rpc', 'on', true);
    update public.responses set status = 'in_progress', submitted_at = null where id = v_draft;
    perform set_config('app.in_submit_rpc', 'off', true);
  end if;

  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests
    set status = 'rejected', last_rejected_by = auth.uid(), last_rejected_at = now(),
        last_rejected_reason = v_reason
    where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  -- Free-text reject reason lives on the row (RLS-scoped), NEVER in the audit log (Rule 11).
  perform app.audit_write('case_correction.rejected', 'case_correction_request',
    p_request_id, v_commission, 'Correção reprovada',
    jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase, 'case_narrative_id', v_narr));
end;
$function$;

-- 10. withdraw_correction — terminate the request; delete an in_progress draft.
create or replace function public.withdraw_correction(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case_id uuid; v_commission uuid; v_case_status text; v_kind text; v_status text;
  v_phase uuid; v_narr uuid; v_requested_by uuid; v_corrector uuid; v_draft uuid;
begin
  perform app.assert_case_corrections_enabled();

  select cr.case_id, cr.commission_id, cr.kind, cr.status, cr.case_phase_id,
         cr.case_narrative_id, cr.requested_by, cr.permitted_corrector, cr.draft_response_id
    into v_case_id, v_commission, v_kind, v_status, v_phase, v_narr,
         v_requested_by, v_corrector, v_draft
  from public.case_correction_requests cr where cr.id = p_request_id;
  if v_case_id is null then
    raise exception 'solicitação de correção não encontrada' using errcode = 'no_data_found';
  end if;

  -- Authority: the requester, the corrector, or a coordinator.
  if not (auth.uid() in (v_requested_by, v_corrector)
          or app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode retirar esta solicitação' using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(v_case_id);
  if not app.is_active(auth.uid()) then
    raise exception 'sua conta está inativa ou suspensa' using errcode = 'HC0F4';
  end if;
  select status into v_case_status from public.cases where id = v_case_id;
  if v_case_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  -- A resubmitted request must be rejected before it can be withdrawn.
  if v_status not in ('requested', 'in_progress', 'rejected') then
    raise exception 'reprove a correção antes de retirá-la' using errcode = 'HC0M7';
  end if;

  -- Null the draft reference FIRST (the request FK points at it), then delete the
  -- in_progress draft (answers + selections cascade). The request row is kept as a
  -- withdrawn record.
  perform set_config('app.in_correction_rpc', 'on', true);
  update public.case_correction_requests
    set status = 'withdrawn', draft_response_id = null, resolved_by = auth.uid(),
        resolved_at = now()
    where id = p_request_id;
  perform set_config('app.in_correction_rpc', 'off', true);

  if v_draft is not null then
    delete from public.responses where id = v_draft and status = 'in_progress';
  end if;

  perform app.audit_write('case_correction.withdrawn', 'case_correction_request',
    p_request_id, v_commission, 'Solicitação de correção retirada',
    jsonb_build_object('kind', v_kind, 'case_phase_id', v_phase, 'case_narrative_id', v_narr));
end;
$function$;

-- ---------------------------------------------------------------------------
-- 11. Grants — the app RPCs are authenticated/service_role only; revoke the
--     default PUBLIC/anon EXECUTE (the anon-leak guard, 100_dashboard test 19).
-- ---------------------------------------------------------------------------
revoke all on function public.file_correction_request(text, uuid, uuid, text, text, uuid) from public;
revoke all on function public.start_correction_draft(uuid) from public;
revoke all on function public.save_correction_draft_body(uuid, text) from public;
revoke all on function public.resubmit_correction(uuid) from public;
revoke all on function public.review_correction(uuid) from public;
revoke all on function public.approve_correction(uuid, text) from public;
revoke all on function public.reject_correction(uuid, text) from public;
revoke all on function public.withdraw_correction(uuid) from public;

grant execute on function public.file_correction_request(text, uuid, uuid, text, text, uuid) to authenticated, service_role;
grant execute on function public.start_correction_draft(uuid) to authenticated, service_role;
grant execute on function public.save_correction_draft_body(uuid, text) to authenticated, service_role;
grant execute on function public.resubmit_correction(uuid) to authenticated, service_role;
grant execute on function public.review_correction(uuid) to authenticated, service_role;
grant execute on function public.approve_correction(uuid, text) to authenticated, service_role;
grant execute on function public.reject_correction(uuid, text) to authenticated, service_role;
grant execute on function public.withdraw_correction(uuid) to authenticated, service_role;
