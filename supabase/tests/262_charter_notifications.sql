-- Committee Charters & Meeting Cadence (S4·CH, Phase 21) — cadence-overdue N arm (CH-BE-4).
-- Migration 20260818000200_charter_notifications.sql. Plan §6/§9; ADR 0080 D8.
--
-- Covers: an em_atraso commission → each staff_admin (not other members) gets exactly one
-- charter/overdue reminder; idempotent (re-run → still one per recipient, weekly dedup);
-- PHI-free body (commission name + fixed string only); an em_dia commission → zero; flag-OFF
-- → zero. Runs through the public.compute_due_notifications() aggregator (tests the wiring).
-- The fixture enables `charters` (else the flag-gated arm is skipped) + `notifications`
-- (the aggregator + enqueue_notification gate on it).

begin;
select plan(10);

update app.feature_flags set enabled = true where key in ('charters', 'notifications');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
create temp table k on commit drop as
  select (v->>'org_b')::uuid as org_b, (v->>'hosp_b')::uuid as hosp_b from ctx;

-- Recipients: two staff_admins + one plain staff for the overdue commission.
create temp table u on commit drop as
  select gen_random_uuid() as admin_a, gen_random_uuid() as admin_b, gen_random_uuid() as plain_c;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', x, 'authenticated', 'authenticated', x || '@test', now(), now()
  from (select admin_a as x from u union all select admin_b from u union all select plain_c from u) s;
update public.profiles set home_organization_id = (select org_b from k)
  where id in (select admin_a from u union all select admin_b from u union all select plain_c from u);

-- Three commissions: over (em_atraso), ok (em_dia), off (em_atraso, tested flag-off).
create temp table cc on commit drop as
  select gen_random_uuid() as over_c, gen_random_uuid() as ok_c, gen_random_uuid() as off_c;

-- comm_over: charter mensal + a held commission_default meeting 70 days ago (em_atraso).
insert into public.commissions (id, name, slug, created_by, hospital_id)
  select over_c, 'Comissão Atrasada', 'over-'||substr(over_c::text,1,8), (select admin_a from u), (select hosp_b from k) from cc;
insert into public.memberships (commission_id, principal_id, role)
  select over_c, (select admin_a from u), 'staff_admin' from cc
  union all select over_c, (select admin_b from u), 'staff_admin' from cc
  union all select over_c, (select plain_c from u), 'staff' from cc;
insert into public.commission_charters (commission_id, meeting_frequency, created_by)
  select over_c, 'mensal', (select admin_a from u) from cc;
insert into public.meetings (commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
  select over_c, 'Plenária', 'presencial', now() - interval '70 days', 'held', 'commission_default', now() - interval '70 days' from cc;

-- comm_ok: charter mensal + a held commission_default meeting 10 days ago (em_dia).
insert into public.commissions (id, name, slug, created_by, hospital_id)
  select ok_c, 'Comissão Em Dia', 'ok-'||substr(ok_c::text,1,8), (select admin_a from u), (select hosp_b from k) from cc;
insert into public.memberships (commission_id, principal_id, role)
  select ok_c, (select admin_a from u), 'staff_admin' from cc;
insert into public.commission_charters (commission_id, meeting_frequency, created_by)
  select ok_c, 'mensal', (select admin_a from u) from cc;
insert into public.meetings (commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
  select ok_c, 'Plenária', 'presencial', now() - interval '10 days', 'held', 'commission_default', now() - interval '10 days' from cc;

-- ---- Run the aggregator (run 1). ----
select public.compute_due_notifications();

select is(
  (select count(*)::int from public.notifications
     where user_id = (select admin_a from u) and kind = 'charter' and entity_id = (select over_c from cc)),
  1, 'staff_admin A gets exactly one charter/overdue reminder');
select is(
  (select count(*)::int from public.notifications
     where user_id = (select admin_b from u) and kind = 'charter' and entity_id = (select over_c from cc)),
  1, 'staff_admin B gets exactly one charter/overdue reminder');
select is(
  (select count(*)::int from public.notifications
     where user_id = (select plain_c from u) and kind = 'charter' and entity_id = (select over_c from cc)),
  0, 'a plain staff member gets NO charter reminder');
select is(
  (select count(distinct user_id)::int from public.notifications
     where kind = 'charter' and entity_id = (select over_c from cc)),
  2, 'recipient set is exactly the two staff_admins');
select is(
  (select count(*)::int from public.notifications
     where user_id = (select admin_a from u) and entity_id = (select over_c from cc)
       and kind = 'charter' and entity_type = 'commission' and milestone = 'overdue' and is_reminder = true),
  1, 'the reminder carries kind=charter / entity_type=commission / milestone=overdue / is_reminder');
select is(
  (select body from public.notifications
     where user_id = (select admin_a from u) and kind = 'charter' and entity_id = (select over_c from cc)),
  'A comissão Comissão Atrasada está com a cadência de reuniões em atraso.',
  'body is the PHI-free fixed string (commission name only — no case/patient data)');
select is(
  (select title from public.notifications
     where user_id = (select admin_a from u) and kind = 'charter' and entity_id = (select over_c from cc)),
  'Reunião em atraso', 'title is the fixed pt-BR string');
select is(
  (select count(*)::int from public.notifications where kind = 'charter' and entity_id = (select ok_c from cc)),
  0, 'an em_dia commission produces zero charter notifications');

-- ---- Idempotency: run the aggregator again → dedup holds. ----
select public.compute_due_notifications();
select is(
  (select count(*)::int from public.notifications where kind = 'charter' and entity_id = (select over_c from cc)),
  2, 'a second aggregator run is idempotent (still exactly one per staff_admin)');

-- ---- Flag-OFF: a fresh em_atraso commission gets nothing. ----
insert into public.commissions (id, name, slug, created_by, hospital_id)
  select off_c, 'Comissão Flag-Off', 'off-'||substr(off_c::text,1,8), (select admin_a from u), (select hosp_b from k) from cc;
insert into public.memberships (commission_id, principal_id, role)
  select off_c, (select admin_a from u), 'staff_admin' from cc;
insert into public.commission_charters (commission_id, meeting_frequency, created_by)
  select off_c, 'mensal', (select admin_a from u) from cc;
insert into public.meetings (commission_id, title, modality, scheduled_start, status, visibility_policy, held_at)
  select off_c, 'Plenária', 'presencial', now() - interval '70 days', 'held', 'commission_default', now() - interval '70 days' from cc;

update app.feature_flags set enabled = false where key = 'charters';
select public.compute_due_notifications();
select is(
  (select count(*)::int from public.notifications where kind = 'charter' and entity_id = (select off_c from cc)),
  0, 'flag OFF → no charter notification arm (zero for a fresh em_atraso commission)');

select * from finish();
rollback;
