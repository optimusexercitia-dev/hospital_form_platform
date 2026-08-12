-- Cases-Extras R1: case_events. (F2/ADR 0063: case DOCUMENTS were folded into
-- public.attachments — their RLS/soft-delete/scoping coverage moved to
-- 208_attachments.sql. This file now covers case_events only.)
-- Covers: RLS member-read / staff_admin-write; cross-commission isolation;
-- staff_admin edit + hard-delete; plain staff cannot insert; and the
-- BUG-CASEKIND-001 keystone — a user-role write may carry only a MANUAL kind.

begin;
select plan(9);

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

-- =========================================================================
-- 5) BUG-CASEKIND-001: `kind` write authority is enforced in the DB, not only
--    in TypeScript. The 16-value CHECK constrains the DOMAIN of `kind`; the
--    policy arm constrains WHO MAY WRITE WHICH VALUE. The ten system kinds
--    (registry echoes + E3a ethics procedural) are emitted ONLY by the
--    SECURITY DEFINER RPCs, which bypass RLS.
--
--    The persona here is sa_x, the STRONGEST user role on this case — so a
--    refusal below is about the KIND, never about capability. Test 5b is the
--    positive control that proves the session can still write at all.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select throws_ok(
  format($$
    insert into public.case_events (case_id, kind, body, created_by)
    values (%L, 'decision_issued', 'Decisao forjada', %L)
  $$, (select cid from cse), (select sa_x from k)),
  '42501',
  null,
  'BUG-CASEKIND-001: a staff_admin cannot INSERT a system kind (decision_issued)'
);

select lives_ok(
  format($$
    insert into public.case_events (id, case_id, kind, body, created_by)
    values ('11111111-2222-3333-4444-555555555555', %L, 'follow_up', 'Acompanhamento', %L)
  $$, (select cid from cse), (select sa_x from k)),
  'BUG-CASEKIND-001 control: a MANUAL kind still inserts (capability intact)'
);

-- Weakest mutator: an INSERT-only arm is defeated by insert-then-update.
select throws_ok(
  $$ update public.case_events set kind = 'decision_issued'
      where id = '11111111-2222-3333-4444-555555555555' $$,
  '42501',
  null,
  'BUG-CASEKIND-001: a manual event cannot be UPDATED into a system kind'
);
reset role;

-- Structural: a future DROP+CREATE of any write policy must not lose the arm.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'case_events'
      and with_check like '%is_manual_case_event_kind%'),
  4,
  'BUG-CASEKIND-001: all four case_events write policies carry the kind arm'
);

select * from finish();
rollback;
