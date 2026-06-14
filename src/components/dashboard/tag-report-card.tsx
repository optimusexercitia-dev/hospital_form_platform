import { Tag } from "lucide-react";

import type { CaseTagReportRow } from "@/lib/queries/case-tags";
import { cn } from "@/lib/utils";
import { TOKEN_COLOR_VAR } from "@/components/cases/case-status-badge";

/**
 * Dashboard card: per-tag case counts over the active date window (Cases-Extras
 * R3). A compact horizontal bar list (bar length ∝ count, tinted by the tag's
 * colour token) — the on-brand way to show a small categorical breakdown without
 * a heavy chart. Server-Component-safe; the rows + date window arrive as props
 * from the dashboard page. Counts are bounded on `cases.created_at` server-side.
 */
export function TagReportCard({
  rows,
  rangeLabel,
}: {
  rows: CaseTagReportRow[];
  /** A pt-BR description of the active window (e.g. "todo o período"). */
  rangeLabel: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.caseCount), 0);

  return (
    <section
      aria-labelledby="tag-report-heading"
      className="animate-rise-in flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Tag aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="tag-report-heading" className="text-base font-semibold">
            Casos por etiqueta
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Contagem de casos por etiqueta — {rangeLabel}.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhum caso com etiqueta neste período.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const pct = max > 0 ? Math.round((row.caseCount / max) * 100) : 0;
            return (
              <li key={row.tagId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: TOKEN_COLOR_VAR[row.colorToken],
                      }}
                    />
                    <span className="truncate font-medium text-foreground">
                      {row.name}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.caseCount}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <div
                    className={cn("h-full rounded-full")}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: TOKEN_COLOR_VAR[row.colorToken],
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
