-- ADR 0167 — COMMISSION `staff_admin` HAS **ONE** AUTHORITY, ON BOTH SIDES.
-- Phase record: docs/progress/authz-ae2.md § "ADR 0167 — the one-way door".
--
-- ============================================================================
-- ⛔ THE INVARIANT THIS FILE EXISTS FOR
-- ============================================================================
-- `app.is_tenancy_admin_of_for(commission, actor)` — `org_admin` of the
-- commission's ORGANISATION **or** `hospital_admin` of its HOSPITAL — is the
-- SINGLE authority for the commission `staff_admin` role, and it is the same
-- predicate on the GRANT side and the REVOKE side.  Before ADR 0167 the grant
-- side additionally carried `app.is_admin_for(p_actor)` and the revoke side did
-- not, so a platform administrator could SEAT a commission coordinator and
-- could not REMOVE one: escalation with no matching de-escalation by the same
-- actor.  § 4 is the property that reds if the two sides ever diverge again.
--
-- ⚠ THE NARROWING IS REAL, AND "UNREACHABLE THROUGH THE UI" IS NOT THE MEASURE.
--   `public.grant_role` is EXECUTE-able by `authenticated` (§ 1.4 pins that),
--   so a signed-in platform admin could call this door directly over PostgREST
--   even though `authorizeStaffAdminOps` has no `isAdmin` arm and
--   `/o/[org]/manage` 404s them.  The door and the TypeScript gate DISAGREED and
--   the DOOR WAS WIDER — that disagreement is the whole subject of ADR 0167, and
--   this file measures the door, not the gate.
--
-- ============================================================================
-- ⭐ THE SITE THAT IS EASY TO MISS, AND IS THEREFORE THE KEYSTONE (§ 5)
-- ============================================================================
-- `app.grant_role_impl` gates the commission `staff_admin` role in **TWO**
-- places, not one:
--   (a) the `p_role = 'staff_admin'` sub-arm of the commission branch, and
--   (b) the T1.0 atomic-replacement branch's OUTGOING-role guard
--       (`v_existing_role = 'staff_admin'`), which decides who may change the
--       role of an EXISTING coordinator.
-- Fixing (a) and missing (b) leaves the one-way door standing for every
-- DEMOTION: a platform admin could still turn a coordinator into plain staff.
-- § 5.3 is the cell that reds on that, and it discriminates by MESSAGE — site
-- (b) raises `'sem permissão para alterar a função de um administrador da
-- comissão'` while the `'staff'` sub-arm in front of it raises the generic
-- `'sem permissão'`.  Asserting only the SQLSTATE would pass with site (b)
-- untouched, because the actor would be refused one statement earlier.
--
-- ============================================================================
-- ⛔ WHAT THIS FILE DOES **NOT** RULE ON — stated, not hidden
-- ============================================================================
-- The commission `'staff'` sub-arm keeps its `is_admin_for` on the grant side
-- and has never had one on the revoke side, so THE SAME ONE-WAY DOOR SURVIVES
-- ONE ROLE OVER: a platform admin may seat a commission `staff` and may not
-- remove one.  ADR 0167 § Consequences bounds itself to the `staff_admin` arm
-- ("the other `grant_role_impl` arms keep their own actor grids"), so closing it
-- here would be an unruled authorization change.  § 6 PINS the surviving gap as
-- a KNOWN GAP awaiting a PO ruling — deliberately, and with an assertion whose
-- failure message tells the next reader that the gap has been CLOSED rather
-- than that this file is broken.  ⛔ § 4's agreement property is therefore
-- SCOPED TO `staff_admin`; widening it to the whole commission branch would red
-- on a defect this increment is not authorized to close.
--
-- ============================================================================
-- THE RESIDUAL BOUND — published here, not only in the phase doc
-- ============================================================================
-- `supabase/tests/mutation/adr0167-staff-admin-one-authority-mutation-audit.sh`
-- runs 20 mutants, all RED-PROVEN, and 36 of these 40 assertions were moved by
-- at least one of them.  FOUR were not, and each is a floor rather than a
-- guarantee — named so the gap is a bound, not a silence:
--   § 1.1  no session claims in force — a property of the HARNESS. Only a
--          mutation of the test file itself could move it.
--   § 1.3  the four targets are in the states their cells assume — likewise a
--          fixture precondition, and the thing the other cells are measured
--          AGAINST.
--   § 4.4  six actors probed on both sides — the anti-vacuity population floor
--          over this file's own temp tables, which the subject cannot reach.
--   § 5.4  the target actually KEPT its role — an ATOMICITY pin. A mutant that
--          refuses AND writes cannot make it red: the raise unwinds its own
--          subtransaction, so the write is rolled back with it. Its failure mode
--          needs a non-transactional writer, which this door cannot become.
-- ⛔ Four unproven assertions is a BOUND ON THIS AUDIT, not a claim of full
--    coverage of anything else.
--
-- ============================================================================
-- ⛔ THE FIXTURE DOES NOT BUILD ITS WORLD OUT OF THE SUBJECT
-- ============================================================================
-- Every pre-existing membership below is inserted DIRECTLY in owner context,
-- never through `grant_role`/`grant_role_for`.  Seating the § 5 demotion target
-- through the door under test would have exercised the very authority the cell
-- is about to measure, and seating the § 3 revoke target through it would have
-- made a grant-side regression silently repair the revoke-side fixture.
-- ============================================================================

begin;
select plan(40);

-- ---------------------------------------------------------------------------
-- Seed constants.  Every CONSTRUCTED id lives in a `0167…` namespace disjoint
-- from every other suite, so nothing is shared and nothing is deleted
-- positionally.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (org_a uuid, org_b uuid,
               ccih uuid, etica uuid,
               hosp_central_a uuid, hosp_secundario_a uuid,
               platform uuid, oa_a uuid, oa_b uuid, ha_central uuid)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         'a0000000-0000-0000-0000-0000000000a1'::uuid,  -- comissão CCIH   (org A / Hospital Central A)
         'e0000000-0000-0000-0000-0000000000e1'::uuid,  -- comissão Ética  (org A / Hospital Secundário A)
         '05000000-0000-0000-0000-00000000000a'::uuid,  -- Hospital Central A
         '05000000-0000-0000-0000-0000000000a2'::uuid,  -- Hospital Secundário A
         '00000000-0000-0000-0000-0000000000b0'::uuid,  -- platform@test.local      (is_admin)
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- orgadmin.a@test.local    (org_admin A)
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- orgadmin.b@test.local    (org_admin B)
         '00000000-0000-0000-0000-0000000000e1'::uuid;  -- hospitaladmin.a1@test.local (Central A)
$$;
grant execute on function pg_temp.k() to authenticated, service_role;

create or replace function pg_temp.p()
returns table (ha_sec uuid, inact_oa uuid,
               t_grant uuid, t_revoke uuid, t_promo uuid, t_demote uuid,
               t_staff uuid, t_boot uuid, t_boot2 uuid, t_hosp uuid)
language sql immutable as $$
  select '00000000-0000-0000-0000-016700000a01'::uuid,  -- hospital_admin of SECUNDÁRIO A only
         '00000000-0000-0000-0000-016700000a02'::uuid,  -- org_admin of A, but INACTIVE
         '00000000-0000-0000-0000-016700000b01'::uuid,  -- grant target   (no membership)
         '00000000-0000-0000-0000-016700000b02'::uuid,  -- revoke target  (staff_admin CCIH)
         '00000000-0000-0000-0000-016700000b03'::uuid,  -- promotion      (staff → staff_admin)
         '00000000-0000-0000-0000-016700000b04'::uuid,  -- demotion       (staff_admin → staff)
         '00000000-0000-0000-0000-016700000d01'::uuid,  -- the § 6 `staff` known-gap subject
         '00000000-0000-0000-0000-016700000c01'::uuid,  -- bootstrap: the new org_admin
         '00000000-0000-0000-0000-016700000c02'::uuid,  -- bootstrap: the coordinator they seat
         '00000000-0000-0000-0000-016700000c03'::uuid;  -- bootstrap: a hospital_admin target
$$;
grant execute on function pg_temp.p() to authenticated, service_role;

-- ===========================================================================
-- § 0 STRUCTURAL PINS.  Read from `pg_proc`, never from a migration file — some
--     migrations in this repo rewrite function bodies at runtime via
--     `pg_get_functiondef()` + `replace()`, so the file text can never be
--     trusted to match the live body (ADR 0078 METHODOLOGY FINDING).
--
--     ⚠ These are the CHEAP half.  A structural pin proves the TEXT changed; §§
--     2–5 prove the BEHAVIOUR changed.  Neither substitutes for the other, and
--     the preservation pin at § 0.3 is what stops a mutation that deletes every
--     `is_admin_for` in the function from passing §§ 2–5 and § 0.1–0.2 alike.
-- ===========================================================================

-- `--` comments are stripped before matching: the arms quote the predicates
-- they deliberately do NOT carry, so an unanchored match reads a comment as code
-- (the LINE-FILTERED `prosrc` failure mode, one step further).
create or replace function pg_temp.src(p_schema text, p_name text)
returns text language sql stable as $$
  select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = p_schema and p.proname = p_name;
$$;

select ok(
  pg_temp.src('app', 'grant_role_impl')
    ~ 'else\s+if not app\.is_tenancy_admin_of_for\(p_scope_id, p_actor\) then',
  '0.1 SITE (a): the commission `staff_admin` sub-arm is `is_tenancy_admin_of_for` ALONE. Anchored on the `else` of the staff/staff_admin split, so it cannot be satisfied by a sibling arm that happens to spell the same call');

select ok(
  pg_temp.src('app', 'grant_role_impl')
    ~ 'v_existing_role = ''staff_admin''\s+and not app\.is_tenancy_admin_of_for\(p_scope_id, p_actor\) then',
  '0.2 SITE (b): the T1.0 outgoing-role guard is `is_tenancy_admin_of_for` ALONE. ⭐ This is the site a fix that reads the ADR''s "the commission arm" as ONE place leaves standing');

select is(
  (select
     ((length(s) - length(replace(s, 'is_admin_for(', '')))
        / length('is_admin_for('))::text || '|' ||
     (s ~ 'p_role = ''org_admin'' then\s+if not \(app\.is_admin_for\(p_actor\) or app\.is_org_admin_of_for\(p_scope_id, p_actor\)\)')::text || '|' ||
     (s ~ 'if not \(app\.is_admin_for\(p_actor\) or app\.is_org_admin_of_for\(v_org, p_actor\)\)')::text || '|' ||
     (s ~ 'if p_role = ''staff'' then\s+if not \(app\.is_admin_for\(p_actor\)\s+or app\.is_staff_admin_of_for\(p_scope_id, p_actor\)')::text
   from (select pg_temp.src('app', 'grant_role_impl') as s) q),
  '3|true|true|true',
  '0.3 ⛔ PRESERVATION, AND THE ANTI-VACUITY PIN FOR § 0.1/§ 0.2: EXACTLY THREE `is_admin_for` sites remain, each NAMED — organization/org_admin (the bootstrap ADR 0167 checked and kept), hospital/hospital_admin (AFF T2.5 / ADR 0097 D17 / BLOCKER-1), and the commission `staff` sub-arm (a different (scope, role) pair, § 6). Without this cell a mutation deleting ALL FIVE passes every other assertion in this file');

select is(
  (select
     ((length(s) - length(replace(s, 'is_admin_for(', '')))
        / length('is_admin_for('))::text || '|' ||
     (s ~ 'p_role = ''org_admin'' then\s+if not \(app\.is_admin_for\(p_actor\) or app\.is_org_admin_of_for\(p_scope_id, p_actor\)\)')::text
   from (select pg_temp.src('app', 'revoke_role_impl') as s) q),
  '1|true',
  '0.4 PRESERVATION on the OTHER side: `revoke_role_impl` still carries EXACTLY ONE `is_admin_for`, in its organization/org_admin arm. ADR 0167 aligns grant DOWN to revoke; it must not have moved revoke UP to grant');

select is(
  (select
     (p.prosrc ~ 'INTENTIONAL asymmetry')::text || '|' ||
     (p.prosrc ~ 'ADR 0167')::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'revoke_role_impl'),
  'false|true',
  '0.5 ⭐ THE RETIRED COMMENT, PINNED IN BOTH DIRECTIONS. The QA m1 note called the grant/revoke asymmetry INTENTIONAL; ADR 0167 rules it a defect, so the sentence must be GONE and the ruling must be NAMED in its place. A comment is an assertion that goes stale silently and no other gate in this repository can contradict one');

-- ---------------------------------------------------------------------------
-- FIXTURES.  `handle_new_user` mints each profile from `auth.users`.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated',
       x.id || '@adr0167.test', now(), now()
from (
  select unnest(array[
    (select ha_sec from pg_temp.p()),   (select inact_oa from pg_temp.p()),
    (select t_grant from pg_temp.p()),  (select t_revoke from pg_temp.p()),
    (select t_promo from pg_temp.p()),  (select t_demote from pg_temp.p()),
    (select t_staff from pg_temp.p()),  (select t_boot from pg_temp.p()),
    (select t_boot2 from pg_temp.p()),  (select t_hosp from pg_temp.p())
  ]) as id
) x;

update public.profiles set full_name = 'ADR 0167 fixture', is_active = true
 where id in (select unnest(array[
   (select ha_sec from pg_temp.p()),   (select inact_oa from pg_temp.p()),
   (select t_grant from pg_temp.p()),  (select t_revoke from pg_temp.p()),
   (select t_promo from pg_temp.p()),  (select t_demote from pg_temp.p()),
   (select t_staff from pg_temp.p()),  (select t_boot from pg_temp.p()),
   (select t_boot2 from pg_temp.p()),  (select t_hosp from pg_temp.p())]));

-- Tenant anchoring for the targets whose grant crosses ADR 0166's provisioning
-- block (`commission`/`staff_admin`): an ACTIVE org-A affiliation makes
-- `app.ensure_provisioned_org_affiliation` idempotent, so every verdict below is
-- the AUTHORITY answer and never a provisioning refusal wearing the same shape.
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, created_by)
select x.id, (select org_a from pg_temp.k()), current_date, (select oa_a from pg_temp.k())
from (
  select unnest(array[
    (select ha_sec from pg_temp.p()),  (select inact_oa from pg_temp.p()),
    (select t_grant from pg_temp.p()), (select t_revoke from pg_temp.p()),
    (select t_promo from pg_temp.p()), (select t_demote from pg_temp.p()),
    (select t_staff from pg_temp.p())
  ]) as id
) x;

-- The two constructed ACTORS.  `ha_sec` administers Hospital Secundário A and
-- NOTHING else, so the CCIH cells isolate the HOSPITAL term of
-- `is_tenancy_admin_of_for` inside a single organisation: it is not a cross-org
-- refusal wearing a hospital label.
insert into public.memberships (principal_id, organization_id, hospital_id, role) values
  ((select ha_sec from pg_temp.p()), (select org_a from pg_temp.k()),
   (select hosp_secundario_a from pg_temp.k()), 'hospital_admin');

insert into public.memberships (principal_id, organization_id, role) values
  ((select inact_oa from pg_temp.p()), (select org_a from pg_temp.k()), 'org_admin');
update public.profiles set is_active = false where id = (select inact_oa from pg_temp.p());

-- ⛔ DIRECT inserts — see the header.  The door under test never builds its own
--    fixture.
insert into public.memberships (principal_id, commission_id, role) values
  ((select t_revoke from pg_temp.p()), (select ccih from pg_temp.k()), 'staff_admin'),
  ((select t_promo  from pg_temp.p()), (select ccih from pg_temp.k()), 'staff'),
  ((select t_demote from pg_temp.p()), (select ccih from pg_temp.k()), 'staff_admin'),
  ((select t_staff  from pg_temp.p()), (select ccih from pg_temp.k()), 'staff');

-- The probe.  A plpgsql exception block is an implicit SUBTRANSACTION, and the
-- `ADR0167_ALLOWED` raise forces a rollback of the SUCCESS path too — so the
-- grid is non-destructive, cell order cannot matter, and one target serves every
-- actor.  Returns `ALLOWED` or `sqlstate|message`, so the SQLSTATE view
-- (`split_part(…,'|',1)`) is comparable across grant and revoke while the
-- message stays available to § 5.3's site discriminator.
create or replace function pg_temp.probe(
  p_kind text, p_actor uuid, p_scope_id uuid, p_role text, p_user uuid)
returns text language plpgsql as $$
declare v_msg text;
begin
  begin
    if p_kind = 'grant' then
      perform public.grant_role_for(p_actor, 'commission', p_scope_id, p_role, p_user);
    else
      perform public.revoke_role_for(p_actor, 'commission', p_scope_id, p_role, p_user);
    end if;
    raise exception 'ADR0167_ALLOWED';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'ADR0167_ALLOWED' then return 'ALLOWED'; end if;
    return sqlstate || '|' || v_msg;
  end;
end;
$$;

-- The actor set, ONCE.  Every grid below is driven from this table, so grant and
-- revoke cannot silently probe different populations — the failure mode that
-- makes an "agreement" property agree with itself.
create temp table actors (
  ord int, label text, actor uuid, expected text) on commit drop;
insert into actors (ord, label, actor, expected) values
  (1, 'platform_admin',                (select platform   from pg_temp.k()), '42501'),
  (2, 'org_admin of the org',          (select oa_a       from pg_temp.k()), 'ALLOWED'),
  (3, 'hospital_admin of THE hospital',(select ha_central from pg_temp.k()), 'ALLOWED'),
  (4, 'hospital_admin of ANOTHER hospital, same org',
                                       (select ha_sec     from pg_temp.p()), '42501'),
  (5, 'org_admin of ANOTHER org',      (select oa_b       from pg_temp.k()), '42501'),
  (6, 'org_admin of the org, INACTIVE',(select inact_oa   from pg_temp.p()), '42501');

-- ===========================================================================
-- § 1 THE FLOOR.  Preconditions asserted rather than inherited: without these,
--     a § 2 cell could pass because the fixture put the actor in the wrong arm.
-- ===========================================================================

select is(
  (select (auth.uid() is null)::text),
  'true',
  '1.1 no session claims are in force, so `app.has_role`''s ACT hat clause is satisfied unconditionally and every verdict below is the AUTHORITY answer. § 8 re-measures the two headline cells on the SESSION path, where the hat DOES bind');

select is(
  (select string_agg(a.label || '=' ||
            app.is_admin_for(a.actor)::text || '/' ||
            app.is_tenancy_admin_of_for((select ccih from pg_temp.k()), a.actor)::text || '/' ||
            app.is_active(a.actor)::text, ' ; ' order by a.ord)
     from actors a),
  'platform_admin=true/false/true ; '
  'org_admin of the org=false/true/true ; '
  'hospital_admin of THE hospital=false/true/true ; '
  'hospital_admin of ANOTHER hospital, same org=false/false/true ; '
  'org_admin of ANOTHER org=false/false/true ; '
  'org_admin of the org, INACTIVE=false/false/false',
  '1.2 ⭐ WRONG-ARM GUARD: each actor sits in the authority class its label claims (is_admin_for / is_tenancy_admin_of_for / is_active). Actor 4 is the sharp one — it is false on TENANCY while sharing the organisation with actor 2, so its refusal isolates the HOSPITAL term rather than re-testing cross-org isolation');

select is(
  (select count(*)::int from public.memberships where principal_id = (select t_grant from pg_temp.p()))::text || '|' ||
  (select role from public.memberships where principal_id = (select t_revoke from pg_temp.p()))::text || '|' ||
  (select role from public.memberships where principal_id = (select t_promo from pg_temp.p()))::text || '|' ||
  (select role from public.memberships where principal_id = (select t_demote from pg_temp.p()))::text,
  '0|staff_admin|staff|staff_admin',
  '1.3 the four targets are in the states their cells assume — the grant target holds NOTHING (so § 2 exercises the INSERT path) and the demotion target already holds `staff_admin` (so § 5 reaches site (b) at all)');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'grant_role'),
  'true',
  '1.4 ⛔ THE REACHABILITY THIS NARROWING IS ABOUT: `public.grant_role` is EXECUTE-able by `authenticated`, so the capability ADR 0167 removes was reachable over PostgREST by any signed-in platform admin — regardless of what the TypeScript gate or the /o/[org]/manage layout allow. "Not reachable through the UI" would have been the wrong measure');

-- ===========================================================================
-- § 2 THE GRANT GRID.  Subject-keyed: one row per ACTOR, the thing the ruling is
--     about — never keyed by assertion number.
-- ===========================================================================

create temp table grid (ord int, kind text, verdict text) on commit drop;

insert into grid (ord, kind, verdict)
select a.ord, 'grant',
       pg_temp.probe('grant', a.actor, (select ccih from pg_temp.k()),
                     'staff_admin', (select t_grant from pg_temp.p()))
from actors a;

insert into grid (ord, kind, verdict)
select a.ord, 'revoke',
       pg_temp.probe('revoke', a.actor, (select ccih from pg_temp.k()),
                     'staff_admin', (select t_revoke from pg_temp.p()))
from actors a;

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and ord = 1),
  '42501',
  '2.1 ⛔ THE NARROWING: a platform_admin may NO LONGER grant commission `staff_admin`. This is the assertion ADR 0167 clause 1 exists for, and the one that was ALLOWED at head 20261003005900');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and ord = 2),
  'ALLOWED',
  '2.2 an `org_admin` of the commission''s organisation grants it');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and ord = 3),
  'ALLOWED',
  '2.3 a `hospital_admin` of the commission''s HOSPITAL grants it — the tier the DB door has admitted all along and the TypeScript gate refused');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and ord = 4),
  '42501',
  '2.4 …but a `hospital_admin` of ANOTHER hospital in the SAME organisation is refused: the hospital term is scoped to `commissions.hospital_id`, not to the org');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and ord = 5),
  '42501',
  '2.5 an `org_admin` of another organisation is refused (tenant isolation survives the narrowing)');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and ord = 6),
  '42501',
  '2.6 a DEACTIVATED `org_admin` of the right organisation is refused — `is_tenancy_admin_of_for` conjoins `app.is_active`, and dropping the platform arm must not have made the account state the only surviving check');

-- ===========================================================================
-- § 3 THE REVOKE GRID.  Same actors, same commission, same instrument.
-- ===========================================================================

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and ord = 1),
  '42501',
  '3.1 a platform_admin may not revoke commission `staff_admin` — UNCHANGED by ADR 0167. The ruling aligns grant DOWN to this, it does not move this UP');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and ord = 2),
  'ALLOWED',
  '3.2 an `org_admin` of the commission''s organisation revokes it');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and ord = 3),
  'ALLOWED',
  '3.3 a `hospital_admin` of the commission''s hospital revokes it');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and ord = 4),
  '42501',
  '3.4 a `hospital_admin` of another hospital in the same organisation is refused');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and ord = 5),
  '42501',
  '3.5 an `org_admin` of another organisation is refused');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and ord = 6),
  '42501',
  '3.6 a DEACTIVATED `org_admin` of the right organisation is refused');

-- ===========================================================================
-- § 4 THE AGREEMENT PROPERTY — the ADR''s whole point, expressed as a PROPERTY
--     over the actor set rather than as six hand-paired cells, so an actor
--     added later is covered without anyone remembering to pair it.
--
--     ⛔ SCOPED TO `staff_admin`.  The commission `'staff'` sub-arm still
--     disagrees across grant and revoke (§ 6) and is NOT authorized to be closed
--     by this increment, so widening this property to the whole commission
--     branch would red on a known, ruled-elsewhere gap.
-- ===========================================================================

select is(
  (select count(*)::int
     from grid g join grid r on g.ord = r.ord and g.kind = 'grant' and r.kind = 'revoke'
    where split_part(g.verdict, '|', 1) is distinct from split_part(r.verdict, '|', 1)),
  0,
  '4.1 ⭐ THE PROPERTY: for EVERY actor, granting and revoking commission `staff_admin` reach the SAME verdict. A one-way door is exactly a row where these two differ, and before ADR 0167 the platform_admin row did');

select is(
  (select count(distinct split_part(verdict, '|', 1))::int from grid where kind = 'grant')::text || '|' ||
  (select count(distinct split_part(verdict, '|', 1))::int from grid where kind = 'revoke')::text,
  '2|2',
  '4.2 ⛔ POSITIVE TWIN: each column contains BOTH outcomes. An all-deny grid — or an all-permit one — satisfies § 4.1 vacuously, and an over-eager narrowing that refused everyone would look exactly like a fix');

select is(
  (select string_agg(a.label || '=' || split_part(g.verdict, '|', 1), ' ; ' order by a.ord)
     from actors a join grid g on g.ord = a.ord and g.kind = 'grant'),
  (select string_agg(a.label || '=' || a.expected, ' ; ' order by a.ord) from actors a),
  '4.3 …and the shared verdict is the DECLARED one per actor, not merely a shared one: § 4.1 + § 4.2 are both satisfied by a grid that agreed on the WRONG answer for a middle actor');

select is(
  (select count(*)::int from actors)::text || '|' ||
  (select count(*)::int from grid)::text,
  '6|12',
  '4.4 ⛔ THE PROPERTY IS NOT VACUOUS BY AN EMPTY POPULATION: six actors were probed on both sides. A `where` clause that silently matched nothing would satisfy § 4.1 with zero disagreements over zero rows');

-- ===========================================================================
-- § 5 THE EXISTING-ROLE BRANCH — site (b).  The site most likely to be missed,
--     because site (a) alone makes §§ 2–4 green.
-- ===========================================================================

select is(
  (select string_agg(a.label || '=' ||
            split_part(pg_temp.probe('grant', a.actor, (select ccih from pg_temp.k()),
                                     'staff_admin', (select t_promo from pg_temp.p())),
                       '|', 1), ' ; ' order by a.ord)
     from actors a),
  (select string_agg(a.label || '=' || a.expected, ' ; ' order by a.ord) from actors a),
  '5.1 PROMOTION `staff` → `staff_admin` runs the SAME authority set as a fresh grant. It reaches site (a) and then the T1.0 replacement UPDATE, so a fix applied only to the INSERT path would show here');

select is(
  (select string_agg(a.label || '=' ||
            split_part(pg_temp.probe('grant', a.actor, (select ccih from pg_temp.k()),
                                     'staff', (select t_demote from pg_temp.p())),
                       '|', 1), ' ; ' order by a.ord)
     from actors a),
  (select string_agg(a.label || '=' || a.expected, ' ; ' order by a.ord) from actors a),
  '5.2 ⭐ DEMOTION `staff_admin` → `staff` runs the same authority set TOO — which is only true because site (b) was fixed. The `staff` sub-arm in front of it still admits a platform_admin, so without site (b) the platform_admin cell here is ALLOWED while every other cell in this file is green');

select is(
  pg_temp.probe('grant', (select platform from pg_temp.k()), (select ccih from pg_temp.k()),
                'staff', (select t_demote from pg_temp.p())),
  '42501|sem permissão para alterar a função de um administrador da comissão',
  '5.3 ⛔ THE SITE DISCRIMINATOR: the platform_admin''s demotion refusal carries SITE (b)''s message, not the `staff` sub-arm''s generic `sem permissão`. Asserting only the SQLSTATE would have passed with site (b) untouched, because the ''staff'' arm''s own `is_admin_for` means the actor is NOT refused earlier — it is ADMITTED earlier');

select is(
  (select role from public.memberships
     where principal_id = (select t_demote from pg_temp.p())
       and commission_id = (select ccih from pg_temp.k())),
  'staff_admin',
  '5.4 …and the target actually KEPT the role: the refusal is a deny, not an error raised after the update landed');

select is(
  pg_temp.probe('grant', (select oa_a from pg_temp.k()), (select ccih from pg_temp.k()),
                'staff', (select t_demote from pg_temp.p())),
  'ALLOWED',
  '5.5 POSITIVE TWIN for § 5.3: an `org_admin` of the organisation CAN still demote. Site (b) is an AUTHORITY check, not a blanket ban on demotion — an implementation that simply refused every outgoing `staff_admin` change would satisfy § 5.3');

select is(
  pg_temp.probe('grant', (select ha_central from pg_temp.k()), (select ccih from pg_temp.k()),
                'staff', (select t_demote from pg_temp.p())),
  'ALLOWED',
  '5.6 SECOND POSITIVE TWIN: a `hospital_admin` of the commission''s hospital can demote too — site (b) reads the full `is_tenancy_admin_of_for`, not just its org disjunct');

-- ===========================================================================
-- § 6 THE SURVIVING `staff` ASYMMETRY — pinned as a KNOWN GAP.
--
--     ⛔ THIS IS NOT AN ENDORSEMENT.  A platform admin may SEAT a commission
--     `staff` and may not REMOVE one: the same one-way door ADR 0167 closes for
--     `staff_admin`, one role over.  ADR 0167 § Consequences explicitly does not
--     rule on the other arms, so closing it here would be an unruled
--     authorization change.  It is pinned so that the gap is MEASURED rather
--     than described, and so that closing it is a visible event.
--
--     ⚠ IF EITHER CELL BELOW REDS, THE GAP HAS PROBABLY BEEN CLOSED — read the
--     PO ruling, then DELETE this section rather than "repairing" it.
-- ===========================================================================

select is(
  pg_temp.probe('grant', (select platform from pg_temp.k()), (select ccih from pg_temp.k()),
                'staff', (select t_staff from pg_temp.p())),
  'ALLOWED',
  '6.1 KNOWN GAP (awaiting a PO ruling, NOT closed here): a platform_admin can still SEAT a commission `staff` — the `staff` sub-arm keeps its `is_admin_for` (§ 0.3 names it)');

select is(
  split_part(pg_temp.probe('revoke', (select platform from pg_temp.k()), (select ccih from pg_temp.k()),
                           'staff', (select t_staff from pg_temp.p())), '|', 1),
  '42501',
  '6.2 …and still cannot REMOVE one. § 6.1 + § 6.2 ARE the surviving one-way door, stated as a measurement. ⛔ Scoping § 4.1 to `staff_admin` is what keeps this a recorded gap instead of a red');

-- ===========================================================================
-- § 7 BOOTSTRAP INTACT.  A narrowing that left some commission unseatable would
--     be a lockout, not a fix.  Checked, not assumed (ADR 0167 § "Bootstrap").
-- ===========================================================================

select lives_ok(
  format($$select public.grant_role_for(%L, 'organization', %L, 'org_admin', %L)$$,
         (select platform from pg_temp.k()), (select org_a from pg_temp.k()),
         (select t_boot from pg_temp.p())),
  '7.1 BOOTSTRAP STEP 1: a platform_admin can still seat an `org_admin` — the organization arm KEEPS its `is_admin_for` (§ 0.3), which is the only reason the chain below exists');

select lives_ok(
  format($$select public.grant_role_for(%L, 'commission', %L, 'staff_admin', %L)$$,
         (select t_boot from pg_temp.p()), (select ccih from pg_temp.k()),
         (select t_boot2 from pg_temp.p())),
  '7.2 BOOTSTRAP STEP 2: that freshly-seated `org_admin` then seats the commission coordinator. ⭐ The chain platform_admin → org_admin → staff_admin is unbroken, so the narrowing leaves no commission unseatable');

select lives_ok(
  format($$select public.grant_role_for(%L, 'hospital', %L, 'hospital_admin', %L)$$,
         (select platform from pg_temp.k()), (select hosp_central_a from pg_temp.k()),
         (select t_hosp from pg_temp.p())),
  '7.3 …and the SECOND bootstrap chain is intact too: a platform_admin can still seat a `hospital_admin`, who § 2.3 proves may then seat the coordinator. Behavioural, not merely the structural pin at § 0.3');

select is(
  (select count(*)::int from public.commissions c
    where not exists (
      select 1 from public.memberships m
      where m.role = 'org_admin' and m.organization_id = c.organization_id
      union all
      select 1 from public.memberships m
      where m.role = 'hospital_admin' and m.hospital_id = c.hospital_id)),
  0,
  '7.4 ⭐ THE PROPERTY, over EVERY commission in the database rather than the one this file probes: none is left without a principal the surviving predicate admits. A per-commission lockout is exactly what an arm-removal can cause and what a single-commission fixture cannot see');

-- ===========================================================================
-- § 8 THE SESSION PATH.  §§ 2–7 drive `grant_role_for` (no session), which
--     isolates authority from the ACT hat.  The door a signed-in user actually
--     reaches is `public.grant_role`, where `app.has_role`''s hat clause DOES
--     bind — so the two headline verdicts are re-measured there.  Without this,
--     the narrowing would be proven only on a path `authenticated` cannot call.
-- ===========================================================================

select test_helpers.claims_for((select platform from pg_temp.k()), true);
set local role authenticated;
select throws_ok(
  format($$select public.grant_role('commission', %L, 'staff_admin', %L)$$,
         (select ccih from pg_temp.k()), (select t_grant from pg_temp.p())),
  '42501', 'sem permissão',
  '8.1 SESSION PATH: a platform_admin wearing the `platform_admin` hat is refused at the door `authenticated` can actually call. § 2.1''s twin on the reachable surface');
reset role;

select test_helpers.claims_for((select ha_central from pg_temp.k()), false, 'hospital_admin');
set local role authenticated;
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff_admin', %L)$$,
         (select ccih from pg_temp.k()), (select t_grant from pg_temp.p())),
  '8.2 SESSION PATH: a `hospital_admin` of the commission''s hospital, wearing that hat, is ADMITTED — the widening `authorizeStaffAdminOps` now mirrors');
reset role;

select is(
  (select role from public.memberships
     where principal_id = (select t_grant from pg_temp.p())
       and commission_id = (select ccih from pg_temp.k())),
  'staff_admin',
  '8.3 …and the membership actually LANDED. `lives_ok` alone passes on a door that returns quietly without writing');

select * from finish();
rollback;
