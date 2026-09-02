import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth/actions";
import { getSessionContext } from "@/lib/queries/session";
import { LANDING_BRANCHES, resolveLanding } from "@/lib/role/role-catalog";

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

  // ACT (ADR 0106) — a multi-role principal with no active hat yet must pick
  // one before any of the precedence branches below run (D5: a hatless
  // multi-role session is a stranger to every hat-aware door; the branches
  // below stay hat-BLIND reads, so letting them run first would silently pick
  // one hat's landing route without ever minting the claim). Placed here per
  // the Stage 3 destination sweep (`docs/plans/act-as-buildnotes.md` §9) —
  // after the account-status gates, before `isAdmin`.
  if (context.needsRoleSelection) {
    redirect("/selecionar-perfil");
  }

  // ⭐ AE4.8 — THE PRECEDENCE CHAIN IS ONE LOOP OVER THE SHARED MANIFEST.
  //
  // What used to be eight hand-written `if` blocks here, hand-MIRRORED a second time in
  // `landingRouteForRole`, is now one walk over `LANDING_BRANCHES` — an order derived from
  // `ROLE_ORDER` in `@/lib/role/role-catalog`. Both consumers apply the same
  // `resolveLanding`, so a new role crosses ONE seam. That is the whole point: three times
  // a hospital- or org-scoped role (`commission_id NULL`) crossed the partition and not
  // this chain, or neither, and its holder read "Você ainda não tem acesso" while being
  // fully provisioned — BUG-HAT-001, then the Diretor Técnico, then `quality_reviewer`.
  // `src/lib/queries/session-grants.test.ts` is the guard; this loop is what it now has
  // only one place to fail.
  //
  // ⛔ THE ORDER IS BEHAVIOUR, AND IT LIVES IN `ROLE_ORDER` — do not reintroduce a branch
  // here. The reasoning behind the order, preserved from the eight blocks this replaced:
  //
  //  * `isAdmin` first: platform_admin is walled off from tenant data (it holds no
  //    memberships) and lands on its own provisioning area.
  //  * org_admin, then hospital_admin, then nsp_org_admin BEFORE commission membership:
  //    each is a super-user home for its scope, and its holder navigates down into
  //    commissions from there. A user who is both org_admin and hospital_admin resolves
  //    via org_admin, so the hospital_admin branch only fires for a hospital_admin-only
  //    persona — the one BUG-HAT-001 dropped into the dead end.
  //  * the three "office" hats LAST — NSP operator, Diretor Técnico, quality reviewer.
  //    Each is worn ALONGSIDE a day job, so placing them after the commission branches
  //    means they only change the outcome for someone who would otherwise dead-end. A DT
  //    who is also a commission member keeps landing on the commission (and so has no
  //    link to their inbox yet — FUP-MEM-3b).
  //
  // `redirect()` throws, so the first branch that resolves wins and the loop never
  // continues past it; a branch that is empty resolves to `null` and falls through.
  for (const branch of LANDING_BRANCHES) {
    const href = resolveLanding(branch, context);
    if (href) {
      redirect(href);
    }
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
