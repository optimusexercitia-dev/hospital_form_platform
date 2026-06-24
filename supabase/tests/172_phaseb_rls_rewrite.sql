-- Multi-tenancy Phase B — RLS rewrite verification (the security core).
-- Proves: (A) platform_admin is walled off from tenant data (the inverse of the
-- pre-Phase-B world); (B) org_admin reads its own org's tenant data and none of
-- another org's; (C) the DEFINER RPCs (commission_overview + dashboards) are
-- re-scoped (platform admin empty, org_admin own-org only, foreign-org empty);
-- (D) the audit 3-tier chain writes + verifies per tier (canonical/verify
-- lockstep with organization_id).
--
-- Fixtures: bootstrap() (comm_x, comm_y, admin, sa_x/st_x, sa_y/st_y) re-homed
-- under two orgs A(comm_x)/B(comm_y); sa_x = org_admin of A, sa_y = org_admin of B.

begin;
select plan(24);

-- Phase B re-scopes DEFINER dashboards; audit_trail ON so the 3-tier chain runs.
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table h on commit drop as
  select gen_random_uuid() as org_a, gen_random_uuid() as org_b,
         gen_random_uuid() as hosp_a, gen_random_uuid() as hosp_b,
         (v->>'admin')::uuid as admin, (v->>'sa_x')::uuid as sa_x,
         (v->>'st_x')::uuid as st_x, (v->>'sa_y')::uuid as sa_y,
         (v->>'st_y')::uuid as st_y,
         (v->>'comm_x')::uuid as comm_x, (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u, (v->>'ver_u')::uuid as ver_u,
         (v->>'item_mc')::uuid as item_mc
  from ctx;
grant select on h to authenticated;

insert into public.organizations (id, name, slug) select org_a, 'Org A', 'org-a' from h
  union all select org_b, 'Org B', 'org-b' from h;
insert into public.hospitals (id, organization_id, name, slug) select hosp_a, org_a, 'Hosp A', 'hosp-a' from h
  union all select hosp_b, org_b, 'Hosp B', 'hosp-b' from h;
insert into public.organization_members (organization_id, user_id, role)
  select org_a, sa_x, 'org_admin' from h union all select org_b, sa_y, 'org_admin' from h;
update public.commissions set hospital_id = (select hosp_a from h) where id = (select comm_x from h);
update public.commissions set hospital_id = (select hosp_b from h) where id = (select comm_y from h);

-- A submitted response in comm_x (form_u) so dashboards + tenant reads have data.
create temp table r on commit drop as select gen_random_uuid() as sub_x;
grant select on r to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  select sub_x, (select ver_u from h), (select comm_x from h), (select st_x from h), 'in_progress' from r;
insert into public.answers (response_id, item_id, question_key, value)
  select (select sub_x from r), (select item_mc from h), 'u_q1', '"Sim"'::jsonb from h;
select set_config('app.in_submit_rpc','on', true);
update public.responses set status='submitted', submitted_at=now() where id = (select sub_x from r);
select set_config('app.in_submit_rpc','off', true);

-- ============================================================================
-- (A) platform_admin is WALLED OFF from tenant data (the inverse of pre-Phase-B).
-- ============================================================================
select test_helpers.claims_for((select admin from h), true);
set local role authenticated;
select is((select count(*)::int from public.forms where commission_id = (select comm_x from h)), 0,
  'WALL: platform_admin sees 0 forms of comm_x');
select is((select count(*)::int from public.responses where commission_id = (select comm_x from h)), 0,
  'WALL: platform_admin sees 0 responses of comm_x');
select is((select count(*)::int from public.answers a where a.response_id = (select sub_x from r)), 0,
  'WALL: platform_admin sees 0 answers of comm_x');
-- DEFINER: commission_overview returns NOTHING for a platform admin (no org_admin row).
select is((select count(*)::int from public.commission_overview()), 0,
  'WALL: commission_overview() empty for platform_admin (org-scoped, not all)');
-- DEFINER: dashboard on comm_x's form returns EMPTY for admin (gate fails closed via
-- `return;`, not a raise — admin is neither staff_admin nor org_admin of comm_x).
select is(
  (select count(*)::int from public.dashboard_distributions((select form_u from h))), 0,
  'WALL: dashboard_distributions returns empty for platform_admin on a foreign form');
-- DEFINER: dashboard_form_totals also fails closed via `return;` (empty) for admin.
select is(
  (select count(*)::int from public.dashboard_form_totals((select comm_x from h))), 0,
  'WALL: dashboard_form_totals returns empty for platform_admin on a foreign commission');
reset role;

-- ============================================================================
-- (B) org_admin A (sa_x) reads ALL of org A's tenant data, NONE of org B's.
-- ============================================================================
select test_helpers.claims_for((select sa_x from h), false);
set local role authenticated;
select is((select count(*)::int from public.forms where commission_id = (select comm_x from h)), 2,
  'org_admin A reads comm_x forms (2 from bootstrap)');
select is((select count(*)::int from public.forms where commission_id = (select comm_y from h)), 0,
  'org_admin A reads 0 of comm_y (org B) forms');
select is((select count(*)::int from public.responses where id = (select sub_x from r)), 1,
  'org_admin A reads comm_x submitted response');
select is((select count(*)::int from public.answers a where a.response_id = (select sub_x from r)), 1,
  'org_admin A reads comm_x answers');
select is((select count(*)::int from public.commissions where id = (select comm_x from h)), 1,
  'org_admin A reads comm_x via commissions SELECT (org-scoped)');
select is((select count(*)::int from public.commissions where id = (select comm_y from h)), 0,
  'org_admin A reads 0 of comm_y via commissions SELECT');
-- DEFINER: commission_overview returns ONLY org A's commissions.
select is((select count(*)::int from public.commission_overview() where commission_id = (select comm_x from h)), 1,
  'commission_overview() returns comm_x for org_admin A');
select is((select count(*)::int from public.commission_overview() where commission_id = (select comm_y from h)), 0,
  'commission_overview() does NOT return comm_y (org B) for org_admin A');
-- DEFINER: dashboard on comm_x form works for org_admin A.
select lives_ok(
  format($$ select * from public.dashboard_distributions(%L) $$, (select form_u from h)),
  'dashboard_distributions runs for org_admin A on its own form');
-- DEFINER: dashboard on a comm_y (org B) commission returns empty for org_admin A.
select is(
  (select count(*)::int from public.dashboard_form_totals((select comm_y from h))), 0,
  'dashboard_form_totals returns empty for org_admin A on org B commission');
reset role;

-- ============================================================================
-- (C) staff_admin transitive isolation survived (regression): sa_x reads comm_x
-- as staff_admin, 0 of comm_y. (sa_x is BOTH staff_admin of comm_x AND org_admin
-- of A; assert a PLAIN staff_admin-only persona is still isolated — use sa_y on
-- comm_x: sa_y is org_admin of B and staff_admin of comm_y, neither grants comm_x.)
-- ============================================================================
select test_helpers.claims_for((select sa_y from h), false);
set local role authenticated;
select is((select count(*)::int from public.forms where commission_id = (select comm_x from h)), 0,
  'REGRESSION: sa_y (org B) reads 0 of comm_x forms (transitive isolation holds)');
select is((select count(*)::int from public.responses where id = (select sub_x from r)), 0,
  'REGRESSION: sa_y (org B) reads 0 of comm_x responses');
reset role;

-- ============================================================================
-- (D) Audit 3-tier: write a row per tier and verify each chain (canonical/verify
-- lockstep WITH organization_id). Direct audit_write as postgres (DEFINER path).
-- ============================================================================
-- platform tier (org NULL, commission NULL)
select app.audit_write('platform.test', 'organization', (select org_a from h), null, 'plat tier', '{}'::jsonb);
-- org tier (org set, commission NULL)
select app.audit_write('org.test', 'organization', (select org_a from h), null, 'org tier', '{}'::jsonb, (select org_a from h));
-- commission tier (commission set; org derived)
select app.audit_write('commission.test', 'commission', (select comm_x from h), (select comm_x from h), 'comm tier', '{}'::jsonb);

select is(
  (select count(*)::int from public.audit_log where organization_id is null and commission_id is null and action='platform.test'), 1,
  'audit: platform-tier row written (org NULL, commission NULL)');
select is(
  (select count(*)::int from public.audit_log where organization_id = (select org_a from h) and commission_id is null and action='org.test'), 1,
  'audit: org-tier row written (org set, commission NULL)');
select is(
  (select count(*)::int from public.audit_log where commission_id = (select comm_x from h) and action='commission.test'), 1,
  'audit: commission-tier row written (org derived from commission)');

-- verify each tier (as a suitably-authorized persona). platform: admin.
select test_helpers.claims_for((select admin from h), true);
set local role authenticated;
select ok((select ok from public.verify_audit_chain(null, null)),
  'audit: platform chain verifies ok (canonical/verify lockstep, platform tier)');
reset role;
-- org tier: org_admin A.
select test_helpers.claims_for((select sa_x from h), false);
set local role authenticated;
select ok((select ok from public.verify_audit_chain(null, (select org_a from h))),
  'audit: org-A chain verifies ok for org_admin A');
-- commission tier: staff_admin / org_admin of comm_x.
select ok((select ok from public.verify_audit_chain((select comm_x from h), null)),
  'audit: comm_x chain verifies ok for org_admin A');
reset role;

select * from finish();
rollback;
