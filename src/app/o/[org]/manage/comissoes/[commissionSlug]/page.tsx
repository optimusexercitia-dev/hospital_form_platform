import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getCommissionForAdmin } from "@/lib/queries/commissions";
import { orgHref } from "@/lib/routing";
import { CommissionEditForm } from "@/components/admin/commission-edit-form";
import { StaffAdminManager } from "@/components/admin/staff-admin-manager";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string; commissionSlug: string }>;
}): Promise<Metadata> {
  const { org, commissionSlug } = await params;
  const access = await getCommissionAccessByOrg(org, commissionSlug);
  return { title: access ? access.commission.name : "Comissão" };
}

/**
 * Org-admin commission detail (the relocated `/admin/comissoes/[slug]`). Edit the
 * commission's name (slug is immutable) and manage its coordinators
 * (staff_admins) — assign by e-mail (invite-if-new) and remove. Access is the
 * `/o/[org]/manage` layout gate (`is_org_admin_of(org)`).
 *
 * Resolution is org-SCOPED: `getCommissionAccessByOrg(org, commissionSlug)`
 * confirms the commission belongs to THIS org (slug is unique only per org now),
 * yielding `notFound()` for an unknown/foreign commission and leaking nothing.
 * The staff_admin roster comes from `getCommissionForAdmin` (RLS scopes an
 * org_admin to their org's commissions, so the per-slug read is unambiguous).
 * The assign/remove actions stay in `@/lib/admin/actions` — only their gate was
 * broadened to `is_org_admin_of` in Phase C.
 */
export default async function OrgCommissionDetailPage({
  params,
}: {
  params: Promise<{ org: string; commissionSlug: string }>;
}) {
  const { org, commissionSlug } = await params;

  // Org-scoped resolve: confirms the commission is in this org (or 404).
  const access = await getCommissionAccessByOrg(org, commissionSlug);
  if (!access) {
    notFound();
  }

  // Roster + created-at for the detail (RLS-scoped to the org_admin's org).
  const commission = await getCommissionForAdmin(commissionSlug);
  if (!commission) {
    notFound();
  }

  const createdAtLabel = formatDate(commission.createdAt);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href={orgHref(org, "manage", "comissoes")}
          className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Todas as comissões
        </Link>
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs text-muted-foreground">
            /{commission.slug}
          </p>
          <h1 className="text-3xl text-balance">{commission.name}</h1>
          {createdAtLabel ? (
            <p className="text-sm text-muted-foreground">
              Criada em {createdAtLabel}
            </p>
          ) : null}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <section
          aria-labelledby="dados-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
        >
          <div>
            <h2 id="dados-heading" className="text-lg font-semibold">
              Dados da comissão
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Atualize o nome exibido da comissão.
            </p>
          </div>
          <CommissionEditForm
            commissionId={commission.id}
            slug={commission.slug}
            name={commission.name}
          />
        </section>

        <section
          aria-labelledby="coordenacao-heading"
          className="animate-rise-in flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-7"
          style={{ ["--rise-delay" as string]: "80ms" }}
        >
          <div>
            <h2 id="coordenacao-heading" className="text-lg font-semibold">
              Coordenação
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Coordenadores (staff_admin) constroem formulários e gerenciam os
              membros desta comissão.
            </p>
          </div>
          <StaffAdminManager
            commissionId={commission.id}
            staffAdmins={commission.staffAdmins}
          />
        </section>
      </div>
    </div>
  );
}

/** Formats an ISO timestamp as a pt-BR long date, or null when unparseable. */
function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}
