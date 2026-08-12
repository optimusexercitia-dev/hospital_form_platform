-- =============================================================================
-- DM1 / M6 — the D11 read-verb dispatch row + the program feature flags
-- (ADR 0114 D11/D13; plan §3 step 6; ADR 0116).
--
-- 'document.opened' enters the audited-read registry NOW (dispatching through
-- app.can_read_document, which exists since M4) so DM2's open_document_version
-- lands against a registered verb. The D11 WRITER-side events (disposition /
-- reclassification / hold changes) go through app.audit_write inside DM2's
-- commands and need no dispatch row. Full-body rewrites of the two audit
-- functions (the M1 versions + the new arm), properties preserved.
--
-- Flags: all five inserted OFF with a TARGETED on conflict (key) do nothing.
-- Nothing consumes them in DM1 (inert substrate); seed does NOT enable them.
-- =============================================================================

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

    -- DM (ADR 0114 D11): the document-model read verb. The entity is the
    -- documents id; DM2's open_document_version records PHI-tier and foreign
    -- opens through this registry. Replaces the ADR 0063 'attachment.read'
    -- arm removed by 20260923000100.
    when 'document.opened' then
      return app.can_read_document(p_entity_id, v_uid);

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
    -- DM (ADR 0114 D11): the audited document open (replaces the ADR 0063
    -- 'attachment.read' verb removed by 20260923000100).
    'document.opened',
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

-- The program flags — all OFF; per-wave consumers arrive DM2–DM5.
insert into app.feature_flags (key, enabled, description) values
  ('documents_foundation', false,
   'DM (ADR 0114): the document-model substrate — securable_resources, documents/versions/files, upload/disposal machine, the audited open door (DM2). Gates the DM2 command RPCs'' reachability, never the RLS boundary (the metadata policies are flag-independent). Ships OFF until the DM2 gate. Resolve the VALUE in the enabled column, never this sentence.'),
  ('documents_wave_a', false,
   'DM Wave A (ADR 0114 D13): the rebuilt case / meeting / interview / action-item attachment experience on the document model. Requires documents_foundation. Ships OFF until the DM2 gate; retires the legacy `attachments` flag key when it lands. Resolve the VALUE in the enabled column, never this sentence.'),
  ('documents_wave_b', false,
   'DM Wave B (ADR 0114 D13): controlled documents bind their versions/files to the document model; downloads via the audited door; controlled-documents bucket SELECT policy retired (DM3). Resolve the VALUE in the enabled column, never this sentence.'),
  ('documents_wave_c', false,
   'DM Wave C (ADR 0114 D13): referral snapshot/reply files become version/file/rendition records; the F-14 cookie-client signer dies; the DM1 referral allowlist empties (DM4). Resolve the VALUE in the enabled column, never this sentence.'),
  ('documents_wave_d', false,
   'DM Wave D (ADR 0114 D13): NSP RCA/CAPA evidence + printed_pdf renditions on the document model; legacy bucket retirement manifest (DM5). Resolve the VALUE in the enabled column, never this sentence.')
on conflict (key) do nothing;
