-- =============================================================================
-- QO·A keystones — quality_board_summary (M7; ADR 0100 D6/D10) + the M6
-- tenancy-shell arms.
--
-- The COUNT SEMANTICS are the point (lead ruling g): total_cases = the READABLE
-- population (incl. a locked case held via explicit grant), locked_cases = the
-- explicit_grants_only rows the caller CANNOT read; disjoint BY CONSTRUCTION,
-- total EXCLUDES locked. The fixture deliberately holds BOTH kinds of locked
-- case so 2.5 can assert the disjointness rather than infer it. open_cases
-- reuses count_open_cases_for_board's predicate (status not in
-- ('completed','cancelled')) — never a second definition of "open".
-- =============================================================================

begin;
select plan(21);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'oa_b')::uuid   as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

create temp table p on commit drop as
  select gen_random_uuid() as qr, gen_random_uuid() as qr_f,
         gen_random_uuid() as org2, gen_random_uuid() as hosp3;
grant select on p to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.id || '@test', now(), now()
from (select qr as id from p union all select qr_f from p) u;

insert into public.organizations (id, name, slug)
select org2, 'Org QO6 Foreign', 'org-qo6-' || substr(org2::text, 1, 8) from p;
insert into public.hospitals (id, organization_id, name, slug)
select hosp3, org2, 'Hosp QO6 Foreign', 'hosp-qo6-' || substr(hosp3::text, 1, 8) from p;

insert into public.memberships (organization_id, hospital_id, principal_id, role)
select k.org_b, k.hosp_b, p.qr,   'quality_reviewer' from k, p union all
select p.org2,  p.hosp3,  p.qr_f, 'quality_reviewer' from p;

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

create temp table cs on commit drop as
  select '00000000-0000-0000-0000-0000000e1001'::uuid as case_open,
         '00000000-0000-0000-0000-0000000e1002'::uuid as case_closed,
         '00000000-0000-0000-0000-0000000e1003'::uuid as case_eg_unread,
         '00000000-0000-0000-0000-0000000e1004'::uuid as case_eg_granted;
grant select on cs to authenticated;

select set_config('app.in_case_rpc', 'on', true);
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, status, closed_at)
select cs.case_open,       k.comm_x, 99901, k.sa_x, 'commission_default',   'not_started', null  from cs, k union all
select cs.case_closed,     k.comm_x, 99902, k.sa_x, 'commission_default',   'completed',   now() from cs, k union all
select cs.case_eg_unread,  k.comm_x, 99903, k.sa_x, 'explicit_grants_only', 'not_started', null  from cs, k union all
select cs.case_eg_granted, k.comm_x, 99904, k.sa_x, 'explicit_grants_only', 'not_started', null  from cs, k;
select set_config('app.in_case_rpc', 'off', true);

insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_case_deliberation,
   read_standard_phi, read_restricted_phi, write_case_content, reason_code, granted_by)
select cs.case_eg_granted, p.qr, 'manual_grant',
       true, false, false, false, false, 'coordinator_grant', k.sa_x
from cs, p, k;

-- =============================================================================
-- §1 — THE GATE (42501 for every non-reviewer-of-this-org shape).
-- =============================================================================

select test_helpers.claims_for((select st_x from k), false);
select throws_ok(
  format($$select * from public.quality_board_summary(%L)$$, (select org_b from k)),
  '42501', null,
  '1.1 GATE: a plain committee member is not a quality reviewer');

select test_helpers.claims_for((select qr_f from p), false);
select throws_ok(
  format($$select * from public.quality_board_summary(%L)$$, (select org_b from k)),
  '42501', null,
  '1.2 TENANCY ⭐: a reviewer of ANOTHER org is denied on this org''s board');

update public.memberships m set expires_at = now() - interval '1 hour'
  where m.principal_id = (select qr from p) and m.role = 'quality_reviewer';
select test_helpers.claims_for((select qr from p), false);
select throws_ok(
  format($$select * from public.quality_board_summary(%L)$$, (select org_b from k)),
  '42501', null,
  '1.3 EXPIRED: an expired reviewer takes the same 42501');
update public.memberships m set expires_at = null
  where m.principal_id = (select qr from p) and m.role = 'quality_reviewer';

-- Clear claims first: guard_profile_privileged_columns refuses is_active writes
-- from a non-admin SESSION; the superuser patch path needs auth.uid() null.
select test_helpers.claims_for(null, false);
update public.profiles set is_active = false where id = (select qr from p);
select test_helpers.claims_for((select qr from p), false);
select throws_ok(
  format($$select * from public.quality_board_summary(%L)$$, (select org_b from k)),
  '42501', null,
  '1.4 DEACTIVATED: is_active gates the door');
select test_helpers.claims_for(null, false);
update public.profiles set is_active = true where id = (select qr from p);

-- =============================================================================
-- §2 — SHAPE + THE COUNT SEMANTICS.
-- =============================================================================

select test_helpers.claims_for((select qr from p), false);

select is(
  (select array_agg(b.commission_id) from public.quality_board_summary((select org_b from k)) b),
  (select array[k.comm_x] from k),
  '2.1 exactly the oversight-VISIBLE commission appears (excluded comm_y has no board row)');

select is(
  (select b.total_cases from public.quality_board_summary((select org_b from k)) b, k
    where b.commission_id = k.comm_x),
  3,
  '2.2 total_cases = the READABLE population (open + closed + the GRANTED locked case)');

select is(
  (select b.open_cases from public.quality_board_summary((select org_b from k)) b, k
    where b.commission_id = k.comm_x),
  2,
  '2.3 open_cases reuses the count_open_cases_for_board predicate (completed drops; the granted locked case is open + readable)');

select is(
  (select b.locked_cases from public.quality_board_summary((select org_b from k)) b, k
    where b.commission_id = k.comm_x),
  1,
  '2.4 locked_cases = ONLY the explicit_grants_only row the caller cannot read');

select is(
  (select b.total_cases + b.locked_cases from public.quality_board_summary((select org_b from k)) b, k
    where b.commission_id = k.comm_x),
  4,
  '2.5 DISJOINT ⭐⭐ (ruling g): total EXCLUDES locked — the granted locked case sits in total, the ungranted one in locked, together they tile all 4 rows exactly once');

select is(
  pg_get_function_result('public.quality_board_summary(uuid)'::regprocedure),
  'TABLE(commission_id uuid, commission_name text, commission_slug citext, hospital_id uuid, hospital_name text, total_cases integer, open_cases integer, locked_cases integer)',
  '2.6 PHI-FREE SHAPE ⭐: the door''s whole return surface is refs + counts — pinned column-for-column');

-- =============================================================================
-- §3 — THE M6 TENANCY-SHELL ARMS (RLS, asserted at the base tables).
-- =============================================================================

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;

select is(
  (select array_agg(c.id) from public.commissions c),
  (select array[k.comm_x] from k),
  '3.1 SHELL ⭐: the reviewer''s commissions universe is exactly the visible one (excluded comm_y invisible — same hospital)');

select is(
  (select count(*)::int from public.hospitals),
  1,
  '3.2 SHELL: exactly the reviewed hospital''s row');

select is(
  (select count(*)::int from public.organizations o, k where o.id = k.org_b),
  1,
  '3.3 SHELL: the org row resolves through is_quality_reviewer_in_org');
reset role;

select test_helpers.claims_for((select qr_f from p), false);
set local role authenticated;
select is(
  (select (select count(*) from public.commissions c, k where c.organization_id = k.org_b)
        + (select count(*) from public.hospitals h, k where h.organization_id = k.org_b)
        + (select count(*) from public.organizations o, k where o.id = k.org_b))::int,
  0,
  '3.4 TENANCY: the foreign reviewer sees ZERO of org_b''s shell (commissions + hospitals + org)');
reset role;

select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.commissions),
  2,
  '3.5 NON-VACUITY: the org admin still sees BOTH commissions — 3.1''s missing row is the reviewer arm''s doing, not a broken table');
reset role;

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'excluded' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is(
  (select (select count(*) from public.quality_board_summary((select org_b from k)))
        + (select count(*) from public.commissions))::int,
  0,
  '3.6 CONSISTENCY ⭐: opting the last commission out empties BOTH the board door and the RLS shell in the same instant (no drift between the two surfaces)');
reset role;

-- =============================================================================
-- §4 — THE CROSS-COMMITTEE BOARD (ADR 0100 D10). Everything above exercises the
-- board with ONE visible commission; the console exists so a quality office can
-- read ACROSS the clinical committees of its hospital, and that path had no DB
-- coverage (tester found the same hole in the FE chip row, which only mounts at
-- commissions.length > 1).
--
-- Built ENTIRELY IN-TRANSACTION and rolled back: `seed.sql` is a contract with
-- ~900 tests and every route to a second seeded visible commission moves a
-- tenant-isolation count (171: org-a commissions; 189: org-a hospitals). Those
-- assertions exist to go red when a tenant's SHAPE changes — bending them to fit
-- a fixture is the corrosive habit, so the fixture comes here instead (lead
-- ruling 2026-08-06). The E2E half drives the real onboarding flow through
-- set_commission_oversight.
--
-- ANTI-CONFLATION BY CONSTRUCTION: the two commissions carry DIFFERENT locked
-- counts (1 vs 2). A door that summed globally, or cross-attributed, reads 3/3
-- and reds 4.4 — a same-count fixture would pass either way.
-- =============================================================================

create temp table cs2 on commit drop as
  select '00000000-0000-0000-0000-0000000e2001'::uuid as comm_2,
         '00000000-0000-0000-0000-0000000e2101'::uuid as c2_open_a,
         '00000000-0000-0000-0000-0000000e2102'::uuid as c2_open_b,
         '00000000-0000-0000-0000-0000000e2103'::uuid as c2_eg_1,
         '00000000-0000-0000-0000-0000000e2104'::uuid as c2_eg_2;
grant select on cs2 to authenticated;

-- A SECOND committee of the SAME hospital the reviewer reviews. Born 'excluded'
-- (the M2 INSERT guard refuses anything else outside the bracket — 307 §1.3);
-- both commissions are then opted in through the bracket, which also restores
-- comm_x after §3.6 opted it out.
insert into public.commissions (id, name, slug, created_by, hospital_id)
select cs2.comm_2, 'Comissão Dois QO', 'comm-qo2-' || substr(cs2.comm_2::text, 1, 8),
       k.sa_x, k.hosp_b
from cs2, k;

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible'
  where id in ((select comm_x from k), (select comm_2 from cs2));
select set_config('app.in_commission_rpc', 'off', true);

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, status)
select cs2.c2_open_a, cs2.comm_2, 99911, k.sa_x, 'commission_default',   'not_started' from cs2, k union all
select cs2.c2_open_b, cs2.comm_2, 99912, k.sa_x, 'commission_default',   'in_review'   from cs2, k union all
select cs2.c2_eg_1,   cs2.comm_2, 99913, k.sa_x, 'explicit_grants_only', 'not_started' from cs2, k union all
select cs2.c2_eg_2,   cs2.comm_2, 99914, k.sa_x, 'explicit_grants_only', 'not_started' from cs2, k;

select test_helpers.claims_for((select qr from p), false);

select is(
  (select count(*)::int from public.quality_board_summary((select org_b from k))),
  2,
  '4.1 CROSS-COMMITTEE ⭐⭐ (D10): the board returns BOTH oversight-visible committees of the reviewed hospital — the multi-commission shape the console exists for');

select is(
  (select array_agg(b.commission_id order by b.commission_name)
     from public.quality_board_summary((select org_b from k)) b),
  (select array_agg(x order by x) from (select (select comm_x from k) as x union all select (select comm_2 from cs2)) s),
  '4.2 ...and they are exactly the two visible commissions (comm_y, still excluded, is absent)');

select is(
  (select b.total_cases || '/' || b.open_cases || '/' || b.locked_cases
     from public.quality_board_summary((select org_b from k)) b, k
    where b.commission_id = k.comm_x),
  '3/2/1',
  '4.3 PER-COMMISSION ATTRIBUTION: the first committee keeps its own totals unchanged by the arrival of a second (3 readable / 2 open / 1 locked)');

select is(
  (select b.total_cases || '/' || b.open_cases || '/' || b.locked_cases
     from public.quality_board_summary((select org_b from k)) b, cs2
    where b.commission_id = cs2.comm_2),
  '2/2/2',
  '4.4 ...and the second reports ITS OWN (2 readable / 2 open / 2 locked) — DIFFERENT locked counts, so a globally-summed or cross-attributed count reads 3/3 and reds here');

select ok(
  (select sum(b.locked_cases)::int from public.quality_board_summary((select org_b from k)) b) = 3
  and (select count(distinct b.locked_cases)::int from public.quality_board_summary((select org_b from k)) b) = 2,
  '4.5 LOCKED STAYS PER-ROW ⭐: the locked population tiles across commissions (1 + 2 = 3) and the two rows genuinely differ — the D6 count is attributed, never aggregated org-wide');

select * from finish();
rollback;
