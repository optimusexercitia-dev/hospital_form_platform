import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionContext, getRawGrants } from "@/lib/queries/session";
import { createClient } from "@/lib/supabase/server";
import { dsrHref } from "@/lib/routing";
import { dsrEnabled, listMyDsrHospitals } from "@/lib/queries/dsr";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

/**
 * The "Direitos do Titular" (DSR) console shell — LGPD Art. 18 subject requests,
 * ADR 0130. Server Component, behind the `dsr` feature flag.
 *
 * ACCESS IS ENFORCED HERE, ON THE SERVER, and it is deliberately a UNION of two
 * unlike standings (ADR 0130 Decision 2's power split):
 *   · the Encarregado (DPO) of a hospital in this org — opens, adjudicates and
 *     closes requests; holds NO disposal-door arm by design;
 *   · an EXECUTOR — anyone with a task routed to a scope where they already wear
 *     a qualifying hat (staff_admin / tenancy admin / PQS operator).
 * `list_my_dsr_hospitals()` answers both from the same predicates the RLS
 * policies use, so this gate can never admit someone whose rows RLS would hide.
 *
 * ⛔ A platform admin gets `notFound()` like any other stranger: ADR 0130
 * Decision 2 puts platform_admin outside this plane entirely (the ADR-0078 A35
 * noun rule — this is commission content and adjudication, not tenancy).
 *
 * Hospital is scoped internally via `?hospital=`, never a URL segment
 * (ADR 0041 D8), mirroring the NSP console.
 */
export default async function DsrConsoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const [{ org }, flagOn] = await Promise.all([params, dsrEnabled()]);
  if (!flagOn) {
    notFound();
  }

  const context = await getSessionContext();
  if (!context) {
    notFound();
  }

  // The org row is RLS-scoped (`organizations_select` admits any commission
  // member of the org, which every DPO and executor is). A foreign slug yields
  // no row → 404, leaking nothing about which organizations exist.
  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, slug, name")
    .eq("slug", org)
    .maybeSingle<{ id: string; slug: string; name: string }>();

  if (!organization) {
    notFound();
  }

  const hospitals = (await listMyDsrHospitals()).filter(
    (h) => h.orgId === organization.id,
  );
  if (hospitals.length === 0) {
    // No Encarregado office and no routed task in this org — indistinguishable
    // from an unknown org by design.
    notFound();
  }

  const grants = await getRawGrants();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href={dsrHref(organization.slug)}
            className="flex items-center gap-2 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            aria-label={`${organization.name} — Direitos do Titular`}
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
            Titulares
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
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
