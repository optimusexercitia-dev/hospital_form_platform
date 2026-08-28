-- CNV-5 / R2-m3 — the `is_admin` true->false DEMOTION BACKSTOP.
--
-- THE FINDING (reproduced against the live catalog before this suite was written).
-- A signed-in `platform_admin` could run a plain
--     update public.profiles set is_admin = false where id = <an anchorless admin>
-- and the row would INSTANTLY satisfy `app.tenant_orphan_profiles()`'s predicate --
-- because that predicate filters `where not p.is_admin`, so the demotion is the very
-- act that MANUFACTURES the orphan.  Measured: orphans 0 -> 1, reason
-- `never_affiliated`, on both the self and the non-self path.  Nothing fired.
--
-- WHY NOTHING FIRED, AND WHY IT ONCE DID.  `20260702000000_user_registration.sql`
-- created `profiles_tenant_has_org_trg` AFTER INSERT OR UPDATE OF
-- home_organization_id, is_admin -- the `is_admin` event is exactly this arm.
-- `20261003005600` dropped it and re-attached the re-predicated function to
-- `organization_affiliations` ONLY.  Confirmed in the catalog: the sole trigger on
-- `organization_affiliations` is `org_affiliation_tenant_containment_trg` (AFTER
-- DELETE OR UPDATE OF voided_at), and `public.profiles` carries no containment arm at
-- all.  The `profiles`-side arm has had no replacement since.
--
-- REACHABILITY, all four layers measured rather than argued:
--   * RLS `profiles_admin_update` is USING `app.is_admin()` WITH CHECK `app.is_admin()`
--     -- it gates the ACTOR, never the subject, so every profile row is writable.
--   * `authenticated` HOLDS column UPDATE on `is_admin` (and on `is_active`, and on
--     `id`).  The column grant is not the protection --
--     `.claude/rules/profiles-guard-never-widened.md` says so independently.
--   * `guard_profile_privileged_columns` admits a signed-in admin for is_admin/is_active.
--   * No door writes the column, so nothing else could have caught it either.
--
-- ⚠ RUN SHAPE.  Requires `00_setup.sql` for `test_helpers`.  Expected shape
--   `Files=2, Tests=31` (30 here + `00_setup.sql`'s own one).  A shape below 31 is an
--   ERROR, never a hold.
--
-- Assertion count: 30
-- ============================================================================
begin;
select plan(30);

-- Constants.  Seed ids only; every constructed id lives in a `0400…` namespace
-- disjoint from every other suite (grepped: zero collisions), so nothing is shared
-- across cases and nothing is deleted positionally.
create or replace function pg_temp.k()
returns table (org_a uuid, platform uuid, staff1 uuid,
               d uuid, a uuid, v uuid, e uuid, p uuid)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '00000000-0000-0000-0000-0000000000b0'::uuid,  -- platform@test.local (the ACTOR)
         '00000000-0000-0000-0000-000000000003'::uuid,  -- staff1.ccih (a NON-admin)
         '00000000-0000-0000-0000-040000000001'::uuid,  -- D: admin, ANCHORLESS      -> deny
         '00000000-0000-0000-0000-040000000002'::uuid,  -- A: admin, ACTIVE anchor   -> accept
         '00000000-0000-0000-0000-040000000003'::uuid,  -- V: admin, only VOIDED     -> deny
         '00000000-0000-0000-0000-040000000004'::uuid,  -- E: admin, ENDED non-voided-> accept
         '00000000-0000-0000-0000-040000000005'::uuid;  -- P: NON-admin, anchorless  -> promotion
$$;
grant execute on function pg_temp.k() to authenticated, service_role;

-- Comment-stripped body probe: a `--` comment naming a symbol would otherwise satisfy
-- every source pin below (a `prosrc` regex matching a comment is the classic false green).
create or replace function pg_temp.src(p_schema text, p_name text)
returns text language sql stable as $$
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = p_schema and p.proname = p_name;
$$;

-- ============================================================================
-- § 0 — THE HOST'S SHAPE.  This is the ADR 0159 guard, and it is asserted, never
--       commented: an INVOKER function reading a table the caller cannot see returns
--       NO ROWS, and "no rows" here would mean "not anchorless" -> a silent
--       fail-OPEN.  The arm lives inside a DEFINER host precisely so its read of
--       `organization_affiliations` is the OWNER's read, not the caller's.
-- ============================================================================

select is(
  (select t.tgtype::text from pg_trigger t
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'guard_profile_privileged_columns_trg' and not t.tgisinternal),
  '19',
  '0.1 PRECONDITION: the host trigger is live on `profiles` and is ROW-level BEFORE '
  'UPDATE (tgtype 19 = 1 ROW + 2 BEFORE + 16 UPDATE). Every cell below is meaningless '
  'without it, and BEFORE is what lets the arm refuse rather than merely observe');

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_profile_privileged_columns'),
  true,
  '0.2 ⭐⭐ the host is SECURITY DEFINER — ADR 0166:112-113 requires a DEFINER, '
  'pinned-search_path backstop, because an INVOKER trigger reading affiliations '
  'reproduces ADR 0159''s failure mode: zero visible rows reads as "anchorless is '
  'false", turning a predicted fail-CLOSED into a silent fail-OPEN');

select is(
  (select array_to_string(p.proconfig, ',') || '|' ||
          (array_to_string(p.proconfig, ',') ~ '\yapp\y')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'guard_profile_privileged_columns'),
  'search_path=public, pg_catalog|false',
  '0.3 ⭐ the host''s search_path is pinned AND it EXCLUDES `app` — the second half is '
  'the live trap: because `app` is not on the path, the helper call MUST be '
  'schema-qualified or it raises 42883 at demotion time. That is a runtime failure on a '
  'path nothing exercises, which would read as the backstop working');

select is(
  (pg_temp.src('public','guard_profile_privileged_columns') ~ 'app\.person_is_anchorless')::text
       || '|' ||
  (pg_temp.src('public','guard_profile_privileged_columns') ~ 'organization_affiliations')::text,
  'true|false',
  '0.4 ⭐ the arm CALLS `app.person_is_anchorless` schema-qualified and does NOT inline '
  '`organization_affiliations`. Both halves matter: the first is the 0.3 trap (drop the '
  'qualification and this reds), the second is the drift shape — a second expression of '
  'the same predicate is what this phase has spent the day closing');

select is(
  (pg_temp.src('public','guard_profile_privileged_columns') ~ 'person_is_anchorless\s*\(\s*new\.id\s*\)'),
  true,
  '0.5 the subject is `new.id`, the row AS IT WILL BE — not `old.id`. `authenticated` '
  'holds column UPDATE on `profiles.id` (measured), and `tenant_orphan_profiles()` scans '
  'by `p.id`, so `new.id` is the id that would carry the orphan. A later "tidy" to '
  '`old.id` reds here instead of silently un-guarding the exotic case');

select is(
  (select p.prosecdef::text || '|' || p.provolatile::text || '|'
          || array_to_string(coalesce(p.proconfig, '{}'), ',') || '|'
          || array_to_string(coalesce(p.proacl, '{}'), ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'person_is_anchorless'),
  'true|s|search_path=app, public, pg_catalog|postgres=X/postgres',
  '0.6 the reused helper keeps its DEFINER context, STABLE volatility, pinned '
  'search_path and postgres-only EXECUTE');

select ok(
  not has_function_privilege('anon', 'app.person_is_anchorless(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'app.person_is_anchorless(uuid)', 'execute')
  and not has_function_privilege('service_role', 'app.person_is_anchorless(uuid)', 'execute'),
  '0.7 the helper is unreachable by every client role — asserted POSITIVELY via '
  'has_function_privilege, never by reading proacl for an absence. This is WHY the '
  'DEFINER host is load-bearing rather than decorative: measured, a caller impersonating '
  '`authenticated` gets `permission denied for function person_is_anchorless`');

select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'is_admin' and privilege_type = 'UPDATE'
      and grantee = 'authenticated'),
  1,
  '0.8 ⛔ THE REACHABILITY PREMISE, asserted so the whole suite cannot go vacuous: '
  '`authenticated` genuinely HOLDS column UPDATE on `is_admin`. If this grant were ever '
  'revoked, every refusal below would still be green — but answered at 42501 by the '
  'grant layer, not by the arm, and the arm could then be deleted unnoticed');

-- ============================================================================
-- § 1 — FIXTURES, and the non-vacuity controls that prove each subject is genuinely
--       in the state its cell needs.  ⛔ Asserted in the SAME transaction as the
--       refusals they license: a refusal is otherwise satisfied by a subject that
--       stopped existing.
-- ============================================================================

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated',
       x.id || '@cnv5.test', now(), now()
from (select unnest(array[(select d from pg_temp.k()), (select a from pg_temp.k()),
                          (select v from pg_temp.k()), (select e from pg_temp.k()),
                          (select p from pg_temp.k())]) as id) x;

update public.profiles set is_active = true, full_name = 'CNV5 fixture'
 where id in (select unnest(array[(select d from pg_temp.k()), (select a from pg_temp.k()),
                                  (select v from pg_temp.k()), (select e from pg_temp.k()),
                                  (select p from pg_temp.k())]));

-- D, A, V, E are admins.  P is deliberately NOT (it is the opposite-polarity subject).
update public.profiles set is_admin = true
 where id in (select unnest(array[(select d from pg_temp.k()), (select a from pg_temp.k()),
                                  (select v from pg_temp.k()), (select e from pg_temp.k())]));

-- D gets NO affiliation row at all.  The other three differ in exactly one column each.
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, voided_at, void_reason)
values
  -- A: ACTIVE anchor.
  ((select a from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', null, null, null),
  -- V: a row EXISTS but is VOIDED -> does NOT anchor (void is "was never true").
  ((select v from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', now(), 'lançamento equivocado'),
  -- E: ENDED but NON-VOIDED -> DOES anchor (ADR 0163 bound 1).
  ((select e from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', null, null),
  -- P: a non-admin who is ALREADY an orphan; the promotion subject.
  ((select p from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', now(), 'lançamento equivocado');

select is(
  (select is_admin::text || '|' || app.person_is_anchorless((select d from pg_temp.k()))::text
     from public.profiles where id = (select d from pg_temp.k())),
  'true|true',
  '1.1 ⛔ NON-VACUITY for the keystone: D genuinely WAS an admin AND is genuinely '
  'anchorless. Without both halves the refusal at 2.3 could be a wrong-arm fixture — '
  'satisfied by "not an admin, so no demotion happened" or by an anchor nobody removed');

select is(
  (select is_admin::text || '|' || app.person_is_anchorless((select a from pg_temp.k()))::text
     from public.profiles where id = (select a from pg_temp.k())),
  'true|false',
  '1.2 ⛔ NON-VACUITY for the accept: A genuinely WAS an admin and is genuinely NOT '
  'anchorless — so 2.4''s green is the arm declining to fire, not the arm being absent');

select is(
  (select (count(*) > 0)::text || '|' || app.person_is_anchorless((select v from pg_temp.k()))::text
     from public.organization_affiliations where principal_id = (select v from pg_temp.k())),
  'true|true',
  '1.3 V has affiliation rows that EXIST yet does not anchor — the VOID discriminator. '
  'A count-based fixture check would confuse "voided" with "never affiliated"');

select is(
  (select (count(*) > 0)::text || '|' || app.person_is_anchorless((select e from pg_temp.k()))::text
     from public.organization_affiliations where principal_id = (select e from pg_temp.k())),
  'true|false',
  '1.4 E is ENDED yet non-voided, and so DOES anchor — ADR 0163 bound 1. E and V differ '
  'in exactly ONE column (`voided_at`), which is what makes 2.6/2.7 a differential '
  'rather than two unrelated cells');

select is(
  (select is_admin::text || '|' || app.person_is_anchorless((select p from pg_temp.k()))::text
     from public.profiles where id = (select p from pg_temp.k())),
  'false|true',
  '1.5 P is a NON-admin who is anchorless — the opposite-polarity subject. The arm must '
  'not fire on false->true');

select is(
  (select coalesce(string_agg(profile_id::text, ',' order by profile_id), '<none>')
     from app.tenant_orphan_profiles()),
  (select p::text from pg_temp.k()),
  '1.6 ⭐ THE ORPHAN SET, PINNED AS A LIST AND NOT A COUNT: exactly P. D/A/V/E are all '
  'admins and so are excluded by `tenant_orphan_profiles()`''s `where not p.is_admin` — '
  'which is precisely why demoting one MANUFACTURES an orphan. A count would let one '
  'leave and another arrive with the gate still green');

select is(
  (select count(*)::int from public.profiles
    where id = (select platform from pg_temp.k()) and is_admin and is_active),
  1,
  '1.7 the ACTOR is a live platform_admin — so a refusal below is the arm, not a '
  'deactivated or non-admin caller being turned away by an earlier layer');

-- ============================================================================
-- § 2 — THE BEHAVIOUR, as a signed-in `platform_admin`.
-- ============================================================================

select test_helpers.claims_for((select platform from pg_temp.k()), true, 'platform_admin');
set local role authenticated;

select lives_ok(
  $$update public.profiles set full_name = 'Controle 400'
     where id = '00000000-0000-0000-0000-040000000001'$$,
  '2.1 CONTROL: the actor CAN write a non-privileged column on D — so 2.3 is the arm '
  'firing, not RLS hiding the row, a missing column grant, or a subject that is not there');

select is(
  (select full_name from public.profiles where id = (select d from pg_temp.k())),
  'Controle 400',
  '2.2 …and the control actually LANDED — a lives_ok on an update that matched zero rows '
  'would report the same green');

select throws_ok(
  $$update public.profiles set is_admin = false
     where id = '00000000-0000-0000-0000-040000000001'$$,
  'HC0RB',
  'não é possível remover a condição de administrador de plataforma sem antes registrar um vínculo organizacional para esta pessoa',
  '2.3 ⭐⭐ KEYSTONE: demoting an ANCHORLESS admin is REFUSED. ⚠ The MESSAGE is matched, '
  'not just the code, and the CODE is deliberately not `check_violation`: this guard '
  'already raises 23514 twice (identity-columns, and non-admin-actor), so a code-only '
  'assertion on 23514 could be satisfied by the WRONG arm entirely');

select lives_ok(
  $$update public.profiles set is_admin = false
     where id = '00000000-0000-0000-0000-040000000002'$$,
  '2.4 ⭐ ACCEPT: demoting an admin who DOES hold a non-voided affiliation still works. '
  'Without this cell the backstop could be a blanket LOCKOUT and every other cell would '
  'still be green');

select is(
  (select is_admin from public.profiles where id = (select a from pg_temp.k())),
  false,
  '2.5 …and the accepted demotion LANDED');

select throws_ok(
  $$update public.profiles set is_admin = false
     where id = '00000000-0000-0000-0000-040000000003'$$,
  'HC0RB', null,
  '2.6 DENY, void arm: a VOIDED affiliation does not anchor, so V is refused exactly as '
  'D is. V''s row EXISTS (1.3) — this is discrimination on `voided_at`, not on absence');

select lives_ok(
  $$update public.profiles set is_admin = false
     where id = '00000000-0000-0000-0000-040000000004'$$,
  '2.7 ACCEPT, ended arm: an ENDED but non-voided affiliation DOES anchor. ⚠ NON-VOIDED, '
  'NOT ACTIVE — narrowing the predicate to `ended_on is null` would refuse every '
  'fully-offboarded person''s demotion. E vs V is one column');

select is(
  (select is_admin from public.profiles where id = (select e from pg_temp.k())),
  false,
  '2.8 …and the ended-arm demotion LANDED');

select lives_ok(
  $$update public.profiles set is_admin = true
     where id = '00000000-0000-0000-0000-040000000005'$$,
  '2.9 ⭐ OPPOSITE POLARITY: PROMOTING an anchorless non-admin is untouched. The arm is '
  'gated on true->false, not on "is_admin changed" — without this cell, an arm that '
  'fired on ANY is_admin change would pass every other cell in this suite');

reset role;

select is(
  (select coalesce(string_agg(profile_id::text, ',' order by profile_id), '<none>')
     from app.tenant_orphan_profiles()),
  '<none>',
  '2.10 ⭐ THE INVARIANT, which is the actual point: after two ACCEPTED demotions and '
  'two REFUSED ones, no orphan was manufactured. The set is empty only because P was '
  'promoted out of it at 2.9 — so this is anchored to a positive change, not an '
  'always-empty aggregate');

-- ============================================================================
-- § 3 — THE SERVICE-ROLE BYPASS, preserved.  Migrations and seeds demote through it.
--
--     ⛔ CLEAR THE CLAIMS FIRST.  `reset role` restores the ROLE ONLY — claims are
--        transaction-scoped and survive it.  `guard_profile_privileged_columns`
--        decides the trusted path on `auth.uid() is null`, so a stale claim here
--        would send the call down the SIGNED-IN arm and this cell would measure
--        something else entirely while looking identical.
-- ============================================================================

select test_helpers.reset_role_and_claims();
set local role service_role;

select lives_ok(
  $$update public.profiles set is_admin = false
     where id = '00000000-0000-0000-0000-040000000001'$$,
  '3.1 ⭐ the service-role / `postgres` bypass still works: D — the very subject refused '
  'at 2.3 — is demotable when `auth.uid()` is NULL. Same row, same column, same value, '
  'opposite verdict: that gap IS the arm''s scope');

reset role;

select is(
  (select is_admin from public.profiles where id = (select d from pg_temp.k())),
  false,
  '3.2 …and the trusted-path demotion LANDED');

select is(
  (select coalesce(string_agg(profile_id::text, ',' order by profile_id), '<none>')
     from app.tenant_orphan_profiles()),
  (select d::text from pg_temp.k()),
  '3.3 …and it genuinely MANUFACTURED the orphan the trusted path is trusted to '
  'manufacture. This is the positive control for 2.10: the orphan set is demonstrably '
  'CAPABLE of becoming non-empty in this transaction, so 2.10''s emptiness is a '
  'measurement rather than a property of the fixture');

-- ============================================================================
-- § 4 — THE SIBLING ARM still answers.  A new arm that REPLACED the old one would
--       pass every cell above.
-- ============================================================================

select test_helpers.claims_for((select staff1 from pg_temp.k()), false, 'staff');
set local role authenticated;

select lives_ok(
  $$update public.profiles set full_name = 'Controle 400 Staff' where id = auth.uid()$$,
  '4.1 CONTROL: the non-admin caller CAN update their own non-privileged column — so '
  '4.2 is the guard, not RLS');

select throws_ok(
  $$update public.profiles set is_admin = true where id = auth.uid()$$,
  '23514', null,
  '4.2 a signed-in NON-admin still cannot touch is_admin, and is still refused at 23514 '
  '— NOT at HC0RB. The new arm sits BEHIND the actor check rather than replacing it, so '
  'the cheaper refusal still answers first');

reset role;
select test_helpers.reset_role_and_claims();

select * from finish();
rollback;
