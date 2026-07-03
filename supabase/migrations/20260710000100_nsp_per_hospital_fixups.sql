-- ============================================================================
-- NSP-per-hospital fix-ups (Phase B tester-gate fixes; ADR 0052).
-- Additive, forward-only. Two bugs surfaced by the E2E gate:
--
-- BUG-NPH-001: hospitals_select has no nsp_org_admin arm, so an nsp_org_admin's
--   RLS-gated `from('hospitals')` read (which assignNspCoordinator /
--   revokeNspCoordinator do to resolve the hospital's org before calling the
--   correct DEFINER RPC) returns zero rows → the action fails `forbidden` before
--   the RPC runs. Same class as BUG-HAT-003. Fix: add an explicit
--   `OR app.is_nsp_org_admin_of(organization_id)` arm — the org-level NSP admin needs
--   to read ALL its org's hospitals (to appoint per-hospital coordinators). We do NOT
--   use `is_org_level_admin_within` here (it ALSO covers hospital_admin, which would
--   let a hospital_admin read SIBLING hospitals — breaking the per-hospital isolation
--   the hospital_admin's own `is_hospital_admin_of(id)` arm enforces; pgTAP 188 t14).
--   Minimum-necessary: nsp_org_admin reads its OWN org's hospitals only.
--
-- BUG-NPH-002: the dispose_referral_phi gate is CORRECT (ADR 0052 §6 — a plain
--   commission staff_admin is intentionally NOT entitled to erase PHI); the FE was
--   dangling a control the RPC rejects. Fix: add a read-only probe
--   canDisposeReferralPhi(referral) mirroring the RPC gate EXACTLY, so the FE gates
--   the affordance to entitled callers only. The destructive door is unchanged.
-- ============================================================================

-- BUG-NPH-001 — hospitals_select += nsp_org_admin arm ONLY (NOT the broader
-- is_org_level_admin_within, which would leak sibling hospitals to a hospital_admin).
drop policy if exists hospitals_select on public.hospitals;
create policy hospitals_select on public.hospitals
  for select to authenticated
  using (
    app.is_admin()
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(id)
    or app.is_nsp_org_admin_of(organization_id)
  );

-- BUG-NPH-002 — read-only entitlement probe mirroring dispose_referral_phi's gate
-- EXACTLY: is_admin OR source-commission-admin OR EITHER endpoint hospital's NSP
-- operator. Safe-default FALSE for the FE (never throws). Does NOT read or mutate
-- PHI — it only answers "may this caller invoke the disposal door?".
create or replace function public.can_dispose_referral_phi(p_referral_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select
    app.is_admin()
    or exists (
      select 1 from public.case_referral r
      where r.id = p_referral_id
        and (
          app.is_commission_admin_of(r.source_commission_id)
          or app.is_pqs_operator_of(app.hospital_of_commission(r.source_commission_id))
          or app.is_pqs_operator_of(app.hospital_of_commission(r.target_commission_id))
        )
    );
$function$;

alter function public.can_dispose_referral_phi(uuid) owner to postgres;
revoke all on function public.can_dispose_referral_phi(uuid) from public;
grant execute on function public.can_dispose_referral_phi(uuid) to authenticated, service_role;
