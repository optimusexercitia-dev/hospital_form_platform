/**
 * Shared display helpers for the cases UI. A case is identified by its
 * per-commission minted number, shown zero-padded as "Caso 0042".
 *
 * ⭐ The two case-NUMBER formatters MOVED to `@/lib/cases/format` (F4) and are
 * re-exported here so existing importers keep working. They are re-exported, NOT
 * re-declared: the printed dossier renders the same identity and `src/lib` cannot
 * import upward from `src/components`, which is why the dossier's header read
 * "Caso 1" while every screen read "Caso 0001".
 *
 * ⛔ Do not "restore" either function here — a local copy is what the move
 * removed. Everything BELOW is genuine UI display formatting (dates, initials,
 * overdue arithmetic) that paper has no use for, and it stays.
 */

export {
  formatCaseNumber,
  formatCaseNumberWithTerm,
} from "@/lib/cases/format";

import type { CasePhaseStatus } from "@/lib/queries/cases";

/** Format an ISO timestamp as a pt-BR short date (date only — no time noise). */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Two-letter initials from a name; "?" when empty. */
export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Compact age of an ISO date relative to now: "hoje" or "{n}d". */
export function ageLabel(iso: string): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return "";
  const days = Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
  return days === 0 ? "hoje" : `${days}d`;
}

/**
 * Format a phase due date (ISO `YYYY-MM-DD`) as a pt-BR `dd/MM/yyyy` string.
 *
 * The date is parsed as a LOCAL date (split on "-", build via `new Date(y, m, d)`)
 * rather than `new Date(iso)` — passing a date-only string to the `Date`
 * constructor parses it as UTC midnight, which renders the previous day in
 * negative-offset timezones (e.g. Brazil). Returns the raw input if unparseable.
 */
export function formatDueDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts.map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Whether a phase is overdue: its due date is strictly before today (local,
 * date-only comparison) AND the phase is still open work (`pendente`/`ativa`).
 * A null/blank/unparseable due date, or a phase already concluded/skipped, is
 * never overdue.
 */
export function isOverdue(
  dueIso: string | null,
  status: CasePhaseStatus,
): boolean {
  if (!dueIso) return false;
  if (status !== "pending" && status !== "active") return false;
  const parts = dueIso.split("-");
  if (parts.length !== 3) return false;
  const [y, m, d] = parts.map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return false;
  const due = new Date(y, m - 1, d);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due.getTime() < today.getTime();
}
