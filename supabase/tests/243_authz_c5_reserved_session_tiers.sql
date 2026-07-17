-- =============================================================================
-- AUTHZ · Gate 2 · Stage C · C5 — the four-tier reserved-session projection.
-- ADR 0078 A7 (corrected A15/A24·4/A26), keystones 10 / 12 + the A26 keystone +
-- the case-less reader-list path. meeting_closed_session_items has NO authenticated
-- SELECT; get_reserved_session_items projects the tiers.
--
-- TIERS: stub (reach) · propriety = number+withdrawals (reach AND NOT respondent;
-- ⭐ NOT excluded — the recused sees her OWN withdrawal, K10) · substance (reach AND
-- read_case_deliberation) · decision (reach AND NOT excluded). A26: withdrawal NAMES
-- member-wide only for commission_default; explicit_grants_only needs deliberation.
-- case_id IS NULL: substance+decision follow the READER LIST; propriety is EMPTY.
-- =============================================================================
begin;
select plan(24);

update app.feature_flags set enabled = true
  where key in ('meetings', 'case_participants', 'case_access', 'case_patient');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'sa_y')::uuid as sa_y,
         (v->>'comm_x')::uuid as comm_x, app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- FIXTURE ---------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy) values
  ('00000000-0000-0000-0000-00000000c5c1', (select comm_x from k), 9761, (select sa_x from k), 'commission_default'),
  ('00000000-0000-0000-0000-00000000c5e2', (select comm_x from k), 9762, (select sa_x from k), 'explicit_grants_only');

-- case_number is auto-minted (sequential per commission) — capture the real values.
create temp table cn on commit drop as
  select (select case_number from public.cases where id='00000000-0000-0000-0000-00000000c5c1') as cn_cd,
         (select case_number from public.cases where id='00000000-0000-0000-0000-00000000c5e2') as cn_eg;
grant select on cn to authenticated;

insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-00000000c5a0', (select comm_x from k), 9763, 'Plenária C5', now());
insert into public.meeting_closed_sessions (id, meeting_id, opened_by)
values ('00000000-0000-0000-0000-00000000c5b0', '00000000-0000-0000-0000-00000000c5a0', (select sa_x from k));

insert into public.meeting_closed_session_items (id, closed_session_id, case_id, substance, decision, withdrawals) values
  ('00000000-0000-0000-0000-00000000c5aa', '00000000-0000-0000-0000-00000000c5b0', '00000000-0000-0000-0000-00000000c5c1', 'SUB_A', 'DEC_A', 'WD_A'),
  ('00000000-0000-0000-0000-00000000c5bb', '00000000-0000-0000-0000-00000000c5b0', '00000000-0000-0000-0000-00000000c5e2', 'SUB_B', 'DEC_B', 'WD_B');
-- case-less item + reader list [st_x]
insert into public.meeting_closed_session_items (id, closed_session_id, case_id, substance, decision)
values ('00000000-0000-0000-0000-00000000c5cc', '00000000-0000-0000-0000-00000000c5b0', null, 'SUB_C', 'DEC_C');
insert into public.meeting_closed_session_item_readers (item_id, user_id)
values ('00000000-0000-0000-0000-00000000c5cc', (select st_x from k));

-- st_x2 recused from the commission_default case (keystone 10).
insert into public.case_recusals (case_id, user_id, source)
values ('00000000-0000-0000-0000-00000000c5c1', (select st_x2 from k), 'conflict');

-- sa_y made a member + the RESPONDENT of the commission_default case.
insert into public.memberships (principal_id, commission_id, role) values ((select sa_y from k), (select comm_x from k), 'staff');
insert into public.professional_profiles (id, organization_id, full_name, user_id)
values ('00000000-0000-0000-0000-00000000c5f0', (select org_x from k), 'Dr. Resp C5', (select sa_y from k));
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-00000000c5f1', (select org_x from k), 'professional', 'professional_identity', 'Dr. Resp C5');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-00000000c5f1', '00000000-0000-0000-0000-00000000c5f0');
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
values ('00000000-0000-0000-0000-00000000c5f2', (select org_x from k), 'respondent_doctor', 'Denunciado', array['professional']);
insert into public.case_participants (case_id, participant_id, role_id)
values ('00000000-0000-0000-0000-00000000c5c1', '00000000-0000-0000-0000-00000000c5f1', '00000000-0000-0000-0000-00000000c5f2');

-- A participants_only meeting with a reserved item, st_x2 NOT an attendee (keystone 12).
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-00000000c5d0', (select comm_x from k), 9764, 'Sub-grupo C5', now());
insert into public.meeting_attendees (id, meeting_id, user_id)
values ('00000000-0000-0000-0000-00000000c5d3', '00000000-0000-0000-0000-00000000c5d0', (select st_x from k));
update public.meetings set visibility_policy='participants_only' where id='00000000-0000-0000-0000-00000000c5d0';
insert into public.meeting_closed_sessions (id, meeting_id, opened_by)
values ('00000000-0000-0000-0000-00000000c5d1', '00000000-0000-0000-0000-00000000c5d0', (select sa_x from k));
insert into public.meeting_closed_session_items (id, closed_session_id, case_id, substance)
values ('00000000-0000-0000-0000-00000000c5d2', '00000000-0000-0000-0000-00000000c5d1', null, 'SECRET');

-- PRE-FLIGHT ------------------------------------------------------------------
select is(app.is_case_respondent('00000000-0000-0000-0000-00000000c5c1', (select sa_y from k)), true,
  'PRE ⭐: sa_y is the respondent of the commission_default case');
select is(app.is_case_excluded('00000000-0000-0000-0000-00000000c5c1', (select st_x2 from k)), true,
  'PRE ⭐: st_x2 is recused (excluded) from the commission_default case');
select is(app.has_case_capability('00000000-0000-0000-0000-00000000c5e2', (select st_x from k), 'read_case_deliberation'), false,
  'PRE ⭐: the plain member has NO deliberation on the explicit_grants_only case');

-- STRUCTURAL — the items table has NO authenticated SELECT (grant absent AND RLS
-- has no SELECT policy); the RPC is the only path.
select is((select count(*)::int from information_schema.role_table_grants
           where table_schema='public' and table_name='meeting_closed_session_items'
             and grantee='authenticated' and privilege_type='SELECT'), 0,
  'C5 STRUCTURAL: authenticated has NO direct SELECT grant on meeting_closed_session_items');
select is((select count(*)::int from pg_policies
           where schemaname='public' and tablename='meeting_closed_session_items' and cmd in ('SELECT','ALL')), 0,
  'C5 STRUCTURAL: …and no SELECT/ALL RLS policy — the DEFINER RPC is the sole read path');

-- COORDINATOR — all four tiers on item A.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select process_number from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), (select cn_cd from cn),
  'NO-REGRESSION: coordinator reads the process number');
select is((select withdrawals from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), 'WD_A',
  'NO-REGRESSION: …the withdrawal record');
select is((select substance from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), 'SUB_A',
  'NO-REGRESSION: …the substance');
select is((select decision from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), 'DEC_A',
  'NO-REGRESSION: …the decision');
reset role;
select set_config('request.jwt.claims', '', true);

-- RECUSED member on item A — keystone 10: sees her OWN withdrawal + number + stub,
-- but NOT substance or decision.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select process_number from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), (select cn_cd from cn),
  'K10 ⭐: the recused member reads the process number (propriety gates on respondent, NOT excluded)');
select is((select withdrawals from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), 'WD_A',
  'K10 ⭐: …and her OWN recorded withdrawal (commission_default → member-wide)');
select is((select substance from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), null,
  'K10 ⭐: …but NOT the substance (excluded)');
select is((select decision from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), null,
  'K10 ⭐: …nor the decision (excluded)');
select is((select quorum_met from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), true,
  'K10 ⭐: …and still sees the STUB (quorum/times) — she is a meeting reacher');
reset role;
select set_config('request.jwt.claims', '', true);

-- RESPONDENT on item A — propriety hidden (number + withdrawals).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select process_number from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), null,
  'PROPRIETY ⭐: the respondent reads NULL process number (he must not read his own)');
select is((select withdrawals from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), null,
  'PROPRIETY ⭐: …and NULL withdrawals');
reset role;
select set_config('request.jwt.claims', '', true);

-- MEMBER on item B (explicit_grants_only) — A26: number yes, withdrawal NAMES no.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select process_number from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5bb'), (select cn_eg from cn),
  'A26 ⭐: member reads the sub-group process number (not the respondent)');
select is((select withdrawals from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5bb'), null,
  'A26 ⭐ OVER-GRANT: …but NOT the withdrawal names — explicit_grants_only requires read_case_deliberation');
select is((select withdrawals from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5aa'), 'WD_A',
  'A26 ⭐ NO-REGRESSION: …yet the same member reads the PLENARY case withdrawal (commission_default = member-wide)');
select is((select decision from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5bb'), 'DEC_B',
  'K16: …and the sub-group decision (member-wide outcome, not excluded)');
-- case-less item C: the reader reads the substance.
select is((select substance from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5cc'), 'SUB_C',
  'CASE-LESS ⭐: the reader-list member reads the substance');
reset role;
select set_config('request.jwt.claims', '', true);

-- case-less item C: a NON-reader reads the stub only; keystone 12 on M2.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select substance from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5cc'), null,
  'CASE-LESS ⭐ OVER-GRANT: a NON-reader reads NULL substance (reader list, not case authority)');
select is((select process_number from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5a0') where id='00000000-0000-0000-0000-00000000c5cc'), null,
  'CASE-LESS ⭐: propriety is EMPTY for a case-less item (no number, even for a member)');
select is((select count(*)::int from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c5d0')), 0,
  'K12 ⭐: st_x2 (non-attendee) reads NOTHING from the participants_only meeting''s reserved session');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
