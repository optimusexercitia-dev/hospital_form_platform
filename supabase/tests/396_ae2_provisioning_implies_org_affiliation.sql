-- AE2 · QA R2-B1 — GOVERNANCE-ROLE PROVISIONING IMPLIES AN ORGANIZATION
-- AFFILIATION.  Ruling: ADR 0166 (eight binding clauses).  Phase record:
-- docs/progress/authz-ae2.md § "R2-B1 — the kernel invariant".
--
-- ============================================================================
-- ⛔ THE INVARIANT THIS FILE EXISTS FOR
-- ============================================================================
-- After any SUCCESSFUL exposed role grant where
--     (p_scope_type = 'organization' and p_role = 'org_admin')
--  or (p_scope_type = 'commission'   and p_role = 'staff_admin')
-- the target holds an ACTIVE, NON-VOIDED `organization_affiliations` row in the
-- organisation that owns the granted scope.  Postcondition, all three conjuncts:
--     membership exists  ∧  active org affiliation in the same organisation
--     ∧  target ABSENT from `app.tenant_orphan_profiles()`.
--
-- ⛔ THE SEAM IS THE SHARED KERNEL, NOT THE TWO TYPESCRIPT CALLERS.  A fix in
--    `assignOrgAdmin` / `assignStaffAdmin` leaves `app.grant_role_impl` able to
--    recreate the state, and a second `affiliate_person_to_org_for` call from
--    TypeScript would be a SECOND TRANSACTION — recreating the
--    membership-without-affiliation partial write it exists to remove
--    (ADR 0166 § Consequences).  So the subject of this file is
--    `app.grant_role_impl` + `app.ensure_provisioned_org_affiliation`, and every
--    behavioural cell goes through a REAL exposed door.
--
-- ⛔ IT MUST NOT BE A PLATFORM-ADMIN ARM ON `app.affiliate_person_to_org_impl`.
--    That door is `is_org_admin_of_for`-only BY DESIGN (the noun rule); widening
--    it would broaden employment/affiliation authority far beyond ADR 0166.
--    § 0.8 pins that door's authority predicate so the shortcut reds here.
--
-- ============================================================================
-- ⭐ THE CELL THAT IS EASY TO MISS, AND IS THEREFORE THE KEYSTONE (§ 3)
-- ============================================================================
-- `app.grant_role_impl`'s commission tier has a T1.0 ATOMIC-REPLACEMENT branch
-- that `return`s EARLY after updating an existing membership row.  A helper call
-- placed next to the final INSERT is therefore DEAD for every
-- `staff` → `staff_admin` PROMOTION — which is exactly what `assignStaffAdmin`
-- supports and documents ("promoting an existing 'staff' member updates the row
-- in place").  § 3.3 is the behavioural cell that reds when the call moves below
-- that `return`; § 0.7 is the cheap structural twin of the same statement.
--
-- ⛔ AND THE FIXTURE FOR § 3 CANNOT BE BUILT OUT OF THE SUBJECT.  P3's `staff`
--    membership is inserted DIRECTLY (owner context), never through `grant_role`
--    — a fixture that seats the member through the door under test would have
--    already created the affiliation the cell is about to measure.
--
-- ============================================================================
-- ⚠ TWO DECLARED NARROWINGS OF `grant_role_impl`, MEASURED NOT ASSUMED
-- ============================================================================
-- ADR 0166 clause 5 says a person whose non-voided affiliations are entirely in
-- ANOTHER organisation "remains refused".  MEASURED: at head 20261003005800 they
-- were NOT refused — `grant_role_impl`'s org_admin / staff_admin arms carry NO
-- tenancy check on the TARGET at all, so an org_admin of A could seat any
-- profile on the platform, including one affiliated only to B.  This file pins
-- the new refusal as a NARROWING (§ 5.4) rather than repeating the ADR's word.
-- The same holds for clause 6 (§ 5.2): seating a platform administrator as a
-- tenant governance principal succeeded before and is refused now.
--
-- ⚠ AND A DELIBERATE DEVIATION FROM THE SUPPLIED PSEUDOCODE, PINNED AT § 5.5.
--   The design ordered the helper's checks inactive-BEFORE-foreign.  This
--   implementation orders them foreign-BEFORE-inactive, mirroring
--   `app.affiliate_person_to_org_impl` byte-for-byte.  The ONE cell where the
--   two orders differ is a target who is both inactive AND foreign-affiliated:
--   the supplied order answers HC0R4 (deactivated — leaking that the uuid names
--   a real, deactivated person in another tenant), the sibling's order answers
--   HC0R0 (conflated with "not found").  ⛔ ORACLE-KILL is a documented,
--   load-bearing property of this door family, so the sibling's order wins and
--   the difference is made VISIBLE here instead of argued.  § 5.5 is the cell to
--   flip if the PO rules the other way — one `if` block moves, one expectation.
--
-- ============================================================================
-- ⭐ B5 (QA round 2, R2-M1) — THE CATALOG COMMENT, AS A GATE
-- ============================================================================
-- `comment on function app.tenant_orphan_profiles()` said "administrable by
-- platform_admin alone".  ADR 0166 § "The grain correction" supersedes BOTH that
-- sentence and its first correction ("administrable by NOBODY").  Nothing in the
-- repo pinned the comment, which is how it survived four other corrections in
-- the same file.  § 8 pins it in BOTH directions — the new grain present AND the
-- retired sentence absent — because a comment is an assertion that goes stale
-- silently and no other gate can contradict it.
-- ============================================================================

begin;
select plan(63);

-- ---------------------------------------------------------------------------
-- Constants.  Seed ids only.  Every constructed id lives in a `0ae2460…`
-- namespace disjoint from 390–395, so nothing is shared across suites and
-- nothing is ever deleted positionally.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (org_a uuid, org_b uuid, org_c uuid,
               ccih uuid, farmacia uuid, qualidade_b uuid,
               hosp_c uuid, central_a uuid,
               oa_a uuid, oa_b uuid, oa_c uuid,
               platform uuid, chefe_ccih uuid, chefe_farm uuid,
               staff1_ccih uuid, inativo uuid)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         '0c000000-0000-0000-0000-00000000000c'::uuid,  -- Rede Hospitalar C (ONE hospital)
         'a0000000-0000-0000-0000-0000000000a1'::uuid,  -- comissão CCIH        (org A)
         'b0000000-0000-0000-0000-0000000000b1'::uuid,  -- comissão Farmácia    (org A)
         'c0000000-0000-0000-0000-0000000000c1'::uuid,  -- comissão Qualidade   (org B)
         '05000000-0000-0000-0000-00000000000c'::uuid,  -- Hospital Único C
         '05000000-0000-0000-0000-00000000000a'::uuid,  -- Hospital Central A
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- orgadmin.a
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- orgadmin.b
         '00000000-0000-0000-0000-0000000000c0'::uuid,  -- solo.c  (org_admin + affiliation in C ONLY)
         '00000000-0000-0000-0000-0000000000b0'::uuid,  -- platform@test.local (is_admin)
         '00000000-0000-0000-0000-000000000002'::uuid,  -- chefe.ccih   (staff_admin CCIH)
         '00000000-0000-0000-0000-000000000005'::uuid,  -- chefe.farm   (staff_admin Farmácia)
         '00000000-0000-0000-0000-000000000003'::uuid,  -- staff1.ccih  (no admin authority)
         '00000000-0000-0000-0000-0000000000d4'::uuid;  -- desativado.conta (is_active = false, affiliated A)
$$;
grant execute on function pg_temp.k() to authenticated, service_role;

create or replace function pg_temp.p()
returns table (p1 uuid, p2 uuid, p3 uuid, p4 uuid, p5 uuid, p6 uuid, p7 uuid,
               p8 uuid, p9 uuid, p10 uuid, p11 uuid, p12 uuid, p13 uuid,
               ghost uuid, orphan_member uuid, orphan_plain uuid)
language sql immutable as $$
  select '00000000-0000-0000-0000-0ae2460a0001'::uuid,  -- P1  org_admin positive
         '00000000-0000-0000-0000-0ae2460a0002'::uuid,  -- P2  staff_admin positive
         '00000000-0000-0000-0000-0ae2460a0003'::uuid,  -- P3  staff → staff_admin PROMOTION
         '00000000-0000-0000-0000-0ae2460a0004'::uuid,  -- P4  ENDED non-voided row in A
         '00000000-0000-0000-0000-0ae2460a0005'::uuid,  -- P5  VOIDED-only history in A
         '00000000-0000-0000-0000-0ae2460a0006'::uuid,  -- P6  forced AFFILIATION failure
         '00000000-0000-0000-0000-0ae2460a0007'::uuid,  -- P7  forced MEMBERSHIP failure
         '00000000-0000-0000-0000-0ae2460a0008'::uuid,  -- P8  single-hospital org C provisioning
         '00000000-0000-0000-0000-0ae2460a0009'::uuid,  -- P9  scope bound: 'staff'
         '00000000-0000-0000-0000-0ae2460a000a'::uuid,  -- P10 scope bound: 'nsp_org_admin'
         '00000000-0000-0000-0000-0ae2460a000b'::uuid,  -- P11 scope bound: 'hospital_admin'
         '00000000-0000-0000-0000-0ae2460a000c'::uuid,  -- P12 INACTIVE and affiliated to B only
         '00000000-0000-0000-0000-0ae2460a000d'::uuid,  -- P13 ENDED non-voided in B ONLY (never active)
         '00000000-0000-0000-0000-0ae2460a00ff'::uuid,  -- ghost: NO profile at all
         '00000000-0000-0000-0000-0ae2460a00e1'::uuid,  -- detector: membership, no affiliation
         '00000000-0000-0000-0000-0ae2460a00e2'::uuid;  -- detector: no membership, no affiliation
$$;
grant execute on function pg_temp.p() to authenticated, service_role;

-- ============================================================================
-- § 0 STRUCTURAL PINS — asserted before any fixture exists, so a fixture that
--     cannot be built against the OLD catalog still leaves these verdicts
--     legible.  Every one reads `pg_proc`, never a migration file.
-- ============================================================================

select is(
  (select p.prosecdef::text || '|' || l.lanname || '|' || pg_get_function_result(p.oid)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_language  l on l.oid = p.prolang
    where n.nspname = 'app' and p.proname = 'ensure_provisioned_org_affiliation'),
  'true|plpgsql|uuid',
  '0.1 the internal module exists, is SECURITY DEFINER and returns the affiliation id — a DEFINER because the affiliation write must not be evaluated through the provisioning caller''s RLS lens');

select is(
  (select array_to_string(p.proconfig, ',')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'ensure_provisioned_org_affiliation'),
  'search_path=app, public, pg_catalog',
  '0.2 …with a PINNED search_path set in the same migration as the DEFINER flag — a DEFINER without one is the resolution-hijack shape');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text || '|' ||
          has_function_privilege('anon',          p.oid, 'execute')::text || '|' ||
          has_function_privilege('service_role',  p.oid, 'execute')::text || '|' ||
          has_function_privilege('postgres',      p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'ensure_provisioned_org_affiliation'),
  'false|false|false|true',
  '0.3 ⭐ EXECUTE is OWNER-ONLY — service_role included, because this module takes an explicit actor and performs NO authority check of its own; anyone able to call it could name any actor. Asserted POSITIVELY per role via has_function_privilege, never by reading proacl for an absence (a NULL proacl includes PUBLIC — the guard that reads right and fails open)');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text || '|' ||
          has_function_privilege('service_role',  p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'grant_role_for'),
  'false|true',
  '0.4 `public.grant_role_for` is STILL service_role-only — its explicit p_actor would be forgeable by any signed-in caller otherwise. Preserved, not merely untouched');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text || '|' ||
          has_function_privilege('service_role',  p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'grant_role'),
  'true|true',
  '0.5 …and the session door `public.grant_role` is STILL reachable by authenticated — the invariant landed in the kernel without narrowing the door''s audience');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')::text || '|' ||
          has_function_privilege('service_role',  p.oid, 'execute')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'grant_role_impl'),
  'false|false',
  '0.6 …and `app.grant_role_impl` is STILL owner-only (the actor-kernel triple, ADR 0098 §W2.1)');

select ok(
  (select position('ensure_provisioned_org_affiliation' in p.prosrc) > 0
      and position('ensure_provisioned_org_affiliation' in p.prosrc)
        < position('select id, role into v_existing_id, v_existing_role' in p.prosrc)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'grant_role_impl'),
  '0.7 ⭐ SHAPE PIN: the ensure call precedes the T1.0 atomic-replacement block, which `return`s EARLY. Anchored on that block''s first STATEMENT, not on a comment. Its behavioural twin is § 3.3 — this cell is the cheap half and § 3.3 is the one that must red');

select is(
  (select (regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_admin_for')::text || '|' ||
          (regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_org_admin_of_for')::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'affiliate_person_to_org_impl'),
  'false|true',
  '0.8 ⛔ THE SHORTCUT THAT WAS FORBIDDEN, AS A GATE: the ordinary affiliation door STILL has no platform-admin arm. ADR 0166 § Consequences rules that implementing this invariant by widening that door would broaden employment authority far beyond the decision. Measured with `--` comments STRIPPED, because the door''s own comment quotes the arm it deliberately does not have');

-- ---------------------------------------------------------------------------
-- ⭐ THE ORPHAN SNAPSHOT IS TAKEN **BEFORE** THE FIXTURES EXIST.  This file
--    deliberately CONSTRUCTS orphans (P1…P12 all start unaffiliated); measuring
--    the live population afterwards would let a later refactor pass § 9 by
--    counting its own fixtures.
-- ---------------------------------------------------------------------------
create temp table ae2r2_seed_orphans as
  select * from app.tenant_orphan_profiles();

-- ---------------------------------------------------------------------------
-- FIXTURES.  `handle_new_user` mints each profile from `auth.users`.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', x.id, 'authenticated', 'authenticated',
       x.id || '@ae2r2.test', now(), now()
from (
  select unnest(array[
    (select p1 from pg_temp.p()), (select p2 from pg_temp.p()), (select p3 from pg_temp.p()),
    (select p4 from pg_temp.p()), (select p5 from pg_temp.p()), (select p6 from pg_temp.p()),
    (select p7 from pg_temp.p()), (select p8 from pg_temp.p()), (select p9 from pg_temp.p()),
    (select p10 from pg_temp.p()), (select p11 from pg_temp.p()), (select p12 from pg_temp.p()),
    (select p13 from pg_temp.p()),
    (select orphan_member from pg_temp.p()), (select orphan_plain from pg_temp.p())
  ]) as id
) x;

update public.profiles set full_name = 'AE2 R2B1 fixture', is_active = true
 where id in (select unnest(array[
   (select p1 from pg_temp.p()), (select p2 from pg_temp.p()), (select p3 from pg_temp.p()),
   (select p4 from pg_temp.p()), (select p5 from pg_temp.p()), (select p6 from pg_temp.p()),
   (select p7 from pg_temp.p()), (select p8 from pg_temp.p()), (select p9 from pg_temp.p()),
   (select p10 from pg_temp.p()), (select p11 from pg_temp.p()), (select p12 from pg_temp.p()),
   (select p13 from pg_temp.p()),
   (select orphan_member from pg_temp.p()), (select orphan_plain from pg_temp.p())]));

-- P12 is the ONE deviation cell: INACTIVE **and** affiliated to another tenant.
update public.profiles set is_active = false where id = (select p12 from pg_temp.p());

insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason, created_by)
values
  -- P4 — an ENDED, NON-VOIDED row in A.  Clause 4: reactivation is a NEW ACTIVE
  -- row; history is not rewritten.
  ((select p4 from pg_temp.p()), (select org_a from pg_temp.k()),
   date '2025-01-01', date '2026-01-10', (select oa_a from pg_temp.k()),
   null, null, null, (select oa_a from pg_temp.k())),
  -- P5 — VOIDED-only history in A.  "Voided" is "was never true" (ADR 0163
  -- bound 1), so P5 counts as KNOWN NOWHERE, not as known-here.
  ((select p5 from pg_temp.p()), (select org_a from pg_temp.k()),
   date '2025-01-01', null, null, now(), (select oa_a from pg_temp.k()),
   'lançamento equivocado', (select oa_a from pg_temp.k())),
  -- P12 — active in B only, and the profile is deactivated.
  ((select p12 from pg_temp.p()), (select org_b from pg_temp.k()),
   date '2025-01-01', null, null, null, null, null, (select oa_b from pg_temp.k())),
  -- P13 — an ENDED, NON-VOIDED row in B and NOTHING ELSE.  This is the cell that
  -- separates "non-voided" from "active" on the COLLISION side: P13 is known to B
  -- (their tenancy there is history, not a void) and must therefore be refused by A,
  -- even though they hold no ACTIVE affiliation anywhere.  Without it, narrowing the
  -- collision check to active-only would pass every other cell in this file.
  ((select p13 from pg_temp.p()), (select org_b from pg_temp.k()),
   date '2025-01-01', date '2026-02-01', (select oa_b from pg_temp.k()),
   null, null, null, (select oa_b from pg_temp.k()));

-- ⛔ P3's `staff` membership is inserted DIRECTLY, never through `grant_role`.
--    Seating it through the door under test would have created the affiliation
--    § 3.3 is about to measure — the fixture would have built its world out of
--    the subject.  Same for `orphan_member`, § 9.2's control.
insert into public.memberships (commission_id, principal_id, role) values
  ((select ccih from pg_temp.k()), (select p3 from pg_temp.p()), 'staff'),
  ((select ccih from pg_temp.k()), (select orphan_member from pg_temp.p()), 'staff');

-- The error-trapping caller.  A plpgsql exception block is an implicit
-- SUBTRANSACTION, so a raise rolls back everything the call wrote — which is
-- exactly the postcondition clause 2 demands, and why every refusal cell below
-- is followed by a ROW-ABSENCE assertion rather than stopping at "it raised".
create or replace function pg_temp.try_grant(
  p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid)
returns text language plpgsql as $$
declare v_msg text;
begin
  perform public.grant_role_for(p_actor, p_scope_type, p_scope_id, p_role, p_user);
  return 'ok';
exception when others then
  get stacked diagnostics v_msg = message_text;
  return sqlstate || '|' || v_msg;
end;
$$;

-- ============================================================================
-- § 1 THE ORGANIZATION / ORG_ADMIN LEG — `assignOrgAdmin`'s exact shape:
--     a platform admin, through the SERVICE door, naming itself as actor.
-- ============================================================================

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p1 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.memberships
    where principal_id = (select p1 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select p1 from pg_temp.p()))::text,
  '0|0|1',
  '1.0 PRECONDITION: P1 is the R2-B1 population before the grant — zero affiliations, zero memberships, and REPORTED by the orphan detector. Without this floor every § 1 cell below could pass over a person who was already fine');

select is(
  pg_temp.try_grant((select platform from pg_temp.k()), 'organization',
                    (select org_a from pg_temp.k()), 'org_admin', (select p1 from pg_temp.p())),
  'ok',
  '1.1 a platform admin provisions org A''s org_admin through grant_role_for — the shape assignOrgAdmin uses');

select is(
  (select m.role || '|' || (m.organization_id = (select org_a from pg_temp.k()))::text || '|' ||
          (m.hospital_id is null)::text || '|' || (m.commission_id is null)::text
     from public.memberships m where m.principal_id = (select p1 from pg_temp.p())),
  'org_admin|true|true|true',
  '1.2 the MEMBERSHIP landed at the org tier, unchanged in shape — the invariant is additive, it does not re-scope the grant');

select is(
  (select (oa.ended_on is null)::text || '|' || (oa.voided_at is null)::text || '|' ||
          (oa.organization_id = (select org_a from pg_temp.k()))::text || '|' ||
          (oa.created_by = (select platform from pg_temp.k()))::text || '|' ||
          (oa.started_on = current_date)::text
     from public.organization_affiliations oa
    where oa.principal_id = (select p1 from pg_temp.p())),
  'true|true|true|true|true',
  '1.3 ⭐ …and so did an ACTIVE, NON-VOIDED affiliation in the SAME organisation, created_by the REAL provisioning actor (clause 7 — never the provisioned person) and started on the provisioning date (clause 8)');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p1 from pg_temp.p())),
  1,
  '1.4 exactly ONE affiliation row — the implied row is an `organization_affiliations` row and nothing else (clause 1)');

select is(
  (select count(*)::int from public.hospital_affiliations
    where principal_id = (select p1 from pg_temp.p())),
  0,
  '1.5 ⛔ …and NO hospital affiliation was invented (clause 1, explicitly: no hospital, no employee number, no job title, no employment assertion)');

select is(
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select p1 from pg_temp.p())),
  0,
  '1.6 P1 is ABSENT from the orphan detector — the third conjunct of the postcondition, and the reason ADR 0164''s "exceptional population" premise becomes true again');

select is(
  (select count(*)::int from app.person_authority_orgs((select p1 from pg_temp.p()))
    where organization_id = (select org_a from pg_temp.k())),
  1,
  '1.7 `app.person_authority_orgs(P1)` now contains org A — the predicate ALL SIX person-authority doors are derived from. Before the grant it was ∅ for every caller');

select test_helpers.claims_for((select oa_a from pg_temp.k()), false, 'org_admin');
select is(
  (select count(*)::int from public.list_org_people((select org_a from pg_temp.k()))
    where user_id = (select p1 from pg_temp.p())),
  1,
  '1.8 …and P1 appears in org A''s people roster, read by a real org_admin (the roster has been affiliation-filtered since AFF4 D10, so this is the visibility half R2-B1 measured as permanently broken)');

select is(
  (select count(*)::int from public.list_addable_commission_members((select ccih from pg_temp.k()))
    where user_id = (select p1 from pg_temp.p())),
  1,
  '1.9 …and in the commission-member picker (the DEFINER door, whose org predicate is the same affiliation fact)');

select is(
  (select count(*)::int from public.audit_log a
    where a.entity_type = 'organization_affiliation' and a.action = 'org_affiliation.created'
      and a.entity_id = (select oa.id from public.organization_affiliations oa
                          where oa.principal_id = (select p1 from pg_temp.p())))::text || '|' ||
  (select count(*)::int from public.audit_log a
    where a.entity_type = 'membership' and a.action = 'membership.granted'
      and a.entity_id = (select m.id from public.memberships m
                          where m.principal_id = (select p1 from pg_temp.p())))::text,
  '1|1',
  '1.10 ⭐ ARCHITECTURE RULE 11: the IMPLIED affiliation emits its own audit row (`org_affiliation.created`) beside the membership''s, keyed by entity_id rather than by a time window. A fact created as a side effect of another operation is exactly the kind that gets written without a trail. ⚠ RESIDUAL, measured: `audit_log.actor_id` is NULL on the service path because the trigger reads `auth.uid()` and `grant_role_for` carries no session — pre-existing, not introduced here; the REAL actor is on the affiliation row itself (`created_by`, § 1.3)');

-- ============================================================================
-- § 2 THE COMMISSION / STAFF_ADMIN LEG — `assignStaffAdmin`'s exact shape:
--     an org_admin, through the SESSION door, actor bound from auth.uid().
-- ============================================================================

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p2 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select p2 from pg_temp.p()))::text,
  '0|1',
  '2.0 PRECONDITION: P2 is unaffiliated and reported by the detector');

select test_helpers.claims_for((select oa_a from pg_temp.k()), false, 'org_admin');
set local role authenticated;
select lives_ok(
  format($$select public.grant_role('commission', %L, 'staff_admin', %L)$$,
         (select ccih from pg_temp.k()), (select p2 from pg_temp.p())),
  '2.1 an org_admin seats a commission coordinator through the SESSION door — assignStaffAdmin''s shape, actor bound from auth.uid()');
reset role;

select is(
  (select m.role || '|' || (m.commission_id = (select ccih from pg_temp.k()))::text
     from public.memberships m where m.principal_id = (select p2 from pg_temp.p())),
  'staff_admin|true',
  '2.2 the commission-tier membership landed');

select is(
  (select (oa.organization_id = (select org_a from pg_temp.k()))::text || '|' ||
          (oa.ended_on is null)::text || '|' || (oa.voided_at is null)::text || '|' ||
          (oa.created_by = (select oa_a from pg_temp.k()))::text
     from public.organization_affiliations oa
    where oa.principal_id = (select p2 from pg_temp.p())),
  'true|true|true|true',
  '2.3 ⭐ …and an ACTIVE affiliation in the organisation that OWNS THE COMMISSION — resolved through `commissions.organization_id`, since the commission tier never sets the kernel''s `v_org` (a membership''s organization_id stays NULL at that tier, and must)');

select is(
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select p2 from pg_temp.p())),
  0,
  '2.4 P2 is absent from the orphan detector');

select is(
  (select count(*)::int from public.list_addable_commission_members((select farmacia from pg_temp.k()))
    where user_id = (select p2 from pg_temp.p())),
  1,
  '2.5 …and is addable to another commission of the SAME org (read by a caller who is not the provisioner) — the picker''s org predicate is satisfied by the implied affiliation');

select test_helpers.claims_for((select chefe_ccih from pg_temp.k()), false, 'staff_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.list_linkable_org_users((select org_a from pg_temp.k()))
    where user_id = (select p2 from pg_temp.p())),
  1,
  '2.6 …and appears in the INVOKER coordinator picker read by a co-member — both pickers, not one (ADR 0166''s visibility half is two doors)');
reset role;

-- ============================================================================
-- § 3 ⭐ THE KEYSTONE — THE PROMOTION PATH THROUGH THE EARLY `return`
-- ============================================================================

select is(
  (select m.role from public.memberships m
    where m.principal_id = (select p3 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p3 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select p3 from pg_temp.p()))::text,
  'staff|0|1',
  '3.0 PRECONDITION: P3 already HOLDS a `staff` membership of CCIH (inserted directly, not through the door) and has zero affiliations — the state that sends grant_role_impl down the T1.0 UPDATE branch, which `return`s before the INSERT');

select is(
  pg_temp.try_grant((select oa_a from pg_temp.k()), 'commission',
                    (select ccih from pg_temp.k()), 'staff_admin', (select p3 from pg_temp.p())),
  'ok',
  '3.1 promoting `staff` → `staff_admin` succeeds');

select is(
  (select m.role || '|' || (select count(*)::int from public.memberships m2
                             where m2.principal_id = (select p3 from pg_temp.p()))::text
     from public.memberships m where m.principal_id = (select p3 from pg_temp.p())),
  'staff_admin|1',
  '3.2 …the role was REPLACED IN PLACE (one row, not two) — the T1.0 branch was genuinely taken, so § 3.3 is measuring the early-return path and not the INSERT path');

select is(
  (select (oa.organization_id = (select org_a from pg_temp.k()))::text || '|' ||
          (oa.ended_on is null)::text || '|' || (oa.voided_at is null)::text
     from public.organization_affiliations oa
    where oa.principal_id = (select p3 from pg_temp.p())),
  'true|true|true',
  '3.3 ⛔⛔ THE KEYSTONE: the affiliation exists AFTER A PROMOTION. An ensure placed beside the final INSERT is DEAD CODE on this path — and this is the path `assignStaffAdmin` documents as its purpose');

select is(
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select p3 from pg_temp.p())),
  0,
  '3.4 …and P3 leaves the orphan population');

-- ============================================================================
-- § 4 IDEMPOTENCE AND HISTORY (clauses 3 and 4)
-- ============================================================================

-- ⛔ EVERY MUTATING CELL BELOW IS **TWO STATEMENTS**, AND THE REASON IS A DEFECT
--    THIS FILE'S RED-FIRST RUN FOUND IN ITSELF.  Written as one `select` — the
--    call and the row counts together — the counts read the statement's OPENING
--    snapshot and therefore measure the state BEFORE the call.  § 6.1–§ 6.3 came
--    back `ok|0|0` when the membership had in fact landed.  An assertion that
--    silently measures the wrong instant is the shape this phase keeps paying
--    for, so the result is parked in a GUC and asserted by a separate statement.
--
--    ⚠ AND THE PARKING STATEMENT IS A `do` BLOCK, NOT A BARE `select`.  A bare
--      `select set_config(...)` prints the value it stored; when that value is the
--      string `ok`, psql emits a line pg_prove's TAP parser reads AS A TEST RESULT.
--      Measured: 59 assertions were reported as 69 with "Tests out of sequence",
--      GREEN under a direct psql run and mis-parsed under the real runner. `do`
--      emits only `DO`.
do $$ begin perform set_config('t396.g41', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select p1 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g41') || '|' ||
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p1 from pg_temp.p()))::text,
  'ok|1',
  '4.1 repeating the operation is IDEMPOTENT (clause 3): the second grant succeeds and still exactly ONE affiliation row exists');

do $$ begin perform set_config('t396.g42', pg_temp.try_grant(
  (select oa_a from pg_temp.k()), 'commission',
  (select ccih from pg_temp.k()), 'staff_admin', (select chefe_ccih from pg_temp.k())), true); end $$;
select is(
  current_setting('t396.g42') || '|' ||
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select chefe_ccih from pg_temp.k()))::text,
  'ok|1',
  '4.2 an ALREADY-AFFILIATED person is re-granted their existing role: the existing active row is REUSED, no duplicate is written (and the partial unique index is never the thing that saves it — a 23505 surfacing as a generic error would be a worse answer)');

do $$ begin perform set_config('t396.g43', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select p4 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g43') || '|' ||
  (select count(*) filter (where ended_on is not null)::int from public.organization_affiliations
    where principal_id = (select p4 from pg_temp.p()))::text || '|' ||
  (select count(*) filter (where ended_on is null and voided_at is null)::int
     from public.organization_affiliations where principal_id = (select p4 from pg_temp.p()))::text,
  'ok|1|1',
  '4.3 ⭐ AN ENDED, NON-VOIDED ROW IN THE SAME ORG IS REACTIVATED BY A **NEW ACTIVE ROW** (clause 4): the ended row is RETAINED and a second, active row is created. History is not rewritten — an `update … set ended_on = null` would show 1|0 here');

select is(
  (select ended_on::text from public.organization_affiliations
    where principal_id = (select p4 from pg_temp.p()) and ended_on is not null),
  '2026-01-10',
  '4.4 …and the retained row keeps its ORIGINAL end date untouched — the strong form of "history is not rewritten"');

do $$ begin perform set_config('t396.g45', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select p5 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g45') || '|' ||
  (select count(*) filter (where voided_at is not null)::int from public.organization_affiliations
    where principal_id = (select p5 from pg_temp.p()))::text || '|' ||
  (select count(*) filter (where ended_on is null and voided_at is null)::int
     from public.organization_affiliations where principal_id = (select p5 from pg_temp.p()))::text,
  'ok|1|1',
  '4.5 ⚠ FLAGGED FOR PO ACCEPTANCE: a VOIDED-ONLY history in the same org counts as KNOWN NOWHERE (ADR 0163 bound 1 — void is "was never true", not "ended"), so provisioning writes a FRESH ACTIVE row beside the voided one. The alternative reading — void as a standing refusal — would refuse here');

-- ============================================================================
-- § 5 REFUSALS AND ROLLBACK.  ⛔ Every cell asserts ROW ABSENCE after the error.
--     "The RPC raised" alone does not prove atomicity.
-- ============================================================================

do $$ begin perform set_config('t396.g51', pg_temp.try_grant(
  (select staff1_ccih from pg_temp.k()), 'commission',
  (select ccih from pg_temp.k()), 'staff_admin', (select p9 from pg_temp.p())), true); end $$;
select is(
  split_part(current_setting('t396.g51'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p9 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p9 from pg_temp.p()))::text,
  '42501|0|0',
  '5.1 an UNAUTHORIZED actor is refused at the authority check and leaves NEITHER row — the ensure runs AFTER authority, so an unauthorized caller can never write an affiliation');

do $$ begin perform set_config('t396.g51b', pg_temp.try_grant(
  (select staff1_ccih from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select oa_c from pg_temp.k())), true); end $$;
select is(
  split_part(current_setting('t396.g51b'), '|', 1),
  '42501',
  '5.1b ⭐ THE ORDERING, MADE OBSERVABLE: an unauthorized actor naming a FOREIGN target gets `42501` and not `HC0R0`. § 5.1 alone cannot show the ordering — its target is affiliation-clean, so the ensure would have SUCCEEDED and the rollback would hide the move. Here the two answers differ, so "authority first" is measured rather than read off the source');

do $$ begin perform set_config('t396.g52', pg_temp.try_grant(
  (select oa_a from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select platform from pg_temp.k())), true); end $$;
select is(
  split_part(current_setting('t396.g52'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships
    where principal_id = (select platform from pg_temp.k()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select platform from pg_temp.k()))::text,
  'HC0R0|0|0',
  '5.2 ⭐ A DECLARED NARROWING (clause 6): a PLATFORM ADMINISTRATOR''s identity cannot be bound into a tenant as the target person. Measured at head …005800 this SUCCEEDED — grant_role_impl had no tenancy check on the target at all. Refused with the SAME code and message as "not found", so the door is not an is_admin oracle');

do $$ begin perform set_config('t396.g53', pg_temp.try_grant(
  (select oa_a from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select inativo from pg_temp.k())), true); end $$;
select is(
  split_part(current_setting('t396.g53'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships
    where principal_id = (select inativo from pg_temp.k())
      and organization_id = (select org_a from pg_temp.k()) and role = 'org_admin')::text,
  'HC0R4|0',
  '5.3 a DEACTIVATED account (already affiliated to A, so the tenancy arm cannot be what refuses) raises the established inactive-account error and no membership is written');

do $$ begin perform set_config('t396.g54', pg_temp.try_grant(
  (select oa_a from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select oa_c from pg_temp.k())), true); end $$;
select is(
  split_part(current_setting('t396.g54'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships
    where principal_id = (select oa_c from pg_temp.k())
      and organization_id = (select org_a from pg_temp.k()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select oa_c from pg_temp.k())
      and organization_id = (select org_a from pg_temp.k()))::text,
  'HC0R0|0|0',
  '5.4 ⭐ THE SECOND DECLARED NARROWING (clause 5): a person whose non-voided affiliations are ENTIRELY in another organisation is refused, and NEITHER row lands. ⚠ ADR 0166 says "remains refused"; measured, they were NOT refused before — grant_role_impl would happily have seated org C''s administrator as org A''s');

do $$ begin perform set_config('t396.g54b', pg_temp.try_grant(
  (select oa_a from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select p13 from pg_temp.p())), true); end $$;
select is(
  split_part(current_setting('t396.g54b'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p13 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p13 from pg_temp.p()) and organization_id = (select org_a from pg_temp.k()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p13 from pg_temp.p()) and organization_id = (select org_b from pg_temp.k()))::text,
  'HC0R0|0|0|1',
  '5.4b ⭐⭐ NON-VOIDED, NOT ACTIVE — the conjunct that decides clause 5. P13''s ONLY affiliation is an ENDED, non-voided row in B: they hold no ACTIVE tenancy anywhere, yet they are KNOWN to B, so A must refuse them. Narrow the collision check to active-only and P13 becomes admissible while every other cell in this file stays green — which is why this cell exists, and why the B row is asserted to survive');

select is(
  pg_temp.try_grant((select oa_a from pg_temp.k()), 'organization',
                    (select org_a from pg_temp.k()), 'org_admin', (select ghost from pg_temp.p())),
  pg_temp.try_grant((select oa_a from pg_temp.k()), 'organization',
                    (select org_a from pg_temp.k()), 'org_admin', (select p12 from pg_temp.p())),
  '5.5 ⛔ ORACLE-KILL, AND THE ONE DEVIATION FROM THE SUPPLIED PSEUDOCODE: a uuid with NO PROFILE and a real-but-foreign-and-DEACTIVATED person get the BYTE-IDENTICAL sqlstate and message. The supplied order (inactive before foreign) would answer HC0R4 for the second and turn the door into a cross-tenant existence oracle; the sibling door `affiliate_person_to_org_impl` orders it foreign-first and this mirrors it. Flip this cell if the PO rules the other way');

select is(
  (select split_part(pg_temp.try_grant((select oa_a from pg_temp.k()), 'organization',
                     (select org_a from pg_temp.k()), 'org_admin', (select ghost from pg_temp.p())), '|', 1)),
  'HC0R0',
  '5.5b …and the shared answer is HC0R0 specifically — § 5.5 alone would be green if BOTH sides raised the same UNRELATED error');

do $$ begin perform set_config('t396.g56', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'commission',
  '00000000-0000-0000-0000-0ae24600bad1'::uuid, 'staff_admin', (select p10 from pg_temp.p())), true); end $$;
select is(
  split_part(current_setting('t396.g56'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p10 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p10 from pg_temp.p()))::text,
  '23514|0|0',
  '5.6 a NON-EXISTENT commission is refused with the sibling branches'' `check_violation` shape (`hospital inexistente`), not with a raw FK violation from the membership insert, and neither row lands. ⚠ Reachable only for a platform admin — every tenant arm is already false for an id that names nothing');

do $$ begin perform set_config('t396.g56b', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  '00000000-0000-0000-0000-0ae24600bad2'::uuid, 'org_admin', (select p11 from pg_temp.p())), true); end $$;
select is(
  split_part(current_setting('t396.g56b'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p11 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p11 from pg_temp.p()))::text,
  '23503|0|0',
  '5.6b ⚠ THE ASYMMETRY, STATED RATHER THAN HIDDEN: a NON-EXISTENT organisation is refused too, and neither row lands — but by a RAW FK VIOLATION from the affiliation insert (23503), not by the authored `check_violation` the commission path gets. The commission path needs an authored check because it must RESOLVE an org before it can write one; the organisation path has the id in hand and the FK is the check. The postcondition (clause 2) holds either way, which is what this cell pins');

select is(
  (select split_part(pg_temp.try_grant((select oa_a from pg_temp.k()), 'organization',
                     (select org_a from pg_temp.k()), 'org_admin', (select oa_a from pg_temp.k())), '|', 1)),
  '42501',
  '5.7 the SELF-GRANT guard still fires on this path — the ensure sits after it, so a self-grant cannot write an affiliation either');

-- ── forced failures.  Both directions of clause 2 ("both rows, or neither"). ──
create function pg_temp.block_affiliation() returns trigger language plpgsql as $$
begin
  if new.principal_id = '00000000-0000-0000-0000-0ae2460a0006'::uuid then
    raise exception 'forced affiliation failure' using errcode = 'HC0RF';
  end if;
  return new;
end;
$$;
create trigger ae2r2_block_affiliation before insert on public.organization_affiliations
  for each row execute function pg_temp.block_affiliation();

do $$ begin perform set_config('t396.g58', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select p6 from pg_temp.p())), true); end $$;
select is(
  split_part(current_setting('t396.g58'), '|', 1) || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p6 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p6 from pg_temp.p()))::text,
  'HC0RF|0|0',
  '5.8 ⭐ FORCED AFFILIATION FAILURE LEAVES **NO MEMBERSHIP** — clause 2, first direction. The membership write is not merely "attempted later"; it is undone');

drop trigger ae2r2_block_affiliation on public.organization_affiliations;

create function pg_temp.block_membership() returns trigger language plpgsql as $$
begin
  if new.principal_id = '00000000-0000-0000-0000-0ae2460a0007'::uuid then
    raise exception 'forced membership failure' using errcode = 'HC0RM';
  end if;
  return new;
end;
$$;
create trigger ae2r2_block_membership before insert on public.memberships
  for each row execute function pg_temp.block_membership();

do $$ begin perform set_config('t396.g59', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select p7 from pg_temp.p())), true); end $$;
select is(
  split_part(current_setting('t396.g59'), '|', 1) || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p7 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p7 from pg_temp.p()))::text,
  'HC0RM|0|0',
  '5.9 ⭐⭐ FORCED MEMBERSHIP FAILURE LEAVES **NO AFFILIATION** — clause 2, second direction, and the cell that proves the two writes share ONE transaction. Split them into two and the affiliation survives here: this is the assertion a TypeScript-side `affiliate_person_to_org_for` call could never satisfy');

drop trigger ae2r2_block_membership on public.memberships;

-- ⛔ § 5.9 WAS **GREEN ON ITS FIRST RUN**, WHICH IS A FINDING, NOT A PASS.  Before
--    the kernel change nothing ever wrote an affiliation, so "no affiliation for P7"
--    was true for a reason that had nothing to do with rollback.  § 5.9b is the
--    DIFFERENTIAL that makes § 5.9 mean what it says: the SAME call, with the
--    forced failure removed, DOES write the affiliation — so its absence above is
--    the transaction being undone and not the ensure being absent or inert.
do $$ begin perform set_config('t396.g59b', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'org_admin', (select p7 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g59b') || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p7 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p7 from pg_temp.p()))::text,
  'ok|1|1',
  '5.9b ⭐ THE DIFFERENTIAL FOR § 5.9: with the forced failure dropped, the identical call writes BOTH rows. Without this cell § 5.9 is green on a database where the ensure does not exist at all — measured, that is exactly how it behaved on its red-first run');

-- ── the module''s own audience ─────────────────────────────────────────────
select test_helpers.claims_for((select oa_a from pg_temp.k()), false, 'org_admin');
set local role authenticated;
select throws_ok(
  format($$select app.ensure_provisioned_org_affiliation(%L, %L, %L)$$,
         (select oa_a from pg_temp.k()), (select p9 from pg_temp.p()), (select org_a from pg_temp.k())),
  '42501', null,
  '5.10 an AUTHENTICATED caller cannot execute the internal module — it takes an explicit actor and checks no authority, so reachability IS the vulnerability');
reset role;

set local role service_role;
select throws_ok(
  format($$select app.ensure_provisioned_org_affiliation(%L, %L, %L)$$,
         (select oa_a from pg_temp.k()), (select p9 from pg_temp.p()), (select org_a from pg_temp.k())),
  '42501', null,
  '5.11 ⭐ …and NEITHER CAN service_role. The service twin of every other door is service-reachable; this one is not, because it is not a door — a service-role route handler that could call it would be an unauthenticated affiliation writer');
reset role;

select test_helpers.claims_for((select oa_a from pg_temp.k()), false, 'org_admin');
set local role authenticated;
select throws_ok(
  format($$select public.grant_role_for(%L, 'organization', %L, 'org_admin', %L)$$,
         (select platform from pg_temp.k()), (select org_a from pg_temp.k()), (select p9 from pg_temp.p())),
  '42501', null,
  '5.12 …and the explicit-actor door stays unreachable from a session (preserved, not merely untouched — a widened ACL here would let any signed-in caller borrow the platform admin''s authority AND the new affiliation write)');
reset role;

-- ============================================================================
-- § 6 THE SCOPE BOUND — ⛔ ADR 0166 covers EXACTLY two (scope, role) pairs.
--     "Technical-director, NSP, quality and ordinary `staff` appointments have
--      their own semantics and need their own ruling."
-- ============================================================================

do $$ begin perform set_config('t396.g61', pg_temp.try_grant(
  (select chefe_ccih from pg_temp.k()), 'commission',
  (select ccih from pg_temp.k()), 'staff', (select p9 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g61') || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p9 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p9 from pg_temp.p()))::text,
  'ok|1|0',
  '6.1 ⛔ SCOPE BOUND: an ordinary `staff` appointment still creates NO affiliation. The membership lands (1) and the affiliation does not (0) — a guard widened to "any commission role" reds here');

do $$ begin perform set_config('t396.g62', pg_temp.try_grant(
  (select oa_a from pg_temp.k()), 'organization',
  (select org_a from pg_temp.k()), 'nsp_org_admin', (select p10 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g62') || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p10 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p10 from pg_temp.p()))::text,
  'ok|1|0',
  '6.2 ⛔ …and `nsp_org_admin` at the SAME organisation scope creates none either — the guard is keyed on (scope, ROLE), not on scope alone');

do $$ begin perform set_config('t396.g63', pg_temp.try_grant(
  (select oa_a from pg_temp.k()), 'hospital',
  (select central_a from pg_temp.k()), 'hospital_admin', (select p11 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g63') || '|' ||
  (select count(*)::int from public.memberships where principal_id = (select p11 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.organization_affiliations where principal_id = (select p11 from pg_temp.p()))::text,
  'ok|1|0',
  '6.3 ⛔ …and the hospital tier is untouched (clause 1 again: no hospital-employment assertion is invented anywhere)');

-- ============================================================================
-- § 7 THE SINGLE-HOSPITAL BOOTSTRAP IS PRESERVED (design constraint: it is NOT
--     authorized to be removed).  Rede C has exactly ONE hospital.
-- ============================================================================

do $$ begin perform set_config('t396.g71a', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'organization',
  (select org_c from pg_temp.k()), 'org_admin', (select p8 from pg_temp.p())), true); end $$;
do $$ begin perform set_config('t396.g71b', pg_temp.try_grant(
  (select platform from pg_temp.k()), 'hospital',
  (select hosp_c from pg_temp.k()), 'hospital_admin', (select p8 from pg_temp.p())), true); end $$;
select is(
  current_setting('t396.g71a') || '|' || current_setting('t396.g71b'),
  'ok|ok',
  '7.1 assignOrgAdmin''s TWO calls both still succeed in sequence — the org_admin grant AND the single-hospital hospital_admin bootstrap (ADR 0097 D16/D17, external audit BLOCKER-1). Neither is broken by the new invariant');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p8 from pg_temp.p()))::text || '|' ||
  (select count(*)::int from public.memberships
    where principal_id = (select p8 from pg_temp.p()))::text,
  '1|2',
  '7.2 …and the pair leaves exactly ONE affiliation for TWO memberships — the second grant is out of ADR 0166''s scope and adds nothing. ⚠ RESIDUAL, stated: the two calls are two RPCs, so `assignOrgAdmin` as a WHOLE is still not atomic. This increment did not make it so, and does not claim to');

-- ============================================================================
-- § 8 B5 / R2-M1 — THE CATALOG COMMENT, PINNED IN BOTH DIRECTIONS
-- ============================================================================

select ok(
  (select obj_description(p.oid, 'pg_proc') like '%six person-authority doors%'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'tenant_orphan_profiles'),
  '8.1 the live catalog comment now carries ADR 0166''s GRAIN — "nobody through the six person-authority doors" — which is the sentence that is true. A DBA reads this beside the function and nothing else in the repo can correct it for them');

select ok(
  (select obj_description(p.oid, 'pg_proc') not like '%platform\_admin alone%'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'tenant_orphan_profiles'),
  '8.2 ⛔ …and the RETIRED sentence is gone. Both directions, because "the new text is present" would be green with the old text still sitting beside it — which is exactly how this comment survived four corrections in its own file');

-- ============================================================================
-- § 9 THE DETECTOR STILL DETECTS — the anti-suppression control.
--     ADR 0166 § Consequences: "Option 3 (excluding membership holders from the
--     detector) is REJECTED as a fix. It suppresses the symptom … and would hide
--     a genuine membership-succeeded / affiliation-failed partial write."
-- ============================================================================

select is(
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select orphan_plain from pg_temp.p())),
  1,
  '9.1 POSITIVE CONTROL: a constructed non-admin profile with no affiliation IS still reported. Without this, every "absent from the detector" cell above could be green because the detector reports nobody');

select is(
  (select count(*)::int from app.tenant_orphan_profiles()
    where profile_id = (select orphan_member from pg_temp.p())),
  1,
  '9.2 ⛔⛔ THE ANTI-SUPPRESSION CELL: a principal who HOLDS A MEMBERSHIP but has no affiliation is STILL reported. Option 3 — "ignore membership holders" — was the cheap fix ADR 0166 rejects, and it would go green on every other cell in this file. This is the one that reds');

select is(
  (select count(*)::int from ae2r2_seed_orphans),
  0,
  '9.3 …and the SEED contributes zero orphans, so § 9.1/§ 9.2 are counting THIS file''s constructions and not a pre-existing population (the vacuity 395 § 9.2 was found to have, closed here at construction time)');

select * from finish();
rollback;
