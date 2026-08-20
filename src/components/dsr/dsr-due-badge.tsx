import { CalendarClock } from "lucide-react";

import { DSR_DUE_DATE_NOTICE } from "@/lib/dsr/messages";

/**
 * The due-date badge — ⛔ A BADGE, NOT A PROMISE (ADR 0130 Decision 10 / Q9iii).
 *
 * There is NO SCHEDULER ANYWHERE IN THIS PLATFORM (Critical FUP C1's finding).
 * Nothing fires on this date: no reminder, no escalation, no automatic close. The
 * date is a reference the Encarregado reads and acts on personally, and every
 * string on this component exists to keep that true — {@link DSR_DUE_DATE_NOTICE}
 * is rendered wherever the badge carries a tooltip-free surface.
 *
 * ⚠ THE COMPONENT DELIBERATELY DOES NOT SAY "15 DIAS". `create_dsr_request` takes
 * `p_due_days default 15` — a PARAMETER, not a constant — so a hardcoded count
 * would go stale silently against a row computed from a different value. The badge
 * renders the row's ACTUAL `due_date` and asserts nothing about how it was derived.
 *
 * Server-safe: presentational only, no `"use client"`, no data access.
 *
 * Status is conveyed by icon + text + the explicit "em atraso" word, never by
 * colour alone (design system §6).
 */
export function DsrDueBadge({
  dueDate,
  closedAt,
}: {
  /** The row's own `due_date` (ISO). Rendered as-is — never recomputed here. */
  dueDate: string;
  /**
   * When the request is already closed the deadline is history, so it renders
   * neutral: an overdue tint on a finished request is noise, not information.
   */
  closedAt?: string | null;
}) {
  // `due_date` is a Postgres DATE ("2026-09-04"). `new Date("2026-09-04")` parses
  // as UTC midnight, which renders as the PREVIOUS day in any negative-offset
  // timezone (America/Sao_Paulo is UTC-3), so the calendar parts are read
  // explicitly rather than trusting the Date constructor's timezone behaviour.
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  const due = new Date(y, (m ?? 1) - 1, d ?? 1);
  const label = due.toLocaleDateString("pt-BR");

  // Day granularity: a request due TODAY is not late. Both sides are collapsed to
  // local midnight so the comparison cannot flip on the time of day.
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const overdue = !closedAt && due.getTime() < todayStart;

  return (
    <span
      className={
        overdue
          ? "inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/12 px-2.5 py-0.5 text-xs font-medium text-warning"
          : "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      <CalendarClock aria-hidden="true" className="size-3.5" />
      <span className="tabular-nums">
        {overdue ? `Prazo vencido em ${label}` : `Prazo ${label}`}
      </span>
    </span>
  );
}

/**
 * The non-automation notice that must accompany the badge wherever the deadline
 * is presented as actionable. Split from the badge so a dense list can carry the
 * badge once and the notice once, rather than repeating the sentence per row.
 */
export function DsrDueNotice() {
  return (
    <p className="text-xs text-muted-foreground text-pretty">
      {DSR_DUE_DATE_NOTICE}
    </p>
  );
}
