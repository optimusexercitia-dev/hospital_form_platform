-- ============================================================================
-- AE2.2, increment 2 — the SIBLING roster axis.
--
-- Plan: docs/plans/authz-evolution.md § AE2.2
-- Ruling: ADR 0163 § "An inconsistency this decision does not create, and must
--         not be read as blessing" — this door and `src/lib/queries/members.ts`
--         are named there as AE2.2 re-predication targets whose DIRECTION the
--         ADR deliberately does not pick.
-- Keystone: supabase/tests/391_ae22_roster_predicate_on_affiliations.sql
--           (written first; observed RED at § 2.1, § 2.2, § 3.1, § 4.1, § 4.2)
--
-- ----------------------------------------------------------------------------
-- PER-LEG CONTRACT — old predicate -> new predicate, verbatim
-- ----------------------------------------------------------------------------
-- public.list_addable_commission_members(uuid, text) — the roster filter only:
--   old: pr.home_organization_id = v_org_id
--   new: exists (select 1 from public.organization_affiliations oa
--                 where oa.principal_id    = pr.id
--                   and oa.organization_id = v_org_id
--                   and oa.ended_on  is null
--                   and oa.voided_at is null)
--
-- ⛔ NOTHING ELSE IN THIS FUNCTION CHANGES. The caller gate
-- (`is_staff_admin_of ∨ is_tenancy_admin_of`), the `is_active` / `not is_admin`
-- filters, the existing-member exclusion, the search, the ordering, the limit,
-- SECURITY DEFINER and the pinned search_path are all reproduced byte-for-byte
-- from the live catalog. This migration changes WHO IS LISTED, never WHO MAY
-- LIST — 391 § 4.3 / § 4.4 are the assertions that hold that line.
--
-- ----------------------------------------------------------------------------
-- WHY THIS IS A SEPARATE MIGRATION FROM 20261003005400
-- ----------------------------------------------------------------------------
-- 005400 is mechanism-preserving: the three RLS legs moved off the column and
-- nobody's visibility moved (seed delta 0/0, and 387's per-persona behaviour
-- md5s did not budge). This one is a BEHAVIOUR CHANGE. Landing them together
-- would make a bisect meaningless.
--
-- ----------------------------------------------------------------------------
-- THE MEASURED DELTA, recorded here because AE2.3 consumes it
-- ----------------------------------------------------------------------------
-- Shadowed old-vs-new per (commission, person) on 2026-08-27, over the seed
-- roster plus the three states rule 10 says the seed cannot reach:
--
--   seed roster                                104 old / 104 new / 0 only-old / 0 only-new
--   fully offboarded (ended, non-voided)       listed in 4 commissions -> 0    NARROWING
--   voided-only                                listed in 4 commissions -> 0    NARROWING
--   column says org A, ACTIVE affiliation B    org A's 4 -> org B's 2          BOTH
--
-- ⭐ THE DIRECTION AND ITS WARRANT — why these two predicates look like they
--    should match and deliberately do not.
--
--    THE TWO DOORS ANSWER DIFFERENT QUESTIONS.
--      `app.person_authority_orgs`          -> "who may ADMINISTER this person?"
--      `list_addable_commission_members`    -> "who may be STAFFED here?"
--    ADR 0163's last-org retention is an answer to the FIRST question only. It
--    was never an input to the second — the old predicate had no affiliation
--    term at all — so using ACTIVE affiliation here is not a RESTRICTION of
--    retention; retention is simply OUT OF SCOPE. That is what makes the
--    divergence principled rather than a judgment call.
--    ⛔ Do not "unify" the two predicates. 005400's includes the retained orgs
--    because administration must survive offboarding; this one must not,
--    because staffing must not.
--    (Corroborating, not the premise: ADR 0163 bound 3 also says retention "is
--    a read-and-SUBSET-write authority, not a membership … it never makes the
--    person a member of anything.")
--
-- ⚠ THE NARROWING BREAKS NO FLOW. Rehiring an offboarded person is
--   `affiliate_person` FIRST — one step, no prior org_admin ticket (ADR 0151
--   D5) — which makes them actively affiliated, and only then addable. The
--   existing order already works; nothing needs to be re-sequenced.
--
-- ⚠ THE WIDENING IS PRE-DECLARED, not discovered: a person actively affiliated
--   to an organisation becomes addable to that organisation's commissions even
--   when `home_organization_id` says otherwise. It is the substrate being the
--   truth, and 391 § 3 asserts it rather than letting it arrive as a silent
--   green. AE2.3 carries it as a declared cell.
--
-- ⚠ The application-side twin (`listLinkableOrgUsers`,
--   src/lib/queries/members.ts) moves in AE2.4 INCREMENT 4 (ADR 0164 D4, ADR 0165
--   § Consequences) — NOT in this increment. ⛔ This line read "moves in the same
--   increment" and was false from the day it shipped (QA finding M2), eight lines
--   below a header explaining that a sibling left behind is the whole reason this
--   increment exists. Its own write twin `addStaff` (src/lib/members/actions.ts) was
--   left behind by this very migration and moved in increment 4 too. Its sibling
--   `listOrgUsers` was moved off this column by AFF4 B6a and pinned by a
--   regression test written for that ONE function — one axis swept, its sibling
--   left behind. That is the whole reason this increment exists.
-- ============================================================================

create or replace function public.list_addable_commission_members(
  p_commission_id uuid,
  p_search text default null
)
returns table (user_id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_org_id uuid;
  v_q text;
begin
  -- UNCHANGED by AE2.2: who may read a commission's addable roster.
  if not (app.is_staff_admin_of(p_commission_id) or app.is_tenancy_admin_of(p_commission_id)) then
    return;
  end if;
  select c.organization_id into v_org_id from public.commissions c where c.id = p_commission_id;
  if v_org_id is null then
    return;
  end if;
  v_q := nullif(btrim(coalesce(p_search, '')), '');
  return query
  select pr.id, pr.full_name, pr.email::text
    from public.profiles pr
   -- AE2.2: was `pr.home_organization_id = v_org_id`, which carried NO
   -- affiliation filter of any kind and so listed a fully offboarded person as
   -- addable. ACTIVE affiliation only — an ENDED row retains administrative
   -- authority (ADR 0163) but never membership eligibility (bound 3).
   where exists (
           select 1
             from public.organization_affiliations oa
            where oa.principal_id    = pr.id
              and oa.organization_id = v_org_id
              and oa.ended_on  is null
              and oa.voided_at is null
         )
     and pr.is_active
     and not pr.is_admin
     and not exists (
       select 1 from public.memberships m
        where m.commission_id = p_commission_id and m.principal_id = pr.id
     )
     and (v_q is null or pr.full_name ilike '%' || v_q || '%' or pr.email ilike '%' || v_q || '%')
   order by pr.full_name nulls last, pr.email
   limit 500;
end;
$function$;

-- ⚠ `create or replace function` RESETS the ACL to the default for a NEW
-- function, so the grants are restated rather than assumed. Measured before
-- this migration: {postgres, authenticated, service_role}. 386/389 assert the
-- absence of PUBLIC EXECUTE across the surface; restating explicitly keeps this
-- door inside that guarantee instead of relying on default privileges holding.
revoke all on function public.list_addable_commission_members(uuid, text) from public;
grant execute on function public.list_addable_commission_members(uuid, text)
  to authenticated, service_role;
