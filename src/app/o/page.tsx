import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";

import { requireUser } from "@/lib/queries/session";
import { orgHref } from "@/lib/routing";

export const metadata: Metadata = {
  title: "Suas organizações",
};

/**
 * Organization picker for org_admins who administer more than one organization.
 * Reached from the root role-landing when `orgAdminOf.length > 1`. Each card
 * opens that org's management area. Defensive shortcuts keep the page coherent
 * if entered directly: a single org jumps straight in, and a user who is not an
 * org_admin of anything is sent back to the root landing to resolve elsewhere.
 */
export default async function OrgPickerPage() {
  const context = await requireUser();
  const { orgAdminOf } = context;

  if (orgAdminOf.length === 1) {
    redirect(orgHref(orgAdminOf[0].organization.slug, "manage"));
  }
  if (orgAdminOf.length === 0) {
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
        {orgAdminOf.map((o, i) => (
          <li
            key={o.organization.id}
            className="animate-rise-in"
            style={{ ["--rise-delay" as string]: `${80 + i * 60}ms` }}
          >
            <Link
              href={orgHref(o.organization.slug, "manage")}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"
              >
                <Building2 className="size-5" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{o.organization.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  /{o.organization.slug}
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
