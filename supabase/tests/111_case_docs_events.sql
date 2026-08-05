-- Cases-Extras R1: case_events. (F2/ADR 0063: case DOCUMENTS were folded into
-- public.attachments — their RLS/soft-delete/scoping coverage moved to
-- 208_attachments.sql. This file now covers case_events only.)
-- Covers: RLS member-read / staff_admin-write; cross-commission isolation;
-- staff_admin edit + hard-delete; plain staff cannot insert.

begin;
select plan(5);

-- Enable both feature flags for this transaction.
update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');
-- ADR 0078 Stage B: the flag-OFF "member-read" model is GONE. A case member reads case
-- content only via a grant/assignment/coordination now (member arm = deliberation only).
-- The reader below (st_x) is made a grantee so "an authorized member reads events" holds.

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- Build a case in commission X.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Docs E2E', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl set vid = app.draft_version_of_template(tid);
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select vid from tpl), (select form_u from k), 'F1');
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Docs')).id as cid;
reset role;
grant select on cse to authenticated;

-- Stage B: st_x is a plain member — make him a case grantee so he can read case content.
select test_helpers.grant_ca((select cid from cse), (select st_x from k), 'read', (select sa_x from k));

-- =========================================================================
-- 1) CASE_EVENTS: staff_admin can insert an event; staff can read
-- =========================================================================
insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
  select cse.cid, 'note', 'Reunião interna', 'Discutida a causa do óbito.', current_date, k.sa_x
  from cse, k;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_events
   where case_id = (select cid from cse)) >= 1,
  'staff member can read case_events of their own commission'
);
reset role;

-- =========================================================================
-- 2) PLAIN STAFF cannot insert a case_event
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.case_events (case_id, kind, body, created_by)
    values (%L, 'note', 'Staff note attempt', %L)
  $$, (select cid from cse), (select st_x from k)),
  '42501',
  null,
  'plain staff member cannot insert a case_event (RLS blocks)'
);
reset role;

-- =========================================================================
-- 3) CASE_EVENTS: cross-commission isolation
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_events
   where case_id = (select cid from cse)),
  0,
  'RLS: cross-commission member cannot read case_events'
);
reset role;

-- =========================================================================
-- 4) CASE_EVENTS: staff_admin can EDIT (UPDATE) and DELETE an event
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$
    update public.case_events set body = 'Editado' where case_id = %L
  $$, (select cid from cse)),
  'staff_admin can UPDATE (edit) a case_event'
);
select lives_ok(
  format($$
    delete from public.case_events where case_id = %L
  $$, (select cid from cse)),
  'staff_admin can DELETE (hard-delete) a case_event'
);
reset role;

select * from finish();
rollback;
