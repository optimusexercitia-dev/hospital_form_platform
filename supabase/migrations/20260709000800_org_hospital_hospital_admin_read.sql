-- =============================================================================
-- Phase A · BUG-HAT-003 — organizations + hospitals hospital_admin read arms
-- (ADR 0051 Decision 1/7)
-- =============================================================================
-- ROOT CAUSE of the inert HAT-001/002 fixes: getSessionContext resolves
-- hospitalAdminOf by reading organization_members (self-read arm, …000500) and
-- EMBEDDING organizations + hospitals. The self-read returns the grant row, but
-- `hospitals_select` and `organizations_select` were both
-- USING (is_admin() OR is_org_admin_of(...)) — neither admitted a hospital_admin
-- reading its OWN hospital/org, so the embeds came back NULL and hospitalAdminOf
-- was empty at runtime. Both HAT-001 (landing) and HAT-002 (commission access)
-- then starved on the empty context.
--
-- CONVERGENCE (mandate): the full getSessionContext read path for a hospital_admin
-- was audited. Dropping policies found + fixed here:
--   * hospitals_select      — the hospital_admin arm's `hospitals` embed.
--   * organizations_select  — the hospital_admin AND nsp_org_admin arms'
--                             `organizations` embed (an org-level role holder with
--                             NO commission membership is not covered by the
--                             existing is_org_member arm). This ALSO repairs
--                             getCommissionAccessByOrg, whose `organizations!inner`
--                             embed was dropping the row for a hospital_admin.
-- Other reads were verified OK: profiles (self arm), commission_members/commissions
-- (a hospital_admin holds no membership rows — nothing to drop), and the org_admin
-- arm (unchanged). is_active is folded transitively via is_hospital_admin_of.
-- =============================================================================

-- Helper: the caller holds an org-LEVEL admin role (hospital_admin OR nsp_org_admin)
-- somewhere WITHIN the given org — i.e. it may read that org's identity row so its
-- session context resolves. STABLE SECURITY DEFINER, search_path pinned, is_active-
-- gated like the peer predicates. NOT org-wide data access — only the org row.
create or replace function app.is_org_level_admin_within(p_org_id uuid)
  returns boolean language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(auth.uid()) and exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role in ('hospital_admin', 'nsp_org_admin')
  );
$$;
alter function app.is_org_level_admin_within(uuid) owner to postgres;
comment on function app.is_org_level_admin_within(uuid) is
  'ADR 0051 (BUG-HAT-003): the caller holds an org-level admin role (hospital_admin or nsp_org_admin) within the org, so it may read the org identity row for its session context. Not org-wide data access — organizations_select only. is_active-gated.';

revoke all on function app.is_org_level_admin_within(uuid) from public;
grant execute on function app.is_org_level_admin_within(uuid) to authenticated, service_role;

-- 1. hospitals_select — add the hospital_admin arm (reads its OWN hospital only;
--    is_hospital_admin_of(id) is per-hospital, so a sibling hospital stays hidden).
drop policy if exists "hospitals_select" on public.hospitals;
create policy "hospitals_select" on public.hospitals
  for select to authenticated
  using (
    app.is_admin()
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(id)   -- ADR 0051: reads its own hospital's row
  );
comment on policy "hospitals_select" on public.hospitals is
  'ADR 0051 (BUG-HAT-003): a hospital_admin reads its OWN hospital''s row (is_hospital_admin_of(id), per-hospital — a sibling hospital stays hidden) so getSessionContext''s hospital embed resolves. WRITE stays org_admin-only (hospitals_write untouched).';

-- 2. organizations_select — add the org-level-admin arm (hospital_admin /
--    nsp_org_admin within the org). Preserves the existing is_admin / org_admin /
--    is_org_member / PQS / coordinator arms.
drop policy if exists "organizations_select" on public.organizations;
create policy "organizations_select" on public.organizations
  for select to authenticated
  using (
    app.is_admin()
    or app.is_org_admin_of(id)
    or app.is_org_member(id)
    or app.is_pqs_member_of(id)
    or app.is_nsp_coordinator_of(id)
    or app.is_org_level_admin_within(id)   -- ADR 0051: hospital_admin / nsp_org_admin
  );
comment on policy "organizations_select" on public.organizations is
  'ADR 0051 (BUG-HAT-003): adds an org-level-admin arm (hospital_admin/nsp_org_admin within the org, who may hold NO commission membership so is_org_member does not cover them) so getSessionContext + getCommissionAccessByOrg''s org embed resolve. Per-org, not org-wide data access.';
