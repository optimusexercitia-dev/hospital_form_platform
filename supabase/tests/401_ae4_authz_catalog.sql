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
-- RUN SHAPE: `Files=2, Tests=113` (112 here + 00_setup.sql's one).

begin;
select plan(112);

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
  5,
  '1.6 RLS is ENABLED on all FIVE catalog tables (Architecture Rule 1). ⚠ Was 4 until AE4.4b '
  'added authz.permission_implication_closure; updated DELIBERATELY, and the test reddening '
  'on a new table is the assertion working - a count that silently tracked reality would not '
  'notice a table added without RLS.');

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

-- ⭐ 4.8-4.9 are the SAME vacuity control for the TABLE half, and they exist because
-- 4.6/4.7 do not cover it. 4.1-4.3 are negative assertions about privileges that were
-- never granted, so a `has_table_privilege` stuck at false — or a typo'd relation name
-- resolving to something nobody can reach — would satisfy all 48 of 4.2's probes while
-- measuring nothing. Grant, observe TRUE, revoke, observe FALSE: that is what makes 4.2's
-- zero an observation rather than a constant. ⚠ USAGE on the schema is granted too,
-- because without it `has_table_privilege` reports false for a reason that has nothing to
-- do with the table grant — which is the very confound this control exists to remove.
grant usage on schema authz to anon;
grant select on authz.roles to anon;
select ok(has_table_privilege('anon', 'authz.roles', 'SELECT'),
  '4.8 VACUITY CONTROL (table half): an explicit grant DOES make authz.roles readable by '
  'anon — so 4.2''s 48 false probes are observations, not a stuck predicate');

revoke select on authz.roles from anon;
revoke usage on schema authz from anon;
select ok(
  not has_table_privilege('anon', 'authz.roles', 'SELECT')
  and not has_schema_privilege('anon', 'authz', 'USAGE'),
  '4.9 ...and revoking both closes again, restoring the posture 4.1-4.3 assert');

-- ============================================================================
-- §5 — REFERENTIAL INTEGRITY. Empty tables, so every case is CONSTRUCTED.
-- Matched pairs throughout: a violation that must be caught AND a valid row that must
-- pass. The negative alone cannot tell a working FK from a stuck deny.
-- ============================================================================

-- ⚠ `sensitivity_ceiling` is declared on EVERY row below because 20261003007130 made it
-- NOT NULL with NO DEFAULT, deliberately: `none` is the permissive value, so a default would
-- let a forgotten column classify a PHI permission as unclassified. That design choice is
-- what obliges these fixtures to state it — which is the control working, not friction.
insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind) values
  ('zzfix.read.content',  'commission_content', 'read',  'none', 'commission'),
  ('zzfix.read.phi',      'phi',                'read',  'phi', 'commission'),
  ('zzfix.write.content', 'commission_content', 'write', 'none', 'commission'),
  ('zzfix.a', 'commission_content', 'read', 'none', 'commission'),
  ('zzfix.b', 'commission_content', 'read', 'none', 'commission'),
  ('zzfix.c', 'commission_content', 'read', 'none', 'commission');

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
    from authz.permission_implication_closure i
    join authz.permissions ing on ing.code = i.implying
    join authz.permissions ied on ied.code = i.implied
   where i.implying <> i.implied
     and ing.resource_kind <> 'phi' and ied.resource_kind = 'phi';
$$;

create or replace function pg_temp.write_violations() returns int
language sql stable as $$
  select count(*)::int
    from authz.permission_implication_closure i
    join authz.permissions ing on ing.code = i.implying
    join authz.permissions ied on ied.code = i.implied
   where i.implying <> i.implied
     and ing.risk_class = 'read' and ied.risk_class in ('write', 'authority', 'irreversible');
$$;

insert into authz.permission_implications (implying, implied)
  values ('zzfix.read.content', 'zzfix.read.phi');
select authz.rebuild_implication_closure();
select is(pg_temp.phi_violations(), 1,
  '7.1 CONSTRUCTED VIOLATION: a content-read permission implying a PHI permission IS '
  'flagged (the _case_caps separation restated as a catalog property)');
delete from authz.permission_implications where implying = 'zzfix.read.content';
select authz.rebuild_implication_closure();

insert into authz.permission_implications (implying, implied)
  values ('zzfix.read.content', 'zzfix.write.content');
select authz.rebuild_implication_closure();
select is(pg_temp.write_violations(), 1,
  '7.2 CONSTRUCTED VIOLATION: a read permission implying a write permission IS flagged');
select is(pg_temp.phi_violations(), 0,
  '7.3 DISCRIMINATION CONTROL: that same read->write edge is NOT flagged by the PHI '
  'check — the two invariants are independent, not one predicate counted twice');
delete from authz.permission_implications where implying = 'zzfix.read.content';
select authz.rebuild_implication_closure();

select is(pg_temp.phi_violations(), 0,
  '7.4 the REAL edge set has no content-read -> PHI implication');
select is(pg_temp.write_violations(), 0,
  '7.5 the REAL edge set has no read -> write implication');

-- ⚠ The closure holds REFLEXIVE rows for every permission and FKs back to it, so fixture
-- permissions cannot be dropped until their closure rows are. That FK is the closure's own
-- protection against orphaned derived data, and it fires here exactly as intended.
delete from authz.permission_implication_closure where implying like 'zzfix.%' or implied like 'zzfix.%';
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
  $$insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
    values ('zzfix.bad', 'commission_content', 'catastrophic', 'none', 'commission')$$,
  '23514',
  null,
  '11.1 risk_class rejects an out-of-domain value');

select lives_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
    values ('zzfix.ok', 'commission_content', 'write', 'none', 'commission')$$,
  '11.2 POSITIVE TWIN: an in-domain risk_class is accepted');

select throws_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
    values ('zzfix.bad2', 'not_a_noun', 'read', 'none', 'commission')$$,
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

-- ⚠ The closure holds REFLEXIVE rows for every permission and FKs back to it, so fixture
-- permissions cannot be dropped until their closure rows are. That FK is the closure's own
-- protection against orphaned derived data, and it fires here exactly as intended.
delete from authz.permission_implication_closure where implying like 'zzfix.%' or implied like 'zzfix.%';
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

-- ============================================================================
-- §13 — `sensitivity_ceiling` (20261003007130, PO ruling 2026-09-01).
--
-- ⭐ NON-VACUOUS AT ZERO ROWS, like §11 and unlike §§5-7: a DOMAIN constraint is checked at
-- the TYPE level, so the violation is constructible without any pre-existing row. Paired
-- with an in-domain positive so it cannot pass by the insert failing for another reason.
-- ============================================================================

select has_column('authz', 'permissions', 'sensitivity_ceiling',
  '13.1 authz.permissions.sensitivity_ceiling exists');

select col_not_null('authz', 'permissions', 'sensitivity_ceiling',
  '13.2 ...and is NOT NULL');

select is(
  (select count(*)::int from pg_attrdef d
     join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'authz.permissions'::regclass and a.attname = 'sensitivity_ceiling'),
  0,
  '13.3 ⭐ ...and has NO DEFAULT, deliberately. `none` is the PERMISSIVE value, so a default '
  'would let an INSERT that forgets this column classify a PHI permission as unclassified '
  'while the row looks complete — the "guards that read right but fail open" shape. Every '
  'permission must DECLARE its sensitivity. ⛔ Do not "fix" a future failing insert by '
  'adding a default here; declare the value at the insert site.');

select throws_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
    values ('zzfix.s1', 'commission_content', 'read', 'top_secret', 'commission')$$,
  '23514',
  null,
  '13.4 the domain rejects an out-of-domain sensitivity value');

select lives_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
    values ('zzfix.s2', 'phi', 'read', 'class2_professional_identity', 'commission')$$,
  '13.5 POSITIVE TWIN: an in-domain value is accepted — so 13.4 is not a constraint that '
  'rejects everything. Uses `class2_professional_identity`, the value that only exists '
  'because the column''s subjects were checked before it was pinned: staff_admin reaches '
  'professional_profiles through app.can_manage_professional (ADR 0078 §B7), and a binary '
  'none/phi partition would have classified that as `none`.');

-- 13.6/13.7 — ORDERING ABSTINENCE. The column is NAMED for a ceiling but TYPED as a
-- partition: no ordering over these values is defined, and the ordering rule is the half of
-- the §8 residue that stays deferred. The name invites `<`, so the abstinence is GATED
-- rather than merely documented.
--
-- ⛔ A bare "no function compares it" assertion would be VACUOUS — zero functions reference
-- the column at all today, so the detector would find nothing and pass having checked
-- nothing. 13.6 constructs a violating subject FIRST and proves the detector sees it.
create or replace function pg_temp.ordering_violations() returns int
language sql stable as $$
  select count(*)::int
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('app', 'public')
     and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
         ~ 'sensitivity_ceiling[[:space:]]*(<|>|between)';
$$;

-- ⚠ THE PROBE'S SHAPE IS LOAD-BEARING AND THE FIRST ONE WAS WRONG. It compared via a
-- subquery — `(select sensitivity_ceiling from ...) < 'phi'` — which puts ` from` between
-- the column name and the operator, so the detector did not match it and 13.6 went RED on
-- its first run. That red was the control working: it proved the detector was too narrow
-- BEFORE 13.7's zero could be believed. The probe now uses the realistic misuse shape, a
-- direct comparison in a predicate.
--
-- ⛔ STATED BOUND, so this is not read as more than it is: the detector matches a
-- comparison operator ADJACENT to the column name. A comparison routed through an
-- intermediate variable or a subquery alias is NOT caught. 13.7 therefore means "no
-- function compares this column DIRECTLY", not "no ordering can possibly be expressed".
create function app._t401_ordering_probe() returns int language sql stable as $$
  select count(*)::int from authz.permissions where sensitivity_ceiling < 'phi';
$$;
select is(pg_temp.ordering_violations(), 1,
  '13.6 DETECTOR-VACUITY CONTROL: a function that COMPARES two sensitivity values with `<` '
  'IS found. Without this, 13.7''s zero would be the assertion that a detector finds '
  'nothing — exactly what it exists to rule out.');
drop function app._t401_ordering_probe();

select is(pg_temp.ordering_violations(), 0,
  '13.7 ⭐ ...and NOTHING in the live catalog orders this domain. The deferred half of the '
  '§8 residue — the ordering / comparison rule — stays genuinely deferred rather than being '
  'silently answered by a stray `<`. ⚠ When AE5 splits `phi` into standard/restricted and '
  'the PO rules an ordering, this assertion is the one to change DELIBERATELY.');

select is(
  (select count(*)::int from authz.permissions
    where sensitivity_ceiling = 'phi' and resource_kind <> 'phi'),
  0,
  '13.8 sensitivity and resource_kind agree on the PHI rows — the two columns are '
  'independently declared, so this cross-check catches a row that names one and not the '
  'other. ⭐ It is what upgrades AE4.1''s PHI-separation invariant from a substring test on '
  'a permission CODE (which a rename defeats silently) to a join on a COLUMN.');

-- ⚠ The closure holds REFLEXIVE rows for every permission and FKs back to it, so fixture
-- permissions cannot be dropped until their closure rows are. That FK is the closure's own
-- protection against orphaned derived data, and it fires here exactly as intended.
delete from authz.permission_implication_closure where implying like 'zzfix.%' or implied like 'zzfix.%';
delete from authz.permissions where code like 'zzfix.%';

-- ============================================================================
-- §14 - AE4.4a: the seeded catalog, and `resolution_scope_kind`.
--
-- The catalog stops being empty here. 42 permission codes + 42 `staff_admin` grants,
-- mechanically extracted from the PO-approved matrix rather than transcribed.
-- ============================================================================

select has_column('authz', 'permissions', 'resolution_scope_kind',
  '14.1 authz.permissions.resolution_scope_kind exists');

select col_not_null('authz', 'permissions', 'resolution_scope_kind',
  '14.2 ...and is NOT NULL');

select is(
  (select count(*)::int from pg_attrdef d
     join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'authz.permissions'::regclass and a.attname = 'resolution_scope_kind'),
  0,
  '14.3 ...and has NO DEFAULT. `commission` is the common value, so a default would be the '
  'permissive-looking one and a forgotten column would silently declare an ORG-scoped '
  'permission commission-scoped while the row looked complete. Same ruling as §13.3.');

select throws_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
    values ('zzfix.r1', 'commission_content', 'read', 'none', 'galaxy')$$,
  '23514', null,
  '14.4 the resolution_scope_kind domain rejects an out-of-domain value');

select throws_ok(
  $$insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind)
    values ('zzfix.r2', 'commission_content', 'read', 'none', 'capability_plane')$$,
  '23514', null,
  '14.5 ...and rejects `capability_plane` specifically. ⛔ THIS IS THE POINT OF THE SEPARATE '
  'DOMAIN: `authz.scope_kind` admits it, and a permission RESOLVING at an unreachable scope '
  'is a state nothing should be able to write. Reusing scope_kind would have allowed it.');

select is((select count(*)::int from authz.permissions), 42,
  '14.6 exactly 42 permission codes - the PO-approved matrix count (2026-09-01)');

select is(
  (select count(*)::int from authz.role_permissions where role_code = 'staff_admin'), 42,
  '14.7 staff_admin holds all 42');

select is(
  (select count(*)::int from authz.role_permissions where role_code <> 'staff_admin'), 0,
  '14.8 ...and NO other role has a grant. AE4.2: "zero role_permissions rows except '
  'staff_admin''s". AE5 substitutes the remaining ten, one at a time.');

select is(
  (select count(*)::int
     from authz.permissions pm
     join pg_proc p on p.proname = case
            when pm.code like 'org.%' and pm.code like '%.read' then 'can_read_professional_profile'
            when pm.code like 'org.%'                            then 'can_manage_professional'
            else                                                      'is_staff_admin_of_for' end
     join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'app'
    where (p.proargnames)[1] <> 'p_profile_id'          -- row 33's exception, § 19.3
      and pm.resolution_scope_kind::text <> case
            when (p.proargnames)[1] like 'p_org%'        then 'organization'
            when (p.proargnames)[1] like 'p_commission%' then 'commission'
            else '(unmapped)' end),
  0,
  '14.9 ⭐ STRONG CROSS-CHECK — UPGRADED 2026-09-01, and this is the third fact. It was a '
  'WEAK check against the code NAME (`org.%` implies organization), which § 11.1 had already '
  'rejected as a control: checking a control against its own LABEL catches DIVERGENCE but '
  'never JOINT INCORRECTNESS. It now derives the expected scope from the LEGACY GATE''s own '
  'SIGNATURE — `app.can_manage_professional(p_org uuid, ...)` takes an organization, '
  '`app.is_staff_admin_of_for(p_commission_id uuid, ...)` takes a commission — read from '
  '`pg_proc.proargnames`. Neither the matrix nor the migration authored that, so a permission '
  'whose name AND column both say organization while its gate takes a commission now reds. '
  '⚠ Upgraded here because AE4.5 builds the permission->site mapping, which is the cheapest '
  'moment it will ever be.');

select ok(
  (select count(*) from authz.permissions where sensitivity_ceiling = 'phi') > 0
  and (select count(*) from authz.permissions where sensitivity_ceiling <> 'phi') > 0,
  '14.10 ⭐ CARDINALITY CONTROL FOR §13.8 - which was VACUOUS until this migration and is now '
  'LIVE. §13.8 asserts sensitivity and resource_kind agree on the PHI rows; over zero rows it '
  'proved nothing. The catalog now holds PHI rows AND non-PHI rows, so §13.8 has a subject '
  'and discriminates. ⛔ If this ever returns false again, §13.8 has silently gone vacuous.');

select is((select count(*)::int from authz.permission_implications), 0,
  '14.11 ⚠ PREDICTED, NOT DISCOVERED: implications are STILL EMPTY after 4.4a. §§6.4/7.4/7.5 '
  'range over implication EDGES, so seeding permissions and grants does NOT give them a '
  'subject - they remain vacuous-by-construction, borrowing all their value from the '
  'constructed controls in §§6.1-6.3/7.1-7.3, until AE4.4b introduces the closure. This '
  'assertion exists so that state is PINNED rather than assumed: when 4.4b adds edges this '
  'test reds, and changing it is the deliberate act of saying the invariants went live.');

-- ⚠ The closure holds REFLEXIVE rows for every permission and FKs back to it, so fixture
-- permissions cannot be dropped until their closure rows are. That FK is the closure's own
-- protection against orphaned derived data, and it fires here exactly as intended.
delete from authz.permission_implication_closure where implying like 'zzfix.%' or implied like 'zzfix.%';
delete from authz.permissions where code like 'zzfix.%';

-- ============================================================================
-- §15 - AE4.4b: the MATERIALIZED IMPLICATION CLOSURE, and its gate.
--
-- The closure is DERIVED DATA rebuilt by authz.rebuild_implication_closure(). "Every
-- migration touching permission_implications calls it" is a CONVENTION, and a convention is
-- not a gate. §15.2 recomputes the closure recursively HERE and asserts set equality;
-- §15.3 proves that comparison can fail.
-- ============================================================================

select is(
  (select count(*)::int from authz.permission_implication_closure c
    where c.implying = c.implied),
  (select count(*)::int from authz.permissions),
  '15.1 the closure is REFLEXIVE - (X,X) for every permission. That is what lets the resolver '
  'be ONE join instead of a UNION of granted-directly and granted-by-implication.');

create or replace function pg_temp.closure_mismatch() returns int
language sql stable as $$
  with recursive walk(implying, implied) as (
    select code, code from authz.permissions
    union
    select w.implying, e.implied
      from walk w join authz.permission_implications e on e.implying = w.implied
  )
  select (select count(*) from (select implying, implied from walk
                                except select implying, implied from authz.permission_implication_closure) a)
       + (select count(*) from (select implying, implied from authz.permission_implication_closure
                                except select implying, implied from walk) b);
$$;

select is(pg_temp.closure_mismatch(), 0,
  '15.2 ⭐ THE GATE: the materialized closure equals a recursive recomputation, both '
  'directions. A stale closure is a silently WRONG authorization answer, because the '
  'resolver reads the closure and never the edges.');

delete from authz.permission_implication_closure
 where implying = 'commission.forms.edit' and implied = 'commission.forms.edit';
select cmp_ok(pg_temp.closure_mismatch(), '>', 0,
  '15.3 VACUITY CONTROL: removing ONE closure row makes §15.2 fire. Without this, §15.2 '
  'would be a comparison nobody has shown can fail.');

select is(authz.rebuild_implication_closure(), (select count(*)::int from authz.permissions),
  '15.4 rebuild restores it, returning the row count');
select is(pg_temp.closure_mismatch(), 0, '15.5 ...and §15.2 passes again');

insert into authz.permissions (code, resource_kind, risk_class, sensitivity_ceiling, resolution_scope_kind) values
  ('zzfix.i.a', 'commission_content', 'read', 'none', 'commission'),
  ('zzfix.i.b', 'commission_content', 'read', 'none', 'commission'),
  ('zzfix.i.c', 'commission_content', 'read', 'none', 'commission');
insert into authz.permission_implications (implying, implied) values
  ('zzfix.i.a', 'zzfix.i.b'), ('zzfix.i.b', 'zzfix.i.c');
select authz.rebuild_implication_closure();
select ok(
  exists (select 1 from authz.permission_implication_closure where implying = 'zzfix.i.a' and implied = 'zzfix.i.c'),
  '15.6 ⭐ the closure is TRANSITIVE, not merely direct: a->b->c yields (a,c). This is what '
  'the runtime resolver relies on to stay non-recursive (PA-F6).');
delete from authz.permission_implications where implying like 'zzfix.%';
delete from authz.permission_implication_closure where implying like 'zzfix.%' or implied like 'zzfix.%';
delete from authz.permissions where code like 'zzfix.i.%';
select authz.rebuild_implication_closure();

-- ============================================================================
-- §16 - THE FOUR GATES, each with BOTH POLARITIES.
--
-- Matrix §1.2 measured that app.has_role carries four gates at once. An adapter that
-- projects "live" rows where "live" is undefined hands the resolver a lapsed or deactivated
-- principal's grants and it answers TRUE with no error - not one door failing open, but
-- every permission at once.
--
-- §§16.1-16.7 use THIRD-PARTY checks (p_principal <> auth.uid()), which the §6A asymmetry
-- means bypass the active-role filter - isolating gates 1-3 cleanly. Gate 4 is §§16.8-16.11.
-- ============================================================================

create temp table t401_p on commit drop as
  select p.id as uid,
         (select m.commission_id from public.memberships m
           where m.principal_id = p.id and m.role = 'staff_admin' limit 1) as cid
    from public.profiles p where p.email = 'chefe.ccih@test.local';

select is((select count(*)::int from t401_p where uid is not null and cid is not null), 1,
  '16.0 FIXTURE CONTROL: chefe.ccih resolves to one principal with one staff_admin commission');

select ok(authz.has_direct_permission((select uid from t401_p), 'commission', (select cid from t401_p), 'commission.forms.edit'),
  '16.1 GATE 1+2+3 POSITIVE: a live seat, an active principal, the right commission -> TRUE');

update public.memberships set expires_at = now() - interval '1 day'
 where principal_id = (select uid from t401_p) and role = 'staff_admin';
select ok(not authz.has_direct_permission((select uid from t401_p), 'commission', (select cid from t401_p), 'commission.forms.edit'),
  '16.2 ⭐ GATE 1 NEGATIVE - an EXPIRED seat denies. Without the expires_at term the adapter '
  'would hand the resolver a lapsed coordinator''s grants and it would answer TRUE.');
update public.memberships set expires_at = null
 where principal_id = (select uid from t401_p) and role = 'staff_admin';

update public.profiles set is_active = false where id = (select uid from t401_p);
select ok(not authz.has_direct_permission((select uid from t401_p), 'commission', (select cid from t401_p), 'commission.forms.edit'),
  '16.3 GATE 3 NEGATIVE (deactivated) - app.is_active gates the WHOLE projection');
update public.profiles set is_active = true where id = (select uid from t401_p);

update public.profiles set suspended_until = now() + interval '7 days' where id = (select uid from t401_p);
select ok(not authz.has_direct_permission((select uid from t401_p), 'commission', (select cid from t401_p), 'commission.forms.edit'),
  '16.4 GATE 3 NEGATIVE (suspended) - the SAME predicate, a different column. ⚠ This is why '
  'inactive and suspended are NOT independently observable: app.is_active folds them, so a '
  'matrix cell expecting a distinguishable answer would assert something the system cannot '
  'express. Reproduced deliberately, not inherited.');
update public.profiles set suspended_until = null where id = (select uid from t401_p);

select ok(not authz.has_direct_permission((select uid from t401_p), 'commission',
    (select c.id from public.commissions c where c.id <> (select cid from t401_p) limit 1), 'commission.forms.edit'),
  '16.5 GATE 2 NEGATIVE: a foreign commission denies');

select ok(authz.has_direct_permission((select uid from t401_p), 'organization',
    (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
      where c.id = (select cid from t401_p)), 'org.professionals.manage'),
  '16.6 ⭐⭐ §11.3 THE ASCENT: an ORG-scoped permission resolves through a COMMISSION-scoped '
  'assignment. An adapter deriving resolution scope from authz.roles.allowed_scope_kind would '
  'deny this - an under-grant that looks like correct tenant isolation and therefore reads as '
  'a pass. Four approved permissions (rows 30-33) depend on it.');

select ok(not authz.has_direct_permission((select uid from t401_p), 'organization',
    (select h.organization_id from public.commissions c join public.hospitals h on h.id = c.hospital_id
      where c.id = (select cid from t401_p)), 'commission.forms.edit'),
  '16.7 ...and DESCENT is FALSE: a commission-scoped permission is not reached by asking at '
  'org scope. That is applies_to_descendants, deferred (ADR 0172 §4). ⛔ CONSEQUENCE FOR AE5: '
  'org_admin/hospital_admin substitution needs that column ruled FIRST.');

-- ---- GATE 4: the active-role filter, and its MANY-TO-MANY translation ----
-- app.has_role compares ONE role to ONE active role. Permissions are MANY-TO-MANY with
-- roles, so the faithful predicate is "held through AT LEAST ONE role that is the active
-- role". Requiring EVERY granting role to be active over-denies; ignoring WHICH role granted
-- drops the hat gate for the 151 self-check sites while looking like it implements one.
-- ⭐ NO 'set local role authenticated' HERE, AND THAT IS THE SECURITY DESIGN, NOT A SHORTCUT.
-- The first draft switched role and got 'permission denied for schema authz' — application
-- roles hold NO USAGE on authz (20261003007100), so the resolver is UNREACHABLE by them. In
-- production the DEFINER wrappers call it and the caller never touches the schema. The
-- active-role filter reads auth.uid() and app.active_role() from request.jwt.claims, which
-- test_helpers.claims_for sets independently of the database role — so these tests exercise
-- the resolver exactly as its real callers will. §18.1 is what asserts the unreachability.

-- ⛔ A PRINCIPAL CANNOT HOLD TWO ROLES AT THE SAME COMMISSION - `memberships_one_commission_role_uq`
-- is UNIQUE (principal_id, commission_id), which the first draft of this section discovered by
-- violating it. So the many-to-many case is only constructible ACROSS scopes, and building it
-- that way is better: it exercises the ASCENT and MANY-TO-MANY together. She holds
-- staff_admin@CCIH and staff@<sibling commission, same org>; both ascend to the SAME org.
create temp table t401_sib on commit drop as
  select c.id as cid
    from public.commissions c
    join public.hospitals h on h.id = c.hospital_id
   where h.organization_id = (select h2.organization_id
                                from public.commissions c2 join public.hospitals h2 on h2.id = c2.hospital_id
                               where c2.id = (select cid from t401_p))
     and c.id <> (select cid from t401_p)
   limit 1;

create temp table t401_org on commit drop as
  select h.organization_id as oid
    from public.commissions c join public.hospitals h on h.id = c.hospital_id
   where c.id = (select cid from t401_p);

insert into public.memberships (principal_id, commission_id, role)
  values ((select uid from t401_p), (select cid from t401_sib), 'staff');

select test_helpers.claims_for((select uid from t401_p), false, 'staff_admin');
select ok(authz.has_direct_permission((select uid from t401_p), 'organization', (select oid from t401_org), 'org.professionals.manage'),
  '16.8 GATE 4 POSITIVE (self-check, matching hat): active_role = staff_admin, which grants '
  'this permission -> TRUE');

select test_helpers.claims_for((select uid from t401_p), false, 'staff');
select ok(not authz.has_direct_permission((select uid from t401_p), 'organization', (select oid from t401_org), 'org.professionals.manage'),
  '16.9 ⭐ GATE 4 NEGATIVE: active_role = staff, and `staff` grants NOTHING here. She still '
  'holds the permission via staff_admin, but that hat is not on -> FALSE. ⛔ An implementation '
  'that ignores WHICH role granted the permission passes 16.8 and REDS HERE; this is the '
  'assertion that catches a dropped hat gate for the 151 self-check sites.');

-- ⭐⭐ THE DIFFERENTIAL. Exactly ONE fact changes between 16.9 and 16.10: whether `staff`
-- grants this permission. Same principal, same scope, same active_role, same everything else.
-- So 16.10's TRUE is attributable to the many-to-many path and to nothing else.
insert into authz.role_permissions (role_code, permission_code) values ('staff', 'org.professionals.manage');
select test_helpers.claims_for((select uid from t401_p), false, 'staff');
select ok(authz.has_direct_permission((select uid from t401_p), 'organization', (select oid from t401_org), 'org.professionals.manage'),
  '16.10 ⭐⭐ THE MANY-TO-MANY CASE, as a DIFFERENTIAL against 16.9. She now holds this '
  'permission through BOTH staff_admin (hat off) and staff (hat on). Answer must be TRUE - '
  'held through AT LEAST ONE ACTIVE role. ⛔ An implementation requiring EVERY granting role '
  'to be active REDS HERE, and that over-denial has NO legacy counterpart to differential '
  'against, which is why it is pinned in 4.4b rather than deferred to AE4.5. app.has_role '
  'compares ONE role to ONE active role; permissions are many-to-many, and this is where the '
  'translation is proven.');

select ok(authz.has_direct_permission(
    (select p.id from public.profiles p where p.email = 'chefe.farm@test.local'),
    'commission',
    (select m.commission_id from public.memberships m join public.profiles p on p.id = m.principal_id
      where p.email = 'chefe.farm@test.local' and m.role = 'staff_admin' limit 1),
    'commission.forms.edit'),
  '16.11 ⭐ THE ASYMMETRY ITSELF: the `staff` hat is still set, but this is a THIRD-PARTY '
  'check (principal <> auth.uid()), so the active-role filter does not apply at all and the '
  'answer is TRUE. Uniform-apply would break all 27 _for sites; never-apply would drop the '
  'gate for the 151 self-check sites. Neither uniform choice is correct (§6A).');

select test_helpers.reset_role_and_claims();
delete from authz.role_permissions where role_code = 'staff';
delete from public.memberships where principal_id = (select uid from t401_p) and role = 'staff';

-- ============================================================================
-- §17 - THE EXPLANATION: fixed composite, allowlisted typed fields [PA-F17].
-- ============================================================================

select is(
  (select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), ', ' order by a.attnum)
     from pg_attribute a join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'authz' and c.relname = 'permission_explanation' and a.attnum > 0 and not a.attisdropped),
  'granted:boolean, permission_code:text, principal_id:uuid, requested_scope_kind:text, '
  'requested_scope_id:uuid, resolution_scope_kind:text, granting_role_code:text, '
  'granting_permission_code:text, denied_reason:text',
  '17.1 ⭐ SCHEMA-POSITIVE: the composite''s EXACT attribute set and types. Codes and ids '
  'only - no jsonb, no open-ended payload. ⛔ This is the PRIMARY control; a fixture-string '
  'denylist cannot see a NEWLY ADDED field, which is precisely how a leak would arrive.');

select is(
  (authz.explain_direct_permission((select uid from t401_p), 'commission', (select cid from t401_p), 'commission.forms.edit')).denied_reason,
  'granted', '17.2 explanation of a granted permission reports `granted`');

select is(
  (authz.explain_direct_permission((select uid from t401_p), 'commission', (select cid from t401_p), 'no.such.code')).denied_reason,
  'unknown_permission', '17.3 ...and an unknown code is reported as such, not as a denial');

select is(
  (authz.explain_direct_permission((select uid from t401_p), 'commission',
     (select c.id from public.commissions c where c.id <> (select cid from t401_p) limit 1),
     'commission.forms.edit')).denied_reason,
  'scope_unreachable', '17.4 ...and an unreachable scope is distinguished from a hat problem');

create or replace function pg_temp.leaks_fixture_string(p_txt text) returns boolean
language sql immutable as $$
  select p_txt ~* '(chefe\.ccih|@test\.local|CCIH|Rede A)';
$$;

create function pg_temp.chatty_explain(p_uid uuid) returns text
language sql stable as $$
  select 'debug: principal=' || (select email from public.profiles where id = p_uid);
$$;
select ok(pg_temp.leaks_fixture_string(pg_temp.chatty_explain((select uid from t401_p))),
  '17.5 ⭐ THE STRING-NEGATIVE DETECTOR IS PROVEN ABLE TO FAIL FIRST: pointed at a '
  'deliberately chatty debug variant it FINDS the fixture string. Only now is its silence on '
  'the real explanation (17.6) evidence rather than an untested denylist.');
drop function pg_temp.chatty_explain(uuid);

select ok(
  not pg_temp.leaks_fixture_string(
    (authz.explain_direct_permission((select uid from t401_p), 'commission', (select cid from t401_p), 'commission.forms.edit'))::text),
  '17.6 SECONDARY control: the real explanation carries no fixture-identifiable string. ⚠ This '
  'is secondary to 17.1 by design - it cannot see a new field or a transformed value.');

-- ============================================================================
-- §18 - GRANTS on the AE4.4b functions. Effective privilege only, never proacl text
-- (a NULL proacl includes PUBLIC).
-- ============================================================================

select is(
  (select count(*)::int
     from unnest(array['anon','authenticated','service_role']) r
     cross join unnest(array[
       'authz.has_direct_permission(uuid,text,uuid,text)',
       'authz.explain_direct_permission(uuid,text,uuid,text)',
       'authz.assignment_facts(uuid)',
       'authz.scope_reaches(text,uuid,text,uuid)',
       'authz.rebuild_implication_closure()']) f
    where has_function_privilege(r, f, 'EXECUTE')),
  0,
  '18.1 no application role holds EXECUTE on ANY of the five AE4.4b functions (15 probes)');

grant execute on function authz.has_direct_permission(uuid,text,uuid,text) to anon;
select ok(has_function_privilege('anon', 'authz.has_direct_permission(uuid,text,uuid,text)', 'EXECUTE'),
  '18.2 VACUITY CONTROL: an explicit grant IS observable, so 18.1''s fifteen falses are '
  'observations rather than a stuck predicate');
revoke execute on function authz.has_direct_permission(uuid,text,uuid,text) from anon;
select ok(not has_function_privilege('anon', 'authz.has_direct_permission(uuid,text,uuid,text)', 'EXECUTE'),
  '18.3 ...and revoking closes it again');

-- ============================================================================
-- §19 - AE4.5 PRE-WORK: the permission->gate mapping, and the CHEAP per-permission half.
--
-- ⛔ WHY THE 42 CHEAP PROBES EXIST. The AE4.5 differential runs its full AXIS sweep for one
-- representative per legacy-equivalence class, because `staff_admin` holds ALL 42 codes, so
-- legacy (a ROLE check) and catalog (a PERMISSION check over a TOTAL mapping) are the same
-- comparison repeated 42 times on the permission axis. A partition assertion (§ 19.1) checks
-- THE MAPPING - it does NOT check the resolver's answer PER PERMISSION, and those are
-- different claims. If has_direct_permission returned false for one code specifically, the
-- partition would still be total and the representative cell would still pass.
--
-- The tempting argument is that the resolver is permission-agnostic - it looks up
-- role_permissions by code - so a per-permission difference could only come from bad seed
-- data, which the 42/42/0 migration guards already catch. That argument is probably right
-- AND IT IS STILL AN ARGUMENT; this session has watched arguments of exactly that shape
-- ("not reachable", "identically-worded", "no author to grant to") fail against measurement
-- four times. 42 cheap probes cost nothing and settle it.
--
-- ⚠ RECORDED AT THE RIGHT GRAIN: per-permission GRANT is observable today; per-permission
-- AXES are not, and will not be until AE5 gives a role a partial mapping.
-- ============================================================================

select is(
  (select count(*)::int from authz.permissions pm
    where case
            when pm.code like 'org.%' and pm.code like '%.read' then 'can_read_professional_profile'
            when pm.code like 'org.%'                            then 'can_manage_professional'
            else                                                      'is_staff_admin_of_for' end
          not in (select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'app')),
  0,
  '19.1 PARTITION IS TOTAL: every one of the 42 codes maps to a legacy gate that EXISTS in '
  'the catalog. ⛔ This checks the MAPPING, never the resolver''s per-permission answer - '
  '§ 19.4 is what checks that.');

select is(
  (select count(distinct case
     when pm.code like 'org.%' and pm.code like '%.read' then 'can_read_professional_profile'
     when pm.code like 'org.%'                            then 'can_manage_professional'
     else                                                      'is_staff_admin_of_for' end)::int
   from authz.permissions pm),
  3,
  '19.2 ...and it partitions the 42 into exactly THREE legacy-equivalence classes: '
  'is_staff_admin_of_for (38 commission codes), can_manage_professional (rows 30-32), '
  'can_read_professional_profile (row 33). ⭐ That reduction is what makes the AE4.5 axis '
  'sweep 3 x the matrix instead of 42 x - DERIVED and asserted, never assumed.');

select is((select (p.proargnames)[1] from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'app' and p.proname = 'can_read_professional_profile'),
  'p_profile_id',
  '19.3 ⚠ ROW 33''s EXCEPTION, ASSERTED RATHER THAN ASSUMED. can_read_professional_profile '
  'takes a PROFILE id, not a scope id, so § 14.9''s gate-signature cross-check cannot cover '
  'it. Its resolution_scope_kind = organization is a SECOND-ORDER derivation: the gate '
  'resolves the profile''s organization_id internally and then calls can_manage_professional. '
  '⛔ Stated so the 14.9 exclusion reads as a known bound, not an oversight.');

create or replace function pg_temp.grant_probe(p_uid uuid, p_cid uuid, p_oid uuid) returns text
language sql stable as $$
  select coalesce(string_agg(pm.code, ', ' order by pm.code), '(none)')
    from authz.permissions pm
   where not authz.has_direct_permission(
           p_uid,
           pm.resolution_scope_kind::text,
           case pm.resolution_scope_kind::text when 'organization' then p_oid else p_cid end,
           pm.code);
$$;

select is(
  pg_temp.grant_probe((select uid from t401_p), (select cid from t401_p), (select oid from t401_org)),
  '(none)',
  '19.4 ⭐ THE CHEAP HALF, ALL 42: every seeded code resolves TRUE for a staff_admin at its '
  'own base coordinate. ⛔ This is what the representative-only axis sweep would otherwise '
  'lose - a code mis-seeded, or a resolver that ever became permission-sensitive, reds HERE '
  'and NAMES ITSELF (the message lists the failing codes). ⚠ The scope is chosen from '
  'resolution_scope_kind, which § 14.9 tests separately; this assertion is about the GRANT.');

select is((select count(*)::int from authz.permissions), 42,
  '19.5 CARDINALITY CONTROL for § 19.4: the probe ranged over all 42 codes. A truncated '
  'catalog would make 19.4 pass having checked fewer.');

select is(
  pg_temp.grant_probe(
    (select p.id from public.profiles p where p.email = 'staff1.ccih@test.local'),
    (select cid from t401_p), (select oid from t401_org)),
  (select string_agg(code, ', ' order by code) from authz.permissions),
  '19.6 DISCRIMINATION CONTROL: the SAME probe against a NON-staff_admin returns ALL 42 as '
  'failures. So § 19.4''s "(none)" is an observation, not a stuck-true - the probe can '
  'return both answers.');

select * from finish();
rollback;
