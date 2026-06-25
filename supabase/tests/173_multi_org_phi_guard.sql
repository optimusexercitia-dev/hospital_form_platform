-- Multi-org PHI safety guard (gate-blocking; migration 20260629000000). Proves the
-- cross-org PHI leak is CLOSED when >1 org exists: the GLOBAL-PQS/QPS roster terms
-- go inert, while ORG-BOUNDED terms (member/custody/reporting/staff_admin/assignee)
-- are untouched, and the NSP+referral modules report off + their RPC asserts raise.
--
-- Fixture: bootstrap() (1 org, comm_x/comm_y) + a SECOND org so is_multi_org()=true.
-- A PQS-held event (custody NULL) reported by comm_x, with an isolated event_patient.
-- `admin` is enrolled in pqs_members (the GLOBAL roster) but is NOT a member/custodian
-- of comm_x — so in multi-org it must read NOTHING via the global-PQS term.

begin;
select plan(18);

-- Flags ON so the modules would be active in single-org; the guard is what turns
-- them off in multi-org (NOT the flag).
update app.feature_flags set enabled = true where key in ('patient_safety','case_referrals','case_access','audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid as admin, (v->>'sa_x')::uuid as sa_x,
         (v->>'st_x')::uuid as st_x, (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- =====================================================================
-- (A) is_multi_org reflects the org count; *_enabled() follow it.
-- =====================================================================
-- (A) SINGLE-ORG baseline (bootstrap truncates the seed → exactly ONE org).
-- Build the event + PHI + enroll the global PQS member while single-org, and
-- confirm the module + the global roster work as today.
-- =====================================================================
select ok(not app.is_multi_org(), 'is_multi_org() = false with a single org (bootstrap)');
select ok(public.patient_safety_enabled(), 'patient_safety_enabled() TRUE in single-org (flag on)');
select ok(public.referrals_enabled(), 'referrals_enabled() TRUE in single-org (flag on)');

create temp table ev on commit drop as select gen_random_uuid() as id;
grant select on ev to authenticated;
-- PQS-held event (custody NULL) reported by comm_x.
insert into public.patient_safety_event
  (id, code, reporting_commission_id, discovered_at, title, status,
   current_owner_kind, current_owner_commission_id, reported_by)
values
  ((select id from ev), 'EV-GUARD', (select comm_x from k), current_date,
   'Evento guard multi-org', 'acknowledged', 'pqs', null, (select st_x from k));
insert into public.event_patient (event_id, name, mrn, sex)
  values ((select id from ev), 'Paciente Guard', 'MRN-GUARD', 'female');
update public.patient_safety_event set has_patient = true where id = (select id from ev);

-- Enroll `admin` in the GLOBAL PQS roster (admin is NOT a member/custodian of
-- comm_x). In SINGLE-org this grants the global-PQS PHI read.
insert into public.pqs_members (user_id) values ((select admin from k));
select ok(app.is_pqs_member((select admin from k)),
  'single-org: admin IS an effective PQS member (global roster active)');
select ok(app.can_read_event_patient((select id from ev), (select admin from k)),
  'single-org baseline: global-PQS member CAN read the event PHI (the access we will withdraw)');

-- =====================================================================
-- (B) Go MULTI-ORG → the global roster + the modules go inert.
-- =====================================================================
insert into public.organizations (id, name, slug) values (gen_random_uuid(), 'Org Two', 'org-two-guard');

select ok(app.is_multi_org(), 'is_multi_org() = true with a second org');
select ok(not app.is_pqs_member((select admin from k)),
  'multi-org: is_pqs_member is INERT at the chokepoint (even though enrolled)');
select ok(not public.patient_safety_enabled(), 'patient_safety_enabled() FALSE in multi-org (module off)');
select ok(not public.referrals_enabled(), 'referrals_enabled() FALSE in multi-org (module off)');

-- =====================================================================
-- (C) READ GUARD — the global-PQS term is INERT in multi-org. The leak is closed.
-- =====================================================================
-- can_read_event: admin (global PQS only, not member/custodian) → FALSE now.
select ok(not app.can_read_event((select id from ev), (select admin from k)),
  'LEAK CLOSED: global-PQS member CANNOT read the event in multi-org (can_read_event)');
-- can_read_event_patient: the tighter identifier predicate → also FALSE for global PQS.
select ok(not app.can_read_event_patient((select id from ev), (select admin from k)),
  'LEAK CLOSED: global-PQS member CANNOT read the event PHI identifiers in multi-org');

-- The audited single DOOR returns NULL for the now-unentitled global PQS caller.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select is(public.get_event_patient((select id from ev)), null,
  'LEAK CLOSED: get_event_patient returns NULL for a global-PQS caller in multi-org');
reset role;

-- =====================================================================
-- (D) ORG-BOUNDED terms UNTOUCHED — the reporting-commission member still reads.
-- =====================================================================
-- st_x is a member of comm_x (the reporting commission) → can_read_event still TRUE.
select ok(app.can_read_event((select id from ev), (select st_x from k)),
  'org-bounded: reporting-commission member STILL reads the event in multi-org');
-- Move custody to comm_x; its staff_admin (sa_x) then reads the identifiers
-- (access-follows-custody — org-bounded, unaffected by the guard).
update public.patient_safety_event
  set current_owner_kind='commission', current_owner_commission_id=(select comm_x from k)
  where id = (select id from ev);
select ok(app.can_read_event_patient((select id from ev), (select sa_x from k)),
  'org-bounded: custodian staff_admin STILL reads the PHI identifiers in multi-org');

-- =====================================================================
-- (E) RPC entry asserts RAISE in multi-org (module-off backstop).
-- =====================================================================
select throws_ok($$ select app.assert_patient_safety_enabled() $$, '23514', null,
  'assert_patient_safety_enabled RAISES in multi-org');
select throws_ok($$ select app.assert_referrals_enabled() $$, '23514', null,
  'assert_referrals_enabled RAISES in multi-org');

-- =====================================================================
-- (F) can_read_case_patient: the QPS macro-term is guarded, but the ORG-BOUNDED
-- worker scope is unaffected — a case-worker (phase assignee) still reads PHI.
-- =====================================================================
create temp table cse on commit drop as select gen_random_uuid() as id;
grant select on cse to authenticated;
-- case_number is auto-minted by trigger; status defaults to nao_iniciado; label
-- (not title) is the case name column.
insert into public.cases (id, commission_id, label, created_by, patient_enabled, has_patient)
  values ((select id from cse), (select comm_x from k), 'Caso guard', (select sa_x from k), true, true);
insert into public.case_patient (case_id, name, mrn)
  values ((select id from cse), 'Paciente Caso', 'MRN-CASE');
-- sa_x is staff_admin of comm_x → an org-bounded reader of case PHI.
select ok(app.can_read_case_patient((select id from cse), (select sa_x from k)),
  'org-bounded: case coordinator STILL reads case PHI identifiers in multi-org');
-- admin (global PQS, no case role, no referral on this case) → FALSE.
select ok(not app.can_read_case_patient((select id from cse), (select admin from k)),
  'LEAK CLOSED: global-PQS member with no case role CANNOT read case PHI in multi-org');

select * from finish();
rollback;
