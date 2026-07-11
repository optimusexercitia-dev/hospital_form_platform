-- =============================================================================
-- F2 (ADR 0063 D10 / ADR 0065 §4) — Centralized Attachments, migration 5 of 6:
--   layer the attachment-redaction line into dispose_case_phi at the F2 SEAM.
--
-- Composition order (ADR 0065 §4): F1 landed the participant-keyed dispose_case_phi
-- in 20260716000200 with an EXPLICIT F2 SEAM between arm (g) and arm (h). F2 re-emits
-- F1's body and inserts the D10 attachment-redaction block EXACTLY at that seam.
--
-- TWO necessary edits vs a literal verbatim re-emit (both forced by migration 4):
--   • Arm (f) — the old `update public.case_documents …` — is REMOVED: case_documents
--     was folded into public.attachments (migration 4). The new D10 block SUPERSEDES it
--     (case_documents rows are now attachments where owner_type='case'), redacting the
--     same metadata plus any other case-owned attachment.
--   • The D10 block is added at the seam. Arms (a)-(e), (g), (h), audit, GUC bypasses,
--     the HC056 double-dispose guard, and the coordinator/org-admin authz are otherwise
--     UNCHANGED from F1.
--
-- Q9 (lead §J): the bulk case line SKIPS legal_hold=true rows (they need the legal
-- record) AND surfaces a retained count via RAISE NOTICE (least-invasive — dispose_case_phi
-- returns void; its signature is load-bearing for F1 callers). legal_hold has NO writer
-- this phase (reserved-inert) ⇒ the retained count is always 0 (future-facing).
-- Single-attachment dispose_attachment_phi (migration 3) hard-rejects a held row (HC098).
-- =============================================================================

create or replace function public.dispose_case_phi(p_case_id uuid, p_reason text)
  returns void language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_case public.cases;
  v_redacted constant text := '[PHI removido]';
  v_retained integer;
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

  -- (f) REMOVED — case_documents folded into public.attachments (F2 migration 4). The
  --     D10 block below supersedes it (see the F2 SEAM).

  -- (g) per-(meeting,case) notes.
  update public.meeting_cases set summary = v_redacted, decision = v_redacted where case_id = p_case_id;

  -- === F2 SEAM (ADR 0063 D10 / ADR 0065 §4): attachment redaction, layered on F1's body. ===
  -- Redact PHI-bearing metadata (title/description) of every LIVE, non-held attachment
  -- owned by this case; retain the row + the storage object (Rule 6). Keyed on
  -- (owner_type, owner_id) = ('case', p_case_id). Bracketed so guard_attachment_immutable
  -- permits the write (title/description/phi_disposed_* are not frozen, but bracket for
  -- consistency with the single-attachment door).
  perform set_config('app.in_attachments_rpc', 'on', true);
  update public.attachments
     set title = v_redacted,
         description = null,
         phi_disposed_at = coalesce(phi_disposed_at, now()),
         phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason,
         updated_at = now()
   where owner_type = 'case'
     and owner_id = p_case_id
     and deleted_at is null
     and legal_hold = false;                         -- legal-hold rows skipped (Q9)
  perform set_config('app.in_attachments_rpc', 'off', true);

  -- Q9: surface a retained count (rows skipped for legal hold). Reserved-inert this
  -- phase ⇒ always 0; when legal_hold gets a writer post-pilot, move this into the
  -- disposal audit metadata.
  select count(*) into v_retained from public.attachments
   where owner_type = 'case' and owner_id = p_case_id
     and deleted_at is null and legal_hold = true;
  if v_retained > 0 then
    raise notice 'anexos retidos por bloqueio legal (não redigidos): %', v_retained;
  end if;

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

-- t19: create-or-replace preserves grants, but re-affirm hygiene (matches F1/0700).
alter function public.dispose_case_phi(uuid, text) owner to postgres;
revoke all on function public.dispose_case_phi(uuid, text) from public;
grant execute on function public.dispose_case_phi(uuid, text) to authenticated, service_role;
