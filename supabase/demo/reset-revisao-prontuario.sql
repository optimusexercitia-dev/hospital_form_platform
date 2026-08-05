-- ===========================================================================
-- RESET — remove the "Comissão de Revisão de Prontuário" demo dataset.
-- ===========================================================================
-- Run this before re-applying seed-revisao-prontuario.sql. It suspends triggers
-- and FK enforcement (session_replication_role = replica) so the demo tenant can
-- be torn down in one pass, past the meeting/case/document state-machine guards
-- and the append-only audit trigger. Run as a SUPERUSER (local: postgres).
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 --single-transaction \
--        -f supabase/demo/reset-revisao-prontuario.sql
-- ===========================================================================
do $reset$
declare
  v_org  uuid := 'd5000000-0000-0000-0000-000000000001';
  v_comm uuid := 'd5000000-0000-0000-0000-000000000003';
  v_users uuid[] := (select array_agg(id) from auth.users where email like '%@saorafael.demo');
begin
  set local session_replication_role = replica;

  -- Responses + answers
  delete from public.answer_selected_options a
    using public.answers an, public.responses r
    where a.answer_id = an.id and an.response_id = r.id and r.commission_id = v_comm;
  delete from public.answers where response_id in (select id from public.responses where commission_id = v_comm);
  delete from public.response_section_signoffs where response_id in (select id from public.responses where commission_id = v_comm);
  delete from public.responses where commission_id = v_comm;

  -- Cases + children
  delete from public.case_narratives          where case_id in (select id from public.cases where commission_id = v_comm);
  delete from public.case_custom_field_values where case_id in (select id from public.cases where commission_id = v_comm);
  delete from public.case_offered_outcomes    where case_id in (select id from public.cases where commission_id = v_comm);
  delete from public.case_phases              where case_id in (select id from public.cases where commission_id = v_comm);
  delete from public.cases where commission_id = v_comm;

  -- Meetings + children
  delete from public.meeting_cases        where meeting_id in (select id from public.meetings where commission_id = v_comm);
  delete from public.meeting_attendees    where meeting_id in (select id from public.meetings where commission_id = v_comm);
  delete from public.meeting_agenda_items where meeting_id in (select id from public.meetings where commission_id = v_comm);
  delete from public.meetings where commission_id = v_comm;

  -- Action items
  delete from public.action_items where commission_id = v_comm;

  -- Controlled documents + charter
  delete from public.document_approvals where document_version_id in (
    select v.id from public.controlled_document_versions v
    join public.controlled_documents d on d.id = v.document_id where d.commission_id = v_comm);
  delete from public.controlled_document_versions where document_id in (select id from public.controlled_documents where commission_id = v_comm);
  delete from public.commission_charters where commission_id = v_comm;
  delete from public.controlled_documents where commission_id = v_comm;

  -- Indicators
  delete from public.indicator_measurements where indicator_id in (select id from public.indicators where commission_id = v_comm);
  delete from public.indicators where commission_id = v_comm;

  -- Process template + form definitions. ADR 0096: the four child tables hang off
  -- a VERSION, so they resolve through process_template_versions rather than
  -- straight to the identity row. The versions themselves are deleted before the
  -- identity, whose FK to them is ON DELETE CASCADE but whose versions are held by
  -- cases.template_version_id ON DELETE RESTRICT — the cases above are already gone
  -- by this point, which is what makes the version delete legal.
  delete from public.process_template_narratives    where template_version_id in (select v.id from public.process_template_versions v join public.process_templates t on t.id = v.template_id where t.commission_id = v_comm);
  delete from public.process_template_custom_fields  where template_version_id in (select v.id from public.process_template_versions v join public.process_templates t on t.id = v.template_id where t.commission_id = v_comm);
  delete from public.process_template_outcomes       where template_version_id in (select v.id from public.process_template_versions v join public.process_templates t on t.id = v.template_id where t.commission_id = v_comm);
  delete from public.process_template_phases         where template_version_id in (select v.id from public.process_template_versions v join public.process_templates t on t.id = v.template_id where t.commission_id = v_comm);
  delete from public.process_template_versions where template_id in (select id from public.process_templates where commission_id = v_comm);
  delete from public.process_templates where commission_id = v_comm;
  delete from public.case_outcomes        where commission_id = v_comm;
  delete from public.case_narrative_types where commission_id = v_comm;

  delete from public.form_item_options where item_id in (
    select fi.id from public.form_items fi join public.form_versions fv on fv.id = fi.form_version_id
    join public.forms f on f.id = fv.form_id where f.commission_id = v_comm);
  delete from public.form_items    where form_version_id in (select fv.id from public.form_versions fv join public.forms f on f.id = fv.form_id where f.commission_id = v_comm);
  delete from public.form_sections where form_version_id in (select fv.id from public.form_versions fv join public.forms f on f.id = fv.form_id where f.commission_id = v_comm);
  delete from public.form_versions where form_id in (select id from public.forms where commission_id = v_comm);
  delete from public.forms where commission_id = v_comm;

  -- Commission scaffolding
  delete from public.commission_member_titles    where commission_id = v_comm;
  delete from public.commission_meeting_settings where commission_id = v_comm;
  delete from public.commission_meeting_types    where commission_id = v_comm;
  delete from public.memberships where commission_id = v_comm or organization_id = v_org;

  -- Notifications + audit rows for the demo tenant
  delete from public.notifications where commission_id = v_comm;
  delete from public.audit_log where commission_id = v_comm;

  -- Tenant + users
  delete from public.commissions where id = v_comm;
  delete from public.professional_credentials where user_id = any (v_users);
  delete from public.hospitals where organization_id = v_org;
  delete from public.organizations where id = v_org;
  delete from auth.identities where user_id = any (v_users);
  delete from public.profiles where id = any (v_users);
  delete from auth.users where id = any (v_users);

  set local session_replication_role = default;
end;
$reset$;

-- ---------------------------------------------------------------------------
-- Feature flags — restore any flag the seed flipped ON. They are PLATFORM-GLOBAL
-- (not tenant-scoped), so leaving them on would outlive the demo tenant. Guarded
-- by to_regclass so this reset still works on a database the seed never touched.
-- ---------------------------------------------------------------------------
do $flags$
begin
  if to_regclass('app.demo_saorafael_flag_backup') is not null then
    update app.feature_flags f set enabled = b.prior_enabled
      from app.demo_saorafael_flag_backup b
     where b.key = f.key;
    drop table app.demo_saorafael_flag_backup;
  end if;
end;
$flags$;
