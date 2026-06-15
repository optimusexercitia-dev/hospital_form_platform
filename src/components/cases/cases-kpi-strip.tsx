import { StatCount } from "@/components/admin/stat-count";
import { cn } from "@/lib/utils";
import type { CaseActionItemKpis } from "@/lib/queries/case-action-items";
import type { CaseKpis, OutcomeBreakdown } from "./case-derive";
import { CaseStatusBadge } from "./case-status-badge";

type Tone = "accent" | "plain" | "warn" | "danger" | "good";

/** Tone → the tiny sub-line dot colour (status by colour + the text beside it). */
const TONE_DOT: Record<Tone, string> = {
  accent: "bg-primary",
  plain: "bg-muted-foreground",
  warn: "bg-warning",
  danger: "bg-destructive",
  good: "bg-success",
};

function KpiCard({
  label,
  value,
  sub,
  tone,
  index,
}: {
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  index: number;
}) {
  return (
    <div
      style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
      className="animate-rise-in rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <p className="text-[0.72rem] font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[1.7rem] leading-none font-bold tabular-nums text-foreground">
        <StatCount value={value} />
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
        />
        <span className="truncate">{sub}</span>
      </p>
    </div>
  );
}

/**
 * The outcome breakdown panel (D14): per-outcome case counts + an overall
 * "% adverse" headline, derived from the loaded board rows
 * (`computeOutcomeBreakdown`). Only rendered when at least one case carries an
 * outcome. The % adverse is over the outcome-bearing cases (its denominator is
 * shown for honesty) — adverse-flagged outcomes also carry the destructive marker.
 */
function OutcomeBreakdownPanel({ breakdown }: { breakdown: OutcomeBreakdown }) {
  const { rows, totalWithOutcome, adverseCount, adversePercent } = breakdown;

  return (
    <section
      aria-labelledby="outcome-breakdown-heading"
      className="animate-fade-in rounded-2xl border border-border bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2
            id="outcome-breakdown-heading"
            className="text-base font-semibold"
          >
            Desfechos
          </h2>
          <p className="text-xs text-muted-foreground">
            {totalWithOutcome}{" "}
            {totalWithOutcome === 1
              ? "caso com desfecho atribuído"
              : "casos com desfecho atribuído"}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <p className="text-[1.4rem] leading-none font-bold tabular-nums text-foreground">
            {adversePercent === null ? "—" : `${adversePercent}%`}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-destructive"
            />
            <span>
              adversos ({adverseCount}/{totalWithOutcome})
            </span>
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {rows.map((r) => {
          const pct =
            totalWithOutcome === 0
              ? 0
              : Math.round((r.count / totalWithOutcome) * 100);
          return (
            <li key={r.outcomeId} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <CaseStatusBadge label={r.label} colorToken={r.colorToken} />
                  {r.isAdverse && (
                    <span className="text-[0.65rem] font-semibold tracking-wide text-destructive uppercase">
                      Adverso
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {r.count} · {pct}%
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className={cn(
                    "block h-full rounded-full",
                    r.isAdverse ? "bg-destructive/70" : "bg-primary/70",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The cases overview KPI strip. Derived entirely from the loaded board rows (no
 * new backend) and computed by {@link computeCaseKpis}. Numbers count up on mount
 * (reduced-motion-safe via StatCount). When an outcome breakdown is supplied and
 * any case carries an outcome, a per-outcome breakdown panel renders below the
 * cards (D14).
 */
export function CasesKpiStrip({
  kpis,
  actionItems,
  outcomeBreakdown,
}: {
  kpis: CaseKpis;
  /** Action-item counts (R4). Adds an "Itens de ação" card when provided. */
  actionItems?: CaseActionItemKpis;
  /** Outcome breakdown (D14). Renders the breakdown panel when ≥1 case has one. */
  outcomeBreakdown?: OutcomeBreakdown;
}) {
  const cards: Array<{ label: string; value: number; sub: string; tone: Tone }> =
    [
      {
        label: "Em aberto",
        value: kpis.casosAbertos,
        sub:
          kpis.abertosEsteMes > 0
            ? `+${kpis.abertosEsteMes} este mês`
            : "Nenhum novo este mês",
        tone: "accent",
      },
      {
        label: "Fases ativas",
        value: kpis.fasesAtivas,
        sub:
          kpis.casosComFaseAtiva === 1
            ? "em 1 caso"
            : `em ${kpis.casosComFaseAtiva} casos`,
        tone: "plain",
      },
      {
        label: "Fases pendentes",
        value: kpis.fasesPendentes,
        sub: "Aguardando início",
        tone: "warn",
      },
      {
        label: "Sem responsável",
        value: kpis.semResponsavel,
        sub: "Atribuição necessária",
        tone: "danger",
      },
      {
        label: "Encerrados",
        value: kpis.concluidos,
        sub:
          kpis.concluidosEsteMes > 0
            ? `+${kpis.concluidosEsteMes} este mês`
            : "Nenhum este mês",
        tone: "good",
      },
    ];

  if (actionItems) {
    cards.push({
      label: "Itens de ação",
      value: actionItems.open,
      sub:
        actionItems.overdue > 0
          ? `${actionItems.overdue} atrasado${actionItems.overdue === 1 ? "" : "s"}`
          : "Nenhum atrasado",
      tone: actionItems.overdue > 0 ? "danger" : "plain",
    });
  }

  const showBreakdown =
    outcomeBreakdown != null && outcomeBreakdown.totalWithOutcome > 0;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Indicadores dos casos"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      >
        {cards.map((c, i) => (
          <KpiCard key={c.label} {...c} index={i} />
        ))}
      </section>

      {showBreakdown && <OutcomeBreakdownPanel breakdown={outcomeBreakdown} />}
    </div>
  );
}
