-- Cases-Extras R4: case_action_items.
-- Covers: status CHECK; assignee can advance/complete THEIR OWN item but is
-- blocked on another's (HC027); staff_admin full CRUD; KPI counts
-- (open / overdue / completed-YTD); RLS isolation.
-- Function signature: create_action_item(uuid, text, text, uuid, date, uuid)
--   = (case_id, title, description, assigned_to, due_date, source_case_phase_id)

begin;
select plan(19);

-- Enable both feature flags.
update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');
-- Assert the PRE-Case-Access-Control member-read model (a plain staff member reads
-- case_action_items of their commission). With case_access ON those reads tighten to
-- app.can_read_case; keep it OFF here (the ACL behavior is covered by 144_case_access).
update app.feature_flags set enabled = false where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- Build a case in commission X.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'AI E2E', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'F1');
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso AI')).id as cid;
reset role;
grant select on cse to authenticated;

-- =========================================================================
-- 1) STAFF_ADMIN creates an action item assigned to st_x
--    Signature: (p_case_id, p_title, p_description, p_assigned_to, p_due_date, p_source_phase)
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table item1 on commit drop as
  select (public.create_action_item(
    (select cid from cse),                       -- p_case_id
    'Implantar protocolo lavagem',               -- p_title
    'Rever protocolo existente.'::text,          -- p_description
    (select st_x from k),                        -- p_assigned_to
    null::date,                                  -- p_due_date
    null::uuid                                   -- p_source_case_phase_id
  )).id as iid;
reset role;
grant select on item1 to authenticated;

select ok(
  (select iid from item1) is not null,
  'staff_admin can create an action item via create_action_item'
);

-- Verify initial status is 'open'.
select is(
  (select status from public.case_action_items where id = (select iid from item1)),
  'open',
  'newly created action item has status = open'
);

-- =========================================================================
-- 2) STATUS CHECK: invalid status value rejected
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.case_action_items
      (case_id, title, status, assigned_to, created_by)
    values (%L, 'Bad status', 'em_progresso', %L, %L)
  $$, (select cid from cse), (select st_x from k), (select sa_x from k)),
  '23514',
  null,
  'case_action_items status CHECK rejects invalid values'
);
reset role;

-- =========================================================================
-- 3) ASSIGNEE advances THEIR OWN item (open → in_progress)
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.advance_action_item(%L, 'in_progress') $$, (select iid from item1)),
  'assignee can advance their own action item (open → in_progress)'
);
reset role;

select is(
  (select status from public.case_action_items where id = (select iid from item1)),
  'in_progress',
  'action item status is now in_progress'
);

-- =========================================================================
-- 4) ASSIGNEE completes THEIR OWN item (in_progress → done)
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.complete_action_item(%L) $$, (select iid from item1)),
  'assignee can complete their own action item (complete_action_item)'
);
reset role;

select is(
  (select status from public.case_action_items where id = (select iid from item1)),
  'done',
  'action item status is now done after complete_action_item'
);

-- completed_at must be stamped.
select isnt(
  (select completed_at from public.case_action_items where id = (select iid from item1)),
  null,
  'complete_action_item stamps completed_at'
);

-- =========================================================================
-- 5) HC027: a user who is NOT the assignee and NOT staff_admin cannot advance
-- =========================================================================
-- Create a second item assigned to st_x2.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table item2 on commit drop as
  select (public.create_action_item(
    (select cid from cse),
    'Item de outro',
    'Atribuído ao usuário X2.'::text,
    (select st_x2 from k),
    null::date,
    null::uuid
  )).id as iid;
reset role;
grant select on item2 to authenticated;

-- st_x (not the assignee, not staff_admin) tries to advance → HC027.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.advance_action_item(%L, 'in_progress') $$, (select iid from item2)),
  'HC027',
  null,
  'non-assignee non-staff_admin cannot advance another user''s action item (HC027)'
);
reset role;

-- =========================================================================
-- 6) STAFF_ADMIN can advance any action item (full CRUD override)
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.advance_action_item(%L, 'in_progress') $$, (select iid from item2)),
  'staff_admin can advance any action item regardless of assignee'
);
reset role;

-- =========================================================================
-- 7) RLS: member can READ action items; cross-commission member cannot
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_action_items
   where case_id = (select cid from cse)) >= 1,
  'staff member can read case_action_items of their own commission'
);
reset role;

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_action_items
   where case_id = (select cid from cse)),
  0,
  'cross-commission member cannot read case_action_items (RLS)'
);
reset role;

-- =========================================================================
-- 8) KPI COUNTS: case_action_items_kpis returns correct aggregates
-- =========================================================================
-- At this point: item1 = done; item2 = in_progress.
-- Create a third item that is overdue (past due_date, status open).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.create_action_item(
  (select cid from cse),
  'Item vencido',
  'Prazo passado.'::text,
  (select st_x from k),
  (current_date - 7)::date,
  null::uuid
);
reset role;

-- staff_admin gets the KPI.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table kpi on commit drop as
  select * from public.case_action_items_kpis((select comm_x from k));
reset role;
grant select on kpi to authenticated;

-- open count: item2 (in_progress) + item3 (open) = 2 non-done items.
select ok(
  (select open from kpi) >= 2,
  'case_action_items_kpis open >= 2 (item2 in_progress + item3 open)'
);

-- overdue: item3 has due_date < today and is not done/cancelled.
select ok(
  (select overdue from kpi) >= 1,
  'case_action_items_kpis overdue >= 1 (item3 is past due)'
);

-- completed_ytd: item1 was completed (done) this year.
select ok(
  (select completed_ytd from kpi) >= 1,
  'case_action_items_kpis completed_ytd >= 1 (item1 completed this year)'
);

-- =========================================================================
-- 9) KPI returns zeroed row to non-staff_admin
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table kpi_staff on commit drop as
  select * from public.case_action_items_kpis((select comm_x from k));
reset role;
grant select on kpi_staff to authenticated;

select is(
  (select open from kpi_staff),
  0::bigint,
  'case_action_items_kpis returns zeroed row to plain staff (gated)'
);

-- =========================================================================
-- 10) PLAIN STAFF cannot create action items (RPC is staff_admin-gated)
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$
    select public.create_action_item(%L, 'Staff create', null::text, %L, null::date, null::uuid)
  $$, (select cid from cse), (select st_x from k)),
  '42501',
  null,
  'plain staff cannot create action items (create_action_item is staff_admin-gated)'
);
reset role;

-- =========================================================================
-- 11) CANCEL via advance_action_item is a valid lifecycle path
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table item_cancel on commit drop as
  select (public.create_action_item(
    (select cid from cse),
    'Para cancelar',
    'Este item será cancelado.'::text,
    (select st_x from k),
    null::date,
    null::uuid
  )).id as iid;
reset role;
grant select on item_cancel to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.advance_action_item(%L, 'cancelled') $$,
         (select iid from item_cancel)),
  'staff_admin can cancel an action item via advance_action_item'
);
reset role;

select is(
  (select status from public.case_action_items where id = (select iid from item_cancel)),
  'cancelled',
  'action item status is cancelled after advance_action_item(cancelled)'
);

select * from finish();
rollback;
