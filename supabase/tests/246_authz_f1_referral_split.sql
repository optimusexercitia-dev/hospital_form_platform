-- ADR 0078 D7 / F1 — Referral predicate split + write-gate fix (defect ②).
-- Mutation-falsifiable keystones: each MUST fail if the F1 fix is reverted. Every deny
-- is paired with the legitimate allow so no keystone is a blanket deny.
--   K-F1a (246): target analyst who could write under the OLD gate is now DENIED.
--   K-F1b (247): set_referral_patient has no authenticated EXECUTE (direct call -> 42501).
--   K-F1c (248): a metadata reader lacking PHI reads no body/path/snapshot.
--   K-F1d (249): the legitimate SOURCE coordinator still writes AND amends.
--   K-F1e (250): the five predicates resolve consistently across the principal matrix.

begin;
select plan(31);

update app.feature_flags set enabled = true where key = 'case_referrals';
update app.feature_flags set enabled = true where key = 'case_access';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,   -- SOURCE coordinator (commission A)
         (v->>'st_x')::uuid   as st_x,   -- plain member of A (metadata reader)
         (v->>'sa_y')::uuid   as sa_y,   -- TARGET coordinator (commission B)
         (v->>'st_y')::uuid   as st_y,   -- plain staff of B (-> made target ANALYST)
         (v->>'comm_x')::uuid as comm_x, -- A
         (v->>'comm_y')::uuid as comm_y  -- B
  from ctx;
grant select on k to authenticated;

create temp table voc on commit drop as
  select (select id from public.referral_types where key = 'parecer') as type_parecer;
grant select on voc to authenticated;

-- Source case in A (with a narrative to freeze) + target case in B (for the analyst arm).
create temp table cs on commit drop as
  select gen_random_uuid() as src_case, gen_random_uuid() as tgt_case, gen_random_uuid() as narr;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by) values
  ((select src_case from cs), (select comm_x from k), 9461, 'Caso A', (select sa_x from k)),
  ((select tgt_case from cs), (select comm_y from k), 9462, 'Caso B', (select sa_y from k));
insert into public.case_narratives (id, case_id, display_label, display_position, title, body_md, created_by)
values ((select narr from cs), (select src_case from cs), 'Resumo', 0, 'Resumo',
        'CORPO-SENSIVEL-DO-PACIENTE', (select sa_x from k));

-- ---------------------------------------------------------------------------
-- r1: a SENT/ACCEPTED/LINKED referral with a PHI snapshot (exercises the door).
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r1 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Solicitação de parecer', true);
select public.add_referral_shared_item((select id from r1), 'narrative', (select narr from cs), null);
select public.save_referral_patient(
  (select id from r1), 'Paciente Teste', 'MRN-9', null, 70, 'male', null, 'UTI', 'Dr X');
select public.send_referral((select id from r1));
reset role;
grant select on r1 to authenticated;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r1));
select public.accept_referral((select id from r1));
select public.link_referral_case((select id from r1), (select tgt_case from cs));
reset role;

-- Make st_y a TARGET ANALYST via a case_access grant on B's linked case.
select test_helpers.grant_ca((select tgt_case from cs), (select st_y from k), 'read', (select sa_y from k));

-- ===========================================================================
-- K-F1a (246): the exploit was REAL and is now closed.
-- ===========================================================================
-- Proof the OLD write gate admitted the target analyst: can_read_referral_phi (the
-- predicate the old set_referral_patient gated its WRITE on) is TRUE for st_y.
select is(app.can_read_referral_phi((select id from r1), (select st_y from k)), true,
  'K-F1a: target analyst passes can_read_referral_phi (the OLD write gate would have admitted the overwrite)');
-- The analyst holds NO amend authority (the NEW write gate).
select is(app.can_amend_referral_phi_snapshot((select id from r1), (select st_y from k)), false,
  'K-F1a: target analyst has NO amend authority (new write gate)');
-- And the write is denied through the public door.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.save_referral_patient(
       (select id from r1), 'HACKED', 'MRN-HACK', null, null, 'male', null, null, null) $$,
  'HC078', null, 'K-F1a: target analyst CANNOT overwrite the transmitted patient identity (HC078)');
reset role;

-- ===========================================================================
-- K-F1b (247): set_referral_patient is off the public API.
-- ===========================================================================
select is(
  has_function_privilege('authenticated',
    'public.set_referral_patient(uuid,text,text,date,integer,text,text,text,text)', 'execute'),
  false, 'K-F1b: authenticated has NO EXECUTE on set_referral_patient');
-- Even the legitimate source coordinator cannot call the private helper directly.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_referral_patient(
       (select id from r1), 'X', 'Y', null, null, 'male', null, null, null) $$,
  '42501', null, 'K-F1b: a direct authenticated call to set_referral_patient raises 42501');
reset role;

-- ===========================================================================
-- K-F1c (248): a metadata-only reader (st_x, plain source member) sees no PHI.
-- ===========================================================================
select is(app.can_read_referral_metadata((select id from r1), (select st_x from k)), true,
  'K-F1c: plain source member CAN read the envelope (metadata)');
select is(app.can_read_referral_phi((select id from r1), (select st_x from k)), false,
  'K-F1c: plain source member CANNOT read PHI');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(public.get_referral_patient((select id from r1)), null,
  'K-F1c: metadata reader gets NULL from get_referral_patient (no PHI body)');
select is(
  (select count(*)::int from public.referral_shared_item where referral_id = (select id from r1)),
  0, 'K-F1c: metadata reader sees ZERO snapshot rows (no frozen body / storage path)');
reset role;

-- ===========================================================================
-- K-F1d (249): the legitimate SOURCE coordinator still writes AND amends.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r2 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Segundo parecer', true);
reset role;
grant select on r2 to authenticated;

select is(app.can_manage_referral_phi_disclosure((select id from r2), (select sa_x from k)), true,
  'K-F1d: source coordinator holds disclosure authority (new snapshot)');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.save_referral_patient(
       (select id from r2), 'Primeiro Nome', 'MRN-A', null, 60, 'female', null, 'Enf', 'Dr Y') $$,
  'K-F1d: source coordinator WRITES a new snapshot');
reset role;
select is(
  (select name from public.referral_patient where referral_id = (select id from r2)),
  'Primeiro Nome', 'K-F1d: the snapshot was written');
select is(app.can_amend_referral_phi_snapshot((select id from r2), (select sa_x from k)), true,
  'K-F1d: source coordinator holds amend authority (existing snapshot)');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.save_referral_patient(
       (select id from r2), 'Segundo Nome', 'MRN-B', null, 61, 'female', null, 'Enf', 'Dr Y') $$,
  'K-F1d: source coordinator AMENDS the snapshot');
reset role;
select is(
  (select name from public.referral_patient where referral_id = (select id from r2)),
  'Segundo Nome', 'K-F1d: the amend took effect');

-- ===========================================================================
-- K-F1e (250): the five predicates resolve consistently across the matrix.
-- disclosure/amend admit source-coord, reject every target-side principal.
-- ===========================================================================
-- can_manage_referral_phi_disclosure
select is(app.can_manage_referral_phi_disclosure((select id from r1), (select sa_x from k)), true,
  'K-F1e: disclosure — source coordinator admitted');
select is(app.can_manage_referral_phi_disclosure((select id from r1), (select sa_y from k)), false,
  'K-F1e: disclosure — target coordinator rejected');
select is(app.can_manage_referral_phi_disclosure((select id from r1), (select st_y from k)), false,
  'K-F1e: disclosure — target analyst rejected');
select is(app.can_manage_referral_phi_disclosure((select id from r1), (select st_x from k)), false,
  'K-F1e: disclosure — plain member rejected');
-- can_amend_referral_phi_snapshot
select is(app.can_amend_referral_phi_snapshot((select id from r1), (select sa_x from k)), true,
  'K-F1e: amend — source coordinator admitted');
select is(app.can_amend_referral_phi_snapshot((select id from r1), (select sa_y from k)), false,
  'K-F1e: amend — target coordinator rejected');
select is(app.can_amend_referral_phi_snapshot((select id from r1), (select st_y from k)), false,
  'K-F1e: amend — target analyst rejected');
select is(app.can_amend_referral_phi_snapshot((select id from r1), (select st_x from k)), false,
  'K-F1e: amend — plain member rejected');
-- can_write_referral_response (target reply authority): admits target coord ONLY.
select is(app.can_write_referral_response((select id from r1), (select sa_y from k)), true,
  'K-F1e: response — target coordinator admitted');
select is(app.can_write_referral_response((select id from r1), (select sa_x from k)), false,
  'K-F1e: response — source coordinator rejected');
select is(app.can_write_referral_response((select id from r1), (select st_y from k)), false,
  'K-F1e: response — target analyst rejected');
select is(app.can_write_referral_response((select id from r1), (select st_x from k)), false,
  'K-F1e: response — plain member rejected');
-- can_read_referral_phi read arm stays intact.
select is(app.can_read_referral_phi((select id from r1), (select st_y from k)), true,
  'K-F1e: PHI read arm — target analyst still READS PHI');
select is(app.can_read_referral_phi((select id from r1), (select sa_x from k)), true,
  'K-F1e: PHI read arm — source coordinator reads PHI');
select is(app.can_read_referral_phi((select id from r1), (select sa_y from k)), true,
  'K-F1e: PHI read arm — target coordinator reads PHI');
-- _metadata excludes PHI: a plain source member is a metadata reader but NOT a PHI reader.
select is(app.can_read_referral_metadata((select id from r1), (select st_x from k)), true,
  'K-F1e: metadata — plain source member reads the envelope');

select * from finish();
rollback;
