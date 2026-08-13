-- =============================================================================
-- DM1 / M1 — drop the centralized attachments substrate (ADR 0114 D5;
-- plan: docs/plans/dm1-substrate-cutover-plan.md §3 step 1; decisions ADR 0116).
--
-- Drop set enumerated from the LIVE catalog on 2026-08-12 (never from prose):
--   * 3 tables (attachments, attachment_references, attachment_subjects) — the
--     4 dangling production rows die with the table (they reference no bytes).
--   * 5 public RPCs + 7 app routines (the four dispatchers, the flag assert,
--     the two trigger functions).
--   * 3 storage.objects policies on the attachments / attachments-phi buckets.
--     The bucket ROWS deliberately survive until DM5 (one retirement manifest).
-- PRESERVED (the DM4 allowlist, pinned by name in pgTAP 328 K2): the referral
-- module's add_referral_reply_attachment / get_referral_attachment_path /
-- referral_reply_attachment_select_readable / referral_attachments_obj_insert /
-- referral_attachments_obj_select, PLUS case_documents_select_member +
-- app.can_read_snapshot_document (the live frozen-snapshot boundary until DM4).
--
-- Six function bodies bind to the dropped surface and are patched FIRST (all
-- verified against pg_proc, comment-stripped — §7.2):
--   app._audit_access_authorized  (attachment.read arm removed)
--   public.log_audit_access       (attachment.read allowlist entry removed)
--   public.add_referral_shared_item (document arm PARKED, HC0DM — DM4)
--   public.dispose_case_phi       (attachment-redaction seam removed — FUP-DM1-DISPOSE)
--   public.add_rca_evidence       (document citation PARKED, HC0DM — Wave D)
--   public.issue_ethics_notification (related document PARKED, HC0DM — open item Q1)
--
-- Keystone: supabase/tests/328_dm1_document_substrate.sql (K1/K2/K8) — authored
-- first and observed RED against the pre-M1 catalog (K1: 12 routines / 6
-- policies / 3 relations / 12 grants / 7+8 body references / 3 bucket-literal
-- policies; K8: all three writers succeeded).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Patches (properties preserved: SECURITY DEFINER, pinned search_path,
--    STABLE where the original was stable; CREATE OR REPLACE keeps ACLs).
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app._audit_access_authorized(p_action text, p_entity_id uuid, p_commission uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_resp_commission uuid;
  v_commission uuid;
begin
  if v_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  case p_action
    when 'case.opened' then
      return app.can_read_case(p_entity_id, v_uid);
    when 'case_patient.read' then
      return app.can_read_case_patient(p_entity_id, v_uid);
    when 'professional_profile.read' then
      return app.can_read_professional_profile(p_entity_id, v_uid);

    -- DM1 (ADR 0114 D5): the ADR 0063 attachment-read arm was REMOVED with
    -- the attachments substrate. The document-model read verb joins this
    -- dispatch in migration 20260923000600.

    -- MIN (ADR 0099 D8/D15): the entity is the meeting_minutes_jobs id. The predicate
    -- has NO admin arm — but note the `is_admin()` short-circuit ABOVE still returns
    -- true for a platform_admin calling log_audit_access directly. That is a
    -- pre-existing property of all 18 arms, and precisely why
    -- public.read_minutes_transcript gates itself BEFORE recording rather than
    -- inferring authorization from this registry (B0 §3, noun rule ADR 0078 A35).
    when 'minutes_transcript.read' then
      return app.can_read_minutes_transcript(p_entity_id, v_uid);

    when 'event_patient.read' then
      return app.can_read_event_patient(p_entity_id, v_uid);
    when 'safety_event.viewed' then
      return app.can_read_event(p_entity_id, v_uid);
    when 'triage.viewed' then
      return app.can_read_event(p_entity_id, v_uid);

    when 'rca.viewed' then
      select event_id into v_event from public.rca where id = p_entity_id;
      return v_event is not null and app.can_read_event(v_event, v_uid);

    when 'capa.viewed' then
      return app.can_read_capa(p_entity_id, v_uid);

    when 'meeting.viewed' then
      select commission_id into v_commission from public.meetings where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_tenancy_admin_of(v_commission));
    when 'interview.viewed' then
      select commission_id into v_commission from public.case_interviews where id = p_entity_id;
      return v_commission is not null
             and (app.is_member_of(v_commission) or app.is_tenancy_admin_of(v_commission));

    when 'referral.viewed' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    when 'referral_patient.read' then
      return app.can_read_referral_phi(p_entity_id, v_uid);
    -- RV2 R5 (Rule 11): the audited internal-note READ. Entity is the referral id.
    when 'referral.note_viewed' then
      return app.can_read_referral_internal_notes(p_entity_id, v_uid);
    -- Referral registros: the entity is the referral id and p_commission is the
    -- SIDE whose case is being described. Mirrors get_referral_case_access_summary's
    -- own gate so the registry cannot be laxer than the door it records.
    when 'referral.case_access_summary_viewed' then
      return p_commission is not null
             and app.is_member_of_for(p_commission, v_uid)
             and app.can_read_referral(p_entity_id, v_uid);

    when 'response.opened_foreign' then
      select commission_id into v_resp_commission from public.responses where id = p_entity_id;
      return v_resp_commission is not null
             and (app.is_staff_admin_of(v_resp_commission)
                  or app.is_tenancy_admin_of(v_resp_commission));

    when 'response.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_tenancy_admin_of(p_commission));
    when 'audit.exported' then
      return p_commission is not null
             and (app.is_staff_admin_of(p_commission) or app.is_tenancy_admin_of(p_commission));

    else
      return false;
  end case;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_audit_access(p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
begin
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed',
    'referral_patient.read', 'referral.viewed',
    -- RV2 R5 (Rule 11): the audited internal-note read.
    'referral.note_viewed',
    'case_patient.read',
    'professional_profile.read',
    -- DM1 (ADR 0114 D5): the ADR 0063 attachment-read verb left this list with
    -- the attachments substrate; the document-model open verb joins in
    -- 20260923000600. NO quoted dotted literal may appear in ANY comment of
    -- this body — pgTAP 191's completeness parser reads every verb-shaped
    -- quoted string here, comments included.
    -- MIN (ADR 0099 D8/D15): the audited meeting-transcript read.
    'minutes_transcript.read',
    -- Referral registros: the audited case-access roster read.
    'referral.case_access_summary_viewed'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  if not app._audit_access_authorized(p_action, p_entity_id, p_commission) then
    raise exception 'log_audit_access: sem permissão para registrar este acesso'
      using errcode = '42501';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$function$;

CREATE OR REPLACE FUNCTION public.add_referral_shared_item(p_referral_id uuid, p_kind text, p_source_narrative_id uuid DEFAULT NULL::uuid, p_source_document_id uuid DEFAULT NULL::uuid)
 RETURNS referral_shared_item
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_referral public.case_referral;
  v_narrative public.case_narratives;
  v_next_pos integer;
  v_row public.referral_shared_item;
begin
  perform app.assert_referrals_enabled();
  v_referral := app.assert_referral_draft_writable(p_referral_id);

  if p_kind not in ('narrative', 'document') then
    raise exception 'tipo de item inválido' using errcode = 'HC077';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_pos
  from public.referral_shared_item where referral_id = p_referral_id;

  perform set_config('app.in_referral_rpc', 'on', true);

  if p_kind = 'narrative' then
    if p_source_narrative_id is null then
      raise exception 'selecione a narrativa a compartilhar' using errcode = 'HC077';
    end if;
    select * into v_narrative from public.case_narratives
      where id = p_source_narrative_id and case_id = v_referral.source_case_id;
    if v_narrative.id is null then
      raise exception 'narrativa não encontrada neste caso' using errcode = 'HC077';
    end if;
    insert into public.referral_shared_item (
      referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position
    ) values (
      p_referral_id, 'narrative', v_narrative.id,
      coalesce(v_narrative.title, v_narrative.type_label),
      coalesce(v_narrative.body_md, ''), v_next_pos
    )
    returning * into v_row;
  else
    -- DM1 (ADR 0114 D5 / ADR 0116): the document arm is PARKED — its source
    -- substrate was dropped; DM4 re-points it at the document model. Fail
    -- closed until then (authority was already checked above — §7.1 order).
    raise exception
      'o compartilhamento de documentos do caso está temporariamente indisponível (migração do modelo de documentos)'
      using errcode = 'HC0DM';
  end if;

  perform set_config('app.in_referral_rpc', 'off', true);
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.dispose_case_phi(p_case_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_case public.cases;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_case_patient_enabled();

  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso não encontrado' using errcode = 'P0002';
  end if;
  if not (app.is_staff_admin_of(v_case.commission_id)) then
    raise exception 'apenas a coordenação da comissão pode descartar dados do paciente'
      using errcode = '42501';
  end if;
  perform app.assert_not_case_excluded(p_case_id);  -- ADR 0078 M1·4 (qa B2)
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

  -- (a) structured patient rows — N PER CASE (ADR 0064 Decision 3 / R3).
  delete from public.patient_identifiers pi
   where pi.participant_id in (
     select cp.participant_id
     from public.case_participants cp
     join public.participants p on p.id = cp.participant_id
     where cp.case_id = p_case_id and p.participant_type = 'patient'
   );

  --     Q4: redact the patient participants' registry display_name (belt-and-suspenders)
  --     and soft-remove their case links.
  update public.participants p
     set display_name = v_redacted
   where p.participant_type = 'patient'
     and p.id in (select cp.participant_id from public.case_participants cp
                  where cp.case_id = p_case_id);
  update public.case_participants cp
     set removed_at = coalesce(cp.removed_at, now())
   where cp.case_id = p_case_id
     and cp.participant_id in (
       select p.id from public.participants p where p.participant_type = 'patient');

  -- (b) case-phase ANSWERS — DELETE (patient-authored content; selections cascade via
  -- answer_selected_options FK). case_phases.result_id SURVIVES.
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

  -- (e) the case label (self-labeled PHI).
  update public.cases set label = v_redacted where id = p_case_id;

  -- (f) REMOVED — case_documents was folded into the F2 attachments substrate,
  --     and DM1 (ADR 0114/0116) dropped that substrate with zero rows carrying
  --     bytes. FUP-DM1-DISPOSE: when Wave A lands (DM2), this dispose must be
  --     wired to document disposition for case-homed documents (D10).

  -- (g) per-(meeting,case) notes.
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

CREATE OR REPLACE FUNCTION public.add_rca_evidence(p_rca_id uuid, p_kind text, p_title text, p_storage_path text DEFAULT NULL::text, p_external_url text DEFAULT NULL::text, p_citation_target text DEFAULT NULL::text, p_cited_entity_id uuid DEFAULT NULL::uuid, p_citation_label text DEFAULT NULL::text)
 RETURNS rca_evidence
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare
  v_row public.rca_evidence;
  v_interview uuid;
  v_meeting uuid;
  v_document uuid;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;
  if p_kind not in ('document', 'link', 'citation') then
    raise exception 'tipo de evidência inválido' using errcode = 'check_violation';
  end if;

  -- Pre-validate the three-way shape (DISTINCT message; the table CHECK is the backstop).
  if p_kind = 'document' then
    if p_storage_path is null or p_external_url is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
  elsif p_kind = 'link' then
    if p_external_url is null or p_storage_path is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if p_external_url not like 'https://%' then
      raise exception 'o link deve começar com https://' using errcode = 'check_violation';
    end if;
  else -- citation
    -- DM1 (ADR 0114/0116): document CITATIONS are PARKED — cited_document_id
    -- pointed at the dropped attachments substrate; Wave D re-points it at the
    -- document model. Interview/meeting citations stay live. Authority was
    -- already checked above (§7.1 order).
    if p_citation_target = 'document' then
      raise exception
        'a citação de documento como evidência está temporariamente indisponível (migração do modelo de documentos)'
        using errcode = 'HC0DM';
    end if;
    if p_citation_target not in ('interview', 'meeting', 'document')
       or p_cited_entity_id is null or p_storage_path is not null or p_external_url is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if btrim(coalesce(p_citation_label, '')) = '' then
      raise exception 'informe um rótulo para a citação' using errcode = 'check_violation';
    end if;
    -- Route the entity id to the matching typed column.
    if p_citation_target = 'interview' then v_interview := p_cited_entity_id;
    elsif p_citation_target = 'meeting' then v_meeting := p_cited_entity_id;
    else v_document := p_cited_entity_id;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_evidence (
    rca_id, kind, title, storage_path, external_url,
    cited_interview_id, cited_meeting_id, cited_document_id, citation_label, created_by
  ) values (
    p_rca_id, p_kind, btrim(p_title),
    p_storage_path, p_external_url,
    v_interview, v_meeting, v_document,
    case when p_kind = 'citation' then btrim(p_citation_label) else null end,
    auth.uid()
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.issue_ethics_notification(p_case_id uuid, p_notification_type text, p_delivery_method text, p_recipient_participant_id uuid DEFAULT NULL::uuid, p_recipient_user_id uuid DEFAULT NULL::uuid, p_due_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_related_document_id uuid DEFAULT NULL::uuid, p_notes_md text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public', 'pg_catalog'
AS $function$
declare v_commission uuid; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  v_commission := app.assert_ethics_coordinator(p_case_id);   -- HC0J1
  perform app.assert_ethics_typed(p_case_id);                 -- HC0J0
  -- DM1 (ADR 0114/0116): related_document_id pointed at the dropped
  -- attachments substrate and its wave owner is an OPEN ITEM (plan Q1).
  -- PARKED, fail-closed, until the PO ruling (authority checked above).
  if p_related_document_id is not null then
    raise exception
      'anexar documento à notificação está temporariamente indisponível (migração do modelo de documentos)'
      using errcode = 'HC0DM';
  end if;
  if p_notification_type not in
     ('complaint_acknowledgement','respondent_notification','request_for_response',
      'hearing_notice','decision_notice','appeal_notice','external_reporting_notice','other') then
    raise exception 'tipo de notificação inválido' using errcode = 'HC0J0';
  end if;
  if p_delivery_method not in ('email','letter','in_person','system','phone','other') then
    raise exception 'método de entrega inválido' using errcode = 'HC0J0';
  end if;
  insert into public.ethics_notifications
    (case_id, recipient_participant_id, recipient_user_id, notification_type, delivery_method,
     status, sent_at, due_at, related_document_id, notes_md, created_by)
  values (p_case_id, p_recipient_participant_id, p_recipient_user_id, p_notification_type, p_delivery_method,
     'sent', now(), p_due_at, p_related_document_id, nullif(btrim(p_notes_md), ''), auth.uid())
  returning id into v_id;
  insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (p_case_id, 'notification_issued', null,
          'Notificação emitida: ' || (case p_notification_type
              when 'complaint_acknowledgement' then 'Ciência de denúncia'
              when 'respondent_notification' then 'Notificação ao denunciado'
              when 'request_for_response' then 'Solicitação de defesa'
              when 'hearing_notice' then 'Convocação para audiência'
              when 'decision_notice' then 'Notificação de decisão'
              when 'appeal_notice' then 'Notificação de recurso'
              when 'external_reporting_notice' then 'Comunicação a órgão externo'
              else 'Outro' end)
            || ' (' || (case p_delivery_method
              when 'email' then 'e-mail' when 'letter' then 'carta'
              when 'in_person' then 'presencial' when 'system' then 'sistema'
              when 'phone' then 'telefone' else 'outro' end) || ')',
          'case_readers', current_date, auth.uid());
  perform app.audit_write('ethics.notification_issued', 'case', p_case_id, v_commission,
    'Notificação emitida', jsonb_build_object('notification_id', v_id, 'notification_type', p_notification_type));
  return v_id;
end;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Parked-seam FK drops (explicit, never CASCADE). The four uuid columns
--    STAY as parked seams: referral_shared_item.source_document_id → DM4;
--    rca_evidence.cited_document_id → Wave D; the two ethics columns → open
--    item Q1. ethics_* carry SELECT-only grants and referral_shared_item has
--    no write policy, so the patched DEFINER writers close those three;
--    rca_evidence has a live authenticated FOR ALL write policy, so its seam
--    gets a constraint too.
-- -----------------------------------------------------------------------------

alter table public.rca_evidence
  drop constraint rca_evidence_cited_document_id_fkey;
alter table public.referral_shared_item
  drop constraint referral_shared_item_source_document_id_fkey;
alter table public.ethics_decision_details
  drop constraint ethics_decision_details_decision_letter_document_id_fkey;
alter table public.ethics_notifications
  drop constraint ethics_notifications_related_document_id_fkey;

alter table public.rca_evidence
  add constraint rca_evidence_cited_document_parked
  check (cited_document_id is null);

comment on column public.rca_evidence.cited_document_id is
  'PARKED (DM1, ADR 0114/0116): pointed at the dropped attachments substrate; Wave D re-points it at the document model. Writer refuses document citations (HC0DM); rca_evidence_cited_document_parked blocks direct DML. Verify against the catalog, never this comment.';
comment on column public.referral_shared_item.source_document_id is
  'PARKED (DM1, ADR 0114/0116): FK to the dropped attachments substrate removed; DM4 re-points frozen-snapshot provenance at the document model. add_referral_shared_item refuses the document arm (HC0DM); the table has no authenticated write policy. Verify against the catalog, never this comment.';
comment on column public.ethics_decision_details.decision_letter_document_id is
  'PARKED (DM1, ADR 0114/0116): FK to the dropped attachments substrate removed. No function writes this column and authenticated holds SELECT only. Wave owner is OPEN (DM1 plan Q1). Verify against the catalog, never this comment.';
comment on column public.ethics_notifications.related_document_id is
  'PARKED (DM1, ADR 0114/0116): FK to the dropped attachments substrate removed; issue_ethics_notification refuses non-null (HC0DM). Wave owner is OPEN (DM1 plan Q1). Verify against the catalog, never this comment.';

-- -----------------------------------------------------------------------------
-- 3. Storage policies (the bucket rows survive until DM5 — one manifest).
-- -----------------------------------------------------------------------------

drop policy attachments_obj_insert_writable on storage.objects;
drop policy attachments_obj_select_readable on storage.objects;
drop policy attachments_phi_obj_insert_writable on storage.objects;

-- -----------------------------------------------------------------------------
-- 4. The five centralized public RPCs (exact signatures — fail loudly on drift).
-- -----------------------------------------------------------------------------

drop function public.create_attachment(text, uuid, text, text, text, text, date, text, bigint, text, text, text);
drop function public.open_attachment(uuid);
drop function public.dispose_attachment_phi(uuid, text);
drop function public.reclassify_attachment(uuid, text, text);
drop function public.soft_delete_attachment(uuid);

-- -----------------------------------------------------------------------------
-- 5. The three tables (children first). Their policies, triggers, indexes and
--    the 4 dangling production rows die with them.
-- -----------------------------------------------------------------------------

drop table public.attachment_subjects;
drop table public.attachment_references;
drop table public.attachments;

-- -----------------------------------------------------------------------------
-- 6. The seven app routines (now dependency-free).
-- -----------------------------------------------------------------------------

drop function app.assert_attachments_enabled();
drop function app.attachment_confidentiality_ok(text, uuid, text, uuid);
drop function app.can_read_attachment(text, uuid, uuid);
drop function app.can_write_attachment(text, uuid, uuid);
drop function app.commission_of_attachment(text, uuid);
drop function app.guard_attachment_immutable();
drop function app.trg_audit_attachment();

-- NOTE: the `attachments` feature-flag KEY deliberately survives (retired at
-- DM2 per the program plan). The attachments / attachments-phi bucket rows
-- deliberately survive until DM5's single retirement manifest.
