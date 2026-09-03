-- 413 — AE4/IA-F9: authz.authorized_scope_ids and the statement-scoped policy arm.
-- Subject: 20261003007320 (ADR 0182).
--
-- ⛔⛔ READ THIS BEFORE TRUSTING A GREEN HERE.
--
-- The migration adds a SET-valued resolver and rewrites professional_profiles_select to test
-- each row's organization against it once per statement, falling back to the unchanged
-- app.can_read_professional_profile for every other arm. The performance argument is not this
-- suite's business; the acceptance doc measures that. ⭐ WHAT THIS SUITE EXISTS FOR is the
-- direction a defect here would point: a set resolver that answers too WIDELY is privilege
-- escalation, and it would look fast and green.
--
-- The implementation is built so that over-granting is impossible BY CONSTRUCTION — the CASE
-- inside authorized_scope_ids only PROPOSES a candidate scope, and authz.has_permission itself
-- confirms every candidate before it is returned. §2 measures that claim rather than repeating
-- it; §5 pins the SUBSET property the policy rewrite actually rests on.
--
-- ⚠ WHAT A WRONG CANDIDATE MAP LOOKS LIKE: a MISSING grant, never an extra one. §2's
-- differential is therefore aimed at both polarities, and §2b refuses to pass on a sweep that
-- contains no positive cells at all — a differential over an all-deny population is green for
-- a reason unrelated to the property.
--
-- ⚠ THIS SUITE DOES NOT CALL `test_helpers.bootstrap()` — same reason as 401/407/412: its
-- subject is the real seeded tenancy population, which bootstrap's `truncate ... cascade`
-- would destroy. It inserts named own-org/foreign-org professional_profiles plus three per
-- organization (so §5's subset invariant has a population rather than a pair), and the whole
-- file rolls back.
--
-- ⚠ IT MUST PASS AT SEED SCALE AND WITH THE AE4 PERF FIXTURE LOADED. Every fixture selection
-- below is `order by ... limit 1` over whatever tenancy exists, never a hardcoded id, and the
-- principal sweep in §2 is bounded so a 12 000-user fixture does not turn this file into a
-- performance test.
--
-- RUN SHAPE: `Files=2, Tests=30` (29 here + 00_setup.sql's one). ⛔ Keep this line in step
-- with plan() — a stale RUN SHAPE is read as the expected shape by the next person diagnosing
-- a count mismatch.

begin;
select plan(29);

-- ============================================================================
-- §0 — FIXTURE. A seeded principal whose ONLY route to org.professionals.read is the
-- permission arm, that principal's organization, a genuinely foreign organization, and one
-- professional_profile in each.
--
-- `staff_admin` is the only role entailing org.professionals.read (asserted in §2b by way of
-- the positive-cell count), so the principal is chosen as a commission-scope staff_admin.
-- ============================================================================
create temp table f413 on commit drop as
  select m.principal_id            as pid,
         c.id                      as cid,
         c.organization_id         as own_org
    from public.memberships m
    join public.commissions c on c.id = m.commission_id
   where m.role = 'staff_admin'
     and m.scope_kind = 'commission'
     and (m.expires_at is null or m.expires_at > now())
     and not exists (
       -- no competing tenancy arm anywhere, and not a platform admin: the acceptance's
       -- §4 property, asserted rather than assumed.
       select 1 from public.memberships m2
        where m2.principal_id = m.principal_id
          and m2.role in ('org_admin', 'hospital_admin')
     )
     and exists (select 1 from public.profiles p
                  where p.id = m.principal_id and not p.is_admin)
   order by m.principal_id, c.id
   limit 1;

create temp table f413x on commit drop as
  select (select o.id from public.organizations o
           where o.id <> (select own_org from f413)
           order by o.id limit 1) as foreign_org,
         (select p.id from public.profiles p
           where p.id <> (select pid from f413)
             and not p.is_admin
             and not exists (select 1 from public.memberships m where m.principal_id = p.id)
           order by p.id limit 1) as unprivileged_pid;

-- Two profiles, one per organization. Inserted as the owner (DEFINER-only writes at E0).
insert into public.professional_profiles (organization_id, full_name)
  select own_org, 'AE4-413 own-org subject' from f413;
insert into public.professional_profiles (organization_id, full_name)
  select foreign_org, 'AE4-413 foreign-org subject' from f413x;

-- ⭐ A POPULATION, NOT A PAIR. §5's subset invariant is the one the migration header calls
-- load-bearing, and QA measured its first form running over exactly TWO rows and ONE principal
-- — one of which this file had inserted itself. On a seeded database `professional_profiles`
-- holds a single row, so the invariant was true of almost nothing. Three rows per organization
-- gives every principal in the §2 sweep both reachable and unreachable subjects.
insert into public.professional_profiles (organization_id, full_name)
  select o.id, 'AE4-413 pop ' || o.id || ' #' || g
    from public.organizations o cross join generate_series(1, 3) g;

create temp table f413p on commit drop as
  select (select id from public.professional_profiles
           where full_name = 'AE4-413 own-org subject')     as own_prof,
         (select id from public.professional_profiles
           where full_name = 'AE4-413 foreign-org subject') as foreign_prof;

-- §4 reads these under `set local role authenticated`, and a temp table is owned by the
-- session user, not by whatever role is current. Without this the §4 assertions abort with
-- `permission denied for table f413p` — which is a fixture failure, NOT a policy denial, and
-- the two are indistinguishable from the assertion text alone.
grant select on f413, f413x, f413p to authenticated;

-- 1. The fixture must actually contain two tenants and a qualifying principal, or every
--    negative below is vacuous and every positive is untestable.
select ok(
  (select count(*) from f413) = 1
  and (select foreign_org from f413x) is not null
  and (select unprivileged_pid from f413x) is not null
  and (select own_prof from f413p) is not null
  and (select foreign_prof from f413p) is not null
  and (select own_org from f413) is distinct from (select foreign_org from f413x),
  'FIXTURE: a commission-scope staff_admin with no org/hospital_admin arm, two distinct organizations, one profile in each'
);

-- ============================================================================
-- §1 — CATALOG KEYSTONE. Signature, owner, volatility, prosecdef, search_path, result type
-- and the EXACT ACL. ⛔ A NULL proacl includes PUBLIC, so "no grant line" is not the same
-- claim as "not executable by PUBLIC"; these compare the rendered ACL, not its absence.
-- ============================================================================
select is(
  (select format('%s|%s|%s|%s|%s|%s',
                 pg_get_userbyid(p.proowner), p.prosecdef, p.provolatile,
                 pg_get_function_result(p.oid), p.proconfig::text,
                 (select string_agg(a::text, ',' order by a::text) from unnest(p.proacl) a))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'authorized_scope_ids'),
  'postgres|t|s|SETOF uuid|{"search_path=\"\""}|postgres=X/postgres',
  'authz.authorized_scope_ids: postgres-owned STABLE SECURITY DEFINER, empty search_path, SETOF uuid, executable by postgres ALONE'
);

select is(
  (select format('%s|%s|%s|%s|%s|%s',
                 pg_get_userbyid(p.proowner), p.prosecdef, p.provolatile,
                 pg_get_function_result(p.oid), p.proconfig::text,
                 (select string_agg(a::text, ',' order by a::text) from unnest(p.proacl) a))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'candidate_authorized_scope_ids'),
  'postgres|t|s|SETOF uuid|{"search_path=\"\""}|postgres=X/postgres',
  'authz.candidate_authorized_scope_ids: same attributes, and likewise reachable by NO application role'
);

-- ⛔ `search_path` IS DELIBERATELY NOT IN THIS COMPOSITE. It is asserted separately, below, as
-- a DIFFERENTIAL against the sibling authorizer — see that assertion's header for why a
-- hand-typed expected value is the wrong instrument for this particular field.
select is(
  (select format('%s|%s|%s|%s|%s',
                 pg_get_userbyid(p.proowner), p.prosecdef, p.provolatile,
                 pg_get_function_result(p.oid),
                 (select string_agg(a::text, ',' order by a::text) from unnest(p.proacl) a))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'current_professional_read_organizations'),
  'postgres|t|s|SETOF uuid|authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres',
  'app.current_professional_read_organizations: the narrow door — authenticated + service_role, and NOT PUBLIC'
);

-- ⛔⛔ THIS ASSERTION EXISTS BECAUSE ITS FIRST VERSION PINNED A DEFECT AS EXPECTED.
--
-- 20261003007320 emitted `set search_path to 'app, public, pg_catalog'` — SINGLE-QUOTED, so
-- ONE identifier naming a schema that does not exist, not a three-element list. Postgres skips
-- an absent schema silently, so the function's effective `current_schemas(true)` was
-- `{pg_temp_N, pg_catalog}` while its sibling's was `{pg_temp_N, app, public, pg_catalog}`.
-- The original form of this test hand-typed the expected `proconfig` by COPYING IT OUT OF THE
-- BROKEN CATALOG, so the suite would have gone RED when someone fixed the migration. Found by
-- QA review, 2026-09-03; fixed by 20261003007330.
--
-- ⭐ THE REPAIR IS STRUCTURAL, NOT A CORRECTED CONSTANT. The reference is now the SIBLING
-- authorizer — `app.can_read_professional_profile`, which has always been right — so this
-- cannot be satisfied by re-encoding whatever the last migration happened to produce. The
-- quote check beside it is the direct tell: the two forms differ by exactly that character,
-- and a stale sibling could otherwise let the collapsed form pass by matching it.
select is(
  (select array_to_string(p.proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'current_professional_read_organizations'),
  (select array_to_string(p.proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_read_professional_profile'),
  'app.current_professional_read_organizations declares the SAME search_path as its sibling app.can_read_professional_profile — a differential, never a hand-typed constant'
);

select ok(
  (select array_to_string(p.proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'current_professional_read_organizations') not like '%"%',
  'app.current_professional_read_organizations search_path contains NO quote — i.e. it is an identifier LIST and did not collapse to one non-existent schema'
);

-- 5. The door takes NO principal argument. If it ever gains one, a caller could ask about
--    somebody else, which flips entailed_grants' hat conjunct onto its third-party branch
--    where the hat is not required. That is a privilege boundary, not a signature detail.
select is(
  (select p.pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'current_professional_read_organizations'),
  0::smallint,
  'app.current_professional_read_organizations takes NO arguments — the principal is bound to auth.uid() internally'
);

-- 6. The subset argument in the migration header rests on this column being NOT NULL.
select ok(
  (select attnotnull from pg_attribute
    where attrelid = 'public.professional_profiles'::regclass and attname = 'organization_id'),
  'professional_profiles.organization_id is NOT NULL — the subset argument the policy rests on'
);

-- 7. The policy actually routes through the new door. A later migration that reverts the
--    predicate would otherwise leave this whole suite green while testing nothing live.
select ok(
  (select pg_get_expr(polqual, polrelid) from pg_policy
    where polrelid = 'public.professional_profiles'::regclass
      and polname = 'professional_profiles_select')
    like '%current_professional_read_organizations%',
  'professional_profiles_select routes through app.current_professional_read_organizations'
);

-- 8. ...and it still carries the fallback arm, which is what preserves platform_admin, the
--    legacy org-manager arm and the case-participant traversal.
select ok(
  (select pg_get_expr(polqual, polrelid) from pg_policy
    where polrelid = 'public.professional_profiles'::regclass
      and polname = 'professional_profiles_select')
    like '%can_read_professional_profile%',
  'professional_profiles_select still falls back to app.can_read_professional_profile for every other arm'
);

-- ============================================================================
-- §2 — THE DIFFERENTIAL. Set membership against the runtime boolean resolver, over every
-- organization and a bounded principal sweep, on BOTH polarities.
-- ⚠ Run in owner context, where auth.uid() is NULL and the hat conjunct therefore takes its
-- THIRD-PARTY branch. §3 covers the self branch, which is the one the policy uses.
-- ============================================================================
create temp table f413cells on commit drop as
  with principals as (
    select distinct m.principal_id as id from public.memberships m order by 1 limit 40
  ),
  everyone as (
    select id from principals
    union select pid from f413
    union select unprivileged_pid from f413x
  )
  select e.id as pid,
         o.id as oid,
         authz.has_permission(e.id, 'organization', o.id, 'org.professionals.read') as hp,
         o.id in (select authz.authorized_scope_ids(e.id, 'organization', 'org.professionals.read')) as inset
    from everyone e cross join public.organizations o;

select is(
  (select count(*) from f413cells where hp is distinct from inset)::bigint,
  0::bigint,
  '§2 DIFFERENTIAL: X in authz.authorized_scope_ids(P) agrees with authz.has_permission(P,X) on every cell'
);

-- 10. Non-vacuity. A differential over an all-deny population is green for a reason unrelated
--     to the property being tested.
select cmp_ok(
  (select count(*) from f413cells where hp)::bigint, '>', 0::bigint,
  '§2b NON-VACUITY: the sweep contains at least one GRANTING cell'
);

-- 11. ...and at least one denying cell, or the differential has only ever seen one answer.
select cmp_ok(
  (select count(*) from f413cells where not hp)::bigint, '>', 0::bigint,
  '§2c NON-VACUITY: the sweep contains at least one DENYING cell'
);

-- ============================================================================
-- §2d/§2e — BRANCH REACHABILITY. QA review 2026-09-03 found §2's differential exercises only
-- TWO of the candidate map's four branches, and "agrees on every cell" reads as coverage of
-- the whole map. It is not a test gap: the other two are UNREACHABLE, and the reasons are
-- catalog facts. ⭐ So the fix is not more cells — it is pinning the MECHANISM of each
-- absence, so that the day it stops holding, this file says so instead of staying green.
-- (An unexercised branch is safe here in one direction only: it can only under-propose, and
-- the policy's ELSE arm catches that. It could never over-grant.)
-- ============================================================================
create temp table f413branch on commit drop as
  select case
           when m.scope_kind::text = pm.resolution_scope_kind::text then 'same-kind'
           when pm.resolution_scope_kind::text = 'organization' and m.scope_kind::text = 'commission' then 'commission->organization'
           when pm.resolution_scope_kind::text = 'organization' and m.scope_kind::text = 'hospital'   then 'hospital->organization'
           when pm.resolution_scope_kind::text = 'hospital'     and m.scope_kind::text = 'commission' then 'commission->hospital'
           else 'ELSE (false)'
         end as branch,
         count(*) as pairs
    from public.memberships m
    join authz.roles r on r.code = m.role and r.state::text = 'authoritative'
    join authz.role_permissions rp on rp.role_code = m.role
    join authz.permission_implication_closure cl on cl.implying = rp.permission_code
    join authz.permissions pm on pm.code = cl.implied
   where m.scope_kind is not null
   group by 1;

select is(
  (select string_agg(branch, ' | ' order by branch) from f413branch),
  'commission->organization | same-kind',
  '§2d BRANCH REACHABILITY, as a NAMED SET: exactly two of the candidate map''s four branches are reachable anywhere in the live catalog. ⛔ If this reds, a branch became reachable (or stopped being) and §2''s differential no longer covers what it appears to — extend the sweep, do not edit this string'
);

select ok(
  (select count(*) from authz.permissions where resolution_scope_kind::text = 'hospital') = 0
  and (select count(*) from public.memberships m
        join authz.roles r on r.code = m.role and r.state::text = 'authoritative'
        join authz.role_permissions rp on rp.role_code = m.role
        join authz.permission_implication_closure cl on cl.implying = rp.permission_code
        join authz.permissions pm on pm.code = cl.implied
       where m.scope_kind::text = 'hospital' and pm.resolution_scope_kind::text = 'organization') = 0,
  '§2e THE MECHANISM OF EACH ABSENCE, separately falsifiable: `commission->hospital` is unreachable because NO permission resolves at hospital scope (0 of 43), and `hospital->organization` because no hospital-scope membership holds a role entailing an organization-scope permission. Either clause going false makes a branch live and untested'
);

-- ============================================================================
-- §3 — THE HAT, i.e. the SELF branch of entailed_grants' asymmetry. This is the branch the
-- policy actually takes, because app.current_professional_read_organizations passes
-- auth.uid() as the principal.
-- ============================================================================
select test_helpers.claims_for((select pid from f413), false, 'staff_admin');
select ok(
  (select own_org from f413) in (select app.current_professional_read_organizations()),
  '§3a SELF + CORRECT HAT: the principal own organization is in the door result'
);

select test_helpers.claims_for((select pid from f413), false, 'staff');
select ok(
  (select own_org from f413) not in (select app.current_professional_read_organizations()),
  '§3b SELF + WRONG HAT: the door returns nothing for that organization'
);

-- ⛔ NOT `test_helpers.claims_for(pid, false, null)`. That helper AUTO-DERIVES the hat when
-- the principal holds exactly one distinct live role — which this principal does — so it
-- would emit `active_role: staff_admin` and this assertion would silently re-test §3a.
-- Measured 2026-09-03: written with claims_for, it failed, and the failure is what exposed
-- the auto-derivation. The absent-hat state has to be CONSTRUCTED, not requested.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select pid from f413), 'role', 'authenticated', 'is_admin', false)::text,
  true
);
select ok(
  (select own_org from f413) not in (select app.current_professional_read_organizations()),
  '§3c SELF + ABSENT HAT: the door returns nothing for that organization'
);

select test_helpers.reset_role_and_claims();

-- 15. Third-party: asked ABOUT the principal by someone else, the hat is not required. This
--     asymmetry is entailed_grants', carried verbatim; pinned so the set form cannot quietly
--     acquire a different one.
select ok(
  (select own_org from f413) in (
    select authz.authorized_scope_ids((select pid from f413), 'organization', 'org.professionals.read')),
  '§3d THIRD PARTY: with no acting hat in session, the same grant resolves — the asymmetry is preserved'
);

-- ============================================================================
-- §4 — THE POLICY SURFACE. Read the BASE TABLE as `authenticated`, not the helper.
-- ⛔ The SQL door being right is evidence about the door and about nothing downstream.
-- ============================================================================
select test_helpers.claims_for((select pid from f413), false, 'staff_admin');
set local role authenticated;
select is(
  (select count(*) from public.professional_profiles where id = (select own_prof from f413p))::bigint,
  1::bigint,
  '§4a POLICY: the permission principal reads the own-organization profile through the base table'
);
select is(
  (select count(*) from public.professional_profiles where id = (select foreign_prof from f413p))::bigint,
  0::bigint,
  '§4b POLICY: the FOREIGN-organization profile stays invisible'
);
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select pid from f413), false, 'staff');
set local role authenticated;
select is(
  (select count(*) from public.professional_profiles
    where id in ((select own_prof from f413p), (select foreign_prof from f413p)))::bigint,
  0::bigint,
  '§4c POLICY: the WRONG hat reads neither profile — the short-circuit does not bypass the hat'
);
select test_helpers.reset_role_and_claims();

select test_helpers.claims_for((select unprivileged_pid from f413x), false, null);
set local role authenticated;
select is(
  (select count(*) from public.professional_profiles
    where id in ((select own_prof from f413p), (select foreign_prof from f413p)))::bigint,
  0::bigint,
  '§4d POLICY: a principal holding no membership at all reads neither profile'
);
select test_helpers.reset_role_and_claims();

-- ============================================================================
-- §5 — THE SUBSET INVARIANT. This is what makes the policy rewrite a pure short-circuit
-- rather than a change of meaning: anything the set arm grants, the untouched authorizer
-- already granted. A counterexample here is a WIDENING of the policy.
-- ============================================================================
-- The sampled subject population: every row this file inserted, plus a deterministic slice of
-- whatever else exists (so the sweep is not confined to rows the test authored).
create temp table f413prof on commit drop as
  select id, organization_id from public.professional_profiles where full_name like 'AE4-413 %'
  union
  select id, organization_id from (
    select id, organization_id from public.professional_profiles order by id limit 40) t;

create temp table f413sub on commit drop as
  select pr.pid,
         pf.organization_id in (
           select authz.authorized_scope_ids(pr.pid, 'organization', 'org.professionals.read')
         ) as set_grants,
         app.can_read_professional_profile(pf.id, pr.pid) as fn_grants
    from (select distinct pid from f413cells) pr
   cross join f413prof pf;

select is(
  (select count(*) from f413sub where set_grants and not fn_grants)::bigint,
  0::bigint,
  '§5 SUBSET: over every (principal, profile) cell, every row the set arm grants is already granted by app.can_read_professional_profile'
);

-- ⛔ §5 WITHOUT THIS IS GREEN ON AN EMPTY GRANTING SIDE. "No counterexample" is satisfied by a
-- population where the set arm never grants at all, which is exactly the shape QA measured in
-- the first version of this section. §2 had non-vacuity guards; §5 had none.
select ok(
  (select count(*) from f413sub where set_grants) > 0
  and (select count(*) from f413sub where not set_grants) > 0,
  format('§5b NON-VACUITY: the subset sweep has BOTH polarities — %s cells where the set arm grants, %s where it does not, over %s profiles x %s principals',
         (select count(*) from f413sub where set_grants),
         (select count(*) from f413sub where not set_grants),
         (select count(*) from f413prof),
         (select count(distinct pid) from f413sub))
);

-- ============================================================================
-- §6 — THE CANDIDATE TWIN. It must track authz.candidate_has_permission, and it must
-- genuinely DIFFER from the runtime resolver under `test_validation` — otherwise the two are
-- one function wearing two names and the pre-cutover oracle is measuring the wrong thing.
-- ============================================================================
select is(
  (select count(*) from public.organizations o cross join f413 f
    where authz.candidate_has_permission(f.pid, 'organization', o.id, 'org.professionals.read')
          is distinct from
          (o.id in (select authz.candidate_authorized_scope_ids(f.pid, 'organization', 'org.professionals.read'))))::bigint,
  0::bigint,
  '§6a CANDIDATE TWIN: agrees with authz.candidate_has_permission on every organization'
);

-- 20. Flip staff_admin into `test_validation` and the two resolvers must part company: the
--     runtime one denies, the candidate one still grants. Rolled back by the savepoint.
savepoint s413_state;
update authz.roles set state = 'test_validation' where code = 'staff_admin';
select ok(
  (select own_org from f413) not in (
    select authz.authorized_scope_ids((select pid from f413), 'organization', 'org.professionals.read'))
  and
  (select own_org from f413) in (
    select authz.candidate_authorized_scope_ids((select pid from f413), 'organization', 'org.professionals.read')),
  '§6b THE TWO ARE TWO: under test_validation the runtime set DENIES and the candidate set GRANTS'
);
rollback to savepoint s413_state;

-- ============================================================================
-- §7 — VACUITY CONTROL. A differential never shown able to fail is indistinguishable from a
-- dead one. Plant an OVER-BROAD body — every organization, no confirmation — and require §2's
-- differential to go RED, then restore from the definition captured out of the catalog (never
-- from a hand copy) and prove the restore byte-identical.
-- ============================================================================
create temp table f413def on commit drop as
  select pg_get_functiondef(p.oid) as def, md5(pg_get_functiondef(p.oid)) as sum
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'authz' and p.proname = 'authorized_scope_ids';

savepoint s413_plant;
create or replace function authz.authorized_scope_ids(
  p_principal uuid, p_resolution_kind text, p_permission_code text
) returns setof uuid language sql stable security definer set search_path to ''
as $planted$ select o.id from public.organizations o $planted$;

select cmp_ok(
  (select count(*) from public.organizations o cross join f413 f
    where authz.has_permission(f.pid, 'organization', o.id, 'org.professionals.read')
          is distinct from
          (o.id in (select authz.authorized_scope_ids(f.pid, 'organization', 'org.professionals.read'))))::bigint,
  '>', 0::bigint,
  '§7a THE DIFFERENTIAL CAN BITE: an over-broad body makes it disagree with authz.has_permission'
);
rollback to savepoint s413_plant;

select is(
  (select md5(pg_get_functiondef(p.oid))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'authz' and p.proname = 'authorized_scope_ids'),
  (select sum from f413def),
  '§7b RESTORE: authz.authorized_scope_ids is byte-identical to the definition captured before the plant'
);

select * from finish();
rollback;
