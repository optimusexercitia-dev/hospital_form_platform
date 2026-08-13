-- =============================================================================
-- Phase A · A10 — organization_members self-read arm (ADR 0051)
-- =============================================================================
-- The session context (`getSessionContext`) must resolve the caller's OWN role
-- grants — including `hospital_admin` and `nsp_org_admin` — so the app-layer
-- gates (`adminedHospitals`, `isHospitalAdmin`, the A10 hospital-admin authz)
-- know what the caller may do. But `organization_members_select` admitted only
-- `is_admin() OR is_org_admin_of(organization_id)`: an org_admin reads its own
-- rows (it passes is_org_admin_of), but a HOSPITAL_ADMIN does NOT — so it could
-- not even read its OWN grant, and every hospital_admin gate failed closed.
--
-- Add a SELF-READ arm: any authenticated user may read their OWN
-- organization_members rows (`user_id = auth.uid()`). This is minimum-necessary
-- and leaks nothing — a user already knows their own roles; it exposes no OTHER
-- member's grants and no cross-tenant data. The org_admin/admin arms are
-- unchanged (they still read the FULL roster of their org for management). The
-- WRITE policy is deliberately NOT touched (appointments stay org_admin-only via
-- the A4 RPCs; a self-read cannot self-grant).
-- =============================================================================

drop policy if exists "organization_members_select" on public.organization_members;
create policy "organization_members_select" on public.organization_members
  for select to authenticated
  using (
    app.is_admin()
    or app.is_org_admin_of(organization_id)
    or user_id = auth.uid()   -- self-read: a member reads their OWN role grants (ADR 0051)
  );

comment on policy "organization_members_select" on public.organization_members is
  'A member reads their OWN grants (user_id = auth.uid()) so getSessionContext can resolve hospital_admin/nsp_org_admin standing (ADR 0051); an admin/org_admin reads the full org roster. Minimum-necessary — no cross-member or cross-tenant exposure. WRITE stays org_admin-only.';
