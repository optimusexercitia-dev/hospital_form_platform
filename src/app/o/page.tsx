import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";

import type { OrganizationRef } from "@/lib/queries/session";
import { requireUser } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";

export const metadata: Metadata = {
  title: "Suas organizações",
};

/**
 * Organization picker for admins who manage more than one organization.
 * Reached from the root role-landing when the caller administers several orgs —
 * as an `org_admin` (`orgAdminOf`) AND/OR a `hospital_admin` of hospitals across
 * more than one org (`hospitalAdminOf`, ADR 0051). The list is the DISTINCT union
 * of both, so a hospital_admin-only multi-org persona sees its orgs here instead
 * of bouncing back to `/` in a loop (BUG-HAT-001 sibling). Each card opens that
 * org's management area (which scopes to the caller's grants). Defensive
 * shortcuts: a single org jumps straight in, and a caller who administers none is
 * sent back to the root landing to resolve elsewhere.
 */
export default async function OrgPickerPage() {
  const context = await requireUser();

  // Distinct orgs the caller administers, org_admin ∪ hospital_admin (by slug).
  const byId = new Map<string, OrganizationRef>();
  for (const o of context.orgAdminOf) byId.set(o.organization.id, o.organization);
  for (const h of context.hospitalAdminOf) {
    if (!byId.has(h.organization.id)) byId.set(h.organization.id, h.organization);
  }
  const organizations = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  if (organizations.length === 1) {
    redirect(orgHref(organizations[0].slug, "manage"));
  }
  if (organizations.length === 0) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header
        className="animate-rise-in flex flex-col gap-2"
        style={{ ["--rise-delay" as string]: "40ms" }}
      >
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
          Administração da organização
        </p>
        <h1 className="text-3xl text-balance">Escolha uma organização</h1>
        <p className="text-muted-foreground text-pretty">
          Você administra mais de uma organização. Selecione com qual deseja
          trabalhar agora.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {organizations.map((organization, i) => (
          <li
            key={organization.id}
            className="animate-rise-in"
            style={{ ["--rise-delay" as string]: `${80 + i * 60}ms` }}
          >
            <Link
              href={orgHref(organization.slug, "manage")}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
              >
                <Building2 className="size-5" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{organization.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  /{organization.slug}
                </span>
              </span>
              <ArrowRight
                className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
