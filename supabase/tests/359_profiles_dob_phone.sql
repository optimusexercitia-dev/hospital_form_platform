-- AFF2 B1 — `profiles.date_of_birth` + `profiles.phone` (ADR 0133 D9/D10, Amendment 1
-- ruling 6). Migration 20261003001000.
--
-- Two independent controls protect these columns, and this file tests them SEPARATELY
-- because either one alone would make the other's test pass for the wrong reason:
--
--   1. THE COLUMN-GRANT ABSENCE. `profiles` carries COLUMN-LIST grants for
--      `authenticated` (since 20260909000200), so the default for a new column is
--      *absent*. Nothing was revoked; nothing was granted. §1 asserts the catalog state,
--      §2 asserts that it actually bites.
--   2. THE GUARD TRIGGER. `guard_profile_privileged_columns` gains both columns on its
--      `v_identity_changed` limb — the SERVICE-ROLE-ONLY class, not the
--      `v_privilege_changed` (admin-allowed-in-session) class. That choice is D10's:
--      the columns are "writable only through registerUser / updateUserProfile", which
--      are service paths. Putting them on the privilege limb would let a platform_admin
--      write a birth date from a live session, which also collides with the §1 noun rule
--      (a platform_admin does not touch commission content or person data).
--
-- ⛔ WHY §3 CANNOT RUN AS `authenticated`, and why that is not a weakened test.
-- Control 1 fires FIRST: an `authenticated` UPDATE of an ungranted column is refused at
-- 42501 before any row is fetched, so the trigger never runs. A "self-UPDATE is refused"
-- assertion written as `authenticated` would therefore pass with the guard limb
-- COMPLETELY ABSENT — the archetypal green that proves nothing. §3 runs as the table
-- owner (superuser: bypasses column ACL and RLS) with `request.jwt.claims` set, which
-- leaves the trigger as the ONLY thing in the statement's path that can refuse it.
--
-- ⛔ VACUITY CONTROLS, one per checker, because three of these assertions are the shape
-- that passes when the subject does not exist at all:
--   · 1.1/1.2 assert the columns EXIST before asserting they carry no grant. Without the
--     existence half this whole section is GREEN ON A DATABASE WHERE THE MIGRATION NEVER
--     RAN — `column_privileges` returns zero rows for a column that isn't there, which is
--     indistinguishable from zero rows for a column that is there and ungranted.
--   · 1.3 is the positive twin: `full_name` MUST show grants through the identical query.
--     A typo in the table name or the grantee returns zero for everything, and 1.1/1.2
--     would read as a pass.
--   · 2.x pin the SQLSTATE, not merely "it raised". Pre-migration the same statement
--     raises 42703 (undefined_column); a bare throws_ok would accept that and report the
--     access control as working on a database that has no such column.
--   · 3.4 is the attribution twin: an UPDATE touching only `full_name` must SUCCEED.
--     Without it, 3.1/3.2's check_violation could be coming from a guard that refuses
--     every update, and the two new limbs would be untested.

begin;
select plan(21);

-- ---------------------------------------------------------------------------
-- Fixture: one additive person with a fixed id, in the seeded Rede A org.
-- Fixed id, not gen_random_uuid(): a keystone that names its subject can be
-- re-run and reasoned about; a random one cannot be reproduced from the failure.
-- Inserting into auth.users auto-creates the profile (on_auth_user_created).
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
        '0aff2001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
        'aff2.b1.subject@test.local', now(), now());

update public.profiles
   set full_name = 'Sujeito B1'
 where id = '0aff2001-0000-0000-0000-000000000001';

-- ===========================================================================
-- §1 The column-grant ABSENCE, in the catalog (D10).
-- ===========================================================================

select is(
  (select count(*)::int from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname in ('date_of_birth', 'phone')
      and attnum > 0 and not attisdropped), 2,
  '1.1 PRECONDITION: both columns EXIST. Asserted before 1.2 because 1.2 is green on a database that never ran the migration');

-- ⛔ MEASURED CORRECTION (2026-08-23, this file's first post-migration run). The AFF2 plan
-- and the build brief both state "the default for a new column is *absent*". THAT IS FALSE
-- AS STATED, and an assertion written from it goes red on a correct migration. `profiles`
-- carries a TABLE-level REFERENCES grant to `authenticated` (alongside DELETE and TRIGGER),
-- so EVERY column — new ones included — shows a REFERENCES row in column_privileges. `cpf`
-- has carried it since the day it was added. REFERENCES permits creating a foreign key
-- against the column; it conveys NO ability to read a value, which is why the §2 refusals
-- below are unaffected by it.
--
-- So the honest predicate is not "zero privileges". It is D10's own sentence — "both
-- columns are column-locked LIKE `cpf`" — expressed as a DIFFERENTIAL (1.3). That form is
-- also self-calibrating: if a later change grants `cpf` something, this reds instead of
-- quietly redefining what "locked" means.
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated'
      and column_name in ('date_of_birth', 'phone')
      and privilege_type in ('SELECT', 'UPDATE', 'INSERT')), 0,
  '1.2 ⭐ D10: `authenticated` holds NO SELECT, UPDATE or INSERT on either column. (REFERENCES is excluded deliberately — see the note above; it is table-wide and value-blind)');

select is(
  (select array_agg(distinct privilege_type order by privilege_type)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and column_name in ('date_of_birth', 'phone')),
  (select array_agg(distinct privilege_type order by privilege_type)
     from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and column_name = 'cpf'),
  '1.3 ⭐ D10 VERBATIM ("column-locked LIKE cpf"): the new columns'' privilege set is IDENTICAL to cpf''s. A differential, so it stays true if the baseline ever moves');

select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and column_name = 'full_name'
      and privilege_type in ('SELECT', 'UPDATE', 'INSERT')), 3,
  '1.4 VACUITY CONTROL for 1.2/1.3: the identical query DOES find all three on `full_name`. A wrong table or grantee returns 0 for everything and 1.2 would read as a pass');

-- The column-list grant is the whole mechanism, so a TABLE-level grant appearing later
-- would silently re-expose both columns without touching the column lists 1.2 reads.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type in ('SELECT', 'UPDATE', 'INSERT')), 0,
  '1.5 ... and no TABLE-level SELECT/UPDATE/INSERT grant to `authenticated` exists either — which would re-expose both columns while leaving 1.2 green');

-- ===========================================================================
-- §2 The absence BITES. A catalog row is not an access control until a caller is
-- actually refused; these are the assertions that make §1 more than bookkeeping.
-- ===========================================================================
select test_helpers.claims_for('0aff2001-0000-0000-0000-000000000001');
set local role authenticated;

select throws_ok(
  $$select date_of_birth from public.profiles limit 1$$,
  '42501',
  null,
  '2.1 an `authenticated` SELECT of date_of_birth is REFUSED — SQLSTATE 42501, not merely "some error" (pre-migration the same statement raises 42703 and a bare throws_ok would accept it)');

select throws_ok(
  $$select phone from public.profiles limit 1$$,
  '42501', null,
  '2.2 ... and of phone');

-- The person's OWN row is the sharpest case: RLS admits it, so only the column grant
-- can refuse. FUP-AFF2-CONTA is the deferred decision to change exactly this.
select throws_ok(
  $$select date_of_birth from public.profiles where id = auth.uid()$$,
  '42501', null,
  '2.3 ⭐ a person cannot read their OWN date_of_birth — RLS admits the row, so the refusal is the column grant alone (this is what FUP-AFF2-CONTA would revisit)');

select lives_ok(
  $$select full_name, email from public.profiles where id = auth.uid()$$,
  '2.4 VACUITY CONTROL for 2.1-2.3: the SAME role, SAME table, SAME row reads granted columns fine. The refusals are column-scoped, not a broken session');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §3 The GUARD limb. Runs as table owner so the column ACL cannot pre-empt the
-- trigger (see the header). `auth.uid()` is non-null throughout, which is the
-- entire condition the new limb keys on.
-- ===========================================================================
select test_helpers.claims_for('0aff2001-0000-0000-0000-000000000001');

select throws_ok(
  $$update public.profiles set date_of_birth = '1980-01-01'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '23514', null,
  '3.1 ⭐ THE B1 KEYSTONE: a signed-in caller cannot write their own date_of_birth. Refused by the guard (check_violation), the only control in the path here');

select throws_ok(
  $$update public.profiles set phone = '11987654321'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '23514', null,
  '3.2 ... and their own phone. Asserted SEPARATELY: one limb can be missing while the other keeps a combined assertion green');

-- A different signed-in principal, so 3.1/3.2 are not read as a self-write rule.
select test_helpers.claims_for('00000000-0000-0000-0000-0000000000b1', false);
select throws_ok(
  $$update public.profiles set date_of_birth = '1980-01-01'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '23514', null,
  '3.3 an ORG_ADMIN in-session is refused too — the limb is "no signed-in caller", not "not the owner". The org_admin writes this column through the service path, never through a session');

select test_helpers.claims_for('0aff2001-0000-0000-0000-000000000001');
select lives_ok(
  $$update public.profiles set full_name = 'Sujeito B1 Renomeado'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '3.4 VACUITY CONTROL for 3.1-3.3: the SAME caller updating full_name SUCCEEDS. Without this, the check_violations above could come from a guard that refuses everything and the two new limbs would be untested');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §4 The SERVICE path still works. The guard's early return is what keeps
-- registerUser / updateUserProfile writing these columns; a limb added above the
-- `auth.uid() is null` check would break both actions while §3 stayed green.
-- ===========================================================================
select lives_ok(
  $$update public.profiles set date_of_birth = '1975-06-30', phone = '11912345678'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '4.1 with NO jwt claims (auth.uid() null = the service path) BOTH columns are writable — this is how registerUser / updateUserProfile write them');

select is(
  (select date_of_birth::text from public.profiles
    where id = '0aff2001-0000-0000-0000-000000000001'), '1975-06-30',
  '4.2 ... and the value landed (4.1 asserts no raise; this asserts the write happened)');

-- ===========================================================================
-- §5 Shape. Amendment 1 ruling 6 pinned structurally, so a later well-meaning
-- CHECK constraint reds here instead of shipping.
-- ===========================================================================
select is(
  (select format_type(atttypid, atttypmod) from pg_attribute
    where attrelid = 'public.profiles'::regclass and attname = 'date_of_birth'), 'date',
  '5.1 date_of_birth is `date`');

select is(
  (select count(*)::int from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname in ('date_of_birth', 'phone') and attnotnull), 0,
  '5.2 both are NULLABLE — optional at registration (D9)');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%phone%'), 0,
  '5.3 ⭐ NO CHECK constraint mentions `phone` (Amdt 1 ruling 6: digits-only is a storage convention, not an identifier invariant; formatting is display-side)');

-- ===========================================================================
-- §6 `profiles.cpf` is DIGITS-ONLY BY CONSTRAINT, not by convention.
--
-- ⛔ WHY THIS LIVES HERE AND WHY IT MATTERS FAR BEYOND B1. `list_org_people` matches CPF
-- EXACTLY — `pr.cpf = v_cpf`, at full storage length, because ADR 0097 D11 refuses partial
-- matching as an enumeration oracle. So a FORMATTED value at rest is not merely untidy, it
-- is UNFINDABLE: the lookup returns empty, the identifier-first wizard reports "nenhuma
-- pessoa com este CPF", and the registrar creates a DUPLICATE PERSON. That is precisely the
-- failure `registerUser`'s own doc names (`src/lib/users/actions.ts:90-91`) — the feature
-- goes inert on exactly the population it exists for.
--
-- ⚠ A NOTE ON WHAT THIS DOES *NOT* PIN, because it was first specified as pinning it. The
-- AFF2 B4 predicate normalises BOTH sides (`normalizeCpf(current) !== normalizeCpf(input)`),
-- so that predicate is correct whatever the storage format and does NOT depend on this
-- CHECK. The dependent named above does, and it survives any change to B4.
--
-- ⚠ This is also the reason the Vitest arm asserting a reformatted-CPF echo can only prove
-- INPUT-side normalisation: a stored non-normalised CPF is unconstructible, so the
-- discriminating fixture cannot be built in TypeScript at all. This is where that guarantee
-- is testable, and this arm is what reds if anyone relaxes `app.is_valid_cpf`.
-- ===========================================================================

select throws_ok(
  $$update public.profiles set cpf = '111.444.777-35'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '23514', null,
  '6.1 ⭐ a FORMATTED CPF is REFUSED at rest (profiles_cpf_valid / app.is_valid_cpf ^[0-9]{11}$). Without this, exact-match lookup silently misses the person and a duplicate gets created');

-- ⚠ THE VALUE MUST BE VALID **AND UNUSED**. First written with 11144477735, which is a
-- perfectly valid CPF and is already held by a seed persona — the arm died on
-- `profiles_cpf_key` (23505), not on the property, and a `lives_ok` that dies for an
-- unrelated reason reads exactly like the constraint rejecting everything. Which is what
-- this control exists to detect, so it caught itself. 10000000019 is valid per
-- `app.is_valid_cpf` and held by nobody in the seed.
select lives_ok(
  $$update public.profiles set cpf = '10000000019'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '6.2 VACUITY CONTROL for 6.1: the SAME statement with the digits-only form SUCCEEDS. Without it, 6.1 is satisfiable by any constraint that rejects every CPF');

select is(
  (select app.is_valid_cpf('111.444.777-35')), false,
  '6.3 ... and the predicate itself is the reason, asserted directly rather than inferred from the CHECK that calls it');

select * from finish();
rollback;
