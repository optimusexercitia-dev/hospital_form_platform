import Link from "next/link";
import { notFound } from "next/navigation";
import { Stethoscope } from "lucide-react";

import { getRawGrants, getTechnicalDirectionAccessByOrg } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

/**
 * ACT (ADR 0106) — the Diretor Técnico's shell. This console previously had NO
 * `layout.tsx` at all (design note `docs/design/act-role-picker.md` §4.4):
 * `direcao-tecnica/page.tsx` rendered no persistent chrome beyond its own
 * page-content `<header>`, so it was the one choke point missing BOTH the
 * `UserMenu` hat indicator every other console carries and a route-scoped
 * `not-found.tsx` boundary for the D9 switch hint.
 *
 * Mirrors the `nsp-org`/`qualidade` header-bar shells exactly. The access
 * check here DUPLICATES `page.tsx`'s own `getTechnicalDirectionAccessByOrg`
 * call (same cached resolver — `cache()`-deduped within the request, so this
 * costs nothing extra) — this layout decides console ENTRY (chrome + the D9
 * boundary), the page keeps its own additional feature-flag gate
 * (`case_referrals` + `technical_director`) unchanged.
 */
export default async function TechnicalDirectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const [access, grants] = await Promise.all([
    getTechnicalDirectionAccessByOrg(org),
    getRawGrants(),
  ]);

  if (!access) {
    // Unknown org OR no technical-direction standing in it — indistinguishable
    // by design, both 404 and leak nothing about which organizations exist.
    notFound();
  }

  const { context, organization } = access;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={orgHref(organization.slug, "direcao-tecnica")}
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${organization.name} — Direção Técnica`}
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
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-accent-foreground uppercase"
          >
            <Stethoscope aria-hidden="true" className="size-3" />
            Direção técnica
          </span>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <UserMenu
              fullName={context.fullName}
              email={context.email}
              activeRole={context.activeRole}
              grants={grants}
            />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
