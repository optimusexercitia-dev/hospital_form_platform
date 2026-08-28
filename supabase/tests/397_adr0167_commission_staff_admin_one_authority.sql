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
-- ⭐ AMENDMENT 2 (PO-ruled 2026-08-28) EXTENDED THE SAME RULING ONE ROLE OVER.
--   The commission `'staff'` sub-arm carried the identical defect — grant had an
--   `is_admin_for`, revoke never did — and it is closed the same way, by
--   NARROWING grant.  Its third participant, `app.is_staff_admin_of_for`, was
--   already on BOTH sides, so the two sub-arms now read predicates that are
--   *identical*, not merely equivalent.  ⛔ § 4's agreement property is therefore
--   UNSCOPED: it spans BOTH commission sub-arms, and § 6 — which pinned the
--   `'staff'` asymmetry as a known gap — was DELETED rather than repaired, on
--   that section's own written instruction.
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
--
-- ⛔⛔ AMENDMENT 2 COST SITE (b) EVERY BEHAVIOURAL WITNESS IT HAD, WITHOUT
--   REDDING ANYTHING, AND RESTORING THEM IS THE LARGER HALF OF THAT INCREMENT.
--   Narrowing the `'staff'` sub-arm refuses the platform admin ONE STATEMENT
--   EARLIER, so it no longer arrives at site (b) at all.  Measured on the live
--   catalog, the ONLY class that still reaches site (b)'s raise is
--   `is_staff_admin_of_for AND NOT is_tenancy_admin_of_for` — a commission
--   coordinator demoting a peer.  Two actors were added for it:
--     · actor 7, a plain commission `staff_admin`      → site (b) raises;
--     · actor 8, a commission `staff_admin` who is ALSO `is_admin_for` → the
--       ONLY actor in the repository for whom site (b) is the difference
--       between admitted and refused, and therefore the only one whose cell can
--       red when the `is_admin_for` arm is put back there.
--   § 5.3 is that cell, and it discriminates by MESSAGE — site (b) raises
--   `'sem permissão para alterar a função de um administrador da comissão'`
--   while the `'staff'` sub-arm in front of it raises the generic
--   `'sem permissão'`.  Asserting only the SQLSTATE passes with site (b)
--   untouched, because the actor is refused one statement earlier either way.
--
-- ============================================================================
-- ⛔ WHAT THIS FILE DOES **NOT** RULE ON — stated, not hidden
-- ============================================================================
-- The other `grant_role_impl` arms keep their own actor grids: ADR 0167
-- § Consequences rules on the commission tier only, and Amendment 2 extends that
-- to the commission `'staff'` sub-arm and to NOTHING else.  The two surviving
-- `is_admin_for` sites — organization/`org_admin` (the bootstrap chain) and
-- hospital/`hospital_admin` (AFF T2.5 / ADR 0097 D17 / audit BLOCKER-1) — are
-- PRESERVED, pinned by name at § 0.3 and behaviourally at § 7.
--
-- ============================================================================
-- THE RESIDUAL BOUND — published here, not only in the phase doc
-- ============================================================================
-- `supabase/tests/mutation/adr0167-staff-admin-one-authority-mutation-audit.sh`
-- runs 22 mutants, all RED-PROVEN, and 37 of these 41 assertions were moved by
-- at least one of them.  FOUR were not, and each is a floor rather than a
-- guarantee — named so the gap is a bound, not a silence:
--   § 1.1  no session claims in force — a property of the HARNESS. Only a
--          mutation of the test file itself could move it.
--   § 1.3  the five targets are in the states their cells assume — likewise a
--          fixture precondition, and the thing the other cells are measured
--          AGAINST.
--   § 4.4  eight actors probed on both sides of both sub-arms — the anti-vacuity
--          population floor over this file's own temp tables, which the subject
--          cannot reach.
--   § 5.4  the target actually KEPT its role — an ATOMICITY pin. A mutant that
--          refuses AND writes cannot make it red: the raise unwinds its own
--          subtransaction, so the write is rolled back with it. Its failure mode
--          needs a non-transactional writer, which this door cannot become.
-- ⛔ Four unproven assertions is a BOUND ON THIS AUDIT, not a claim of full
--    coverage of anything else.
--
-- ⚠ THE RESIDUAL WAS RE-DERIVED FROM THE FULL PER-MUTANT RED SETS, NOT FROM THE
--   AUDIT'S PASS/FAIL COLUMN.  `run_case` only checks that its NAMED patterns
--   are `not ok`; it never asserts they are the ONLY reds, so a recorded red-set
--   is a SUBSET of the blast radius and a RED-PROVEN column can hide a mutant
--   that has quietly stopped reaching most of what it used to move.  Amendment 2
--   did exactly that to two mutants (`restore_is_admin_site_b` fell to structural
--   reds only; `site_b_generic_message` moved nothing at all), and both stayed
--   RED-PROVEN while it happened.  The blast radii are recorded at the foot of
--   the audit script; recompute them, do not read the column.
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
select plan(41);

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
returns table (ha_sec uuid, inact_oa uuid, sa_ccih uuid, pa_sa uuid,
               t_grant uuid, t_revoke uuid, t_promo uuid, t_demote uuid,
               t_staff uuid, t_boot uuid, t_boot2 uuid, t_hosp uuid)
language sql immutable as $$
  select '00000000-0000-0000-0000-016700000a01'::uuid,  -- hospital_admin of SECUNDÁRIO A only
         '00000000-0000-0000-0000-016700000a02'::uuid,  -- org_admin of A, but INACTIVE
         '00000000-0000-0000-0000-016700000a03'::uuid,  -- staff_admin of CCIH, nothing else
         '00000000-0000-0000-0000-016700000a04'::uuid,  -- staff_admin of CCIH **and** is_admin
         '00000000-0000-0000-0000-016700000b01'::uuid,  -- grant target   (no membership)
         '00000000-0000-0000-0000-016700000b02'::uuid,  -- revoke target  (staff_admin CCIH)
         '00000000-0000-0000-0000-016700000b03'::uuid,  -- promotion      (staff → staff_admin)
         '00000000-0000-0000-0000-016700000b04'::uuid,  -- demotion       (staff_admin → staff)
         '00000000-0000-0000-0000-016700000d01'::uuid,  -- `staff` revoke target (staff CCIH)
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
     (s ~ 'if p_role = ''staff'' then\s+if not \(app\.is_staff_admin_of_for\(p_scope_id, p_actor\)\s+or app\.is_tenancy_admin_of_for\(p_scope_id, p_actor\)\) then')::text
   from (select pg_temp.src('app', 'grant_role_impl') as s) q),
  '2|true|true|true',
  '0.3 ⛔ PRESERVATION, AND THE ANTI-VACUITY PIN FOR § 0.1/§ 0.2/SITE (c): EXACTLY TWO `is_admin_for` sites remain, each NAMED — organization/org_admin (the bootstrap ADR 0167 checked and kept) and hospital/hospital_admin (AFF T2.5 / ADR 0097 D17 / BLOCKER-1). The fourth term is SITE (c), Amendment 2''s own structural pin: the commission `staff` sub-arm is `is_staff_admin_of_for OR is_tenancy_admin_of_for` — the EXACT text `revoke_role_impl`''s sub-arm carries, which is why § 4 can now be unscoped. Without the count a mutation deleting ALL of them passes every other assertion here; without the site (c) term, one that RESTORES the arm passes every cell that only counts');

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
     (p.prosrc ~ 'ONE ROLE OVER')::text || '|' ||
     (p.prosrc ~ 'ADR 0167')::text
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'revoke_role_impl'),
  'false|false|true',
  '0.5 ⭐ THE RETIRED COMMENT, PINNED IN ALL THREE DIRECTIONS. Term 1: the QA m1 note called the grant/revoke asymmetry INTENTIONAL, and ADR 0167 rules it a defect, so that sentence must be GONE. Term 2 is Amendment 2''s: clause 1 left a NARROWED replacement note saying the same door "survives ONE ROLE OVER" on the `staff` sub-arm — true when written, FALSE now, and Amendment 2 § Consequences 1 retires it outright because a note about an asymmetry that no longer exists is how the original m1 note misled. Term 3: the ruling must be NAMED in their place. A comment is an assertion that goes stale silently and no other gate in this repository can contradict one');

-- ---------------------------------------------------------------------------
-- FIXTURES.  `handle_new_user` mints each profile from `auth.users`.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated',
       x.id || '@adr0167.test', now(), now()
from (
  select unnest(array[
    (select ha_sec from pg_temp.p()),   (select inact_oa from pg_temp.p()),
    (select sa_ccih from pg_temp.p()),  (select pa_sa from pg_temp.p()),
    (select t_grant from pg_temp.p()),  (select t_revoke from pg_temp.p()),
    (select t_promo from pg_temp.p()),  (select t_demote from pg_temp.p()),
    (select t_staff from pg_temp.p()),  (select t_boot from pg_temp.p()),
    (select t_boot2 from pg_temp.p()),  (select t_hosp from pg_temp.p())
  ]) as id
) x;

update public.profiles set full_name = 'ADR 0167 fixture', is_active = true
 where id in (select unnest(array[
   (select ha_sec from pg_temp.p()),   (select inact_oa from pg_temp.p()),
   (select sa_ccih from pg_temp.p()),  (select pa_sa from pg_temp.p()),
   (select t_grant from pg_temp.p()),  (select t_revoke from pg_temp.p()),
   (select t_promo from pg_temp.p()),  (select t_demote from pg_temp.p()),
   (select t_staff from pg_temp.p()),  (select t_boot from pg_temp.p()),
   (select t_boot2 from pg_temp.p()),  (select t_hosp from pg_temp.p())]));

-- ⭐ ACTOR 8 IS `is_admin_for` **AND** A COMMISSION `staff_admin`, DELIBERATELY.
--    After Amendment 2 the `staff` sub-arm refuses a plain platform admin, so a
--    plain platform admin never arrives at site (b) and CANNOT witness it. This
--    principal passes the sub-arm on `is_staff_admin_of_for` and is then stopped
--    by site (b) alone — making it the only actor whose verdict MOVES when site
--    (b)'s dropped `is_admin_for` is restored. Without it, the `restore_is_admin
--    _site_b` mutant degrades to structural reds only and site (b) is pinned by
--    text with nothing behavioural behind it.
update public.profiles set is_admin = true where id = (select pa_sa from pg_temp.p());

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
    (select sa_ccih from pg_temp.p()), (select pa_sa from pg_temp.p()),
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
--    fixture.  The two `staff_admin` ACTORS are seated the same way, and for the
--    same reason: seating them through `grant_role` would exercise the very
--    `staff_admin` arm §§ 2–3 are about to measure.
insert into public.memberships (principal_id, commission_id, role) values
  ((select t_revoke from pg_temp.p()), (select ccih from pg_temp.k()), 'staff_admin'),
  ((select t_promo  from pg_temp.p()), (select ccih from pg_temp.k()), 'staff'),
  ((select t_demote from pg_temp.p()), (select ccih from pg_temp.k()), 'staff_admin'),
  ((select t_staff  from pg_temp.p()), (select ccih from pg_temp.k()), 'staff'),
  ((select sa_ccih  from pg_temp.p()), (select ccih from pg_temp.k()), 'staff_admin'),
  ((select pa_sa    from pg_temp.p()), (select ccih from pg_temp.k()), 'staff_admin');

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
--
-- ⭐ THE EXPECTATION IS PER (ACTOR, ROLE) SINCE AMENDMENT 2, and that is the
--   point rather than bookkeeping.  The two commission sub-arms now read the
--   SAME predicate as each other's revoke side, but they are NOT the same
--   predicate as one another: `staff` admits a third participant
--   (`is_staff_admin_of_for`) that `staff_admin` does not.  Actors 7 and 8 are
--   exactly that class, so a single `expected` column would have forced them out
--   of the grid — and with them the only exercise of the third participant and
--   the only reachable witness for site (b).
--
-- `exp_demote` is a FULL verdict (sqlstate|message), not a sqlstate: § 5.2's
-- whole subject is a refusal that MOVES between statements while keeping 42501.
create temp table actors (
  ord int, label text, actor uuid,
  exp_sa text, exp_st text, exp_demote text) on commit drop;
insert into actors (ord, label, actor, exp_sa, exp_st, exp_demote) values
  (1, 'platform_admin',                (select platform   from pg_temp.k()),
      '42501', '42501', '42501|sem permissão'),
  (2, 'org_admin of the org',          (select oa_a       from pg_temp.k()),
      'ALLOWED', 'ALLOWED', 'ALLOWED'),
  (3, 'hospital_admin of THE hospital',(select ha_central from pg_temp.k()),
      'ALLOWED', 'ALLOWED', 'ALLOWED'),
  (4, 'hospital_admin of ANOTHER hospital, same org',
                                       (select ha_sec     from pg_temp.p()),
      '42501', '42501', '42501|sem permissão'),
  (5, 'org_admin of ANOTHER org',      (select oa_b       from pg_temp.k()),
      '42501', '42501', '42501|sem permissão'),
  (6, 'org_admin of the org, INACTIVE',(select inact_oa   from pg_temp.p()),
      '42501', '42501', '42501|sem permissão'),
  (7, 'staff_admin of THE commission', (select sa_ccih    from pg_temp.p()),
      '42501', 'ALLOWED',
      '42501|sem permissão para alterar a função de um administrador da comissão'),
  (8, 'staff_admin of THE commission, ALSO platform_admin',
                                       (select pa_sa      from pg_temp.p()),
      '42501', 'ALLOWED',
      '42501|sem permissão para alterar a função de um administrador da comissão');

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
            app.is_staff_admin_of_for((select ccih from pg_temp.k()), a.actor)::text || '/' ||
            app.is_tenancy_admin_of_for((select ccih from pg_temp.k()), a.actor)::text || '/' ||
            app.is_active(a.actor)::text, ' ; ' order by a.ord)
     from actors a),
  'platform_admin=true/false/false/true ; '
  'org_admin of the org=false/false/true/true ; '
  'hospital_admin of THE hospital=false/false/true/true ; '
  'hospital_admin of ANOTHER hospital, same org=false/false/false/true ; '
  'org_admin of ANOTHER org=false/false/false/true ; '
  'org_admin of the org, INACTIVE=false/false/false/false ; '
  'staff_admin of THE commission=false/true/false/true ; '
  'staff_admin of THE commission, ALSO platform_admin=true/true/false/true',
  '1.2 ⭐ WRONG-ARM GUARD: each actor sits in the authority class its label claims (is_admin_for / is_staff_admin_of_for / is_tenancy_admin_of_for / is_active). Actor 4 is sharp on the tenancy axis — false on TENANCY while sharing the organisation with actor 2, so its refusal isolates the HOSPITAL term rather than re-testing cross-org isolation. ⭐ Actors 7 and 8 are the axis Amendment 2 added: both carry the `staff` sub-arm''s THIRD participant and neither is a tenancy admin, and they differ ONLY in `is_admin_for` — which is what makes 8 the site (b) witness and 7 its control. Without this cell they could quietly become the same actor twice');

select is(
  (select count(*)::int from public.memberships where principal_id = (select t_grant from pg_temp.p()))::text || '|' ||
  (select role from public.memberships where principal_id = (select t_revoke from pg_temp.p()))::text || '|' ||
  (select role from public.memberships where principal_id = (select t_promo from pg_temp.p()))::text || '|' ||
  (select role from public.memberships where principal_id = (select t_demote from pg_temp.p()))::text || '|' ||
  (select role from public.memberships where principal_id = (select t_staff from pg_temp.p()))::text,
  '0|staff_admin|staff|staff_admin|staff',
  '1.3 the five targets are in the states their cells assume — the grant target holds NOTHING (so § 2 exercises the INSERT path) and the demotion target already holds `staff_admin` (so § 5 reaches site (b) at all). ⛔ `t_staff` is load-bearing in a way the others are not: it is the `staff` REVOKE target, and revoking a role the target does not hold deletes zero rows and returns ALLOWED — so a fixture that lost this row would make half of § 4''s unscoped population pass while measuring nothing');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'grant_role'),
  'true',
  '1.4 ⛔ THE REACHABILITY THIS NARROWING IS ABOUT: `public.grant_role` is EXECUTE-able by `authenticated`, so the capability ADR 0167 removes was reachable over PostgREST by any signed-in platform admin — regardless of what the TypeScript gate or the /o/[org]/manage layout allow. "Not reachable through the UI" would have been the wrong measure');

-- ===========================================================================
-- § 2 THE GRANT GRID.  Subject-keyed: one row per ACTOR, the thing the ruling is
--     about — never keyed by assertion number.
--
--     ⭐ THE GRID GAINED A `role` DIMENSION WITH AMENDMENT 2.  Both commission
--     sub-arms are now driven from the SAME actor set through the SAME probe, so
--     § 4's agreement property spans the whole commission branch instead of half
--     of it.  The `staff` side uses its own targets: `t_grant` (holds nothing) on
--     the grant side, `t_staff` (holds `staff`) on the revoke side.
-- ===========================================================================

create temp table grid (ord int, kind text, role text, verdict text) on commit drop;

insert into grid (ord, kind, role, verdict)
select a.ord, 'grant', 'staff_admin',
       pg_temp.probe('grant', a.actor, (select ccih from pg_temp.k()),
                     'staff_admin', (select t_grant from pg_temp.p()))
from actors a;

insert into grid (ord, kind, role, verdict)
select a.ord, 'revoke', 'staff_admin',
       pg_temp.probe('revoke', a.actor, (select ccih from pg_temp.k()),
                     'staff_admin', (select t_revoke from pg_temp.p()))
from actors a;

insert into grid (ord, kind, role, verdict)
select a.ord, 'grant', 'staff',
       pg_temp.probe('grant', a.actor, (select ccih from pg_temp.k()),
                     'staff', (select t_grant from pg_temp.p()))
from actors a;

insert into grid (ord, kind, role, verdict)
select a.ord, 'revoke', 'staff',
       pg_temp.probe('revoke', a.actor, (select ccih from pg_temp.k()),
                     'staff', (select t_staff from pg_temp.p()))
from actors a;

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff_admin' and ord = 1),
  '42501',
  '2.1 ⛔ THE NARROWING: a platform_admin may NO LONGER grant commission `staff_admin`. This is the assertion ADR 0167 clause 1 exists for, and the one that was ALLOWED at head 20261003005900');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff_admin' and ord = 2),
  'ALLOWED',
  '2.2 an `org_admin` of the commission''s organisation grants it');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff_admin' and ord = 3),
  'ALLOWED',
  '2.3 a `hospital_admin` of the commission''s HOSPITAL grants it — the tier the DB door has admitted all along and the TypeScript gate refused');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff_admin' and ord = 4),
  '42501',
  '2.4 …but a `hospital_admin` of ANOTHER hospital in the SAME organisation is refused: the hospital term is scoped to `commissions.hospital_id`, not to the org');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff_admin' and ord = 5),
  '42501',
  '2.5 an `org_admin` of another organisation is refused (tenant isolation survives the narrowing)');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff_admin' and ord = 6),
  '42501',
  '2.6 a DEACTIVATED `org_admin` of the right organisation is refused — `is_tenancy_admin_of_for` conjoins `app.is_active`, and dropping the platform arm must not have made the account state the only surviving check');

-- ⭐ THE TWO CELLS AMENDMENT 2 IS ABOUT.  They replace § 6, which pinned this
--    same pair as an OPEN GAP (`platform_admin` seats `staff` = ALLOWED) and
--    carried its own instruction to be DELETED rather than repaired once the gap
--    closed.  Deleting it without re-homing its subject would have left the
--    newly-ruled policy measured only inside § 4's serialized blob.
select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff' and ord = 1),
  '42501',
  '2.7 ⛔ THE AMENDMENT-2 NARROWING: a platform_admin may no longer grant commission `staff` either. The gap § 6 used to pin as awaiting a PO ruling is CLOSED, in the direction ADR 0167 closed its sibling — by narrowing grant down to revoke, never by widening revoke');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'grant' and role = 'staff' and ord = 7),
  'ALLOWED',
  '2.8 ⭐ THE THIRD PARTICIPANT SURVIVED THE NARROWING: a commission `staff_admin` — neither `is_admin_for` nor a tenancy admin — still grants plain `staff`. Amendment 2 removed ONE disjunct, and an over-eager narrowing that removed the arm wholesale would look identical to § 2.7 alone');

-- ===========================================================================
-- § 3 THE REVOKE GRID.  Same actors, same commission, same instrument.
-- ===========================================================================

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and role = 'staff_admin' and ord = 1),
  '42501',
  '3.1 a platform_admin may not revoke commission `staff_admin` — UNCHANGED by ADR 0167. The ruling aligns grant DOWN to this, it does not move this UP');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and role = 'staff_admin' and ord = 2),
  'ALLOWED',
  '3.2 an `org_admin` of the commission''s organisation revokes it');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and role = 'staff_admin' and ord = 3),
  'ALLOWED',
  '3.3 a `hospital_admin` of the commission''s hospital revokes it');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and role = 'staff_admin' and ord = 4),
  '42501',
  '3.4 a `hospital_admin` of another hospital in the same organisation is refused');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and role = 'staff_admin' and ord = 5),
  '42501',
  '3.5 an `org_admin` of another organisation is refused');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and role = 'staff_admin' and ord = 6),
  '42501',
  '3.6 a DEACTIVATED `org_admin` of the right organisation is refused');

select is(
  (select split_part(verdict, '|', 1) from grid where kind = 'revoke' and role = 'staff' and ord = 1),
  '42501',
  '3.7 …and a platform_admin still may not REVOKE commission `staff` — the half of the old § 6 that was never in question. It is § 2.7 + § 3.7 together that say the one-way door is gone rather than inverted, and § 4.1 that says so for every actor');

-- ===========================================================================
-- § 4 THE AGREEMENT PROPERTY — the ADR''s whole point, expressed as a PROPERTY
--     over the actor set rather than as six hand-paired cells, so an actor
--     added later is covered without anyone remembering to pair it.
--
--     ⭐ UNSCOPED SINCE AMENDMENT 2, AND THAT IS STRICTLY STRONGER.  Clause 1
--     had to bound this to `staff_admin` because the `'staff'` sub-arm still
--     disagreed across grant and revoke and closing it was out of scope; the
--     bound was a caveat three separate comments had to carry.  Both sub-arms
--     now read predicates that are identical text, so the property spans the
--     WHOLE commission branch and the caveat has no subject.
-- ===========================================================================

select is(
  (select count(*)::int
     from grid g join grid r
       on g.ord = r.ord and g.role = r.role
      and g.kind = 'grant' and r.kind = 'revoke'
    where split_part(g.verdict, '|', 1) is distinct from split_part(r.verdict, '|', 1)),
  0,
  '4.1 ⭐ THE PROPERTY, NOW OVER BOTH COMMISSION SUB-ARMS: for EVERY actor and EVERY commission role, granting and revoking reach the SAME verdict. A one-way door is exactly a row where these two differ — before ADR 0167 the (platform_admin, staff_admin) row did, and before Amendment 2 the (platform_admin, staff) row did');

select is(
  (select string_agg(kind || '/' || role || '=' || n::text, ' ; ' order by kind, role)
     from (select kind, role, count(distinct split_part(verdict, '|', 1))::int as n
             from grid group by kind, role) q),
  'grant/staff=2 ; grant/staff_admin=2 ; revoke/staff=2 ; revoke/staff_admin=2',
  '4.2 ⛔ POSITIVE TWIN, PER SUB-ARM: each of the four columns contains BOTH outcomes. An all-deny grid — or an all-permit one — satisfies § 4.1 vacuously, and an over-eager narrowing that refused everyone would look exactly like a fix. ⚠ Grouping matters: a single global count of 2 would be satisfied by one all-deny column beside one all-permit column');

select is(
  (select string_agg(a.label || '/' || g.role || '=' || split_part(g.verdict, '|', 1),
                     ' ; ' order by g.role, a.ord)
     from actors a join grid g on g.ord = a.ord and g.kind = 'grant'),
  (select string_agg(a.label || '/' || r.role || '=' ||
            case r.role when 'staff' then a.exp_st else a.exp_sa end,
                     ' ; ' order by r.role, a.ord)
     from actors a cross join (values ('staff'), ('staff_admin')) as r(role)),
  '4.3 …and the shared verdict is the DECLARED one per (actor, role), not merely a shared one: § 4.1 + § 4.2 are both satisfied by a grid that agreed on the WRONG answer for a middle actor. ⭐ The per-role split is what makes actors 7/8 assert something § 4.1 cannot see — they are DENIED on `staff_admin` and ALLOWED on `staff`, so a sub-arm that lost its third participant reds here while § 4.1 stays green');

select is(
  (select count(*)::int from actors)::text || '|' ||
  (select count(*)::int from grid)::text,
  '8|32',
  '4.4 ⛔ THE PROPERTY IS NOT VACUOUS BY AN EMPTY POPULATION: eight actors probed on both sides of both sub-arms. A `where` clause that silently matched nothing would satisfy § 4.1 with zero disagreements over zero rows. ⚠ The floor moved 6|12 → 8|32 with Amendment 2 — 6|24 from unscoping the role, plus the two actors site (b) and the third participant needed');

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
  (select string_agg(a.label || '=' || a.exp_sa, ' ; ' order by a.ord) from actors a),
  '5.1 PROMOTION `staff` → `staff_admin` runs the SAME authority set as a fresh grant. It reaches site (a) and then the T1.0 replacement UPDATE, so a fix applied only to the INSERT path would show here');

select is(
  (select string_agg(a.label || '=' ||
            pg_temp.probe('grant', a.actor, (select ccih from pg_temp.k()),
                          'staff', (select t_demote from pg_temp.p())),
            ' ; ' order by a.ord)
     from actors a),
  (select string_agg(a.label || '=' || a.exp_demote, ' ; ' order by a.ord) from actors a),
  '5.2 ⛔ DEMOTION `staff_admin` → `staff`, COMPARED BY FULL VERDICT RATHER THAN SQLSTATE, AND THAT RE-CUT IS THE POINT. Amendment 2 refuses the platform_admin at the `staff` SUB-ARM, one statement before site (b) — so this cell kept its 42501 while its subject silently changed from "site (b) stopped it" to "the arm stopped it". Comparing sqlstate|message makes a refusal that MOVES visible: actors 1/4/5/6 must carry the arm''s generic `sem permissão`, and actors 7/8 — the only class that still reaches site (b) — must carry site (b)''s own message');

select is(
  pg_temp.probe('grant', (select pa_sa from pg_temp.p()), (select ccih from pg_temp.k()),
                'staff', (select t_demote from pg_temp.p())),
  '42501|sem permissão para alterar a função de um administrador da comissão',
  '5.3 ⛔ THE SITE DISCRIMINATOR, RE-HOMED BY AMENDMENT 2 ONTO THE ONLY ACTOR THAT CAN STILL MOVE IT. It used to drive a plain platform_admin, who now never reaches site (b) at all — leaving the site pinned by § 0.2''s text with NOTHING behavioural behind it. This actor is a commission `staff_admin` who is ALSO `is_admin_for`: it passes the `staff` sub-arm on the third participant, so site (b) is the one statement deciding its fate, and restoring site (b)''s dropped `is_admin_for` flips it to ALLOWED. ⚠ Actor 7 is the control — same path, no `is_admin_for`, same refusal (§ 5.2) — so this cell measures the ARM that was dropped and not merely that demotion is guarded');

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
-- § 6 DELETED BY AMENDMENT 2 — ON ITS OWN WRITTEN INSTRUCTION, NOT REPAIRED.
--
--     It pinned the surviving `staff` asymmetry as a KNOWN GAP (`6.1` a
--     platform_admin can still SEAT a commission `staff` = ALLOWED; `6.2` and
--     still cannot REMOVE one), and it carried the instruction: "IF EITHER CELL
--     BELOW REDS, THE GAP HAS PROBABLY BEEN CLOSED — read the PO ruling, then
--     DELETE this section rather than 'repairing' it."  § 6.1 red on the
--     narrowing; the PO ruling is ADR 0167 Amendment 2.
--
--     ⛔ ITS SUBJECT WAS RE-HOMED, NOT DROPPED.  The pair now lives as § 2.7 +
--     § 3.7, asserting the CLOSED policy instead of the open gap, and § 4.1
--     covers it for every actor rather than for the platform admin alone.
--     Deleting the section without moving its subject would have retired the
--     only readable sentence about a policy that had just been ruled on.
-- ===========================================================================

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
