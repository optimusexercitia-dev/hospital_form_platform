-- =============================================================================
-- AUTHZ · M1 — EXCLUSION DURABILITY (ADR 0078 Amendment 4 / A29; review §W-6).
--
-- A0 + qa found the program's central invariant — "no positive arm can out-vote
-- the hard-deny" — HOLDS and is BESIDE THE POINT: nothing stopped the denied
-- party from DELETING THE ROW THE DENY READS. Until M1 lands, every exclusion
-- keystone in Gate 1 is vacuous: each asserts "she cannot read X" against a row
-- the test never lets her touch.
--
-- ⛔ THE PRECONDITION DISCIPLINE (§W-6; the mistake made FOUR times on this
-- program, twice by qa). Every over-grant twin below is written NARROWLY:
--   the principal must be EXCLUDED **AND** hold `staff_admin` on the case's
--   commission. A fixture that skips the membership row calls the RPC as plain
--   `staff`, catches the AUTHORITY denial, and goes GREEN while asserting
--   NOTHING.
--
-- ⭐ THE STRUCTURAL DEFENCE (backend, M1): the authority check and the exclusion
-- check now raise DIFFERENT SQLSTATEs, and the authority check runs FIRST:
--   HC0E4 = "you are not a coordinator"   (authority)
--   HC0F1 = "you are excluded from this case" (durability)
-- A twin that forgets the membership row raises HC0E4 and FAILS this suite
-- loudly. The vacuous keystone is now UNWRITABLE, not merely discouraged.
--
-- Personas (test_helpers.bootstrap): admin, sa_x (staff_admin comm_x), st_x /
-- st_x2 (plain members comm_x), sa_y (staff_admin comm_y). claims_for(uid,
-- is_admin) sets auth.uid(); `set local role authenticated` runs under RLS.
-- =============================================================================

begin;
select plan(89);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'case_participants', 'audit_trail');
update app.feature_flags set enabled = false
  where key in ('case_types', 'case_access');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- ⭐ FLAG ASSERTIONS (ADR 0078 M4). The updates above are an ASSUMPTION until
-- asserted. This suite's keystones depend on these exact states — `audit_trail`
-- especially: app.audit_write RETURNS EARLY when it is off, so M1·3's "the
-- permitted path emits an audit row" keystone would be measuring the flag, not the
-- trigger. Assert, never assume: a reading is not a fact until it is pinned to the
-- state you are claiming about, and a flag's `description` is prose — only
-- `enabled` is the flag (six descriptions lied about exactly this; ADR 0078 M4).
select is(app.feature_enabled('case_participants'), true,
  'FLAG: case_participants is ON — the exclusion-plane RPCs are reachable');
select is(app.feature_enabled('audit_trail'), true,
  'FLAG: audit_trail is ON — else audit_write returns early and M1·3(c) measures the flag, not the trigger');
select is(app.feature_enabled('case_access'), false,
  'FLAG: case_access is OFF — this suite pins the legacy-belt branch of can_read_case*');

-- ---------------------------------------------------------------------------
-- FIXTURE · one case in comm_x; st_x is its respondent_doctor.
-- ---------------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by)
values ('00000000-0000-0000-0000-0000000f0001', (select comm_x from k), 99100, (select sa_x from k));

insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000f0101', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Réu');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000f0102', (select org_x from k), (select st_x from k), 'Dr. Réu');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000f0101', '00000000-0000-0000-0000-0000000f0102');

insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000f0103', (select org_x from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);

insert into public.case_participants (id, case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000f0104', '00000000-0000-0000-0000-0000000f0001',
        '00000000-0000-0000-0000-0000000f0101', '00000000-0000-0000-0000-0000000f0103', true);

-- ⭐⭐ THE PRECONDITION, WRITTEN NARROWLY (§W-6). st_x is the RESPONDENT **and**
-- becomes `staff_admin` of the case's commission — the PO's A2 scenario. Without
-- this row every twin below denies for the WRONG REASON (HC0E4) and asserts
-- nothing. This is C1a, proven twice, and it is why HC0F1 is a distinct code.
insert into public.memberships (principal_id, commission_id, role)
values ((select st_x from k), (select comm_x from k), 'staff_admin')
on conflict do nothing;

-- sa_y is a CLEAN org_admin of org_x: the M1·3 actor, and the over-reach control.
insert into public.memberships (organization_id, principal_id, role)
values ((select org_x from k), (select sa_y from k), 'org_admin')
on conflict do nothing;

-- ===========================================================================
-- PRE-FLIGHT — the fixture itself is load-bearing. If these fail, every twin
-- below is vacuous, so assert them explicitly rather than assuming them.
-- ===========================================================================
select is(app.is_case_respondent('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), true,
  'PRE: the fixture resolves — st_x IS the respondent (the deny has something to read)');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), true,
  'PRE: st_x is EXCLUDED from the case');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), true,
  'PRE ⭐: st_x holds staff_admin on the case commission — the precondition C1a proves is mandatory');

-- ===========================================================================
-- M1·1 — B7: respondent linkage durability.
-- ===========================================================================

-- An UNRESOLVED (`unknown`) professional: no user_id ⇒ the deny cannot resolve.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000f0201', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Desconhecido');
insert into public.professional_profiles (id, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000f0202', (select org_x from k), 'Dr. Desconhecido');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000f0201', '00000000-0000-0000-0000-0000000f0202');

select is((select link_state from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000f0202'), 'unknown',
  'M1·1: a profile created without a user_id is `unknown` (fail-closed default)');
select is((select link_state from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000f0102'), 'linked',
  'M1·1: the backfill resolved an existing user_id-bearing profile to `linked`');

-- (B7 KEYSTONE) an `unknown` profile CANNOT be attached as respondent_doctor —
-- the deny would silently not resolve for it.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.add_case_participant('00000000-0000-0000-0000-0000000f0001',
       '00000000-0000-0000-0000-0000000f0201', '00000000-0000-0000-0000-0000000f0103', false, null) $$,
  'HC0F0', null,
  'M1·1 KEYSTONE: an `unknown`-linkage profile CANNOT be attached as respondent_doctor');
reset role;

-- The resolution door: A31·5 — `update_professional_profile` has NO user_id write
-- path, so `unknown → linked` had no door at all. This is that door.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_professional_link_state(
              '00000000-0000-0000-0000-0000000f0202', 'linked', %L) $$, (select st_x2 from k)),
  'M1·1: set_professional_link_state resolves `unknown → linked` (the door A20 lacked)');
reset role;

select is((select user_id from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000f0202'), (select st_x2 from k),
  'M1·1: the linkage door actually wrote user_id');

-- Now attachable, and the deny resolves for the newly-linked professional.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.add_case_participant('00000000-0000-0000-0000-0000000f0001',
       '00000000-0000-0000-0000-0000000f0201', '00000000-0000-0000-0000-0000000f0103', false, null) $$,
  'M1·1 POSITIVE TWIN: a `linked` profile IS attachable as respondent_doctor');
reset role;

select is(app.is_case_respondent('00000000-0000-0000-0000-0000000f0001', (select st_x2 from k)), true,
  'M1·1 KEYSTONE: once linked+attached, is_case_respondent RESOLVES `t` (B7''s whole purpose)');

-- ⭐ B7's OWN trap: adding a user_id write path creates a SIXTH self-serving
-- mutator unless the linkage freezes once load-bearing. st_x2 is now a
-- respondent AND (below) a staff_admin ⇒ can_manage_professional admits him.
insert into public.memberships (principal_id, commission_id, role)
values ((select st_x2 from k), (select comm_x from k), 'staff_admin')
on conflict do nothing;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_professional_link_state('00000000-0000-0000-0000-0000000f0202', 'unknown', null) $$,
  'HC0F2', null,
  'M1·1 OVER-GRANT TWIN ⭐: a load-bearing respondent CANNOT unlink his own profile to dissolve the deny');
reset role;

select is(app.is_case_respondent('00000000-0000-0000-0000-0000000f0001', (select st_x2 from k)), true,
  'M1·1 OVER-GRANT TWIN: …and the linkage SURVIVES him (the row survives the denied party)');

-- OVER-REACH TWIN: a NON-load-bearing profile stays correctable — the freeze
-- must not break ordinary professional-registry administration.
insert into public.professional_profiles (id, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000f0203', (select org_x from k), 'Dr. Sem Caso');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.set_professional_link_state(
              '00000000-0000-0000-0000-0000000f0203', 'linked', %L) $$, (select sa_y from k)),
  'M1·1 OVER-REACH TWIN: a profile that is NOT a live respondent stays correctable');
reset role;

-- `no_account` is attachable: the deny is VACUOUSLY satisfied (no platform
-- account exists to exclude), and that is an audited human assertion, not a guess.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000f0301', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Externo');
insert into public.professional_profiles (id, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000f0302', (select org_x from k), 'Dr. Externo');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000f0301', '00000000-0000-0000-0000-0000000f0302');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_professional_link_state('00000000-0000-0000-0000-0000000f0302', 'no_account', null) $$,
  'M1·1: a professional can be affirmed `no_account` (an audited assertion, not a guess)');
select lives_ok(
  $$ select public.add_case_participant('00000000-0000-0000-0000-0000000f0001',
       '00000000-0000-0000-0000-0000000f0301', '00000000-0000-0000-0000-0000000f0103', false, null) $$,
  'M1·1: a `no_account` professional IS attachable (the deny is vacuously satisfied)');
reset role;

-- The linkage invariant is a CHECK, not merely RPC etiquette. Asserted on a
-- FRESH insert, not on f0302: f0302 is load-bearing, so the freeze (HC0F2) would
-- fire first and this assertion would prove the wrong thing.
select throws_ok(
  format($$ insert into public.professional_profiles (organization_id, full_name, link_state)
            values (%L, 'Dr. Incoerente', 'linked') $$, (select org_x from k)),
  '23514', null,
  'M1·1: the `linked ⟺ user_id NOT NULL` coherence CHECK holds against direct DML');

-- …and the INSERT derivation: user_id present ⇒ `linked`, without the caller
-- saying so. This is what keeps seed.sql / 207 / 228 / create_professional_profile
-- working unchanged against the strict CHECK.
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000f0204', (select org_x from k), (select admin from k), 'Dr. Derivado');
select is((select link_state from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000f0204'), 'linked',
  'M1·1: INSERT DERIVES link_state from user_id (the only non-derivable bit is unknown vs no_account)');

-- ===========================================================================
-- M1·2 — the five exclusion-plane RPC mutators. Each: an OVER-GRANT TWIN (the
-- denied party calls the door ON HER OWN ROW → raises; the row survives her)
-- plus a POSITIVE TWIN (a non-excluded coordinator still succeeds).
-- ===========================================================================

-- ---- remove_case_participant ---------------------------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.remove_case_participant('00000000-0000-0000-0000-0000000f0104') $$,
  'HC0F1', null,
  'M1·2 OVER-GRANT TWIN: the respondent (staff_admin!) cannot remove HIS OWN respondent row');
reset role;
select is(app.is_case_respondent('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), true,
  'M1·2: …and the respondent row SURVIVES him — is_case_respondent still `t`');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), true,
  'M1·2: …and he is STILL EXCLUDED (the deny is durable)');

-- ---- set_case_participant_role -------------------------------------------
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types)
values ('00000000-0000-0000-0000-0000000f0105', (select org_x from k), 'witness',
        'Testemunha', array['professional']);
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_participant_role('00000000-0000-0000-0000-0000000f0104',
       '00000000-0000-0000-0000-0000000f0105') $$,
  'HC0F1', null,
  'M1·2 OVER-GRANT TWIN: the respondent cannot RE-KEY his own row off respondent_doctor');
reset role;
select is(app.is_case_respondent('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), true,
  'M1·2: …and the role survives him — is_case_respondent still `t`');

-- ---- set_primary_subject (a GATE fix, not a durability fix — §W-6: the deny
--      does not read is_primary_subject, so a durability assertion cannot falsify)
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_primary_subject('00000000-0000-0000-0000-0000000f0104') $$,
  'HC0F1', null,
  'M1·2 GATE FIX: the respondent cannot exercise coordinator authority (set_primary_subject)');
reset role;

-- ---- lift_recusal --------------------------------------------------------
-- Recusal arm precondition: sa_x is ALREADY staff_admin — insert only the recusal.
insert into public.case_recusals (id, case_id, user_id, source, reason_md)
values ('00000000-0000-0000-0000-0000000f0401', '00000000-0000-0000-0000-0000000f0001',
        (select sa_x from k), 'coordinator', 'conflito');

select is(app.is_recused_from_case('00000000-0000-0000-0000-0000000f0001', (select sa_x from k)), true,
  'M1·2 PRE: sa_x (a real coordinator) is recused — the deny has something to read');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.lift_recusal('00000000-0000-0000-0000-0000000f0401', 'mudei de ideia') $$,
  'HC0F1', null,
  'M1·2 OVER-GRANT TWIN ⭐: a recused coordinator cannot lift HER OWN recusal (A27''s headline)');
reset role;
select is(app.is_recused_from_case('00000000-0000-0000-0000-0000000f0001', (select sa_x from k)), true,
  'M1·2: …and the recusal SURVIVES her — is_recused_from_case still `t`');
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000f0001', (select sa_x from k)), false,
  'M1·2 RULE 12 (D9): …and the PHI door stays SHUT — both arms are Rule 12 doors');

-- POSITIVE TWIN: a NON-excluded coordinator still lifts the recusal. Without
-- this the fix may have silently deleted legitimate coordinator reach.
--
-- ⚠ The principal here is sa_y, a CLEAN org_admin of org_x — NOT `admin`. I first
-- wrote `admin` and this twin failed with HC0E4, which is the very error this
-- suite exists to make loud: lift_recusal's arms are is_staff_admin_of OR
-- is_commission_admin_of, and (catalog-verified) is_commission_admin_of_for admits
-- org_admin / hospital_admin but NOT platform_admin. Had HC0F1 shared HC0E4's code,
-- this twin would have "passed" as a throws_ok and proved nothing.
-- It also exercises the org arm M1 deliberately KEEPS (C6: keeping the arm and
-- adding the deny are orthogonal; A21's removal needs the resolver first).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.lift_recusal('00000000-0000-0000-0000-0000000f0401', 'analisado') $$,
  'M1·2 POSITIVE TWIN ⭐: a NON-excluded coordinator still lifts the recusal (no reach deleted)');
reset role;
select is(app.is_recused_from_case('00000000-0000-0000-0000-0000000f0001', (select sa_x from k)), false,
  'M1·2 POSITIVE TWIN: …and the lift actually took effect');

-- ---- record_recusal ------------------------------------------------------
-- ⭐ The SELF arm must SURVIVE. Recusal is monotonically restrictive: it can only
-- ADD a deny, never remove one. Denying an excluded party the ability to restrict
-- herself further is not a security gain — it is a regression. So the exclusion
-- term binds the COORDINATOR arm only. (A blanket term here would break this.)
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.record_recusal('00000000-0000-0000-0000-0000000f0001', %L, 'me declaro impedido', null) $$,
         (select st_x from k)),
  'M1·2 POSITIVE TWIN ⭐: an EXCLUDED party may still recuse HERSELF (monotone; the self arm survives)');
reset role;

-- ⛔⛔ B1 (qa, and qa is right — the FIFTH vacuous keystone on this program).
-- THE LINE ABOVE JUST MADE st_x SELF-RECUSED. Leave it, and every later
-- is_case_excluded / can_read_case_patient measures the RECUSAL arm — while M1·3
-- guards the RESPONDENT arm. Tests 33+34 (one of them Rule 12) then CANNOT FAIL:
-- with M1·3's freeze reverted the re-key lands, is_case_excluded goes false via
-- the respondent arm, and the recusal holds the assertions green anyway. The
-- fixture proved a DIFFERENT DENY than the one under test.
--
-- §W-6 (b) named this in six words — "AND the respondent never acts" — and I let
-- him act. Undo it, so st_x is excluded by the RESPONDENT ARM ALONE and M1·3's
-- keystones can actually falsify.
delete from public.case_recusals
 where case_id = '00000000-0000-0000-0000-0000000f0001' and user_id = (select st_x from k);
select is(app.is_recused_from_case('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), false,
  'B1 GUARD: st_x is NOT recused — everything below measures the RESPONDENT arm, the one under test');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), true,
  'B1 GUARD: …and he is STILL excluded, via the respondent arm ALONE (so M1·3 can falsify)');

-- …but she may NOT recuse ANOTHER (that is coordinator authority, and she has none here).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.record_recusal('00000000-0000-0000-0000-0000000f0001', %L, 'te declaro impedido', null) $$,
         (select st_x2 from k)),
  'HC0F1', null,
  'M1·2 OVER-GRANT TWIN: an excluded coordinator may NOT recuse ANOTHER member (coordinator arm denied)');
reset role;

-- ===========================================================================
-- M1·3 — case_participant_roles: the 6th exclusion-plane table (D1).
-- Today: authenticated=arwd · a FOR ALL policy on is_admin() OR is_org_admin_of
-- · ZERO triggers ⇒ an org_admin re-keys `respondent_doctor` ORG-WIDE over
-- direct DML with NO audit row. Rule 11 has a hole on the exclusion plane.
--
-- ⛔ The two halves are asserted SEPARATELY (§W-0.2). Dissolution is ORG-WIDE;
-- the PHI consequence is PER-RESPONDENT. Conflating them is what made qa's v2
-- keystone vacuous (f→f).
-- ===========================================================================

-- (a) ORG-WIDE DISSOLUTION — the org_admin, under real RLS, re-keys the role.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ update public.case_participant_roles set key = 'former_respondent'
     where id = '00000000-0000-0000-0000-0000000f0103' $$,
  'HC0F3', null,
  'M1·3 (a) KEYSTONE ⭐: an org_admin CANNOT re-key case_participant_roles.key (today: UPDATE 1)');
reset role;
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), true,
  'M1·3 (a): …and the exclusion SURVIVES the org_admin — is_case_excluded still `t` (today: `f`)');

-- (b) PER-RESPONDENT PHI — the FULL composed precondition: st_x is respondent
-- AND staff_admin (so he HAS a positive arm behind the deny), the actor is the
-- ORG_ADMIN, and THE RESPONDENT NEVER ACTS. Asserting PHI on (a) alone is f→f
-- and would "pass" while asserting nothing — qa's v2 error, not repeated here.
select is(app.can_read_case_patient('00000000-0000-0000-0000-0000000f0001', (select st_x from k)), false,
  'M1·3 (b) KEYSTONE ⭐ RULE 12: the respondent-coordinator''s PHI door stays SHUT (today: `t`)');

-- (c) AUDIT SILENCE — the permitted path must emit a row. Today the table has
-- ZERO triggers AND NO RPC DOOR (catalog-verified: only set_participant_patient
-- touches it, and it INSERTs), so the "permitted path" IS direct DML under the
-- FOR ALL policy — which means the audit can ONLY come from a trigger.
create temp table audit_before on commit drop as
  select count(*)::int as n from public.audit_log;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  $$ update public.case_participant_roles set display_name = 'Testemunha ocular'
     where id = '00000000-0000-0000-0000-0000000f0105' $$,
  'M1·3 (d) OVER-REACH TWIN: an org_admin can STILL rename display_name (A18 staffing survives)');
reset role;
select cmp_ok((select count(*)::int from public.audit_log), '>', (select n from audit_before),
  'M1·3 (c) KEYSTONE ⭐ RULE 11: the permitted path EMITS an audit row (today: 161→161, silent)');

-- (d) OVER-REACH TWIN — the A18 staffing/config surface must survive. An
-- org_admin still CREATES roles. Keystone 23 fails if the negatives over-reach.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  $$ insert into public.case_participant_roles
       (organization_id, key, display_name, allowed_participant_types)
     select organization_id, 'expert', 'Perito', array['professional']
     from public.case_participant_roles where id = '00000000-0000-0000-0000-0000000f0103' $$,
  'M1·3 (d) OVER-REACH TWIN: an org_admin can STILL create a role (A18 config surface survives)');
reset role;

-- (d) set_participant_patient's INSERT path must still work — §W-5: the fix is an
-- UPDATE-freeze, NOT a write-freeze. A blanket write-freeze breaks patient
-- registration, which qa verified in BOTH directions.
select lives_ok(
  $$ insert into public.case_participant_roles
       (organization_id, key, display_name, allowed_participant_types)
     select organization_id, 'affected_patient', 'Paciente afetado', array['patient']
     from public.case_participant_roles where id = '00000000-0000-0000-0000-0000000f0103' $$,
  'M1·3 (d): the INSERT path survives — an UPDATE-freeze, not a write-freeze (§W-5)');

-- …and a non-`key` UPDATE is still permitted (the freeze is column-scoped).
select lives_ok(
  $$ update public.case_participant_roles set is_active = false
     where id = '00000000-0000-0000-0000-0000000f0105' $$,
  'M1·3 (d): a non-`key` UPDATE still works — the freeze is scoped to the column the deny reads');

-- ===========================================================================
-- M1·4b — the GATE HELPERS carry the deny (D5). Fix 11 → 48 callers free.
--
-- ⚠ "Fix the 11 helpers and we're done" would SHIP WITH THE P0s INTACT: the
-- self-serving mutators check is_staff_admin_of DIRECTLY and carry none of the
-- helpers' strings. M1 = helpers ∪ direct-check doors. Both above are asserted.
--
-- Keystone per helper, asserted AT A CALLER — never on the predicate's return
-- value (ADR 0072 delta 3 / ETH·E1's lesson). st_x is the excluded principal AND
-- a staff_admin, so every denial below is the EXCLUSION, not the authority.
-- ===========================================================================
update app.feature_flags set enabled = true where key in ('attachments');

-- ---- can_write_case_narrative ⭐ (D6) -------------------------------------
insert into public.case_narrative_types (id, commission_id, label, position)
values ('00000000-0000-0000-0000-0000000f0501', (select comm_x from k), 'Relato', 1);
insert into public.case_narratives
  (id, case_id, narrative_type_id, type_label, display_position, title)
values ('00000000-0000-0000-0000-0000000f0502', '00000000-0000-0000-0000-0000000f0001',
        '00000000-0000-0000-0000-0000000f0501', 'Relato', 1, 'Relato inicial');

select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000f0502', (select st_x from k)), false,
  'M1·4b ⭐ D6: a respondent-coordinator CANNOT write a narrative body of her own case (PHI-bearing prose)');
-- ⚠ The twin is sa_x (a clean staff_admin of comm_x after her recusal was lifted
-- above), NOT sa_y: can_write_case_narrative has a STAFF arm and NO ORG arm
-- (D5's helper table, catalog-confirmed), so an org_admin is false here for
-- reasons that have nothing to do with M1 — and the twin would prove nothing.
select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000f0502', (select sa_x from k)), true,
  'M1·4b POSITIVE TWIN: a clean coordinator still writes the narrative (no reach deleted)');

-- ⭐ D6's SELF-CONSISTENCY assertion (§W-6): arm 1 (is_staff_admin_of, no deny)
-- and arm 3 (via can_write_case_content, HAS the deny) must now AGREE. Before
-- M1 the same principal was allowed or denied depending only on whether the
-- narrative happened to be assigned — which is the tell that arm 1 was wrong.
update public.case_narratives set assigned_to = (select sa_x from k)
  where id = '00000000-0000-0000-0000-0000000f0502';
select is(app.can_write_case_narrative('00000000-0000-0000-0000-0000000f0502', (select st_x from k)),
          app.can_write_case_content('00000000-0000-0000-0000-0000000f0001', (select st_x from k)),
  'M1·4b ⭐ D6 SELF-CONSISTENCY: arm-1 and arm-3 now AGREE for the excluded principal');
update public.case_narratives set assigned_to = null
  where id = '00000000-0000-0000-0000-0000000f0502';

-- ---- can_write_attachment (D7) — callers incl. dispose_attachment_phi ------
insert into public.attachments
  (id, owner_type, owner_id, title, storage_bucket, storage_path, sensitivity_tier, confidentiality_label)
values ('00000000-0000-0000-0000-0000000f0601', 'case', '00000000-0000-0000-0000-0000000f0001',
        'Laudo', 'attachments-phi',
        'case/00000000-0000-0000-0000-0000000f0001/laudo.pdf', 'phi', 'phi_standard');

select is(app.can_write_attachment('case', '00000000-0000-0000-0000-0000000f0001', (select st_x from k)), false,
  'M1·4b D7: a respondent-coordinator CANNOT write attachments of her own case (incl. PHI disposal)');
select is(app.can_write_attachment('case', '00000000-0000-0000-0000-0000000f0001', (select sa_y from k)), true,
  'M1·4b POSITIVE TWIN: a clean coordinator still writes attachments');

-- ---- reclassify_attachment — the DIRECT-CHECK RESIDUE (§W-2.5) ------------
-- The declassify arm checks the role DIRECTLY, so the helper fix does NOT reach
-- it. This is the assertion that proves the direct-check set was swept too.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.reclassify_attachment('00000000-0000-0000-0000-0000000f0601', 'standard', null) $$,
  'HC0F1', null,
  'M1·4 ⭐ §W-2.5: a recused/respondent coordinator CANNOT declassify a PHI attachment (direct-check arm)');
reset role;
select is((select storage_bucket from public.attachments where id = '00000000-0000-0000-0000-0000000f0601'),
          'attachments-phi',
  'M1·4 §W-2.5: …and the attachment STAYS in attachments-phi with its label intact');
select is((select sensitivity_tier from public.attachments where id = '00000000-0000-0000-0000-0000000f0601'),
          'phi',
  'M1·4 §W-2.5: …and its Rule 12 tier survives her');

-- POSITIVE TWIN: a NON-excluded coordinator still declassifies.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.reclassify_attachment('00000000-0000-0000-0000-0000000f0601', 'standard', null) $$,
  'M1·4 POSITIVE TWIN ⭐: a non-excluded coordinator STILL declassifies (no reach deleted)');
reset role;

-- ---- can_read_action_item (A22 + A24·5) ----------------------------------
-- `assignees_only` — the scope that had NO deny. The excluded principal is even
-- the ASSIGNEE, so the positive arm is live and the deny is what must beat it.
--
-- ⛔⛔ B1's SHAPE, SECOND INSTANCE — caught by the mutation audit, not by review.
-- My first fixture used source_type='case', and `app.guard_action_item` HARD-FORCES
-- `visibility_scope := 'case_restricted'` for those ("a case item is ALWAYS
-- case_restricted, on INSERT and UPDATE"). So the row silently became
-- case_restricted, whose arm delegates to can_read_case — a helper that ALREADY
-- carried the deny BEFORE M1. The test proved a PRE-EXISTING deny, not my fix:
-- neutering can_read_action_item's deny left BOTH this and the closure test green.
--
-- The reachable `assignees_only` + case-anchor shape is source_type='manual' with
-- `case_id` set: action_items_case_link_check leaves case_id unconstrained there,
-- and the trigger only force-rewrites source_type='case'. That is the arm
-- `coalesce(source_case_id, case_id)` actually targets — and the only shape in
-- which ONLY my new deny can deny.
insert into public.action_items
  (id, commission_id, source_type, case_id, title, visibility_scope, assigned_to, status_id, created_by)
select '00000000-0000-0000-0000-0000000f0701', (select comm_x from k), 'manual',
       '00000000-0000-0000-0000-0000000f0001', 'Apurar', 'assignees_only', (select st_x from k),
       (select id from public.action_item_statuses where key = 'open' and commission_id is null),
       (select sa_x from k);

-- GUARD (B1's lesson, generalized): assert the row is the shape under test. The
-- trigger rewrites scope silently, so a fixture that does not check what it built
-- is a keystone waiting to go vacuous.
select is((select visibility_scope from public.action_items
           where id = '00000000-0000-0000-0000-0000000f0701'), 'assignees_only',
  'B1-SHAPE GUARD ⭐: the item really IS assignees_only (guard_action_item force-rewrites source_type=case)');
select is((select app.can_read_case('00000000-0000-0000-0000-0000000f0001', (select st_x from k))), false,
  'B1-SHAPE GUARD: …and can_read_case is false anyway — so only can_read_action_item''s OWN deny is under test');

select is(app.can_read_action_item('00000000-0000-0000-0000-0000000f0701', (select st_x from k)), false,
  'M1·4b A22 ⭐: the deny BEATS the assignees_only arm — an excluded assignee reads nothing of her own case');
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000f0701', (select sa_y from k)), true,
  'M1·4b POSITIVE TWIN: a clean coordinator still reads the action item');

-- ⭐ FIXED FOR FREE, asserted rather than assumed (the closure argument, §W-2.3):
-- can_read_attachment's `action_item` arm delegates to can_read_action_item and
-- was never patched directly. If the closure argument is right, it is already
-- denied. This is the assertion that tests the ARGUMENT, not just the code.
insert into public.attachments
  (id, owner_type, owner_id, title, storage_bucket, storage_path, sensitivity_tier, confidentiality_label)
values ('00000000-0000-0000-0000-0000000f0602', 'action_item', '00000000-0000-0000-0000-0000000f0701',
        'Anexo da tarefa', 'attachments',
        'action_item/00000000-0000-0000-0000-0000000f0701/a.pdf', 'standard', 'non_phi_internal');
select is(app.can_read_attachment('action_item', '00000000-0000-0000-0000-0000000f0701', (select st_x from k)), false,
  'M1·4b ⭐ CLOSURE: can_read_attachment''s action_item arm is denied FOR FREE (never patched directly)');

-- ⛔ AND THE OVER-REACH TWIN FOR THE CLOSURE: a COMMITTEE action item with NO
-- case anchor must STILL be readable. D5's scoping rule says the deny binds only
-- where a case_id resolves; if this fails, M1 broke ordinary committee work.
insert into public.action_items
  (id, commission_id, source_type, title, visibility_scope, status_id, created_by)
select '00000000-0000-0000-0000-0000000f0702', (select comm_x from k), 'manual', 'Pauta do comitê', 'committee',
       (select id from public.action_item_statuses where key = 'open' and commission_id is null),
       (select sa_x from k);
select is(app.can_read_action_item('00000000-0000-0000-0000-0000000f0702', (select st_x from k)), true,
  'M1·4b OVER-REACH TWIN ⭐: a COMMITTEE item with no case anchor stays readable (a committee item is not a case)');

-- ---- set_participant_patient (§3.6·A2) — the THIRD direct-check door -------
-- DEFINER · is_staff_admin_of only · no read gate · `on conflict do update` ⇒ a
-- DESTRUCTIVE PHI OVERWRITE. It has no org arm (so A21 never touched it) and no
-- gate helper (so M1·4b never reached it). Rule 12: the respondent must not
-- overwrite the patient identity of the case in which he is the accused.
update app.feature_flags set enabled = true where key in ('case_patient');
update public.cases set patient_enabled = true where id = '00000000-0000-0000-0000-0000000f0001';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_participant_patient('00000000-0000-0000-0000-0000000f0001',
       null, 'Paciente Falsificado', 'MRN-999') $$,
  'HC0F1', null,
  'M1·4 §3.6·A2 ⭐ RULE 12: the respondent CANNOT overwrite his own case''s patient identity');
reset role;

-- The case-PHI module has no `case_patient` TABLE — set_participant_patient builds
-- a participants → patient_participants → case_participants chain. Assert on the
-- chain the writer actually creates, on rows read after the denied call.
select is((select count(*)::int from public.patient_participants), 0,
  'M1·4 §3.6·A2: …and NO patient row was written by the excluded principal');

-- POSITIVE TWIN: a clean coordinator (staff_admin — this door has NO org arm)
-- still registers the patient. Without this, the deny may have broken PHI intake.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_participant_patient('00000000-0000-0000-0000-0000000f0001',
       null, 'Paciente Real', 'MRN-001') $$,
  'M1·4 §3.6·A2 POSITIVE TWIN ⭐: a clean coordinator STILL registers the patient (intake intact)');
reset role;

-- ⭐ AND §W-5's premise, proven at the caller rather than argued: that call just
-- INSERTed an `affected_patient` role row into case_participant_roles. The M1·3
-- freeze is an UPDATE-freeze precisely so this keeps working. A blanket
-- write-freeze would break patient registration — qa verified it BOTH directions.
select cmp_ok((select count(*)::int from public.case_participant_roles
               where key = 'affected_patient' and organization_id = (select org_x from k)),
              '>', 0,
  'M1·3 ⭐ §W-5: set_participant_patient''s INSERT into case_participant_roles STILL WORKS');

-- ---- can_write_interview (8 callers) --------------------------------------
-- ⛔ THE MUTATION AUDIT'S THIRD FINDING, and the one review would never catch:
-- I FIXED THIS HELPER AND NEVER KEYSTONED IT. Reverting its deny turned nothing
-- red, because nothing asserted it. An unasserted fix is indistinguishable from
-- no fix — 8 callers were resting on it. "0 failures" said nothing here.
insert into public.case_interviews
  (id, commission_id, case_id, interview_number, interview_category, confidentiality_level)
values ('00000000-0000-0000-0000-0000000f0801', (select comm_x from k),
        '00000000-0000-0000-0000-0000000f0001', 1, 'witness', 'non_phi_internal');

select is(app.can_write_interview('00000000-0000-0000-0000-0000000f0801', (select st_x from k)), false,
  'M1·4b ⭐: a respondent-coordinator CANNOT write an interview of her own case (8 callers ride this)');
-- ⛔ TWIN PRINCIPAL CHANGED sa_y -> sa_x BY A4 (20260730), mirroring the narrative twin
-- above (line ~463): sa_y is a CLEAN ORG_ADMIN, and pre-A4 he wrote interviews via
-- can_write_interview's ORG arm. A4 REMOVED that arm (an Organization User ceases to be a
-- Case Content source; interview write is case material — A21·1). So the "no reach
-- deleted by M1" twin must now use a clean STAFF_ADMIN — sa_x, whose recusal was lifted
-- above — exactly as the narrative twin already does. (sa_y's interview write is GONE by
-- design; that is 235 K2's territory, not an M1 regression.)
select is(app.can_write_interview('00000000-0000-0000-0000-0000000f0801', (select sa_x from k)), true,
  'M1·4b POSITIVE TWIN: a clean staff_admin still writes the interview (M1 deleted no reach; A4 removed the ORG arm, not the staff arm)');

-- …and the delegation: can_write_attachment's `interview` arm routes here, so it
-- is denied FOR FREE. Asserted, not assumed — the same closure claim as test 53.
select is(app.can_write_attachment('interview', '00000000-0000-0000-0000-0000000f0801', (select st_x from k)), false,
  'M1·4b ⭐ CLOSURE: can_write_attachment''s interview arm is denied FOR FREE via can_write_interview');

-- ===========================================================================
-- THE DEVIATION SWEEP (qa M-1). ⚠ THE LENS, RECORDED BECAUSE IT KEEPS PAYING:
-- un-keystoned DEVIATIONS are the most fragile artifacts on this program,
-- BECAUSE NOBODY WAS OWED A TEST FOR THEM. A spec'd fix gets a keystone by
-- construction; a fix I was right to INVENT does not. That shape has now bitten
-- three times (can_write_interview · DOOR2 · the two below). Everything I added
-- beyond §W-6 is asserted here.
-- ===========================================================================

-- ---- DEVIATION 1 (qa M-1) · DOOR2: the B7 check on set_case_participant_role
-- §W-6 named ONLY add_case_participant. Re-keying an EXISTING participant TO
-- respondent_doctor is equally an attach, and would have bypassed a check that
-- lived in one door only. The code was right both rounds; the FIX WAS UNGUARDED —
-- neuter it and the suite ran 73 tests, 0 red, while an `unknown` professional
-- was seated as respondent_doctor. A decorative exclusion: precisely what B7 exists
-- to prevent.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000f0901', (select org_x from k), 'professional',
        'professional_identity', 'Dr. Rekey');
insert into public.professional_profiles (id, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000f0902', (select org_x from k), 'Dr. Rekey');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000f0901', '00000000-0000-0000-0000-0000000f0902');
-- Seat him under a NON-respondent role first (no B7 check applies there)…
insert into public.case_participants (id, case_id, participant_id, role_id)
values ('00000000-0000-0000-0000-0000000f0903', '00000000-0000-0000-0000-0000000f0001',
        '00000000-0000-0000-0000-0000000f0901', '00000000-0000-0000-0000-0000000f0105');

select is((select link_state from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000f0902'), 'unknown',
  'M-1 PRE: the seated professional''s linkage is UNRESOLVED (so the deny cannot resolve for him)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_participant_role('00000000-0000-0000-0000-0000000f0903',
       '00000000-0000-0000-0000-0000000f0103') $$,
  'HC0F0', null,
  'M-1 ⭐ DOOR2: RE-KEYING an `unknown` professional TO respondent_doctor is REFUSED (the deviation §W-6 did not name)');
reset role;
select is((select r.key from public.case_participants cp
           join public.case_participant_roles r on r.id = cp.role_id
           where cp.id = '00000000-0000-0000-0000-0000000f0903'), 'witness',
  'M-1 DOOR2: …and the role SURVIVES the attempt — he was not seated as the respondent');

-- POSITIVE TWIN: once RESOLVED, the same re-key succeeds. A door that refuses the
-- legitimate path is a regression, not a fix.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_professional_link_state('00000000-0000-0000-0000-0000000f0902', 'no_account', null);
select lives_ok(
  $$ select public.set_case_participant_role('00000000-0000-0000-0000-0000000f0903',
       '00000000-0000-0000-0000-0000000f0103') $$,
  'M-1 DOOR2 POSITIVE TWIN ⭐: once the linkage is RESOLVED, the same re-key SUCCEEDS');
reset role;

-- ---- DEVIATION 2 · can_write_attachment's `action_item` arm ----------------
-- MY invention: D5's scoping rule says the deny binds wherever a case_id resolves,
-- so I added app.case_of_action_item + the deny to this arm. §W-6 never named it,
-- and only the `case` and `interview` arms were asserted. Unguarded until now.
select is(app.can_write_attachment('action_item', '00000000-0000-0000-0000-0000000f0701', (select st_x from k)), false,
  'DEVIATION 2 ⭐: can_write_attachment''s action_item arm DENIES the excluded party (case_of_action_item)');
select is(app.can_write_attachment('action_item', '00000000-0000-0000-0000-0000000f0701', (select sa_y from k)), true,
  'DEVIATION 2 POSITIVE TWIN: a clean coordinator still writes the action item''s attachment');
-- OVER-REACH TWIN: a COMMITTEE item with no case anchor must stay writable —
-- case_of_action_item returns null there and is_case_excluded(null, …) is false.
select is(app.can_write_attachment('action_item', '00000000-0000-0000-0000-0000000f0702', (select st_x from k)), true,
  'DEVIATION 2 OVER-REACH TWIN ⭐: a COMMITTEE item with no case anchor stays writable');

-- ---- DEVIATION 3 · professional_profiles.user_id ON DELETE RESTRICT --------
-- MY PO ruling (A0 open ruling 5), and I never asserted it. SET NULL is a silent
-- deny-dissolver: null the user_id and is_case_respondent stops resolving. It is
-- unreachable TODAY only because profiles_id_fkey RESTRICTs first — an accident of
-- another table's FK, and the conventional Supabase pattern is CASCADE. Assert the
-- invariant here so a future change to profiles_id_fkey cannot silently arm it.
select is((select c.confdeltype::text from pg_constraint c
           where c.conname = 'professional_profiles_user_id_fkey'), 'r',
  'DEVIATION 3 ⭐: professional_profiles.user_id is ON DELETE RESTRICT — SET NULL would silently dissolve the deny');

-- ---- DEVIATION 4 (qa) · set_case_confidentiality — THE FIFTH DIRECT-CHECK DOOR
-- qa refused to record this as safe on the strength of its HC0E5, and was right.
-- Proven open: the excluded party rewrote his own case's classification
-- (non_phi_internal → legal_privileged). HC0E5 is the LEVEL-VALIDATION check and
-- sits AFTER the authority gate — it never masked the door; there was no deny.
-- A VALID level is mandatory here, or the keystone tests the precondition again.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_confidentiality('00000000-0000-0000-0000-0000000f0001', 'legal_privileged') $$,
  'HC0F1', null,
  'M1·4 ⭐ THE FIFTH DOOR: the respondent CANNOT reclassify his own case (VALID level — the gate, not HC0E5)');
reset role;
select is((select confidentiality_level from public.cases
           where id = '00000000-0000-0000-0000-0000000f0001'), 'non_phi_internal',
  'M1·4 FIFTH DOOR ⭐: …and the classification SURVIVES him (today: he wrote legal_privileged)');

-- POSITIVE TWIN: a clean coordinator still reclassifies.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_case_confidentiality('00000000-0000-0000-0000-0000000f0001', 'ethics_investigation') $$,
  'M1·4 FIFTH DOOR POSITIVE TWIN ⭐: a clean coordinator STILL reclassifies the case');
reset role;
select is((select confidentiality_level from public.cases
           where id = '00000000-0000-0000-0000-0000000f0001'), 'ethics_investigation',
  'M1·4 FIFTH DOOR POSITIVE TWIN: …and it took effect');
-- …and HC0E5 still guards an INVALID level (the precondition survives the gate).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_case_confidentiality('00000000-0000-0000-0000-0000000f0001', 'bogus') $$,
  'HC0E5', null,
  'M1·4 FIFTH DOOR: HC0E5 still rejects an invalid level — the precondition survives, distinct from the gate');
reset role;
update public.cases set confidentiality_level = 'non_phi_internal'
  where id = '00000000-0000-0000-0000-0000000f0001';

-- ---- dispose_case_phi (qa B2) — the FOURTH direct-check door ---------------
-- The accused cannot READ the patient identifiers and yet IRREVERSIBLY DESTROYS
-- them. I triaged this to the carry list; that was wrong.
--
-- ⚠ A VALID reason ('retention_expired') is MANDATORY here. This function's 23514
-- is the REASON-CODE check, which sits AFTER the authority gate — an invalid
-- reason catches 23514 and looks "denied" while never reaching the gate. That is
-- exactly how qa's first probe nearly filed this as safe. The assertion below is
-- behavioural: the PHI must SURVIVE the denied party.
select is((select count(*)::int from public.patient_identifiers), 1,
  'B2 PRE: the patient identifiers exist — the disposal has something to destroy');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.dispose_case_phi('00000000-0000-0000-0000-0000000f0001', 'retention_expired') $$,
  'HC0F1', null,
  'M1·4 ⭐ qa B2 · RULE 12: the accused CANNOT dispose the PHI of his own case (VALID reason — the gate, not the reason-code)');
reset role;

select is((select count(*)::int from public.patient_identifiers), 1,
  'M1·4 qa B2 ⭐: …and the patient identifiers SURVIVE him — destruction is irreversible, so this is the assertion that matters');
select is((select phi_disposed_at is null from public.cases
           where id = '00000000-0000-0000-0000-0000000f0001'), true,
  'M1·4 qa B2: …and the case is NOT marked disposed');

-- POSITIVE TWIN: a legitimate coordinator must STILL dispose. A deny that breaks
-- lawful LGPD/retention disposal is a regression, not a fix.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.dispose_case_phi('00000000-0000-0000-0000-0000000f0001', 'retention_expired') $$,
  'M1·4 qa B2 POSITIVE TWIN ⭐: a clean coordinator STILL disposes the PHI (lawful disposal intact)');
reset role;
select is((select count(*)::int from public.patient_identifiers), 0,
  'M1·4 qa B2 POSITIVE TWIN: …and the disposal actually took effect');

-- ===========================================================================
-- STRUCTURAL — the properties that make the above non-vacuous, asserted as
-- catalog facts so a future refactor cannot silently un-do them.
-- ===========================================================================
select is((select count(*)::int from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           where c.relname = 'case_participant_roles' and not t.tgisinternal), 2,
  'M1·3 STRUCTURAL: case_participant_roles now carries its guard + audit triggers (today: 0)');

select isnt((select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'lift_recusal'), null,
  'M1·2 STRUCTURAL: lift_recusal still exists');

-- Every one of the five mutators now carries the deny. Catalog-driven, so a new
-- mutator added later without the term is caught by the COUNT, not by review.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('lift_recusal', 'remove_case_participant',
                               'set_case_participant_role', 'set_primary_subject', 'record_recusal')
             and p.prosrc ilike '%is_case_excluded%'), 5,
  'M1·2 STRUCTURAL ⭐: ALL FIVE exclusion-plane mutators carry the deny term (today: 0)');

-- ⛔ THE LOAD-BEARING NEGATIVE (A32, re-verified twice): these are prosecdef=f,
-- so RLS ALREADY protects them. Sweeping them is over-reach and keystone 23
-- fails if the negatives over-reach. Asserted so M1 cannot quietly grow.
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('close_case', 'cancel_case', 'set_case_outcome',
                               'update_case_narrative_body')
             and p.prosecdef), 0,
  'M1 SCOPE FENCE ⭐: the 4 INVOKER RPCs stay INVOKER — M1 did not over-reach (A32)');

select * from finish();
rollback;
