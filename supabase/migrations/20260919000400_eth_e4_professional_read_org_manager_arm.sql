-- ETH·E4 §1.4 (ADR 0108 Decision 5) — `app.can_read_professional_profile` gains one
-- org-manager disjunct: `app.can_manage_professional(<profile>.organization_id, p_uid)`.
--
-- ⚠ `create or replace`, NEVER DROP+CREATE — the ACL/`prosecdef`/`proconfig` argument
-- in `20260919000300`'s header applies identically here, and this predicate backs TWO
-- live RLS policies (`professional_profiles_select` and
-- `professional_participants_select`), so a rebuild that quietly lost a property
-- would fail OPEN across both. `prosecdef`, `proconfig` and the ACL are diffed from
-- the catalog, property by property, against values captured before this ran.
--
-- WHY. The gate today resolves true only for a platform admin or for a professional
-- ALREADY SEATED on a case the caller can read. That makes the seating picker
-- unusable in the one place accuracy matters: an unseated professional shows as a
-- bare name, and two "João Silva" are indistinguishable at the moment a coordinator
-- designates a respondent on a disciplinary case. The picker also has to be able to
-- find a profile that has NEVER been seated — a `create_professional_profile` row has
-- no `participants` row until `ensure_professional_participant` mints one — so
-- without this arm the mint door's get-branch is unreachable from the product.
--
-- THE EXPOSURE ARGUMENT, STATED SO IT CAN BE CHECKED.
--   `participants_select` is already `app.is_org_member(organization_id)`, so every
--   professional's NAME and EXISTENCE IN THE REGISTRY are org-readable by design.
--   This arm adds `license_number` / `license_region` / `specialty` /
--   `professional_type` / `link_state` to people who may already seat professionals
--   (org admins and staff_admins of a commission in the org — the population
--   `can_manage_professional` names). It does NOT add the existence fact, and it
--   discloses no case linkage: `professional_participants` carries no `case_id`.
--   It IS a widening nonetheless, and is keystoned as one — pgTAP 321 keystone 3 was
--   shown able to fail by reverting this arm and requiring RED, because a
--   no-regression test passes a widening BY CONSTRUCTION.
--
-- TWO ADJACENT EXPOSURES, ACCEPTED DELIBERATELY RATHER THAN BY OMISSION.
--
--   1. THE MINT-TIME INFERENCE (new with ETH·E4). A professional's registry row is
--      created only at seating time, so post-E4 mere presence in the org-readable
--      `participants` table implies "was involved in at least one case" — with role,
--      case, direction and count all invisible. Accepted: the inference discloses no
--      proceeding, no role (the person may be a relator or a witness, not a
--      respondent), and no direction; the alternatives — tightening
--      `participants_select` for the professional type, or pre-minting the whole org
--      roster so that existence becomes uninformative — each cost more than the
--      inference reveals. If the PO's read of sigilo tightens, `participants_select`
--      is the single seam to revisit.
--
--   2. THE CALLER/TARGET ASYMMETRY. `app.can_manage_professional`'s `is_org_admin_of`
--      disjunct reads the CALLER's `auth.uid()`, not its `p_uid` target parameter
--      (pre-existing, recorded in that function's own header, left deliberately by
--      the ACT expiry work). Both policies backing THIS predicate bind
--      `p_uid = auth.uid()`, so caller and target coincide today — but this migration
--      propagates the asymmetry into a second predicate. Any future call site that
--      passes a non-caller `p_uid` must not inherit it silently; that is the moment
--      to fix `can_manage_professional`, not to work around it here.
--
-- RECURSION. The new arm reads `public.professional_profiles` from inside the
-- predicate that backs `professional_profiles_select`. That is safe for the same
-- catalog-verified reason the existing `case_participants` traversal is: this
-- function is SECURITY DEFINER owned by `postgres`, the table is owned by `postgres`,
-- and `relforcerowsecurity` is FALSE — so the owner's read bypasses RLS and the
-- policy is never re-entered. `can_manage_professional` reads `memberships` and
-- `commissions` only, so it introduces no cycle either.

create or replace function app.can_read_professional_profile(p_profile_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_org uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if coalesce(app.is_admin(), false) then
    return true;
  end if;

  -- ETH·E4 (ADR 0108 D5) — the org-manager arm. See the header for the exposure
  -- argument and the two accepted adjacent exposures.
  select organization_id into v_org
  from public.professional_profiles
  where id = p_profile_id;

  if v_org is not null and app.can_manage_professional(v_org, p_uid) then
    return true;
  end if;

  -- DEFINER traversal over BASE tables (bypasses RLS ⇒ no case_participants recursion,
  -- ADR 0064 R6): professional → professional_participants → case_participants(live)
  -- → case, gated by the broad can_read_case.
  return exists (
    select 1
    from public.professional_participants pp
    join public.case_participants cp
      on cp.participant_id = pp.participant_id
     and cp.removed_at is null
    where pp.professional_profile_id = p_profile_id
      and app.can_read_case_committee(cp.case_id, p_uid)
  );
end;
$$;
