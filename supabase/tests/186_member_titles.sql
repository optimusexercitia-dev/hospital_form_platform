-- Committee member titles (ADR 0051 Decision 6; migrations 20260709000100 / 000400).
-- Proves: auto-seed on commission create; assign/clear; DISPLAY-ONLY (a titled
-- staff gains NO extra access); ON DELETE SET NULL; same-commission integrity;
-- staff_admin/commission-admin CRUD authz.
--
-- Fixture: the SEEDED world. Personas:
--   chefe.ccih  (02): staff_admin of CCIH — manages titles.
--   staff1.ccih (03): plain staff of CCIH — display target; NO management rights.
--   ha1         (e1): hospital_admin of central-a — inherits title management.
begin;
select plan(17);

create temp table p on commit drop as select
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_ccih,
  '00000000-0000-0000-0000-000000000003'::uuid as staff1_ccih,
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha1,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih,
  'b0000000-0000-0000-0000-0000000000b1'::uuid as comm_farmacia;
grant select on p to authenticated;

-- ============================================================================
-- §1: auto-seed — every commission got Presidente/Vice-Presidente/Secretário(a)/
--     Membro Efetivo/Membro Consultivo (five defaults)
-- ============================================================================
select is(
  (select count(*)::int from public.commission_member_titles where commission_id = (select comm_ccih from p)),
  5, 'AUTO-SEED: CCIH has 5 default titles');
select bag_eq(
  $$select name from public.commission_member_titles
    where commission_id = 'a0000000-0000-0000-0000-0000000000a1' order by position$$,
  $$values ('Presidente'),('Vice-Presidente'),('Secretário(a)'),('Membro Efetivo'),('Membro Consultivo')$$,
  'AUTO-SEED: the five default title names are Presidente/Vice-Presidente/Secretário(a)/Membro Efetivo/Membro Consultivo');

-- A freshly-created commission auto-seeds too (the sibling AFTER-INSERT trigger).
do $$
declare v_new uuid;
begin
  insert into public.commissions (name, slug, hospital_id)
  values ('Comissão Teste Títulos', 'teste-titulos-186', '05000000-0000-0000-0000-00000000000a')
  returning id into v_new;
  perform set_config('test186.new_comm', v_new::text, true);
end $$;
select is(
  (select count(*)::int from public.commission_member_titles
   where commission_id = current_setting('test186.new_comm')::uuid),
  5, 'AUTO-SEED: a newly-created commission auto-seeds 5 titles');

-- ============================================================================
-- §2: CRUD authz — staff_admin manages; plain staff cannot
-- ============================================================================
select test_helpers.claims_for((select chefe_ccih from p), false);
set local role authenticated;
select lives_ok(
  $$select public.create_member_title('a0000000-0000-0000-0000-0000000000a1', 'Tesoureiro(a)')$$,
  'CRUD: staff_admin creates a title');
select ok(
  (select count(*)::int from public.commission_member_titles
   where commission_id = (select comm_ccih from p) and name = 'Tesoureiro(a)') = 1,
  'CRUD: the created title is present');
reset role;

select test_helpers.claims_for((select staff1_ccih from p), false);
set local role authenticated;
select throws_ok(
  $$select public.create_member_title('a0000000-0000-0000-0000-0000000000a1', 'Intruso')$$,
  '42501', null,
  'AUTHZ: a plain staff CANNOT create a title');
reset role;

-- hospital_admin inherits management (via is_tenancy_admin_of).
select test_helpers.claims_for((select ha1 from p), false);
set local role authenticated;
select lives_ok(
  $$select public.create_member_title('a0000000-0000-0000-0000-0000000000a1', 'Relator(a)')$$,
  'CRUD: hospital_admin inherits title management (is_tenancy_admin_of)');
reset role;

-- ============================================================================
-- §3: assign / clear + same-commission integrity + DISPLAY-ONLY
-- ============================================================================
-- Assign the Presidente title to staff1.ccih's CCIH membership.
do $$
declare v_member uuid; v_title uuid;
begin
  select id into v_member from public.memberships
    where commission_id = 'a0000000-0000-0000-0000-0000000000a1'
      and principal_id = '00000000-0000-0000-0000-000000000003';
  select id into v_title from public.commission_member_titles
    where commission_id = 'a0000000-0000-0000-0000-0000000000a1' and name = 'Presidente';
  perform set_config('test186.member', v_member::text, true);
  perform set_config('test186.title', v_title::text, true);
end $$;

select test_helpers.claims_for((select chefe_ccih from p), false);
set local role authenticated;
select lives_ok(
  format($$select public.assign_member_title(%L, %L)$$,
    current_setting('test186.member'), current_setting('test186.title')),
  'ASSIGN: staff_admin assigns a title to a member');
reset role;
select is(
  (select title_id from public.memberships where id = current_setting('test186.member')::uuid),
  current_setting('test186.title')::uuid,
  'ASSIGN: the member''s title_id is set');

-- DISPLAY-ONLY: staff1.ccih with a title reads EXACTLY what it read before (no
-- extra access). It is a plain staff of CCIH; it must NOT be able to read Farmácia.
select test_helpers.claims_for((select staff1_ccih from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.forms where commission_id = (select comm_farmacia from p)),
  0, 'DISPLAY-ONLY: a titled staff gains ZERO cross-commission read (still cannot read Farmácia)');
select ok(not app.is_tenancy_admin_of((select comm_ccih from p)),
  'DISPLAY-ONLY: a titled staff is NOT a commission admin (title carries no access)');
reset role;

-- same-commission integrity: assigning a Farmácia title to a CCIH member fails.
-- MEM collapse: memberships has NO direct UPDATE grant to authenticated (WS-1/MEM
-- lockdown — writes flow only through the door / a DEFINER RPC), so the integrity
-- guard is now reached via assign_member_title (SECURITY DEFINER) rather than a raw
-- UPDATE.
-- ADR 0094 W1/T1.4: the enforcing mechanism changed from
-- guard_membership_title_commission_trg (a BEFORE-row trigger raising 23514) to the
-- composite FK memberships_title_id_fkey (title_id, commission_id), which raises
-- 23503. The INVARIANT is identical — only the SQLSTATE moved, because the constraint
-- is now stated relationally instead of procedurally.
do $$
declare v_farm_title uuid;
begin
  select id into v_farm_title from public.commission_member_titles
    where commission_id = 'b0000000-0000-0000-0000-0000000000b1' limit 1;
  perform set_config('test186.farm_title', v_farm_title::text, true);
end $$;
select test_helpers.claims_for((select chefe_ccih from p), false);
set local role authenticated;
select throws_ok(
  format($$select public.assign_member_title(%L, %L)$$,
    current_setting('test186.member'), current_setting('test186.farm_title')),
  '23503', null,
  'INTEGRITY: assigning a title from ANOTHER commission is rejected (composite FK, 23503)');
reset role;

-- ON DELETE SET NULL: deleting the assigned title clears the member's title_id.
select test_helpers.claims_for((select chefe_ccih from p), false);
set local role authenticated;
select lives_ok(
  format($$select public.delete_member_title(%L)$$, current_setting('test186.title')),
  'DELETE: staff_admin deletes the assigned title');
reset role;
select is(
  (select title_id from public.memberships where id = current_setting('test186.member')::uuid),
  null,
  'ON DELETE SET NULL: the member''s title_id is cleared after the title is deleted');

-- ============================================================================
-- §4: the reconciliation reads (ADR 0051 Gaps #1/#2) resolve under RLS.
--   listMembers: the commission_member_titles embed is a single unambiguous FK
--   (title_id -> commission_member_titles.id), so the LEFT-JOIN read is valid.
--   listHospitalAdmins: organization_members -> profiles, org_admin-gated.
-- ============================================================================
-- (a) exactly one FK backs the members->titles embed (PostgREST unambiguous).
select is(
  (select count(*)::int from pg_constraint
   where conrelid = 'public.memberships'::regclass and contype = 'f'
     and confrelid = 'public.commission_member_titles'::regclass),
  1,
  'READ (Gap#2): a single FK title_id->commission_member_titles backs the members-title embed');

-- (b) listHospitalAdmins RLS: an org_admin of org-a reads the hospital_admin
-- roster of central-a (2 seeded holders: a1 + dual); an org-b staff reads none.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1'::uuid, false);  -- orgadmin.a
set local role authenticated;
select is(
  (select count(*)::int from public.memberships om
   where om.role = 'hospital_admin' and om.hospital_id = '05000000-0000-0000-0000-00000000000a'),
  2,
  'READ (Gap#1): org_admin.a reads the central-a hospital_admin roster (a1 + dual)');
reset role;
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b3'::uuid, false);  -- org-b staff
set local role authenticated;
select is(
  (select count(*)::int from public.memberships om
   where om.role = 'hospital_admin' and om.hospital_id = '05000000-0000-0000-0000-00000000000a'),
  0,
  'READ (Gap#1) ISOLATION: an org-b staff reads ZERO of org-a''s hospital_admin roster');
reset role;

select * from finish();
rollback;
