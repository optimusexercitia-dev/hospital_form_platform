"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

/**
 * Shared period-window inputs for the measurement dialogs (Phase 15, MINOR-1).
 *
 * Renders the `periodStart` / `periodEnd` date fields that scope a measurement's
 * aggregation window. For DERIVED/HYBRID indicators this is load-bearing: the
 * compute RPC treats a null window as ALL-TIME, so without an explicit window a
 * "monthly" derived indicator would show the same all-time value every period and
 * its trend would come out flat. The MANUAL dialog stores the window for
 * provenance too.
 *
 * FormData field names mirror the actions' reads EXACTLY (`periodStart`,
 * `periodEnd` → `parseDate` → `p_period_start`/`p_period_end`), so both
 * `recordIndicatorMeasurement` and `computeDerivedMeasurement` pick them up by
 * construction.
 *
 * Defaults derive from a monthly `periodLabel` (`YYYY-MM` → that month's first/last
 * day) so the common case is one-click, but both fields stay editable. Passing a
 * non-monthly `periodLabel` (or none) leaves them blank for the user to fill.
 */

/** First/last calendar day of a `YYYY-MM` period label, else null. */
export function monthBoundsFromLabel(
  periodLabel: string,
): { start: string; end: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodLabel.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]); // 1-12
  if (month < 1 || month > 12) return null;
  const start = `${match[1]}-${match[2]}-01`;
  // Day 0 of the next month = last day of this month (handles leap years).
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function PeriodWindowFields({
  periodLabel,
  initialStart,
  initialEnd,
  startError,
  endError,
}: {
  /** The current period label; monthly labels seed sensible default bounds. */
  periodLabel: string;
  /** Prefill (when editing an existing measurement). */
  initialStart?: string | null;
  initialEnd?: string | null;
  startError?: string;
  endError?: string;
}) {
  const derived = monthBoundsFromLabel(periodLabel);
  // User overrides (null = not yet edited → follow the period-derived default).
  const [startOverride, setStartOverride] = useState<string | null>(
    initialStart ?? null,
  );
  const [endOverride, setEndOverride] = useState<string | null>(
    initialEnd ?? null,
  );
  // Derive during render (not an effect): an un-edited field tracks the current
  // period label's month bounds live as the user types the label; once edited, the
  // explicit value sticks.
  const start = startOverride ?? derived?.start ?? "";
  const end = endOverride ?? derived?.end ?? "";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="periodStart">Início do período</FieldLabel>
        <Input
          id="periodStart"
          name="periodStart"
          type="date"
          value={start}
          onChange={(e) => setStartOverride(e.target.value)}
          required
          aria-describedby="periodStart-description"
          aria-invalid={startError ? true : undefined}
        />
        <FieldError>{startError}</FieldError>
      </Field>
      <Field>
        <FieldLabel htmlFor="periodEnd">Fim do período</FieldLabel>
        <Input
          id="periodEnd"
          name="periodEnd"
          type="date"
          value={end}
          onChange={(e) => setEndOverride(e.target.value)}
          required
          aria-describedby="periodStart-description"
          aria-invalid={endError ? true : undefined}
        />
        <FieldError>{endError}</FieldError>
      </Field>
      <FieldDescription id="periodStart-description" className="sm:col-span-2">
        Somente respostas enviadas nesta janela entram no cálculo.
      </FieldDescription>
    </div>
  );
}
