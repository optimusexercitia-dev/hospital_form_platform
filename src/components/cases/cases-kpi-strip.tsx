import { StatCount } from "@/components/admin/stat-count";
import { cn } from "@/lib/utils";
import type { CaseActionItemKpis } from "@/lib/queries/case-action-items";
import type { CaseKpis } from "./case-derive";

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
 * The cases overview KPI strip. Derived entirely from the loaded board rows (no
 * new backend) and computed by {@link computeCaseKpis}. Numbers count up on mount
 * (reduced-motion-safe via StatCount).
 */
export function CasesKpiStrip({
  kpis,
  actionItems,
}: {
  kpis: CaseKpis;
  /** Action-item counts (R4). Adds an "Itens de ação" card when provided. */
  actionItems?: CaseActionItemKpis;
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

  return (
    <section
      aria-label="Indicadores dos casos"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
    >
      {cards.map((c, i) => (
        <KpiCard key={c.label} {...c} index={i} />
      ))}
    </section>
  );
}
