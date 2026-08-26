-- AFF4 B4 (increment 3) — the five org/void doors and the self-only person record.
-- ADR 0151 D2/D3/D6/D7/D8/D11/D14 + ADR 0098 §W2.1.
--
-- ⚠ EVERY refusal is asserted AT THE DOOR, under `set local role`, by calling the thing
-- the product calls — never by evaluating a predicate. A correct predicate is not a
-- correct door (the three-shapes lesson).
--
-- ⚠ WRONG-ARM DEFENCE. Several denies here could be produced by the wrong check: a void
-- refused for a missing reason looks identical to one refused for authority if only
-- "it threw" is asserted. Every arm therefore pins the SQLSTATE that identifies the arm
-- under test, which is the structural defence authz-handoff §7.1 recommends.
--
-- ⚠ STATE IS RESET BETWEEN SECTIONS, EXPLICITLY. Suite 377 taught this the expensive way:
-- an earlier arm that SUCCEEDS mutates the row every later arm depends on, and the later
-- arms then pass for the wrong reason. Each section below states the state it needs and
-- establishes it rather than inheriting it.
--
-- ⚠ `active_role` IS PASSED EXPLICITLY for every multi-role persona. `claims_for`'s
-- two-argument form sets NO claim for a persona holding 2+ live roles, and every
-- `app.is_*_of` predicate then returns false — a DENY that passes because the persona
-- assumed no role rather than because the rule held. `orgadmin.b` is such a persona.

begin;
select plan(43);

create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000d1'::uuid as subject,      -- org A, ZERO memberships
  '00000000-0000-0000-0000-0000000000b3'::uuid as subject_b,    -- org B person (tenant control)
  '00000000-0000-0000-0000-0000000000b1'::uuid as org_admin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as org_admin_b,  -- MULTI-ROLE
  '00000000-0000-0000-0000-0000000000e1'::uuid as hosp_admin,   -- central-a only
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as secundario_a,
  'bb000000-0000-0000-0000-0000000000c1'::uuid as seat_id;
grant select on k to authenticated;
grant select on k to service_role;

-- ============================================================================
-- §0 PRECONDITIONS
-- ============================================================================
select is((select enabled from app.feature_flags where key = 'audit_trail'), true,
  '0.1 PRECONDITION: audit_trail is enabled (every door write trips an audit trigger)');

select is(
  (select count(*)::int from public.memberships where principal_id = (select subject from k)), 0,
  '0.2 PRECONDITION: the subject holds ZERO memberships, so §3 and §4 control what blocks');

select is(
  (select count(distinct role)::int from public.memberships
    where principal_id = (select org_admin_b from k)
      and (expires_at is null or expires_at > now())), 2,
  '0.3 PRECONDITION: orgadmin.b is MULTI-ROLE — the two-argument claims_for would silently deny him');

-- ============================================================================
-- §1 DOOR SHAPE. The ACL split IS the security property.
-- ============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in ('affiliate_person_to_org_impl','end_org_affiliation_impl',
          'update_org_affiliation_impl','void_affiliation_impl','void_org_affiliation_impl')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')), 0,
  '1.1 no kernel is reachable by `authenticated` — a kernel takes an explicit actor, so anyone who can call it can forge one');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('affiliate_person_to_org_for','end_org_affiliation_for',
          'update_org_affiliation_for','void_affiliation_for','void_org_affiliation_for')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')), 0,
  '1.2 `authenticated` holds EXECUTE on NONE of the five service twins');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('affiliate_person_to_org_for','end_org_affiliation_for',
          'update_org_affiliation_for','void_affiliation_for','void_org_affiliation_for')), 5,
  '1.3 ... and all five twins exist, so 1.2 is not vacuously true over an empty set');

-- ⭐ THE DELIBERATE ABSENCE. `get_own_person_record` is self-only BY SHAPE: it takes no
-- target parameter. A `_for(p_actor)` twin would by definition be "fetch any person's
-- column-locked fields". Prose cannot defend an absence — only a red-able assertion can,
-- and this is it. If someone later "completes the pattern", this fails.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app','public') and p.proname like 'get_own_person_record%'
      and p.proname <> 'get_own_person_record'), 0,
  '1.4 ⭐ NO `get_own_person_record_for` AND NO `_impl` EXIST — the absence is the design, and this is what defends it');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_own_person_record'
      and has_function_privilege('service_role', p.oid, 'EXECUTE')), 0,
  '1.5 ... and service_role cannot call it either — a service path has no self');

-- ============================================================================
-- §2 affiliate_person_to_org — D2 authority, D11 tenant conflation
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select throws_ok(
  $$select public.affiliate_person_to_org('00000000-0000-0000-0000-0000000000d1',
                                          '0c000000-0000-0000-0000-00000000000a')$$,
  '42501', null,
  '2.1 DENY: a hospital_admin has no claim at the ORGANISATION tier');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b2', false, 'org_admin');
set local role authenticated;
select throws_ok(
  $$select public.affiliate_person_to_org('00000000-0000-0000-0000-0000000000d1',
                                          '0c000000-0000-0000-0000-00000000000a')$$,
  '42501', null,
  '2.2 DENY (tenant isolation): org admin B cannot affiliate into organisation A');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select throws_ok(
  $$select public.affiliate_person_to_org('00000000-0000-0000-0000-0000000000b3',
                                          '0c000000-0000-0000-0000-00000000000a')$$,
  'HC0R0', null,
  '2.3 DENY (D11): a person anchored to ANOTHER organisation is refused — conflated with not-found, no cross-tenant CPF oracle');

select lives_ok(
  $$select public.affiliate_person_to_org('00000000-0000-0000-0000-0000000000d1',
                                          '0c000000-0000-0000-0000-00000000000a')$$,
  '2.4 ALLOW: the org admin affiliates an in-org person');

select lives_ok(
  $$select public.affiliate_person_to_org('00000000-0000-0000-0000-0000000000d1',
                                          '0c000000-0000-0000-0000-00000000000a')$$,
  '2.5 a repeat call is accepted (idempotent)');
reset role;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select subject from k) and organization_id = (select org_a from k)
      and ended_on is null and voided_at is null), 1,
  '2.6 ... and produced exactly ONE active row, not two');

-- ============================================================================
-- §2b update_org_affiliation — start-date corrections.
--
-- ⚠ THIS SECTION EXISTS BECAUSE `ARM=floor` DEMANDED IT. The door shipped with no
-- keystone driving it, and the never-called-door floor named it: "authenticated-reachable
-- prosecdef doors with 0 calls". The fix is a keystone, never an allowlist entry —
-- allowlisting a door is what MAKES it blind, because the floor arm and the door arm then
-- agree and agreement reads as coverage.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select throws_ok(
  $$select public.update_org_affiliation('00000000-0000-0000-0000-0000000000d1',
                                         '0c000000-0000-0000-0000-00000000000a',
                                         '2024-01-15')$$,
  '42501', null,
  '2b.1 DENY: a hospital_admin cannot correct an ORGANISATION affiliation''s dates');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.update_org_affiliation('00000000-0000-0000-0000-0000000000d1',
                                         '0c000000-0000-0000-0000-00000000000a',
                                         '2024-01-15')$$,
  '2b.2 ALLOW: the org admin corrects the start date');

select throws_ok(
  $$select public.update_org_affiliation('00000000-0000-0000-0000-0000000000b3',
                                         '0c000000-0000-0000-0000-00000000000a',
                                         '2024-01-15')$$,
  'HC0R2', null,
  '2b.3 DENY: a person with no active org affiliation here is "not found" — same code as the sibling doors');
reset role;

select is(
  (select started_on from public.organization_affiliations
    where principal_id = (select subject from k) and organization_id = (select org_a from k)
      and ended_on is null and voided_at is null),
  '2024-01-15'::date,
  '2b.4 ... and the correction actually landed — a door that returns without writing would pass 2b.2 alone');

-- ============================================================================
-- §3 end_org_affiliation — D3 blockers, and the D6 expired-seat DIFFERENTIAL
-- ============================================================================
-- STATE: the subject still holds the seeded hospital affiliation at central-a.
select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and ended_on is null and voided_at is null), 1,
  '3.0 PRECONDITION: one active hospital affiliation remains, so 3.1 measures the affiliation blocker');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select throws_ok(
  $$select public.end_org_affiliation('00000000-0000-0000-0000-0000000000d1',
                                      '0c000000-0000-0000-0000-00000000000a')$$,
  'HC0R6', null,
  '3.1 ⭐ D3: refuses while an ACTIVE HOSPITAL AFFILIATION remains — no cascade, the wizard composes the steps');
reset role;

-- Clear the hospital tie, then add a seat: the blocker set must cover BOTH kinds.
update public.hospital_affiliations set ended_on = current_date
 where principal_id = (select subject from k) and ended_on is null;

insert into public.memberships (id, principal_id, commission_id, role, granted_at)
values ((select seat_id from k), (select subject from k),
        'a0000000-0000-0000-0000-0000000000a1', 'staff', now());

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select throws_ok(
  $$select public.end_org_affiliation('00000000-0000-0000-0000-0000000000d1',
                                      '0c000000-0000-0000-0000-00000000000a')$$,
  'HC0R6', null,
  '3.2 ⭐ D3: an ACTIVE COMMISSION-TIER seat also blocks — resolved through commissions -> hospitals -> org, not just organization_id');
reset role;

-- ⭐ THE D6 DIFFERENTIAL. The SAME membership row, with only `expires_at` moved into the
-- past. If 3.3 still blocked, "active" would mean two different things in one program —
-- the ruling that closes FUP-AFF2-ACTIVE-MEANS-TWO-THINGS.
update public.memberships set expires_at = now() - interval '1 day' where id = (select seat_id from k);

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  $$select public.end_org_affiliation('00000000-0000-0000-0000-0000000000d1',
                                      '0c000000-0000-0000-0000-00000000000a')$$,
  '3.3 ⭐ D6 DIFFERENTIAL: the SAME seat, now EXPIRED, does NOT block — an expired seat is not an active one');
reset role;

select is(
  (select ended_by from public.organization_affiliations
    where principal_id = (select subject from k) and organization_id = (select org_a from k)
      and ended_on is not null),
  (select org_admin_a from k),
  '3.4 ... and the ending is attributed to the actor, not NULL');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select throws_ok(
  $$select public.end_org_affiliation('00000000-0000-0000-0000-0000000000d1',
                                      '0c000000-0000-0000-0000-00000000000a')$$,
  '42501', null,
  '3.5 DENY: a hospital_admin cannot offboard at the organisation tier');
reset role;

-- ============================================================================
-- §4 void_affiliation — D7/D8, the hospital tier
-- ============================================================================
-- STATE: give the subject a fresh hospital affiliation (which re-ensures an org parent),
-- and remove the seat so §4.2's membership-ever arm is the thing under test.
delete from public.memberships where id = (select seat_id from k);

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                               '05000000-0000-0000-0000-0000000000a2', 'MAT-379');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select throws_ok(
  format($$select public.void_affiliation(%L, '  ')$$,
         (select id from public.hospital_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1'
             and hospital_id = '05000000-0000-0000-0000-0000000000a2')),
  'HC0R2', null,
  '4.1 DENY (oracle-kill): the admin of a DIFFERENT hospital gets "not found" — byte-identical to a row that does not exist');

select throws_ok(
  $$select public.void_affiliation('aaaaaaaa-0000-0000-0000-00000000dead', 'motivo')$$,
  'HC0R2', null,
  '4.2 ... and a genuinely non-existent id raises the SAME code, which is what makes 4.1 non-informative');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select throws_ok(
  format($$select public.void_affiliation(%L, '   ')$$,
         (select id from public.hospital_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1'
             and hospital_id = '05000000-0000-0000-0000-0000000000a2')),
  'HC0R7', null,
  '4.3 ⭐ D7: a blank reason is refused — a void asserts the employment never happened, and that is not assertable unexplained');
reset role;

-- D8: attach a seat at THAT hospital, so the never-employed check has something to find.
-- ⚠ A hospital-tier row must carry BOTH organization_id AND hospital_id
-- (memberships_scope_shape); only commission-tier rows leave the upper scopes null.
insert into public.memberships (id, principal_id, organization_id, hospital_id, role, granted_at, expires_at)
values ((select seat_id from k), (select subject from k), (select org_a from k), (select secundario_a from k),
        'hospital_admin', now(), now() - interval '1 day');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select throws_ok(
  format($$select public.void_affiliation(%L, 'lancamento indevido')$$,
         (select id from public.hospital_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1'
             and hospital_id = '05000000-0000-0000-0000-0000000000a2')),
  'HC0R9', null,
  '4.4 ⭐ D8: refused because a membership was EVER attached — and the seat is EXPIRED, proving this check has no expiry filter, unlike D3');
reset role;

delete from public.memberships where id = (select seat_id from k);

-- ⭐ D8 CREATION-SYMMETRY, the ALLOW half. 4.1 proved a hospital admin cannot reach
-- ANOTHER hospital's row; this proves he CAN reach his own. Without both halves, 4.1 is
-- equally consistent with hospital admins having no void authority at all.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select lives_ok(
  format($$select public.void_affiliation(%L, 'anulado pelo admin do hospital - 379')$$,
         (select id from public.hospital_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1'
             and hospital_id = '05000000-0000-0000-0000-00000000000a')),
  '4.5 ⭐ ALLOW (D8 creation-symmetric): central-a''s OWN admin may void a central-a row');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  format($$select public.void_affiliation(%L, 'lancamento indevido - 379')$$,
         (select id from public.hospital_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1'
             and hospital_id = '05000000-0000-0000-0000-0000000000a2')),
  '4.6 ALLOW: the org admin voids it, reason supplied and no seat ever attached');

select throws_ok(
  format($$select public.void_affiliation(%L, 'outro motivo')$$,
         (select id from public.hospital_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1'
             and hospital_id = '05000000-0000-0000-0000-0000000000a2')),
  'HC0R8', null,
  '4.7 ⭐ a second void is REFUSED, not repeated — re-voiding would overwrite the original actor and reason');
reset role;

select is(
  (select void_reason from public.hospital_affiliations
    where principal_id = (select subject from k) and hospital_id = (select secundario_a from k)),
  'lancamento indevido - 379',
  '4.8 ... so the FIRST reason survives');

select is(
  (select count(*)::int from public.audit_log
    where entity_type = 'hospital_affiliation' and action = 'affiliation.voided'
      and metadata->>'void_reason' = 'lancamento indevido - 379'), 1,
  '4.9 ⭐ D8: the void is audited WITH its reason');

-- ============================================================================
-- §5 void_org_affiliation — D7/D8, the organisation tier
-- ============================================================================
-- STATE, ESTABLISHED NOT INHERITED. By the end of §4 BOTH hospital rows are voided, so
-- the HC0RA arm below would have nothing to find. Re-affiliating gives one non-voided
-- row and re-ensures the org parent in the same call (D5).
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select public.affiliate_person('00000000-0000-0000-0000-0000000000d1',
                               '05000000-0000-0000-0000-00000000000a', 'MAT-379C');
reset role;

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select subject from k) and voided_at is null), 1,
  '5.0 PRECONDITION: exactly one NON-VOIDED hospital row remains, so 5.1 measures the HC0RA arm');

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false, 'hospital_admin');
set local role authenticated;
select throws_ok(
  format($$select public.void_org_affiliation(%L, 'motivo')$$,
         (select id from public.organization_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1' and voided_at is null
             and ended_on is null)),
  'HC0R2', null,
  '5.1 DENY: there is NO hospital-admin arm at the organisation tier — creation-symmetric with affiliate_person_to_org');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select throws_ok(
  format($$select public.void_org_affiliation(%L, 'motivo')$$,
         (select id from public.organization_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1' and voided_at is null
             and ended_on is null)),
  'HC0RA', null,
  '5.2 ⭐ refused: a NON-VOIDED hospital affiliation still stands inside the organisation, so "never belonged here" is not assertable');
reset role;

-- Void the remaining hospital row so only the org-tier claim is left to test.
update public.hospital_affiliations
   set voided_at = now(), void_reason = 'fixture 379'
 where principal_id = (select subject from k) and voided_at is null;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select lives_ok(
  format($$select public.void_org_affiliation(%L, 'organizacao incorreta - 379')$$,
         (select id from public.organization_affiliations
           where principal_id = '00000000-0000-0000-0000-0000000000d1' and voided_at is null
             and ended_on is null)),
  '5.3 ALLOW: with no hospital rows and no seat ever attached, the org admin voids it');
reset role;

select is(
  (select count(*)::int from public.audit_log
    where entity_type = 'organization_affiliation' and action = 'org_affiliation.voided'
      and metadata->>'void_reason' = 'organizacao incorreta - 379'), 1,
  '5.4 ... audited with its reason');

-- ============================================================================
-- §6 get_own_person_record — D14, self-only BY SHAPE
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000d1', false);
set local role authenticated;

select is(
  (select count(*)::int from public.get_own_person_record()), 1,
  '6.1 returns exactly one row — the caller''s own');

select is(
  (select r.full_name from public.get_own_person_record() r),
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  '6.2 ... and it is the CALLER''s record');

-- ⭐ The column-locked triple. `authenticated` holds no grant on these columns even for
-- self, so a direct select raises 42501 — the door is the only path, which is the whole
-- reason D14 needs one.
select isnt(
  (select r.cpf from public.get_own_person_record() r), null,
  '6.3 ⭐ the CPF is returned — a column `authenticated` cannot select even for itself');

select throws_ok(
  $$select cpf from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '42501', null,
  '6.4 ⭐ ... and the direct select is still refused, so 6.3 measures the DOOR and not a widened grant');
reset role;

-- Self-only, as a DIFFERENTIAL: a different caller gets a different record. Without this,
-- 6.2 is equally consistent with the function returning a fixed row.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select is(
  (select r.full_name from public.get_own_person_record() r),
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  '6.5 ⭐ SELF-ONLY: a different caller gets THEIR record — the function keys on auth.uid(), it does not return a fixed row');
reset role;

select * from finish();
rollback;
