import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCommissionForAdmin } from "@/lib/queries/commissions";
import { CommissionEditForm } from "@/components/admin/commission-edit-form";
import { StaffAdminManager } from "@/components/admin/staff-admin-manager";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const commission = await getCommissionForAdmin(slug);
  return { title: commission ? commission.name : "Comissão" };
}

/**
 * Admin commission detail. Edit the commission's name (slug is immutable) and
 * manage its coordinators (staff_admins) — assign by e-mail (invite-if-new) and
 * remove. Admin access is enforced by `admin/layout.tsx`; an unknown or
 * unreadable slug yields `notFound()` (RLS returns no row).
 */
export default async function AdminCommissionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const commission = await getCommissionForAdmin(slug);

  if (!commission) {
    notFound();
  }

  const createdAtLabel = formatDate(commission.createdAt);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link
          href="/admin"
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
