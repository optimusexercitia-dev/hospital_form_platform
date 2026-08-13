-- =============================================================================
-- ETH·E2 — BE-7 (N ethics scan arm) + BE-8 (get_ethics_case_procedure) gate. Fresh reset.
-- =============================================================================
begin;
select plan(9);

update app.feature_flags set enabled = true where key in ('ethics', 'notifications', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'sa_y')::uuid as sa_y, (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

reset role;
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values ('00000000-0000-0000-0000-0000000e2001', (select comm_x from k), 92601, (select sa_x from k),
        'explicit_grants_only', 'ethics_investigation'),
       ('00000000-0000-0000-0000-0000000e2002', (select comm_x from k), 92602, (select sa_x from k),
        'commission_default', 'non_phi_internal');
insert into public.ethics_case_details (case_id) values ('00000000-0000-0000-0000-0000000e2001');
-- A notice due TODAY, no platform-user recipient → routes to the coordinator (sa_x).
insert into public.ethics_notifications (id, case_id, notification_type, delivery_method, status, sent_at, due_at)
values ('00000000-0000-0000-0000-0000000e2400', '00000000-0000-0000-0000-0000000e2001',
        'respondent_notification', 'letter', 'sent', now(), current_date::timestamptz);

-- ---- BE-7: the ethics scan arm ----
select is(app.compute_due_ethics_notifications(), 1,
  'scan arm: a due ethics notice enqueues exactly one reminder');
select is((select count(*)::int from public.notifications
           where kind = 'ethics' and entity_type = 'ethics_notification'
             and entity_id = '00000000-0000-0000-0000-0000000e2001'
             and user_id = (select sa_x from k)), 1,
  'scan arm: the reminder routes to the coordinator fallback (PHI-free, kind=ethics)');
select is(app.compute_due_ethics_notifications(), 0,
  'scan arm: idempotent — a second run enqueues nothing (dedup)');
select ok(not exists (
  select 1 from public.notifications
  where kind = 'ethics' and (title ilike '%denunciado%' or body ilike '%paciente%' or body ilike '%nome%')),
  'scan arm (Rule 12): the reminder body is PHI-free (the notice TYPE, never identity)');

update app.feature_flags set enabled = false where key = 'ethics';
select is(app.compute_due_ethics_notifications(), 0,
  'scan arm: flag-OFF enqueues nothing');
update app.feature_flags set enabled = true where key = 'ethics';

-- ---- BE-8: get_ethics_case_procedure ----
select test_helpers.claims_for((select sa_x from k), false);
select isnt(public.get_ethics_case_procedure('00000000-0000-0000-0000-0000000e2001'), null,
  'read projection: a coordinator gets the ethics procedure envelope');
select is(public.get_ethics_case_procedure('00000000-0000-0000-0000-0000000e2001') ->> 'caseId',
          '00000000-0000-0000-0000-0000000e2001',
  'read projection: the envelope carries the caseId');
select is(public.get_ethics_case_procedure('00000000-0000-0000-0000-0000000e2002'), null,
  'read projection: a NON-ethics case returns null');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
select is(public.get_ethics_case_procedure('00000000-0000-0000-0000-0000000e2001'), null,
  'read projection: a foreign-commission user gets null (can_read_case-gated)');
reset role;

select * from finish();
rollback;
