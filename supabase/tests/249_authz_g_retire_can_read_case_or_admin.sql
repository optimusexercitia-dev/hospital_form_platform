-- Stage-G cleanup guard (ADR 0078 D4/A21): app.can_read_case_or_admin is RETIRED. This
-- keystone is the mutation-falsifiable proof the retirement is COMPLETE: zero policies and
-- zero functions reference the wrapper, the wrapper no longer exists, the KEPT member-surface
-- predicate (A15·2) survived, and a repointed policy still gates correctly via can_read_case.
-- (The pre-drop wrapper==can_read_case equivalence was proven across the full persona matrix
-- before the repoint — see the F1 handoff; it cannot live here as the function is gone.)

begin;
select plan(6);

update app.feature_flags set enabled = true where key in ('case_participants', 'case_narratives');

-- t1 — GUARD: no POLICY references the retired wrapper.
select is(
  (select count(*)::int from pg_policies
   where qual ilike '%can_read_case_or_admin%' or with_check ilike '%can_read_case_or_admin%'),
  0, 'GUARD ⭐: zero RLS policies reference can_read_case_or_admin (all 12 repointed to can_read_case)');

-- t2 — GUARD: no FUNCTION body (or comment) references the retired wrapper.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prokind = 'f' and n.nspname in ('public', 'app')
     and pg_get_functiondef(p.oid) ~ 'can_read_case_or_admin'),
  0, 'GUARD ⭐: zero functions reference can_read_case_or_admin (can_read_interview repointed; can_reach comment scrubbed)');

-- t3 — the wrapper is GONE from the catalog.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_read_case_or_admin'),
  0, 'DROP ⭐: app.can_read_case_or_admin no longer exists');

-- t4 — the KEPT predicate survived: can_reach_case_on_member_surface (A15·2) is UN-retired.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'can_reach_case_on_member_surface'),
  1, 'KEPT ⭐: can_reach_case_on_member_surface survived the retirement (A15·2 — a DIFFERENT predicate)');

-- t5 — NON-VACUITY / behavioural: the repointed cases_select still gates via can_read_case —
-- the coordinator reads his case row, a plain member of a commission_default case reads ZERO.
create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x, (v->>'comm_x')::uuid as comm_x from ctx;
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-00000000e901', (select comm_x from k), 95901, (select sa_x from k), 'commission_default');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = '00000000-0000-0000-0000-00000000e901'), 1,
  'NON-VACUITY ⭐: the COORDINATOR still reads his case row through the repointed cases_select (can_read_case)');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = '00000000-0000-0000-0000-00000000e901'), 0,
  'NON-VACUITY ⭐: a plain member of a commission_default case reads ZERO — the repoint did not widen');
reset role;

select * from finish();
rollback;
