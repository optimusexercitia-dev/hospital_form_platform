import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getCommissionAccessByOrg } from "@/lib/queries/session";
import { getIndicator } from "@/lib/queries/indicators";
import { updateIndicator } from "@/lib/indicators/actions";
import { commissionHref } from "@/lib/routing";
import { getDerivedPickerForms } from "@/components/indicators/derived-picker-data";
import { IndicatorBuilder } from "@/components/indicators/indicator-builder";
import { ArchiveIndicatorButton } from "@/components/indicators/archive-indicator-button";

export const metadata: Metadata = {
  title: "Editar indicador",
};

/**
 * Edit-indicator page (Phase 15, F1). Server shell: loads the indicator + the
 * derived picker forms, binds `updateIndicator`, and renders the builder in edit
 * mode. Archived indicators are read-only (404 on edit). Coordinator-gated.
 */
export default async function EditIndicatorPage({
  params,
}: {
  params: Promise<{ org: string; commission: string; indicatorId: string }>;
}) {
  const { org, commission, indicatorId } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || access.role !== "staff_admin") {
    notFound();
  }

  const indicator = await getIndicator(indicatorId);
  if (
    !indicator ||
    indicator.commissionId !== access.commission.id ||
    indicator.status === "arquivado"
  ) {
    notFound();
  }

  const forms = await getDerivedPickerForms(access.commission.id);
  const listHref = commissionHref(org, commission, "manage", "indicadores");
  const detailHref = commissionHref(
    org,
    commission,
    "manage",
    "indicadores",
    indicatorId,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={detailHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar ao indicador
        </Link>
        <h1 className="text-3xl text-balance">Editar indicador</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Ajuste a definição, a meta e a origem dos dados.
        </p>
      </header>

      <IndicatorBuilder
        updateAction={updateIndicator}
        commissionId={access.commission.id}
        forms={forms}
        org={org}
        commission={commission}
        listHref={listHref}
        existing={indicator}
      />

      <section
        aria-labelledby="archive-heading"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <h2 id="archive-heading" className="text-lg font-semibold">
          Arquivar indicador
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Um indicador arquivado deixa de aceitar novas medições, mas seu
          histórico permanece disponível para consulta.
        </p>
        <ArchiveIndicatorButton indicatorId={indicatorId} listHref={listHref} />
      </section>
    </div>
  );
}
