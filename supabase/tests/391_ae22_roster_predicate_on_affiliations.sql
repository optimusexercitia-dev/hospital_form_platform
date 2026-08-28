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
--   of the substrate being the truth, and § 3.4 asserts it POSITIVELY — it is
--   the one cell in this suite that lists `p_crossanchored` — rather than
--   letting it arrive as an unexplained green.  §§ 3.1–3.3 are the denies that
--   BOUND the widening; on their own they would leave the headline claim of
--   this file unmeasured (QA AE2 § M9).
--
-- ⭐ RED-FIRST, OBSERVED: before the migration § 2.1 listed the offboarded
--    person (1, not 0), § 3.4 did not list the cross-anchored one (0, not 1),
--    and § 4.1 found `home_organization_id` still in the body.  RE-MEASURED
--    2026-08-28 by replaying the OLD predicate (`pr.home_organization_id =
--    v_org_id`) into the live body via pg_get_functiondef+replace: § 2.1, § 2.2,
--    § 3.1, § 3.4, § 4.1 and § 4.2 go red together — the pre-migration picture
--    exactly — and the body restored byte-identical (prosrc md5 unchanged).
--
-- § 0 preconditions — every deny below is only worth something if the person
--     would otherwise be listed.  § 0.3 is the differential guard: the
--     offboarded person's COLUMN still points at the commission's org, so the
--     old predicate would list them and the new one is the only thing removing
--     them.
-- ============================================================================

begin;
select plan(16);

-- ⚠ THE ONLY FIXTURE PEOPLE THIS SUITE CREATES ARE THE FOUR `…0000ae23xxxx`
-- ones.  § 3.4's widening cell needs a caller who really administers org B's
-- commission and a commission in org B to call it on; both are SEED principals
-- (`orgadmin.b` holds `staff_admin` of Qualidade e Segurança, verified in
-- `public.memberships`), so they are added to k() as ids only — no new rows, and
-- nothing enters the `…0000ae23%` namespace that § 0.2/§ 0.3 count over.
create or replace function pg_temp.k()
returns table (
  comm_a uuid, comm_b uuid, org_a uuid, org_b uuid,
  staff_admin_a uuid, staff_admin_b uuid, platform_admin uuid,
  p_offboarded uuid, p_voided uuid, p_crossanchored uuid, p_active uuid
)
language sql immutable as $$
  select 'a0000000-0000-0000-0000-0000000000a1'::uuid,  -- CCIH, org A
         'c0000000-0000-0000-0000-0000000000c1'::uuid,  -- Qualidade e Segurança, org B
         '0c000000-0000-0000-0000-00000000000a'::uuid,
         '0c000000-0000-0000-0000-00000000000b'::uuid,
         '00000000-0000-0000-0000-000000000002'::uuid,  -- chefe.ccih (staff_admin of CCIH)
         '00000000-0000-0000-0000-0000000000b2'::uuid,  -- orgadmin.b (staff_admin of comm_b)
         '00000000-0000-0000-0000-0000000000b0'::uuid,  -- platform@test.local (is_admin = true)
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
--      an undeclared widening is a red.
--
--      §§ 3.1–3.3 are the DENIES that bound it (the column stopped deciding;
--      the caller gate did not move).  § 3.4 is the widening itself, and it is
--      the only cell in the file that lists `p_crossanchored` — a section of
--      zeroes cannot measure a claim whose content is a ONE.
--
--      ⚠ THE DENIES DEPEND ON § 3.4 FOR THEIR MEANING, and this was measured,
--      not assumed: a mutation that pins the affiliation predicate to org A
--      empties org B's roster for EVERY caller, and §§ 3.2 and 3.3 stay GREEN
--      under it while § 3.4 reds alone.  An empty roster proves the gate closed
--      only while somebody would otherwise have been in it.  So if § 3.4 ever
--      goes red, §§ 3.2/3.3 are UNPROVEN that run — do not read them as passes.
-- ============================================================================
select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_crossanchored from pg_temp.k())), 0,
  '3.1 the person actively affiliated to org B is NOT addable to org A''s commission, even though their home_organization_id says org A — the column stopped deciding');

-- ⚠ 3.2's LABEL claims the whole roster is empty for this caller, so its SQL has
-- to claim that too.  It used to assert only that ONE person was absent from the
-- roster, which a roster of 40 other people satisfies (QA AE2 § M9).
select is_empty(
  'select user_id from public.list_addable_commission_members(''c0000000-0000-0000-0000-0000000000c1''::uuid)',
  '3.2 …and this caller cannot see org B''s commission roster AT ALL — not one row, not merely "not that person". The door''s staff_admin/tenancy gate is UNCHANGED by this migration, which is what keeps the widening a matter of WHICH ROSTER, never of who may read one');

reset role;

-- ⭐ 3.3 IS DRIVEN BY THE REAL PLATFORM PRINCIPAL, not by a staff_admin wearing a
-- `platform_admin` hat.  It used to reuse `chefe.ccih` — the SAME caller as 3.2,
-- against the SAME commission — so its zero had 3.2's cause and the noun-rule
-- claim was asserted against somebody who is not a platform admin by any real
-- path (QA AE2 § M9).  `platform@test.local` carries `is_admin = true` and, in
-- the catalog, ZERO rows in `public.memberships`.
--
-- WHICH ARM PRODUCES THE ZERO (read from pg_proc, comment-stripped, not from the
-- migration text): the body's first statement is
--   `if not (app.is_staff_admin_of(p_commission_id)
--            or app.is_tenancy_admin_of(p_commission_id)) then return; end if;`
-- `app.is_staff_admin_of` = is_active AND has_role('commission', …, 'staff_admin');
-- `app.is_tenancy_admin_of` → `app.is_tenancy_admin_of_for` = is_active AND
-- (has_role('organization', …, 'org_admin') OR has_role('hospital', …,
-- 'hospital_admin')).  NEITHER carries an `app.is_admin()` disjunct, and this
-- principal holds no membership at any scope — so BOTH arms are false and the
-- door takes its early `return`.  That early return is the noun rule.
--
-- ⚠ AND ITS CONTROL IS § 3.4: an empty result only means the GATE closed if the
-- roster would otherwise have had somebody in it.  § 3.4 lists a person from
-- exactly this commission's roster, so 3.3 cannot be green by vacancy.
select test_helpers.claims_for((select platform_admin from pg_temp.k()), true, 'platform_admin');
set local role authenticated;
select is_empty(
  'select user_id from public.list_addable_commission_members(''c0000000-0000-0000-0000-0000000000c1''::uuid)',
  '3.3 a REAL platform_admin (platform@test.local, is_admin = true, no memberships) is neither staff_admin nor tenancy admin of that commission and gets an EMPTY roster — the door''s two authority arms carry no app.is_admin() disjunct, so the noun rule (ADR 0078 A35) still holds through this door');
reset role;

-- ============================================================================
-- § 3.4  THE WIDENING ITSELF, measured where it actually lands.
--
--   ⭐ THE DIFFERENTIAL IS § 0.3.  This person's `home_organization_id` still
--   says org A, so under the OLD predicate (`pr.home_organization_id =
--   v_org_id`, v_org_id = org B here) they were NOT listed for this commission.
--   The 1 below is therefore attributable to the new affiliation predicate and
--   to nothing else — the same guard that makes § 2 a differential, read in the
--   other direction.
--
--   ⭐ THE CALLER IS A REAL ADMIN OF THIS COMMISSION.  `orgadmin.b` holds
--   `staff_admin` of Qualidade e Segurança in `public.memberships`, and the hat
--   below matches (app.has_role's self-check requires active_role = the role
--   being tested), so `app.is_staff_admin_of` is true and the gate OPENS.  That
--   is deliberate: §§ 3.1–3.3 measure the door shut, and a widening cannot be
--   measured through a shut door.
-- ============================================================================
select test_helpers.claims_for((select staff_admin_b from pg_temp.k()), false, 'staff_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_b from pg_temp.k()))
    where user_id = (select p_crossanchored from pg_temp.k())), 1,
  '3.4 ⭐ THE WIDENING: a staff_admin of org B''s commission DOES see the cross-anchored person as addable — an ACTIVE affiliation to org B makes them staffable in org B even though their home_organization_id says org A. The only cell in this suite that lists p_crossanchored; § 0.3 is what makes the 1 attributable to the new predicate rather than to the column');
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
