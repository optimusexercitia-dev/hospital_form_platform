/** Display helpers for the Wave-A document UI (DM2·S3). */

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
