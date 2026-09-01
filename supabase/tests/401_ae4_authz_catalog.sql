-- 401 — AE4 Increment 1: the `authz` catalog substrate.
-- Subjects: 20261003007100 (schema + tables) · 20261003007110 (seed) ·
--           20261003007120 (the memberships assignment binding).
-- Rulings and measurements: ADR 0172. Plan: docs/plans/authz-evolution.md § AE4.
--
-- ⛔⛔ READ THIS BEFORE ADDING OR TRUSTING AN ASSERTION HERE.
--
-- `authz.permissions`, `authz.role_permissions` and `authz.permission_implications` all
-- hold ZERO ROWS in this increment (AE4.3 seeds the first ones). So the three invariants
-- the plan requires -- referential integrity, implication acyclicity, and the PHI/write
-- separations -- would every one of them assert OVER AN EMPTY SET and pass having proven
-- nothing. AN ASSERTION OVER AN EMPTY SET IS NOT A PASS.
--
-- Therefore EVERY empty-set invariant in this file CONSTRUCTS ITS OWN SUBJECT and is
-- written as a MATCHED PAIR:
--   * a constructed VIOLATION that the check must catch, and
--   * a constructed VALID case that it must let through.
-- The negative alone cannot distinguish a working check from a stuck deny; the positive
-- alone cannot distinguish a working check from one that never fires. Sections 5, 6 and 7
-- are built that way, and each says so at its head.
--
-- ⚠ NOT `savepoint`. Fixtures are constructed with pgTAP's `throws_ok`/`lives_ok` and a
-- pg_temp helper, both of which capture the aborted subtransaction internally. The
-- standing pgtap-savepoint-discards-assertions hazard is why.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()`. Its subject is the real seeded
-- `public.memberships` population (43 rows), which bootstrap's `truncate ... cascade`
-- would destroy. Every fixture it creates is deleted BY IDENTITY (codes prefixed
-- `zzfix.`), and the whole file rolls back regardless.
--
-- RUN SHAPE: `Files=2, Tests=59` (58 here + 00_setup.sql's one).

begin;
select plan(58);

-- ============================================================================
-- §1 — the schema, the four tables, and the deny-all RLS posture.
-- ============================================================================

select has_schema('authz', '1.1 the authz schema exists');

select has_table('authz', 'roles',                   '1.2 authz.roles exists');
select has_table('authz', 'permissions',             '1.3 authz.permissions exists');
select has_table('authz', 'role_permissions',        '1.4 authz.role_permissions exists');
select has_table('authz', 'permission_implications', '1.5 authz.permission_implications exists');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'authz' and c.relkind = 'r' and c.relrowsecurity),
  4,
  '1.6 RLS is ENABLED on all four catalog tables (Architecture Rule 1)');

select is(
  (select count(*)::int from pg_policies where schemaname = 'authz'),
  0,
  '1.7 ...and ZERO policies exist on them — deny-all by design. ⛔ This assertion is the '
  'thing that turns a future well-meaning permissive policy into a RED rather than a '
  'silent widening of the catalog. If you are here because this failed, the question is '
  'not "which policy do I add to the expected count" but "why does the catalog need a '
  'client-reachable read path at all".');

-- ============================================================================
-- §2 — the integrity contract [PA-F5].
-- ============================================================================

select col_is_pk('authz', 'roles', 'code', '2.1 authz.roles PK is (code)');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'authz.roles'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) = 'UNIQUE (code, allowed_scope_kind)'),
  1,
  '2.2 ⭐ authz.roles carries UNIQUE (code, allowed_scope_kind). This looks redundant '
  'against the PK on (code) and IS NOT: a composite FK requires a unique constraint on '
  'EXACTLY its referenced column pair, so this is the target of '
  'memberships_role_scope_kind_fkey. Dropping it as cleanup breaks the binding.');

select col_is_pk('authz', 'role_permissions', array['role_code', 'permission_code'],
  '2.3 role_permissions PK is (role_code, permission_code)');

select col_is_pk('authz', 'permission_implications', array['implying', 'implied'],
  '2.4 permission_implications PK is (implying, implied)');

select has_index('authz', 'role_permissions', 'role_permissions_permission_code_idx',
  '2.5 reverse-direction index exists on role_permissions(permission_code) — the PK''s '
  'index leads on role_code, so the resolver''s by-permission lookup has none otherwise');

select has_index('authz', 'permission_implications', 'permission_implications_implied_idx',
  '2.6 reverse-direction index exists on permission_implications(implied)');

-- A helper that returns WHICH constraint fired, not merely that something did. Used
-- wherever naming the firing control is the point (§9 especially).
create or replace function pg_temp.violation_of(p_sql text) returns text
language plpgsql as $$
declare v_con text; v_state text;
begin
  execute p_sql;
  return 'NO VIOLATION';
exception when others then
  get stacked diagnostics v_con = constraint_name, v_state = returned_sqlstate;
  return coalesce(nullif(v_con, ''), '(unnamed)') || '/' || v_state;
end $$;

-- ============================================================================
-- §3 — the seed (AE4.2), and the unreachable-scope-kind device.
-- ============================================================================

select is((select count(*)::int from authz.roles), 12,
  '3.1 twelve role rows: the 10 membership-bearing roles + platform_admin + administrativo');

select is((select count(*)::int from authz.roles where state <> 'legacy'), 0,
  '3.2 ⚠⚠ TRIPWIRE, NOT AN ORDINARY ASSERTION — every role is `legacy` at the end of AE4 '
  'Increment 1. THIS TEST IS *SUPPOSED* TO GO RED AT AE4.6, when the cutover flips '
  'staff_admin to `authoritative`. If you are reading this because it failed: do not '
  '"fix" it by widening the predicate. Confirm the flip was intended, then change this '
  'assertion DELIBERATELY to name exactly which roles are non-legacy and why. A green '
  'here after cutover would mean the cutover did not happen.');

select is(
  (select array_agg(code order by code) from authz.roles
    where allowed_scope_kind in ('organization', 'hospital', 'commission')),
  (select array_agg(x order by x) from unnest(array[
     'org_admin','nsp_org_admin','hospital_admin','nsp_coordinator','staff_admin','staff',
     'pqs_member','technical_director','technical_director_deputy','quality_reviewer'
   ]) x),
  '3.3 ⭐ the roles carrying a DERIVABLE scope kind are EXACTLY the ten in '
  'memberships_role_check. ⚠ SUCCESSOR PROPERTY REQUIRED AT AE5-COMPLETE: this '
  'assertion''s right-hand side is that CHECK''s array, and that CHECK retires. Its '
  'named successor (ADR 0172) is: "the derivable set equals the set of codes with '
  'system_managed = false", which is catalog-internal and survives the retirement.');

select is(
  (select array_agg(code || '=' || allowed_scope_kind order by code) from authz.roles
    where allowed_scope_kind not in ('organization', 'hospital', 'commission')),
  array['administrativo=capability_plane', 'platform_admin=none'],
  '3.4 ⭐ the two non-membership rows carry STRUCTURALLY UNREACHABLE scope kinds. '
  'memberships.scope_kind is GENERATED and can only ever produce organization | hospital '
  '| commission | NULL, so neither row can be matched by the composite FK. This is what '
  'keeps role = ''administrativo'' out of memberships AFTER memberships_role_check '
  'retires — the safety survives the retirement without depending on it.');

select is(
  (select array_agg(code order by code) from authz.roles where system_managed),
  array['administrativo', 'platform_admin'],
  '3.5 system_managed is TRUE exactly for the two roles whose assignment does not flow '
  'through app.grant_role_impl (the only function that inserts into memberships)');

select is(
  (select array_agg(code order by code) from authz.roles where not session_selectable),
  array['administrativo'],
  '3.6 administrativo is the only non-session-selectable row: public.assume_role''s '
  'parameter is typed platform_role and cannot carry it, while all eleven role codes are '
  'accepted (platform_admin via its profiles.is_admin branch)');

-- ============================================================================
-- §4 — grants. EFFECTIVE PRIVILEGE ONLY, never relacl text.
--
-- 4.5-4.7 extend AE1.2 (20261003005300) to a schema that did not exist when it ran: its
-- header PREDICTED it would cover `authz`; this MEASURES it. A NULL proacl includes
-- PUBLIC, so reading the ACL instead of probing the privilege is what makes that class
-- of hole invisible.
-- ============================================================================

select is(
  (select array_agg(r order by r) from unnest(array['anon','authenticated','service_role']) r
    where has_schema_privilege(r, 'authz', 'USAGE')),
  null,
  '4.1 no application role holds USAGE on schema authz — without it none can even name an '
  'object here');

select is(
  (select count(*)::int
     from unnest(array['anon','authenticated','service_role']) r
     cross join unnest(array['authz.roles','authz.permissions','authz.role_permissions',
                             'authz.permission_implications']) t
     cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p
    where has_table_privilege(r, t, p)),
  0,
  '4.2 no application role holds ANY DML or SELECT on ANY of the four catalog tables '
  '(3 roles x 4 tables x 4 privileges = 48 probes, all false)');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'authz' and c.relkind = 'r' and c.relacl is not null),
  0,
  '4.3 all four tables carry a NULL relacl — for TABLES that means owner-only. ⛔ Do not '
  'transplant this reasoning to FUNCTIONS, where a NULL proacl INCLUDES PUBLIC.');

select ok(
  not has_schema_privilege('anon', 'authz', 'CREATE')
  and not has_schema_privilege('authenticated', 'authz', 'CREATE'),
  '4.4 no application role may CREATE in schema authz');

create function authz._t401_probe() returns int language sql immutable as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'authz._t401_probe()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'authz._t401_probe()', 'EXECUTE'),
  '4.5 ⭐ a function created in `authz` carries NO PUBLIC EXECUTE. This MEASURES what '
  'AE1.2 (20261003005300) could only PREDICT — its global `for role postgres` default '
  'reaches this schema, so 20261003007100 correctly issues no ADP statement of its own. '
  'The `IN SCHEMA` form would have been a no-op that read as a control.');

grant execute on function authz._t401_probe() to anon;
select ok(has_function_privilege('anon', 'authz._t401_probe()', 'EXECUTE'),
  '4.6 VACUITY CONTROL: an explicit grant DOES make the probe executable — so 4.5 is an '
  'observation, not a stuck-false predicate');

revoke execute on function authz._t401_probe() from anon;
select ok(not has_function_privilege('anon', 'authz._t401_probe()', 'EXECUTE'),
  '4.7 ...and revoking it closes again');

drop function authz._t401_probe();

-- ============================================================================
-- §5 — REFERENTIAL INTEGRITY. Empty tables, so every case is CONSTRUCTED.
-- Matched pairs throughout: a violation that must be caught AND a valid row that must
-- pass. The negative alone cannot tell a working FK from a stuck deny.
-- ============================================================================

insert into authz.permissions (code, resource_kind, risk_class) values
  ('zzfix.read.content',  'commission_content', 'read'),
  ('zzfix.read.phi',      'phi',                'read'),
  ('zzfix.write.content', 'commission_content', 'write'),
  ('zzfix.a', 'commission_content', 'read'),
  ('zzfix.b', 'commission_content', 'read'),
  ('zzfix.c', 'commission_content', 'read');

select throws_ok(
  $$insert into authz.role_permissions (role_code, permission_code)
    values ('no_such_role', 'zzfix.read.content')$$,
  '23503',
  null,
  '5.1 role_permissions rejects an unknown role_code');

select throws_ok(
  $$insert into authz.role_permissions (role_code, permission_code)
    values ('staff_admin', 'no.such.permission')$$,
  '23503',
  null,
  '5.2 role_permissions rejects an unknown permission_code');

select lives_ok(
  $$insert into authz.role_permissions (role_code, permission_code)
    values ('staff_admin', 'zzfix.read.content')$$,
  '5.3 POSITIVE TWIN: a valid (role, permission) pair IS accepted — without this, 5.1 and '
  '5.2 could both be satisfied by a constraint that rejects everything');

select throws_ok(
  $$insert into authz.permission_implications (implying, implied)
    values ('zzfix.a', 'no.such.permission')$$,
  '23503',
  null,
  '5.4 permission_implications rejects an unknown endpoint');

select throws_ok(
  $$insert into authz.permission_implications (implying, implied)
    values ('zzfix.a', 'zzfix.a')$$,
  '23514',
  null,
  '5.5 CHECK (implying <> implied) rejects a self-implication — the 1-cycle. ⚠ Every '
  'LONGER cycle is §6''s job, and is migration-gate law rather than a constraint.');

delete from authz.role_permissions where role_code = 'staff_admin' and permission_code = 'zzfix.read.content';

-- ============================================================================
-- §6 — IMPLICATION ACYCLICITY.
--
-- ⚠ STATED AS REQUIRED BY THE PLAN: acyclicity is MIGRATION-GATE LAW, NOT A TRIGGER. The
-- database will accept a cycle at runtime without complaint; this section is the only
-- thing in the system that refuses one, and it runs at the gate. A deliberate, documented
-- gap -- not an oversight to "fix" with a trigger without re-opening the plan decision.
--
-- The real edge set is EMPTY, so a bare "no cycles found" would pass having asserted
-- nothing. 6.1 and 6.2 PROVE THE DETECTOR CAN FIND SOMETHING before 6.3 believes it when
-- it finds nothing.
-- ============================================================================

create or replace function pg_temp.cycle_count() returns int
language sql stable as $$
  with recursive walk(root, node, depth) as (
    select implying, implied, 1 from authz.permission_implications
    union all
    select w.root, e.implied, w.depth + 1
      from walk w join authz.permission_implications e on e.implying = w.node
     where w.depth < 32
  )
  select count(distinct root)::int from walk where node = root;
$$;

insert into authz.permission_implications (implying, implied) values
  ('zzfix.a', 'zzfix.b'), ('zzfix.b', 'zzfix.a');
select is(pg_temp.cycle_count(), 2,
  '6.1 DETECTOR-VACUITY CONTROL: the recursive check FINDS a constructed 2-cycle '
  '(a->b->a). Without this, 6.3''s "no cycles" would be the assertion that a detector '
  'finds nothing — exactly what it exists to rule out.');
delete from authz.permission_implications where implying in ('zzfix.a','zzfix.b');

insert into authz.permission_implications (implying, implied) values
  ('zzfix.a', 'zzfix.b'), ('zzfix.b', 'zzfix.c'), ('zzfix.c', 'zzfix.a');
select is(pg_temp.cycle_count(), 3,
  '6.2 ...and finds a constructed 3-cycle, so it is not merely matching the reciprocal '
  'pair that CHECK (implying <> implied) already half-covers');
delete from authz.permission_implications where implying in ('zzfix.a','zzfix.b','zzfix.c');

insert into authz.permission_implications (implying, implied) values ('zzfix.a', 'zzfix.b');
select is(pg_temp.cycle_count(), 0,
  '6.3 ...and finds NOTHING on an acyclic edge set — so the detector discriminates '
  'rather than always alarming');
delete from authz.permission_implications where implying = 'zzfix.a';

select is(pg_temp.cycle_count(), 0,
  '6.4 the REAL implication set is acyclic (trivially, at zero rows — this assertion is '
  'meaningful only because 6.1-6.3 proved the detector works)');

-- ============================================================================
-- §7 — THE PHI / WRITE SEPARATION INVARIANTS, as data tests.
-- Same construct-then-detect discipline as §6, for the same reason.
-- ============================================================================

create or replace function pg_temp.phi_violations() returns int
language sql stable as $$
  select count(*)::int
    from authz.permission_implications i
    join authz.permissions ing on ing.code = i.implying
    join authz.permissions ied on ied.code = i.implied
   where ing.resource_kind <> 'phi' and ied.resource_kind = 'phi';
$$;

create or replace function pg_temp.write_violations() returns int
language sql stable as $$
  select count(*)::int
    from authz.permission_implications i
    join authz.permissions ing on ing.code = i.implying
    join authz.permissions ied on ied.code = i.implied
   where ing.risk_class = 'read' and ied.risk_class in ('write', 'authority', 'irreversible');
$$;

insert into authz.permission_implications (implying, implied)
  values ('zzfix.read.content', 'zzfix.read.phi');
select is(pg_temp.phi_violations(), 1,
  '7.1 CONSTRUCTED VIOLATION: a content-read permission implying a PHI permission IS '
  'flagged (the _case_caps separation restated as a catalog property)');
delete from authz.permission_implications where implying = 'zzfix.read.content';

insert into authz.permission_implications (implying, implied)
  values ('zzfix.read.content', 'zzfix.write.content');
select is(pg_temp.write_violations(), 1,
  '7.2 CONSTRUCTED VIOLATION: a read permission implying a write permission IS flagged');
select is(pg_temp.phi_violations(), 0,
  '7.3 DISCRIMINATION CONTROL: that same read->write edge is NOT flagged by the PHI '
  'check — the two invariants are independent, not one predicate counted twice');
delete from authz.permission_implications where implying = 'zzfix.read.content';

select is(pg_temp.phi_violations(), 0,
  '7.4 the REAL edge set has no content-read -> PHI implication');
select is(pg_temp.write_violations(), 0,
  '7.5 the REAL edge set has no read -> write implication');

delete from authz.permissions where code like 'zzfix.%';

-- ============================================================================
-- §8 — THE MATCH FULL DIFFERENTIAL, on a SCRATCH TABLE.
--
-- ⛔ THIS RUNS ON A SCRATCH TABLE, AND THAT IS THE POINT. On the real
-- public.memberships the garbage row is UNREACHABLE -- and not because of this FK
-- (memberships_role_check and memberships_scope_shape both reject it first, and
-- scope_kind being GENERATED means NULL requires all three scope columns NULL). A
-- MATCH FULL assertion run there would go green while measuring memberships_role_check.
-- "Not reachable" is not "protected".
--
-- So the SEMANTICS are proven here, on a table shaped like memberships MINUS the legacy
-- CHECKs -- the only place the two match types actually differ -- and the DEPLOYED
-- constraint's match type is asserted from the catalog in 8.4.
-- ============================================================================

create schema t401scratch;
create table t401scratch.m (
  id int primary key,
  organization_id int, hospital_id int, commission_id int,
  role text not null,
  scope_kind authz.scope_kind generated always as (
    case when commission_id   is not null then 'commission'
         when hospital_id     is not null then 'hospital'
         when organization_id is not null then 'organization' end
  ) stored
);

alter table t401scratch.m add constraint fk_simple
  foreign key (role, scope_kind) references authz.roles (code, allowed_scope_kind);

select lives_ok(
  $$insert into t401scratch.m (id, organization_id, hospital_id, commission_id, role)
    values (1, null, null, null, 'TOTALLY_FAKE_ROLE')$$,
  '8.1 ⭐⭐ THE FINDING. Under the DEFAULT (MATCH SIMPLE) the composite FK ACCEPTS a row '
  'whose role does not exist in the catalog at all, because a NULL scope_kind satisfies '
  'it VACUOUSLY. This is the "guard that reads right but fails open" shape: the '
  'constraint is present, named, and enforcing nothing for scopeless rows.');

alter table t401scratch.m drop constraint fk_simple;
delete from t401scratch.m;
alter table t401scratch.m add constraint fk_full
  foreign key (role, scope_kind) references authz.roles (code, allowed_scope_kind) match full;

select throws_ok(
  $$insert into t401scratch.m (id, organization_id, hospital_id, commission_id, role)
    values (2, null, null, null, 'TOTALLY_FAKE_ROLE')$$,
  '23503',
  null,
  '8.2 ...and MATCH FULL REJECTS the identical row. This is the differential: the two '
  'assertions differ ONLY in the match type, so MATCH FULL is measurably the thing doing '
  'the work rather than an incidental sibling.');

select lives_ok(
  $$insert into t401scratch.m (id, organization_id, hospital_id, commission_id, role)
    values (3, null, null, 900, 'staff_admin')$$,
  '8.3 POSITIVE TWIN: MATCH FULL still accepts a valid fully-scoped row — so 8.2 is not a '
  'constraint that rejects everything');

drop schema t401scratch cascade;

select is(
  (select confmatchtype::text from pg_constraint
    where conrelid = 'public.memberships'::regclass
      and conname = 'memberships_role_scope_kind_fkey'),
  'f',
  '8.4 ⭐ THE DEPLOYED constraint is MATCH FULL (confmatchtype = ''f''). §§8.1-8.3 prove '
  'why the match type matters; THIS asserts the migration actually shipped the right one. '
  'Shipping MATCH SIMPLE reds here — which is the red this keystone was observed in '
  'before the migration was corrected.');

-- ============================================================================
-- §9 — FK EXISTENCE, on the REAL public.memberships. This half IS constructible.
--
-- ⚠ STATED EXPLICITLY, because claiming otherwise is the same error one level down:
-- THIS IS NOT MATCH-FULL-SPECIFIC. Both key columns are non-NULL in the row below, and
-- with both non-NULL, MATCH SIMPLE would reject it identically. What this section proves
-- is that the FK EXISTS AND FIRES on the real table for a row the legacy CHECKs let
-- through. The match-type evidence is §8's alone.
--
-- Target: technical_director_deputy, chosen because it has exactly ONE seeded membership
-- row -- the smallest fixture that can vacate a catalog referent.
-- ============================================================================

create temp table t401_tdd on commit drop as
  select principal_id, organization_id, hospital_id, granted_by
    from public.memberships where role = 'technical_director_deputy' limit 1;

select is((select count(*)::int from t401_tdd), 1,
  '9.1 FIXTURE CONTROL: exactly one seeded technical_director_deputy membership was '
  'captured. A zero here would make 9.2-9.4 assert over an empty fixture.');

delete from public.memberships where role = 'technical_director_deputy';
delete from authz.roles where code = 'technical_director_deputy';

select is(
  pg_temp.violation_of(
    'insert into public.memberships (principal_id, organization_id, hospital_id, role, granted_by) '
    'select principal_id, organization_id, hospital_id, ''technical_director_deputy'', granted_by '
    'from t401_tdd'),
  'memberships_role_scope_kind_fkey/23503',
  '9.2 ⭐ with the catalog row VACATED, a membership row that passes BOTH legacy CHECKs '
  '(valid role, correct org+hospital scope shape) is rejected — and the helper names '
  'WHICH constraint fired, so this cannot silently be measuring memberships_role_check. '
  'This is the FK doing work no other control does.');

insert into authz.roles (code, allowed_scope_kind, system_managed, session_selectable, state)
  values ('technical_director_deputy', 'hospital', false, true, 'legacy');

select is(
  pg_temp.violation_of(
    'insert into public.memberships (principal_id, organization_id, hospital_id, role, granted_by) '
    'select principal_id, organization_id, hospital_id, ''technical_director_deputy'', granted_by '
    'from t401_tdd'),
  'NO VIOLATION',
  '9.3 POSITIVE TWIN: restoring the catalog row lets the identical insert through. So '
  '9.2 measured the missing referent, not some unrelated defect in the fixture row.');

-- ============================================================================
-- §10 — REACHABILITY, ASSERTED AND NAMED (not argued in prose).
--
-- A Gate AE4 record reading "MATCH FULL keystone green" would claim a control that today
-- measures a different one. This section writes down WHICH control actually fires, so
-- that by AE5 nobody has to remember.
-- ============================================================================

select is(
  pg_temp.violation_of(
    'insert into public.memberships (principal_id, commission_id, role) '
    'select principal_id, null, ''TOTALLY_FAKE_ROLE'' from t401_tdd'),
  'memberships_role_check/23514',
  '10.1 ⚠ TODAY the garbage-role row is rejected by memberships_role_check FIRST — not by '
  'the new FK. The FK never gets a chance to speak.');

select is(
  pg_temp.violation_of(
    'insert into public.memberships (principal_id, role) '
    'select principal_id, ''staff_admin'' from t401_tdd'),
  'memberships_scope_shape/23514',
  '10.2 ...and a KNOWN role with all-NULL scope columns is rejected by '
  'memberships_scope_shape, again before the FK. Together, 10.1 and 10.2 are why §8''s '
  'differential had to run on a scratch table: on the real table the MATCH SIMPLE hole is '
  'unreachable, and "not reachable" is not "protected".');

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.memberships'::regclass
      and conname in ('memberships_role_check', 'memberships_scope_shape')),
  2,
  '10.3 ⛔ BOTH legacy CHECKs are STILL PRESENT. They retire only at AE5-complete (ADR '
  '0162 §2 item 4), and that retirement is the event that ends the interim. Until then '
  'the catalog is AUTHORITY-ELECT and the FK''s value is PROSPECTIVE: it is the control '
  'that SURVIVES their removal. ⚠ When this assertion is changed to 0, MATCH FULL stops '
  'being doubly covered and §8 becomes the only evidence for it — do not delete §8 then.');

-- ============================================================================
-- §11 — the classification DOMAINs.
--
-- ⭐ Unlike §§5-7 these are NON-VACUOUS AT ZERO ROWS, because a domain constraint is
-- checked at the TYPE level: the violation is constructible without any pre-existing row.
-- Each is paired with an in-domain positive so it cannot pass by the insert failing for
-- an unrelated reason.
-- ============================================================================

select throws_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class)
    values ('zzfix.bad', 'commission_content', 'catastrophic')$$,
  '23514',
  null,
  '11.1 risk_class rejects an out-of-domain value');

select lives_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class)
    values ('zzfix.ok', 'commission_content', 'write')$$,
  '11.2 POSITIVE TWIN: an in-domain risk_class is accepted');

select throws_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class)
    values ('zzfix.bad2', 'not_a_noun', 'read')$$,
  '23514',
  null,
  '11.3 resource_kind rejects an out-of-domain value');

select throws_ok(
  $$insert into authz.roles (code, allowed_scope_kind, system_managed, session_selectable)
    values ('zzfix_role', 'galaxy', false, false)$$,
  '23514',
  null,
  '11.4 scope_kind rejects an out-of-domain value');

select throws_ok(
  $$insert into authz.roles (code, allowed_scope_kind, system_managed, session_selectable, state)
    values ('zzfix_role2', 'commission', false, false, 'provisional')$$,
  '23514',
  null,
  '11.5 role_state rejects an out-of-domain value');

delete from authz.permissions where code like 'zzfix.%';

-- ============================================================================
-- §12 — the AE4.5 generator's view of the catalog, checked AGAINST the catalog.
--
-- The generator (scripts/gen-authz-matrix-cells.mjs) needs to know which roles exist, and
-- it cannot reach the database at lint time. So the axes JSON declares the role list and
-- THIS SECTION is what stops that declaration drifting away from the thing it describes —
-- using a gate that already runs, rather than a Node script that would need DB access.
--
-- `npm run lint:authz-vectors` proves the .psql matches the JSON; this proves the JSON
-- matches the DATABASE. Neither alone closes the loop.
-- ============================================================================

\ir vectors/authz_matrix_cells.psql

select is(
  (select array_agg(code order by code) from authz_matrix_catalog_roles),
  (select array_agg(code order by code) from authz.roles),
  '12.1 the AE4.5 axes file''s catalog-role list EQUALS authz.roles. Adding a role to the '
  'catalog without adding it to the matrix axes reds here.');

select ok(
  (select count(*) from authz_matrix_cells) > 0
  and (select count(distinct operation) from authz_matrix_cells) > 1,
  '12.2 CARDINALITY CONTROL: the generated cell enumeration is populated and covers more '
  'than one operation. An empty or single-valued fixture would let a future differential '
  'suite iterate it and pass having asserted nothing.');

select is(
  (select count(*)::int from authz_matrix_cells where role not in (select code from authz.roles)),
  0,
  '12.3 every enumerated cell names a role that exists in the catalog');

select * from finish();
rollback;
