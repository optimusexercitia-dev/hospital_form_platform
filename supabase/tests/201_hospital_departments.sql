-- Hospital Departments RLS + create-case wiring gate (migration
-- 20260713000500_hospital_departments.sql). Departments are a HOSPITAL-SCOPED,
-- NON-PHI vocabulary. The security proof:
--   * READ  = any member of the hospital (plain staff sees the dropdown), but NOT
--             a member/admin of another hospital or org.
--   * WRITE = org_admin (ANY hospital in org) OR hospital_admin (OWN hospital only).
--             A hospital_admin CANNOT write a sibling hospital's departments; a
--             plain staff / staff_admin CANNOT write at all.
--   * The reorder_departments DEFINER RPC re-enforces write authority AND rejects a
--     foreign/archived id (no cross-hospital scramble/probe).
--   * A department from a DIFFERENT hospital passed to create_case is REJECTED
--     (HC030), not silently accepted; the both-set shape is rejected.
--
-- Fixture: the SEEDED two-org world (org-A has TWO hospitals). Personas (Test1234!):
--   staff1.ccih    (…03): plain staff of CCIH (central-a)   → READS central-a depts
--   chefe.ccih     (…02): staff_admin of CCIH (central-a)   → READS, but NO WRITE
--   hospitaladmin.a1 (…e1): hospital_admin central-a ONLY   → WRITES central-a only
--   hospitaladmin.dual(…e3): hospital_admin BOTH org-a hosp → WRITES both
--   orgadmin.a     (b1): org_admin of org-a                 → WRITES any org-a hosp
--   staff1.qual.b  (b3): plain staff of org-b               → reads NONE of org-a
-- Hospitals: central-a 05..000a, secundario-a 05..00a2, central-b 05..000b.
-- Commissions: CCIH a0..a1 (central-a), Ética e0..e1 (secundario-a).

begin;
select plan(27);

create temp table p on commit drop as select
  '00000000-0000-0000-0000-000000000003'::uuid as staff_a,
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_a,
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha_a1,
  '00000000-0000-0000-0000-0000000000e3'::uuid as ha_dual,
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b3'::uuid as staff_b,
  '05000000-0000-0000-0000-00000000000a'::uuid as hosp_central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as hosp_secundario_a,
  '05000000-0000-0000-0000-00000000000b'::uuid as hosp_central_b,
  'a0000000-0000-0000-0000-0000000000a1'::uuid as comm_ccih,   -- central-a
  'e0000000-0000-0000-0000-0000000000e1'::uuid as comm_etica,  -- secundario-a
  -- fixed dept ids seeded below (as superuser)
  'd0000000-0000-0000-0000-0000000000a1'::uuid as dept_ca_1,   -- central-a
  'd0000000-0000-0000-0000-0000000000a2'::uuid as dept_ca_2,   -- central-a
  'd0000000-0000-0000-0000-0000000000a3'::uuid as dept_ca_arch,-- central-a archived
  'd0000000-0000-0000-0000-00000000a201'::uuid as dept_sa_1,   -- secundario-a
  'd0000000-0000-0000-0000-0000000000b1'::uuid as dept_cb_1;   -- central-b
grant select on p to authenticated;

-- Seed fixture departments as superuser (bypasses RLS; this is setup, not the SUT).
insert into public.hospital_departments (id, hospital_id, name, position, archived) values
  ('d0000000-0000-0000-0000-0000000000a1', '05000000-0000-0000-0000-00000000000a', 'UTI Adulto',        0, false),
  ('d0000000-0000-0000-0000-0000000000a2', '05000000-0000-0000-0000-00000000000a', 'Pronto-Socorro',    1, false),
  ('d0000000-0000-0000-0000-0000000000a3', '05000000-0000-0000-0000-00000000000a', 'Setor Desativado',  2, true),
  ('d0000000-0000-0000-0000-00000000a201', '05000000-0000-0000-0000-0000000000a2', 'Ambulatório A2',    0, false),
  ('d0000000-0000-0000-0000-0000000000b1', '05000000-0000-0000-0000-00000000000b', 'Bloco Cirúrgico B', 0, false);

-- ============================================================================
-- §1: READ — a plain staff of central-a reads its hospital's NON-archived depts,
--     and ZERO of a sibling hospital / another org.
-- ============================================================================
select test_helpers.claims_for((select staff_a from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_departments
   where hospital_id = (select hosp_central_a from p) and archived = false),
  2, 'READ: plain staff of central-a reads its 2 non-archived departments (dropdown)');
select ok(
  app.is_hospital_member_of((select hosp_central_a from p)),
  'PREDICATE: is_hospital_member_of(central-a) = true for a CCIH staff');
select is(
  (select count(*)::int from public.hospital_departments
   where hospital_id = (select hosp_secundario_a from p)),
  0, 'READ PROOF: central-a staff reads ZERO of the SIBLING hospital''s departments');
select is(
  (select count(*)::int from public.hospital_departments
   where hospital_id = (select hosp_central_b from p)),
  0, 'READ PROOF: central-a staff reads ZERO of the OTHER-ORG hospital''s departments');
reset role;

-- An org-b plain staff reads NONE of org-a's departments (cross-org boundary).
select test_helpers.claims_for((select staff_b from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_departments
   where hospital_id = (select hosp_central_a from p)),
  0, 'READ PROOF: org-b staff reads ZERO central-a departments');
reset role;

-- ============================================================================
-- §2: WRITE — hospital_admin of central-a writes central-a, NOT secundario-a.
-- ============================================================================
select test_helpers.claims_for((select ha_a1 from p), false);
set local role authenticated;
select lives_ok(
  $$insert into public.hospital_departments (hospital_id, name, position)
    values ('05000000-0000-0000-0000-00000000000a', 'Centro Cirúrgico', 3)$$,
  'WRITE: hospital_admin.a1 inserts a central-a department (own hospital)');
select lives_ok(
  $$update public.hospital_departments set name = 'UTI Adulto (renomeado)'
    where id = 'd0000000-0000-0000-0000-0000000000a1'$$,
  'WRITE: hospital_admin.a1 renames a central-a department');
select lives_ok(
  $$update public.hospital_departments set archived = true
    where id = 'd0000000-0000-0000-0000-0000000000a2'$$,
  'WRITE: hospital_admin.a1 archives a central-a department');
-- Cross-hospital write is a NO-OP under RLS (0 rows matched, no error): the UPDATE
-- lives but touches nothing, proving isolation. (Verified UNCHANGED as superuser
-- below, since staff can't even SELECT the sibling-hospital row.)
select lives_ok(
  $$update public.hospital_departments set name = 'HACK'
    where id = 'd0000000-0000-0000-0000-00000000a201'$$,
  'WRITE: hospital_admin.a1 cross-hospital UPDATE lives (RLS no-op, 0 rows matched)');
-- A sibling-hospital INSERT is rejected by the WITH CHECK.
select throws_ok(
  $$insert into public.hospital_departments (hospital_id, name)
    values ('05000000-0000-0000-0000-0000000000a2', 'Injetado indevidamente')$$,
  '42501',
  'new row violates row-level security policy for table "hospital_departments"',
  'WRITE PROOF: hospital_admin.a1 INSERT into secundario-a is rejected (WITH CHECK)');
reset role;
-- As superuser (RLS off): the secundario-a dept name is UNCHANGED by the no-op UPDATE.
select is(
  (select name from public.hospital_departments
   where id = 'd0000000-0000-0000-0000-00000000a201'),
  'Ambulatório A2', 'WRITE PROOF: the secundario-a dept name is UNCHANGED by the cross-hospital UPDATE');

-- ============================================================================
-- §3: WRITE — a plain staff / staff_admin CANNOT write (read-only members).
-- ============================================================================
select test_helpers.claims_for((select staff_a from p), false);
set local role authenticated;
select throws_ok(
  $$insert into public.hospital_departments (hospital_id, name)
    values ('05000000-0000-0000-0000-00000000000a', 'Não deveria')$$,
  '42501', null,
  'WRITE PROOF: plain staff of central-a CANNOT insert a department (read-only)');
reset role;

select test_helpers.claims_for((select chefe_a from p), false);
set local role authenticated;
-- The UPDATE lives but matches 0 rows under RLS (staff_admin is not org/hospital
-- admin). Verified UNCHANGED as superuser below.
select lives_ok(
  $$update public.hospital_departments set name = 'staff_admin edit'
    where id = 'd0000000-0000-0000-0000-0000000000a1'$$,
  'WRITE: staff_admin UPDATE lives (RLS no-op, 0 rows matched)');
reset role;
select is(
  (select name from public.hospital_departments
   where id = 'd0000000-0000-0000-0000-0000000000a1'),
  'UTI Adulto (renomeado)',
  'WRITE PROOF: staff_admin did NOT change the dept (still the ha1 rename)');

-- ============================================================================
-- §4: WRITE — org_admin writes ANY hospital in the org; hospital_admin.dual both.
-- ============================================================================
select test_helpers.claims_for((select orgadmin_a from p), false);
set local role authenticated;
select lives_ok(
  $$insert into public.hospital_departments (hospital_id, name)
    values ('05000000-0000-0000-0000-0000000000a2', 'Setor via org_admin')$$,
  'WRITE: org_admin.a inserts into secundario-a (any hospital in org)');
select lives_ok(
  $$insert into public.hospital_departments (hospital_id, name)
    values ('05000000-0000-0000-0000-00000000000a', 'Setor central via org_admin')$$,
  'WRITE: org_admin.a inserts into central-a as well');
reset role;

select test_helpers.claims_for((select ha_dual from p), false);
set local role authenticated;
select lives_ok(
  $$update public.hospital_departments set position = 9
    where id = 'd0000000-0000-0000-0000-00000000a201'$$,
  'WRITE: hospital_admin.dual writes secundario-a (holds both hospital grants)');
reset role;

-- ============================================================================
-- §5: reorder_departments RPC — authority + foreign-id rejection.
-- ============================================================================
-- hospital_admin.a1 reorders central-a's live list (valid ids) — OK.
select test_helpers.claims_for((select ha_a1 from p), false);
set local role authenticated;
select lives_ok(
  $$select public.reorder_departments(
      '05000000-0000-0000-0000-00000000000a',
      array['d0000000-0000-0000-0000-0000000000a1']::uuid[])$$,
  'RPC: hospital_admin.a1 reorders central-a live departments');
-- A foreign (secundario-a) id in the list is REJECTED (HC030) — no scramble/probe.
select throws_ok(
  $$select public.reorder_departments(
      '05000000-0000-0000-0000-00000000000a',
      array['d0000000-0000-0000-0000-0000000000a1',
            'd0000000-0000-0000-0000-00000000a201']::uuid[])$$,
  'HC030', null,
  'RPC PROOF: a secundario-a id mixed into a central-a reorder is REJECTED');
-- An archived id is rejected too (only live ids may be reordered).
select throws_ok(
  $$select public.reorder_departments(
      '05000000-0000-0000-0000-00000000000a',
      array['d0000000-0000-0000-0000-0000000000a3']::uuid[])$$,
  'HC030', null,
  'RPC PROOF: an archived id in the reorder list is REJECTED');
reset role;
-- A non-admin (plain staff) calling reorder is rejected (42501).
select test_helpers.claims_for((select staff_a from p), false);
set local role authenticated;
select throws_ok(
  $$select public.reorder_departments(
      '05000000-0000-0000-0000-00000000000a',
      array['d0000000-0000-0000-0000-0000000000a1']::uuid[])$$,
  '42501', null,
  'RPC PROOF: a plain staff calling reorder_departments is rejected');
reset role;
-- An admin of a DIFFERENT hospital calling reorder on central-a is rejected.
select test_helpers.claims_for((select ha_a1 from p), false);
set local role authenticated;
select throws_ok(
  $$select public.reorder_departments(
      '05000000-0000-0000-0000-0000000000a2',
      array['d0000000-0000-0000-0000-00000000a201']::uuid[])$$,
  '42501', null,
  'RPC PROOF: hospital_admin.a1 reordering the SIBLING hospital is rejected');
reset role;

-- ============================================================================
-- §6: create_case department wiring — cross-hospital dept rejected; both-set
--     shape rejected; a valid own-hospital dept is stored.
-- ============================================================================
-- chefe.ccih is staff_admin of CCIH (central-a) → may create_case there.
select test_helpers.claims_for((select chefe_a from p), false);
set local role authenticated;
-- A department from central-a is accepted + stored.
select lives_ok(
  $$select public.create_case(
      'a0000000-0000-0000-0000-0000000000a1', 'Caso setor válido', false, '{}'::uuid[],
      'd0000000-0000-0000-0000-0000000000a1', null)$$,
  'CREATE_CASE: a central-a department on a central-a case is accepted');
-- A department from a DIFFERENT hospital (secundario-a) is REJECTED (HC030).
select throws_ok(
  $$select public.create_case(
      'a0000000-0000-0000-0000-0000000000a1', 'Caso setor errado', false, '{}'::uuid[],
      'd0000000-0000-0000-0000-00000000a201', null)$$,
  'HC030', null,
  'CREATE_CASE PROOF: a secundario-a department on a central-a case is REJECTED');
-- Both department_id AND department_other set is rejected (shape).
select throws_ok(
  $$select public.create_case(
      'a0000000-0000-0000-0000-0000000000a1', 'Caso setor ambos', false, '{}'::uuid[],
      'd0000000-0000-0000-0000-0000000000a1', 'Outro setor')$$,
  '23514', null,
  'CREATE_CASE PROOF: setting both department_id AND department_other is REJECTED');
-- department_other alone is accepted (the "Outro" custom value).
select lives_ok(
  $$select public.create_case(
      'a0000000-0000-0000-0000-0000000000a1', 'Caso Outro', false, '{}'::uuid[],
      null, 'Setor personalizado')$$,
  'CREATE_CASE: department_other alone (Outro) is accepted');
reset role;

-- ============================================================================
-- §7: the cases_department_shape CHECK is enforced at the table level too.
-- ============================================================================
select throws_ok(
  $$insert into public.cases (commission_id, case_number, department_id, department_other)
    values ('a0000000-0000-0000-0000-0000000000a1', 99999,
            'd0000000-0000-0000-0000-0000000000a1', 'X')$$,
  '23514', null,
  'CHECK: cases_department_shape rejects a row with BOTH department fields set');

select finish();
rollback;
