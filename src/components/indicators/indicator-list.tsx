import Link from "next/link";
import { ArrowRight, LineChart } from "lucide-react";

import { commissionHref } from "@/lib/routing";
import type { Indicator, MeasurementStatus } from "@/lib/indicators/types";
import { INDICATOR_STATUS_LABELS } from "@/lib/indicators/types";
import {
  IndicatorKindBadge,
  MeasurementStatusChip,
  formatTarget,
} from "@/components/indicators/indicator-format";

/**
 * The indicator list (Phase 15, F1). Server-rendered cards — code, name, kind,
 * target, and the latest-measurement status chip. Staggered entrance per the
 * design system. `latestStatusByIndicator` is resolved by the page (the list
 * query returns the embedded latest status).
 *
 * Takes plain `org`/`commission` slugs and builds each card href internally via
 * the pure `commissionHref` — never a function prop, so this stays safe even if
 * it is ever pulled into a client tree (the BUG-QI-001 anti-pattern class).
 */
export function IndicatorList({
  indicators,
  org,
  commission,
  latestStatusByIndicator,
}: {
  indicators: Indicator[];
  org: string;
  commission: string;
  /** Optional map of indicator id → its latest measurement status (for the chip). */
  latestStatusByIndicator?: Record<string, MeasurementStatus>;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {indicators.map((indicator, i) => {
        const status = latestStatusByIndicator?.[indicator.id] ?? "sem_dados";
        return (
          <li
            key={indicator.id}
            className="animate-rise-in"
            style={{ "--rise-delay": `${i * 60}ms` } as React.CSSProperties}
          >
            <Link
              href={commissionHref(
                org,
                commission,
                "manage",
                "indicadores",
                indicator.id,
              )}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {indicator.code}
                    </span>
                    <IndicatorKindBadge kind={indicator.kind} />
                    {indicator.status === "arquivado" ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {INDICATOR_STATUS_LABELS.arquivado}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-base font-semibold text-balance">
                    {indicator.name}
                  </h3>
                </div>
                <MeasurementStatusChip status={status} className="shrink-0" />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  {formatTarget(
                    indicator.targetComparator,
                    indicator.targetValue,
                    indicator.unit,
                  )}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                />
              </div>
            </Link>
          </li>
        );
      })}
      {indicators.length === 0 ? (
        <li>
          <div className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <LineChart aria-hidden="true" className="size-6" />
            </span>
            <h3 className="text-lg font-semibold">Nenhum indicador ainda</h3>
            <p className="max-w-sm text-sm text-muted-foreground text-pretty">
              Crie o primeiro indicador de qualidade desta comissão para começar
              a acompanhar metas e tendências.
            </p>
          </div>
        </li>
      ) : null}
    </ul>
  );
}
