-- WS-4 · C-6 — PHI-disposal closure (+ §6.4). Migration: 20260711000700 · ADR 0056.
--
-- The lock: this suite fails if any dispose_* stops erasing a PHI column in its graph, if
-- the case-dispose retroactively wipes the institutional result, if meeting-minutes
-- disposal over-redacts (a 2-case meeting losing its minutes on a single-case dispose),
-- or if get_referral_detail leaks the frozen byte handle / decline_note to a metadata reader.
--
-- Covers:
--   §1 dispose_case_phi COMPLETE — every PHI column/table in the case graph empty/redacted
--      (answers DELETED; interview summary/subject-note; label; document title/desc;
--      meeting_cases summary/decision; narrative/event body+title; case_patient) AND the
--      stored case_phases.result_id SURVIVES; HC056 on re-dispose.
--   §2 dispose_meeting_minutes — minutes/agenda redacted + flag; over-redaction guard.
--   §3 dispose_event_phi gap-fill — rca_evidence / rca_why_chains redacted.
--   §4 §6.4 — get_referral_detail hides the frozen byte handle + decline_note from a
--      metadata-only reader; a PHI reader still sees them.

begin;
select plan(24);

update app.feature_flags set enabled = true where key in
  ('case_patient','patient_safety','meetings','case_referrals','cases_multi_phase','audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin, (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'comm_x')::uuid as comm_x, (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid as ver_u, (v->>'item_mc')::uuid as item_mc, (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §1: dispose_case_phi — a case with the FULL PHI graph.
-- ===========================================================================
create temp table cs on commit drop as
  select gen_random_uuid() as case_x, gen_random_uuid() as phase_x, gen_random_uuid() as narr_x,
         gen_random_uuid() as event_x, gen_random_uuid() as resp_x, gen_random_uuid() as intv_x,
         gen_random_uuid() as subj_x, gen_random_uuid() as doc_x, gen_random_uuid() as mtg_x,
         gen_random_uuid() as result_x, gen_random_uuid() as part_x;
grant select on cs to authenticated;

-- Case + patient + a phase with a STORED institutional result (result_id set).
insert into public.cases (id, commission_id, case_number, label, created_by, patient_mode)
  values ((select case_x from cs), (select comm_x from k), 9701, 'ROTULO-PHI', (select sa_x from k), 'optional');
-- Patient identifiers via the participant chain (re-keyed, ADR 0064 E0 / F1). Direct
-- owner inserts model the PHI state without needing the RPC's exact arg shape.
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
  values (gen_random_uuid(), app.org_of_commission((select comm_x from k)), 'affected_patient', 'Paciente afetado', array['patient'], true)
  on conflict (organization_id, key) where case_type_id is null do nothing;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  values ((select part_x from cs), app.org_of_commission((select comm_x from k)), 'patient', 'patient_phi', 'Paciente');
insert into public.patient_participants (participant_id) values ((select part_x from cs));
insert into public.case_participants (case_id, participant_id, role_id, added_by)
  values ((select case_x from cs), (select part_x from cs),
          (select id from public.case_participant_roles
             where organization_id = app.org_of_commission((select comm_x from k))
               and key = 'affected_patient' and case_type_id is null),
          (select sa_x from k));
insert into public.patient_identifiers (participant_id, name, mrn, sex)
  values ((select part_x from cs), 'Paciente PHI', 'MRN-9701', 'female');
update public.cases set has_patient = true where id = (select case_x from cs);

-- A phase result (institutional outcome) that MUST survive disposal.
insert into public.phase_results (id, commission_id, label, position)
  values ((select result_x from cs), (select comm_x from k), 'Concluído', 1);
insert into public.case_phases (id, case_id, position, form_id, form_version_id, status, result_id, result_computed_at)
  values ((select phase_x from cs), (select case_x from cs), 1, (select form_u from k),
          (select ver_u from k), 'completed', (select result_x from cs), now());

-- Case-phase answers (patient-authored PHI) on a submitted response for that phase.
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at, case_phase_id)
  values ((select resp_x from cs), (select ver_u from k), (select comm_x from k),
          (select st_x from k), 'submitted', now(), (select phase_x from cs));
select set_config('app.in_submit_rpc','on',true);
insert into public.answers (response_id, item_id, question_key, value)
  values ((select resp_x from cs), (select item_mc from k), 'u_q1', '"PACIENTE-DISSE-ISTO"'::jsonb);
select set_config('app.in_submit_rpc','off',true);

-- Narrative + events (body + title) + interview (+subject) + document + a linked meeting.
insert into public.case_narratives (id, case_id, display_label, display_position, status, body_md, created_by)
  values ((select narr_x from cs), (select case_x from cs), 'Resumo', 2, 'open', 'CORPO-NARRATIVA-PHI', (select sa_x from k));
insert into public.case_events (id, case_id, kind, title, body, created_by)
  values ((select event_x from cs), (select case_x from cs), 'note', 'TITULO-EVENTO-PHI', 'CORPO-EVENTO-PHI', (select sa_x from k));
insert into public.case_interviews (id, case_id, commission_id, interview_number, summary_md, created_by, status, interview_category)
  values ((select intv_x from cs), (select case_x from cs), (select comm_x from k), 1, 'RESUMO-ENTREVISTA-PHI', (select sa_x from k), 'scheduled', 'other');
insert into public.case_interview_subjects (id, interview_id, external_name, note, relationship_to_case)
  values ((select subj_x from cs), (select intv_x from cs), 'Entrevistado Externo', 'NOTA-SUJEITO-PHI', 'other');
-- DM1 (ADR 0114 D5): the F2 attachment fixture + dispose_case_phi's
-- attachment-redaction seam were REMOVED with the substrate (zero rows carried
-- bytes). ⛔ FUP-DM1-DISPOSE: when Wave A (DM2) lets a case own documents,
-- dispose_case_phi MUST trigger document disposition (D10) and THIS SUITE must
-- regain a keystone for it (case with a live document → dispose → the open
-- door refuses + bytes verified absent), mutation-proven.
insert into public.meetings (id, commission_id, meeting_number, title, status, scheduled_start, created_by)
  values ((select mtg_x from cs), (select comm_x from k), 9701, 'Reunião', 'scheduled', now(), (select sa_x from k));
insert into public.meeting_cases (meeting_id, case_id, summary, decision)
  values ((select mtg_x from cs), (select case_x from cs), 'RESUMO-REUNIAO-CASO-PHI', 'DECISAO-PHI');

-- DISPOSE (as the coordinator).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.dispose_case_phi(%L::uuid, 'subject_request') $$, (select case_x from cs)),
  '1.1: dispose_case_phi completes for a full-PHI case');
reset role;

-- Assertions: every PHI column empty/redacted.
select ok(not exists (select 1 from public.patient_identifiers where participant_id = (select part_x from cs)),
  '1.2: patient_identifiers row deleted');
select ok(not exists (
    select 1 from public.answers a join public.responses r on r.id=a.response_id
    where r.case_phase_id = (select phase_x from cs)),
  '1.3: case-phase answers DELETED (patient-authored content erased)');
select is((select result_id from public.case_phases where id = (select phase_x from cs)),
  (select result_x from cs),
  '1.4: the STORED institutional result (case_phases.result_id) SURVIVES disposal');
select is((select body_md from public.case_narratives where id = (select narr_x from cs)), null,
  '1.5: case_narratives.body_md nulled');
select is((select body from public.case_events where id = (select event_x from cs)), '[PHI removido]',
  '1.6: case_events.body redacted');
select is((select title from public.case_events where id = (select event_x from cs)), '[PHI removido]',
  '1.7: case_events.title redacted (gap-fill)');
select is((select summary_md from public.case_interviews where id = (select intv_x from cs)), null,
  '1.8: case_interviews.summary_md nulled');
select is((select note from public.case_interview_subjects where id = (select subj_x from cs)), '[PHI removido]',
  '1.9: case_interview_subjects.note redacted');
select is((select label from public.cases where id = (select case_x from cs)), '[PHI removido]',
  '1.10: cases.label redacted (asymmetry closed)');
-- (1.11 RETIRED with the substrate — see the FUP-DM1-DISPOSE note above; the
-- disposal contract for case-homed DOCUMENTS returns here in DM2.)
select ok(
  (select summary from public.meeting_cases where case_id = (select case_x from cs)) = '[PHI removido]'
  and (select decision from public.meeting_cases where case_id = (select case_x from cs)) = '[PHI removido]',
  '1.12: meeting_cases summary/decision redacted');
select is((select minutes_md from public.meetings where id = (select mtg_x from cs)), null,
  '1.13: the linked meeting''s minutes_md is UNTOUCHED by case-dispose (null here = it had none; see §2 for the guard)');
-- Idempotency.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.dispose_case_phi(%L::uuid, 'subject_request') $$, (select case_x from cs)),
  'HC056', null, '1.14: re-disposing an already-disposed case raises HC056');
reset role;

-- ===========================================================================
-- §2: dispose_meeting_minutes — over-redaction guard (a 2-case meeting keeps its
-- minutes when only ONE of its cases is case-disposed; disposing the MEETING redacts).
-- ===========================================================================
create temp table mt on commit drop as
  select gen_random_uuid() as mtg, gen_random_uuid() as case_a, gen_random_uuid() as case_b, gen_random_uuid() as agenda;
grant select on mt to authenticated;
insert into public.cases (id, commission_id, case_number, created_by) values
  ((select case_a from mt), (select comm_x from k), 9711, (select sa_x from k)),
  ((select case_b from mt), (select comm_x from k), 9712, (select sa_x from k));
insert into public.meetings (id, commission_id, meeting_number, title, status, scheduled_start, minutes_md, created_by)
  values ((select mtg from mt), (select comm_x from k), 9713, 'Reunião 2 casos', 'held',
          now(), 'ATA-COM-DOIS-CASOS', (select sa_x from k));
insert into public.meeting_agenda_items (id, meeting_id, position, title, description, discussion_notes, resolution)
  values ((select agenda from mt), (select mtg from mt), 1, 'Item', 'DESC-PHI', 'DISCUSSAO-PHI', 'RESOLUCAO-PHI');
insert into public.meeting_cases (meeting_id, case_id, summary) values
  ((select mtg from mt), (select case_a from mt), 'nota A'),
  ((select mtg from mt), (select case_b from mt), 'nota B');

-- Case-dispose case_a -> the MEETING minutes must survive (over-redaction guard).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.dispose_case_phi((select case_a from mt), 'other');
reset role;
select is((select minutes_md from public.meetings where id = (select mtg from mt)), 'ATA-COM-DOIS-CASOS',
  '2.1: OVER-REDACTION GUARD — case-disposing ONE of a meeting''s cases does NOT touch the meeting minutes');

-- Now dispose the MEETING minutes explicitly.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.dispose_meeting_minutes(%L::uuid, 'retention_expired') $$, (select mtg from mt)),
  '2.2: dispose_meeting_minutes completes');
reset role;
select is((select minutes_md from public.meetings where id = (select mtg from mt)), null,
  '2.3: meeting minutes_md nulled after dispose_meeting_minutes');
select ok(
  (select description from public.meeting_agenda_items where id = (select agenda from mt)) = '[PHI removido]'
  and (select discussion_notes from public.meeting_agenda_items where id = (select agenda from mt)) = '[PHI removido]',
  '2.4: agenda-item free-text redacted');
select ok((select phi_disposed_at from public.meetings where id = (select mtg from mt)) is not null,
  '2.5: meetings.phi_disposed_at flag set');

-- ===========================================================================
-- §3: dispose_event_phi gap-fill — rca_evidence + rca_why_chains redacted.
-- ===========================================================================
create temp table ev on commit drop as
  select gen_random_uuid() as event, gen_random_uuid() as rca, gen_random_uuid() as evid,
         gen_random_uuid() as why, gen_random_uuid() as factor;
grant select on ev to authenticated;
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
  values ((select organization_id from public.hospitals where id = (select hosp_b from k)),
          (select hosp_b from k), (select sa_x from k), 'pqs_member', (select admin from k))
  on conflict (principal_id, role, organization_id, hospital_id, commission_id) do nothing;
insert into public.patient_safety_event (id, code, reporting_commission_id, discovered_at, title, status, current_owner_kind, reported_by)
  values ((select event from ev), 'EV-D7C', (select comm_x from k), current_date, 'Ev', 'acknowledged', 'pqs', (select sa_x from k));
insert into public.event_patient (event_id, name, mrn, sex) values ((select event from ev), 'P', 'M', 'female');
update public.patient_safety_event set has_patient = true where id = (select event from ev);
insert into public.rca (id, event_id, status) values ((select rca from ev), (select event from ev), 'draft');
-- kind='link' (title + external_url; citation_label null) — the gap-fill redacts title;
-- citation_label stays null (the migration's `case when citation_label is not null` no-ops).
insert into public.rca_evidence (id, rca_id, kind, title, external_url, created_by)
  values ((select evid from ev), (select rca from ev), 'link', 'TITULO-EVID-PHI', 'https://example.com/x', (select sa_x from k));
insert into public.rca_factors (id, rca_id, category, text, position)
  values ((select factor from ev), (select rca from ev), 'process', 'FATOR', 1);
insert into public.rca_why_chains (id, rca_id, factor_id, steps, root_text)
  values ((select why from ev), (select rca from ev), (select factor from ev), '[]'::jsonb, 'PORQUE-RAIZ-PHI');

select test_helpers.claims_for((select sa_x from k), false, 'pqs_member');
set local role authenticated;
select public.dispose_event_phi((select event from ev), 'entered_in_error');
reset role;
select is(
  (select title from public.rca_evidence where id = (select evid from ev)), '[PHI removido]',
  '3.1: dispose_event_phi redacts rca_evidence.title (gap-fill; citation_label redacted when present)');
select is((select root_text from public.rca_why_chains where id = (select why from ev)), '[PHI removido]',
  '3.2: dispose_event_phi redacts rca_why_chains.root_text (gap-fill)');

-- ===========================================================================
-- §4: §6.4 — get_referral_detail hides the frozen byte handle + decline_note from a
-- metadata-only reader. (Uses the seed's referral personas via a hermetic mini-setup.)
-- Build a referral with a VERSION-BOUND document shared item + a decline_note,
-- then read as a NON-PHI reader (a plain member of neither endpoint) vs a PHI reader.
-- ===========================================================================
-- Minimal referral: source comm_x -> a fresh target commission; a document shared item.
create temp table rf on commit drop as
  select gen_random_uuid() as ref, gen_random_uuid() as comm_t, gen_random_uuid() as item,
         gen_random_uuid() as src_case, gen_random_uuid() as doc, gen_random_uuid() as ver;
grant select on rf to authenticated;
insert into public.commissions (id, name, slug, created_by, hospital_id)
  values ((select comm_t from rf), 'Alvo', 'alvo-' || substr((select comm_t from rf)::text,1,8), (select admin from k), (select hosp_b from k));
insert into public.cases (id, commission_id, case_number, created_by)
  values ((select src_case from rf), (select comm_x from k), 9721, (select sa_x from k));
insert into public.case_referral
  (id, code, source_case_id, source_commission_id, target_commission_id, status, subject, type_label, decline_note, created_by)
  values ((select ref from rf), 'ENC-D64', (select src_case from rf), (select comm_x from k), (select comm_t from rf), 'rejected',
          'ASSUNTO', 'Tipo', 'MOTIVO-RECUSA-PHI', (select sa_x from k));
-- DM4 re-expression (ADR 0119; lead-approved as a DELIBERATE edit, not a
-- rename): the byte handle is now the VERSION BINDING, PHI-gated in the
-- projection exactly as the retired storage path was. Plant the minimal
-- document chain (the case's registry row exists via the DM1 trigger) and a
-- version-bound frozen item; the freeze guard is bypassed via the referral
-- RPC GUC as before.
insert into public.documents (id, home_resource_id, title, kind, status, created_by)
  values ((select doc from rf), (select src_case from rf), 'DOC', 'digitalizacao', 'active', (select sa_x from k));
insert into public.document_versions (id, document_id, version_number, created_by)
  values ((select ver from rf), (select doc from rf), 1, (select sa_x from k));
select set_config('app.in_referral_rpc','on',true);
insert into public.referral_shared_item (id, referral_id, kind, source_document_id, frozen_document_version_id, frozen_title, frozen_mime_type, frozen_size_bytes, position)
  values ((select item from rf), (select ref from rf), 'document', (select doc from rf), (select ver from rf), 'DOC', 'application/pdf', 100, 1);
select set_config('app.in_referral_rpc','off',true);

-- A NON-PHI reader: st_x is a plain member of comm_x (source) — can_read_referral (broad)
-- but NOT can_read_referral_phi. Read the detail; the version BINDING + decline_note must be null.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table meta_read on commit drop as
  select public.get_referral_detail((select ref from rf)) as j;
reset role;
grant select on meta_read to authenticated;
select ok(
  (select (j -> 'shared_items' -> 0 ->> 'frozen_document_version_id') from meta_read) is null,
  '4.1: get_referral_detail returns a NULL version binding to a metadata-only reader (§6.4, DM4 successor field)');
-- POSITIVE CONTROL (added at the DM4 re-expression): 4.1 could previously go
-- green on an EMPTY shared_items array — `-> 0 ->> field` of nothing is null.
-- The deny-half must provably deny a row that EXISTS.
select ok(
  (select (j -> 'shared_items' -> 0 ->> 'id') from meta_read) is not null,
  '4.1b POSITIVE CONTROL: the metadata reader DOES see the item row (4.1 denies a present row, not an empty array)');
select ok(
  (select (j ->> 'decline_note') from meta_read) is null,
  '4.2: get_referral_detail returns NULL decline_note to a metadata-only reader (§6.4)');

-- A PHI reader: sa_x is staff_admin of comm_x (source coordinator) -> can_read_referral_phi.
-- It sees the real path + decline_note.
select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
set local role authenticated;
create temp table phi_read on commit drop as
  select public.get_referral_detail((select ref from rf)) as j;
reset role;
grant select on phi_read to authenticated;
select ok(
  (select (j -> 'shared_items' -> 0 ->> 'frozen_document_version_id') from phi_read) = (select ver::text from rf)
  and (select (j ->> 'decline_note') from phi_read) = 'MOTIVO-RECUSA-PHI',
  '4.3: a PHI reader still sees the version binding + decline_note');

select * from finish();
rollback;
