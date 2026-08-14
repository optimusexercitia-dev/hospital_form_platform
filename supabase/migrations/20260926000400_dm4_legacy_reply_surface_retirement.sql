-- =============================================================================
-- DM4 M4 — legacy referral attachment surface retirement + the projection
-- rewrites (ADR 0119 D5/D6/D7; empties the DM1 allowlist to ZERO exceptions).
--
-- Own migration because: this is the destructive cutover, reviewed as a unit.
-- The drop set was enumerated FROM THE CATALOG (inbound FKs: zero;
-- comment-stripped prosrc sweep; pg_policies quals; repo-wide TS identifier
-- sweep — 21 refs/7 files, dispositioned in the phase record), never by name.
--
-- ⚠ KNOWN, INTENDED FUTURE-PUSH FAILURE MODE: the reply-table drop below
-- RAISES if any row exists. This migration passes every local reset (0 rows)
-- and is MEANT to hard-fail a `db push` against a database holding rows —
-- rows there can only mean a writer this phase never modeled (the RPC was
-- always reachable by a direct PostgREST caller), and destroying unmodeled
-- data silently is the worse failure. Whoever runs the push meets this as a
-- documented decision: disposition path is FUP-DM4-PRODROW.
-- =============================================================================

-- a. The row-guard FIRST, then the four legacy doors, then the table —
--    add_referral_reply_attachment RETURNS the table's composite type, so the
--    functions must go before the DROP TABLE (2BP01 otherwise).
do $$
begin
  if exists (select 1 from public.referral_reply_attachment) then
    raise exception
      'DM4 M4: referral_reply_attachment holds rows this phase never modeled — stop and reconcile (FUP-DM4-PRODROW)';
  end if;
end $$;

-- b. The three legacy storage policies (K2a/f/g) — BEFORE their predicate
--    (case_documents_select_member depends on can_read_snapshot_document).
--    The buckets themselves stay for DM5's single retirement manifest —
--    policy-less and unreachable.
drop policy case_documents_select_member on storage.objects;
drop policy referral_attachments_obj_insert on storage.objects;
drop policy referral_attachments_obj_select on storage.objects;

-- c. The four legacy doors (K2b/c/d + the read seam's RPC — all replaced by
--    the document-model corridor + open_referral_snapshot_document).
drop function public.add_referral_reply_attachment(uuid, text, text, text, bigint);
drop function public.get_referral_attachment_path(uuid);
drop function public.get_referral_snapshot_document_path(uuid);
drop function app.can_read_snapshot_document(text, uuid);

-- (a, continued) The legacy reply table (cascades its SELECT policy).
drop table public.referral_reply_attachment;

-- d. The dead column (ADR 0119 D7: no legacy world can exist under reset;
--    M3 already tombstoned any legacy rows and the CHECK no longer admits a
--    path-only shape). Its partial index drops with it.
alter table public.referral_shared_item drop column frozen_storage_path;

-- e. dispose_referral_phi — ONE rewrite (ADR 0119 D5): the dropped-table
--    redaction goes; document-kind snapshots are TOMBSTONED (their binding is
--    severed — the SOURCE case document is never disposed from here, its
--    bytes are case A's record); referral-homed reply documents are redacted
--    and routed into the D10 disposal lane.
create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_referral public.case_referral;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_referrals_enabled();

  if not (app.is_tenancy_admin_of((select source_commission_id from public.case_referral where id = p_referral_id))
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
  -- Redact copies; then TOMBSTONE document bindings (ADR 0119 D5 — erasure
  -- severs B's read corridor; the tombstoned row remains as the governance
  -- record that a disclosure happened).
  update public.referral_shared_item
     set frozen_title = v_redacted,
         frozen_body_md = case when frozen_body_md is not null then v_redacted else frozen_body_md end
   where referral_id = p_referral_id;
  update public.referral_shared_item
     set frozen_document_version_id = null,
         frozen_tombstoned_at = coalesce(frozen_tombstoned_at, now()),
         frozen_tombstone_reason = coalesce(frozen_tombstone_reason, 'phi_disposed')
   where referral_id = p_referral_id and kind = 'document';
  -- Referral-homed reply documents: redact the label surface and enter the
  -- D10 lane (reads fail closed immediately; the disposal job destroys bytes).
  -- Blocked by an active legal hold (HC0D3) BY DESIGN — D10's rule.
  update public.documents d
     set title = v_redacted, description = null,
         status = 'disposal_pending'
   where d.home_resource_id = p_referral_id
     and d.status in ('active', 'soft_deleted');
  update public.file_objects f
     set disposal_state = 'disposal_pending'
    from public.document_version_files vf
    join public.document_versions dv on dv.id = vf.document_version_id
    join public.documents d on d.id = dv.document_id
   where f.id = vf.file_object_id
     and d.home_resource_id = p_referral_id
     and f.disposal_state = 'none';
  -- RV2 R1: message bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_messages set body = v_redacted where referral_id = p_referral_id;
  -- RV2 R3: the resolution narrative is PHI — purge it.
  update public.referral_resolutions set summary_md = null where referral_id = p_referral_id;
  -- RV2 R5: internal-note bodies are PHI (NOT NULL → redact to the marker).
  update public.referral_internal_notes set body_md = v_redacted where referral_id = p_referral_id;

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

-- f1. The reply-documents projection, factored ONCE (used by get_referral_detail
--     and the standalone list door — duplication would drift). can_open is the
--     door-equivalent affordance (ADR 0119 / the canOpen lane-consistency
--     ruling): PHI tier AND servable, never a client-side derivation.
create function app._referral_reply_documents(p_referral_id uuid, p_can_phi boolean)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'document_id', d.id,
    'document_version_id', dv.id,
    'title', d.title,
    'mime_type', f.mime_type,
    'size_bytes', f.size_bytes,
    'availability', case
        when d.status in ('disposal_pending', 'disposed')
             or coalesce(f.disposal_state, 'none') <> 'none' then 'disposed'
        when d.status <> 'active' then 'unavailable'
        when f.id is null then 'pending'
        when f.upload_state in ('clean', 'unscanned_accepted') then 'available'
        when f.upload_state in ('failed', 'rejected', 'infected', 'abandoned') then 'failed'
        else 'pending' end,
    'can_open', p_can_phi and d.status = 'active' and f.id is not null
        and f.disposal_state = 'none' and f.upload_state in ('clean', 'unscanned_accepted'),
    'uploaded_by', d.created_by,
    'uploaded_by_name', (select p.full_name from public.profiles p where p.id = d.created_by),
    'created_at', d.created_at
  ) order by d.created_at desc), '[]'::jsonb)
  from public.documents d
  left join lateral (
    select dv2.* from public.document_versions dv2
     where dv2.document_id = d.id
     order by dv2.version_number desc limit 1) dv on true
  left join lateral (
    select f2.* from public.document_version_files vf
      join public.file_objects f2 on f2.id = vf.file_object_id
     where vf.document_version_id = dv.id and vf.rendition_kind = 'source'
     order by vf.created_at desc limit 1) f on true
  where d.home_resource_id = p_referral_id
$$;
revoke all on function app._referral_reply_documents(uuid, boolean) from public;

-- f2. The standalone list door (the composer dialog's read while the reply
--     row does not exist yet). Metadata-gated; denial ≡ empty (oracle-kill).
create function public.list_referral_reply_documents(p_referral_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_referrals_enabled();
  if not app.can_read_referral_metadata(p_referral_id, auth.uid()) then
    return '[]'::jsonb;
  end if;
  return app._referral_reply_documents(
    p_referral_id, app.can_read_referral_phi(p_referral_id, auth.uid()));
end;
$$;
revoke all on function public.list_referral_reply_documents(uuid) from public, anon;
grant execute on function public.list_referral_reply_documents(uuid) to authenticated, service_role;

-- f3. get_referral_detail — the projection successor (197 §4 re-expression,
--     lead-approved): the byte handle's successor field is PHI-gated exactly
--     as frozen_storage_path was; frozen_tombstoned_at is deliberately
--     metadata-visible governance state; can_open is the server-computed
--     affordance twin. The reply lane carries reply_documents.
create or replace function public.get_referral_detail(p_referral_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
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
  -- RV2 R1 fast-follow: compose authority = the EXACT R1 RPC gates (PHI-free).
  -- ADR 0094 W4: the DT of the target hospital composes on the target side.
  v_can_compose_target := (v_referral.target_type = 'commission'
                           and (app.is_staff_admin_of(v_referral.target_commission_id)
                                or app.referral_target_analyst(p_referral_id, auth.uid())))
                          or (v_referral.target_type = 'technical_director'
                              and app.is_technical_director_of_for(
                                    v_referral.target_hospital_id, auth.uid()));

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
    -- RV2 R2: PHI-FREE triage/SLA metadata (visible to every metadata-tier reader).
    'priority', v_referral.priority,
    'requested_action_id', v_referral.requested_action_id,
    'requested_action_label', v_referral.requested_action_label,
    'response_due_at', v_referral.response_due_at,
    'decline_reason_code', v_referral.decline_reason_code,
    -- RV2 R3: PHI-FREE lineage pointer (QPS chain view).
    'parent_referral_id', v_referral.parent_referral_id,
    'source_commission_id', v_referral.source_commission_id,
    'source_commission_name', (select name from public.commissions where id = v_referral.source_commission_id),
    'target_commission_id', v_referral.target_commission_id,
    'target_commission_name', (select name from public.commissions where id = v_referral.target_commission_id),
    -- ADR 0094 W4/D5+D7: the target sum type. The DISPLAY string
    -- (`Direção Técnica — <hospital>`) is composed in src/lib/queries/referrals.ts —
    -- pt-BR presentation does not belong in the database.
    'target_type', v_referral.target_type,
    'target_hospital_id', v_referral.target_hospital_id,
    'target_hospital_name', v_referral.target_hospital_name,
    'source_case_id', v_referral.source_case_id,
    'source_case_number', (select case_number from public.cases where id = v_referral.source_case_id),
    'target_case_id', v_referral.target_case_id,
    'target_case_number', (select case_number from public.cases where id = v_referral.target_case_id),
    'has_patient', v_referral.has_patient,
    'created_by', v_referral.created_by,
    'created_by_name', (select full_name from public.profiles where id = v_referral.created_by),
    -- PHI free-text decline note stays PHI-gated (distinct from decline_reason_code).
    'decline_note', case when v_can_phi then v_referral.decline_note else null end,
    'waiting_on_committee_id', v_referral.waiting_on_committee_id,
    -- ADR 0094 W4/D9: the DT-side waiting party. Without it, "the DT is holding this"
    -- is indistinguishable from "nobody is waiting".
    'waiting_on_hospital_id', v_referral.waiting_on_hospital_id,
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
        -- DM4 (197 §4 re-expression): the byte handle's SUCCESSOR is
        -- PHI-gated exactly as the retired path column was — the door
        -- re-gates anyway (defense in depth), and a metadata reader gets no
        -- open affordance. (The retired identifiers are deliberately not
        -- spelled here: 340 D5 sweeps this body for them.)
        'frozen_document_version_id', case when v_can_phi then s.frozen_document_version_id else null end,
        -- Deliberately metadata-visible: governance state, no PHI.
        'frozen_tombstoned_at', s.frozen_tombstoned_at,
        -- The server-computed affordance (canOpen ruling): the door would
        -- serve THIS item to THIS caller. Includes the file-state checks the
        -- door makes; soft_deleted still serves (ADR 0119 D5).
        'can_open', (v_can_phi and s.kind = 'document'
          and s.frozen_document_version_id is not null
          and s.frozen_tombstoned_at is null
          and exists (
            select 1
              from public.document_versions dv
              join public.documents d on d.id = dv.document_id
              join public.document_version_files vf
                on vf.document_version_id = dv.id and vf.rendition_kind = 'source'
              join public.file_objects f on f.id = vf.file_object_id
             where dv.id = s.frozen_document_version_id
               and d.status not in ('disposal_pending', 'disposed')
               and f.disposal_state = 'none'
               and f.upload_state in ('clean', 'unscanned_accepted'))),
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
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
        -- RV2 R5: a redacted message renders [redigido] to EVERYONE (append-only,
        -- audited who/why); otherwise PHI-gated. Distinct from disposal's purge.
        'body', case when m.redacted_at is not null then '[redigido]'
                     when v_can_phi then m.body else null end,
        'redacted_at', m.redacted_at,
        'created_at', m.created_at
      ) order by m.sequence_number)
      from public.referral_messages m where m.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R3: the resolution history. Non-PHI columns project to every metadata-tier
    -- reader; summary_md is served ONLY to a PHI reader (v_can_phi).
    'resolutions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rr.id,
        'referral_id', rr.referral_id,
        'resolution_number', rr.resolution_number,
        'resolved_by_commission_id', rr.resolved_by_commission_id,
        'resolved_by_user_id', rr.resolved_by_user_id,
        'resolved_by_name', (select full_name from public.profiles where id = rr.resolved_by_user_id),
        'summary_md', case when v_can_phi then rr.summary_md else null end,
        'follow_up_required', rr.follow_up_required,
        'final_reply_id', rr.final_reply_id,
        'resolved_at', rr.resolved_at,
        'reopened_at', rr.reopened_at,
        'reopened_by', rr.reopened_by,
        'reopened_reason', rr.reopened_reason
      ) order by rr.resolution_number)
      from public.referral_resolutions rr where rr.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R4: WHO is responsible (PHI-free). Visible to every metadata-tier reader;
    -- an assignment row grants NO access (K-R4-1) — it is a task pointer only.
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'referral_id', a.referral_id,
        'commission_id', a.commission_id,
        'assignee_user_id', a.assignee_user_id,
        'assignee_name', (select full_name from public.profiles where id = a.assignee_user_id),
        'assignment_role', a.assignment_role,
        'status', a.status,
        'due_at', a.due_at,
        'assigned_by', a.assigned_by,
        'assigned_by_name', (select full_name from public.profiles where id = a.assigned_by),
        'assigned_at', a.assigned_at,
        'completed_at', a.completed_at,
        'cancelled_at', a.cancelled_at
      ) order by a.assigned_at)
      from public.referral_assignments a where a.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R4: TYPED related-case pointers (PHI-free). A pointer ONLY — it grants NO
    -- access to the linked case (K-R4-2).
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'referral_id', l.referral_id,
        'case_id', l.case_id,
        'case_number', (select case_number from public.cases where id = l.case_id),
        'commission_id', l.commission_id,
        'relationship_type', l.relationship_type,
        'created_by', l.created_by,
        'created_by_name', (select full_name from public.profiles where id = l.created_by),
        'created_at', l.created_at
      ) order by l.created_at)
      from public.referral_case_links l where l.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- RV2 R5: PHI-FREE read receipts (delivery/read/ack per message + user), visible
    -- to every metadata-tier reader. Internal notes are NOT projected here — they are
    -- side-private and served only via list_referral_internal_notes (K-R5-1).
    'read_receipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'message_id', rc.message_id,
        'user_id', rc.user_id,
        'user_name', (select full_name from public.profiles where id = rc.user_id),
        'delivered_at', rc.delivered_at,
        'read_at', rc.read_at,
        'acknowledged_at', rc.acknowledged_at
      ) order by rc.message_id, rc.user_id)
      from public.referral_read_receipts rc
      join public.referral_messages m2 on m2.id = rc.message_id
      where m2.referral_id = p_referral_id
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
        -- DM4 (PO ruling R1): the reply lane on the document model. The
        -- composer's pre-conclusion list is list_referral_reply_documents.
        'reply_documents', app._referral_reply_documents(p_referral_id, v_can_phi)
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
