-- =============================================================================
-- ADR 0094 W2 — public.session_context(), expiry defusal, and the role-completeness
-- grid.
--
-- §1 the RPC's contract, exercised AS `authenticated` through the surface the product
--    calls (authz-handoff §7.14 — auditing the base table and inferring the RPC is
--    how this program shipped bugs);
-- §2 the expiry invariant: nothing in the catalog WRITES memberships.expires_at, so
--    the divergence W2 defuses cannot be re-armed without this suite going red;
-- §3 the completeness grid (T2.5): the role vocabulary is read LIVE from
--    memberships_role_check, and every role must have a grant arm, a revoke arm and a
--    declared scope. Adding a role to the CHECK without wiring it reds §3 by
--    construction — that is the ADR-0094 decision-6 checklist, executable.
-- =============================================================================

begin;
select plan(25);

update app.feature_flags set enabled = true where key in ('audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,  (v->>'sa_x')::uuid  as sa_x,
         (v->>'st_x')::uuid   as st_x,   (v->>'st_x2')::uuid as st_x2,
         (v->>'comm_x')::uuid as comm_x, (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,  (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- =============================================================================
-- §1 — THE RPC CONTRACT
-- =============================================================================

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='session_context'),
  true,
  '1.1 session_context is SECURITY DEFINER (its ACL is the whole boundary)');

select is(
  (select array_to_string(proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='session_context'),
  'search_path=app, public, pg_catalog',
  '1.2 ...with a pinned search_path');

-- anon/PUBLIC must not hold EXECUTE: a DEFINER function reading profiles + every
-- membership row is exactly what an unauthenticated caller must not reach.
select is(
  (select count(*)::int from unnest(array['anon','public']) as r(who)
    where has_function_privilege(r.who, 'public.session_context()', 'EXECUTE')),
  0,
  '1.3 neither anon nor PUBLIC holds EXECUTE on session_context');

select ok(
  has_function_privilege('authenticated', 'public.session_context()', 'EXECUTE'),
  '1.4 POSITIVE TWIN: authenticated DOES hold EXECUTE (the probe distinguishes roles)');

-- Promote st_x so the caller under test holds a commission grant with a known role.
insert into public.memberships (principal_id, commission_id, role)
values ((select st_x from k), (select comm_x from k), 'staff_admin')
on conflict (principal_id, commission_id) where commission_id is not null
do update set role = excluded.role;
-- ...and a hospital-tier grant, so all three scope shapes are exercised.
insert into public.memberships (principal_id, organization_id, hospital_id, role)
values ((select st_x from k), (select org_b from k), (select hosp_b from k), 'hospital_admin')
on conflict do nothing;

select test_helpers.claims_for((select st_x from k), false, 'staff_admin');
set local role authenticated;

select is(
  (select jsonb_array_length(public.session_context()->'grants')),
  2,
  '1.5 the caller sees BOTH of their own grants (commission + hospital tier)');

select is(
  (select public.session_context()->'profile'->>'full_name'),
  (select full_name from public.profiles where id = (select st_x from k)),
  '1.6 the profile envelope carries the caller''s own profile');

-- Scope references resolve, per tier.
select is(
  (select g->'commission'->>'slug'
     from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'staff_admin' limit 1),
  -- commissions.slug is citext; jsonb ->> yields text, so cast to compare.
  (select slug::text from public.commissions where id = (select comm_x from k)),
  '1.7 a commission grant carries its commission reference');

select is(
  (select g->'commission'->'organization'->>'id'
     from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'staff_admin' limit 1),
  (select organization_id::text from public.commissions where id = (select comm_x from k)),
  '1.8 ...nested under its parent organization (the shell resolves the org with no second hop)');

select is(
  (select g->'hospital'->>'organization_id'
     from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'hospital_admin' limit 1),
  (select org_b::text from k),
  '1.9 a hospital grant carries hospital + parent org');

reset role;

-- ── Isolation: the snapshot is the CALLER's, not a global read ────────────────
-- st_x2 is a member of comm_x too, so a leak here would be invisible to a
-- "does it return rows" check.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'hospital_admin'),
  0,
  '1.10 ISOLATION: another principal''s hospital grant is not visible');

select ok(
  (select jsonb_array_length(public.session_context()->'grants')) > 0,
  '1.11 POSITIVE TWIN: ...but st_x2 still sees their OWN grants (not an empty-for-everyone read)');
reset role;

-- ── The expiry filter, the whole point of W2 ─────────────────────────────────
-- Injected fixture: no product path can set expires_at (§2 pins that), so this
-- state is reachable only by direct DML — which is precisely why the divergence
-- went unnoticed.
update public.memberships set expires_at = now() - interval '1 day'
 where principal_id = (select st_x from k) and commission_id = (select comm_x from k);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'staff_admin'),
  0,
  '1.12 EXPIRY: an expired grant is absent from the session snapshot');

-- Agreement with the DB predicate is the actual requirement — a snapshot that
-- filtered expiry while the predicates did not would be a NEW divergence, not a fix.
select is(
  (select app.is_member_of((select comm_x from k))),
  false,
  '1.13 AGREEMENT: app.is_member_of denies the same expired grant');
reset role;

-- POSITIVE TWIN: a FUTURE expiry is still effective. Without this, a filter written
-- as `expires_at is null` (dropping every dated grant) would pass 1.12 and 1.13.
update public.memberships set expires_at = now() + interval '30 days'
 where principal_id = (select st_x from k) and commission_id = (select comm_x from k);

select test_helpers.claims_for((select st_x from k), false, 'staff_admin');
set local role authenticated;
select is(
  (select count(*)::int from jsonb_array_elements(public.session_context()->'grants') g
    where g->>'role' = 'staff_admin'),
  1,
  '1.14 POSITIVE TWIN: a grant expiring in the FUTURE is still effective');
select is(
  (select app.is_member_of((select comm_x from k))),
  true,
  '1.15 POSITIVE TWIN: ...and app.is_member_of agrees');
reset role;

-- ── T2.3(a): the expiry-change audit arm ─────────────────────────────────────
select is(
  (select count(*)::int from public.audit_log
    where action = 'membership.expiry_changed' and entity_type = 'membership'),
  2,
  '1.16 T2.3: each expires_at change emitted a membership.expiry_changed audit row');

select ok(
  (select metadata ? 'expires_at_before' and metadata ? 'expires_at_after'
     from public.audit_log where action = 'membership.expiry_changed'
     order by seq desc limit 1),
  '1.17 T2.3: ...carrying before/after timestamps (PHI-free, self-contained)');

-- Restore the permanent grant for §3.
update public.memberships set expires_at = null
 where principal_id = (select st_x from k) and commission_id = (select comm_x from k);

-- =============================================================================
-- §2 — THE EXPIRY INVARIANT (T2.3b, QO·A-recut): exactly ONE sanctioned writer
-- =============================================================================
--
-- Comment-stripped, because a prosrc regex happily matches a `-- ... expires_at ...`
-- line and would report a writer that does not exist (authz-handoff §7.2). Read
-- filters (`expires_at is null or expires_at > now()`) are expected and allowed; what
-- must not exist is an assignment or an insert naming the column.
-- QO·A RECUT (ADR 0100 D9, migration 20260911000200): W2's "nothing writes
-- expires_at" contract deliberately gains its FIRST sanctioned writer — the
-- grant kernel's INSERT path. The invariant is now a SINGLETON set, which is a
-- sharper pin than zero: a second writer (or losing the kernel's) reds this.
select is(
  (select coalesce(string_agg(n.nspname||'.'||p.proname, ', ' order by p.proname), '')
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app','public')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'memberships'
      and (regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~* 'set\s+expires_at'
        or regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~* 'insert\s+into\s+public\.memberships[^;]*expires_at')),
  'app.grant_role_impl',
  '2.1 T2.3b/QO·A: app.grant_role_impl is the ONLY expires_at writer in app/public (the D9 setter — and nothing else)');

-- The probe must be capable of finding a writer. Plant one, confirm it is seen,
-- drop it — otherwise 2.1 is a regex that matches nothing for the wrong reason.
create or replace function app._t292_expiry_writer() returns void language plpgsql as $w$
begin
  update public.memberships set expires_at = now() where false;
end; $w$;

-- ⭐ RECUT 2026-08-07 (QO·FUP F1 / ADR 0102). This was `count = 1` — the planted
-- writer alone — because the sanctioned writer only matched 2.1's OTHER disjunct
-- (`insert into public.memberships ... expires_at`). F1's extend-on-regrant adds
-- `on conflict ... DO UPDATE SET expires_at = ...`, so `app.grant_role_impl` now
-- matches the `set` half too and the honest count is 2. Asserted as the NAMED SET
-- rather than a count: `2` would also be satisfied by the planted writer plus some
-- unrelated third writer, which is precisely what this file exists to catch.
select is(
  (select coalesce(string_agg(n.nspname||'.'||p.proname, ', ' order by p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app','public')
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'memberships'
      and regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~* 'set\s+expires_at'),
  'app._t292_expiry_writer, app.grant_role_impl',
  '2.2 POSITIVE TWIN: the probe DOES detect a planted expiry writer — and sees EXACTLY it plus the one sanctioned door (F1: the DO UPDATE SET arm)');

drop function app._t292_expiry_writer();

-- QO·A RECUT (D9): the GRANT door alone carries the p_expires_at setter; the
-- revoke path deliberately does not (revocation is delete — D13 keeps it so).
-- Structural, not textual, as before.
select is(
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('grant_role','revoke_role')
      and pg_get_function_identity_arguments(p.oid) ~* 'expir'),
  'grant_role',
  '2.3 T2.3b/QO·A: EXACTLY the grant door takes an expiry argument — revoke_role must never grow one');

-- =============================================================================
-- §3 — THE ROLE-COMPLETENESS GRID (T2.5)
-- =============================================================================
--
-- The vocabulary is read from the LIVE CHECK constraint, never hand-listed. The
-- scope map below is the hand-maintained half ON PURPOSE: adding a role to the CHECK
-- without adding it here reds 3.1, which is the checklist doing its job.
create temp table role_vocab on commit drop as
select (regexp_matches(pg_get_constraintdef(oid), '''([a-z_]+)''::text', 'g'))[1] as role
from pg_constraint
where conrelid = 'public.memberships'::regclass and conname = 'memberships_role_check';

create temp table role_scope (role text primary key, scope_type text) on commit drop;
insert into role_scope (role, scope_type) values
  ('org_admin',      'organization'),
  ('nsp_org_admin',  'organization'),
  ('hospital_admin', 'hospital'),
  ('nsp_coordinator','hospital'),
  ('pqs_member',     'hospital'),
  ('staff_admin',    'commission'),
  ('staff',          'commission'),
  -- ADR 0094 W4/T4.1. These two entries are the checklist working as designed:
  -- adding the roles to memberships_role_check RED-ed 3.1 until they were declared
  -- here AND given grant/revoke arms in the kernel (3.3/3.4). Note 3.3/3.4 pass while
  -- the `technical_director` flag is still DARK — the arms refuse with
  -- check_violation, not HC0G0, so "the arm exists" and "the feature is live" stay
  -- distinguishable.
  ('technical_director',        'hospital'),
  ('technical_director_deputy', 'hospital'),
  -- QO·A (ADR 0100 D1, migration 20260911000000/-000200): the checklist fired
  -- exactly as designed — M1 added the role to the CHECK and 3.1 went red until
  -- this row landed WITH the M3 grant/revoke arms (3.3/3.4 verify the arms
  -- behaviourally, by error code).
  ('quality_reviewer',          'hospital');
-- 3.3/3.4 read this table while `set local role authenticated` is in force.
grant select on role_scope to authenticated;

select is(
  (select coalesce(string_agg(v.role, ', ' order by v.role), '')
     from role_vocab v left join role_scope s on s.role = v.role
    where s.role is null),
  '',
  '3.1 GRID: every role in memberships_role_check has a declared scope (a new role reds this until wired)');

select is(
  (select coalesce(string_agg(s.role, ', ' order by s.role), '')
     from role_scope s left join role_vocab v on v.role = s.role
    where v.role is null),
  '',
  '3.2 GRID: ...and the map declares no role the CHECK does not admit (no stale entries)');

-- Every role must have a real arm in BOTH doors. BEHAVIOURAL, not textual: both doors
-- end in `else raise ... errcode = 'HC0G0'`, so an unhandled (scope, role) pair is
-- identified by its ERROR CODE. The probe calls the door with a random scope id as an
-- unauthorized caller; any code OTHER than HC0G0 (42501 no authority, 23514 no such
-- hospital) means the dispatch found an arm, which is exactly what is being asserted.
create or replace function app._t292_probe_arm(p_which text, p_role text, p_scope text)
returns text language plpgsql as $p$
begin
  if p_which = 'grant' then
    perform public.grant_role(p_scope, gen_random_uuid(), p_role, gen_random_uuid());
  else
    perform public.revoke_role(p_scope, gen_random_uuid(), p_role, gen_random_uuid());
  end if;
  return 'REACHED';
exception when others then
  return sqlstate;
end; $p$;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;

select is(
  (select coalesce(string_agg(s.role, ', ' order by s.role), '')
     from role_scope s
    where app._t292_probe_arm('grant', s.role, s.scope_type) = 'HC0G0'),
  '',
  '3.3 GRID: public.grant_role has an arm for EVERY role in the vocabulary');

select is(
  (select coalesce(string_agg(s.role, ', ' order by s.role), '')
     from role_scope s
    where app._t292_probe_arm('revoke', s.role, s.scope_type) = 'HC0G0'),
  '',
  '3.4 GRID: public.revoke_role has an arm for EVERY role in the vocabulary');

-- POSITIVE TWIN for 3.3/3.4: the probe must be able to REPORT HC0G0, or both
-- assertions are string_aggs over an empty set for the wrong reason.
select is(
  app._t292_probe_arm('grant', 'no_such_role', 'commission'),
  'HC0G0',
  '3.5 POSITIVE TWIN: the grid probe DOES return HC0G0 for a role with no arm');
-- ⛔ This `reset role` MUST stay BELOW 3.5. `app.grant_role_impl`'s FIRST check raises 42501
-- 'ator não identificado' on a null actor, so the probe would never reach the HC0G0 catchall
-- this twin exists to prove reachable — the twin would go green-adjacent for the wrong reason,
-- which is the very failure 3.3/3.4 pair it against. (FUP-RESET-ROLE-DOES-NOT-CLEAR-JWT-CLAIMS)
reset role;

select * from finish();
rollback;
