import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  IndicatorKind,
  MeasurementStatus,
} from "@/lib/indicators/types";
import {
  INDICATOR_KIND_LABELS,
  MEASUREMENT_STATUS_LABELS,
} from "@/lib/indicators/types";

/**
 * Shared presentational helpers for the Quality Indicators UI (Phase 15).
 *
 * Server-Component-safe — pure rendering + formatting, no `"use client"`, so both
 * server pages and client trees import it. Status is conveyed by ICON + TEXT +
 * COLOR (never colour alone — the design system's accessibility rule): `na_meta`
 * uses the success token, `fora_da_meta` the destructive token, `sem_dados` the
 * muted token. All copy is pt-BR (Rule 10).
 */

const STATUS_STYLES: Record<
  MeasurementStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  na_meta: {
    icon: CheckCircle2,
    className: "bg-success/12 text-success",
  },
  fora_da_meta: {
    icon: CircleAlert,
    className: "bg-destructive/10 text-destructive",
  },
  sem_dados: {
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
};

/**
 * A compact status chip for a measurement classification. Icon + pt-BR text +
 * token colour — legible without relying on colour perception.
 */
export function MeasurementStatusChip({
  status,
  className,
}: {
  status: MeasurementStatus;
  className?: string;
}) {
  const { icon: Icon, className: tone } = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {MEASUREMENT_STATUS_LABELS[status]}
    </span>
  );
}

/** A neutral pill naming the indicator kind (percentual / taxa / …). */
export function IndicatorKindBadge({
  kind,
  className,
}: {
  kind: IndicatorKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground",
        className,
      )}
    >
      {INDICATOR_KIND_LABELS[kind]}
    </span>
  );
}

/**
 * Format a measurement/target `value` for display, appending the indicator unit
 * when present. `null` renders as an em dash. Uses tabular pt-BR number
 * formatting (up to 2 decimals, trailing zeros trimmed) so columns align.
 */
export function formatIndicatorValue(
  value: number | null,
  unit: string | null,
): string {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Human-readable pt-BR label for a target given its comparator and value, e.g.
 * "Meta: ≥ 90%". Returns "Sem meta definida" when the target is unset.
 */
export function formatTarget(
  comparator: string,
  value: number | null,
  unit: string | null,
): string {
  if (value == null) return "Sem meta definida";
  const pretty: Record<string, string> = {
    ">=": "≥",
    "<=": "≤",
    "=": "=",
    ">": ">",
    "<": "<",
  };
  return `Meta: ${pretty[comparator] ?? comparator} ${formatIndicatorValue(value, unit)}`;
}

/**
 * A pt-BR period label for `YYYY-MM` (e.g. "jun. 2026") or a bare label
 * otherwise. The stored `period_label` is opaque; we prettify the common monthly
 * shape while passing anything else through unchanged.
 */
export function formatPeriodLabel(periodLabel: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(periodLabel);
  if (!match) return periodLabel;
  const [, year, month] = match;
  const d = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(d);
}
