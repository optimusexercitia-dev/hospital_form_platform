-- ============================================================================
-- MEM-5 (fix) · Restore the two profiles SELECT policies that DROP TABLE
--   commission_members CASCADE removed.
--
-- profiles_select_self_or_admin + profiles_admin_select (last defined in
-- 20260709000600_profiles_hospital_admin_read.sql) each had a RAW
-- `from public.commission_members` join in their USING clause, so dropping the
-- legacy table with CASCADE dropped BOTH policies — leaving `profiles` with no
-- SELECT policy (co-members could no longer read each other; org/hospital-admin
-- directory reads broke). These are the ONLY two CASCADE victims (verified: every
-- other RLS term uses the app.is_* predicates, which were repointed in place).
--
-- Recreate them BYTE-FOR-BYTE except the two raw legacy joins are repointed to
-- public.memberships (commission-scope rows: commission_id set), preserving the
-- exact authorization: self · org-admin of home org · hospital-admin of home
-- hospital · commission-admin via a shared commission · shared-commission peer.
-- ============================================================================

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select to authenticated
  using (
    (id = (select auth.uid()))
    or (
      profiles.home_organization_id is not null
      and app.is_org_admin_of(profiles.home_organization_id)
    )
    -- ADR 0051: hospital_admin of the user's HOME hospital.
    or (
      profiles.home_hospital_id is not null
      and app.is_hospital_admin_of(profiles.home_hospital_id)
    )
    -- Commission-admin (org_admin OR hospital_admin) via a shared commission.
    -- MEM: commission_members -> memberships commission-scope rows.
    or (exists (
      select 1
      from public.memberships cm
      join public.commissions c on c.id = cm.commission_id
      where cm.commission_id is not null
        and cm.principal_id = profiles.id
        and app.is_commission_admin_of(c.id)
    ))
    -- Shared-commission peer visibility. RAW join → guard the caller's activity
    -- explicitly (B1) so an inactive peer is denied. MEM: both sides -> memberships.
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
  );

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select"
  on public.profiles
  for select to authenticated
  using (
    app.is_admin()
    or (
      profiles.home_organization_id is not null
      and app.is_org_admin_of(profiles.home_organization_id)
    )
    -- ADR 0051 hospital_admin arms (parity with profiles_select_self_or_admin).
    or (
      profiles.home_hospital_id is not null
      and app.is_hospital_admin_of(profiles.home_hospital_id)
    )
    or (exists (
      select 1
      from public.memberships cm
      join public.commissions c on c.id = cm.commission_id
      where cm.commission_id is not null
        and cm.principal_id = profiles.id
        and app.is_commission_admin_of(c.id)
    ))
  );
