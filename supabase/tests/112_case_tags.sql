-- Cases-Extras R3: case_tags and case_tag_assignments.
-- Covers: tag name unique per commission; HC026 commission-match guard;
-- case_tag_report respects date bounds and returns empty set to non-staff_admin.

begin;
select plan(13);

-- Enable both feature flags for this transaction.
update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u,
         (v->>'form_y')::uuid  as form_y
  from ctx;
grant select on k to authenticated;

-- Build cases in commission X and Y for cross-commission tests.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl_x on commit drop as
  select (public.create_process_template((select comm_x from k), 'Tags X', null)).id as tid;
reset role;
grant select on tpl_x to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl_x), (select form_u from k), 'F1');
select public.publish_process_template((select tid from tpl_x));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse_x on commit drop as
  select (public.create_case_from_template((select tid from tpl_x), 'Caso Tag X')).id as cid;
reset role;
grant select on cse_x to authenticated;

-- Template + case in commission Y.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table tpl_y on commit drop as
  select (public.create_process_template((select comm_y from k), 'Tags Y', null)).id as tid;
reset role;
grant select on tpl_y to authenticated;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl_y), (select form_y from k), 'F1');
select public.publish_process_template((select tid from tpl_y));
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table cse_y on commit drop as
  select (public.create_case_from_template((select tid from tpl_y), 'Caso Tag Y')).id as cid;
reset role;
grant select on cse_y to authenticated;

-- =========================================================================
-- 1) CREATE TAG in commission X
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tag_x on commit drop as
  select (public.create_case_tag((select comm_x from k), 'Infecção respiratória', 'blue')).id as tag_id;
reset role;
grant select on tag_x to authenticated;

select ok(
  (select tag_id from tag_x) is not null,
  'create_case_tag succeeds for staff_admin'
);

-- =========================================================================
-- 2) TAG NAME UNIQUE PER COMMISSION: duplicate name in same commission rejected
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_tag(%L, 'Infecção respiratória', 'red') $$,
         (select comm_x from k)),
  '23505',
  null,
  'create_case_tag rejects duplicate name in same commission (23505 unique violation)'
);
reset role;

-- Same name is ALLOWED in a different commission.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_case_tag(%L, 'Infecção respiratória', 'red') $$,
         (select comm_y from k)),
  'same tag name is allowed in a different commission'
);
reset role;

-- =========================================================================
-- 3) ASSIGN TAG to a case in the same commission
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.assign_case_tag(%L, %L) $$,
         (select cid from cse_x), (select tag_id from tag_x)),
  'assign_case_tag succeeds when case and tag are in the same commission'
);
reset role;

-- =========================================================================
-- 4) HC026: commission mismatch guard — assigning comm_y tag to comm_x case
-- =========================================================================
create temp table tag_y on commit drop as
  select id as tag_id from public.case_tags where commission_id = (select comm_y from k) limit 1;
grant select on tag_y to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_case_tag(%L, %L) $$,
         (select cid from cse_x), (select tag_id from tag_y)),
  'HC026',
  null,
  'assign_case_tag rejects cross-commission assignment (HC026)'
);
reset role;

-- =========================================================================
-- 5) ASSIGN is idempotent (second call does not raise)
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.assign_case_tag(%L, %L) $$,
         (select cid from cse_x), (select tag_id from tag_x)),
  'assign_case_tag is idempotent (second assign does not raise)'
);
reset role;

-- =========================================================================
-- 6) PLAIN STAFF cannot create or assign tags
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_tag(%L, 'Staff tag', 'teal') $$,
         (select comm_x from k)),
  '42501',
  null,
  'plain staff cannot create a tag (RPC is staff_admin-gated)'
);
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_case_tag(%L, %L) $$,
         (select cid from cse_x), (select tag_id from tag_x)),
  '42501',
  null,
  'plain staff cannot assign a tag (RPC is staff_admin-gated)'
);
reset role;

-- =========================================================================
-- 7) RLS: member can READ tags and assignments; cross-commission member cannot
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_tags
   where commission_id = (select comm_x from k)) >= 1,
  'staff member can read case_tags of their commission'
);
reset role;

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_tags
   where commission_id = (select comm_x from k)),
  0,
  'cross-commission member cannot read case_tags'
);
reset role;

-- =========================================================================
-- 8) CASE_TAG_REPORT: staff_admin gets non-empty result; non-staff_admin gets empty
-- =========================================================================
-- staff_admin gets the report (at least 1 tag with count 1 from the assignment above).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_tag_report((select comm_x from k), null, null)) >= 1,
  'case_tag_report returns rows to a staff_admin'
);
reset role;

-- plain staff gets 0 rows (the function is gated).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_tag_report((select comm_x from k), null, null)),
  0,
  'case_tag_report returns empty set to a non-staff_admin (gated)'
);
reset role;

-- =========================================================================
-- 9) CASE_TAG_REPORT: date bounds exclude cases outside the window
-- =========================================================================
-- The case was just created (created_at = now()). With a date window ending
-- yesterday, the LEFT JOIN finds no matching case → case_count = 0 for the tag.
-- The function still returns the tag row (LEFT JOIN), so count(*) >= 1; but
-- the case_count column must be 0 (the case is excluded).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select case_count::int from public.case_tag_report(
     (select comm_x from k),
     current_date - 365,   -- from: 1 year ago
     current_date - 1      -- to: yesterday → excludes the just-created case
  ) limit 1),
  0,
  'case_tag_report with a past-only date window returns case_count = 0 (case excluded)'
);
reset role;

select * from finish();
rollback;
