import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getSessionContext } from "@/lib/queries/session";
import { controlledDocsEnabled } from "@/lib/queries/feature-flags";
import { UserMenu } from "@/components/shell/user-menu";
import { OrgApprovalsNav } from "@/components/shell/org-approvals-nav";

/**
 * Shell for the ORG-level document-approval queue (`/o/[org]/documentos-pendentes`).
 * Without this layout the route fell through to the bare root layout with NO nav
 * (F5) — sibling org routes (`c/[commission]`, `manage`, `nsp`, `nsp-org`) each
 * mount their own header shell, but this one had none.
 *
 * The gate mirrors the page's own (deliberately BROADER than the admin consoles):
 * a valid session + SOME standing in this org (commission member, org_admin, OR
 * hospital_admin). An approver may live OUTSIDE the document's commission, so
 * gating on admin-only (like `manage`/`nsp-org`) would lock out the very people
 * this queue serves. Access is still enforced by the page + RLS; this layout only
 * resolves the org's display name and mounts the nav so the header never vanishes.
 *
 * NOT `AppSidebar`: that shell is commission-scoped (needs a specific commission's
 * id/role/counts) and would render a misleading commission nav on this org-level
 * route. `OrgApprovalsNav` is the right-sized org shell; no backend query is added
 * — everything comes from `getSessionContext()`.
 */
export default async function PendingApprovalsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;

  const [flagOn, context] = await Promise.all([
    controlledDocsEnabled(),
    getSessionContext(),
  ]);
  if (!flagOn) {
    notFound();
  }
  if (!context) {
    notFound();
  }

  // The caller must have SOME standing in THIS org (commission membership,
  // org_admin, or hospital_admin — all RLS-scoped reads). Resolve the org's
  // display name from whichever list matched.
  const organization =
    context.memberships.find((m) => m.commission.organization.slug === org)
      ?.commission.organization ??
    context.orgAdminOf.find((o) => o.organization.slug === org)?.organization ??
    context.hospitalAdminOf.find((h) => h.organization.slug === org)
      ?.organization;
  if (!organization) {
    // Unknown org OR no standing in it — indistinguishable by design (404, leak
    // nothing about which organizations exist). Matches the page's gate.
    notFound();
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          {/* Explicit way back into the app. This ORG-level utility page is
              reached from within a commission (via the sidebar's "Organização"
              section), so its "home" is the caller's role landing (`/`) — their
              commission, or the picker if they belong to several — the same
              destination the commission sidebar's brand link uses. Without this
              every control here self-linked and the user was trapped (F5). */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar
          </Link>
          <span aria-hidden="true" className="h-6 w-px bg-border" />
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${organization.name} — início`}
          >
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            >
              CH
            </span>
            <span className="max-w-[12rem] truncate text-sm font-semibold tracking-tight">
              {organization.name}
            </span>
          </Link>
          <span
            aria-hidden="true"
            className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase"
          >
            Organização
          </span>
          <OrgApprovalsNav org={organization.slug} />
          <div className="ml-auto">
            <UserMenu fullName={context.fullName} email={context.email} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
