-- AFF W2 / T2.6 — the affiliation doors, the widened `profiles` legs, the org people
-- directory, `grant_role_impl`'s new arm, and the delete guard.
--
-- ADR 0097 D5/D6/D10/D11/D13/D17 + ADR 0098 W2. Migrations held: 20260909000500 /
-- 000600 / 000700 / 000800 / 000900.
--
-- ⚠ EVERY refusal is asserted at the DOOR, under `set local role`, by calling the thing
-- the product calls — never by evaluating a predicate. A correct predicate is not a
-- correct door (the three-shapes lesson), and auditing one layer while inferring the
-- next is how this program shipped bugs five times in a day (authz-handoff §7.14).
--
-- ⚠ WRONG-ARM DEFENCE. Several denies here could be produced by the WRONG check —
-- §6.2's `technical_director` refusal would look identical if the fixture person simply
-- were not a physician. Where two arms can produce the same deny, the assertion pins
-- the SQLSTATE that identifies the arm under test (42501 authority vs HC0G3 physician),
-- which is the structural defence authz-handoff §7.1 recommends.
--
-- Assertion count: 51

begin;
select plan(51);

-- Asserted preconditions, not assumed ones (§7.3): a flag read at the wrong moment is
-- how a suite silently skips its own keystones.
update app.feature_flags set enabled = true where key in ('audit_trail', 'technical_director');
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.0 PRECONDITION: audit_trail is enabled (the D11 CPF audit row depends on it)');

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000b0'::uuid as platform,
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha1,        -- hospital_admin, central-a ONLY
  '00000000-0000-0000-0000-0000000000e3'::uuid as ha_dual,    -- hospital_admin of BOTH
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as orgadmin_b,
  '00000000-0000-0000-0000-0000000000e2'::uuid as nsporg_a,   -- nsp_org_admin — MEDIUM-5 control
  '00000000-0000-0000-0000-000000000003'::uuid as staff_ccih,
  '00000000-0000-0000-0000-0000000000b3'::uuid as staff_b,    -- org-B person (tenant control)
  '00000000-0000-0000-0000-000000000002'::uuid as chefe_ccih, -- staff_admin of CCIH (central-a)
  '00000000-0000-0000-0000-0000000000f1'::uuid as td_a,       -- technical_director of central-a
  '00000000-0000-0000-0000-0000000000f2'::uuid as td_deputy_a, -- TD DEPUTY of central-a, NEVER affiliated
  '00000000-0000-0000-0000-0000000000d1'::uuid as seatless,   -- novato.pendente: ZERO memberships
  -- Seated ONLY at secundario-a (nsp_coordinator), so for a central-a admin every leg
  -- is false — the §4.3 deny arm. Was `desativado.conta` until T3.5 seeded the world
  -- with a deactivated-account guard that (correctly) refuses to affiliate it.
  '00000000-0000-0000-0000-0000000000c5'::uuid as sibling_subject,
  '00000000-0000-0000-0000-0000000000d4'::uuid as deactivated_subject, -- is_active = false
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as secundario_a,
  '05000000-0000-0000-0000-00000000000b'::uuid as central_b;
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §1 DOOR SHAPE. The ACL split IS the security property: a kernel taking an explicit
-- actor must be unreachable by anyone who could forge one.
-- ============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('affiliate_person_impl', 'end_affiliation_impl')
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
           or has_function_privilege('service_role', p.oid, 'EXECUTE'))), 0,
  '1.1 the actor KERNELS are executable by neither authenticated nor service_role — p_actor cannot be forged');

select ok(
  not has_function_privilege('authenticated', 'public.affiliate_person_for(uuid,uuid,uuid,text,date,text,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.end_affiliation_for(uuid,uuid,uuid,date)', 'EXECUTE'),
  '1.2 the _for twins are NOT executable by authenticated — naming the actor is a service-role privilege');

select ok(
  has_function_privilege('service_role', 'public.affiliate_person_for(uuid,uuid,uuid,text,date,text,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.end_affiliation_for(uuid,uuid,uuid,date)', 'EXECUTE'),
  '1.3 TWIN: service_role CAN execute them (1.2 is a split, not a blanket revoke)');

select ok(
  has_function_privilege('authenticated', 'public.affiliate_person(uuid,uuid,text,date,text,text,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.end_affiliation(uuid,uuid,date)', 'EXECUTE')
  -- AFF4 B6a: the arity gained `p_include_ended boolean`. This string is the executable
  -- half of FUP-SIGNATURE-STRING-CALLERS-ABORT-ON-A-DROP-CREATE — a stale one aborts this
  -- whole suite as a bare "Bad plan" naming no function. `361` §1.2 is the detector that
  -- points here.
  and has_function_privilege('authenticated', 'public.list_org_people(uuid,text,text,boolean)', 'EXECUTE'),
  '1.4 the interactive doors ARE executable by authenticated');

-- The standing t19 trap: a new public.* RPC that keeps PUBLIC's default EXECUTE leaks
-- to anon by inheritance.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('affiliate_person','affiliate_person_for','end_affiliation','end_affiliation_for','list_org_people')
      and has_function_privilege('public', p.oid, 'EXECUTE')), 0,
  '1.5 t19: PUBLIC cannot execute any of the five new RPCs (REVOKE before GRANT)');

-- ============================================================================
-- §2 affiliate_person — ALLOW and DENY, every arm.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;

select lives_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                                   '05000000-0000-0000-0000-00000000000a', 'MAT-777')$$,
  '2.1 ALLOW: a hospital_admin affiliates an in-org person to the hospital it administers');

select throws_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000c5',
                                   '05000000-0000-0000-0000-0000000000a2')$$,
  '42501', null,
  '2.2 DENY: ... and NOT to a sibling hospital it does not administer');

select throws_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000b3',
                                   '05000000-0000-0000-0000-00000000000a')$$,
  'HC0R0', null,
  '2.3 DENY (D13 tenant check): a person anchored to ANOTHER organisation is refused — the check resolveOrInviteUser was missing');

-- Idempotent by (person, hospital): the second call refreshes, it does not duplicate.
select lives_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                                   '05000000-0000-0000-0000-00000000000a', 'MAT-888')$$,
  '2.4 a repeat call is accepted (idempotent by person+hospital)');
reset role;

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select seatless from k) and hospital_id = (select central_a from k)
      and ended_on is null), 1,
  '2.5 ... and produced exactly ONE active row, not two (the partial unique is not the thing being relied on)');
select is(
  (select hospital_employee_id from public.hospital_affiliations
    where principal_id = (select seatless from k) and hospital_id = (select central_a from k)
      and ended_on is null), 'MAT-888',
  '2.6 ... with the matrícula REFRESHED (the repeat call was not a silent no-op)');

-- Self-affiliation is ALLOWED, deliberately (D13). ha_dual holds no affiliation yet.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e3', false);
set local role authenticated;
select lives_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000e3',
                                   '05000000-0000-0000-0000-0000000000a2')$$,
  '2.7 SELF-AFFILIATION IS ALLOWED and that is deliberate — it confers no capability, and an admin absent from their own roster is a bug');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000c5',
                                   '05000000-0000-0000-0000-0000000000a2')$$,
  '2.8 DOMINANCE: an org_admin may affiliate at ANY hospital of its org (D18)');

-- AFF W3/T3.1 (ADR 0098 §W3.3). A DEACTIVATED account cannot be affiliated. The UI is
-- told by `list_org_people`'s `is_active`, but Rule 1 says the UI is not the boundary —
-- so this asserts the KERNEL refuses, at the door the product calls.
--
-- ⚠ The code is the discriminator on purpose: HC0R4 proves the DEACTIVATION arm
-- refused, not the authority arm (42501) or the tenant arm (HC0R0). The caller here is
-- an org_admin of the target's own org, so those two arms are satisfied.
select throws_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000d4',
                                   '05000000-0000-0000-0000-0000000000a2')$$,
  'HC0R4', null,
  '2.8b DENY: a DEACTIVATED account cannot be affiliated — refused by the deactivation arm (HC0R4), not by authority');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003', false);
set local role authenticated;
select throws_ok(
  $$select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                                   '05000000-0000-0000-0000-00000000000a')$$,
  '42501', null,
  '2.9 DENY: a plain commission member has no affiliation authority at all');
reset role;

-- ============================================================================
-- §3 end_affiliation — the D5 / audit-MEDIUM-3 refusal, at BOTH tiers.
-- A commission-only check would let an admin end a sitting technical director's
-- employment while the TD role lived on; that is the seat-orphaning D5 exists to stop.
-- ============================================================================
select public.affiliate_person_for((select orgadmin_a from k), (select chefe_ccih from k),
                                   (select central_a from k));   -- staff_admin of CCIH
select public.affiliate_person_for((select orgadmin_a from k), (select td_a from k),
                                   (select central_a from k));   -- technical_director

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;

select throws_ok(
  $$select public.end_affiliation('00000000-0000-0000-0000-000000000002',
                                  '05000000-0000-0000-0000-00000000000a')$$,
  'HC0R1', null,
  '3.1 REFUSED with a COMMISSION-tier seat (staff_admin of a commission under this hospital)');

select throws_ok(
  $$select public.end_affiliation('00000000-0000-0000-0000-0000000000f1',
                                  '05000000-0000-0000-0000-00000000000a')$$,
  'HC0R1', null,
  '3.2 REFUSED with a HOSPITAL-tier seat (technical_director) — the arm a commission-only check would miss');

select throws_ok(
  $$select public.end_affiliation('00000000-0000-0000-0000-0000000000c5',
                                  '05000000-0000-0000-0000-00000000000a')$$,
  'HC0R2', null,
  '3.3 a person with no ACTIVE affiliation here is HC0R2, not HC0R1 — the two refusals are distinguishable');

select lives_ok(
  $$select public.end_affiliation('00000000-0000-0000-0000-0000000000d1',
                                  '05000000-0000-0000-0000-00000000000a')$$,
  '3.4 TWIN: a seatless person''s affiliation DOES end — 3.1/3.2 are the seat block, not a door that never works');
reset role;

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select seatless from k) and hospital_id = (select central_a from k)), 1,
  '3.5 the ended row SURVIVES (soft end, D4) — ending is not deleting');
select ok(
  (select ended_on is not null and ended_by = (select ha1 from k)
     from public.hospital_affiliations
    where principal_id = (select seatless from k) and hospital_id = (select central_a from k)),
  '3.6 ... with ended_on set and ended_by naming the ACTOR (Rule 11)');

-- The blockers are RETURNED, not merely counted: the UI must be able to name the seats.
do $$
declare v_detail text;
begin
  begin
    perform public.end_affiliation_for('00000000-0000-0000-0000-0000000000b1'::uuid,
                                       '00000000-0000-0000-0000-0000000000f1'::uuid,
                                       '05000000-0000-0000-0000-00000000000a'::uuid);
  exception when others then
    get stacked diagnostics v_detail = pg_exception_detail;
  end;
  create temp table blockers on commit drop as
    select v_detail as detail,
           (v_detail::jsonb @> '[{"role":"technical_director"}]'::jsonb) as names_td;
end $$;
select ok((select names_td from blockers),
  '3.7 the HC0R1 DETAIL carries the blocking seats as JSON, naming technical_director');

-- ============================================================================
-- §4 T2.3 — the widened `profiles` SELECT. A SECURITY WIDENING, so both arms.
--
-- ⚠ THE DENY ARM PINS THE DEFAULT STATE, NOT A HARD BOUNDARY (D6 / audit LOW-1):
-- `affiliate_person` lets ANY in-org hospital admin self-serve an affiliation, after
-- which the affiliation leg admits them. The tenant boundary remains the ORGANISATION.
-- A future auditor must not read 4.3 as tenant isolation — 4.5 is that assertion.
-- ============================================================================
-- ⚠ FIXTURE NOTE, and it is the reason this file went red once before it went green:
-- §3.4 ENDED `seatless`'s central-a affiliation, so §4.1's affiliation leg had nothing
-- to fire on and asserted 0 — the classic wrong-arm fixture, where a later assertion
-- measures a state an earlier one dismantled. Re-affiliating here restores the arm
-- under test, and is itself legal only because an ended row plus a new active row is
-- exactly what D4 permits (`301` §3.2).
select public.affiliate_person_for((select orgadmin_a from k), (select seatless from k),
                                   (select central_a from k));
select public.affiliate_person_for((select orgadmin_a from k), (select sibling_subject from k),
                                   (select secundario_a from k));

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.profiles where id = (select seatless from k)), 1,
  '4.1 ALLOW (affiliation leg): the hospital admin reads a committee-less employee''s profile — D2''s whole premise');
-- ⚠ THE SUBJECT HERE IS THE DEPUTY, NOT `td_a`, AND THAT IS THE WHOLE POINT. §3
-- affiliated `td_a` to central-a, so reading THEIR profile would have been admitted by
-- the AFFILIATION leg — a fixture leaving the subject admitted by a DIFFERENT arm than
-- the one under test, which is the recorded wrong-arm vacuity shape. It was not caught
-- by review: it was caught by the mutation oracle, where removing the membership leg
-- left the assertion GREEN. `td_deputy_a` holds a hospital-tier seat at central-a and
-- NO affiliation, so the membership leg is the only path to their row.
select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select td_deputy_a from k)), 0,
  '4.2a ARM ISOLATION: the §4.2 subject has NO affiliation row, so only the membership leg can admit them');
select is(
  (select count(*)::int from public.profiles where id = (select td_deputy_a from k)), 1,
  '4.2 ALLOW (membership leg): ... and their own hospital''s technical_director_deputy, one of ADR 0097 finding 3''s six unresolvable principal_ids');
select is(
  (select count(*)::int from public.profiles where id = (select sibling_subject from k)), 0,
  '4.3 DENY (default state, NOT tenant isolation — see the header): a person affiliated only to the SIBLING hospital, seated nowhere under mine, is not readable');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.profiles where id = (select sibling_subject from k)), 1,
  '4.4 NON-VACUITY: that same person IS readable by the org_admin — 4.3 is a leg boundary, not an invisible row');
reset role;

-- ⚠ `active_role` PASSED EXPLICITLY. `claims_for`'s two-argument form derives the claim
-- ONLY for a persona with exactly ONE live role; `orgadmin.b` holds org_admin AND a
-- staff_admin seat, so it set NO claim and `app.is_org_admin_of` returned false. This
-- cross-org DENY then passed because he had assumed no role at all, not because the org
-- anchor held — a tenant-isolation assertion proving nothing.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b2', false, 'org_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.profiles where id = (select seatless from k)), 0,
  '4.5 TENANT ISOLATION (this is the assertion 4.3 is not): another ORGANISATION''s admin reads zero');
reset role;

-- ============================================================================
-- §5 list_org_people — the ratified directory (D10/D11).
-- ============================================================================
-- ⚠ NO CPF IS WRITTEN HERE. `seed.sql` assigns novato.pendente 12345678909 (T3.5), and
-- overwriting it with another persona's seeded value was a UNIQUE violation. Reading
-- the SEEDED value is also the stronger test: it exercises the row the product path
-- would have created, not one this file invented.

-- ⚠ BASELINE FIRST. `audit_log` is a SHARED, APPEND-ONLY table and this suite runs
-- against the persisted seed, so an absolute `count(*) = 2` over `person.cpf_lookup`
-- silently counts rows this transaction did not create — a dev server hitting the same
-- local database is enough to red it, which is exactly how it was caught. Every §5
-- audit assertion below is scoped to rows NOT in this snapshot.
create temp table cpf_audit_before on commit drop as
  select id from public.audit_log where action = 'person.cpf_lookup';

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.list_org_people((select org_a from k))), '>', 5,
  '5.1 ALLOW: an org_admin reads its organisation''s people');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.list_org_people((select org_a from k))), '>', 5,
  '5.2 ALLOW: a hospital_admin reads the WHOLE ORG''s roster — finding 1, now declared and gated');
reset role;

-- MEDIUM-5: the inline predicate exists precisely so this stays empty. Borrowing
-- app.is_org_level_admin_within would have handed the directory to NSP silently.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e2', false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people((select org_a from k))), 0,
  '5.3 DENY: nsp_org_admin gets EMPTY — pins the MEDIUM-5 narrowing (is_org_level_angle_admin_within would have admitted them)');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003', false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people((select org_a from k))), 0,
  '5.4 DENY: a plain commission member gets EMPTY');
reset role;

-- ⚠ `active_role` PASSED EXPLICITLY. `claims_for`'s two-argument form derives the claim
-- ONLY for a persona with exactly ONE live role; `orgadmin.b` holds org_admin AND a
-- staff_admin seat, so it set NO claim and `app.is_org_admin_of` returned false. This
-- cross-org DENY then passed because he had assumed no role at all, not because the org
-- anchor held — a tenant-isolation assertion proving nothing.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b2', false, 'org_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people((select org_a from k))), 0,
  '5.5 DENY: another organisation''s admin gets EMPTY (and no error — a probe cannot tell "none" from "not allowed")');
reset role;

-- D11: cpf is an INPUT, never an output. Asserted structurally, on the door's own
-- signature, so adding it to the payload later cannot pass unnoticed.
select is(
  (select count(*)::int from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'list_org_people%'
      and parameter_mode = 'OUT' and parameter_name = 'cpf'), 0,
  '5.6 `cpf` is NOT in the returned payload (D11) — asserted on the signature, not on a sample row');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people((select org_a from k), null, '12345678909')), 1,
  '5.7 an EXACT full-length CPF resolves the person');
select is(
  (select count(*)::int from public.list_org_people((select org_a from k), null, '1234567890')), 0,
  '5.8 a PARTIAL CPF resolves NOTHING — no prefix search over national IDs (D11)');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)), 2,
  '5.9 every p_cpf call emitted an audit row, and ONLY those two (D11 / audit LOW-2) — the match AND the miss');
select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)
      and (metadata::text like '%12345678909%' or summary like '%12345678909%')), 0,
  '5.10 ... and NOT ONE of them carries the CPF digits (Rule 11: that and who, never the payload)');
select ok(
  (select bool_and(actor_id = (select ha1 from k)) from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)),
  '5.11 ... each naming the ACTOR — which is why this door runs on the cookie client, not the service client');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people((select org_a from k), 'Novato')), 1,
  '5.12 a NAME search still works (partial match is fine for names)');
reset role;
select is(
  (select count(*)::int from public.audit_log
    where action = 'person.cpf_lookup' and id not in (select id from cpf_audit_before)), 2,
  '5.13 ... and emitted NO audit row — only CPF lookups are logged (parity with the existing directory door)');

-- ============================================================================
-- §6 T2.5 — grant_role_impl's hospital_admin arm (ADR D17 / audit BLOCKER-1).
-- ============================================================================
set local role service_role;
select lives_ok(
  $$select public.grant_role_for('00000000-0000-0000-0000-0000000000b0',
      'hospital', '05000000-0000-0000-0000-0000000000a2', 'hospital_admin',
      '00000000-0000-0000-0000-000000000002')$$,
  '6.1 the platform admin CAN now seat a hospital_admin — without this arm T3.4 provisioning has no working path (42501)');

-- The technical_director branch keeps its deliberate no-is_admin_for posture. ⚠ The
-- SQLSTATE is the discriminator on purpose: the physician check (HC0G3) sits AFTER the
-- authority check, so a 42501 proves the AUTHORITY arm refused and not the fixture.
select throws_ok(
  $$select public.grant_role_for('00000000-0000-0000-0000-0000000000b0',
      'hospital', '05000000-0000-0000-0000-0000000000a2', 'technical_director',
      '00000000-0000-0000-0000-000000000002')$$,
  '42501', null,
  '6.2 the platform admin still CANNOT seat a technical_director — direção técnica is tenant GOVERNANCE, and the refusal is the AUTHORITY arm (42501, not HC0G3)');

select throws_ok(
  $$select public.grant_role_for('00000000-0000-0000-0000-000000000003',
      'hospital', '05000000-0000-0000-0000-0000000000a2', 'hospital_admin',
      '00000000-0000-0000-0000-0000000000d1')$$,
  '42501', null,
  '6.3 a plain commission member still cannot seat a hospital_admin (the arm was ADDED, not swapped)');

select throws_ok(
  $$select public.grant_role_for('00000000-0000-0000-0000-0000000000b1',
      'hospital', '05000000-0000-0000-0000-0000000000a2', 'hospital_admin',
      '00000000-0000-0000-0000-0000000000b1')$$,
  '42501', 'não é permitido conceder acesso a si mesmo',
  '6.4 the self-grant guard is UNTOUCHED — matched on the MESSAGE, because every refusal here is 42501');
reset role;

select is(
  (select count(*)::int from public.memberships
    where principal_id = (select chefe_ccih from k) and hospital_id = (select secundario_a from k)
      and role = 'hospital_admin'), 1,
  '6.5 NON-VACUITY: 6.1 actually wrote the membership row');

-- ============================================================================
-- §7 RULING 2 — the delete guard, and the audit arm that makes its bypass visible.
--
-- Two facts probed live rather than reasoned about, and both shape the design:
--   * `profiles` carries guard_profile_no_delete, so the ON DELETE CASCADE from
--     profiles is unreachable in origin mode — the parent delete raises first;
--   * under session_replication_role = replica the FK cascade does NOT fire either,
--     leaving affiliation rows ORPHANED. That is the same switch that disables the
--     guard, so replica mode is the ONLY mode in which a hard delete can happen —
--     which is exactly why the audit trigger is ENABLE ALWAYS and the guard is not.
--     A DELETE arm on an origin-only trigger would have been unreachable branch.
-- ============================================================================
select is(
  (select tgenabled::text from pg_trigger
    where tgrelid = 'public.hospital_affiliations'::regclass and tgname = 'guard_affiliation_no_delete_trg'), 'O',
  '7.1 the delete guard is ORIGIN-enabled, mirroring guard_profile_no_delete — an ALWAYS guard would break the demo-tenant teardown');
select is(
  (select tgenabled::text from pg_trigger
    where tgrelid = 'public.hospital_affiliations'::regclass and tgname = 'trg_audit_hospital_affiliations'), 'A',
  '7.2 the audit trigger is ENABLE ALWAYS — so the one mode a hard delete CAN happen in is the mode it is recorded in');

select throws_ok(
  $$delete from public.hospital_affiliations
     where principal_id = '00000000-0000-0000-0000-0000000000d1'$$,
  '23514', null,
  '7.3 a DELETE is REFUSED (D4: never deleted; end it instead)');

do $$
begin
  set local session_replication_role = replica;
  -- Exactly ONE row: `seatless` holds an ENDED central-a row (from §3.4) AND a new
  -- ACTIVE one (re-affiliated for §4), so an unqualified delete would remove two and
  -- the assertion below would read 2 while claiming 1.
  delete from public.hospital_affiliations
   where principal_id = '00000000-0000-0000-0000-0000000000d1' and ended_on is not null;
  set local session_replication_role = default;
end $$;
select is(
  (select count(*)::int from public.audit_log
    where action = 'affiliation.deleted'), 1,
  '7.4 a replica-mode hard delete — the ONLY way past 7.3 — IS audited (the ENABLE ALWAYS arm is reachable, not dead code)');

select * from finish();
rollback;
