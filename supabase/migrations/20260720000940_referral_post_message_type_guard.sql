-- =============================================================================
-- Referrals v2 (RV2) · R1 hardening — QA M-1: post_referral_message type guard.
-- =============================================================================
-- `information_request` / `information_response` are STATE-DRIVING message types:
-- they must be minted ONLY by request_referral_information / provide_referral_
-- information, which also flip status + waiting_on. A direct `post_referral_message`
-- caller could otherwise label a message with one of them WITHOUT driving the state
-- machine (inert today — the composer only sends `general` — but a data-integrity
-- gap). This reproduces the current body verbatim + one guard rejecting the two
-- state types (HC0A0); `post` now effectively accepts only {general, clarification}.
--
-- The referral_messages.message_type column CHECK stays UNCHANGED — all four types
-- remain valid rows (request/provide legitimately insert the two state types).
-- =============================================================================

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
  -- QA M-1: the state-driving types are produced ONLY by Solicitar informação /
  -- Responder (which also flip status + waiting_on). A free-form post may not label
  -- itself with them.
  if p_message_type in ('information_request', 'information_response') then
    raise exception 'use Solicitar informação ou Responder para este tipo de mensagem'
      using errcode = 'HC0A0';
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
