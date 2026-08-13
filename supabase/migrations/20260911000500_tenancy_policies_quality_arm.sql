-- =============================================================================
-- QO·A M6 — the tenancy-shell SELECT arms (ADR 0100 / plan §A.1 M6).
--
-- A quality_reviewer is invisible to the org shell today: none of the three
-- SELECT policies' arms matches a hospital-scoped reviewer row (is_org_member
-- is commission-join based — buildnotes row 21). Three arms, via ALTER POLICY
-- (never DROP+CREATE — preserves cmd/roles/permissive), each qual re-emitted
-- from the live pg_policies text + exactly one new disjunct:
--
--   commissions: reviewer of the hospital AND oversight-visible — an excluded
--                commission's ROW is invisible, matching the S7/D8 boundary.
--   hospitals:   reviewer of the hospital (tenancy metadata for the shell/nav).
--   organizations: reviewer anywhere in the org, via the new helper.
--
-- ⛔ is_org_level_admin_within is NOT widened — its explicit
-- ('hospital_admin','nsp_org_admin') list feeds admin surfaces.
-- =============================================================================

-- Mirrors app.is_org_level_admin_within's shape (direct organization_id read —
-- a reviewer row carries organization_id NOT NULL by the scope CHECK), with the
-- same is_active + expiry filters.
create function app.is_quality_reviewer_in_org(p_org_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_active((select auth.uid())) and exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id
      and m.principal_id = (select auth.uid())
      and m.role = 'quality_reviewer'
      and (m.expires_at is null or m.expires_at > now())
  );
$function$;

revoke all on function app.is_quality_reviewer_in_org(uuid) from public;
grant execute on function app.is_quality_reviewer_in_org(uuid) to authenticated, service_role;

alter policy commissions_select_member_or_admin on public.commissions
  using (
    app.is_member_of(id)
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(hospital_id)
    or app.is_pqs_operator_of(hospital_id)
    or app.is_nsp_org_admin_of(organization_id)
    -- QO·A: the reviewer sees only oversight-VISIBLE commissions of hospitals
    -- they review (D8 — an excluded committee has no shell row for them).
    or (app.is_quality_reviewer_of(hospital_id) and quality_oversight = 'visible')
  );

alter policy hospitals_select on public.hospitals
  using (
    app.is_admin()
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(id)
    or app.is_nsp_org_admin_of(organization_id)
    -- QO·A: the reviewed hospital's row is tenancy metadata the shell needs.
    or app.is_quality_reviewer_of(id)
  );

alter policy organizations_select on public.organizations
  using (
    app.is_admin()
    or app.is_org_admin_of(id)
    or app.is_org_member(id)
    or app.is_pqs_operator_in_org(id)
    or app.is_nsp_org_admin_of(id)
    or app.is_org_level_admin_within(id)
    -- QO·A: reviewer anywhere in the org reaches the org shell row.
    or app.is_quality_reviewer_in_org(id)
  );

-- Postcondition: the three arms landed; the admin helper was NOT widened.
do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'public'
        and ((tablename = 'commissions'   and policyname = 'commissions_select_member_or_admin')
          or (tablename = 'hospitals'     and policyname = 'hospitals_select')
          or (tablename = 'organizations' and policyname = 'organizations_select'))
        and qual ~ 'quality_reviewer') <> 3 then
    raise exception 'M6 postcondition: a tenancy-shell arm is missing';
  end if;
  if (select regexp_replace(p.prosrc, '--[^\n]*', '', 'g')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'is_org_level_admin_within') ~ 'quality_reviewer' then
    raise exception 'M6 postcondition: is_org_level_admin_within was widened (forbidden)';
  end if;
end $$;
