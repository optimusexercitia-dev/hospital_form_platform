-- =============================================================================
-- F1 (ADR 0064 E0 / ADR 0065) — Case-Participants foundation, part 3 of 3:
--   • generalize dispose_case_phi to per-participant patient satellites +
--     per-participant patient_xref purge (R3); + patient-link/registry redaction (Q4);
--   • seed the case_participants / case_types feature flags OFF (m2 hard gate).
--
-- Disposal composition order (ADR 0065 §4): F1 rewrites dispose_case_phi to the
-- participant-keyed shape HERE; F2 later LAYERS the D10 attachment-redaction line on
-- top of THIS version (fixed order — the seam is marked below). F1 fully lands + types
-- regen before F2 begins, so the edits compose cleanly.
--
-- Every arm of the prior disposal (b..h: answers, narratives, event bodies/titles,
-- interviews, label, documents, meeting_cases, flags, audit, GUC bypasses, HC056
-- double-dispose guard, coordinator/org-admin authz) is PRESERVED verbatim; only arm
-- (a) — the patient satellite delete — is generalized to N participants.
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

  -- (a) structured patient rows — NOW N PER CASE (ADR 0064 Decision 3 / R3).
  --     DELETE every patient_identifiers row of the case's patient participants; each
  --     DELETE fires trg_xref_maintain_patient_identifiers, which STAMPS that
  --     participant's patient_xref row disposed (per-participant xref purge, R3 / Q1=A).
  delete from public.patient_identifiers pi
   where pi.participant_id in (
     select cp.participant_id
     from public.case_participants cp
     join public.participants p on p.id = cp.participant_id
     where cp.case_id = p_case_id and p.participant_type = 'patient'
   );

  --     Q4: redact the patient participants' registry display_name (belt-and-suspenders —
  --     the writer already sets a surrogate, but a future writer path must not leak) and
  --     soft-remove their case links so a disposed case shows no residual patient linkage.
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
  -- answer_selected_options FK). case_phases.result_id SURVIVES (no answer-delete recompute).
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

  -- (f) case_documents metadata (title/description); storage_path kept (Rule 6).
  update public.case_documents set title = v_redacted, description = null where case_id = p_case_id;

  -- (g) per-(meeting,case) notes.
  update public.meeting_cases set summary = v_redacted, decision = v_redacted where case_id = p_case_id;

  -- === F2 SEAM (ADR 0065 §4): the D10 per-owner attachment-redaction line +
  --     dispose_attachment_phi call LAYERS HERE, on top of the arms above. Do not
  --     weave it into (a)-(g); F2 appends after this comment. ===

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

-- -----------------------------------------------------------------------------
-- Feature flags — seed OFF (m2 HARD GATE). RLS exists on every new table from creation
-- regardless (Rule 1); the flag gates RPC/feature reachability, not the boundary. These
-- MUST NOT be flipped in any environment holding real ethics data until E1's
-- respondent-exclusion RLS lands (ADR 0064 m2).
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description) values
  ('case_participants', false,
   'When true, the generalized case participant layer (ADR 0064 E0) is reachable: the '
   'participants typed-identity registry, case_participants links, role vocabulary, the '
   'Class-2 professional reader (professional_profile.read), and the N-aware patient panel. '
   'Ships OFF (m2 HARD GATE): MUST NOT be flipped on real ethics data until E1 '
   'respondent-exclusion RLS lands.')
  on conflict (key) do update set enabled = excluded.enabled, description = excluded.description;

insert into app.feature_flags (key, enabled, description) values
  ('case_types', false,
   'When true, the case-type config layer (ADR 0064 Decision 4) is reachable: case_types + '
   'case_type_terminology drive per-committee terminology/workflow/default-visibility and '
   'subject kind. Ships OFF (m2 HARD GATE), flipped in-phase with case_participants.')
  on conflict (key) do update set enabled = excluded.enabled, description = excluded.description;
