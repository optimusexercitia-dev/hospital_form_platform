-- =============================================================================
-- AUTHZ · Gate 2 · Stage C · C2 — meeting_agenda_items content, tiered.
-- ADR 0078 keystone 14 + the NEW title/respondent keystone (A4·1 overruled by
-- A7/O6: the respondent must NOT read his own process number off the pauta — no
-- prior keystone caught this). Reads go through get_meeting_agenda_items.
--
-- TWO TIERS, on case-linked items only:
--   • title            — process number. Propriety: NULL for the respondent.
--   • discussion_notes / resolution — substance: NULL without read_case_deliberation.
-- A non-case-linked item stays member-wide (no masking).
-- Falsifiable: dropping the title mask → the respondent reads his process number → RED.
-- =============================================================================
begin;
select plan(16);

update app.feature_flags set enabled = true
  where key in ('meetings', 'case_participants', 'case_access', 'case_patient');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x,   (v->>'st_x')::uuid as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'sa_y')::uuid as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- FIXTURE ---------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-0000000c2e91', (select comm_x from k), 9751, (select sa_x from k), 'explicit_grants_only');

insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-0000000c2a30', (select comm_x from k), 9752, 'Plenária C2', now());

-- Case-linked agenda item (title = process number; notes/resolution = substance).
insert into public.meeting_agenda_items (id, meeting_id, position, title, discussion_notes, resolution)
values ('00000000-0000-0000-0000-0000000c2b41', '00000000-0000-0000-0000-0000000c2a30', 1,
        'Processo 099', 'NOTAS_DELIB', 'RESOLUCAO');
-- Non-case-linked agenda item (member-wide, no masking).
insert into public.meeting_agenda_items (id, meeting_id, position, title, discussion_notes)
values ('00000000-0000-0000-0000-0000000c2c42', '00000000-0000-0000-0000-0000000c2a30', 2,
        'Aprovacao da ata', 'rotina');
insert into public.meeting_cases (meeting_id, case_id, agenda_item_id)
values ('00000000-0000-0000-0000-0000000c2a30', '00000000-0000-0000-0000-0000000c2e91', '00000000-0000-0000-0000-0000000c2b41');

-- Make st_x the RESPONDENT of the case (professional participant chain).
insert into public.professional_profiles (id, organization_id, full_name, user_id)
values ('00000000-0000-0000-0000-0000000c2f50', (select org_x from k), 'Dr. Respondente', (select st_x from k));
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000c2f51', (select org_x from k), 'professional', 'professional_identity', 'Dr. Respondente');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000c2f51', '00000000-0000-0000-0000-0000000c2f50');
-- respondent_doctor role is org-scoped; bootstrap's org needs its own (the same-org
-- guard trg_assert_participant_same_org_as_case rejects the seed org's role).
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
values ('00000000-0000-0000-0000-0000000c2f60', (select org_x from k), 'respondent_doctor',
        'Denunciado', array['professional']);
insert into public.case_participants (case_id, participant_id, role_id)
values ('00000000-0000-0000-0000-0000000c2e91', '00000000-0000-0000-0000-0000000c2f51',
        '00000000-0000-0000-0000-0000000c2f60');

-- sa_y is MADE a comm_x member (to reach the meeting) with a read grant on the
-- case — the grant is his only deliberation arm.
insert into public.memberships (principal_id, commission_id, role)
values ((select sa_y from k), (select comm_x from k), 'staff');
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000c2e91', (select sa_y from k), 'read',
       (select sa_x from k), null, null, false);

-- PRE-FLIGHT ------------------------------------------------------------------
select is(app.is_case_respondent('00000000-0000-0000-0000-0000000c2e91', (select st_x from k)), true,
  'PRE ⭐: st_x IS the respondent of the case');
select is(app.is_case_respondent('00000000-0000-0000-0000-0000000c2e91', (select st_x2 from k)), false,
  'PRE ⭐: st_x2 is NOT the respondent — isolates the title gate from the substance gate');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000c2e91', (select st_x2 from k), 'read_case_deliberation'), false,
  'PRE ⭐: st_x2 has NO deliberation on the sub-group case');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000c2e91', (select sa_y from k), 'read_case_deliberation'), true,
  'PRE ⭐: the grantee HAS deliberation');

-- STRUCTURAL — direct read REVOKE'd.
select is((select count(*)::int from information_schema.column_privileges
           where table_name='meeting_agenda_items' and column_name in ('title','discussion_notes','resolution')
             and grantee='authenticated' and privilege_type='SELECT'), 0,
  'C2 STRUCTURAL: authenticated has NO direct SELECT on title/discussion_notes/resolution');

-- RESPONDENT: title masked (NEW keystone), substance masked.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select title from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), null,
  'NEW ⭐: the RESPONDENT reads NULL title — he cannot read his own process number off the pauta (A7/O6)');
select is((select discussion_notes from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), null,
  'K14 ⭐: …and NULL discussion_notes');
select is((select count(*)::int from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), 1,
  'A6 ⭐: …but still sees the agenda ROW (skeleton member-wide)');
reset role;
select set_config('request.jwt.claims', '', true);

-- NON-RESPONDENT member without deliberation: title VISIBLE, substance masked.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select title from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), 'Processo 099',
  'NEW ⭐: a non-respondent member READS the process number (title propriety gate is respondent-only)');
select is((select discussion_notes from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), null,
  'K14 ⭐: …but NULL discussion_notes without deliberation');
-- Non-case-linked item is member-wide.
select is((select title from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2c42'), 'Aprovacao da ata',
  'NO-REGRESSION: a non-case-linked item is member-wide (title read)');
select is((select discussion_notes from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2c42'), 'rotina',
  'NO-REGRESSION: …and its notes');
reset role;
select set_config('request.jwt.claims', '', true);

-- GRANTEE with deliberation: substance visible.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select discussion_notes from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), 'NOTAS_DELIB',
  'K14 POSITIVE: the grantee reads discussion_notes (read_case_deliberation)');
select is((select resolution from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), 'RESOLUCAO',
  'K14 POSITIVE: …and the resolution');
reset role;
select set_config('request.jwt.claims', '', true);

-- COORDINATOR: full read (no-regression).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select title from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), 'Processo 099',
  'NO-REGRESSION: the coordinator reads the process number');
select is((select resolution from public.get_meeting_agenda_items('00000000-0000-0000-0000-0000000c2a30')
           where id='00000000-0000-0000-0000-0000000c2b41'), 'RESOLUCAO',
  'NO-REGRESSION: …and the resolution');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
