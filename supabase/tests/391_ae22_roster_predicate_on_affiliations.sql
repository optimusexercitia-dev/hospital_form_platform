-- AE2 — THE COMMISSION ROSTER PREDICATE, `public.list_addable_commission_members`.
-- ADR 0163 § "An inconsistency this decision does not create, and must not be read
-- as blessing"; plan docs/plans/authz-evolution.md § AE2.2.
--
-- ============================================================================
-- ⛔ RE-CUT 2026-08-28 — THIS IS NO LONGER A DIFFERENTIAL
-- ============================================================================
-- This file was originally half differential against
-- `public.profiles.home_organization_id`: § 0.3 pinned all four fixture persons to
-- org A by the column so that every deny below was attributable to the new
-- predicate, and § 4.1 asserted the column had left the door's body.  Migration
-- `20261003006500_ae2_drop_home_organization_id.sql` dropped the column, so both
-- became permanently true and were removed.  What remains asserts the door's
-- CURRENT predicate directly, in both polarities.
--
-- ⭐ TWO CELLS HERE ARE UNIQUE IN THE ESTATE:
--    § 3.3 drives this door with a REAL platform_admin (`is_admin = true`) and pins
--          the noun rule (ADR 0078 A35) through it — no other suite does.
--    § 4.4 asserts the door is still SECURITY DEFINER — no broad sweep covers it,
--          and a `create or replace` that dropped it would silently subject the
--          roster body to the CALLER's RLS.
--
-- ============================================================================
-- WHY THIS IS A SEPARATE SUITE FROM 390
-- ============================================================================
-- 390 covers a MECHANISM-PRESERVING change to the three RLS SELECT legs.  This door
-- was a BEHAVIOUR CHANGE, and mixing the two would make a bisect meaningless.
--
-- ⭐ THE TWO DOORS ANSWER DIFFERENT QUESTIONS — AND ARE DELIBERATELY NOT UNIFIED.
--      `app.person_authority_orgs`       -> "who may ADMINISTER this person?"
--      `list_addable_commission_members` -> "who may be STAFFED here?"
--    ADR 0163's last-org retention answers the FIRST only, and was never an input to
--    the second.  So the ACTIVE-affiliation filter in this door is not a RESTRICTION
--    of retention — retention is OUT OF SCOPE for it.  The roster predicate is
--    therefore deliberately NOT `app.person_authority_orgs`, which 390 covers and
--    which DOES include the retained orgs.  ⛔ Do not unify them.  (Corroborating,
--    not the premise: ADR 0163 bound 3 also says retention "never makes the person a
--    member of anything".)  392 § 6.4 is the cell that MEASURES the divergence.
--
-- ⚠ THE ACTIVE-AFFILIATION FILTER BREAKS NO FLOW: rehire is `affiliate_person`
--   FIRST — one step, no prior org_admin ticket (ADR 0151 D5) — which makes the
--   person actively affiliated, and only then addable.  The order already works.
--
-- ============================================================================
-- HISTORICAL — THE DIRECTION, AS MEASURED BEFORE THE COLUMN DROPPED
-- ============================================================================
-- The door once gated on `pr.home_organization_id = v_org_id` with NO affiliation
-- filter of any kind, so a FULLY OFFBOARDED person was still listed as addable.  ADR
-- 0163 authorized neither that behaviour nor changing it — it required the direction
-- to be measured and declared.  Measured 2026-08-27 over the seed roster plus the
-- three states the seed cannot reach:
--
--   seed roster                                   104 old / 104 new / 0 / 0
--   fully offboarded (ended, non-voided)          listed in 4 commissions -> 0   NARROWING
--   voided-only                                   listed in 4 commissions -> 0   NARROWING
--   column says org A, ACTIVE affiliation in B    listed in A's 4 -> B's 2       BOTH
--
-- ⭐ RED-FIRST, OBSERVED (also historical): before migration 20261003005500, § 2.1
--    listed the offboarded person (1, not 0) and § 3.4 did not list the org-B-only
--    one (0, not 1).  RE-MEASURED 2026-08-28 by replaying the OLD predicate into the
--    live body via pg_get_functiondef+replace: § 2.1, § 2.2, § 3.1 and § 3.4 went red
--    together — the pre-migration picture exactly — and the body restored
--    byte-identical (prosrc md5 unchanged).  The full record is in
--    docs/progress/authz-ae2.md.
--
-- ============================================================================
-- STRUCTURE
-- ============================================================================
-- § 0 preconditions — every deny below is only worth something if the person would
--     otherwise be listed.  § 0.1/§ 0.2 assert that the door's OTHER THREE filters
--     (already-a-member, is_active, not is_admin) all pass for all four, so the
--     affiliation conjunct is the only thing that can remove anyone.
-- § 1 control — the door still lists somebody.
-- § 2 the denies keyed on affiliation STATE (ended, voided).
-- § 3 the denies keyed on affiliation ORG, plus the positive cell that bounds them.
--     ⚠ §§ 3.1–3.3 DEPEND ON § 3.4 FOR THEIR MEANING, and this was measured, not
--     assumed: a mutation that pins the affiliation predicate to org A empties org
--     B's roster for EVERY caller, and §§ 3.2 and 3.3 stay GREEN under it while
--     § 3.4 reds alone.  An empty roster proves the gate closed only while somebody
--     would otherwise have been in it.  So if § 3.4 ever goes red, §§ 3.2/3.3 are
--     UNPROVEN that run — do not read them as passes.
-- § 4 shape, read from `pg_proc` (comment-stripped) because the door is a DEFINER
--     whose gate REPLACES RLS.
-- ============================================================================

begin;
select plan(14);

-- ⚠ THE ONLY FIXTURE PEOPLE THIS SUITE CREATES ARE THE FOUR `…0000ae23xxxx`
-- ones.  § 3.4 needs a caller who really administers org B's commission and a
-- commission in org B to call it on; both are SEED principals (`orgadmin.b` holds
-- `staff_admin` of Qualidade e Segurança, verified in `public.memberships`), so they
-- are added to k() as ids only — no new rows, and nothing enters the `…0000ae23%`
-- namespace that § 0.2 counts over.
create or replace function pg_temp.k()
returns table (
  comm_a uuid, comm_b uuid, org_a uuid, org_b uuid,
  staff_admin_a uuid, staff_admin_b uuid, platform_admin uuid,
  p_offboarded uuid, p_voided uuid, p_only_b uuid, p_active uuid
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
         -- ⚠ named `p_crossanchored` in the pre-drop cut; docs/reviews/authz-ae2-review*.md
         -- still refer to it under that name.  Renamed because there is no longer a
         -- column for it to be cross-anchored AGAINST — it is simply org-B-only now.
         '00000000-0000-0000-0000-0000ae230003'::uuid,
         '00000000-0000-0000-0000-0000ae230004'::uuid;
$$;
grant execute on function pg_temp.k() to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
       u || '@ae23.test', now(), now()
from (select unnest(array[
        (select p_offboarded from pg_temp.k()), (select p_voided from pg_temp.k()),
        (select p_only_b from pg_temp.k()), (select p_active from pg_temp.k())]) as u) s;

-- The only profile columns this suite sets are the two the DOOR itself filters on
-- (`is_active`, and `is_admin` by leaving it false) plus a legible `full_name`.
-- Everything else under test comes from `public.organization_affiliations`.
update public.profiles
   set full_name = 'AE22 roster fixture', is_active = true
 where id::text like '00000000-0000-0000-0000-0000ae23%';

insert into public.organization_affiliations
  (principal_id, organization_id, started_on, ended_on, ended_by, voided_at, voided_by, void_reason)
values
  ((select p_offboarded from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select staff_admin_a from pg_temp.k()), null, null, null),
  ((select p_voided from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', date '2026-01-10', (select staff_admin_a from pg_temp.k()), now(), (select staff_admin_a from pg_temp.k()), 'lançamento equivocado'),
  ((select p_only_b from pg_temp.k()), (select org_b from pg_temp.k()), date '2025-01-01', null, null, null, null, null),
  ((select p_active from pg_temp.k()), (select org_a from pg_temp.k()), date '2025-01-01', null, null, null, null, null);

-- ============================================================================
-- § 0  PRECONDITIONS — the door's OTHER THREE filters all pass for all four
-- ============================================================================
select is(
  (select count(*)::int from public.memberships
    where commission_id = (select comm_a from pg_temp.k())
      and principal_id in ((select p_offboarded from pg_temp.k()), (select p_voided from pg_temp.k()),
                           (select p_only_b from pg_temp.k()), (select p_active from pg_temp.k()))), 0,
  '0.1 PRECONDITION: none of the four is ALREADY a member of CCIH — the door excludes existing members, which would deny for the wrong reason');

select is(
  (select count(*)::int from public.profiles
    where id::text like '00000000-0000-0000-0000-0000ae23%' and is_active and not is_admin), 4,
  '0.2 PRECONDITION: all four are ACTIVE and non-admin — the door''s other two row filters cannot be what removes them, so every absence below is attributable to the affiliation conjunct alone');

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
-- § 2  DENIED ON AFFILIATION STATE — warranted by ADR 0163 bound 3
-- ============================================================================
select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_offboarded from pg_temp.k())), 0,
  '2.1 ⭐ a FULLY OFFBOARDED person (ended, non-voided affiliation to this org) is NOT listed as addable to that org''s commission. ADR 0163 bound 3 — retention never makes the person a member of anything, and being addable is a step toward membership. ⚠ This is the cell that separates the roster door from app.person_authority_orgs, which DOES retain them (390 § C3)');

select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_voided from pg_temp.k())), 0,
  '2.2 a person whose only affiliation was VOIDED is not listed (bound 1 — "was never true")');

-- ============================================================================
-- § 3  DENIED ON AFFILIATION ORG — and § 3.4, the positive cell that bounds them
-- ============================================================================
select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_a from pg_temp.k()))
    where user_id = (select p_only_b from pg_temp.k())), 0,
  '3.1 a person actively affiliated to org B is NOT addable to org A''s commission — the affiliation substrate decides WHICH org''s rosters a person appears in. § 3.4 shows the same person IS addable in org B, so this zero is a boundary and not an absence');

-- ⚠ 3.2's LABEL claims the whole roster is empty for this caller, so its SQL has
-- to claim that too.  It used to assert only that ONE person was absent from the
-- roster, which a roster of 40 other people satisfies (QA AE2 § M9).
select is_empty(
  'select user_id from public.list_addable_commission_members(''c0000000-0000-0000-0000-0000000000c1''::uuid)',
  '3.2 …and this caller cannot see org B''s commission roster AT ALL — not one row, not merely "not that person". The door''s staff_admin/tenancy gate is a separate question from WHICH persons the row filter admits, and this is what keeps them separate');

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
  '3.3 ⭐ UNIQUE IN THE ESTATE: a REAL platform_admin (platform@test.local, is_admin = true, no memberships) is neither staff_admin nor tenancy admin of that commission and gets an EMPTY roster — the door''s two authority arms carry no app.is_admin() disjunct, so the noun rule (ADR 0078 A35) holds through this door');
reset role;

-- ============================================================================
-- § 3.4  THE POSITIVE CELL, measured where the affiliation actually is.
--
--   ⭐ THE CALLER IS A REAL ADMIN OF THIS COMMISSION.  `orgadmin.b` holds
--   `staff_admin` of Qualidade e Segurança in `public.memberships`, and the hat
--   below matches (app.has_role's self-check requires active_role = the role
--   being tested), so `app.is_staff_admin_of` is true and the gate OPENS.  That
--   is deliberate: §§ 3.1–3.3 measure the door shut, and a section of zeroes
--   cannot measure a claim whose content is a ONE.
-- ============================================================================
select test_helpers.claims_for((select staff_admin_b from pg_temp.k()), false, 'staff_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.list_addable_commission_members((select comm_b from pg_temp.k()))
    where user_id = (select p_only_b from pg_temp.k())), 1,
  '3.4 ⭐ a staff_admin of org B''s commission DOES see the org-B-affiliated person as addable — an ACTIVE affiliation to org B makes them staffable in org B. The only cell in this suite that LISTS this person, and therefore the control that stops §§ 3.1–3.3 from being green by vacancy');
reset role;

-- ============================================================================
-- § 4  SHAPE — asserted on the comment-stripped body, because the door is a
--      DEFINER whose gate REPLACES RLS
-- ============================================================================
select is(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'organization_affiliations'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_addable_commission_members'), true,
  '4.2 the door''s row filter reads organization_affiliations (comment-stripped — a comment naming a table is not a consumer, which is exactly how list_org_people was miscounted in the AE2.1 census). ⚠ 395 § 8.1 is the stronger form: it derives the TENSE of the predicate from prosrc and pins it identical to the picker helper''s. Kept here because losing a true assertion costs more than duplicating one');

select is(
  (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g') ~ 'is_staff_admin_of'
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_addable_commission_members'), true,
  '4.3 POSITIVE CONTROL: the caller gate is still in the body — 4.2 read a real, whole body, and this door changed WHO IS LISTED, never WHO MAY LIST');

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'list_addable_commission_members'), true,
  '4.4 ⭐ UNIQUE IN THE ESTATE: the door is still SECURITY DEFINER. No broad sweep covers this one, and a create-or-replace that dropped it would silently subject the roster body to the caller''s RLS');

select * from finish();
rollback;
