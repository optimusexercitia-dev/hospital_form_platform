-- AE1.3 — the person doors' ACL surface and the `guard_profile_privileged_columns`
-- anti-fix keystone. Contract: docs/plans/authz-ae1-person-doors.md §1, §6 (esp. §6.4).
--
-- ⭐ THE ACL ASSERTIONS ARE POSITIVE, NEVER INFERRED. `pg_proc.proacl = NULL` means
-- PUBLIC EXECUTE — the recorded "guards that read right but fail open" class, hit four
-- times on this project. The `app` schema carries NO default function ACL, so an `app`
-- function created without an explicit `revoke` IS public. Every assertion below therefore
-- pins `proacl IS NOT NULL` alongside the per-role privilege, and every set-shaped
-- assertion is paired with a cardinality assertion so it cannot pass over an empty set.
--
-- ⭐ §3 IS AN ANTI-FIX KEYSTONE, and its property is the JOINT survival of three
-- independent facts, not any one of them. The doors work under `service_role` (3.1) AND
-- a signed-in caller cannot self-elevate (3.2) AND no door is reachable by
-- `authenticated` (3.3). Granting a door to `authenticated` reds 3.3 alone; widening the
-- guard's trusted-caller arm reds 3.2 alone; 3.1 staying green through either is what
-- proves the three are independent and not one predicate written three times.

begin;
select plan(24);

create temp table d on commit drop as
select unnest(array[
  'finalize_invited_person_for', 'update_person_fields_for',
  'set_person_active_for', 'suspend_person_for',
  'upsert_credential_for', 'delete_credential_for'
]) as door;

create temp table i on commit drop as
select unnest(array[
  'finalize_invited_person_impl', 'update_person_fields_impl',
  'set_person_active_impl', 'suspend_person_impl',
  'upsert_credential_impl', 'delete_credential_impl'
]) as kernel;

-- ============================================================================
-- §1 THE PUBLIC DOORS — service_role only.
-- ============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select door from d)), 6,
  '1.1 all SIX public doors exist — the cardinality that stops §1.2-§1.5 passing over an empty set');

select is(
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select door from d) and p.proacl is null),
  null,
  '1.2 ⭐ no door has a NULL proacl — a NULL acl is PUBLIC EXECUTE, which reads exactly like a locked-down function and is not one');

select is(
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select door from d)
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  null,
  '1.3 ⭐ `authenticated` holds EXECUTE on NONE of them — a door takes an explicit p_actor, so anyone who can call it can forge one');

select is(
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select door from d)
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  null,
  '1.4 `anon` holds EXECUTE on none of them');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (select door from d)
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and p.prosecdef), 6,
  '1.5 …and all six ARE reachable by `service_role` and ARE SECURITY DEFINER — the shape the server actions call');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app','public')
      and p.proname in (select door from d) and n.nspname = 'app'), 0,
  '1.6 no `app`-schema twin of a public door name exists — the wrapper is the only public surface');

-- ============================================================================
-- §2 THE KERNELS AND THE PREDICATE — owner-only, executable by NO client role.
--
-- ⚠ The `service_role = false` clause is not tidiness. It is the ADR 0156 door-SQLSTATE
-- gate's own kernel-domain condition (pgTAP 304 §6), so a stray grant would silently
-- EVICT the kernel from that gate. 304 §6.1's reverse pin catches the same thing from the
-- other side; having both is deliberate — one is an ACL fact, the other a domain fact.
-- ============================================================================
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in (select kernel from i)), 6,
  '2.1 all SIX kernels exist');

select is(
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in (select kernel from i) and p.proacl is null),
  null,
  '2.2 ⭐ no kernel has a NULL proacl — `app` carries no default function ACL, so without an explicit REVOKE a new kernel IS public');

select is(
  (select string_agg(p.proname || ':' || r.rolname, ',' order by p.proname, r.rolname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     cross join (values ('anon'),('authenticated'),('service_role')) r(rolname)
    where n.nspname = 'app' and p.proname in (select kernel from i)
      and has_function_privilege(r.rolname, p.oid, 'EXECUTE')),
  null,
  '2.3 ⭐ NO client role — anon, authenticated OR service_role — may execute any kernel directly');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname in (select kernel from i)
      and p.prosecdef and p.provolatile = 'v'), 6,
  '2.4 ⭐ every kernel is SECURITY DEFINER and VOLATILE — the two properties that put it inside the ADR 0156 door-SQLSTATE gate');

select is(
  (select p.proacl is not null
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and not has_function_privilege('service_role', p.oid, 'EXECUTE')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_administer_person_for'),
  true,
  '2.5 ⭐ the AUTHORITY PREDICATE itself is owner-only with an explicit ACL — it is the decision, and nothing outside the kernels may ask it');

-- ============================================================================
-- §3 ⭐ THE ANTI-FIX KEYSTONE (design §6.4).
--
-- ⛔ THE PROHIBITION THIS DEFENDS, stated so the "fix" is never attempted: the doors work
-- ONLY because they are service-role-invoked, where `auth.uid()` is NULL and
-- `guard_profile_privileged_columns` takes its trusted-caller early return. Grant them to
-- `authenticated` and all four `profiles` doors break on `check_violation`. The obvious
-- repair — exempting them from the guard via a transaction-local GUC — is a
-- PRIVILEGE-ESCALATION VULNERABILITY: any custom GUC is settable with `set_config` by the
-- very caller it would exclude, and 3.2 below shows what the guard is the only thing
-- holding shut.
-- ============================================================================
select is(
  (select count(*)::int from pg_trigger t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'guard_profile_privileged_columns_trg' and not t.tgisinternal), 1,
  '3.0 PRECONDITION: the guard trigger is live on `profiles` — 3.2 is meaningless without it');

select test_helpers.reset_role_and_claims();
-- ⚠ THE HAT IS PASSED EXPLICITLY. `claims_for`'s two-argument form derives NO
-- `active_role` for a persona holding 2+ live roles, and a hat-less principal is a
-- DIFFERENT caller from the one a fixture means to exercise. `staff1.ccih` holds exactly
-- one role today, so the two forms agree — which is precisely why the omission would go
-- unnoticed until the seed gave him a second one.
select test_helpers.claims_for('00000000-0000-0000-0000-000000000003', false, 'staff');
set local role authenticated;

select lives_ok(
  $$update public.profiles set full_name = 'Controle 386' where id = auth.uid()$$,
  '3.1 CONTROL: the signed-in caller CAN update their own non-privileged column — so 3.2 is the guard firing, not RLS hiding the row or a missing grant');

select throws_ok(
  $$update public.profiles set is_admin = true where id = auth.uid()$$,
  '23514', null,
  '3.2 ⭐ a signed-in caller CANNOT self-elevate to is_admin — `authenticated` holds the column grant and `profiles_update_self` permits the row, so this guard is the ONLY thing stopping it');

select throws_ok(
  $$update public.profiles set suspended_until = now() + interval '1 day' where id = auth.uid()$$,
  '23514', null,
  '3.3 ⭐ …nor set their own `suspended_until` — `authenticated` DOES hold that column grant, so the guard''s identity arm is what answers; this is the very column `suspend_person_for` writes');

-- ⚠ MEASURED, NOT ASSUMED — and the first red run corrected this assertion. `cpf` is
-- refused at `42501` (the COLUMN GRANT), never reaching the guard: `authenticated` holds
-- UPDATE on eleven `profiles` columns and `cpf` / `date_of_birth` / `phone` are not among
-- them. WHICH LAYER ANSWERS MATTERS: someone who "fixed" the column grant would hand the
-- question to the guard (3.3's arm), not open the door — the two layers are independent
-- and both must hold. An assertion that expected 23514 here would have read as a live
-- defect while the surface was in fact doubly protected.
select throws_ok(
  $$update public.profiles set cpf = '11144477735' where id = auth.uid()$$,
  '42501', null,
  '3.4 ⭐ …and `cpf` is refused one layer EARLIER, by the column grant — the identity columns are protected twice over, and the door is what legitimately reaches past both');

reset role;
select test_helpers.reset_role_and_claims();

-- 3.5 — the doors themselves still work on the service path, which is the half that would
-- silently disappear if someone "fixed" 3.2-3.4 by moving the doors to `authenticated`.
set local role service_role;
select lives_ok(
  $$select public.update_person_fields_for(
      '00000000-0000-0000-0000-0000000000e1'::uuid,
      '00000000-0000-0000-0000-000000000003'::uuid,
      'Controle 386 Doors', null)$$,
  '3.5 ⭐ …and the SAME privileged write succeeds through the door as `service_role` — the joint property: 3.2-3.4 shut AND 3.5 open is what "service-role-only" means');
reset role;

select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000003'),
  'Controle 386 Doors',
  '3.6 …and it actually landed — a lives_ok on a door that wrote nothing would report the same green');

-- ============================================================================
-- §4 `professional_credentials` — the grant/policy asymmetry, recorded.
-- ============================================================================
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'professional_credentials'
      and cmd in ('INSERT','UPDATE','DELETE','ALL')), 0,
  '4.1 `professional_credentials` carries NO write policy — despite `authenticated` holding table-wide INSERT/UPDATE/DELETE grants, RLS lets none of it through');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'professional_credentials'), 1,
  '4.2 …and it does carry exactly ONE policy (the SELECT one), so 4.1 is not "RLS is off / the table has no policies at all"');

select is(
  (select relrowsecurity from pg_class where oid = 'public.professional_credentials'::regclass),
  true,
  '4.3 …with RLS actually ENABLED — a disabled RLS with zero write policies is the opposite of 4.1');

-- ============================================================================
-- §5 THE DELIBERATE ABSENCES — an absence cannot be defended by prose, only by an
-- assertion that reds when someone "completes the pattern".
-- ============================================================================
select is(
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('finalize_invited_person','update_person_fields','set_person_active',
                        'suspend_person','upsert_credential','delete_credential')),
  null,
  '5.1 ⭐ NO bare `authenticated` twin exists for any door — completing the `_for`/bare pair here would break every profiles door on the guard and invite the GUC "fix" that is a self-elevation hole');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'person_footprint_for'), 0,
  '5.2 ⭐ NO separate `app.person_footprint_for` helper exists — it would be in no sweep arm''s domain (census''s setof clause needs authenticated EXECUTE, which an owner-only helper lacks), so the footprint stays a CTE inside the predicate');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'audit_write_as'), 0,
  '5.3 ⭐ NO `app.audit_write_as` was minted — the actor rides in metadata, per the platform precedent; fixing actor_id ONLY here would leave the column PARTIALLY populated, which is worse for a reader than uniformly null (ruled R3)');

select * from finish();
rollback;
