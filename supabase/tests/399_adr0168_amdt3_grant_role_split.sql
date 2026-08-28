-- ADR 0168 Amendment 3 (PO-ruled 2026-08-28) — THE `grant_role` SPLIT.
-- Migration: 20261003006200_adr0168_amdt3_grant_role_split.sql
-- Companion suites: `396` (ADR 0166's, whose § 2 carries the one product cell that
-- flips) and `398` (the three-door ACL/audit surface).
--
-- ============================================================================
-- ⛔ WHAT THIS FILE EXISTS TO STOP, STATED BEFORE ANY ASSERTION
-- ============================================================================
-- `public.grant_role` and `public.grant_role_for` have been deliberately IDENTICAL
-- in every respect except where the actor comes from.  ADR 0168 Amdt 3 introduces
-- the FIRST behavioural asymmetry between them:
--
--     grant_role      (authenticated) -> p_allow_anchorless => FALSE
--     grant_role_for  (service_role)  -> p_allow_anchorless => TRUE
--
-- ⚠ AN UNPINNED ASYMMETRY GETS TIDIED AWAY BY THE NEXT READER, and the tidy-up
--   reads as a cleanup in both directions: "why does one twin pass a literal the
--   other doesn't?".  Restoring symmetry upward re-opens the widening; restoring it
--   downward breaks first-time provisioning outright.  § 1 is therefore a PAIR
--   assertion derived from `pg_proc` — neither literal can move alone — and § 2 is
--   its behavioural twin, because catalog text is truth about the catalog and
--   evidence about nothing that runs.
--
-- ============================================================================
-- ⭐ THE ENUMERATION LESSON, IMPLEMENTED RATHER THAN RECORDED (§ 3)
-- ============================================================================
-- This door was MISSED by ADR 0168's original census because that census was bounded
-- by the NAME FAMILY `affiliate_person%`, and `ensure_provisioned_org_affiliation`
-- does not carry that name.  `393 § 5.7`'s sibling pin inherits the same bound, so
-- no gate would have noticed.  § 3 re-cuts the census on the CAPABILITY — every
-- function whose body INSERTS INTO `public.organization_affiliations` — and states
-- the whole set with its predicate profile in one exact string.  Measured before this
-- migration, `app.ensure_provisioned_org_affiliation` appeared in that set carrying
-- NEITHER named predicate (`-+-`), which is exactly the shape that should have been
-- a finding.
--
-- ============================================================================
-- ⚠ NON-VACUITY, PER CELL, BECAUSE THIS REPO'S DOMINANT DEFECT IS THE GREEN THAT
--   PROVES NOTHING
-- ============================================================================
--   • § 2.0 asserts the FOUR other reasons the door could answer HC0R0 are all
--     absent for the deny subject — the profile exists, is active, is not a platform
--     administrator.  Without it, § 2.1 is green on a fixture whose person was never
--     created, and it would read identically.
--   • § 2.2 is § 2.1's POSITIVE CONTROL: the same actor, the same session, the same
--     door, the same statement shape, differing ONLY in whether the subject is
--     anchorless.  So the refusal is provably the tenancy predicate and not the ACL,
--     the actor's authority, or the (scope, role) pair.
--   • every ACCEPT is followed by a WRITE-THROUGH cell — `lives_ok` cannot see
--     whether its own statement did anything.
--   • § 1.2 runs the SAME module twice on the SAME subject with the parameter
--     flipped, in two SEPARATE statements.  ⛔ Two calls either side of a `||` would
--     have no guaranteed evaluation order, and the true-arm-first ordering would
--     anchor the subject and turn the false arm green for the wrong reason.
--   • § 4 is the OVER-REACH control: the narrowing must not have become a blanket
--     tenancy gate on the session door.
--
-- ⚠ RUN SHAPE.  Requires `00_setup.sql` for `test_helpers`.  Expected shape
--   `Files=2, Tests=17` (16 here + `00_setup.sql`'s own one).
--
-- Assertion count: 16
-- ============================================================================
begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- Constants and fixtures.  Every constructed id lives in a `0168a3…` namespace
-- disjoint from 390-398, so nothing is shared across suites and nothing is ever
-- deleted positionally.
--
-- ⚠ § 2 and § 4 BUILD their statements under `set local role authenticated`, so the
--   `format(…)` arguments are read by THAT role — hence the `grant select`.
-- ---------------------------------------------------------------------------
create temp table r399 (k text primary key, v uuid);

insert into r399 (k, v) values
  -- seed ids
  ('org_a',      '0c000000-0000-0000-0000-00000000000a'),  -- Rede Hospitalar A
  ('ccih',       'a0000000-0000-0000-0000-0000000000a1'),  -- comissão CCIH (org A)
  ('orgadmin_a', '00000000-0000-0000-0000-0000000000b1'),  -- orgadmin.a@test.local
  -- constructed subjects
  ('x1_anchorless', '00000000-0000-0000-0000-0168a3000001'),  -- org-tier differential
  ('x2_known',      '00000000-0000-0000-0000-0168a3000002'),  -- § 2.2 positive control
  ('x3_scopebound', '00000000-0000-0000-0000-0168a3000003'),  -- § 4 over-reach control
  ('x4_module',     '00000000-0000-0000-0000-0168a3000004');  -- § 1.2 both arms
grant select on r399 to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', r.v, 'authenticated', 'authenticated',
       r.v || '@adr168a3.test', now(), now()
from r399 r where r.k like 'x%';

update public.profiles set is_active = true, full_name = 'ADR0168 Amdt3 fixture'
 where id in (select v from r399 where k like 'x%');

-- X2 is the ONE subject with an affiliation: ACTIVE in org A, so `person_known_to_org`
-- is true for it and `person_is_anchorless` is false.  X1, X3 and X4 get no row of any
-- tense, which is the state the narrowing refuses on the session door.
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, created_by)
values
  ((select v from r399 where k = 'x2_known'), (select v from r399 where k = 'org_a'),
   date '2025-01-01', (select v from r399 where k = 'orgadmin_a'));

-- ============================================================================
-- § 0 SIGNATURE AND OVERLOAD HYGIENE.  Adding a DEFAULTED parameter creates a NEW
--     function rather than replacing the old one, so a stale overload can survive
--     a migration that reads as complete — and a surviving 4-arg / 7-arg twin is
--     both an ambiguity for the existing call sites and a door that still admits
--     the widening.  Asserted as an exact identity-argument string per function,
--     with the COUNT in the same cell, so neither a second overload nor a silently
--     reordered parameter list can pass.
-- ============================================================================
select is(
  (select count(*)::text || '|' || string_agg(pg_get_function_identity_arguments(p.oid), ' ~ ')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'ensure_provisioned_org_affiliation'),
  '1|p_actor uuid, p_user uuid, p_organization uuid, p_started_on date, p_allow_anchorless boolean',
  '0.1 ⛔ EXACTLY ONE `app.ensure_provisioned_org_affiliation`, carrying the new trailing `p_allow_anchorless`. The migration DROPS the 4-arg form explicitly: a defaulted parameter does not replace a signature, it adds one, and the survivor would still admit the anchorless widening from every caller that never heard of the parameter');

select is(
  (select count(*)::text || '|' || string_agg(pg_get_function_identity_arguments(p.oid), ' ~ ')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'grant_role_impl'),
  '1|p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid, p_expires_at timestamp with time zone, p_allow_anchorless boolean',
  '0.2 …and EXACTLY ONE `app.grant_role_impl`. ⚠ This one matters twice: `public.appoint_technical_director` calls it with FIVE arguments, so a surviving 7-arg twin would make that call ambiguous at runtime — a break with no compile-time witness anywhere in the estate');

select is(
  (select string_agg(n.nspname || '.' || p.proname || '=' ||
            case when p.prosecdef then 'D' else 'I' end ||
            case when has_function_privilege('authenticated', p.oid, 'execute') then 'a' else '-' end ||
            case when has_function_privilege('service_role',  p.oid, 'execute') then 's' else '-' end ||
            case when has_function_privilege('anon',          p.oid, 'execute') then 'n' else '-' end,
          ' ' order by n.nspname, p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'app'    and p.proname in ('ensure_provisioned_org_affiliation', 'grant_role_impl'))
       or (n.nspname = 'public' and p.proname in ('grant_role', 'grant_role_for'))),
  'app.ensure_provisioned_org_affiliation=D--- app.grant_role_impl=D--- '
  || 'public.grant_role=Das- public.grant_role_for=D-s-',
  '0.3 ⛔ THE ACL SURFACE IS UNCHANGED BY THIS MIGRATION, and that is the point: ADR 0168 Amdt 3 narrows the TARGET-TENANCY predicate, NOT the door''s audience — `public.grant_role` stays reachable by `authenticated`. ⚠ Both `app` bodies were DROPPED and recreated, which also drops their ACL; asserted POSITIVELY per role via has_function_privilege rather than by reading `proacl` for an absence, because a NULL `proacl` INCLUDES PUBLIC — the guard that reads right and fails open, hit four times in this estate');

select is(
  (select string_agg(p.proname || '=' || array_to_string(p.proconfig, ','), ' ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'app'    and p.proname in ('ensure_provisioned_org_affiliation', 'grant_role_impl'))
       or (n.nspname = 'public' and p.proname in ('grant_role', 'grant_role_for'))),
  'ensure_provisioned_org_affiliation=search_path=app, public, pg_catalog '
  || 'grant_role=search_path=app, public, pg_catalog '
  || 'grant_role_for=search_path=app, public, pg_catalog '
  || 'grant_role_impl=search_path=app, public, pg_catalog',
  '0.4 all four rewritten bodies still pin `search_path` — a SECURITY DEFINER without one is the resolution-hijack shape, and all four are DEFINER by § 0.3. Asserted as NAME=VALUE pairs so a function that dropped out of the domain reds instead of shrinking the aggregate');

select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname, ' ' order by n.nspname, p.proname), '(NONE)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and p.proname <> 'ensure_provisioned_org_affiliation'
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'ensure_provisioned_org_affiliation'),
  'app.grant_role_impl',
  '0.5 ⭐ `app.grant_role_impl` is the ONLY caller of the ensure, re-derived from the catalog every run with `--` comments STRIPPED (the module names itself in its own header). That is what makes `p_allow_anchorless` a one-consumer parameter: a SECOND caller added later would inherit the FALSE default silently — an inheritance shape this phase has produced five times — and reds here first');

-- ============================================================================
-- § 1 ⭐⭐ THE ASYMMETRY PIN — the most important cell in this increment.
-- ============================================================================
-- Derived from `pg_proc.prosrc`, comments stripped, by capturing the argument each
-- wrapper passes in the `p_allow_anchorless` position — anchored on the PRECEDING
-- parameter name so a reordered call reds instead of matching the wrong literal.
-- ⛔ ASSERTED AS A PAIR IN ONE CELL.  Two separate cells would let "restore symmetry"
--    land as one red and one green, which reads as a flaky test rather than as the
--    security decision it is.  `coalesce(…, 'NO-MATCH')` means a body whose shape
--    stopped matching reds LOUDLY instead of collapsing to an empty string.
select is(
  'grant_role=' || coalesce((select substring(regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
                                     from 'p_expires_at,\s*(true|false)\s*\)')
                               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.proname = 'grant_role'), 'NO-MATCH')
  || ' grant_role_for=' || coalesce((select substring(regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
                                     from 'p_expires_at,\s*(true|false)\s*\)')
                               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.proname = 'grant_role_for'), 'NO-MATCH'),
  'grant_role=false grant_role_for=true',
  '1.1 ⭐⭐ THE ASYMMETRY, PINNED AS A PAIR. These twins were IDENTICAL except for the actor source; this is their first behavioural difference and it IS the control. ⛔ Do not "restore symmetry" in either direction: `grant_role => true` re-opens the widening an org_admin used to anchor a bare orphan uuid AND seat a governance role on it; `grant_role_for => false` refuses EVERY first-time provisioning, because `resolveOrInviteUser` invites and the role grant anchors, so the person is anchorless at exactly that moment. Either edit reds this one cell');

create or replace function pg_temp.try_ensure(
  p_actor uuid, p_user uuid, p_org uuid, p_allow boolean)
returns text language plpgsql as $$
declare v_id uuid;
begin
  v_id := app.ensure_provisioned_org_affiliation(p_actor, p_user, p_org, current_date, p_allow);
  return 'ok:' || (v_id is not null)::text;
exception when others then
  return sqlstate;
end;
$$;

-- ⛔ SEPARATE STATEMENTS, DELIBERATELY.  Both arms in one expression would have no
--    guaranteed evaluation order, and true-first would anchor X4 and make the false
--    arm return `ok:` for a reason that has nothing to do with the parameter.
do $$ begin perform set_config('t399.e_false', pg_temp.try_ensure(
  (select v from r399 where k = 'orgadmin_a'), (select v from r399 where k = 'x4_module'),
  (select v from r399 where k = 'org_a'), false), true); end $$;
do $$ begin perform set_config('t399.e_true', pg_temp.try_ensure(
  (select v from r399 where k = 'orgadmin_a'), (select v from r399 where k = 'x4_module'),
  (select v from r399 where k = 'org_a'), true), true); end $$;

select is(
  current_setting('t399.e_false') || '|' || current_setting('t399.e_true'),
  'HC0R0|ok:true',
  '1.2 ⭐ THE BEHAVIOURAL TWIN OF 1.1: the SAME module, the SAME actor, the SAME anchorless subject, called twice with only `p_allow_anchorless` flipped — refused HC0R0 on false, writing a real affiliation id on true. § 1.1 is truth about the CATALOG TEXT and evidence about nothing that runs; this is the cell that says the parameter is wired to the predicate rather than merely declared');

-- ============================================================================
-- § 2 THE TWO DOORS, ORG TIER / `org_admin` ARM — the arm the live probe found
--     ACCEPTED before this migration (an org_admin of Rede A anchored a bare
--     orphan uuid AND seated `org_admin` on it in one call).
-- ============================================================================
select is(
  (select (pr.id is not null)::text || '|' || pr.is_active::text || '|' || pr.is_admin::text
     from public.profiles pr where pr.id = (select v from r399 where k = 'x1_anchorless'))
  || '|' || app.person_is_anchorless((select v from r399 where k = 'x1_anchorless'))::text
  || '|' || (select count(*)::int from public.memberships
              where principal_id = (select v from r399 where k = 'x1_anchorless'))::text
  || ' // ' ||
  (select (pr.id is not null)::text || '|' || pr.is_active::text || '|' || pr.is_admin::text
     from public.profiles pr where pr.id = (select v from r399 where k = 'x2_known'))
  || '|' || app.person_known_to_org((select v from r399 where k = 'x2_known'),
                                    (select v from r399 where k = 'org_a'))::text
  || '|' || (select count(*)::int from public.memberships
              where principal_id = (select v from r399 where k = 'x2_known'))::text,
  'true|true|false|true|0 // true|true|false|true|0',
  '2.0 ⛔ PRECONDITION, AND IT IS THE ANTI-VACUITY CELL FOR ALL OF § 2. The ensure raises HC0R0 from FOUR sites — no such profile, a platform administrator, the tenancy predicate, and (as HC0R4) a deactivated account. This asserts the other three are absent for X1, so § 2.1''s refusal can only be the tenancy predicate. X2 differs in EXACTLY ONE property: it is known to org A. Both hold zero memberships, so § 2.4 measures a write and not a pre-existing row');

select test_helpers.claims_for((select v from r399 where k = 'orgadmin_a'), false, 'org_admin');
set local role authenticated;

select throws_ok(
  format($$select public.grant_role('organization', %L::uuid, 'org_admin', %L::uuid)$$,
         (select v from r399 where k = 'org_a'), (select v from r399 where k = 'x1_anchorless')),
  'HC0R0',
  'pessoa não pertence a esta organização',
  '2.1 ⭐⭐ THE NARROWING, AS A POSITIVE WITNESS: an `org_admin` of Rede A passing a bare ANCHORLESS uuid to the SESSION door is now REFUSED. Measured at head …006100 this call SUCCEEDED and handed the orphan an active org-A affiliation AND an `org_admin` membership — strictly more than the two doors ADR 0168 had already closed. ⚠ The MESSAGE is asserted beside the code because 42501 and HC0R0 are both refusals and only one of them is this predicate');

select lives_ok(
  format($$select public.grant_role('organization', %L::uuid, 'org_admin', %L::uuid)$$,
         (select v from r399 where k = 'org_a'), (select v from r399 where k = 'x2_known')),
  '2.2 ⭐ THE POSITIVE CONTROL FOR 2.1: the SAME org_admin, in the SAME session, through the SAME door, with the SAME statement shape, on a subject that differs ONLY in being KNOWN to org A — and it succeeds. Without this cell 2.1 is green on a broken ACL, a wrong-arm actor, or a door that refuses everything, and all three read identically');
reset role;

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select v from r399 where k = 'x1_anchorless'))::text || '|' ||
  (select count(*)::int from public.memberships
    where principal_id = (select v from r399 where k = 'x1_anchorless'))::text,
  '0|0',
  '2.3 ⛔ …and NEITHER ROW LANDED for the refused subject. ADR 0166 clause 2 is "both rows, or neither"; a refusal that left the affiliation behind would satisfy any code-only assertion, and the affiliation is the half that dissolves the ADR 0133 SUBSET bound');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select v from r399 where k = 'x2_known')
      and organization_id = (select v from r399 where k = 'org_a')
      and ended_on is null and voided_at is null)::text || '|' ||
  (select m.role || '|' || (m.organization_id = (select v from r399 where k = 'org_a'))::text
     from public.memberships m where m.principal_id = (select v from r399 where k = 'x2_known')),
  '1|org_admin|true',
  '2.4 ⛔ WRITE-THROUGH FOR 2.2: the accepted call really seated the org-tier membership, and left X2 with exactly ONE live org-A affiliation — the ensure''s idempotent path returned the existing row rather than writing a second (clause 3). `lives_ok` cannot see whether its own statement did anything');

select lives_ok(
  format($$select public.grant_role_for(%L::uuid, 'organization', %L::uuid, 'org_admin', %L::uuid)$$,
         (select v from r399 where k = 'orgadmin_a'), (select v from r399 where k = 'org_a'),
         (select v from r399 where k = 'x1_anchorless')),
  '2.5 ⭐⭐ THE OTHER HALF OF THE ASYMMETRY, BEHAVIOURALLY: the SAME actor and the SAME anchorless subject that 2.1 refused are ACCEPTED through the SERVICE door. No security is traded — `grant_role_for` takes the actor explicitly and re-derives the same authority in PostgreSQL — and it is the provisioning path, where the person is anchorless by construction because the invite has only just created them');

select is(
  (select (oa.ended_on is null)::text || '|' || (oa.voided_at is null)::text || '|' ||
          (oa.organization_id = (select v from r399 where k = 'org_a'))::text || '|' ||
          (oa.created_by = (select v from r399 where k = 'orgadmin_a'))::text
     from public.organization_affiliations oa
    where oa.principal_id = (select v from r399 where k = 'x1_anchorless')) || '|' ||
  (select m.role from public.memberships m
    where m.principal_id = (select v from r399 where k = 'x1_anchorless')) || '|' ||
  app.person_is_anchorless((select v from r399 where k = 'x1_anchorless'))::text,
  'true|true|true|true|org_admin|false',
  '2.6 ⛔ WRITE-THROUGH FOR 2.5, AND THE DIFFERENTIAL THAT MAKES 2.3 MEAN SOMETHING: the identical grant through the other door writes BOTH rows for the SAME subject, created_by the REAL provisioning actor (clause 7). Without this cell 2.3 is green on a database where the ensure does not run at all — which is precisely how 396 § 5.9 behaved on its red-first run');

-- ============================================================================
-- § 3 ⭐ THE CENSUS, RE-CUT ON THE CAPABILITY INSTEAD OF THE NAME.
--
--     ADR 0168 Amdt 3's closing lesson: "A door census bounded by a NAME cannot see
--     a door that does the same thing under another name — the bound has to be the
--     CAPABILITY (what writes `organization_affiliations`), which is a catalog
--     question, not a grep."  `393 § 5.7` pins the same predicate profile over a
--     HAND-LISTED family of five `affiliate*` / `recover*` names; this cell derives
--     its domain from the bodies themselves, so a SIXTH writer added under any name
--     appears here with its profile rather than being silently outside the sweep.
--
--     ⚠ MEASURED BEFORE THIS MIGRATION, `app.ensure_provisioned_org_affiliation`
--       was already in this set carrying `-+-` — neither named predicate while
--       writing the table. That row is what a capability-bounded census would have
--       shown, and nothing in the estate was asking.
-- ============================================================================
select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname || '=' ||
            case when regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'app\.person_known_to_org'
                 then 'known' else '-' end || '+' ||
            case when regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g') ~ 'app\.person_is_anchorless'
                 then 'anchorless' else '-' end,
          ' ' order by n.nspname, p.proname), '(NO WRITERS)')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public')
      and regexp_replace(p.prosrc, '--[^' || chr(10) || ']*', '', 'g')
            ~* 'insert\s+into\s+public\.organization_affiliations'),
  'app.affiliate_new_person_impl=known+anchorless '
  || 'app.affiliate_new_person_to_org_impl=known+anchorless '
  || 'app.affiliate_person_impl=known+- '
  || 'app.affiliate_person_to_org_impl=known+- '
  || 'app.ensure_provisioned_org_affiliation=known+anchorless '
  || 'app.recover_orphan_person_to_org_impl=-+anchorless',
  '3.1 ⭐⭐ THE CAPABILITY-BOUNDED CENSUS: every function that WRITES `organization_affiliations`, with the two named predicates it carries, derived from the catalog every run. The ordinary doors carry `known` alone, the creation doors carry both (ordinary ⊂ creation), recovery carries `anchorless` alone — and the ensure now reads like the creation doors because its wide arm is real, but gated by a PARAMETER rather than by an ACL, which is why § 1.1 and not this cell is the thing that says WHO may use it. ⛔ A new writer under any name reds here, which is the gate that did not exist when this door was missed');

-- ============================================================================
-- § 4 THE OVER-REACH CONTROL.  A narrowing is only correct if it narrowed exactly
--     what was ruled.  `public.grant_role` must NOT have acquired a blanket
--     target-tenancy gate: the ensure runs for EXACTLY two (scope, role) pairs
--     (ADR 0166 § Scope bound, pinned behaviourally by `396 § 6.1–§ 6.3`), so an
--     ordinary commission `staff` appointment of an ANCHORLESS person through the
--     SESSION door still succeeds and still creates no affiliation.
-- ============================================================================
select test_helpers.claims_for((select v from r399 where k = 'orgadmin_a'), false, 'org_admin');
set local role authenticated;
select lives_ok(
  format($$select public.grant_role('commission', %L::uuid, 'staff', %L::uuid)$$,
         (select v from r399 where k = 'ccih'), (select v from r399 where k = 'x3_scopebound')),
  '4.1 ⛔ THE SCOPE BOUND SURVIVES THE NARROWING: the SAME session door, the SAME actor, and a subject just as ANCHORLESS as § 2.1''s — accepted, because an ordinary `staff` appointment never reaches the ensure. ⚠ This is the cell that reds if `p_allow_anchorless` is ever read anywhere other than inside the ADR 0166 block, or if a future fix "hardens" the wrapper by gating the whole door on tenancy. `public.appoint_technical_director` is protected by the same bound: it calls the kernel five-argument, takes the FALSE default, and grants at a (hospital, technical_director) pair the block does not cover');
reset role;

select * from finish();
rollback;
