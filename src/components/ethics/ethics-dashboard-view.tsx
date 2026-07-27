import { Scale } from "lucide-react";

import type { EthicsDashboardSummary } from "@/lib/queries/ethics-dashboard";
import type { AdmissibilityStatus, DecisionStatus } from "@/lib/queries/ethics";
import {
  ADMISSIBILITY_STATUS_LABELS,
  DECISION_STATUS_LABELS,
} from "@/components/ethics/ethics-labels";
import {
  EthicsBreakdownChart,
  type EthicsBreakdownRow,
} from "@/components/ethics/ethics-dashboard-charts";

/** Presentation order for the admissibility + decision breakdowns. */
const ADMISSIBILITY_ORDER: AdmissibilityStatus[] = [
  "pending",
  "admissible",
  "inadmissible",
];
const DECISION_ORDER: DecisionStatus[] = [
  "draft",
  "proposed",
  "voted",
  "issued",
  "appealed",
  "voided",
];

/**
 * The ethics dashboard body (ETH·E3a) — coordinator-scoped statistics over the
 * ethics cases the VIEWER can read (the RLS-scoping keystone lives in
 * `getEthicsDashboard`; this component only presents the resolved summary).
 *
 * Presentational + prop-driven (no hooks, no data-loading), so it renders on the
 * server and mounts the client Recharts pieces ({@link EthicsBreakdownChart}) as
 * children — mirroring `dashboard-charts.tsx`. All copy is pt-BR (Rule 10).
 */
export function EthicsDashboardView({
  summary,
}: {
  summary: EthicsDashboardSummary;
}) {
  const admissibilityRows: EthicsBreakdownRow[] = ADMISSIBILITY_ORDER.map(
    (key) => ({
      key,
      label: ADMISSIBILITY_STATUS_LABELS[key],
      count: summary.byAdmissibilityStatus[key] ?? 0,
    }),
  );
  const decisionRows: EthicsBreakdownRow[] = DECISION_ORDER.map((key) => ({
    key,
    label: DECISION_STATUS_LABELS[key],
    count: summary.byCaseDecisionStatus[key] ?? 0,
  }));
  const sanctionRows: EthicsBreakdownRow[] = summary.sanctionOutcomeCounts.map(
    (s) => ({ key: s.sanctionTypeId, label: s.label, count: s.count }),
  );

  if (summary.totalCases === 0) {
    return <EmptyState />;
  }

  const medianLabel =
    summary.medianCycleTimeDays == null
      ? "—"
      : `${summary.medianCycleTimeDays}`;

  return (
    <div className="flex flex-col gap-7">
      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Processos éticos"
          value={`${summary.totalCases}`}
          caption="Total acessível a você nesta comissão"
          delayMs={0}
        />
        <StatCard
          label="Tempo mediano de tramitação"
          value={medianLabel}
          unit={summary.medianCycleTimeDays == null ? undefined : "dias"}
          caption="Da denúncia à decisão emitida"
          delayMs={60}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EthicsBreakdownChart
          heading="Admissibilidade"
          headingId="ethics-dash-admissibility"
          rows={admissibilityRows}
          categoryLabel="Situação"
          emptyLabel="Nenhum processo com admissibilidade avaliada ainda."
        />
        <EthicsBreakdownChart
          heading="Situação das decisões"
          headingId="ethics-dash-decisions"
          rows={decisionRows}
          categoryLabel="Situação"
          emptyLabel="Nenhuma decisão registrada ainda."
        />
      </div>

      <EthicsBreakdownChart
        heading="Sanções aplicadas"
        headingId="ethics-dash-sanctions"
        rows={sanctionRows}
        categoryLabel="Sanção"
        emptyLabel="Nenhuma sanção em decisões emitidas ainda."
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  caption,
  delayMs,
}: {
  label: string;
  value: string;
  unit?: string;
  caption: string;
  delayMs: number;
}) {
  return (
    <section
      aria-label={label}
      className="animate-rise-in flex flex-col gap-1 rounded-2xl border border-border bg-card p-5 shadow-xs"
      style={{ "--rise-delay": `${delayMs}ms` } as React.CSSProperties}
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-muted-foreground">{unit}</span>
        )}
      </p>
      <p className="text-sm text-muted-foreground text-pretty">{caption}</p>
    </section>
  );
}

function EmptyState() {
  return (
    <section
      aria-label="Sem processos éticos"
      className="animate-rise-in flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Scale aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-lg font-semibold">Ainda não há processos éticos</h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        Quando processos éticos forem registrados e tramitados nesta comissão,
        as estatísticas de admissibilidade, decisões e sanções aparecerão aqui.
      </p>
    </section>
  );
}
