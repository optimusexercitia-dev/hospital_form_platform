-- AE1.2 / AE1 close condition #2 (PA-F4) — PUBLIC EXECUTE is a DECLARED absence.
-- Migration: 20261003005300_adp_global_revoke_public_execute.sql.
--
-- ⛔ WHY THIS ASSERTS EFFECTIVE PRIVILEGE AND NOT `pg_default_acl`. Reading the rule is
-- exactly how this stayed invisible: `pg_default_acl` already carried a `public`-schema row
-- listing only postgres + service_role, which reads as "PUBLIC is not granted" and is not.
-- That row is ADDITIVE to the built-in default. The only honest instrument is to CREATE a
-- function and ask `has_function_privilege` what it actually got -- an implicit or NULL
-- `proacl` INCLUDES PUBLIC.
--
-- §1 probes new functions in both creator schemas. §2 is the vacuity control. §3 pins the
-- boundary: this governs FUTURE objects only.

begin;
select plan(9);

create function app._adp_t() returns int language sql as 'select 1';
create function public._adp_t() returns int language sql as 'select 1';

-- ── §1 a newly created function grants PUBLIC nothing ─────────────────────────
select ok(not has_function_privilege('anon', 'app._adp_t()', 'EXECUTE'),
  '1.1: a new app-schema function grants anon NO execute');
select ok(not has_function_privilege('authenticated', 'app._adp_t()', 'EXECUTE'),
  '1.2: a new app-schema function grants authenticated NO execute');
select ok(not has_function_privilege('anon', 'public._adp_t()', 'EXECUTE'),
  '1.3: a new public-schema function grants anon NO execute');
select ok(not has_function_privilege('authenticated', 'public._adp_t()', 'EXECUTE'),
  '1.4: a new public-schema function grants authenticated NO execute');

-- The empty-grantee entry `=X/owner` IS the PUBLIC grant. Assert on the ACL text too, so a
-- future privilege model that made has_function_privilege answer differently still reds.
select ok(
  coalesce(p.proacl::text, '') <> '' and p.proacl::text not like '%{=X/%' and p.proacl::text not like '%,=X/%',
  '1.5: app._adp_t carries an EXPLICIT proacl with no empty-grantee (PUBLIC) entry — '
  'a NULL proacl would mean the built-in default, which GRANTS PUBLIC')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname = '_adp_t';

select ok(
  exists (select 1 from pg_default_acl d
           where d.defaclrole = 'postgres'::regrole
             and d.defaclnamespace = 0
             and d.defaclobjtype = 'f'),
  '1.6: a GLOBAL (defaclnamespace = 0) default-ACL rule for functions exists for the '
  'postgres creator role — the IN SCHEMA form cannot remove the built-in PUBLIC default');

-- ── §2 VACUITY CONTROL ────────────────────────────────────────────────────────
-- Every §1 assertion is a negative. A probe that cannot see a grant would pass all of them
-- while measuring nothing, so grant EXECUTE explicitly and require the SAME call to notice.
grant execute on function app._adp_t() to anon;
select ok(has_function_privilege('anon', 'app._adp_t()', 'EXECUTE'),
  '2.1 [VACUITY CONTROL]: after an explicit grant the identical has_function_privilege '
  'call returns true — so §1''s falses are observations, not a stuck-false probe');
revoke execute on function app._adp_t() from anon;
select ok(not has_function_privilege('anon', 'app._adp_t()', 'EXECUTE'),
  '2.2 [VACUITY CONTROL]: and it returns to false when the grant is withdrawn');

-- ── §3 the boundary: FUTURE objects only ──────────────────────────────────────
-- ⛔ If this ever fails, someone folded the historical anon-residue sweep into a migration.
-- That sweep is FUP-APP-SCHEMA-PUBLIC-EXECUTE-IS-CONFIG-BOUNDED, a PO decision, and this
-- assertion is what makes doing it silently impossible.
select ok(has_function_privilege('anon', 'app.is_admin()', 'EXECUTE'),
  '3.1: a PRE-EXISTING app function still grants anon EXECUTE — default privileges govern '
  'future objects only, and the historical residue remains a PO decision, not a side effect');

drop function app._adp_t();
drop function public._adp_t();

select * from finish();
rollback;
