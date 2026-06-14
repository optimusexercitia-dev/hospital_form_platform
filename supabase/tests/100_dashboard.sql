-- Phase 8 dashboard aggregation (migration 20260613090011) + B6 hardening
-- (migration 20260613090012). Builds a dedicated published form in commission X
-- with: a flat section carrying a multiple_choice (mc) + a checkbox (cb), and a
-- CONDITIONAL section (gated on mc='Sim') carrying a multiple_choice (cond).
-- Seeds submitted standalone responses with known answers, plus one case-phase
-- submitted response sharing the same version (to prove it is EXCLUDED from the
-- standalone dashboard), then asserts the aggregation RPCs. Also asserts the
-- staff_admin/admin gating and the B6 anon-revoke + HC023 archive guard.
--
-- Definer RPCs read auth.uid() via request.jwt.claims; assertions reset to
-- superuser to read freely.

begin;
select plan(14);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Build the dashboard form (draft -> publish) directly (superuser; bypasses the
-- builder RPCs — we only need the published structure).
-- ---------------------------------------------------------------------------
create temp table ids on commit drop as
  select gen_random_uuid() as form_d,
         gen_random_uuid() as ver_d,
         gen_random_uuid() as sec_flat,
         gen_random_uuid() as sec_cond,
         gen_random_uuid() as it_mc,
         gen_random_uuid() as it_cb,
         gen_random_uuid() as it_cond;
grant select on ids to authenticated;

insert into public.forms (id, commission_id, title, created_by)
select i.form_d, k.comm_x, 'Dashboard Form', k.sa_x from ids i, k;

insert into public.form_versions (id, form_id, version_number, status)
select i.ver_d, i.form_d, 1, 'draft' from ids i;

-- Flat (default) section with mc + cb.
insert into public.form_sections (id, form_version_id, position, is_default)
select i.sec_flat, i.ver_d, 0, true from ids i;
insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
select i.it_mc, i.sec_flat, 0, 'multiple_choice', 'd_mc', 'MC?', '["Sim","Não"]'::jsonb, true from ids i;
insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
select i.it_cb, i.sec_flat, 1, 'checkbox', 'd_cb', 'CB?', '["A","B","C"]'::jsonb, false from ids i;

-- Conditional section (visible only when d_mc = 'Sim') with a multiple_choice,
-- so it gets the SMALLER denominator.
insert into public.form_sections (id, form_version_id, position, title, visible_when)
select i.sec_cond, i.ver_d, 1, 'Conditional',
       jsonb_build_object('question_key','d_mc','op','equals','value','Sim')
from ids i;
insert into public.form_items (id, section_id, position, item_type, question_key, label, options, required)
select i.it_cond, i.sec_cond, 0, 'multiple_choice', 'd_cond', 'Cond?', '["X","Y"]'::jsonb, true from ids i;

select public.publish_form_version((select ver_d from ids));

-- ---------------------------------------------------------------------------
-- Seed submitted standalone responses (bypass immutability trigger via the
-- in_submit_rpc guard the seed uses). 4 responses:
--   r1 (st_x):  d_mc=Sim, d_cb=[A,B], d_cond=X
--   r2 (st_x2): d_mc=Sim, d_cb=[A],   d_cond=Y
--   r3 (st_x):  d_mc=Não, d_cb=[B,C]            (conditional hidden, no d_cond)
--   r4 (st_x2): d_mc=Não, d_cb=[C]              (conditional hidden, no d_cond)
-- => d_mc:   Sim 2 / Não 2 (denom 4, n 4)
--    d_cb:   A 2, B 2, C 2 (denom 4, n 4)  [checkbox unnested]
--    d_cond: X 1, Y 1      (denom 2, n 2)  [conditional -> SMALLER denom]
-- ---------------------------------------------------------------------------
select set_config('app.in_submit_rpc', 'on', true);

create temp table rs on commit drop as
  select gen_random_uuid() as r1, gen_random_uuid() as r2,
         gen_random_uuid() as r3, gen_random_uuid() as r4;
grant select on rs to authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select rs.r1, i.ver_d, k.comm_x, k.st_x,  'submitted', now() - interval '1 day'  from rs, ids i, k
union all select rs.r2, i.ver_d, k.comm_x, k.st_x2, 'submitted', now() - interval '2 days' from rs, ids i, k
union all select rs.r3, i.ver_d, k.comm_x, k.st_x,  'submitted', now() - interval '3 days' from rs, ids i, k
union all select rs.r4, i.ver_d, k.comm_x, k.st_x2, 'submitted', now() - interval '4 days' from rs, ids i, k;

insert into public.answers (response_id, item_id, question_key, value)
select rs.r1, i.it_mc, 'd_mc', '"Sim"'::jsonb from rs, ids i
union all select rs.r1, i.it_cb,   'd_cb',   '["A","B"]'::jsonb from rs, ids i
union all select rs.r1, i.it_cond, 'd_cond', '"X"'::jsonb        from rs, ids i
union all select rs.r2, i.it_mc,   'd_mc',   '"Sim"'::jsonb      from rs, ids i
union all select rs.r2, i.it_cb,   'd_cb',   '["A"]'::jsonb      from rs, ids i
union all select rs.r2, i.it_cond, 'd_cond', '"Y"'::jsonb        from rs, ids i
union all select rs.r3, i.it_mc,   'd_mc',   '"Não"'::jsonb      from rs, ids i
union all select rs.r3, i.it_cb,   'd_cb',   '["B","C"]'::jsonb  from rs, ids i
union all select rs.r4, i.it_mc,   'd_mc',   '"Não"'::jsonb      from rs, ids i
union all select rs.r4, i.it_cb,   'd_cb',   '["C"]'::jsonb      from rs, ids i;

select set_config('app.in_submit_rpc', 'off', true);

-- =========================================================================
-- Aggregation assertions (act as staff_admin of X).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- ---- 1) totals: 4 standalone submitted ----
select is(
  (select total_submitted from public.dashboard_form_totals((select comm_x from k))
   where form_id = (select form_d from ids)),
  4::bigint,
  'dashboard_form_totals counts the 4 standalone submitted responses'
);

-- ---- 2) d_mc distribution: Sim 2 / Não 2, denom 4, n 4 ----
select set_eq(
  format($$ select option_value, option_count, denominator, n
            from public.dashboard_distributions(%L) where question_key='d_mc' $$,
         (select form_d from ids)),
  $$ values ('Sim',2::bigint,4::bigint,4::bigint),
            ('Não',2::bigint,4::bigint,4::bigint) $$,
  'd_mc distribution: Sim 2 / Não 2, denominator 4, n 4'
);

-- ---- 3) checkbox unnest: A 2, B 2, C 2 (each selected option counts) ----
select set_eq(
  format($$ select option_value, option_count from public.dashboard_distributions(%L)
            where question_key='d_cb' $$, (select form_d from ids)),
  $$ values ('A',2::bigint), ('B',2::bigint), ('C',2::bigint) $$,
  'd_cb checkbox values are unnested — each option counts individually'
);

-- ---- 4) checkbox denominator is the flat-section base (4) ----
select is(
  (select distinct denominator from public.dashboard_distributions((select form_d from ids))
   where question_key='d_cb'),
  4::bigint,
  'd_cb denominator is 4 (flat section answered by all 4 responses)'
);

-- ---- 5) CONDITIONAL question: SMALLER denominator (2, not 4) ----
select is(
  (select distinct denominator from public.dashboard_distributions((select form_d from ids))
   where question_key='d_cond'),
  2::bigint,
  'd_cond (conditional section) reports the SMALLER denominator 2, not 4'
);

-- ---- 6) conditional distribution values + n ----
select set_eq(
  format($$ select option_value, option_count, n from public.dashboard_distributions(%L)
            where question_key='d_cond' $$, (select form_d from ids)),
  $$ values ('X',1::bigint,2::bigint), ('Y',1::bigint,2::bigint) $$,
  'd_cond distribution: X 1 / Y 1, n 2'
);

-- ---- 7) submissions over time: 4 distinct days, 1 each ----
select is(
  (select count(*)::int from public.dashboard_submissions_over_time((select form_d from ids))),
  4,
  'submissions_over_time returns one point per distinct submission day'
);

-- ---- 8) completion by member: st_x 2, st_x2 2 ----
select set_eq(
  format($$ select member_id, count from public.dashboard_completion_by_member(%L) $$,
         (select form_d from ids)),
  format($$ values (%L::uuid,2::bigint),(%L::uuid,2::bigint) $$,
         (select st_x from k), (select st_x2 from k)),
  'completion_by_member: each of the two staff submitted 2'
);

reset role;

-- =========================================================================
-- 9) Case-phase EXCLUSION: a submitted case-phase response sharing the version
-- must NOT inflate the standalone totals (ADR 0020). Insert one and re-check.
-- =========================================================================
update app.feature_flags set enabled = true where key = 'cases_multi_phase';
select set_config('app.in_submit_rpc', 'on', true);
-- Minimal case + phase so case_phase_id is a valid FK.
create temp table cse on commit drop as select gen_random_uuid() as case_id, gen_random_uuid() as phase_id;
grant select on cse to authenticated;
insert into public.cases (id, commission_id, case_number, status, created_by)
select cse.case_id, k.comm_x, 9999, 'aberto', k.sa_x from cse, k;
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, status)
select cse.phase_id, cse.case_id, 1, 'P1', i.form_d, i.ver_d, 'concluida' from cse, ids i;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at, case_phase_id)
select gen_random_uuid(), i.ver_d, k.comm_x, k.st_x, 'submitted', now(), cse.phase_id from ids i, k, cse;
select set_config('app.in_submit_rpc', 'off', true);
update app.feature_flags set enabled = false where key = 'cases_multi_phase';

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select total_submitted from public.dashboard_form_totals((select comm_x from k))
   where form_id = (select form_d from ids)),
  4::bigint,
  'a submitted case-phase response on the same version does NOT inflate standalone totals'
);
reset role;

-- =========================================================================
-- 10) Gating: a plain staff gets an empty set from the staff_admin-gated RPC.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  0,
  'plain staff gets an empty distribution set (staff_admin/admin-gated)'
);
reset role;

-- 11) Gating: a foreign staff_admin (Y) cannot read X's form dashboard.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.dashboard_distributions((select form_d from ids))),
  0,
  'foreign-commission staff_admin gets an empty distribution set'
);
reset role;

-- 12) commission_overview is admin-only and excludes case-phase responses.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (select submitted_count from public.commission_overview() where commission_id = (select comm_x from k)),
  4::bigint,
  'commission_overview counts 4 standalone submitted for X (case-phase excluded), admin-gated'
);
reset role;

-- =========================================================================
-- B6 hardening assertions.
-- =========================================================================

-- 13) anon has NO table/function access in public (revoked from anon + PUBLIC).
select ok(
  not has_table_privilege('anon', 'public.responses', 'SELECT')
  and not has_function_privilege('anon', 'public.submit_response(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.dashboard_distributions(uuid,date,date)', 'EXECUTE'),
  'anon cannot SELECT public tables nor EXECUTE public functions (B6 revoke, incl. PUBLIC)'
);

-- 14) archive_process_template raises HC023 on an already-archived template.
update app.feature_flags set enabled = true where key = 'cases_multi_phase';
create temp table tpl on commit drop as select gen_random_uuid() as tid;
grant select on tpl to authenticated;
insert into public.process_templates (id, commission_id, title, status, created_by)
select tpl.tid, k.comm_x, 'Archived tpl', 'archived', k.sa_x from tpl, k;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.archive_process_template(%L) $$, (select tid from tpl)),
  'HC023',
  null,
  'archive_process_template raises HC023 when the template is already archived'
);
reset role;
update app.feature_flags set enabled = false where key = 'cases_multi_phase';

select * from finish();
rollback;
