-- =============================================================================
-- Phase A · A10 — profiles hospital_admin read arm (ADR 0051 Decision 7 / Q2)
-- =============================================================================
-- A hospital_admin runs a HOSPITAL-SCOPED user directory (`listHospitalUsers`)
-- and manages its hospital's staff (register/deactivate/…). Those reads run on
-- the ordinary RLS-scoped client (the directory) — but the `profiles` SELECT
-- policies admitted only `is_admin()` / `is_org_admin_of(...)`, so a
-- hospital_admin could not read its own hospital's users' profiles.
--
-- Add a hospital_admin arm to BOTH profiles SELECT policies, matching the Q2
-- scope (home hospital + membership in a commission of that hospital):
--   (a) home_hospital_id is a hospital the caller administers
--       (`is_hospital_admin_of(home_hospital_id)` — is_active-gated), OR
--   (b) the user is a member of a commission under a hospital the caller
--       administers (`is_commission_admin_of(c.id)`, which carries the
--       hospital_admin arm; this also KEEPS the org_admin coverage the previous
--       `is_org_admin_of(c.organization_id)` term gave, since is_commission_admin_of
--       = org_admin-of-org OR hospital_admin-of-hospital).
--
-- Every new branch that exposes ANOTHER user's row goes through an is_active-gated
-- helper (is_hospital_admin_of / is_commission_admin_of both fold is_active on the
-- caller), so an inactive caller stays denied (B1). This does NOT widen WRITE — a
-- hospital_admin's user MUTATIONS go through the service-role actions
-- (`src/lib/users/actions.ts`), gated in TS (amendment 11); this only lets the
-- read-side directory resolve.
-- =============================================================================

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles
  for select to authenticated
  using (
    (id = auth.uid())
    or (
      profiles.home_organization_id is not null
      and app.is_org_admin_of(profiles.home_organization_id)
    )
    -- ADR 0051: hospital_admin of the user's HOME hospital (home-anchored users,
    -- incl. a freshly-registered pending user with no committee yet).
    or (
      profiles.home_hospital_id is not null
      and app.is_hospital_admin_of(profiles.home_hospital_id)
    )
    -- Commission-admin (org_admin OR hospital_admin) via a shared commission. This
    -- SUPERSEDES the prior is_org_admin_of(c.organization_id) term (is_commission_admin_of
    -- includes it) and adds the hospital_admin coverage.
    or (exists (
      select 1
      from public.commission_members cm
      join public.commissions c on c.id = cm.commission_id
      where cm.user_id = profiles.id
        and app.is_commission_admin_of(c.id)
    ))
    -- shared-commission peer visibility (pre-existing path). RAW join → guard the
    -- caller's activity explicitly (B1) so an inactive peer is denied.
    or (
      app.is_active(auth.uid())
      and exists (
        select 1
        from public.commission_members me
        join public.commission_members them on them.commission_id = me.commission_id
        where me.user_id = auth.uid()
          and them.user_id = profiles.id
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
      from public.commission_members cm
      join public.commissions c on c.id = cm.commission_id
      where cm.user_id = profiles.id
        and app.is_commission_admin_of(c.id)
    ))
  );
