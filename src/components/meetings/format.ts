/**
 * Shared display helpers for the Meetings UI. A meeting is identified by its
 * per-commission minted number, shown zero-padded as "Reunião 0042".
 */

/** "Reunião 0042" — zero-padded to at least 4 digits, the per-commission counter. */
export function formatMeetingNumber(meetingNumber: number): string {
  return `Reunião ${String(meetingNumber).padStart(4, "0")}`;
}

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
 * Format a meeting's scheduled window for display: the start date+time, plus the
 * end time when present (same day) or end date+time otherwise. Returns the raw
 * start when unparseable.
 */
export function formatSchedule(
  startIso: string,
  endIso: string | null,
): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return startIso;
  const startLabel = formatDateTime(startIso);
  if (!endIso) return startLabel;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return startLabel;

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    const endTime = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(end);
    return `${startLabel} – ${endTime}`;
  }
  return `${startLabel} – ${formatDateTime(endIso)}`;
}

/**
 * Convert an ISO timestamp to the value a `datetime-local` input expects
 * (`YYYY-MM-DDTHH:mm`, in LOCAL time). Returns "" when absent/unparseable.
 */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Two-letter initials from a name; "?" when empty. */
export function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format a due date (ISO `YYYY-MM-DD`) as pt-BR `dd/MM/yyyy`, parsed as LOCAL. */
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
