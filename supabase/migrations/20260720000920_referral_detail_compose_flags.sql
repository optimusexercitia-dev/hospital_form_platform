-- =============================================================================
-- Referrals v2 (RV2) · R1 fast-follow — compose-authority flags on the door.
-- =============================================================================
-- The R1 composer is authorized by the SAME predicates the command RPCs use, which
-- include the target ANALYST arm (post/request authorize
-- app.referral_target_analyst, not just the target coordinator). So the UI must gate
-- on that exact authority, not the staff_admin-scoped can_manage_* flags — else a
-- PHI-cleared, RPC-authorized target analyst can't see the composer.
--
-- get_referral_detail (DEFINER, can_read_referral broad gate) now returns two
-- PHI-FREE booleans computed for the CALLER with the exact R1 RPC authority:
--   can_compose_as_source = is_staff_admin_of(source)            (matches provide_referral_information;
--                                                                 source has no analyst concept)
--   can_compose_as_target = is_staff_admin_of(target)
--                           OR referral_target_analyst(referral) (matches post/request target arm)
-- Metadata only — safe for any can_read_referral reader. Body reproduced verbatim
-- from 20260720000910 with ONLY the two output fields added.
-- =============================================================================

create or replace function public.get_referral_detail(p_referral_id uuid)
    returns jsonb
    language plpgsql security definer
    set search_path to 'public', 'pg_catalog'
    as $$
declare
  v_referral public.case_referral;
  v_is_source_coord boolean;
  v_can_phi boolean;
  v_can_compose_target boolean;
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
  -- RV2 R1: compose authority = the EXACT R1 RPC gates (PHI-free). Source has no
  -- analyst concept (provide/source-comment are staff_admin-only); target adds the
  -- referral_target_analyst arm (post/request).
  v_can_compose_target := app.is_staff_admin_of(v_referral.target_commission_id)
                          or app.referral_target_analyst(p_referral_id, auth.uid());

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
    -- RV2 R1 fast-follow: compose authority for THIS caller (PHI-free).
    'can_compose_as_source', v_is_source_coord,
    'can_compose_as_target', v_can_compose_target,
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
