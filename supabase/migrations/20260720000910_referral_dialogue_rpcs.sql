-- =============================================================================
-- Referrals v2 (RV2) · R1 — Dialogue RPCs + door / close-gate / disposal updates.
-- =============================================================================
-- The three DEFINER command RPCs (post/request/provide), the extended audited door
-- get_referral_detail, the close_case gate correction, and the dispose_referral_phi
-- compose. ADR 0037 Amendment 1; plan §3 R1. All new public.* RPCs: REVOKE ALL FROM
-- PUBLIC then GRANT authenticated, service_role (t19). Mutation audit for a new
-- message rides app.audit_write('referral.message_created', …) — a Rule-11 mutation
-- event in the hash chain (mirrors trg_audit_referral), NOT the log_audit_access
-- read door; message BODY reads keep riding the existing referral.viewed. SQLSTATE:
-- HC0A0 = message shape/entitlement, HC0A1 = request/provide wrong-status.
--
-- 🔴 CLOSE-GATE CORRECTION (ADR 0037 / live-gate fix). The LIVE close_case referral
-- gate is an INCLUSION list `status in ('sent','received','accepted','in_review')`
-- (not a NOT-IN exclusion), so awaiting_information — an active, non-terminal state
-- — would NOT block a case close. This reproduces the live English body verbatim
-- and adds 'awaiting_information' to that inclusion list.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. post_referral_message — a free-form thread message ("Comentar"). Entitlement
--    = a PHI reader who resolves to the source OR target side (HC0A0); postable
--    while the referral is in flight and non-terminal.
-- -----------------------------------------------------------------------------
create or replace function public.post_referral_message(
  p_referral_id uuid,
  p_message_type text default 'general',
  p_body text default null
) returns public.referral_messages
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_sender uuid;
  v_seq integer;
  v_result public.referral_messages;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if not app.can_read_referral_phi(p_referral_id, v_uid) then
    raise exception 'você não pode enviar mensagens neste encaminhamento' using errcode = 'HC0A0';
  end if;

  -- Resolve the sender side (source coord | target coord/analyst). A pure QPS
  -- reader cannot resolve to a side and thus cannot post.
  if app.is_staff_admin_of(v_ref.source_commission_id) then
    v_sender := v_ref.source_commission_id;
  elsif app.is_staff_admin_of(v_ref.target_commission_id)
        or app.referral_target_analyst(p_referral_id, v_uid) then
    v_sender := v_ref.target_commission_id;
  else
    raise exception 'apenas coordenadores ou o analista do destino podem enviar mensagens'
      using errcode = 'HC0A0';
  end if;

  if p_message_type is null or p_message_type not in
       ('general', 'information_request', 'information_response', 'clarification') then
    raise exception 'tipo de mensagem inválido' using errcode = 'HC0A0';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'a mensagem não pode estar vazia' using errcode = 'HC0A0';
  end if;
  if v_ref.status not in ('sent', 'received', 'accepted', 'in_review', 'awaiting_information') then
    raise exception 'não é possível enviar mensagens neste estado do encaminhamento'
      using errcode = 'HC0A0';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_sender, v_uid, p_message_type, btrim(p_body))
  returning * into v_result;
  update public.case_referral set last_message_at = now(), updated_at = now()
  where id = p_referral_id;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Mensagem nº ' || v_seq || ' no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_result.id, 'sequence_number', v_seq,
                       'message_type', p_message_type, 'sender_commission_id', v_sender));

  return v_result;
end;
$$;
alter function public.post_referral_message(uuid, text, text) owner to postgres;
revoke all on function public.post_referral_message(uuid, text, text) from public;
grant execute on function public.post_referral_message(uuid, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. request_referral_information — target coordinator/analyst asks the source a
--    clarifying question: posts an information_request, → awaiting_information,
--    waiting_on = source. HC0A0 entitlement/shape; HC0A1 wrong status (in_review).
-- -----------------------------------------------------------------------------
create or replace function public.request_referral_information(
  p_referral_id uuid,
  p_body text
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_seq integer;
  v_msg_id uuid;
  v_result public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if not (app.is_staff_admin_of(v_ref.target_commission_id)
          or app.referral_target_analyst(p_referral_id, v_uid)) then
    raise exception 'apenas a comissão de destino pode solicitar informações' using errcode = 'HC0A0';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'descreva a informação solicitada' using errcode = 'HC0A0';
  end if;
  if v_ref.status <> 'in_review' then
    raise exception 'só é possível solicitar informações durante a análise' using errcode = 'HC0A1';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_ref.target_commission_id, v_uid, 'information_request', btrim(p_body))
  returning id into v_msg_id;

  update public.case_referral
  set status = 'awaiting_information',
      waiting_on_committee_id = source_commission_id,
      last_message_at = now(), updated_at = now()
  where id = p_referral_id
  returning * into v_result;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Solicitação de informação (msg nº ' || v_seq || ') no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg_id, 'sequence_number', v_seq,
                       'message_type', 'information_request', 'sender_commission_id', v_ref.target_commission_id));

  return v_result;
end;
$$;
alter function public.request_referral_information(uuid, text) owner to postgres;
revoke all on function public.request_referral_information(uuid, text) from public;
grant execute on function public.request_referral_information(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. provide_referral_information — source coordinator answers: posts an
--    information_response, waiting_on = target, → in_review (resumes analysis).
--    HC0A0 entitlement/shape; HC0A1 wrong status (awaiting_information).
-- -----------------------------------------------------------------------------
create or replace function public.provide_referral_information(
  p_referral_id uuid,
  p_body text
) returns public.case_referral
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_ref public.case_referral;
  v_uid uuid := auth.uid();
  v_seq integer;
  v_msg_id uuid;
  v_result public.case_referral;
begin
  perform app.assert_referrals_enabled();

  select * into v_ref from public.case_referral where id = p_referral_id for update;
  if v_ref.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_ref.source_commission_id) then
    raise exception 'apenas a comissão de origem pode responder à solicitação' using errcode = 'HC0A0';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'informe a resposta à solicitação' using errcode = 'HC0A0';
  end if;
  if v_ref.status <> 'awaiting_information' then
    raise exception 'não há solicitação de informação pendente neste encaminhamento' using errcode = 'HC0A1';
  end if;

  perform set_config('app.in_referral_rpc', 'on', true);
  select coalesce(max(sequence_number), 0) + 1 into v_seq
  from public.referral_messages where referral_id = p_referral_id;
  insert into public.referral_messages
    (referral_id, sequence_number, sender_commission_id, sender_user_id, message_type, body)
  values (p_referral_id, v_seq, v_ref.source_commission_id, v_uid, 'information_response', btrim(p_body))
  returning id into v_msg_id;

  update public.case_referral
  set status = 'in_review',
      waiting_on_committee_id = target_commission_id,
      last_message_at = now(), updated_at = now()
  where id = p_referral_id
  returning * into v_result;
  perform set_config('app.in_referral_rpc', 'off', true);

  perform app.audit_write('referral.message_created', 'referral', p_referral_id,
    v_ref.source_commission_id,
    'Resposta à solicitação (msg nº ' || v_seq || ') no encaminhamento ' || coalesce(v_ref.code, ''),
    jsonb_build_object('message_id', v_msg_id, 'sequence_number', v_seq,
                       'message_type', 'information_response', 'sender_commission_id', v_ref.source_commission_id));

  return v_result;
end;
$$;
alter function public.provide_referral_information(uuid, text) owner to postgres;
revoke all on function public.provide_referral_information(uuid, text) from public;
grant execute on function public.provide_referral_information(uuid, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. get_referral_detail — LIVE body reproduced verbatim + the R1 additions:
--    the ordered `messages` thread (body gated by v_can_phi; bodies ride the
--    existing referral.viewed audit) + waiting_on_committee_id + last_message_at.
-- -----------------------------------------------------------------------------
create or replace function public.get_referral_detail(p_referral_id uuid)
    returns jsonb
    language plpgsql security definer
    set search_path to 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_is_source_coord boolean;
  v_can_phi boolean;
  v_result jsonb;
begin
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  v_is_source_coord := app.is_staff_admin_of(v_referral.source_commission_id);
  v_can_phi := app.can_read_referral_phi(p_referral_id, auth.uid());

  -- AUDIT (Rule 11/12): one referral.viewed for an entitled non-originator PHI read
  -- (covers message bodies too — they ride this same event).
  if v_can_phi and not v_is_source_coord then
    perform public.log_audit_access(
      'referral.viewed', 'referral', p_referral_id, v_referral.source_commission_id,
      'Conteúdo do encaminhamento ' || coalesce(v_referral.code, '') || ' visualizado', '{}'::jsonb);
  end if;

  select jsonb_build_object(
    'id', v_referral.id,
    'code', v_referral.code,
    'status', v_referral.status,
    'subject', v_referral.subject,
    'description_md', case when v_can_phi then v_referral.description_md else null end,
    'referral_type_id', v_referral.referral_type_id,
    'type_label', v_referral.type_label,
    'response_expected', v_referral.response_expected,
    'source_commission_id', v_referral.source_commission_id,
    'source_commission_name', (select name from public.commissions where id = v_referral.source_commission_id),
    'target_commission_id', v_referral.target_commission_id,
    'target_commission_name', (select name from public.commissions where id = v_referral.target_commission_id),
    'source_case_id', v_referral.source_case_id,
    'source_case_number', (select case_number from public.cases where id = v_referral.source_case_id),
    'target_case_id', v_referral.target_case_id,
    'target_case_number', (select case_number from public.cases where id = v_referral.target_case_id),
    'has_patient', v_referral.has_patient,
    'created_by', v_referral.created_by,
    'created_by_name', (select full_name from public.profiles where id = v_referral.created_by),
    'decline_note', case when v_can_phi then v_referral.decline_note else null end,
    -- RV2 R1: the waiting state + inbox cache (PHI-free metadata).
    'waiting_on_committee_id', v_referral.waiting_on_committee_id,
    'last_message_at', v_referral.last_message_at,
    'shared_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'referral_id', s.referral_id,
        'kind', s.kind,
        'source_narrative_id', s.source_narrative_id,
        'source_document_id', s.source_document_id,
        'frozen_title', s.frozen_title,
        'frozen_body_md', case when v_can_phi then s.frozen_body_md else null end,
        'frozen_storage_path', case when v_can_phi then s.frozen_storage_path else null end,
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R1: the ordered message thread. Metadata always; body ONLY for a PHI
    -- reader (nulled for a metadata-only reader). Bodies ride the referral.viewed
    -- audit fired above.
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'referral_id', m.referral_id,
        'sequence_number', m.sequence_number,
        'sender_commission_id', m.sender_commission_id,
        'sender_commission_name', (select name from public.commissions where id = m.sender_commission_id),
        'sender_user_id', m.sender_user_id,
        'sender_user_name', (select full_name from public.profiles where id = m.sender_user_id),
        'message_type', m.message_type,
        'body', case when v_can_phi then m.body else null end,
        'created_at', m.created_at
      ) order by m.sequence_number)
      from public.referral_messages m where m.referral_id = p_referral_id
    ), '[]'::jsonb),
    'reply', (
      select case when r.referral_id is null then null else jsonb_build_object(
        'referral_id', r.referral_id,
        'reply_outcome_id', r.reply_outcome_id,
        'outcome_label', r.outcome_label,
        'result_md', case when v_can_phi then r.result_md else null end,
        'acknowledged_only', r.acknowledged_only,
        'replied_by', r.replied_by,
        'replied_by_name', (select full_name from public.profiles where id = r.replied_by),
        'replied_at', r.replied_at,
        'attachments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id, 'referral_id', a.referral_id, 'title', a.title,
            'storage_path', a.storage_path, 'mime_type', a.mime_type,
            'size_bytes', a.size_bytes, 'uploaded_by', a.uploaded_by,
            'uploaded_by_name', (select full_name from public.profiles where id = a.uploaded_by),
            'created_at', a.created_at
          ) order by a.created_at)
          from public.referral_reply_attachment a where a.referral_id = p_referral_id
        ), '[]'::jsonb)
      ) end
      from public.referral_reply r where r.referral_id = p_referral_id
    ),
    'sent_at', v_referral.sent_at,
    'received_at', v_referral.received_at,
    'decided_at', v_referral.decided_at,
    'concluded_at', v_referral.concluded_at,
    'withdrawn_at', v_referral.withdrawn_at,
    'created_at', v_referral.created_at,
    'updated_at', v_referral.updated_at
  ) into v_result;

  return v_result;
end;
$$;
alter function public.get_referral_detail(uuid) owner to postgres;
revoke all on function public.get_referral_detail(uuid) from public;
grant execute on function public.get_referral_detail(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. close_case — 🔴 gate correction. LIVE English body reproduced verbatim; the
--    ONLY edit is adding 'awaiting_information' to the referral inclusion list so an
--    active waiting referral blocks the close (ADR 0037 / live-gate fix).
-- -----------------------------------------------------------------------------
create or replace function public.close_case(p_case_id uuid)
    returns public.cases
    language plpgsql
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_status text;
  v_outcome_id uuid;
  v_unsettled integer;
  v_offered integer;
  v_commission uuid;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  v_commission := app.commission_of_case(p_case_id);
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  select status, outcome_id into v_status, v_outcome_id
  from public.cases where id = p_case_id;
  if v_status in ('completed', 'cancelled') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  select count(*) into v_unsettled
  from public.case_phases
  where case_id = p_case_id and status in ('pending', 'active');
  if v_unsettled > 0 then
    raise exception 'conclua ou marque todas as fases antes de concluir o caso'
      using errcode = 'HC031';
  end if;

  select count(*) into v_offered
  from public.case_offered_outcomes where case_id = p_case_id;
  if v_offered > 0 and v_outcome_id is null then
    raise exception 'selecione um desfecho antes de concluir o caso'
      using errcode = 'HC028';
  end if;

  if app.feature_enabled('case_referrals') and exists (
    select 1 from public.case_referral r
    where r.source_case_id = p_case_id and r.response_expected = true
      and r.status in ('sent', 'received', 'accepted', 'in_review', 'awaiting_information')
  ) then
    raise exception 'há encaminhamentos aguardando resposta; conclua, recuse ou retire antes de encerrar o caso'
      using errcode = 'HC076';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  update public.cases
  set status = 'completed', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'not_required', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pending', 'active');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.close_case(uuid) owner to postgres;
revoke all on function public.close_case(uuid) from public;
grant execute on function public.close_case(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. dispose_referral_phi — LIVE body reproduced verbatim + the R1 compose: redact
--    referral_messages.body (NOT NULL → the '[PHI removido]' marker, like subject /
--    frozen_title).
-- -----------------------------------------------------------------------------
create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
    returns void
    language plpgsql security definer
    set search_path to 'app', 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_referrals_enabled();

  if not (app.is_admin()
          or app.is_commission_admin_of((select source_commission_id from public.case_referral where id = p_referral_id))
          or app.is_pqs_operator_of(app.hospital_of_commission((select source_commission_id from public.case_referral where id = p_referral_id)))
          or app.is_pqs_operator_of(app.hospital_of_commission((select target_commission_id from public.case_referral where id = p_referral_id)))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;
  if v_referral.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste encaminhamento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.in_referral_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.referral_patient where referral_id = p_referral_id;

  update public.case_referral
     set subject = v_redacted, description_md = null, decline_note = null
   where id = p_referral_id;
  update public.referral_reply set result_md = null where referral_id = p_referral_id;
  update public.referral_shared_item
     set frozen_title = v_redacted,
         frozen_body_md = case when frozen_body_md is not null then v_redacted else frozen_body_md end
   where referral_id = p_referral_id;
  update public.referral_reply_attachment set title = v_redacted where referral_id = p_referral_id;
  -- RV2 R1: message bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_messages set body = v_redacted where referral_id = p_referral_id;

  update public.case_referral
     set has_patient = false, phi_disposed_at = now(), phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason, updated_at = now()
   where id = p_referral_id;

  perform app.audit_write(
    'referral_patient.disposed', 'referral_patient', p_referral_id, v_referral.source_commission_id,
    'Dados do paciente do encaminhamento ' || v_referral.code || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_safety_rpc', 'off', true);
  perform set_config('app.in_referral_rpc', 'off', true);
end;
$$;
alter function public.dispose_referral_phi(uuid, text) owner to postgres;
revoke all on function public.dispose_referral_phi(uuid, text) from public;
grant execute on function public.dispose_referral_phi(uuid, text) to authenticated, service_role;
