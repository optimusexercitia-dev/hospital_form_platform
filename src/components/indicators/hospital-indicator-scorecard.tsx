import { CheckCircle2, CircleAlert, CircleDashed, LineChart } from "lucide-react";

import type { HospitalIndicatorRollupRow } from "@/lib/indicators/types";

/**
 * Hospital indicator scorecard (Phase 15, F6). A PHI-free, read-only per-commission
 * rollup for the hospital-admin surface — counts + status only (no indicator names,
 * definitions, or values beyond the counts the rollup returns; mirrors the
 * `nsp_org_*` aggregate screens). Backed by `getHospitalIndicatorRollup`.
 */
export function HospitalIndicatorScorecard({
  hospitalName,
  rows,
}: {
  hospitalName: string;
  rows: HospitalIndicatorRollupRow[];
}) {
  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      naMeta: acc.naMeta + r.naMeta,
      foraDaMeta: acc.foraDaMeta + r.foraDaMeta,
      semDados: acc.semDados + r.semDados,
    }),
    { total: 0, naMeta: 0, foraDaMeta: 0, semDados: 0 },
  );

  return (
    <section
      aria-labelledby={`scorecard-${hospitalName}`}
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id={`scorecard-${hospitalName}`}
          className="text-lg font-semibold"
        >
          {hospitalName}
        </h2>
        <span className="text-sm text-muted-foreground">
          {totals.total}{" "}
          {totals.total === 1 ? "indicador" : "indicadores"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LineChart aria-hidden="true" className="size-5" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Nenhuma comissão deste hospital possui indicadores ativos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Situação dos indicadores por comissão em {hospitalName}
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Comissão
                </th>
                <th scope="col" className="py-2 px-3 text-right font-medium">
                  Total
                </th>
                <th scope="col" className="py-2 px-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2
                      aria-hidden="true"
                      className="size-3.5 text-success"
                    />
                    Na meta
                  </span>
                </th>
                <th scope="col" className="py-2 px-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <CircleAlert
                      aria-hidden="true"
                      className="size-3.5 text-destructive"
                    />
                    Fora da meta
                  </span>
                </th>
                <th scope="col" className="py-2 pl-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    <CircleDashed
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground"
                    />
                    Sem dados
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.commissionId}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <th
                    scope="row"
                    className="py-2 pr-3 font-normal text-foreground/90"
                  >
                    {row.commissionName}
                  </th>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {row.total}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-success">
                    {row.naMeta}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-destructive">
                    {row.foraDaMeta}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                    {row.semDados}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium">
                <th scope="row" className="py-2 pr-3 text-left">
                  Total
                </th>
                <td className="py-2 px-3 text-right tabular-nums">
                  {totals.total}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-success">
                  {totals.naMeta}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-destructive">
                  {totals.foraDaMeta}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                  {totals.semDados}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
