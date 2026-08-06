-- AFF W1 / T1.5 — the substrate keystones: `hospital_affiliations`, `profiles.cpf`,
-- the column-list grant conversion, and the two dropped `profiles` columns.
--
-- ADR 0097 (D1–D7, D15) + the external audit of 2026-08-05 (HIGH-1, MEDIUM-1/2/4).
-- Migrations held: 20260909000100 / 000200 / 000300 / 000400.
--
-- Runs against the PERSISTED SEED (not test_helpers.bootstrap), for the deterministic
-- hospital-tier personas ADR 0097 reasons about: `hospitaladmin.a1` (…e1) administers
-- Hospital Central A ONLY, `dt.a` (…f1) is its technical_director, `orgadmin.a` (…b1)
-- administers the whole org, `orgadmin.b` (…b2) is the cross-org control.
--
-- ⚠ HOW THIS FILE AVOIDS THE RECORDED VACUITY SHAPES:
--
--  * **Permissive sibling (§7.1 shape 6).** A positive row-assertion proves nothing
--    about the predicate under test unless that predicate is the ONLY grant of the
--    row. §0.5 asserts `hospital_affiliations` carries exactly ONE policy, so every
--    §4 assertion is attributable — and each §4 positive is reached by exactly ONE of
--    the four legs, which is why the three fixture subjects are different people with
--    different relationships rather than one person read four ways.
--  * **Error codes are not the discriminator (§7.2).** "`authenticated` holds no DML
--    grant" cannot be proven with `throws_ok(..., '42501')`: a missing GRANT and a
--    missing POLICY raise the SAME SQLSTATE. §0.4 therefore asserts the ACL from the
--    catalog, and the behavioural arm sits beside it as corroboration, not as proof.
--  * **A narrowing passes its negative keystone by construction (§7.7).** Every deny
--    arm here has a positive twin on the same table and the same reader.
--
-- Assertion count: 40

begin;
select plan(40);

-- Personas + scopes (deterministic seed ids — never gen_random_uuid()).
create temp table k on commit drop as select
  '00000000-0000-0000-0000-0000000000e1'::uuid as ha1,        -- hospital_admin, central-a ONLY
  '00000000-0000-0000-0000-0000000000b1'::uuid as orgadmin_a,
  '00000000-0000-0000-0000-0000000000b2'::uuid as orgadmin_b, -- cross-org control
  '00000000-0000-0000-0000-000000000003'::uuid as staff_ccih, -- plain member, no admin power
  '00000000-0000-0000-0000-0000000000d1'::uuid as unaffiliated_subject, -- novato.pendente: ZERO memberships
  '00000000-0000-0000-0000-0000000000d4'::uuid as sibling_subject,      -- desativado.conta: ZERO memberships
  '00000000-0000-0000-0000-0000000000d3'::uuid as dml_subject,          -- suspenso.temp: the constraint fixture
  '00000000-0000-0000-0000-0000000000f1'::uuid as td_a,       -- technical_director OF central-a
  '0c000000-0000-0000-0000-00000000000a'::uuid as org_a,
  '0c000000-0000-0000-0000-00000000000b'::uuid as org_b,
  '05000000-0000-0000-0000-00000000000a'::uuid as central_a,
  '05000000-0000-0000-0000-0000000000a2'::uuid as secundario_a,
  '05000000-0000-0000-0000-00000000000b'::uuid as central_b;
grant select on k to authenticated;

-- ============================================================================
-- §0 SHAPE, GRANTS AND THE STRUCTURAL CONTROLS THE LATER SECTIONS DEPEND ON.
-- ============================================================================
select has_table('public', 'hospital_affiliations', '0.1 hospital_affiliations exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.hospital_affiliations'::regclass),
  '0.2 RLS is ENABLED on hospital_affiliations (Rule 1)');

select ok(
  has_table_privilege('authenticated', 'public.hospital_affiliations', 'SELECT'),
  '0.3 authenticated holds SELECT on hospital_affiliations');

-- The ACL, not the SQLSTATE, is the authority here (see the header).
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'hospital_affiliations'
      and grantee = 'authenticated'
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')), 0,
  '0.4 authenticated holds NO DML grant on hospital_affiliations (writes go through the W2 doors — ADR 0097 D13)');

-- The permissive-sibling control for §4: one policy means one path.
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'hospital_affiliations'), 1,
  '0.5 hospital_affiliations carries exactly ONE policy — so every §4 row assertion is attributable to it');

-- PGRST201 control: the composite FK REPLACES a single-column hospital FK (ADR 0094's
-- recorded lesson). Two FKs to the same target is the ambiguous-embed shape, and
-- `src/lib/queries/{affiliations,org}.ts` both hint this constraint BY NAME.
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.hospital_affiliations'::regclass
      and contype = 'f' and confrelid = 'public.hospitals'::regclass), 1,
  '0.6 exactly ONE foreign key from hospital_affiliations to hospitals (the composite; a second is the PGRST201 shape)');

select has_column('public', 'profiles', 'cpf', '0.7 profiles.cpf exists (ADR 0097 D7)');
select has_column('public', 'professional_profiles', 'cpf', '0.8 professional_profiles.cpf exists (D15 — column only)');

-- 20260909000200 leaves REFERENCES table-level, so it still covers `cpf`. That is
-- inert ONLY because `authenticated` cannot create a referencing table to use as an
-- existence oracle. Asserted rather than commented — a load-bearing premise that lives
-- in prose goes stale in silence.
select ok(
  not has_schema_privilege('authenticated', 'public', 'CREATE'),
  '0.9 authenticated holds no CREATE on schema public — the premise that the residual REFERENCES(cpf) grant is inert');

-- ============================================================================
-- §1 THE CPF PAIR. app.is_valid_cpf <-> isValidCpf (src/lib/users/cpf.ts) is a
-- MIRRORED RULE of the condition-evaluator class (Rule 3). The JSON below is the
-- LITERAL CONTENT of src/lib/users/__fixtures__/cpf-vectors.json; `cpf.test.ts` runs
-- the same vectors against the TS half AND asserts this embedded copy still parses
-- equal, so neither side can be edited alone.
-- ============================================================================
create temp table cpfv on commit drop as
select (e.value ->> 'name') as name,
       (e.value ->> 'cpf') as cpf,
       (e.value ->> 'expected')::boolean as expected
from jsonb_array_elements(
  ($vectors${
  "_comment": [
    "ADR 0097 D7 — the golden vectors for the CPF pair:",
    "SQL app.is_valid_cpf (supabase/migrations/20260909000200_profiles_cpf.sql)",
    "<-> TS isValidCpf (src/lib/users/cpf.ts).",
    "",
    "This is a MIRRORED RULE of the same class as the condition evaluator (Rule 3)",
    "and deriveUserStatus: one authority, two call sites. The SQL half is the",
    "integrity boundary (a CHECK constraint on profiles.cpf and",
    "professional_profiles.cpf); the TS half is what turns a bad digit into a pt-BR",
    "field error instead of a raw 23514. Drift is phase-blocking.",
    "",
    "Run by Vitest (src/lib/users/cpf.test.ts) and by pgTAP",
    "(supabase/tests/301_hospital_affiliation_substrate.sql), which embeds these",
    "bytes verbatim; the Vitest drift detector asserts the embedded copy still",
    "parses EQUAL, so neither side can be edited alone.",
    "",
    "`cpf` is the STORAGE form: digits only. Formatting ('111.444.777-35') is a",
    "presentation concern the action layer strips with normalizeCpf BEFORE either",
    "validator sees it — which is why the formatted spelling is an INVALID vector",
    "here rather than a valid one.",
    "",
    "The matrix covers, deliberately: both check digits; both arms of the",
    "`remainder < 2 -> 0` rule on EACH digit (98765432100 takes the zero arm twice,",
    "12345678909 on the first digit only, 00000000191 on neither); the repdigit",
    "rejection (which the check-digit arithmetic alone ACCEPTS); length; and",
    "non-digit input."
  ],
  "vectors": [
    { "name": "valid — 11144477735 (both check digits on the 11-r arm)", "cpf": "11144477735", "expected": true },
    { "name": "valid — 52998224725 (both check digits on the 11-r arm)", "cpf": "52998224725", "expected": true },
    { "name": "valid — 12345678909 (first check digit takes the r<2 -> 0 arm)", "cpf": "12345678909", "expected": true },
    { "name": "valid — 98765432100 (BOTH check digits take the r<2 -> 0 arm)", "cpf": "98765432100", "expected": true },
    { "name": "valid — 00000000191 (leading zeros survive; small weighted sums)", "cpf": "00000000191", "expected": true },
    { "name": "invalid — 11144477736 (second check digit wrong)", "cpf": "11144477736", "expected": false },
    { "name": "invalid — 11144477745 (first check digit wrong)", "cpf": "11144477745", "expected": false },
    { "name": "invalid — 12345678900 (second check digit wrong; first is right)", "cpf": "12345678900", "expected": false },
    { "name": "invalid — 00000000000 (repdigit; check digits alone ACCEPT it)", "cpf": "00000000000", "expected": false },
    { "name": "invalid — 11111111111 (repdigit; check digits alone ACCEPT it)", "cpf": "11111111111", "expected": false },
    { "name": "invalid — 99999999999 (repdigit; check digits alone ACCEPT it)", "cpf": "99999999999", "expected": false },
    { "name": "invalid — 1114447773 (10 digits)", "cpf": "1114447773", "expected": false },
    { "name": "invalid — 111444777350 (12 digits)", "cpf": "111444777350", "expected": false },
    { "name": "invalid — formatted 111.444.777-35 (storage form is digits only)", "cpf": "111.444.777-35", "expected": false },
    { "name": "invalid — 1114447773a (non-digit)", "cpf": "1114447773a", "expected": false },
    { "name": "invalid — leading space", "cpf": " 1114447773", "expected": false },
    { "name": "invalid — empty string", "cpf": "", "expected": false }
  ]
}$vectors$::jsonb) -> 'vectors') e;

-- Self-diagnosing: the assertion CARRIES the names of any disagreeing vector, so a
-- red here names the vector instead of only the count.
select is(
  (select coalesce(string_agg(name, ' | ' order by name), '')
     from cpfv where app.is_valid_cpf(cpf) is distinct from expected), '',
  '1.1 CPF PARITY: every shared vector agrees with app.is_valid_cpf (names any that do not)');

-- A vector set that is all-true (or all-false) makes 1.1 satisfiable by a constant
-- function. Both polarities must be present, and in quantity.
select ok(
  (select count(*) filter (where expected) from cpfv) >= 5
    and (select count(*) filter (where not expected) from cpfv) >= 10,
  '1.2 NON-VACUITY: the vector set carries both polarities (>=5 valid, >=10 invalid) — 1.1 is not satisfiable by a constant');

select is(app.is_valid_cpf(null), false,
  '1.3 app.is_valid_cpf(NULL) is FALSE, not NULL — the CHECK constraint spells the nullable case itself');

-- ============================================================================
-- §2 CPF INTEGRITY. Runs BEFORE any claims are set: `guard_profile_privileged_columns`
-- treats a null auth.uid() as the trusted service path, which is the path these writes
-- model. (§7.4 exercises the in-session arm.)
-- ============================================================================
select lives_ok(
  $$update public.profiles set cpf = '11144477735'
     where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '2.1 a valid CPF stores');

select throws_ok(
  $$update public.profiles set cpf = '11144477736'
     where id = '00000000-0000-0000-0000-0000000000d4'$$,
  '23514', null,
  '2.2 a bad check digit is REFUSED by profiles_cpf_valid (23514)');

select throws_ok(
  $$update public.profiles set cpf = '11144477735'
     where id = '00000000-0000-0000-0000-0000000000d4'$$,
  '23505', null,
  '2.3 CPF is unique platform-wide — a duplicate is REFUSED (23505)');

-- The twin: 2.3 must not be passing because "no second CPF may be stored at all".
select lives_ok(
  $$update public.profiles set cpf = '52998224725'
     where id = '00000000-0000-0000-0000-0000000000d4'$$,
  '2.4 TWIN: a DIFFERENT valid CPF on the same person still stores (2.3 is uniqueness, not a blanket refusal)');

select throws_ok(
  $$insert into public.professional_profiles (organization_id, full_name, cpf)
    values ('0c000000-0000-0000-0000-00000000000a', 'Fixture Prof', '11144477736')$$,
  '23514', null,
  '2.5 professional_profiles.cpf shares the SAME authority — a bad check digit is refused (D15)');

select lives_ok(
  $$insert into public.professional_profiles (organization_id, full_name, cpf)
    values ('0c000000-0000-0000-0000-00000000000a', 'Fixture Prof', '12345678909')$$,
  '2.6 TWIN: a valid CPF on professional_profiles stores — and is NOT unique there (D15 defers linking)');

-- ============================================================================
-- §3 AFFILIATION INTEGRITY.
-- ============================================================================
insert into public.hospital_affiliations (principal_id, organization_id, hospital_id, started_on)
values ('00000000-0000-0000-0000-0000000000d3', '0c000000-0000-0000-0000-00000000000a',
        '05000000-0000-0000-0000-0000000000a2', '2024-01-01');

select throws_ok(
  $$insert into public.hospital_affiliations (principal_id, organization_id, hospital_id)
    values ('00000000-0000-0000-0000-0000000000d3', '0c000000-0000-0000-0000-00000000000a',
            '05000000-0000-0000-0000-0000000000a2')$$,
  '23505', null,
  '3.1 a SECOND ACTIVE affiliation for one (person, hospital) is REFUSED (hospital_affiliations_active_uq)');

update public.hospital_affiliations set ended_on = '2025-06-30', ended_by = '00000000-0000-0000-0000-0000000000b1'
where principal_id = '00000000-0000-0000-0000-0000000000d3' and ended_on is null;

select lives_ok(
  $$insert into public.hospital_affiliations (principal_id, organization_id, hospital_id, started_on)
    values ('00000000-0000-0000-0000-0000000000d3', '0c000000-0000-0000-0000-00000000000a',
            '05000000-0000-0000-0000-0000000000a2', '2025-07-01')$$,
  '3.2 an ENDED row plus a NEW ACTIVE row is legitimate — history is unbounded, only the ACTIVE row is unique (D4)');

select throws_ok(
  $$insert into public.hospital_affiliations (principal_id, organization_id, hospital_id, started_on, ended_on)
    values ('00000000-0000-0000-0000-0000000000d4', '0c000000-0000-0000-0000-00000000000a',
            '05000000-0000-0000-0000-00000000000a', '2025-01-01', '2024-12-31')$$,
  '23514', null,
  '3.3 ended_on before started_on is REFUSED (hospital_affiliations_period_ck)');

-- ⚠ The composite FK ties HOSPITAL to ORG. It is NOT the tenant check — that the
-- PRINCIPAL is anchored to the same org is the W2 door's job (ADR 0097 D13), and a
-- future reader must not read this assertion as tenant isolation.
select throws_ok(
  $$insert into public.hospital_affiliations (principal_id, organization_id, hospital_id)
    values ('00000000-0000-0000-0000-0000000000d3', '0c000000-0000-0000-0000-00000000000a',
            '05000000-0000-0000-0000-00000000000b')$$,
  '23503', null,
  '3.4 a hospital of ANOTHER org under this org_id is REFUSED by the composite FK (23503)');

select lives_ok(
  $$insert into public.hospital_affiliations (principal_id, organization_id, hospital_id)
    values ('00000000-0000-0000-0000-0000000000d3', '0c000000-0000-0000-0000-00000000000b',
            '05000000-0000-0000-0000-00000000000b')$$,
  '3.5 TWIN: that same hospital under its OWN org is accepted — 3.4 is the pairing, not a blanket refusal');

-- ============================================================================
-- §4 THE FOUR-LEG SELECT POLICY, asserted with REAL ROWS under `set local role`.
-- A correct predicate is not correct policies.
--
-- Three subjects, chosen so each positive is reachable by exactly ONE leg:
--   unaffiliated_subject (d1) @ central-a     — ha1 reaches it ONLY via leg 3 (its hospital)
--   td_a (f1)            @ secundario-a       — ha1 reaches it ONLY via leg 4 (f1 is
--                                               technical_director OF central-a; the row's
--                                               own hospital is one ha1 does NOT administer)
--   sibling_subject (d4) @ secundario-a       — ha1 reaches it by NO leg (the DENY arm)
-- d1 and d4 hold ZERO memberships, which is what keeps leg 4 out of their evaluation.
-- ============================================================================
create temp table fx on commit drop as
with ins as (
  insert into public.hospital_affiliations (principal_id, organization_id, hospital_id)
  values ('00000000-0000-0000-0000-0000000000d1', '0c000000-0000-0000-0000-00000000000a',
          '05000000-0000-0000-0000-00000000000a'),
         ('00000000-0000-0000-0000-0000000000f1', '0c000000-0000-0000-0000-00000000000a',
          '05000000-0000-0000-0000-0000000000a2'),
         ('00000000-0000-0000-0000-0000000000d4', '0c000000-0000-0000-0000-00000000000a',
          '05000000-0000-0000-0000-0000000000a2')
  returning id, principal_id
)
select id, principal_id from ins;
grant select on fx to authenticated;

-- leg 1 — self.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000d1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_affiliations a
    join fx on fx.id = a.id
   where a.principal_id = (select unaffiliated_subject from k)), 1,
  '4.1 LEG 1 (self): a person reads their OWN affiliation row (their account page depends on it — audit MEDIUM-4)');
select is(
  (select count(*)::int from public.hospital_affiliations a
    join fx on fx.id = a.id
   where a.principal_id = (select sibling_subject from k)), 0,
  '4.2 LEG 1 CONTROL: self is SELF — the same person reads ZERO of another person''s affiliation rows');
reset role;

-- leg 2 — org_admin. The tenant boundary is the ORGANIZATION (ADR 0097 finding 1).
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_affiliations a join fx on fx.id = a.id), 3,
  '4.3 LEG 2 (org_admin): the org admin reads ALL of its org''s affiliation rows, across both hospitals');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b2', false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_affiliations a join fx on fx.id = a.id), 0,
  '4.4 LEG 2 CONTROL: another ORGANISATION''s admin reads ZERO — the org anchor holds');
reset role;

-- legs 3 and 4, plus the deny arm, all read by the SAME principal.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_affiliations a
    join fx on fx.id = a.id
   where a.principal_id = (select unaffiliated_subject from k)), 1,
  '4.5 LEG 3 (affiliation): the hospital admin reads an affiliation row AT the hospital it administers');
select is(
  (select count(*)::int from public.hospital_affiliations a
    join fx on fx.id = a.id
   where a.principal_id = (select td_a from k)), 1,
  '4.6 LEG 4 (membership): it also reads the SIBLING-hospital row of a person seated under ITS hospital (the technical_director of ADR 0097 finding 3)');
-- ⚠ 4.7 pins the DEFAULT state, NOT a hard boundary (audit LOW-1): the W2
-- `affiliate_person` door lets any in-org hospital admin self-serve an affiliation,
-- after which leg 3 admits them. The tenant boundary remains the ORGANISATION (4.4).
select is(
  (select count(*)::int from public.hospital_affiliations a
    join fx on fx.id = a.id
   where a.principal_id = (select sibling_subject from k)), 0,
  '4.7 DENY: a sibling hospital''s admin reads ZERO of a person affiliated only to the OTHER hospital and seated nowhere under theirs');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003', false);
set local role authenticated;
select is(
  (select count(*)::int from public.hospital_affiliations a join fx on fx.id = a.id), 0,
  '4.8 a plain commission member reads ZERO affiliation rows — none of the four legs is a membership-of-anything leg');
reset role;

-- ============================================================================
-- §5 THE W1 GAP, NOW CLOSED — INVERTED BY W2/T2.3 (20260909000700), AS PLANNED.
--
-- W1's `20260909000300` removed the `home_hospital_id` leg from both `profiles` SELECT
-- policies and added nothing, so for the length of one workstream a hospital admin
-- could see THAT a person was employed at their hospital and still not read the
-- person's profile. This assertion was written in W1 to PIN that gap, with "⚠ W2/T2.3
-- INVERTS THIS" in its own name; T2.3's affiliation leg has now landed and the second
-- half reads 1.
--
-- It is kept (inverted) rather than deleted, because the pair of counts is exactly the
-- property D2 exists for: a committee-less employee must be visible to their own
-- hospital's administrator. `302` §4 keystones the leg itself with ALLOW and DENY arms;
-- this one keystones the END-TO-END shape the workstream was created to fix.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000e1', false);
set local role authenticated;
select ok(
  (select count(*)::int from public.hospital_affiliations a
    join fx on fx.id = a.id
   where a.principal_id = (select unaffiliated_subject from k)) = 1
  and (select count(*)::int from public.profiles
        where id = (select unaffiliated_subject from k)) = 1,
  '5.1 W1 GAP CLOSED (T2.3 inverted this): the hospital admin reads BOTH the affiliation AND the profile of a committee-less employee');
reset role;

-- ============================================================================
-- §6 THE COLUMN LOCK — BOTH ARMS, so the conversion can neither over- nor undershoot
-- (external audit HIGH-1). `profiles_select_self_or_admin` carries a CO-MEMBER leg, so
-- the reader below legitimately reaches its colleagues' rows; only the COLUMN stops it.
-- ============================================================================
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003', false);
set local role authenticated;
select throws_ok(
  $$select cpf from public.profiles limit 1$$,
  '42501', null,
  '6.1 DENY ARM: authenticated selecting `cpf` on profiles is refused (42501) — a national ID must not ride along on a colleague''s row read');
select throws_ok(
  $$select * from public.profiles limit 1$$,
  '42501', null,
  '6.2 DENY ARM: `select *` is refused too — the lock is a column privilege, not a client-side omission');
select lives_ok(
  $$select id, full_name, email, home_organization_id from public.profiles limit 1$$,
  '6.3 ALLOW ARM: the GRANTED columns still read — the conversion did not overshoot');
select cmp_ok(
  (select count(*)::int from public.profiles), '>', 0,
  '6.4 NON-VACUITY: that reader genuinely sees profile rows, so 6.1 is a column refusal and not an empty result set');
reset role;

-- ============================================================================
-- §7 THE GUARD REWRITE (external audit MEDIUM-1). `guard_profile_privileged_columns`
-- compared both dropped columns; plpgsql is LATE-BOUND, so the DROP succeeds and every
-- later `profiles` UPDATE fails 42703 at runtime unless the trigger was rewritten in
-- the same migration. Any UPDATE at all exercises it.
-- ============================================================================
select test_helpers.claims_for(null, false);   -- service path: auth.uid() is null
select lives_ok(
  $$update public.profiles set suspended_until = now() + interval '1 day'
     where id = '00000000-0000-0000-0000-0000000000d3'$$,
  '7.1 the SERVICE path may still write an identity column post-drop (no 42703 from a stale trigger body)');
reset role;

select test_helpers.claims_for('00000000-0000-0000-0000-000000000003', false);
set local role authenticated;
select lives_ok(
  $$update public.profiles set full_name = 'Nome Reescrito'
     where id = '00000000-0000-0000-0000-000000000003'$$,
  '7.2 an IN-SESSION self UPDATE still succeeds post-drop (the trigger fires on every UPDATE — this is the arm that would 42703)');
select is(
  (select full_name from public.profiles where id = (select staff_ccih from k)), 'Nome Reescrito',
  '7.3 NON-VACUITY: 7.2 actually wrote — RLS did not silently scope it to zero rows');
select throws_ok(
  $$update public.profiles set professional_category_id = null
     where id = '00000000-0000-0000-0000-000000000003'$$,
  '23514', null,
  '7.4 the guard was not WEAKENED by the rewrite: a signed-in caller still cannot edit an identity column');
reset role;

select * from finish();
rollback;
