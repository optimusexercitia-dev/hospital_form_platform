/**
 * Shared display helpers for the cases UI. A case is identified by its
 * per-commission minted number, shown zero-padded as "Caso 0042".
 */

/** "Caso 0042" — zero-padded to at least 4 digits, the per-commission counter. */
export function formatCaseNumber(caseNumber: number): string {
  return `Caso ${String(caseNumber).padStart(4, "0")}`;
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
