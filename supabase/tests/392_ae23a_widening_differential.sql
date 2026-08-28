-- AE2 — THE ORG-TIER PERSON-READ TRUTH TABLE (the phase keystone).
-- Plan docs/plans/authz-evolution.md § AE2.3; ruling ADR 0163; phase record
-- docs/progress/authz-ae2.md § AE2.2.
--
-- ============================================================================
-- ⛔ RE-CUT 2026-08-28 — THE DIFFERENTIAL HALF RETIRED WITH THE COLUMN
-- ============================================================================
-- This file was built as a WIDENING DIFFERENTIAL: every (caller, target) cell was
-- measured under BOTH the OLD predicate — `home_organization_id IS NOT NULL AND
-- app.is_org_admin_of(home_organization_id)`, reproduced here from an RLS-free
-- snapshot — and the new one, and the movement was compared against hand-written
-- pre-declarations of the five widenings and five narrowings (ADR 0154 / plan PA-F13).
--
-- Migration `20261003006500_ae2_drop_home_organization_id.sql` dropped the column.
-- The old predicate can no longer be reproduced, so § 1.1, § 2.3, § 2.4, § 2.5, § 2.6
-- and § 8.2 — every cell whose subject was the MOVEMENT — were removed rather than
-- rewritten into cells that cannot fail.  The pre-declarations, their reasons and
-- their ACCEPT dispositions are recorded in docs/progress/authz-ae2.md and in
-- docs/reviews/authz-ae2-review*.md; they are history, and history does not belong in
-- an assertion.  ⛔ Do not reintroduce them here in a form that reads as measured.
--
-- ⭐ WHAT REMAINS IS THE KEYSTONE, AND SEVERAL OF ITS CELLS ARE THE ONLY ONES OF
--    THEIR KIND IN THE ESTATE:
--      § 3.1/§ 3.2  the only assertions that the POLICIES ACTUALLY CALL
--                   `app.can_administer_person_via_affiliation` — 390 proves the
--                   predicate correct in isolation, which is evidence about nothing
--                   downstream.  These two are the wiring.
--      § 5.1/§ 5.2  the only measurement of the implicit `profiles`-RLS gate that the
--                   old credentials leg carried and the DEFINER call removed.
--      § 6.4        the only cell measuring "who may ADMINISTER" ≠ "who may be
--                   STAFFED".
--      § 6.3/§ 6.6  the roster SET statements, in both orgs.
--      § 4.3        one of exactly THREE cells estate-wide asserting Architecture
--                   Rule 13's LOCATE-vs-GRANT split (with 390 § D10 and 394 § 9.2).
--
-- ============================================================================
-- WHAT IS MEASURED, AND HOW
-- ============================================================================
-- § 2 builds a 5 × 10 matrix — five real callers against ten constructed persons —
-- evaluating, in ONE transaction per caller so no stack state can skew a row:
--   • `app.can_administer_person_via_affiliation(target)`  (the predicate)
--   • whether the caller can SELECT the target's `profiles` row  (the policy)
--   • whether the caller can SELECT the target's `professional_credentials` row
-- § 2.2 pins all fifty predicate cells against a truth table written out in full.
-- Explicitness IS the specification: a cell that is not in the table cannot arrive
-- silently, and a cell that moves for any reason reds there.
--
-- ⭐ THE VACUITY PROOF, AND IT STILL HOLDS AFTER THE RE-CUT.  A keystone green on its
--    first run is vacuous.  This suite's ability to fail was proven by MUTATION:
--    `app.person_authority_orgs` arm 2's `not exists (… active …)` guard was removed
--    in the catalog, which makes T4 (ended in A, ACTIVE in B) resolve to {A,B} instead
--    of {B} and flips CA×T4 from FALSE to TRUE — § 2.2 reds.  The edit was asserted to
--    have LANDED from `pg_proc` (never from a command exit status) and rolled back
--    byte-identically.  Recorded in docs/progress/authz-ae2.md.
--
-- ============================================================================
-- WHY THE POLICY-LEVEL NUMBERS ARE NOT ABSORBED BY SIBLING ARMS
-- ============================================================================
-- All three re-predicated policies are PERMISSIVE and OR'd with siblings, so a
-- table-level read test normally proves nothing about one leg.  § 0.2/§ 0.3/§ 0.5 buy
-- the isolation: every fixture person holds ZERO memberships and ZERO hospital
-- affiliations, and no caller is a platform admin — so the changed leg is the ONLY
-- route into them.  That is what licenses § 3.1/§ 3.2 to assert that policy-level
-- visibility EQUALS the leg, pair for pair.
--
-- ============================================================================
-- THE CELLS THE SEED CANNOT REACH — CONSTRUCTED, WITH DISTINCT IDS
-- ============================================================================
-- ⛔ NO seeded persona holds a membership or affiliation outside its home org, and
--    there is NO cross-org persona — a cross-org test written against
--    `multi@test.local` passes while proving nothing (CLAUDE.md § 9).  So the
--    cross-org axis is built here: `solo.c@test.local` is the actor (org C, a
--    one-person organisation) and T10 is the only subject it can ever reach.
--
-- ⚠ Every fixture person gets its OWN id in the `0ae23a…` namespace — disjoint from
--   390's `0000ae22…` and 391's `0000ae23…`.  Fixtures that SHARE ids across cases
--   fabricate both defects and all-clears, and every deletion in this suite is by
--   identity, never positional (the rollback does it all).
--
--   T1  active in A                              the ordinary case
--   T2  ended in A, non-voided, nothing else     ADR 0163's actual subject
--   T3  ONLY a voided row in A                   bound 1 — excluded entirely
--   T4  ended in A + ACTIVE in B                 arm 2 must not fire
--   T5  ended in A and B ON THE SAME DAY         bound 2 — ALL tied orgs
--   T6  non-voided ends EARLY (A); VOIDED ends   ⭐ the voided-ordering trap:
--       LATE (B)                                 filtering voided AFTER max() yields
--                                                EMPTY — a total, silent loss of
--                                                authority.  390 § C7 covers the
--                                                predicate; § 3.3 asserts it at the
--                                                POLICY level.
--   T7  ACTIVE in BOTH A and B                   affiliated twice, visible to both
--   T8  ACTIVE only in B                         the substrate decides the org
--   T9  NO affiliation row at all                the honest empty.  ⚠ ACCEPTED, WITH
--                                                ITS BLAST RADIUS NAMED: such a person
--                                                has no retaining org and is
--                                                platform_admin-only.  The state is
--                                                CONSTRUCTED — every person is created
--                                                through an affiliation-creating door,
--                                                and the seed has exactly one profile
--                                                with no affiliation row
--                                                (`platform@test.local`, who is
--                                                `is_admin` and already reached by
--                                                `app.is_admin()`).  Asserted rather
--                                                than waved away, because ⛔ "not
--                                                reachable" is not "protected".
--   T10 ACTIVE only in C                         the cross-org cell
--
-- ============================================================================
-- § 5 — THE `professional_credentials` GATE THAT WAS REMOVED
-- ============================================================================
-- AE2.2 handed this over as "believed set-identical, but that is AN ARGUMENT, NOT A
-- MEASUREMENT".  The old leg ran its `profiles` sub-select under the CALLER's RLS; the
-- DEFINER call removes that implicit second gate.
--
-- Measured here over all 50 pairs: § 5.1 (credentials visible ⇒ profiles row visible)
-- and § 5.2 (the two are equal in BOTH directions), with § 5.3 as the floor that stops
-- both from being vacuously true over an all-false matrix.
--
-- ⚠ WHAT IS MEASURED AND WHAT IS REDUCED, STATED SO NEITHER IS OVERSOLD.  The removed
--   gate could only ever BIND if the credentials leg's inner condition were not itself
--   a disjunct of the `profiles` SELECT policy — and it was, and its replacement still
--   is (§ 1.2 pins exactly that, so a future divergence reds here and forces this
--   measurement to be redone).  Given that, the old leg reduces to its inner condition
--   under BOTH readings of how Postgres applies RLS to tables referenced inside a
--   policy expression, so the conclusion does not depend on resolving that question.
--   The behavioural half — that the gate is non-binding IN FACT, on every pair — is
--   what is measured.
--
-- ============================================================================
-- § 6 — THE ROSTER DOOR, AND A DIVERGENCE THAT IS MEASURED RATHER THAN ARGUED
-- ============================================================================
-- `list_addable_commission_members` deliberately uses ACTIVE affiliation, NOT
-- `app.person_authority_orgs`: the two doors answer different questions ("who may
-- ADMINISTER this person" vs "who may be STAFFED here"), and ADR 0163's retention was
-- never an input to the second.  § 6.4 turns that from a stated intention into a
-- measurement: T2, T5 and T6 ARE retained for org A by the authority predicate and are
-- NOT addable to org A's commission.  If anyone ever "unifies" the two predicates,
-- § 6.3 and § 6.4 disagree.
--
-- ⛔ SCOPE, UNCHANGED BY THE RE-CUT: this suite is the READ/VISIBILITY half.  The
--    WRITE/CONTAINMENT half — the containment trigger (now firing `AFTER DELETE OR
--    UPDATE OF voided_at ON organization_affiliations`),
--    `app.affiliate_person_to_org_impl`, the linkable picker — belongs to AE2.4 and its
--    own suites.  Do not read this file as discharging them.
-- ============================================================================

begin;
select plan(32);

-- ---------------------------------------------------------------------------
-- Constants.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.k()
returns table (
  org_a uuid, org_b uuid, org_c uuid, ccih uuid, qual_b uuid,
  ca uuid, cb uuid, cc uuid, ch uuid, cs uuid, chefe uuid
)
language sql immutable as $$
  select '0c000000-0000-0000-0000-00000000000a'::uuid,  -- Rede Hospitalar A
         '0c000000-0000-0000-0000-00000000000b'::uuid,  -- Rede Hospitalar B
         '0c000000-0000-0000-0000-00000000000c'::uuid,  -- Rede Hospitalar C
         'a0000000-0000-0000-0000-0000000000a1'::uuid,  -- CCIH               (org A)
         'c0000000-0000-0000-0000-0000000000c1'::uuid,  -- Qualidade e Seg.   (org B)
         '00000000-0000-0000-0000-0000000000b1'::uuid,  -- orgadmin.a
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- orgadmin.b
         '00000000-0000-0000-0000-0000000000c0'::uuid,  -- solo.c  (CROSS-ORG actor)
         '00000000-0000-0000-0000-0000000000e1'::uuid,  -- hospitaladmin.a1
         '00000000-0000-0000-0000-000000000003'::uuid,  -- staff1.ccih (Rule 13 collapse)
         '00000000-0000-0000-0000-000000000002'::uuid;  -- chefe.ccih  (roster caller)
$$;
grant execute on function pg_temp.k() to authenticated;

-- ---------------------------------------------------------------------------
-- ⭐ THE SEED SNAPSHOT IS TAKEN **BEFORE** THE FIXTURES EXIST, so § 8's claim is
--    about the seed population and cannot be diluted (or inflated) by the ten
--    constructed persons.
-- ---------------------------------------------------------------------------
create temp table ae23_seed as
  select p.id as person_id from public.profiles p;
grant select on ae23_seed to authenticated;

create temp table ae23_callers (label text primary key, caller uuid, role_hint text);
insert into ae23_callers values
  ('CA', (select ca    from pg_temp.k()), 'org_admin'),
  ('CB', (select cb    from pg_temp.k()), 'org_admin'),
  ('CC', (select cc    from pg_temp.k()), 'org_admin'),
  ('CH', (select ch    from pg_temp.k()), 'hospital_admin'),
  ('CS', (select cs    from pg_temp.k()), 'staff');
grant select on ae23_callers to authenticated;

create temp table ae23_targets (label text primary key, target uuid, note text);
insert into ae23_targets values
  ('T1',  '00000000-0000-0000-0000-0ae23a000001', 'active in A'),
  ('T2',  '00000000-0000-0000-0000-0ae23a000002', 'fully offboarded: ended in A, non-voided'),
  ('T3',  '00000000-0000-0000-0000-0ae23a000003', 'voided-only'),
  ('T4',  '00000000-0000-0000-0000-0ae23a000004', 'ended in A, ACTIVE in B'),
  ('T5',  '00000000-0000-0000-0000-0ae23a000005', 'ended_on TIE across A and B'),
  ('T6',  '00000000-0000-0000-0000-0ae23a000006', 'voided-ordering trap: voided row ends LATER'),
  ('T7',  '00000000-0000-0000-0000-0ae23a000007', 'ACTIVE in both A and B'),
  ('T8',  '00000000-0000-0000-0000-0ae23a000008', 'ACTIVE only in B'),
  ('T9',  '00000000-0000-0000-0000-0ae23a000009', 'no affiliation row at all'),
  ('T10', '00000000-0000-0000-0000-0ae23a00000a', 'ACTIVE only in C (cross-org)');
grant select on ae23_targets to authenticated;

-- ---------------------------------------------------------------------------
-- Fixture principals.  `handle_new_user` mints the profile from auth.users.  The
-- only profile columns this suite sets are the two the ROSTER DOOR filters on
-- (`is_active`, and `is_admin` by leaving it false) plus a legible `full_name`;
-- every authority fact under test comes from `public.organization_affiliations`.
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', t.target, 'authenticated', 'authenticated',
       t.target || '@ae23a.test', now(), now()
from pg_temp.ae23_targets t;

update public.profiles
   set full_name = 'AE23a fixture ' || (select label from pg_temp.ae23_targets t where t.target = profiles.id),
       is_active = true
 where id in (select target from pg_temp.ae23_targets);

-- The affiliation substrate.  `started_on` precedes every `ended_on`
-- (organization_affiliations_period_ck) and every voided row carries a reason
-- (organization_affiliations_voided_shape).
insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason, created_by)
values
  -- T1 — active in A.
  ('00000000-0000-0000-0000-0ae23a000001', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  -- T2 — ADR 0163's subject: one ENDED, non-voided row in A.
  ('00000000-0000-0000-0000-0ae23a000002', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  -- T3 — the only row is VOIDED.  Bound 1: no retaining org at all.
  ('00000000-0000-0000-0000-0ae23a000003', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), now(), (select ca from pg_temp.k()), 'lançamento equivocado', (select ca from pg_temp.k())),
  -- T4 — ended in A, still ACTIVE in B.  Retention must NOT fire for A.
  ('00000000-0000-0000-0000-0ae23a000004', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000004', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  -- T5 — the TIE.  Both end 2026-02-20; nothing active.  Bound 2 → {A, B}.
  ('00000000-0000-0000-0000-0ae23a000005', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000005', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-02-20', (select cb from pg_temp.k()), null, null, null, (select cb from pg_temp.k())),
  -- T6 — the VOIDED-ORDERING TRAP.  Non-voided A ends 2026-01-10; VOIDED B ends
  --      2026-06-10.  Correct answer {A}; a max() computed before the void
  --      filter returns EMPTY.
  ('00000000-0000-0000-0000-0ae23a000006', (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select ca from pg_temp.k()), null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000006', (select org_b from pg_temp.k()), date '2025-01-01', date '2026-06-10', (select cb from pg_temp.k()), now(), (select cb from pg_temp.k()), 'lançamento equivocado', (select cb from pg_temp.k())),
  -- T7 — active in BOTH.
  ('00000000-0000-0000-0000-0ae23a000007', (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select ca from pg_temp.k())),
  ('00000000-0000-0000-0000-0ae23a000007', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  -- T8 — the only affiliation is an ACTIVE one in B.
  ('00000000-0000-0000-0000-0ae23a000008', (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cb from pg_temp.k())),
  -- T10 — the CROSS-ORG cell: an active affiliation in C and nothing else.
  ('00000000-0000-0000-0000-0ae23a00000a', (select org_c from pg_temp.k()), date '2025-01-01', null, null, null, null, null, (select cc from pg_temp.k()));
-- T9 deliberately gets no row at all.

-- Credentials for ALL ten, so § 5's `credentials ⇔ profiles` comparison covers
-- the same 50 pairs as § 3 rather than a subset chosen after the fact.
insert into public.professional_credentials
  (user_id, issuing_country, issuing_state, issuing_authority, registration_number)
select t.target, 'BR', 'SP', 'COREN', 'AE23A-' || t.label from pg_temp.ae23_targets t;

create temp table ae23_matrix (
  caller uuid, target uuid, new_leg bool, prof_visible bool, cred_visible bool);
grant select, insert on ae23_matrix to authenticated;

create temp table ae23_seed_matrix (caller uuid, person_id uuid, new_leg bool);
grant select, insert on ae23_seed_matrix to authenticated;

create temp table ae23_roster (commission uuid, caller uuid, user_id uuid);
grant select, insert on ae23_roster to authenticated;

-- ---------------------------------------------------------------------------
-- THE TRUTH TABLE.  All 50 cells, written out.  Explicitness IS the
-- specification: a cell that is not here cannot arrive silently, and a cell that
-- moves in either direction fails § 2.2.
-- ---------------------------------------------------------------------------
create temp table ae23_expected (caller_label text, target_label text, new_leg bool);
insert into ae23_expected values
  -- CA = orgadmin.a.
  ('CA','T1', true),
  ('CA','T2', true),   -- ADR 0163 retention: A is the last non-voided org
  ('CA','T3', false),  -- bound 1: the only row is voided → no retaining org
  ('CA','T4', false),  -- arm 2 must not fire while an ACTIVE affiliation exists
  ('CA','T5', true),   -- bound 2: the tie yields BOTH orgs, and A is one of them
  ('CA','T6', true),   -- voided excluded BEFORE max() → A
  ('CA','T7', true),
  ('CA','T8', false),
  ('CA','T9', false),  -- no affiliation row → no retaining org → platform_admin-only
  ('CA','T10',false),
  -- CB = orgadmin.b.
  ('CB','T1', false),
  ('CB','T2', false),
  ('CB','T3', false),
  ('CB','T4', true),   -- B is the current employer
  ('CB','T5', true),   -- bound 2: B is the other tied org
  ('CB','T6', false),  -- B's row is VOIDED → excluded entirely
  ('CB','T7', true),
  ('CB','T8', true),
  ('CB','T9', false),
  ('CB','T10',false),
  -- CC = solo.c, the CROSS-ORG actor.  Reaches exactly one person, ever.
  ('CC','T1', false),
  ('CC','T2', false),
  ('CC','T3', false),
  ('CC','T4', false),
  ('CC','T5', false),
  ('CC','T6', false),
  ('CC','T7', false),
  ('CC','T8', false),
  ('CC','T9', false),
  ('CC','T10',true),
  -- CH = hospitaladmin.a1.  ADR 0163 bound 4: this predicate adds NO hospital-tier
  -- reach.  All false.
  ('CH','T1', false),
  ('CH','T2', false),
  ('CH','T3', false),
  ('CH','T4', false),
  ('CH','T5', false),
  ('CH','T6', false),
  ('CH','T7', false),
  ('CH','T8', false),
  ('CH','T9', false),
  ('CH','T10',false),
  -- CS = staff1.ccih.  THE RULE 13 COLLAPSE CELL: shares an ACTIVE org-A affiliation
  -- with T1/T7 and holds NO org_admin membership.  All false.  This is what reds if
  -- LOCATE and GRANT are ever collapsed into one join.
  ('CS','T1', false),
  ('CS','T2', false),
  ('CS','T3', false),
  ('CS','T4', false),
  ('CS','T5', false),
  ('CS','T6', false),
  ('CS','T7', false),
  ('CS','T8', false),
  ('CS','T9', false),
  ('CS','T10',false);

-- ============================================================================
-- § 0  PRECONDITIONS AND VACUITY GUARDS
-- ============================================================================
select is(
  (select count(*)::int from public.profiles p join pg_temp.ae23_targets t on t.target = p.id
    where p.is_active and not p.is_admin), 10,
  '0.1 PRECONDITION: all ten fixture persons HAVE a profiles row and are ACTIVE and non-admin. Without the existence half, a FALSE prof_visible in § 3.1 could mean "no row" rather than "denied" — the two read identically');

select is(
  (select count(*)::int from public.memberships m where m.principal_id in (select target from pg_temp.ae23_targets)), 0,
  '0.2 VACUITY GUARD: the fixture persons hold ZERO memberships — the commission/tenancy sibling arms of both profiles policies cannot carry any read in § 3');

select is(
  (select count(*)::int from public.hospital_affiliations ha where ha.principal_id in (select target from pg_temp.ae23_targets)), 0,
  '0.3 VACUITY GUARD: the fixture persons hold ZERO hospital affiliations — the hospital_admin sibling arms cannot carry any read in § 3 either');

select is(
  (select count(*)::int from public.professional_credentials pc where pc.user_id in (select target from pg_temp.ae23_targets)), 10,
  '0.4 PRECONDITION: every fixture person HAS a credential row, so § 5 measures a real read rather than an empty table');

select is(
  (select count(*)::int from public.profiles p join pg_temp.ae23_callers c on c.caller = p.id where p.is_admin), 0,
  '0.5 VACUITY GUARD: not one of the five callers is a platform_admin — app.is_admin() would satisfy leg 1 of two of the three policies regardless of any affiliation');

select is(
  (select count(*)::int from public.organization_affiliations oa
    where oa.principal_id = '00000000-0000-0000-0000-0ae23a000003' and oa.voided_at is not null), 1,
  '0.6 VACUITY GUARD: T3 HAS an affiliation row and it is voided — its denial means "voided is excluded", not "no fixture"');

select is(
  (select count(*)::int from public.organization_affiliations v
    where v.principal_id = '00000000-0000-0000-0000-0ae23a000006' and v.voided_at is not null
      and v.ended_on > (select nv.ended_on from public.organization_affiliations nv
                         where nv.principal_id = '00000000-0000-0000-0000-0ae23a000006' and nv.voided_at is null)), 1,
  '0.7 ⭐ THE TRAP IS ACTUALLY BUILT: T6''s VOIDED row ends LATER than its non-voided one. Without this the § 3.3 green would only mean the fixture never reached the failing state');

select is(
  (select count(*)::int from public.organization_affiliations oa
    where oa.principal_id = '00000000-0000-0000-0000-0ae23a000009'), 0,
  '0.8 PRECONDITION: T9 genuinely has zero affiliation rows — the honest empty, distinct from T3''s voided-only one');

-- ============================================================================
-- § 1  THE SAME CALL, ON ALL THREE LEGS
-- ============================================================================
select is(
  (select count(*)::int from pg_policies
    where policyname in ('profiles_admin_select', 'profiles_select_self_or_admin', 'professional_credentials_select')
      and cmd = 'SELECT' and with_check is null
      and coalesce(qual, '') like '%app.can_administer_person_via_affiliation(%'), 3,
  '1.2 ⭐ all three person-read legs are SELECT-only with NULL with_check and carry the IDENTICAL call. This is what licenses § 5''s reduction (the removed implicit gate could only bind if the credentials leg were not also a profiles disjunct) AND what makes the plan''s "INSERT/UPDATE WITH CHECK" cells subjectless rather than skipped');

-- ============================================================================
-- § 2  THE MATRIX — measured per (caller, target), in ONE transaction per caller,
--      against a truth table written before the run
-- ============================================================================
select test_helpers.claims_for((select ca from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select ca from pg_temp.k()), t.target,
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t;
insert into pg_temp.ae23_seed_matrix
select (select ca from pg_temp.k()), sd.person_id,
       app.can_administer_person_via_affiliation(sd.person_id)
  from pg_temp.ae23_seed sd;
reset role;

select test_helpers.claims_for((select cb from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select cb from pg_temp.k()), t.target,
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t;
insert into pg_temp.ae23_seed_matrix
select (select cb from pg_temp.k()), sd.person_id,
       app.can_administer_person_via_affiliation(sd.person_id)
  from pg_temp.ae23_seed sd;
reset role;

select test_helpers.claims_for((select cc from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select cc from pg_temp.k()), t.target,
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t;
insert into pg_temp.ae23_seed_matrix
select (select cc from pg_temp.k()), sd.person_id,
       app.can_administer_person_via_affiliation(sd.person_id)
  from pg_temp.ae23_seed sd;
reset role;

select test_helpers.claims_for((select ch from pg_temp.k()), false, 'hospital_admin');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select ch from pg_temp.k()), t.target,
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t;
reset role;

select test_helpers.claims_for((select cs from pg_temp.k()), false, 'staff');
set local role authenticated;
insert into pg_temp.ae23_matrix
select (select cs from pg_temp.k()), t.target,
       app.can_administer_person_via_affiliation(t.target),
       exists (select 1 from public.profiles pr where pr.id = t.target),
       exists (select 1 from public.professional_credentials pc where pc.user_id = t.target)
  from pg_temp.ae23_targets t;
reset role;

select cmp_ok((select count(*)::int from pg_temp.ae23_matrix), '>=', 50,
  '2.1 FLOOR: the matrix measured at least 5 callers × 10 targets. A verdict over an empty matrix is the classic vacuous green, and every § 3/§ 4/§ 5 cell below is a count over this table');

select set_eq(
  $q$select c.label as caller_label, t.label as target_label, m.new_leg
       from pg_temp.ae23_matrix m
       join pg_temp.ae23_callers c on c.caller = m.caller
       join pg_temp.ae23_targets t on t.target = m.target$q$,
  $q$select caller_label, target_label, new_leg from pg_temp.ae23_expected$q$,
  '2.2 ⭐⭐ THE TRUTH TABLE: all fifty (caller, target) predicate cells match their written specification. This is the cell the arm-2 guard mutation reds — removing `not exists (… active …)` from app.person_authority_orgs flips CA×T4 from FALSE to TRUE');

-- ============================================================================
-- § 3  POLICY LEVEL — the leg IS the visibility, because § 0 removed every
--      sibling route into these persons
-- ============================================================================
select is(
  (select count(*)::int from pg_temp.ae23_matrix where prof_visible is distinct from new_leg), 0,
  '3.1 ⭐ UNIQUE: on all 50 pairs the profiles row is visible EXACTLY when the predicate is true — the policy ACTUALLY CALLS it. 390 proves the predicate correct in isolation, which is evidence about nothing downstream; this is the wiring (and § 0.2/§ 0.3/§ 0.5 are what stop a permissive sibling from carrying the read)');

select is(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible is distinct from new_leg), 0,
  '3.2 ⭐ UNIQUE: …and the same holds on professional_credentials, measured independently rather than inferred from § 3.1');

select is(
  (select prof_visible from pg_temp.ae23_matrix m
    where m.caller = (select ca from pg_temp.k()) and m.target = '00000000-0000-0000-0000-0ae23a000006'), true,
  '3.3 ⭐ THE VOIDED-ORDERING TRAP AT POLICY LEVEL: orgadmin.a can still read T6, whose VOIDED row ends LATER than the real one. An implementation computing max(ended_on) before filtering voided returns EMPTY here — a total, silent loss of authority');

select is(
  (select prof_visible from pg_temp.ae23_matrix m
    where m.caller = (select cb from pg_temp.k()) and m.target = '00000000-0000-0000-0000-0ae23a000005'), true,
  '3.4 ⭐ THE TIE AT POLICY LEVEL: orgadmin.b can read T5, tied with org A on ended_on. An arbitrary tie-break picks ONE org and silently drops the other — this and 390 § C5 are what notice it');

-- ============================================================================
-- § 4  THE RULE 13 COLLAPSE — LOCATE and GRANT are two steps, and must stay two
-- ============================================================================
select is(
  (select count(*)::int from public.organization_affiliations oa
    where oa.principal_id in ((select cs from pg_temp.k()), '00000000-0000-0000-0000-0ae23a000001')
      and oa.organization_id = (select org_a from pg_temp.k())
      and oa.ended_on is null and oa.voided_at is null), 2,
  '4.1 PRECONDITION: staff1.ccih and T1 BOTH hold an ACTIVE org-A affiliation — so § 4.3''s denial is "sharing an affiliation grants nothing", not "there was nothing to share"');

select is(
  (select count(*)::int from public.memberships m
    where m.principal_id = (select cs from pg_temp.k()) and m.role::text = 'org_admin'), 0,
  '4.2 PRECONDITION: staff1.ccih holds NO org_admin membership at any scope — the GRANT half is genuinely absent');

select is(
  (select count(*)::int from pg_temp.ae23_matrix where caller = (select cs from pg_temp.k()) and new_leg), 0,
  '4.3 ⭐⭐ ARCHITECTURE RULE 13 / ADR 0155 D3: a caller who SHARES an active affiliation with the target but holds no org_admin membership in the resolved org is denied for EVERY target. One of exactly THREE cells estate-wide asserting the LOCATE-vs-GRANT split (with 390 § D10 and 394 § 9.2), and what reds if the two steps are ever collapsed into one join');

select is(
  (select count(*)::int from pg_temp.ae23_matrix
    where caller = (select cs from pg_temp.k()) and (prof_visible or cred_visible)), 0,
  '4.4 …and the denial holds end-to-end through RLS on BOTH re-predicated tables. § 4.3 is truth about the predicate and evidence about nothing downstream');

-- ============================================================================
-- § 5  THE professional_credentials GATE THAT WAS REMOVED — MEASURED, not inherited
-- ============================================================================
select is(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible and not prof_visible), 0,
  '5.1 ⭐ UNIQUE, AND MEASURED RATHER THAN ARGUED: on all 50 pairs there is no case where the credential is readable but the person''s profiles row is not — the implicit profiles-RLS gate the old leg carried, and the DEFINER call removes, binds on ZERO pairs');

select is(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible is distinct from prof_visible), 0,
  '5.2 ⭐ UNIQUE: …and the equality holds in BOTH directions, so the removal did not narrow either. AE2.2 recorded this as an argument and explicitly refused to assert it away; this is the measurement it owed');

select cmp_ok(
  (select count(*)::int from pg_temp.ae23_matrix where cred_visible), '>=', 5,
  '5.3 FLOOR: at least five pairs actually READ a credential, so § 5.1 and § 5.2 are not two true statements about an all-false matrix');

-- ============================================================================
-- § 6  THE ROSTER DOOR — and the DELIBERATE divergence from the authority
--      predicate, measured rather than argued
-- ============================================================================
select test_helpers.claims_for((select chefe from pg_temp.k()), false, 'staff_admin');
set local role authenticated;
insert into pg_temp.ae23_roster
select (select ccih from pg_temp.k()), (select chefe from pg_temp.k()), r.user_id
  from public.list_addable_commission_members((select ccih from pg_temp.k())) r;
reset role;

select test_helpers.claims_for((select cb from pg_temp.k()), false, 'org_admin');
set local role authenticated;
insert into pg_temp.ae23_roster
select (select qual_b from pg_temp.k()), (select cb from pg_temp.k()), r.user_id
  from public.list_addable_commission_members((select qual_b from pg_temp.k())) r;
reset role;

select isnt_empty(
  $q$select 1 from pg_temp.ae23_roster where commission = 'a0000000-0000-0000-0000-0000000000a1'$q$,
  '6.1 CONTROL: the door returns a non-empty roster for chefe.ccih on CCIH — every exclusion below is measured against a working door, not a blanket empty');

select is(
  (select count(*)::int from pg_temp.ae23_targets t join public.profiles pr on pr.id = t.target
    where pr.is_active and not pr.is_admin
      and not exists (select 1 from public.memberships m
                       where m.commission_id = (select ccih from pg_temp.k()) and m.principal_id = pr.id)), 10,
  '6.2 ⭐ THE DOOR''S OTHER THREE ROW FILTERS ALL PASS FOR ALL TEN, reproduced from the live body: `pr.is_active and not pr.is_admin and not exists(memberships for this commission)`. So every absence in § 6.3 is attributable to the affiliation conjunct alone, and never to a fixture person who was ineligible for some other reason');

select set_eq(
  $q$select t.label from pg_temp.ae23_targets t
      where t.target in (select r.user_id from pg_temp.ae23_roster r
                          where r.commission = 'a0000000-0000-0000-0000-0000000000a1')$q$,
  $q$select unnest(array['T1','T7'])$q$,
  '6.3 ⭐ exactly the two persons ACTIVELY affiliated to org A are addable to org A''s commission — eight of the ten are not, and § 6.2 is what makes those eight absences the affiliation conjunct''s doing. Breaks no flow: rehire is affiliate-first, one step (ADR 0151 D5)');

select is(
  (select count(*)::int from pg_temp.ae23_matrix m join pg_temp.ae23_targets t on t.target = m.target
    where m.caller = (select ca from pg_temp.k()) and t.label in ('T2','T5','T6') and m.new_leg), 3,
  '6.4 ⭐ UNIQUE — THE DIVERGENCE, MEASURED: T2, T5 and T6 ARE retained for org A by the AUTHORITY predicate, while § 6.3 shows none of them is addable. The two doors answer different questions — "who may ADMINISTER" vs "who may be STAFFED" — and ADR 0163''s retention was never an input to the second. If anyone unifies them, § 6.3 and § 6.4 disagree');

select isnt_empty(
  $q$select 1 from pg_temp.ae23_roster where commission = 'c0000000-0000-0000-0000-0000000000c1'$q$,
  '6.5 CONTROL: orgadmin.b is a tenancy admin of org B''s commission and gets a non-empty roster there — so § 6.6 measures WHICH persons, never whether the caller may list at all');

select set_eq(
  $q$select t.label from pg_temp.ae23_targets t
      where t.target in (select r.user_id from pg_temp.ae23_roster r
                          where r.commission = 'c0000000-0000-0000-0000-0000000000c1')$q$,
  $q$select unnest(array['T4','T7','T8'])$q$,
  '6.6 ⭐ THE ROSTER SET FOR ORG B: exactly the three persons ACTIVELY affiliated to org B are addable to org B''s commission — while T5, whose org-B row is ENDED, is not, even though § 2.2 has CB×T5 TRUE. The substrate decides staffing eligibility, and retention does not leak into it');

-- ============================================================================
-- § 7  SHAPE — the two properties whose loss would make everything above lie
-- ============================================================================
select is(
  has_function_privilege('authenticated', 'app.person_authority_orgs(uuid)', 'EXECUTE'), false,
  '7.1 app.person_authority_orgs is STILL not executable by `authenticated`. A row-returning DEFINER is a gate you can walk through: granting it would let any caller enumerate any person''s organizations by id, and it is in NO sweep arm''s finding domain to notice');

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'can_administer_person_via_affiliation'), true,
  '7.2 the authority predicate is STILL SECURITY DEFINER — a create-or-replace that dropped it would subject its organization_affiliations read to the caller''s RLS, whose SELECT policy has no hospital tier by design (ADR 0151 D1), and every § 3 number would silently change meaning');

-- ============================================================================
-- § 8  THE SEED POPULATION — the predicate still resolves the real roster
-- ============================================================================
select cmp_ok((select count(*)::int from pg_temp.ae23_seed), '>=', 30,
  '8.1 FLOOR, not an exact count: the seed snapshot holds at least 30 persons. Catalog-driven counts drift with every seed change; a floor is what survives that without going vacuous. § 8.3 is what consumes it');

select cmp_ok(
  (select count(*)::int from pg_temp.ae23_seed_matrix where new_leg), '>=', 25,
  '8.3 ⭐ NO-REGRESSION FLOOR OVER THE REAL SEED ROSTER: across the three org_admin callers, the predicate resolves TRUE for at least 25 (caller, seed person) pairs (measured 2026-08-28: 35). The rest of this suite runs on ten CONSTRUCTED persons; this is the only cell measuring the predicate against the population the app actually ships with, and it reds if the predicate ever starts denying broadly');

select * from finish();
rollback;
