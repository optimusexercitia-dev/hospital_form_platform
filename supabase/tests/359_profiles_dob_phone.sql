-- AFF2 B1 — the restricted personal details `date_of_birth` + `phone` (ADR 0133 D9/D10,
-- Amendment 1 ruling 6), AS RELOCATED BY AE3 (ADR 0155 D4, migrations 20261003006600-006800).
--
-- ⛔ THE SUBJECT MOVED, AND THE FILE KEEPS ITS NUMBER DELIBERATELY. Its lineage is the
-- point: AFF2 B1 asserted a property of `profiles.date_of_birth` / `.phone`, AE3 moved
-- those values to `public.profile_private_details`, and the PROPERTY is unchanged — "no
-- signed-in caller reads or writes these, ever". A new file would have left 359 as a green
-- test of a vanished subject or a deleted test with no successor, and neither records that
-- the guarantee survived a change of mechanism. Its file name is kept for the same reason
-- a rename orphans a name-keyed verdict.
--
-- ⭐ THE MECHANISM CHANGED, AND IT IS NOW STRICTLY STRONGER. Read this before editing:
--
--   BEFORE (AFF2 B1): two independent controls on COLUMNS of `profiles` —
--     1. the COLUMN-GRANT ABSENCE: `profiles` carries column-list grants to
--        `authenticated`, and these two columns were simply never in the list; and
--     2. the GUARD TRIGGER: `guard_profile_privileged_columns` named both columns on its
--        `v_identity_changed` (service-role-only) limb.
--     ⚠ Control 1 was a CONJUNCTION nothing stated in one place — table-level
--     SELECT/UPDATE/INSERT revoked AND the columns absent from the per-column grants. A
--     single `grant select on public.profiles to authenticated` would have republished
--     them while every column-list assertion stayed green. Old §1.5 existed precisely
--     because the author saw that hole and could only nail it shut with a second test.
--
--   AFTER (AE3 D4): the values live in `public.profile_private_details`, which has RLS
--     enabled, ZERO policies, and NO grant to `authenticated` or `anon` at all. The
--     boundary is a RELATION, which the standing authz arms can see, instead of a pair of
--     ACL facts that only this file ever checked together.
--
--   ⛔ CONSEQUENCE FOR §3, STATED RATHER THAN QUIETLY DROPPED: the guard trigger's arms for
--   these columns are GONE, because the columns are gone. §3 no longer asserts a
--   `check_violation` from the trigger. Deleting those assertions without replacement would
--   be a silent loss of coverage, so §3 now asserts FOUR things instead: the trigger still
--   EXISTS, its body no longer names the three moved columns, its REMAINING arms still bite
--   (so we know the trigger was edited and not gutted), and the NEW control refuses the same
--   caller. A retired control must be shown retired AND shown replaced.
--
-- ⛔ VACUITY CONTROLS, one per checker, because most of these assertions are the shape that
-- passes when the subject does not exist at all:
--   · §0 asserts the MOVE happened — the three columns are gone from `profiles` AND present
--     on the new table. Without it every "authenticated cannot read it" assertion below is
--     green on a database where the migration never ran, and green again on one where the
--     table was dropped entirely.
--   · 1.4 is the positive twin: `profiles.full_name` MUST show grants through an
--     equivalent query. A typo in the table name or the grantee returns zero for
--     everything and 1.1-1.3 would read as a pass.
--   · 2.x pin the SQLSTATE, not merely "it raised". Against a missing table the same
--     statement raises 42P01 and a bare throws_ok would accept it, reporting the access
--     control as working on a database that has no such table.
--   · 3.5 is the attribution twin for 3.3, and 6.2 for 6.1.

begin;
select plan(30);

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

-- AE3: the restricted values are a SEPARATE ROW now, and it must be created explicitly.
-- `on_auth_user_created` makes the profile; nothing makes this.
insert into public.profile_private_details (profile_id)
values ('0aff2001-0000-0000-0000-000000000001');

-- ===========================================================================
-- §0 THE MOVE ITSELF. Asserted first because every section below is green on a
-- database that never ran the AE3 migration set.
-- ===========================================================================

select is(
  (select count(*)::int from pg_attribute
    where attrelid = 'public.profiles'::regclass
      and attname in ('cpf', 'date_of_birth', 'phone')
      and attnum > 0 and not attisdropped), 0,
  '0.1 ⭐ PRECONDITION: none of the three columns remain on `profiles`. This replaces the old 1.1 ("both columns EXIST"), which now asserts the opposite of what is correct');

select is(
  (select count(*)::int from pg_attribute
    where attrelid = 'public.profile_private_details'::regclass
      and attname in ('cpf', 'date_of_birth', 'phone')
      and attnum > 0 and not attisdropped), 3,
  '0.2 PRECONDITION: all three exist on `profile_private_details`. Paired with 0.1 so "moved" is asserted, never just "absent" — a DROP with no destination satisfies 0.1 alone');

-- ===========================================================================
-- §1 The grant ABSENCE, in the catalog (D10, as re-based by AE3).
-- ===========================================================================

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'profile_private_details'
      and grantee = 'authenticated'
      and privilege_type in ('SELECT', 'UPDATE', 'INSERT', 'DELETE')), 0,
  '1.1 ⭐ `authenticated` holds NO table-level SELECT/UPDATE/INSERT/DELETE on profile_private_details');

select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profile_private_details'
      and grantee = 'authenticated'
      and privilege_type in ('SELECT', 'UPDATE', 'INSERT')), 0,
  '1.2 ... and no COLUMN-level grant either. Asserted SEPARATELY from 1.1: the old mechanism was column grants, so a re-introduction would arrive in exactly this shape and 1.1 alone would stay green');

-- ⛔ THE WHOLE-TABLE FORM, positively asserted. The old 1.3 was a differential against
-- `cpf` ("column-locked LIKE cpf"), which is meaningless now that all three live in one
-- table where cpf is a peer rather than a baseline. The replacement is stronger: EVERY
-- column is unreadable, so a column added to this table in future is covered without
-- anyone remembering to extend a name list.
-- has_column_privilege is used rather than the ACL view because a NULL/absent ACL entry
-- means "the table grant applies" — an inference from an empty-looking catalog has fired
-- wrong four times in this repo.
select is(
  (select count(*)::int from pg_attribute a
    where a.attrelid = 'public.profile_private_details'::regclass
      and a.attnum > 0 and not a.attisdropped
      and has_column_privilege('authenticated', 'public.profile_private_details', a.attname, 'SELECT')), 0,
  '1.3 ⭐ derived over ALL columns, not a name list: `authenticated` can SELECT ZERO of them. A column added later is covered without editing this test');

select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and column_name = 'full_name'
      and privilege_type in ('SELECT', 'UPDATE', 'INSERT')), 3,
  '1.4 VACUITY CONTROL for 1.1-1.3: an equivalent query DOES find all three on `profiles.full_name`. A wrong table or grantee returns 0 for everything and 1.1-1.3 would read as a pass');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'profile_private_details'), 0,
  '1.5 ⭐ ZERO policies. With RLS enabled this is default-deny, the AE1.6 door-only class — and it is the redundant backstop behind 1.1, not the primary control (table privilege is checked BEFORE RLS ever runs)');

select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'public.profile_private_details'::regclass),
  '1.6 ... and RLS is ENABLED, so 1.5 means default-deny rather than default-allow. Asserted separately because "zero policies" on an RLS-DISABLED table is the exact opposite of a boundary');

-- ===========================================================================
-- §2 The absence BITES. A catalog row is not an access control until a caller is
-- actually refused; these are the assertions that make §1 more than bookkeeping.
-- ===========================================================================
select test_helpers.claims_for('0aff2001-0000-0000-0000-000000000001');
set local role authenticated;

select throws_ok(
  $$select date_of_birth from public.profile_private_details limit 1$$,
  '42501', null,
  '2.1 an `authenticated` SELECT of date_of_birth is REFUSED — SQLSTATE 42501, not merely "some error" (against a missing table the same statement raises 42P01 and a bare throws_ok would accept it)');

select throws_ok(
  $$select phone from public.profile_private_details limit 1$$,
  '42501', null,
  '2.2 ... and of phone');

select throws_ok(
  $$select cpf from public.profile_private_details limit 1$$,
  '42501', null,
  '2.3 ... and of cpf. All three asserted SEPARATELY: one column can be re-granted while a combined assertion stays green');

-- The person's OWN row is the sharpest case: before AE3, RLS admitted it and only the
-- column grant could refuse. Now there is no policy admitting it AND no grant, and the
-- grant is what fires first.
select throws_ok(
  $$select date_of_birth from public.profile_private_details where profile_id = auth.uid()$$,
  '42501', null,
  '2.4 ⭐ a person cannot read their OWN date_of_birth — the door `get_own_person_record` is the only path to it, deliberately (this is what FUP-AFF2-CONTA would revisit)');

select lives_ok(
  $$select full_name, email from public.profiles where id = auth.uid()$$,
  '2.5 VACUITY CONTROL for 2.1-2.4: the SAME role, SAME session reads granted columns of `profiles` fine. The refusals are table-scoped, not a broken session');

-- ⛔ THE OWN-DATA DOOR STILL WORKS. Without this, every assertion above is satisfiable by
-- a database where the values are unreachable BY ANYONE — which would be a broken product
-- passing a security test. This is the reachability twin of 2.1-2.4.
select lives_ok(
  $$select * from public.get_own_person_record()$$,
  '2.6 ⭐ REACHABILITY TWIN: the same caller CAN read their own three values through `get_own_person_record`. 2.1-2.4 prove the table is shut; this proves the door is open');

select is(
  (select count(*)::int from public.get_own_person_record()), 1,
  '2.7 ... and it returns exactly one row for a person with a private-details row');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §3 The guard trigger: its arms for these three columns are RETIRED, and the
-- replacement control is asserted in the same section so the swap is visible.
-- ===========================================================================

select ok(
  (select count(*) > 0 from pg_trigger t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'guard_profile_privileged_columns_trg'
      and not t.tgisinternal),
  '3.1 the guard trigger STILL EXISTS on `profiles`. AE3 edited its body; it did not drop it, and its lifecycle arms are still the only thing holding them');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_profile_privileged_columns'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~* '\y(cpf|date_of_birth|phone)\y'), 0,
  '3.2 ⭐ its COMMENT-STRIPPED body no longer names any of the three. Comment-stripped deliberately: the body still DISCUSSES the move in prose, and an uncommented regex would count that prose as live code');

-- ⛔ THE TRIGGER WAS EDITED, NOT GUTTED. Runs as table owner with claims set, so the
-- column ACL cannot pre-empt the trigger and the trigger is the only thing in the path.
select test_helpers.claims_for('0aff2001-0000-0000-0000-000000000001');

select throws_ok(
  $$update public.profiles set must_change_password = true
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '23514', null,
  '3.3 ⭐ a REMAINING identity arm still bites: a signed-in caller cannot set their own must_change_password. Without this, 3.2 is satisfiable by a trigger whose whole identity limb was deleted');

select lives_ok(
  $$update public.profiles set full_name = 'Sujeito B1 Renomeado'
     where id = '0aff2001-0000-0000-0000-000000000001'$$,
  '3.4 VACUITY CONTROL for 3.3: the SAME caller updating full_name SUCCEEDS. Without it, 3.3''s check_violation could come from a guard that refuses every update');

select test_helpers.reset_role_and_claims();

-- The REPLACEMENT control, asserted against the same class of caller the retired arms
-- refused. Note the SQLSTATE differs by design: the old arms refused at 23514
-- (check_violation, from the trigger); this refuses at 42501 (no grant), earlier and
-- without any trigger having to be correct.
select test_helpers.claims_for('0aff2001-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok(
  $$update public.profile_private_details set date_of_birth = '1980-01-01'
     where profile_id = '0aff2001-0000-0000-0000-000000000001'$$,
  '42501', null,
  '3.5 ⭐ THE REPLACEMENT FOR THE RETIRED ARMS: a signed-in caller still cannot write their own date_of_birth. Refused at 42501 by the ABSENT GRANT, before RLS or any trigger runs');

select throws_ok(
  $$update public.profile_private_details set phone = '11987654321'
     where profile_id = '0aff2001-0000-0000-0000-000000000001'$$,
  '42501', null,
  '3.6 ... and their own phone. Asserted SEPARATELY, matching the old 3.2''s reasoning: one limb can be missing while a combined assertion stays green');

select test_helpers.reset_role_and_claims();

-- ===========================================================================
-- §4 The SERVICE path still works. This is how `app.update_person_fields_impl` and
-- `app.finalize_invited_person_impl` write these values; a control added above the
-- service path would break both doors while §2/§3 stayed green.
-- ===========================================================================
select lives_ok(
  $$update public.profile_private_details
       set date_of_birth = '1975-06-30', phone = '11912345678'
     where profile_id = '0aff2001-0000-0000-0000-000000000001'$$,
  '4.1 with NO jwt claims (the service path) BOTH values are writable — this is how the person doors write them');

select is(
  (select date_of_birth::text from public.profile_private_details
    where profile_id = '0aff2001-0000-0000-0000-000000000001'), '1975-06-30',
  '4.2 ... and the value landed (4.1 asserts no raise; this asserts the write happened)');

-- ===========================================================================
-- §5 Shape. Amendment 1 ruling 6 pinned structurally, so a later well-meaning
-- CHECK constraint reds here instead of shipping.
-- ===========================================================================
select is(
  (select format_type(atttypid, atttypmod) from pg_attribute
    where attrelid = 'public.profile_private_details'::regclass and attname = 'date_of_birth'), 'date',
  '5.1 date_of_birth is `date`');

select is(
  (select count(*)::int from pg_attribute
    where attrelid = 'public.profile_private_details'::regclass
      and attname in ('cpf', 'date_of_birth', 'phone') and attnotnull), 0,
  '5.2 all three are NULLABLE — optional at registration (D9)');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.profile_private_details'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%phone%'), 0,
  '5.3 ⭐ NO CHECK constraint mentions `phone` (Amdt 1 ruling 6: digits-only is a storage convention, not an identifier invariant; formatting is display-side)');

-- ===========================================================================
-- §6 CPF is DIGITS-ONLY BY CONSTRAINT, not by convention.
--
-- ⛔ WHY THIS MATTERS FAR BEYOND B1. `list_org_people` matches CPF EXACTLY — at full
-- storage length, because ADR 0097 D11 refuses partial matching as an enumeration oracle.
-- So a FORMATTED value at rest is not merely untidy, it is UNFINDABLE: the lookup returns
-- empty, the identifier-first wizard reports "nenhuma pessoa com este CPF", and the
-- registrar creates a DUPLICATE PERSON — the feature goes inert on exactly the population
-- it exists for.
--
-- ⚠ AE3 MOVED THE CONSTRAINT, AND MOVING IT IS WHY THIS SECTION IS NOT REDUNDANT WITH THE
-- OLD ONE. The CHECK and the PARTIAL unique index were carried over as the same statements
-- calling the same `app.is_valid_cpf`, not re-typed equivalents. A re-typed `cpf text
-- unique` would coincide behaviourally on the uniqueness axis (Postgres permits many NULLs)
-- while silently dropping the digits-only predicate — 6.1 is what reds if that happens.
-- ===========================================================================

select throws_ok(
  $$update public.profile_private_details set cpf = '111.444.777-35'
     where profile_id = '0aff2001-0000-0000-0000-000000000001'$$,
  '23514', null,
  '6.1 ⭐ a FORMATTED CPF is REFUSED at rest (profile_private_details_cpf_valid / app.is_valid_cpf ^[0-9]{11}$). Without this, exact-match lookup silently misses the person and a duplicate gets created');

-- ⚠ THE VALUE MUST BE VALID **AND UNUSED**. First written with 11144477735, which is a
-- perfectly valid CPF and is already held by a seed persona — the arm died on the CPF
-- unique index (23505), not on the property, and a `lives_ok` that dies for an unrelated
-- reason reads exactly like the constraint rejecting everything. Which is what this control
-- exists to detect, so it caught itself. 10000000019 is valid per `app.is_valid_cpf` and
-- held by nobody in the seed.
select lives_ok(
  $$update public.profile_private_details set cpf = '10000000019'
     where profile_id = '0aff2001-0000-0000-0000-000000000001'$$,
  '6.2 VACUITY CONTROL for 6.1: the SAME statement with the digits-only form SUCCEEDS. Without it, 6.1 is satisfiable by any constraint that rejects every CPF');

select is(
  (select app.is_valid_cpf('111.444.777-35')), false,
  '6.3 ... and the predicate itself is the reason, asserted directly rather than inferred from the CHECK that calls it');

-- The uniqueness half, which moved with its PARTIAL predicate. A plain `unique` would pass
-- a naive duplicate test identically; only the predicate distinguishes them, so both limbs
-- are asserted.
select is(
  (select count(*)::int from pg_index i
    where i.indrelid = 'public.profile_private_details'::regclass
      and i.indisunique and i.indpred is not null
      and pg_get_indexdef(i.indexrelid) ilike '%cpf%'), 1,
  '6.4 ⭐ the CPF unique index is PARTIAL (`where cpf is not null`), exactly as it was on `profiles`. A re-typed `cpf text unique` would behave the same on NULLs by accident and differ in shape, name and plan');

select * from finish();
rollback;
