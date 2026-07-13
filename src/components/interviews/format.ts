/**
 * Shared display helpers for the Interviews UI. An interview is identified by its
 * per-commission minted number, shown zero-padded as "Entrevista 0042".
 *
 * The date/time formatting is shared with Meetings; re-exported from there so the
 * two features format timestamps identically (no duplicate locale logic).
 */

import { formatDateTime } from "@/components/meetings/format";
import type { NextSessionSummary } from "@/lib/queries/interviews";
import { SESSION_TYPE_LABEL } from "./interview-labels";

export {
  formatDate,
  formatDateTime,
  formatSchedule,
  toDateTimeLocalValue,
} from "@/components/meetings/format";

/**
 * A one-line pt-BR summary of the next upcoming (`scheduled`) session, for the
 * list subtitle + detail header — e.g. "Próxima sessão · Follow-up · 15/06/2026,
 * 14:30" (the date is dropped when the session has no start set yet).
 */
export function formatNextSession(next: NextSessionSummary): string {
  const parts = ["Próxima sessão", SESSION_TYPE_LABEL[next.sessionType]];
  if (next.scheduledStart) parts.push(formatDateTime(next.scheduledStart));
  return parts.join(" · ");
}

/** "Entrevista 0042" — zero-padded to at least 4 digits, the per-commission counter. */
export function formatInterviewNumber(interviewNumber: number): string {
  return `Entrevista ${String(interviewNumber).padStart(4, "0")}`;
}

/** "Caso 0042" — the joined case number, for the detail breadcrumb. */
export function formatCaseNumber(caseNumber: number): string {
  return `Caso ${String(caseNumber).padStart(4, "0")}`;
}

/** The UI title for an interview: its free-text title, else "Entrevista nº N". */
export function interviewTitle(
  title: string | null,
  interviewNumber: number,
): string {
  const trimmed = title?.trim();
  return trimmed && trimmed.length > 0
    ? trimmed
    : `Entrevista nº ${interviewNumber}`;
}
