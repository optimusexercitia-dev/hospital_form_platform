import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  getCommissionAccessByOrg,
  canConfigureCommission,
} from "@/lib/queries/session";
import { createIndicator } from "@/lib/indicators/actions";
import { commissionHref } from "@/lib/routing";
import { getDerivedPickerForms } from "@/components/indicators/derived-picker-data";
import { IndicatorBuilder } from "@/components/indicators/indicator-builder";

export const metadata: Metadata = {
  title: "Novo indicador",
};

/**
 * Create-indicator page (Phase 15, F1 + F2). Server shell: resolves the derived
 * picker forms + binds the `createIndicator` action, then hands them to the
 * client builder (the WizardRunner data-load/bind boundary). Coordinator-gated by
 * the area layout.
 */
export default async function NewIndicatorPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || !canConfigureCommission(access)) {
    notFound();
  }

  const forms = await getDerivedPickerForms(access.commission.id);
  const listHref = commissionHref(org, commission, "manage", "indicadores");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Link
          href={listHref}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Voltar aos indicadores
        </Link>
        <h1 className="text-3xl text-balance">Novo indicador</h1>
        <p className="max-w-prose text-muted-foreground text-pretty">
          Defina a meta, a periodicidade e como o indicador é medido. Você pode
          começar de um modelo pronto.
        </p>
      </header>

      <IndicatorBuilder
        createAction={createIndicator}
        commissionId={access.commission.id}
        forms={forms}
        org={org}
        commission={commission}
        listHref={listHref}
      />
    </div>
  );
}
