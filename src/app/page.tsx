import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth/actions";
import { getSessionContext } from "@/lib/queries/session";
import { commissionHref, nspHref, orgHref, qualidadeHref } from "@/lib/routing";

/**
 * Root role-landing. Server Component — resolves where the signed-in user
 * belongs and redirects there. Middleware already bounces the unauthenticated
 * to /login, but we re-check defensively.
 *
 * Precedence (multi-tenancy, confirmed with the lead):
 *  - platform_admin (vendor)            → /admin        (provisioning registry)
 *  - org_admin of exactly one org       → /o/<org>/manage
 *  - org_admin of more than one org     → /o            (org picker)
 *  - hospital_admin of one org's hosp.  → /o/<org>/manage  (its hospital-scoped area)
 *  - hospital_admin across >1 org       → /o            (org picker)
 *  - nsp_org_admin of ≥1 org            → /o/<org>/nsp-org  (org NSP-admin console)
 *  - exactly one commission membership  → /o/<org>/c/<commission>
 *  - more than one membership           → /c            (grouped picker)
 *  - NSP operator of ≥1 hospital        → /o/<org>/nsp  (nsp_coordinator | pqs_member)
 *  - technical direction of ≥1 hospital → /o/<org>/direcao-tecnica
 *  - quality reviewer of ≥1 hospital    → /o/<org>/qualidade
 *  - none of the above                  → friendly "sem acesso" screen
 *
 * platform_admin is walled off from tenant data (it holds no memberships), so it
 * lands on its own provisioning area. An org_admin — even one who also belongs to
 * commissions — lands on their org's manage area first (their super-user home);
 * they navigate into commissions from there. A `hospital_admin` (ADR 0051) is a
 * local super-user of its hospital(s): it lands on its org's manage area (which
 * renders hospital-scoped content from its grants), taking precedence over plain
 * commission membership — same as org_admin does. A user who is BOTH org_admin and
 * hospital_admin resolves via the org_admin branch above (unchanged), so this only
 * fires for a hospital_admin-only persona (e.g. `hospitaladmin.a1@`), which the
 * previous logic dropped into the "sem acesso" dead end (BUG-HAT-001).
 *
 * An `nsp_org_admin` (NSP-per-hospital, ADR 0052) is an org-level, PHI-free NSP
 * governance role — a super-user of its org's NSP administration. It lands on the
 * org NSP-admin console (`/o/<org>/nsp-org`), taking precedence over plain
 * commission membership, so an `nsp_org_admin`-only persona reaches its console
 * instead of the "sem acesso" dead end (the BUG-HAT-001 pattern). A user who is
 * ALSO org_admin/hospital_admin resolves via those branches above first (the manage
 * area is their primary home; the NSP-admin console is reachable from there).
 */
export default async function Home() {
  const context = await getSessionContext();

  if (!context) {
    redirect("/login");
  }

  // A mid-session-deactivated or currently-suspended user must land on the
  // inactive-account page, not the "sem acesso" fallback — backend exposes
  // `context.isInactive` (derived from the same lifecycle signals as
  // `deriveUserStatus`) for exactly this gate.
  if (context.isInactive) {
    redirect("/conta-inativa");
  }

  if (context.isAdmin) {
    redirect("/admin");
  }

  if (context.orgAdminOf.length === 1) {
    redirect(orgHref(context.orgAdminOf[0].organization.slug, "manage"));
  }

  if (context.orgAdminOf.length > 1) {
    redirect("/o");
  }

  // hospital_admin-only landing (ADR 0051): route to the manage area of the org
  // its hospital(s) belong to — the manage area itself scopes to the hospital(s)
  // from the caller's grants. Disambiguate on DISTINCT orgs (a caller may admin
  // several hospitals within one org, or hospitals across orgs), mirroring the
  // org_admin branch: one org → straight to its manage area; several → the org
  // picker at /o.
  if (context.hospitalAdminOf.length > 0) {
    const orgSlugs = new Set(
      context.hospitalAdminOf.map((h) => h.organization.slug),
    );
    if (orgSlugs.size === 1) {
      redirect(orgHref(context.hospitalAdminOf[0].organization.slug, "manage"));
    }
    redirect("/o");
  }

  // nsp_org_admin landing (NSP-per-hospital, ADR 0052): an org-level, PHI-free NSP
  // governance role. Lands on its org's NSP-admin console. `nspOrgAdminOf` is
  // name-sorted, so the first entry is a stable pick when the caller administers the
  // NSP of more than one org (rare); the console itself re-gates server-side. This
  // takes precedence over plain commission membership — the console is this persona's
  // super-user home, and it rescues an nsp_org_admin-only user from "sem acesso".
  if (context.nspOrgAdminOf.length > 0) {
    redirect(orgHref(context.nspOrgAdminOf[0].organization.slug, "nsp-org"));
  }

  if (context.memberships.length === 1) {
    const { commission } = context.memberships[0];
    redirect(commissionHref(commission.organization.slug, commission.slug));
  }

  if (context.memberships.length > 1) {
    redirect("/c");
  }

  // ADR 0101 / FUP-QO-2 (F7) — the NSP operators (`nsp_coordinator`, `pqs_member`).
  // Instances 4 and 5 of the class the two branches below describe, and the first ones
  // NOT found by a user hitting the dead end: the catalog-derived guard
  // `src/lib/queries/session-grants.test.ts` enumerates `memberships_role_check` and
  // fired on its first run naming both roles. Both are hospital-scoped with
  // `commission_id NULL`, so every branch above stepped over them while the account was
  // fully provisioned — the NSP console was reachable all along (`list_my_nsp_hospitals()`
  // unions both roles and `organizations_select` admits them), just not from the front
  // door.
  //
  // FIRST of the three office branches, and after the commission branches for the same
  // reason they are: the NSP hat is worn ALONGSIDE a day job, so this only changes the
  // outcome for someone who would otherwise dead-end. `nspOperatorOf` is
  // hospital-name-sorted, so the first entry is a stable pick for an operator covering
  // several hospitals; the console re-gates server-side. The entry's `role` is DISPLAY
  // ONLY — nothing here gates on it.
  if (context.nspOperatorOf.length > 0) {
    redirect(nspHref(context.nspOperatorOf[0].organization.slug));
  }

  // ADR 0094 W4 / FUP-MEM-3b — the Diretor Técnico. Placed AFTER the commission
  // branches on purpose: the office is a hat worn ALONGSIDE a day job, so a DT who
  // also belongs to a commission keeps landing where they always did. This branch only
  // changes the outcome for someone who would otherwise hit "sem acesso" — which,
  // until now, is exactly what a pure DT got. The office confers no membership, so
  // every branch above steps over it and the account looked unprovisioned.
  // ⚠ The consequence of that placement: a DT who IS a commission member has no link
  // to their inbox yet (they land on the commission). Tracked with FUP-MEM-3b.
  if (context.technicalDirectionOf.length > 0) {
    redirect(
      orgHref(context.technicalDirectionOf[0].organization.slug, "direcao-tecnica"),
    );
  }

  // ADR 0100 — the quality reviewer (FUP-QO-2). Placed here for the SAME reason
  // as the Diretor Técnico above, and it is the same failure a third time: the
  // office is hospital-scoped with `commission_id NULL`, so every branch above
  // steps over it and the account looked unprovisioned while being fully
  // provisioned. For the pilot's PRIMARY DAILY USER that would have meant signing
  // in to "Você ainda não tem acesso".
  //
  // After the commission branches on purpose: a reviewer who also belongs to a
  // committee keeps landing where they always did, and reaches the console from
  // the sidebar's "Escritório da Qualidade" entry. This branch only changes the
  // outcome for someone who would otherwise hit the dead end.
  if (context.qualityReviewerOf.length > 0) {
    redirect(qualidadeHref(context.qualityReviewerOf[0].organization.slug));
  }

  // No org-admin role and no commissions — nothing to route to. Show a calm,
  // actionable pt-BR message rather than a dead redirect loop.
  return <NoAccess email={context.email} />;
}

function NoAccess({ email }: { email: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">
        Comissões Hospitalares
      </p>
      <h1 className="text-3xl text-balance">Você ainda não tem acesso</h1>
      <p className="text-muted-foreground text-pretty">
        Sua conta ({email}) ainda não está vinculada a nenhuma comissão. Fale
        com o administrador da sua instituição para receber acesso.
      </p>
      {/* Escape hatch so the user isn't stuck — sign out first (a plain link to
          /login would be bounced straight back here: the proxy redirects any
          still-authenticated session away from /login, per AUTHED_REDIRECT_AWAY
          in src/proxy.ts) then land on login to switch accounts. */}
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-lg px-4 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Entrar com outra conta
        </button>
      </form>
    </main>
  );
}
