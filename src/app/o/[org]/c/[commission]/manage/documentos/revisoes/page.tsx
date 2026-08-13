import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { listDocumentsDueForReview } from "@/lib/queries/controlled-documents";
import { commissionHref } from "@/lib/routing";
import { ReviewDueList } from "@/components/controlled-documents/review-due-list";

export const metadata: Metadata = {
  title: "Revisões pendentes",
};

/**
 * Review-due list (Phase 17, F5). Coordinator area (flag + role gated by the
 * `manage/documentos` layout). Surfaces controlled documents AND published form
 * versions of this commission whose review is overdue or approaching, from
 * `listDocumentsDueForReview`. This list also feeds the Phase-20 escalation
 * surface later.
 *
 * The review-due query is commission-scoped, so every row belongs to the current
 * commission; the `commissionId → slug` map is therefore just this commission.
 */
export default async function ReviewDuePage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const rows = await listDocumentsDueForReview(access.commission.id);

  // Every row is scoped to this commission; map its id to the current slug so the
  // list can build detail/builder hrefs.
  const commissionSlugById: Record<string, string> = {
    [access.commission.id]: access.commission.slug,
  };

  const listHref = commissionHref(org, commission, "manage", "documentos");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={listHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar aos documentos
        </Link>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Revisões pendentes</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Documentos controlados e formulários publicados desta comissão com
            revisão vencida ou próxima do vencimento.
          </p>
        </div>
      </header>

      <ReviewDueList
        rows={rows}
        org={org}
        commissionSlugById={commissionSlugById}
      />
    </div>
  );
}
