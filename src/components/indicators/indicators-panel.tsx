import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

import type { IndicatorKpis } from "@/lib/indicators/types";

/**
 * The "Indicadores" panel on the commission dashboard (Phase 15, F6). A compact
 * KPI card: total active indicators + the na-meta / fora-da-meta / sem-dados
 * counts (by each indicator's LATEST measurement), from `getIndicatorKpis`. Links
 * through to the indicators area. Status is conveyed by icon + text + token colour.
 */
export function IndicatorsPanel({
  kpis,
  indicatorsHref,
}: {
  kpis: IndicatorKpis;
  indicatorsHref: string;
}) {
  const stats: {
    label: string;
    value: number;
    icon: typeof CheckCircle2;
    tone: string;
  }[] = [
    {
      label: "Na meta",
      value: kpis.naMeta,
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      label: "Fora da meta",
      value: kpis.foraDaMeta,
      icon: CircleAlert,
      tone: "text-destructive",
    },
    {
      label: "Sem dados",
      value: kpis.semDados,
      icon: CircleDashed,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <section
      aria-labelledby="indicators-panel-heading"
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="indicators-panel-heading" className="text-lg font-semibold">
          Indicadores
        </h2>
        <Link
          href={indicatorsHref}
          className="group inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Ver todos
          <ArrowRight
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>

      {kpis.total === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum indicador ativo. Crie indicadores para acompanhar metas e
          tendências.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {kpis.total}
            </span>{" "}
            {kpis.total === 1
              ? "indicador ativo"
              : "indicadores ativos"}
          </p>
          <dl className="grid grid-cols-3 gap-3">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-background px-3 py-3"
                >
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon aria-hidden="true" className={`size-3.5 ${s.tone}`} />
                    {s.label}
                  </dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">
                    {s.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </>
      )}
    </section>
  );
}
