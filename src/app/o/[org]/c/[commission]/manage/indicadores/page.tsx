import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import {
  getCommissionAccessByOrg,
  canConfigureCommission,
} from "@/lib/queries/session";
import { listIndicators } from "@/lib/queries/indicators";
import type { MeasurementStatus } from "@/lib/indicators/types";
import { commissionHref } from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { IndicatorList } from "@/components/indicators/indicator-list";

export const metadata: Metadata = {
  title: "Indicadores de qualidade",
};

/**
 * Indicator list (Phase 15, F1). Coordinator area — the flag + role are enforced
 * by the `manage/indicadores` layout. Lists the commission's indicators with a
 * latest-status chip.
 *
 * `listIndicators` returns `IndicatorListItem` (extends `Indicator` with the
 * embedded latest-measurement summary), so the chip reads `item.latestStatus`
 * directly — no per-indicator series read.
 */
export default async function IndicatorsPage({
  params,
}: {
  params: Promise<{ org: string; commission: string }>;
}) {
  const { org, commission } = await params;
  const access = await getCommissionAccessByOrg(org, commission);
  if (!access || !canConfigureCommission(access)) {
    notFound();
  }

  const indicators = await listIndicators(access.commission.id);

  // Latest classification for the list chip comes embedded on each list item.
  const latestStatusByIndicator: Record<string, MeasurementStatus> = {};
  for (const item of indicators) {
    latestStatusByIndicator[item.id] = item.latestStatus;
  }

  const newHref = commissionHref(
    org,
    commission,
    "manage",
    "indicadores",
    "novo",
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">
            {access.commission.name}
          </p>
          <h1 className="text-3xl text-balance">Indicadores de qualidade</h1>
          <p className="max-w-prose text-muted-foreground text-pretty">
            Metas, medições e tendências dos indicadores de qualidade desta
            comissão — inseridos manualmente ou derivados dos formulários
            enviados.
          </p>
        </div>
        <div>
          <Button asChild size="lg">
            <Link href={newHref}>
              <Plus aria-hidden="true" className="size-4" />
              Novo indicador
            </Link>
          </Button>
        </div>
      </header>

      <IndicatorList
        indicators={indicators}
        org={org}
        commission={commission}
        latestStatusByIndicator={latestStatusByIndicator}
      />
    </div>
  );
}
