import { CheckCircle2, FileClock, FilePen, Files } from "lucide-react";

import { cn } from "@/lib/utils";

/** The register counts, computed FE-side from the document list (ADR 0081 B4). */
export interface DocumentKpis {
  total: number;
  awaitingApproval: number;
  effective: number;
  draftOrRevision: number;
  reviewOverdue: number;
}

interface KpiCard {
  key: string;
  label: string;
  value: number;
  icon: typeof Files;
  tone: "accent" | "warning" | "success" | "muted";
  /** Optional emphasis sub-line (e.g. overdue) — rendered only when it matters. */
  sub?: { text: string; tone: "destructive" | "muted" } | null;
}

const TONE_ICON: Record<KpiCard["tone"], string> = {
  accent: "bg-accent text-accent-foreground",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  muted: "bg-muted text-muted-foreground",
};

/**
 * The register KPI strip (Phase 17 v2, F-A). Four counts derived from the loaded
 * document list — no backend call. Staggered entrance via `--rise-delay`
 * (reduced-motion collapses it, globals.css). Token-driven.
 */
export function DocumentKpiStrip({ kpis }: { kpis: DocumentKpis }) {
  const cards: KpiCard[] = [
    {
      key: "total",
      label: "Documentos controlados",
      value: kpis.total,
      icon: Files,
      tone: "accent",
    },
    {
      key: "awaiting",
      label: "Aguardando aprovação",
      value: kpis.awaitingApproval,
      icon: FileClock,
      tone: "warning",
    },
    {
      key: "effective",
      label: "Vigentes",
      value: kpis.effective,
      icon: CheckCircle2,
      tone: "success",
      sub:
        kpis.reviewOverdue > 0
          ? {
              text: `${kpis.reviewOverdue} com revisão vencida`,
              tone: "destructive",
            }
          : null,
    },
    {
      key: "draft-revision",
      label: "Em revisão / rascunho",
      value: kpis.draftOrRevision,
      icon: FilePen,
      tone: "muted",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="animate-rise-in flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs"
            style={{ "--rise-delay": `${i * 60}ms` } as React.CSSProperties}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg",
                  TONE_ICON[card.tone],
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <dt className="text-xs font-medium text-muted-foreground text-pretty">
                {card.label}
              </dt>
            </div>
            <dd className="flex flex-col gap-0.5">
              <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                {card.value}
              </span>
              {card.sub ? (
                <span
                  className={cn(
                    "text-xs font-medium",
                    card.sub.tone === "destructive"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {card.sub.text}
                </span>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
