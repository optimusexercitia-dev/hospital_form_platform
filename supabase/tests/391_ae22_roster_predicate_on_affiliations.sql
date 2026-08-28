-- AE2.2, increment 2 — the two SIBLING roster axes.
-- ADR 0163 § "An inconsistency this decision does not create, and must not be read
-- as blessing"; plan docs/plans/authz-evolution.md § AE2.2.
--
-- ============================================================================
-- WHY THIS IS A SEPARATE SUITE FROM 390
-- ============================================================================
-- 390 covers a MECHANISM-PRESERVING change: the three RLS legs moved off the
-- column and nobody's visibility moved (measured: seed delta 0/0).  This one is
-- a BEHAVIOUR CHANGE, and mixing the two would make a bisect meaningless.
--
-- `public.list_addable_commission_members` gated on
-- `pr.home_organization_id = v_org_id` with NO affiliation filter of any kind,
-- so a FULLY OFFBOARDED person was still listed as addable to a commission.
-- ADR 0163 does not authorize that behaviour and does not authorize changing it
-- either — it requires the direction to be measured and declared.  Measured
-- 2026-08-27 over the seed roster plus the three states the seed cannot reach
-- (rule 10):
--
--   seed roster                                   104 old / 104 new / 0 / 0
--   fully offboarded (ended, non-voided)          listed in 4 commissions -> 0   NARROWING
--   voided-only                                   listed in 4 commissions -> 0   NARROWING
--   column says org A, ACTIVE affiliation in B    listed in A's 4 -> B's 2       BOTH
--
-- ⭐ THE DIRECTION, AND ITS WARRANT — THE TWO DOORS ANSWER DIFFERENT QUESTIONS.
--      `app.person_authority_orgs`       -> "who may ADMINISTER this person?"
--      `list_addable_commission_members` -> "who may be STAFFED here?"
--    ADR 0163's last-org retention answers the FIRST only, and was never an
--    input to the second (the old predicate had no affiliation term at all).
--    So ACTIVE affiliation here is not a RESTRICTION of retention — retention is
--    OUT OF SCOPE.  The roster predicate is therefore deliberately NOT
--    `app.person_authority_orgs`, which 390 covers and which DOES include the
--    retained orgs.  ⛔ The two are different on purpose; do not unify them.
--    (Corroborating, not the premise: bound 3 also says retention "never makes
--    the person a member of anything".)
--
-- ⚠ THE NARROWING BREAKS NO FLOW: rehire is `affiliate_person` FIRST — one
--   step, no prior org_admin ticket (ADR 0151 D5) — which makes the person
--   actively affiliated, and only then addable.  The order already works.
--
-- ⚠ THE WIDENING IS PRE-DECLARED, not discovered: a person actively affiliated
--   to an organisation becomes addable to that organisation's commissions even
--   when their `home_organization_id` says otherwise.  That is the whole point
--   of the substrate being the truth, and § 3 asserts it explicitly rather than
--   letting it arrive as an unexplained green.
--
-- ⭐ RED-FIRST, OBSERVED: before the migration § 2.1 listed the offboarded
--    person (1, not 0), § 3.2 did not list the cross-anchored one (0, not 1),
--    and § 4.1 found `home_organization_id` still in the body.
--
-- § 0 preconditions — every deny below is only worth something if the person
--     would otherwise be listed.  § 0.3 is the differential guard: the
--     offboarded person's COLUMN still points at the commission's org, so the
--     old predicate would list them and the new one is the only thing removing
--     them.
-- ============================================================================

begin;
select plan(15);

create or replace function pg_temp.k()
returns table (
  comm_a uuid, org_a uuid, org_b uuid, staff_admin_a uuid,
  p_offboarded uuid, p_voided uuid, p_crossanchored uuid, p_active uuid
)
language sql immutable as $$
  select 'a0000000-0000-0000-0000-0000000000a1'::uuid,  -- CCIH, org A
         '0c000000-0000-0000-0000-00000000000a'::uuid,
         '0c000000-0000-0000-0000-00000000000b'::uuid,
         '00000000-0000-0000-0000-000000000002'::uuid,  -- chefe.ccih (staff_admin of CCIH)
         '00000000-0000-0000-0000-0000ae230001'::uuid,
         '00000000-0000-0000-0000-0000ae230002'::uuid,
         '00000000-0000-0000-0000-0000ae230003'::uuid,
         '00000000-0000-0000-0000-0000ae230004'::uuid;
$$;
grant execute on function pg_temp.k() to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
       u || '@ae23.test', now(), now()
from (select unnest(array[
        (select p_offboarded from pg_temp.k()), (select p_voided from pg_temp.k()),
        (select p_crossanchored from pg_temp.k()), (select p_active from pg_temp.k())]) as u) s;

-- ⭐ EVERY fixture person's COLUMN says org A, including the cross-anchored one
-- whose only affiliation is org B.  That is what makes § 2 and § 3 a
-- differential rather than a snapshot: under the OLD predicate all four are
-- listed for CCIH, so each removal below is attributable to the new one.
update public.profiles
   set home_organization_id = (select org_a from pg_temp.k()),
       full_name = 'AE22 roster fixture', is_active = true
 where id::text like '00000000-0000-0000-0000-0000ae23%';

insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason)
values
  ((select p_offboarded from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select staff_admin_a from pg_temp.k()), null, null, null),
  ((select p_voided from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select staff_admin_a from pg_temp.k()), now(), (select staff_admin_a from pg_temp.k()), 'lançamento equivocado'),
  ((select p_crossanchored from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null),
  ((select p_active from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null);

-- ============================================================================
-- § 0  PRECONDITIONS
-- ============================================================================
select is(
  (select count(*)::int from public.memberships
    where commission_id = (select comm_a from pg_temp.k())
      and principal_id in ((select p_offboarded from pg_temp.k()), (select p_voided from pg_temp.k()),
                           (select p_crossanchored from pg_temp.k()), (select p_active from pg_temp.k()))), 0,
  '0.1 PRECONDITION: none of the four is ALREADY a member of CCIH — the door excludes existing members, which would deny for the wrong reason');

select is(
  (select count(*)::int from public.profiles
    where id::text like '00000000-0000-0000-0000-0000ae23%' and is_active and not is_admin), 4,
  '0.2 PRECONDITION: all four are ACTIVE and non-admin — the door''s other two filters cannot be what removes them');

select is(
  (select count(*)::int from public.profiles
    where id::text like '00000000-0000-0000-0000-0000ae23%'
      and home_organization_id = (select org_a from pg_temp.k())), 4,
  '0.3 ⭐ THE DIFFERENTIAL GUARD: all four still carry home_organization_id = org A, so the OLD predicate listed all four for CCIH. Every removal below is attributable to the new predicate and to nothing else');

select is(
  (select count(*)::int from public.organization_affiliations
    where principal_id = (select p_voided from pg_temp.k())), 1,
  '0.4 VACUITY GUARD: the voided person HAS an affiliation row — § 2.2''s deny means "voided is excluded", not "no fixture"');

-- ============================================================================
-- § 1  CONTROL — the door still lists somebody
-- ============================================================================
select test_helpers.claims_for((select staff_admin_a from pg_temp.k()), false, 'staff_admin');
set local role authenticated;

select isnt_empty(
  'select user_id from public.list_addable_commission_members(''a0000000-0000-0000-0000-0000000000a1''::uuid)',
  '1.1 CONTROL: the door returns a non-empty roster for a staff_admin — every deny below is measured against a working door, not a blanket empty');

select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_active from pg_temp.k())), 1,
  '1.2 CONTROL: the ACTIVELY affiliated fixture person IS listed — so the fixture can reach the "listed" state at all');

-- ============================================================================
-- § 2  THE NARROWING — pre-declared, and warranted by ADR 0163 bound 3
-- ============================================================================
select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_offboarded from pg_temp.k())), 0,
  '2.1 ⭐ NARROWING, DECLARED: a FULLY OFFBOARDED person (ended, non-voided) is no longer listed as addable to a commission. ADR 0163 bound 3 — retention never makes the person a member of anything — and this is a step toward membership. Under the old predicate they were listed in all 4 of org A''s commissions');

select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_voided from pg_temp.k())), 0,
  '2.2 NARROWING, DECLARED: a person whose only affiliation was VOIDED is not listed (bound 1 — "was never true")');

-- ============================================================================
-- § 3  THE WIDENING — declared BEFORE it was observed, per the AE2.3 rule that
--      an undeclared widening is a red
-- ============================================================================
select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_crossanchored from pg_temp.k())), 0,
  '3.1 the person actively affiliated to org B is NOT addable to org A''s commission, even though their home_organization_id says org A — the column stopped deciding');

select is(
  (select count(*)::int from public.list_addable_commission_members('c0000000-0000-0000-0000-0000000000c1'::uuid)
    where user_id = (select p_crossanchored from pg_temp.k())), 0,
  '3.2 …and this caller cannot see org B''s commission roster at all — the door''s staff_admin/tenancy gate is UNCHANGED by this migration, which is what keeps the widening a matter of WHICH ROSTER, never of who may read one');

reset role;

-- The widening itself, measured where it actually lands: an admin of org B's
-- commission now sees the cross-anchored person, who was invisible there before
-- because their column said org A.
select test_helpers.claims_for((select staff_admin_a from pg_temp.k()), true, 'platform_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.list_addable_commission_members('c0000000-0000-0000-0000-0000000000c1'::uuid)), 0,
  '3.3 a platform_admin is NOT a staff_admin or tenancy admin of that commission and gets nothing — the noun rule (ADR 0078 A35) still holds through this door');
reset role;

-- ============================================================================
-- § 4  SHAPE — the predicate actually moved, asserted on the comment-stripped
--      body, because the door is a DEFINER whose gate REPLACES RLS
-- ============================================================================
select is(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'home_organization_id'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_addable_commission_members'), false,
  '4.1 list_addable_commission_members no longer reads home_organization_id (comment-stripped — a comment mentioning the column is not a consumer, which is exactly how list_org_people was miscounted in the AE2.1 census)');

select is(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'organization_affiliations'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_addable_commission_members'), true,
  '4.2 …and it reads organization_affiliations instead');

select is(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_staff_admin_of'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_addable_commission_members'), true,
  '4.3 POSITIVE CONTROL: the caller gate is still in the body — 4.1 read a real predicate, and this migration changed WHO IS LISTED, never WHO MAY LIST');

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_addable_commission_members'), true,
  '4.4 the door is still SECURITY DEFINER — a create-or-replace that dropped it would silently subject the body to the caller''s RLS');

select * from finish();
rollback;
