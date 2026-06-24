import { commissionHref } from "@/lib/routing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import {
  listSubmissions,
  listSubmissionFilterMembers,
  listSubmissionFilterForms,
  type SubmissionFilters,
} from "@/lib/queries/submissions";
import { SubmissionsFilters } from "@/components/dashboard/submissions-filters";
import { SubmissionRow } from "@/components/dashboard/submission-row";

export const metadata: Metadata = {
  title: "Respostas enviadas",
};

/**
 * Submissions browser (F4, coordinator area): the commission's SUBMITTED
 * responses, filterable by member/form/date, with an explicit opt-in
 * "em andamento" toggle that also lists in_progress responses METADATA-ONLY
 * (never their answers — the Phase-7 invariant; the row UI offers no open
 * affordance for them).
 *
 * Staff_admin-gated here in addition to RLS (mirrors the dashboard / cases
 * board). All filters are URL-driven so this Server Component re-queries.
 */
export default async function SubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; commission: string }>;
  searchParams: Promise<{
    member?: string;
    form?: string;
    from?: string;
    to?: string;
    inProgress?: string;
  }>;
}) {
  const { org, commission } = await params;
  const slug = commission;
  const sp = await searchParams;
  const access = await getCommissionAccessByOrg(org, commission);

  if (!access || (access.role !== "staff_admin" && !access.context.isAdmin)) {
    notFound();
  }

  const includeInProgress = sp.inProgress === "1";
  const filters: SubmissionFilters = {
    memberId: sp.member || undefined,
    formId: sp.form || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    includeInProgress,
  };

  const [rows, members, forms] = await Promise.all([
    listSubmissions(access.commission.id, filters),
    listSubmissionFilterMembers(access.commission.id),
    listSubmissionFilterForms(access.commission.id),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={commissionHref(org, commission, "dashboard")}
          className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Painel
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Respostas enviadas</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Consulte as respostas enviadas pela comissão. Abra uma resposta para
            ver o conteúdo enviado, fiel à versão do formulário.
          </p>
        </div>
      </header>

      <SubmissionsFilters
        members={members}
        forms={forms}
        member={sp.member ?? null}
        form={sp.form ?? null}
        from={sp.from ?? null}
        to={sp.to ?? null}
        includeInProgress={includeInProgress}
      />

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <ul aria-label="Respostas" className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <SubmissionRow
              key={row.responseId}
              org={org} slug={slug}
              row={row}
              index={index}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent/60 text-accent-foreground">
        <Inbox aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Nenhuma resposta encontrada</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Ajuste os filtros ou aguarde novos envios da comissão.
      </p>
    </div>
  );
}
