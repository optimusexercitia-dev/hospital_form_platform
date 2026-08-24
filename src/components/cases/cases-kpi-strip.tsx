"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { StatCount } from "@/components/admin/stat-count";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/text";
import type { CaseActionItemKpis } from "@/lib/queries/case-action-items";
import type { CaseKpis } from "./case-derive";
import {
  DEFAULT_CASE_FILTERS,
  type CaseFilterState,
} from "./case-filters";

type Tone = "accent" | "plain" | "warn" | "danger" | "good";

/** Tone → the tiny sub-line dot colour (status by colour + the text beside it). */
const TONE_DOT: Record<Tone, string> = {
  accent: "bg-primary",
  plain: "bg-muted-foreground",
  warn: "bg-warning",
  danger: "bg-destructive",
  good: "bg-success",
};

/**
 * One clickable KPI. The card BODY is identical to the link variant below; only the
 * element and the pressed affordance differ, so the two share this inner layout.
 */
function KpiBody({
  label,
  value,
  sub,
  tone,
  valueClassName,
  labelSuffix,
  reserveBadge = false,
}: {
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  valueClassName?: string;
  labelSuffix?: React.ReactNode;
  /** Keep the label clear of the absolutely-positioned "Filtrando" pill. */
  reserveBadge?: boolean;
}) {
  return (
    <>
      {/*
        The label reserves TWO lines' height on every card, whether it needs them or
        not. "Itens de ação em atraso" wraps at this column width and the others do
        not, and a card whose big number sits a line lower than its five neighbours
        reads as a rendering fault rather than a longer label.
      */}
      <span
        className={cn(
          "flex min-h-[2.1em] items-start gap-1.5 text-[0.72rem] leading-[1.05rem] font-semibold text-muted-foreground",
          reserveBadge && "pr-[4.5rem]",
        )}
      >
        {label}
        {labelSuffix}
      </span>
      <span
        className={cn(
          "mt-0.5 text-[1.7rem] leading-none font-bold text-foreground tabular-nums",
          valueClassName,
        )}
      >
        <StatCount value={value} />
      </span>
      <span className="mt-2 flex min-w-0 items-center gap-1.5 text-[0.72rem] text-muted-foreground">
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
        />
        <span className="truncate">{sub}</span>
      </span>
    </>
  );
}

/**
 * A KPI card that APPLIES its own filter. `aria-pressed` carries the toggle state so
 * the affordance is not conveyed by the ring alone, and the "Filtrando" pill states it
 * in words for the same reason (never colour-only status — design system §2).
 */
function KpiFilterCard({
  label,
  value,
  sub,
  tone,
  index,
  active,
  onToggle,
}: {
  label: string;
  value: number;
  sub: string;
  tone: Tone;
  index: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      style={{ ["--rise-delay" as string]: `${index * 60}ms` }}
      className={cn(
        "animate-rise-in relative flex flex-col rounded-xl border bg-card px-4 py-3.5 text-left shadow-xs",
        "transition-[border-color,box-shadow] hover:shadow-sm",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        active
          ? "border-primary ring-[3px] ring-ring/18"
          : "border-border hover:border-primary/35",
      )}
    >
      {active && (
        <span className="absolute top-2.5 right-2.5 rounded-full bg-accent px-1.5 py-0.5 text-[0.62rem] font-semibold text-primary">
          Filtrando
        </span>
      )}
      <KpiBody
        label={label}
        value={value}
        sub={sub}
        tone={tone}
        reserveBadge={active}
      />
    </button>
  );
}

/**
 * The board KPI strip — six cards, five of which APPLY a filter on click (R1).
 *
 * Toggle semantics, deliberately asymmetric:
 *  - Clicking an INACTIVE card resets every other filter (keeping only the search
 *    query) before applying its own. Without that reset the headline number and the
 *    rows listed under it disagree — the card says "12 fases atrasadas" while a
 *    left-over Desfecho filter lists 3 — and the card is exactly the affordance a
 *    chair uses to ask "show me those".
 *  - Clicking an ACTIVE card clears ONLY its own fields, so un-toggling does not also
 *    throw away filters the user set afterwards.
 *
 * The sixth card is NOT a filter: action items are a different entity with their own
 * surface, so it is a LINK out. It renders as a plain card when that surface is off
 * (`actionItemsHref` absent) rather than emitting a link that 404s.
 */
export function CasesKpiStrip({
  kpis,
  actionItems,
  actionItemsHref,
  filters,
  onFiltersChange,
}: {
  kpis: CaseKpis;
  /** Action-item counts (R4). Adds the "Itens de ação em atraso" card when provided. */
  actionItems?: CaseActionItemKpis;
  /** Where the action-items card links. Omit when that surface is unavailable. */
  actionItemsHref?: string;
  filters: CaseFilterState;
  onFiltersChange: (next: CaseFilterState) => void;
}) {
  /** Whether every field this card owns already holds the card's value. */
  const isActive = (patch: Partial<CaseFilterState>) =>
    (Object.keys(patch) as Array<keyof CaseFilterState>).every(
      (key) => JSON.stringify(filters[key]) === JSON.stringify(patch[key]),
    );

  const toggle =
    (patch: Partial<CaseFilterState>, clear: Partial<CaseFilterState>) => () => {
      if (isActive(patch)) onFiltersChange({ ...filters, ...clear });
      else onFiltersChange({ ...DEFAULT_CASE_FILTERS, q: filters.q, ...patch });
    };

  const cards: Array<{
    label: string;
    value: number;
    sub: string;
    tone: Tone;
    patch: Partial<CaseFilterState>;
    clear: Partial<CaseFilterState>;
  }> = [
    {
      label: "Em aberto",
      value: kpis.casosAbertos,
      sub:
        kpis.abertosEsteMes > 0
          ? `+${kpis.abertosEsteMes} este mês`
          : "Nenhum novo este mês",
      tone: "accent",
      patch: { status: "abertos" },
      clear: { status: "todos" },
    },
    {
      label: "Fases ativas",
      value: kpis.fasesAtivas,
      sub: `em ${kpis.casosComFaseAtiva} ${plural(kpis.casosComFaseAtiva, "caso", "casos")}`,
      tone: "plain",
      patch: { status: "in_review" },
      clear: { status: "todos" },
    },
    {
      label: "Etapas pendentes",
      value: kpis.fasesPendentes,
      sub: "Fases e narrativas em aberto",
      tone: "warn",
      patch: { status: "pending" },
      clear: { status: "todos" },
    },
    {
      label: "Fases atrasadas",
      value: kpis.fasesAtrasadas,
      sub: `em ${kpis.casosAtrasados} ${plural(kpis.casosAtrasados, "caso", "casos")}`,
      tone: "danger",
      patch: { overdue: true },
      clear: { overdue: false },
    },
    {
      label: "Encerrados no mês",
      value: kpis.concluidosEsteMes,
      sub: `${kpis.concluidos} no total`,
      tone: "good",
      patch: { status: "completed", period: "month" },
      clear: { status: "todos", period: "all" },
    },
  ];

  const actionCard = actionItems && {
    label: "Itens de ação em atraso",
    value: actionItems.overdue,
    sub: `de ${actionItems.open} ${plural(actionItems.open, "aberto", "abertos")}`,
    tone: "danger" as Tone,
    valueClassName: actionItems.overdue > 0 ? "text-destructive" : undefined,
  };

  return (
    <section
      aria-label="Indicadores dos casos"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map((c, i) => (
        <KpiFilterCard
          key={c.label}
          label={c.label}
          value={c.value}
          sub={c.sub}
          tone={c.tone}
          index={i}
          active={isActive(c.patch)}
          onToggle={toggle(c.patch, c.clear)}
        />
      ))}

      {actionCard &&
        (actionItemsHref ? (
          <Link
            href={actionItemsHref}
            style={{ ["--rise-delay" as string]: "300ms" }}
            className="animate-rise-in relative flex flex-col rounded-xl border border-border bg-card px-4 py-3.5 text-left text-foreground shadow-xs transition-[border-color,box-shadow] hover:border-primary/35 hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <KpiBody
              {...actionCard}
              labelSuffix={
                <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
              }
            />
          </Link>
        ) : (
          <div
            style={{ ["--rise-delay" as string]: "300ms" }}
            className="animate-rise-in relative flex flex-col rounded-xl border border-border bg-card px-4 py-3.5 shadow-xs"
          >
            <KpiBody {...actionCard} />
          </div>
        ))}
    </section>
  );
}
