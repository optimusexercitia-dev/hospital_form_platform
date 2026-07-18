-- =============================================================================
-- ETH·E2 (ADR 0073) — BE-2 gate: intake tables RLS boundary + constraints.
--
-- Proves, against the hermetic bootstrap on a FRESH reset (memory
-- pgtap-needs-fresh-reset-vs-e2e-leftovers), the BE-2 keystones:
--   • the `ethics` flag ships OFF;
--   • for EACH of the 3 case-child tables (ethics_case_details / ethics_allegations
--     / ethics_findings): the can_read_case SELECT boundary — asserting ROWS READ
--     under `set local role authenticated` (0072/0079 discipline, NOT the predicate's
--     return value) — NEG (foreign-commission uid + a non-granted member of an
--     explicit_grants_only ethics case) and POS (coordinator + a case grantee);
--   • the catalog org-scoping (an org member reads own-org categories only; admin
--     reads across orgs);
--   • the constraints the BE-6 RPCs will translate: unique(allegation_id) [HC0J3],
--     the bad-category FK [HC0J2], the admissibility_status CHECK [HC0J0];
--   • the DEFINER-only write lock — a direct authenticated INSERT into every new
--     table is denied (no write policy / grant).
--
-- The fixture inserts a REAL ethics case (an ethics_case_details row on an
-- explicit_grants_only case) so the boundary is not vacuous. Setup rows are
-- inserted as superuser (RLS-bypassing); visibility is asserted under each persona.
--
-- Personas (test_helpers.bootstrap): admin, sa_x (staff_admin of comm_x), st_x /
-- st_x2 (plain members of comm_x), sa_y (staff_admin of comm_y — foreign commission,
-- SAME org). claims_for(uid,is_admin) sets auth.uid(); `set local role
-- authenticated` runs a block under RLS.
-- =============================================================================

begin;
select plan(23);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- (1) the ethics feature flag EXISTS (created by the BE-2 migration). Its migration
-- default is OFF (remote/prod), but seed.sql forces it ON for local/E2E (BE-9), so we
-- assert existence — a value assertion here would be seed-dependent.
-- ---------------------------------------------------------------------------
select ok((select enabled from app.feature_flags where key = 'ethics') is not null,
  'BE-2: the ethics feature flag exists (created by the migration)');

-- ---------------------------------------------------------------------------
-- Fixture (superuser). An explicit_grants_only ethics case in comm_x, marked
-- ethics-typed by its ethics_case_details row (Lead ruling 1), + one allegation
-- + one finding; a foreign-org category for the catalog cross-org negative.
-- ---------------------------------------------------------------------------
reset role;

insert into public.cases
  (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
values
  ('00000000-0000-0000-0000-0000000e2001', (select comm_x from k), 92001, (select sa_x from k),
   'explicit_grants_only', 'ethics_investigation');

-- The ethics-typed marker (BE-2's ethics_case_details; BE-6's upsert RPC will own this).
insert into public.ethics_case_details (case_id, complaint_channel, summary_md)
values ('00000000-0000-0000-0000-0000000e2001', 'internal', 'Resumo da denúncia.');

-- Allegation category (org_x) + a foreign-org category for the cross-org negative.
insert into public.ethics_allegation_categories (id, organization_id, key, display_name)
values ('00000000-0000-0000-0000-0000000e2010', (select org_x from k),
        'professional_misconduct', 'Conduta profissional inadequada');

insert into public.organizations (id, name, slug)
values ('00000000-0000-0000-0000-0000000e2f00', 'Org Estrangeira E2', 'org-estrangeira-e2');
insert into public.ethics_allegation_categories (id, organization_id, key, display_name)
values ('00000000-0000-0000-0000-0000000e2f10', '00000000-0000-0000-0000-0000000e2f00',
        'negligence', 'Negligência');

-- One allegation + its finding on the ethics case.
insert into public.ethics_allegations
  (id, case_id, allegation_category_id, description_md, created_by)
values ('00000000-0000-0000-0000-0000000e2020', '00000000-0000-0000-0000-0000000e2001',
        '00000000-0000-0000-0000-0000000e2010', 'Descrição da alegação.', (select sa_x from k));
insert into public.ethics_findings
  (id, allegation_id, case_id, finding, decided_by)
values ('00000000-0000-0000-0000-0000000e2030', '00000000-0000-0000-0000-0000000e2020',
        '00000000-0000-0000-0000-0000000e2001', 'substantiated', (select sa_x from k));

-- Grant st_x2 read on the ethics case (the POS "granted member" persona). st_x
-- stays UN-granted (the NEG "non-granted member"); explicit_grants_only denies him.
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000e2001', (select st_x2 from k),
                             'read', (select sa_x from k));

-- ===========================================================================
-- SELECT boundary — ROWS READ under `set local role` (0072/0079 discipline).
-- For each table: NEG foreign-commission (sa_y) + NEG non-granted member (st_x);
-- POS coordinator (sa_x) + POS granted member (st_x2).
-- ===========================================================================

-- ethics_case_details ------------------------------------------------------
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_case_details: a foreign-commission user reads ZERO rows');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_case_details: a non-granted member of the explicit_grants_only case reads ZERO rows');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_case_details: the coordinator (staff_admin) reads the row');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_case_details
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_case_details: a case grantee reads the row');
reset role;

-- ethics_allegations -------------------------------------------------------
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_allegations
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_allegations: a foreign-commission user reads ZERO rows');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_allegations
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_allegations: a non-granted member reads ZERO rows');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_allegations
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_allegations: the coordinator reads the allegation');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_allegations
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_allegations: a case grantee reads the allegation');
reset role;

-- ethics_findings (denormalized case_id — base-table predicate) -------------
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_findings
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_findings: a foreign-commission user reads ZERO rows (denormalized case_id)');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_findings
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 0,
  'ethics_findings: a non-granted member reads ZERO rows');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_findings
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_findings: the coordinator reads the finding');
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_findings
           where case_id = '00000000-0000-0000-0000-0000000e2001'), 1,
  'ethics_findings: a case grantee reads the finding');
reset role;

-- ===========================================================================
-- Catalog org-scoping (precedent: case_participant_roles — is_org_member OR is_admin).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.ethics_allegation_categories
           where id = '00000000-0000-0000-0000-0000000e2010'), 1,
  'catalog: an org member reads their own org''s allegation category');
select is((select count(*)::int from public.ethics_allegation_categories
           where id = '00000000-0000-0000-0000-0000000e2f10'), 0,
  'catalog: an org member does NOT read a FOREIGN org''s allegation category');
reset role;
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is((select count(*)::int from public.ethics_allegation_categories
           where id = '00000000-0000-0000-0000-0000000e2f10'), 1,
  'catalog: an admin reads across orgs (the is_admin arm)');
reset role;

-- ===========================================================================
-- Constraints the BE-6 RPCs translate (asserted at the constraint layer, superuser).
-- ===========================================================================
select throws_ok(
  $$ insert into public.ethics_findings (allegation_id, case_id, finding)
     values ('00000000-0000-0000-0000-0000000e2020', '00000000-0000-0000-0000-0000000e2001',
             'not_substantiated') $$,
  '23505', null,
  'HC0J3 constraint: a second finding on the same allegation is rejected (unique(allegation_id))');

select throws_ok(
  $$ insert into public.ethics_allegations (case_id, allegation_category_id, description_md)
     values ('00000000-0000-0000-0000-0000000e2001',
             '00000000-0000-0000-0000-0000000e2fff', 'Categoria inexistente.') $$,
  '23503', null,
  'HC0J2 constraint: an allegation with a non-existent category is rejected (FK)');

select throws_ok(
  $$ insert into public.ethics_case_details (case_id, admissibility_status)
     values ('00000000-0000-0000-0000-0000000e2001', 'bogus') $$,
  '23514', null,
  'HC0J0 constraint: an out-of-vocabulary admissibility_status is rejected (CHECK)');

-- ===========================================================================
-- DEFINER-only write lock — a direct authenticated INSERT is denied on every
-- new table (no write policy / grant; writes go through the BE-6 DEFINER RPCs).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ insert into public.ethics_case_details (case_id) values (gen_random_uuid()) $$,
  '42501', null,
  'write-lock: a direct authenticated INSERT into ethics_case_details is denied (DEFINER-only)');
select throws_ok(
  format($$ insert into public.ethics_allegations (case_id, allegation_category_id, description_md)
            values (%L, '00000000-0000-0000-0000-0000000e2010', 'x') $$,
         '00000000-0000-0000-0000-0000000e2001'),
  '42501', null,
  'write-lock: a direct authenticated INSERT into ethics_allegations is denied (DEFINER-only)');
select throws_ok(
  format($$ insert into public.ethics_findings (allegation_id, case_id, finding)
            values ('00000000-0000-0000-0000-0000000e2020', %L, 'dismissed') $$,
         '00000000-0000-0000-0000-0000000e2001'),
  '42501', null,
  'write-lock: a direct authenticated INSERT into ethics_findings is denied (DEFINER-only)');
select throws_ok(
  format($$ insert into public.ethics_allegation_categories (organization_id, key, display_name)
            values (%L, 'x', 'x') $$, (select org_x from k)),
  '42501', null,
  'write-lock: a direct authenticated INSERT into ethics_allegation_categories is denied (DEFINER-CRUD-only)');
reset role;

select * from finish();
rollback;
