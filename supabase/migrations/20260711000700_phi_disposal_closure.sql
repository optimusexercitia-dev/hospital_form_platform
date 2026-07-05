-- =============================================================================
-- WS-4 · C-6 — PHI-disposal closure (+ §6.4 leak) — the last critical.
-- =============================================================================
-- Pre-pilot DB hardening. The three dispose_* were materially incomplete, so "patient
-- erased" was not truthful. This completes ALL DB-side PHI disposal in each entity's
-- graph, adds the missing meeting-minutes path, and closes the §6.4 path/decline leak.
-- Storage is DELIBERATELY left immutable (Rule 6) — the erasure claim is NARROWED (not
-- Storage deletion) per the locked user decision. Detail:
--   docs/plans/pre-pilot-db-hardening-program.md §1 WS-4;
--   docs/reviews/external-db-audit-2026-07-evaluation.md §2 (C-6), §6.4;
--   docs/decisions/0056-phi-disposal-closure-narrowed-claim.md.
-- Reset-OK (pre-launch). Architecture Rule 11/12.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · meetings.phi_disposed_* flag (for the new dispose_meeting_minutes one-shot).
-- -----------------------------------------------------------------------------
alter table public.meetings
  add column if not exists phi_disposed_at timestamptz,
  add column if not exists phi_disposed_by uuid references public.profiles(id),
  add column if not exists phi_disposed_reason text;
comment on column public.meetings.phi_disposed_at is
  'WS-4 C-6: set when dispose_meeting_minutes erases this meeting''s minutes/agenda PHI '
  '(one-shot). A meeting can discuss many cases, so minutes disposal is per-MEETING, '
  'decoupled from per-case dispose_case_phi.';

-- =============================================================================
-- 1 · dispose_case_phi — COMPLETE the case's PHI graph.
--     Adds: case-phase answers (DELETE — full erasure of patient-authored content;
--     the stored case_phases.result_id SURVIVES — no answer-delete recompute exists),
--     case_interviews.summary_md, case_interview_subjects.note, cases.label,
--     case_documents.{title,description}, meeting_cases.{summary,decision},
--     case_events.title. Keeps case_patient/case_narratives/case_events.body.
-- =============================================================================
create or replace function public.dispose_case_phi(p_case_id uuid, p_reason text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id)
          or app.is_commission_admin_of(app.commission_of_case(p_case_id))) then
    raise exception 'apenas a coordenação da comissão ou um administrador da organização pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if v_case.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste caso já foram descartados'
      using errcode = 'HC056';
  end if;

  -- Scoped bypasses for every frozen/submitted child guard this dispose edits.
  perform set_config('app.in_case_rpc', 'on', true);
  perform set_config('app.in_narrative_rpc', 'on', true);
  perform set_config('app.in_interview_rpc', 'on', true);
  perform set_config('app.in_submit_rpc', 'on', true);   -- for the answers DELETE (submitted-freeze)
  perform set_config('app.in_meeting_rpc', 'on', true);  -- for meeting_cases child-lock
  perform set_config('app.phi_dispose_reason', p_reason, true);

  -- (a) structured patient row.
  delete from public.case_patient where case_id = p_case_id;

  -- (b) case-phase ANSWERS — DELETE (patient-authored content; selections cascade via
  -- answer_selected_options FK). The institutional outcome (case_phases.result_id /
  -- result_computed_at) is stored and NOT recomputed on answer delete (the only
  -- recompute trigger is sync_case_phase_on_submit on responses UPDATE) — so it SURVIVES.
  delete from public.answers a
   using public.responses r, public.case_phases cp
   where a.response_id = r.id and r.case_phase_id = cp.id and cp.case_id = p_case_id;

  -- (c) narratives + case-event bodies AND titles.
  update public.case_narratives set body_md = null where case_id = p_case_id;
  update public.case_events set body = v_redacted, title = v_redacted where case_id = p_case_id;

  -- (d) interviews (summary) + interview subjects (note), for this case's interviews.
  update public.case_interviews set summary_md = null where case_id = p_case_id;
  update public.case_interview_subjects s set note = v_redacted
   where s.interview_id in (select id from public.case_interviews where case_id = p_case_id);

  -- (e) the case label (self-labeled PHI — closes the asymmetry vs referral.subject).
  update public.cases set label = v_redacted where id = p_case_id;

  -- (f) case_documents metadata (title/description); storage_path kept (Rule 6, narrowed claim).
  update public.case_documents set title = v_redacted, description = null where case_id = p_case_id;

  -- (g) per-(meeting,case) notes (case-scoped — safe to redact; the meeting's OWN
  -- minutes_md stays, disposed separately by dispose_meeting_minutes since a meeting
  -- can discuss many cases).
  update public.meeting_cases set summary = v_redacted, decision = v_redacted where case_id = p_case_id;

  -- (h) flags.
  update public.cases
     set has_patient = false, phi_disposed_at = now(),
         phi_disposed_by = auth.uid(), phi_disposed_reason = p_reason
   where id = p_case_id;

  perform app.audit_write(
    'case_patient.disposed', 'case_patient', p_case_id, v_case.commission_id,
    'Dados do paciente do caso ' || v_case.case_number || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_meeting_rpc', 'off', true);
  perform set_config('app.in_submit_rpc', 'off', true);
  perform set_config('app.in_interview_rpc', 'off', true);
  perform set_config('app.in_narrative_rpc', 'off', true);
  perform set_config('app.in_case_rpc', 'off', true);
end;
$function$;
alter function public.dispose_case_phi(uuid, text) owner to postgres;

-- =============================================================================
-- 2 · dispose_event_phi — gap-fill: rca_evidence.{title,citation_label},
--     rca_why_chains.root_text. Verbatim otherwise from nsp_per_hospital.
-- =============================================================================
create or replace function public.dispose_event_phi(p_event_id uuid, p_reason text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_event public.patient_safety_event;
  v_rca_id uuid;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_patient_safety_enabled();

  if not (app.is_commission_admin_of(app.commission_of_event(p_event_id))
          or app.is_pqs_operator_of(app.hospital_of_event(p_event_id))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.id is null then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if v_event.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste evento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.event_patient where event_id = p_event_id;
  update public.patient_safety_event set description_md = null where id = p_event_id;
  update public.event_triage set disposition_notes_md = null where event_id = p_event_id;

  select id into v_rca_id from public.rca where event_id = p_event_id;
  if v_rca_id is not null then
    update public.rca
       set what_md = null, expected_md = null, summary_md = null, impact = null, scope = null
     where id = v_rca_id;
    update public.rca_factors          set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_root_causes       set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_timeline_entries  set description = v_redacted  where rca_id = v_rca_id;
    -- WS-4 gap-fill: RCA evidence free-text (citation label + title) + why-chain root.
    update public.rca_evidence set title = v_redacted,
           citation_label = case when citation_label is not null then v_redacted else citation_label end
     where rca_id = v_rca_id;
    update public.rca_why_chains set root_text = v_redacted where rca_id = v_rca_id;
  end if;

  update public.capa_plan set lessons_learned_md = null
   where source_event_id = p_event_id or (v_rca_id is not null and source_rca_id = v_rca_id);
  update public.capa_effectiveness ce set method_md = null
   where ce.capa_id in (select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id or (v_rca_id is not null and cp.source_rca_id = v_rca_id));
  update public.capa_measure_result cmr set note = null
   where cmr.measure_id in (select cm.id from public.capa_measure cm where cm.capa_id in (
     select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id or (v_rca_id is not null and cp.source_rca_id = v_rca_id)));
  update public.capa_action_task cat set description = v_redacted
   where cat.action_id in (select ca.id from public.capa_action ca where ca.capa_id in (
     select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id or (v_rca_id is not null and cp.source_rca_id = v_rca_id)));

  update public.patient_safety_event
     set has_patient = false, phi_disposed_at = now(), phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason, updated_at = now()
   where id = p_event_id;

  perform app.audit_write(
    'event_patient.disposed', 'event_patient', p_event_id, v_event.reporting_commission_id,
    'Dados do paciente do evento ' || v_event.code || ' descartados',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_safety_rpc', 'off', true);
end;
$function$;
alter function public.dispose_event_phi(uuid, text) owner to postgres;

-- =============================================================================
-- 3 · dispose_referral_phi — gap-fill: referral_reply_attachment.title (free-text that
--     may carry PHI). Verbatim otherwise from nsp_per_hospital. Storage objects kept.
-- =============================================================================
create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
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
  -- WS-4 gap-fill: reply-attachment titles (free-text that can carry PHI; the object in
  -- storage is kept — Rule 6, narrowed claim).
  update public.referral_reply_attachment set title = v_redacted where referral_id = p_referral_id;

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
$function$;
alter function public.dispose_referral_phi(uuid, text) owner to postgres;

-- =============================================================================
-- 4 · dispose_meeting_minutes — NEW standalone per-meeting minutes disposal.
--     A meeting can discuss MANY cases (meeting_cases UNIQUE(meeting_id,case_id)), so
--     minutes disposal is decoupled from per-case dispose_case_phi. Coordinator-gated;
--     one-shot (HC056); redacts minutes_md + agenda-item free-text. Storage kept.
-- =============================================================================
create or replace function public.dispose_meeting_minutes(p_meeting_id uuid, p_reason text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_meeting public.meetings;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_meetings_enabled();

  select * into v_meeting from public.meetings where id = p_meeting_id;
  if v_meeting.id is null then
    raise exception 'reunião não encontrada' using errcode = 'P0002';
  end if;
  -- Gate: staff_admin of the meeting's commission OR its commission-admin.
  if not (app.is_staff_admin_of(v_meeting.commission_id)
          or app.is_commission_admin_of(v_meeting.commission_id)) then
    raise exception 'apenas a coordenação da comissão ou um administrador da organização pode descartar a ata'
      using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;
  if v_meeting.phi_disposed_at is not null then
    raise exception 'a ata desta reunião já foi descartada' using errcode = 'HC056';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);  -- bypass the meeting freeze guards
  perform set_config('app.phi_dispose_reason', p_reason, true);

  update public.meetings set minutes_md = null where id = p_meeting_id;
  update public.meeting_agenda_items
     set description = v_redacted, discussion_notes = v_redacted, resolution = v_redacted
   where meeting_id = p_meeting_id;

  update public.meetings
     set phi_disposed_at = now(), phi_disposed_by = auth.uid(), phi_disposed_reason = p_reason
   where id = p_meeting_id;

  perform app.audit_write(
    'meeting_minutes.disposed', 'meeting', p_meeting_id, v_meeting.commission_id,
    'Ata da reunião ' || v_meeting.meeting_number || ' descartada',
    jsonb_build_object('reason', p_reason));

  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$function$;
alter function public.dispose_meeting_minutes(uuid, text) owner to postgres;

-- =============================================================================
-- 5 · §6.4 leak fix — get_referral_detail hides frozen_storage_path + decline_note
--     from a metadata-only (non-PHI) reader. Recreated VERBATIM from baseline with
--     only the two v_can_phi gates added (edits inline-commented below).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_referral_detail(p_referral_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
  -- Broad gate: any member of either committee (or QPS) may load the metadata.
  if not app.can_read_referral(p_referral_id, auth.uid()) then
    raise exception 'encaminhamento não encontrado' using errcode = 'no_data_found';
  end if;

  -- The "originator" exemption from the body-view audit is STRICTLY the source
  -- coordinator (the author who already holds the content). It must NOT fold in
  -- app.is_admin(): a QPS member who is also a platform admin is NOT the originator
  -- and must be audited (parity with get_referral_patient). So the exemption is
  -- is_staff_admin_of(source) only — not is_admin().
  v_is_source_coord := app.is_staff_admin_of(v_referral.source_commission_id);
  -- Tight gate: coordinators + assigned target analyst + QPS read the free-text
  -- bodies (frozen narrative + reply). Everyone else gets metadata only.
  v_can_phi := app.can_read_referral_phi(p_referral_id, auth.uid());

  -- AUDIT (Rule 11/12): a PHI-BODY read by an entitled reader who is NOT the source
  -- coordinator (the originator already holds the content). Fires for the target
  -- coordinator/analyst AND for QPS (parity with get_referral_patient). A
  -- metadata-only open writes no body-view row. Attributed to the source
  -- (provenance) commission; never any body/PHI in the metadata.
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
    -- description_md is PHI-bearing free text A wrote — gate it with the bodies.
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
    -- WS-4 §6.4: decline_note is PHI-classified (dispose_referral_phi redacts it), so
    -- return it ONLY to a PHI reader (was ungated — a metadata-only leak).
    'decline_note', case when v_can_phi then v_referral.decline_note else null end,
    -- shared_items: metadata always; frozen_body_md ONLY for a PHI reader.
    'shared_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'referral_id', s.referral_id,
        'kind', s.kind,
        'source_narrative_id', s.source_narrative_id,
        'source_document_id', s.source_document_id,
        'frozen_title', s.frozen_title,
        'frozen_body_md', case when v_can_phi then s.frozen_body_md else null end,
        -- WS-4 §6.4: path is PHI-minimization-sensitive; return only to a PHI reader
        -- (the bucket RLS already blocks the download — this closes the path disclosure).
        'frozen_storage_path', case when v_can_phi then s.frozen_storage_path else null end,
        'frozen_mime_type', s.frozen_mime_type,
        'frozen_size_bytes', s.frozen_size_bytes,
        'position', s.position
      ) order by s.position)
      from public.referral_shared_item s where s.referral_id = p_referral_id
    ), '[]'::jsonb),
    -- reply: metadata (outcome_label/flags/attachments) always; result_md ONLY for
    -- a PHI reader.
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
$function$

;
alter function public.get_referral_detail(uuid) owner to postgres;

-- =============================================================================
-- 6 · t19 grant hygiene — the recreated / new RPCs reset grants to PUBLIC-executable.
-- =============================================================================
revoke all on function public.dispose_case_phi(uuid, text) from public;
revoke all on function public.dispose_event_phi(uuid, text) from public;
revoke all on function public.dispose_referral_phi(uuid, text) from public;
revoke all on function public.dispose_meeting_minutes(uuid, text) from public;
revoke all on function public.get_referral_detail(uuid) from public;
grant execute on function public.dispose_case_phi(uuid, text) to authenticated, service_role;
grant execute on function public.dispose_event_phi(uuid, text) to authenticated, service_role;
grant execute on function public.dispose_referral_phi(uuid, text) to authenticated, service_role;
grant execute on function public.dispose_meeting_minutes(uuid, text) to authenticated, service_role;
grant execute on function public.get_referral_detail(uuid) to authenticated, service_role;
