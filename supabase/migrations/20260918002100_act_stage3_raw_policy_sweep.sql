-- ACT Stage 3 (ADR 0106) — raw-policy sweep (QA r1/r2 carry-forward).
--
-- Swept `pg_policies` across ALL schemas for predicates reading `memberships`
-- directly without an `app.*` door. 3 policies matched (6 EXISTS-arm
-- occurrences of the `memberships` table total); full derivation in
-- docs/plans/act-as-buildnotes.md Stage 3.
--
-- 5 of the 6 arms are TARGET-side reads only: they scan `memberships` to find
-- which org/hospital the ROW BEING READ's subject belongs to (never the
-- caller's own row), then delegate the actual authorization decision to an
-- app.* door (`is_org_admin_of`/`is_tenancy_admin_of`/`is_hospital_admin_of`)
-- checking the CALLER. "What roles another user holds is not a function of MY
-- hat" (plan §4 Stage 3) — these need no change and are recorded here as
-- reasoned, named exceptions, not left silently unswept:
--   - hospital_affiliations_select's co-membership arm (target-side only)
--   - profiles_admin_select's two arms (target-side only, both)
--   - profiles_select_self_or_admin's tenancy-admin arm (target-side only)
--
-- The 6th arm is the ONE that needed a fix — profiles_select_self_or_admin's
-- co-member arm, the KNOWN INSTANCE the plan names explicitly: it read the
-- CALLER's own membership row directly (`me.principal_id = auth.uid()`), any
-- role, no hat-awareness at all. Per §2's caller-only binding: the CALLER side
-- of the EXISTS now goes through hat-aware `app.is_member_of` (a caller check
-- through has_role_any); the TARGET side stays any-role (`them.principal_id =
-- profiles.id`), unchanged — "what roles another user holds is not a function
-- of MY hat" applies here as much as to the other 5 arms. QA r2's explicit
-- carry-forward: the caller side must route LITERALLY through `is_member_of`,
-- not a looser predicate that merely looks equivalent — done verbatim below.

-- ALTER POLICY (not DROP+CREATE): changes only the USING expression, leaving
-- the policy's command/roles/permissiveness untouched by construction — the
-- "a rebuild silently loses a property" lesson, applied to a policy instead
-- of a function.
alter policy profiles_select_self_or_admin
  on public.profiles
  using (
    (id = (select auth.uid()))
    or ((home_organization_id is not null) and app.is_org_admin_of(home_organization_id))
    or (exists (
      select 1
      from public.memberships cm
      join public.commissions c on c.id = cm.commission_id
      where cm.commission_id is not null
        and cm.principal_id = profiles.id
        and app.is_tenancy_admin_of(c.id)
    ))
    or (
      app.is_active((select auth.uid()))
      and exists (
        select 1
        from public.memberships them
        where them.commission_id is not null
          and them.principal_id = profiles.id
          and app.is_member_of(them.commission_id)
      )
    )
    or (exists (
      select 1 from public.hospital_affiliations ha
      where ha.principal_id = profiles.id
        and ha.ended_on is null
        and app.is_hospital_admin_of(ha.hospital_id)
    ))
    or (exists (
      select 1
      from public.memberships hm
      left join public.commissions hc on hc.id = hm.commission_id
      where hm.principal_id = profiles.id
        and coalesce(hm.hospital_id, hc.hospital_id) is not null
        and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id))
    ))
  );
