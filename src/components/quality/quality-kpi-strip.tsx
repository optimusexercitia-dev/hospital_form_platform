import { StatCount } from "@/components/admin/stat-count";
import { cn } from "@/lib/utils";
import type { QualityBoardCommission } from "@/lib/queries/quality";

type Tone = "accent" | "plain" | "warn";

/** Tone → the sub-line dot colour (status by shape + text, never colour alone). */
const TONE_DOT: Record<Tone, string> = {
  accent: "bg-primary",
  plain: "bg-muted-foreground",
  warn: "bg-warning",
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
      <p className="mt-1 text-[1.7rem] leading-none font-bold text-foreground tabular-nums">
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
 * The oversight KPI strip: what the quality office can see, at a glance. Server
 * Component — derived entirely from `quality_board_summary` rows already loaded
 * by the page (the counts are computed DB-side; nothing is recomputed here).
 *
 * ⚠ THE "CASOS RESTRITOS" CARD IS A DELIBERATELY THIN SURFACE (ADR 0100 D6).
 * `explicit_grants_only` cases are invisible to the oversight arm; a PHI-free
 * COUNT is the *entire* permitted awareness of that population. So this card is
 * not clickable, carries no drill-in, no tooltip, no per-commission breakdown
 * beyond the count the chips already show, and never renders a ghost row. There
 * is no affordance here whose only possible next step is to ask for content.
 *
 * Its tone is `plain`, NOT `warn` or `danger`, and that is a decision rather than
 * a default: a restricted case is a normal governance state (a committee
 * protecting a sensitive matter), not an anomaly. Colouring it as an alert would
 * itself be a signal about content — the reader would infer that something is
 * wrong in there, which is precisely the inference D6 withholds.
 */
export function QualityKpiStrip({
  commissions,
}: {
  commissions: QualityBoardCommission[];
}) {
  const totalCases = commissions.reduce((n, c) => n + c.totalCases, 0);
  const openCases = commissions.reduce((n, c) => n + c.openCases, 0);
  const lockedCases = commissions.reduce((n, c) => n + c.lockedCases, 0);

  const cards: Array<{
    label: string;
    value: number;
    sub: string;
    tone: Tone;
  }> = [
    {
      label: "Comissões",
      value: commissions.length,
      sub: "sob supervisão da qualidade",
      tone: "accent",
    },
    {
      label: "Casos visíveis",
      value: totalCases,
      sub: "no alcance da supervisão",
      tone: "plain",
    },
    {
      label: "Em aberto",
      value: openCases,
      sub: "ainda em andamento",
      tone: "warn",
    },
    {
      label: "Casos restritos",
      value: lockedCases,
      sub: "acesso restrito à comissão",
      tone: "plain",
    },
  ];

  return (
    <section aria-labelledby="quality-kpi-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="quality-kpi-heading" className="text-base font-semibold">
          Visão geral
        </h2>
        {/* Scope, stated where the numbers are (FUP-QO-4). The strip aggregates
            every oversight-visible commission; the chips below filter only the
            table. Both are correct, and side by side they read as contradictory
            — "Casos visíveis: 6" directly above a one-row table. Rendered only
            when more than one commission is visible, i.e. exactly when the chip
            row exists and the ambiguity is possible; `commissions.length` is
            already in hand, so this needs no new prop and no state lifting. */}
        {commissions.length > 1 ? (
          <p className="text-xs text-muted-foreground text-pretty">
            Somatório de todas as comissões sob supervisão — não muda com o
            filtro de comissão abaixo.
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c, i) => (
          <KpiCard key={c.label} {...c} index={i} />
        ))}
      </div>
    </section>
  );
}
