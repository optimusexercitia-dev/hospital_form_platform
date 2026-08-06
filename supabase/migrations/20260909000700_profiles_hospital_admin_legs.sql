-- AFF W2 / T2.3 — widen `profiles` SELECT with the affiliation + membership legs.
--
-- ADR 0097 D6. This REPLACES the `home_hospital_id` leg `20260909000300` removed, and
-- it is a deliberate SECURITY WIDENING — it carries a diff-scoped `ARM=policy` run and
-- keystones with both ALLOW and DENY arms (pgTAP `302` §4).
--
-- TWO LEGS, added to BOTH SELECT policies so the pair stays mirrored exactly as it was
-- before W1 (they already differ only in `is_admin()` vs `self`+co-member; letting the
-- hospital legs land in one and not the other is how a pair drifts):
--
--   AFFILIATION — the principal holds an ACTIVE affiliation to a hospital I administer.
--                 This is the leg that makes a registered-but-uncommitteed person
--                 visible to their own hospital's admin (D2's whole premise).
--   MEMBERSHIP  — the principal holds ANY membership, of any tier, under a hospital I
--                 administer. This closes ADR 0097 finding 3 INDEPENDENTLY of the
--                 affiliation feature: measured live, a hospital_admin could read 21/34
--                 membership rows but only 13/30 profiles, leaving SIX membership rows
--                 whose `principal_id` could not be resolved — their own co-hospital
--                 admin, their hospital's technical_director and deputy, and every
--                 nsp_coordinator and pqs_member. A roster joining the two rendered
--                 blank rows. That is a live defect, not a feature request.
--
-- ⚠ THIS MIGRATION INVERTS pgTAP `301` §5.1, which was written in W1 to PIN the gap
-- between the removal and this restoration. `301` §5.1 is updated in the same commit;
-- an assertion that says "the admin reads ZERO profiles" must not survive the migration
-- that makes them read one.
--
-- ⚠ RLS COUPLING, stated because it is load-bearing and invisible. A policy's subquery
-- is executed by the invoking role, so `hospital_affiliations` and `memberships` are
-- themselves RLS-filtered inside these legs. The affiliation leg therefore reduces to
-- `hospital_affiliations_select`'s own leg 3 (`is_hospital_admin_of(hospital_id)`) —
-- identical reach, no loss — and the membership leg to `memberships_select`'s hospital
-- and commission arms, both of which admit a hospital_admin over their own hospital.
-- Narrowing either of those tables therefore narrows this one. That is arguably correct
-- (you should not be admitted to a profile through a row you cannot see) but it is
-- IMPLICIT, so `302` asserts the reach with real rows under `set local role` rather
-- than trusting the composition.
--
-- ⚠ THE DENY ARM IN `302` PINS THE DEFAULT STATE, NOT A HARD BOUNDARY (D6 / audit
-- LOW-1). `affiliate_person` lets ANY in-org hospital admin self-serve an affiliation
-- (audited, actor-named), after which the affiliation leg admits them. The tenant
-- boundary remains the ORGANISATION. A future auditor must not read the sibling-hospital
-- DENY keystone as tenant isolation.

alter policy profiles_admin_select on public.profiles
  using (
    app.is_admin()
    or (home_organization_id is not null and app.is_org_admin_of(home_organization_id))
    or exists (
      select 1
      from public.memberships cm
      join public.commissions c on c.id = cm.commission_id
      where cm.commission_id is not null
        and cm.principal_id = profiles.id
        and app.is_commission_admin_of(c.id)
    )
    -- AFF T2.3 — affiliation leg.
    or exists (
      select 1
      from public.hospital_affiliations ha
      where ha.principal_id = profiles.id
        and ha.ended_on is null
        and app.is_hospital_admin_of(ha.hospital_id)
    )
    -- AFF T2.3 — membership leg (any tier under a hospital I administer).
    or exists (
      select 1
      from public.memberships hm
      left join public.commissions hc on hc.id = hm.commission_id
      where hm.principal_id = profiles.id
        and coalesce(hm.hospital_id, hc.hospital_id) is not null
        and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id))
    )
  );

alter policy profiles_select_self_or_admin on public.profiles
  using (
    id = (select auth.uid())
    or (home_organization_id is not null and app.is_org_admin_of(home_organization_id))
    or exists (
      select 1
      from public.memberships cm
      join public.commissions c on c.id = cm.commission_id
      where cm.commission_id is not null
        and cm.principal_id = profiles.id
        and app.is_commission_admin_of(c.id)
    )
    or (
      app.is_active((select auth.uid()))
      and exists (
        select 1
        from public.memberships me
        join public.memberships them on them.commission_id = me.commission_id
        where me.commission_id is not null
          and me.principal_id = (select auth.uid())
          and them.principal_id = profiles.id
      )
    )
    -- AFF T2.3 — affiliation leg.
    or exists (
      select 1
      from public.hospital_affiliations ha
      where ha.principal_id = profiles.id
        and ha.ended_on is null
        and app.is_hospital_admin_of(ha.hospital_id)
    )
    -- AFF T2.3 — membership leg (any tier under a hospital I administer).
    or exists (
      select 1
      from public.memberships hm
      left join public.commissions hc on hc.id = hm.commission_id
      where hm.principal_id = profiles.id
        and coalesce(hm.hospital_id, hc.hospital_id) is not null
        and app.is_hospital_admin_of(coalesce(hm.hospital_id, hc.hospital_id))
    )
  );
