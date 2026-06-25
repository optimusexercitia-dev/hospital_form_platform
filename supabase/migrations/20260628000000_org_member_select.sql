-- ----------------------------------------------------------------------------
-- Multi-tenancy fix (BUG-MT-003 / BUG-MT-004) — let regular commission members
-- read their OWN org row. Forward-only, additive.
--
-- The Phase-A `organizations_select` policy was `is_admin() OR is_org_admin_of(id)`,
-- which excluded plain staff / staff_admin from reading the organization their
-- commission belongs to. But the member routing path joins commission ->
-- organization for EVERY member: resolveLanding() (post-login landing) and
-- getCommissionAccessByOrg() (the central resolver behind every
-- /o/[org]/c/[commission]/* page, via `organizations!inner`). With the org join
-- returning null, login landed at `/` and every commission page 404'd for
-- non-admins — the app was unusable for normal users.
--
-- Fix: a member may read ONLY the orgs they belong to (a commission membership in
-- that org). No isolation leak — platform_admin holds no membership, so the
-- platform wall on tenant data is unaffected, and a member still cannot read any
-- OTHER org's row. hospitals_select is left tight: no member-facing query joins
-- commission -> hospital (the routing path joins only organization), so hospitals
-- stays org_admin/platform_admin-only.
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

-- Predicate: is the caller a member of ANY commission in this org? Mirrors
-- app.is_member_of (STABLE SECURITY DEFINER, search_path pinned).
CREATE OR REPLACE FUNCTION "app"."is_org_member"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.commissions c
    join public.commission_members cm on cm.commission_id = c.id
    where c.organization_id = p_org_id
      and cm.user_id = auth.uid()
  );
$$;

ALTER FUNCTION "app"."is_org_member"("p_org_id" "uuid") OWNER TO "postgres";

-- Broaden the SELECT policy: platform_admin (all) OR org_admin of the org OR a
-- member of a commission in the org.
DROP POLICY "organizations_select" ON "public"."organizations";
CREATE POLICY "organizations_select" ON "public"."organizations" FOR SELECT TO "authenticated"
  USING (("app"."is_admin"() OR "app"."is_org_admin_of"("id") OR "app"."is_org_member"("id")));

REVOKE ALL ON FUNCTION "app"."is_org_member"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_org_member"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_org_member"("p_org_id" "uuid") TO "service_role";
