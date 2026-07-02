/**
 * Display helpers for the unified "Meus itens de ação" list. Kept local to the
 * feature (rather than cross-importing the cases/ or meetings/ modules) so this
 * screen owns its own formatting. Mirrors the project's date conventions:
 *  - timestamps (`created_at`) render as pt-BR date + time,
 *  - a DATE-only deadline (`due_date`, `YYYY-MM-DD`) is parsed as a LOCAL date
 *    to avoid the UTC-midnight off-by-one in negative-offset timezones (Brazil).
 */

import type { MyActionItemStatus } from "@/lib/queries/action-items";

/** Format an ISO timestamp as a pt-BR date + time ("15/06/2026, 14:30"). */
export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Format a due date (ISO `YYYY-MM-DD`) as a pt-BR `dd/MM/yyyy` string, parsed as
 * a LOCAL date. Passing a date-only string to `new Date(iso)` parses it as UTC
 * midnight, which renders the previous day in negative-offset timezones — so we
 * split and build via `new Date(y, m - 1, d)`. Returns the raw input if
 * unparseable.
 */
export function formatDueDate(iso: string): string {
  const date = parseLocalDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Whether an action item is overdue: its due date is strictly before today
 * (local, date-only comparison) AND the item is still active work
 * (`open`/`in_progress`). A null/unparseable due date, or a done/cancelled item,
 * is never overdue.
 */
export function isOverdue(
  dueIso: string | null,
  status: MyActionItemStatus,
): boolean {
  if (!dueIso) return false;
  if (status !== "open" && status !== "in_progress") return false;
  const due = parseLocalDate(dueIso);
  if (!due) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < today.getTime();
}

/** Parse a `YYYY-MM-DD` string as a LOCAL date; null when malformed. */
function parseLocalDate(iso: string): Date | null {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
